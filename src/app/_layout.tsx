import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack, usePathname, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database';
import { doc, serverTimestamp as fsServerTimestamp, getDocFromServer, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import BloqueioAnonimo from '../components/BloqueioAnonimo';
import ContaBloqueada from '../components/ContaBloqueada';
import { auth, db, rtdb } from '../config/firebase';
import { UploadProvider } from '../context/UploadContext';
import { UserProvider, interpretarEstadoConta, useUser } from '../context/UserContext';
import { useFcmToken } from '../hooks/useFcmToken';

const TEMPO_LIMITE_ANONIMO_MS = 10 * 60 * 1000;
const ESTADOS_BLOQUEANTES = ['banida', 'suspensa', 'eliminada'];
const CHAMADAS_SOUND_MIGRATED_KEY = '_chamadasSoundMigrated_v1';

// ═══════════════════════════════════════════════════════════════════════
// Chave usada para gravar localmente que este UID já passou pela
// verificação de OTP com sucesso. Uma vez confirmado no Firestore,
// não precisamos de arriscar a mesma leitura de corrida em cada
// arranque do app — lemos o cache local, que é instantâneo e imune
// a qualquer atraso de rede ou leitura incompleta do servidor.
// ═══════════════════════════════════════════════════════════════════════
const chaveOtpVerificado = (uid: string) => `_otpVerificado_${uid}`;

const reloadComTimeout = (user: any) =>
  Promise.race([
    user.reload(),
    new Promise<void>(resolve => setTimeout(resolve, 3000)),
  ]);

function isPermissionsError(e: any) {
  return e?.code === 'permission-denied' ||
    e?.code === 'firestore/permission-denied' ||
    e?.message?.includes('Missing or insufficient permissions');
}

function isNetworkError(e: any) {
  return e?.code === 'unavailable' ||
    e?.code === 'failed-precondition' ||
    e?.message?.includes('network') ||
    e?.message?.includes('offline');
}

// ═══════════════════════════════════════════════════════════════════════
// FIX DEFINITIVO: lê o documento users/{uid} com retry automático.
//
// Causa raiz do bug: existe uma corrida real entre o useFcmToken() (que
// escreve fcmToken/fcmTokenPlatform/fcmTokenUpdated com setDoc merge:true
// logo após o login) e a escrita do perfil completo. Se o documento ainda
// não existir e a escrita do FCM ganhar a corrida, uma leitura nesse
// instante devolve genuinamente um documento só com esses 3 campos —
// não é uma leitura corrompida, é o estado real e temporário do doc.
//
// Esta função detecta esse padrão e tenta de novo até 3 vezes com espera
// crescente, antes de aceitar os dados como válidos.
// ═══════════════════════════════════════════════════════════════════════
async function lerDocumentoUserComRetry(uidAtual: string, tentativas = 3): Promise<any> {
  let ultimoErro: any = null;

  for (let i = 0; i < tentativas; i++) {
    try {
      const docSnap = await getDocFromServer(doc(db, 'users', uidAtual));
      const dados = docSnap.exists() ? docSnap.data() : null;

      const pareceIncompleto =
        dados &&
        dados.fcmToken &&
        dados.nome === undefined &&
        dados.tipoPerfil === undefined &&
        dados.perfilCompleto === undefined;

      if (!pareceIncompleto) {
        return dados;
      }

      console.log(`[Auth] Leitura ${i + 1}/${tentativas} parece incompleta (só FCM) — a repetir...`);
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    } catch (e) {
      ultimoErro = e;
      console.log(`[Auth] Tentativa ${i + 1}/${tentativas} falhou:`, e);
      if (i === tentativas - 1) throw e;
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
  }

  // Última tentativa, aceita o que vier para não bloquear o utilizador
  const docSnapFinal = await getDocFromServer(doc(db, 'users', uidAtual));
  return docSnapFinal.exists() ? docSnapFinal.data() : null;
}

Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

function AppContent() {
  const router   = useRouter();
  const pathname = usePathname();
  const {
    user,
    perfil,
    estadoConta,
    setEstadoContaConfirmado,
    iniciarListenerPerfil,
    pararListenerPerfil,
  } = useUser();

  const [authInitialized, setAuthInitialized] = useState(false);
  const [isAnonimo, setIsAnonimo]             = useState(false);
  const [bloqueioVisivel, setBloqueioVisivel] = useState(false);

  const uidNavegadoRef     = useRef<string | null>(null);
  const timerRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presencaUnsubRef   = useRef<(() => void) | null>(null);
  const chamadaPendenteRef = useRef<Record<string, string> | null>(null);

  useFcmToken();

  // ── Canal Android + listener de notificações ──────────────────────────
  useEffect(() => {
    if (Platform.OS === 'android') {
      const configurarCanalChamadas = async () => {
        try {
          const migrado = await AsyncStorage.getItem(CHAMADAS_SOUND_MIGRATED_KEY);
          if (!migrado) {
            await Notifications.deleteNotificationChannelAsync('chamadas');
            await AsyncStorage.setItem(CHAMADAS_SOUND_MIGRATED_KEY, '1');
          }
          await Notifications.setNotificationChannelAsync('chamadas', {
            name:               'Chamadas',
            importance:         Notifications.AndroidImportance.MAX,
            vibrationPattern:   [0, 250, 250, 250],
            lightColor:         '#25D366',
            sound:              null,
            bypassDnd:          true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        } catch (e) {
          console.warn('[Notificações] Falha ao configurar canal:', e);
        }
      };
      configurarCanalChamadas();
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.tipo === 'chamada_recebida') {
        const params = {
          chatId:  data.chatId  ?? '',
          deUid:   data.deUid   ?? '',
          deNome:  data.deNome  ?? '',
          deFoto:  data.deFoto  ?? '',
          tipo:    data.tipoCham ?? 'voz',
          channel: data.channel  ?? data.chatId ?? '',
        };
        if (authInitialized) {
          router.push({ pathname: '/(main)/chamada-recebida', params });
        } else {
          chamadaPendenteRef.current = params;
        }
      }
    });

    return () => sub.remove();
  }, [authInitialized]);

  // ── Navega para chamada pendente após auth inicializar ────────────────
  useEffect(() => {
    if (authInitialized && chamadaPendenteRef.current) {
      const params = chamadaPendenteRef.current;
      chamadaPendenteRef.current = null;
      setTimeout(() => {
        router.push({ pathname: '/(main)/chamada-recebida', params });
      }, 500);
    }
  }, [authInitialized]);

  // ── Timer bloqueio anónimo ────────────────────────────────────────────
  useEffect(() => {
    if (isAnonimo) {
      timerRef.current = setTimeout(() => setBloqueioVisivel(true), TEMPO_LIMITE_ANONIMO_MS);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isAnonimo]);

  // ── Auth state ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (presencaUnsubRef.current) {
        presencaUnsubRef.current();
        presencaUnsubRef.current = null;
      }

      // ── SEM SESSÃO ──
      // Nota: aqui navegamos ANTES de marcar authInitialized=true, para que
      // o Stack só monte já com a rota final decidida — evita o flash da
      // rota inicial (index.jsx) durante um frame antes do replace.
      if (!firebaseUser) {
        uidNavegadoRef.current = null;
        setIsAnonimo(false);
        setEstadoContaConfirmado(null);
        pararListenerPerfil();
        router.replace('/(auth)');
        setAuthInitialized(true);
        return;
      }

      // ── ANÓNIMO ──
      if (firebaseUser.isAnonymous) {
        uidNavegadoRef.current = firebaseUser.uid;
        setIsAnonimo(true);
        setEstadoContaConfirmado(null);
        router.replace('/(main)/feed');
        setAuthInitialized(true);
        return;
      }

      setIsAnonimo(false);

      // Se já navegámos para este UID, não volta a navegar
      if (uidNavegadoRef.current === firebaseUser.uid) {
        return;
      }

      // ── PRESENÇA RTDB ──
      try {
        const presencaRef  = ref(rtdb, `presenca/${firebaseUser.uid}`);
        const connectedRef = ref(rtdb, '.info/connected');
        const unsubPresenca = onValue(connectedRef, snap => {
          if (snap.val() === true) {
            onDisconnect(presencaRef).set({ online: false, ultimaVez: serverTimestamp() });
            set(presencaRef, { online: true, ultimaVez: serverTimestamp() });
          }
        });
        presencaUnsubRef.current = unsubPresenca;
      } catch (e) {
        console.log('Erro presença RTDB:', e);
      }

      try { await reloadComTimeout(firebaseUser); } catch (_) {}

      // ── EMAIL NÃO VERIFICADO ──
      if (!firebaseUser.emailVerified) {
        // CASO 1: O verificar-codigo.jsx está neste momento a criar a conta
        // (flag _registoConcluindo activa). Não interceptar.
        let registoConcluindo = false;
        try {
          registoConcluindo = (await AsyncStorage.getItem('_registoConcluindo')) === '1';
        } catch (_) {}
        if (registoConcluindo) {
          setAuthInitialized(true);
          return;
        }

        // CASO 1.5: Já confirmámos otpVerificado para este UID numa sessão
        // anterior — está guardado localmente. Não voltamos a arriscar a
        // leitura de corrida contra o Firestore (que pode devolver dados
        // incompletos logo no arranque a frio do app). Confiamos no cache
        // e seguimos directamente para o fluxo normal abaixo.
        let otpJaConfirmadoLocal = false;
        try {
          otpJaConfirmadoLocal = (await AsyncStorage.getItem(chaveOtpVerificado(firebaseUser.uid))) === '1';
        } catch (_) {}

        if (!otpJaConfirmadoLocal) {
          // CASO 2: Utilizador que já passou pelo nosso OTP personalizado.
          // O emailVerified do Firebase fica false porque não usamos o link do Firebase,
          // mas otpVerificado:true no Firestore confirma que o email foi validado.
          // Deixar entrar normalmente sem redirecionar para verificar-codigo.
          let dadosOtp: any = null;
          try {
            dadosOtp = await lerDocumentoUserComRetry(firebaseUser.uid, 3);
          } catch (_) {}

          if (dadosOtp?.otpVerificado === true) {
            // Confirmado — guarda localmente para nunca mais repetir esta
            // verificação de corrida contra o Firestore neste dispositivo.
            try { await AsyncStorage.setItem(chaveOtpVerificado(firebaseUser.uid), '1'); } catch (_) {}
            // continua para o bloco de navegação normal abaixo
          } else {
            // CASO 3: Utilizador realmente não verificado — mandar verificar
            const emailParaVerificar = firebaseUser.email || dadosOtp?.email || '';
            setEstadoContaConfirmado(null);
            uidNavegadoRef.current = firebaseUser.uid;
            router.replace({ pathname: '/(auth)/verificar-codigo', params: { email: emailParaVerificar } });
            setAuthInitialized(true);
            return;
          }
        }
      }

      try {
        // ── Leitura robusta com retry contra leituras incompletas ──
        const dados = await lerDocumentoUserComRetry(firebaseUser.uid, 3);

        // ── UTILIZADOR COMPLETAMENTE NOVO — sem documento ──
        // Nota: isto pode acontecer quando o Firestore ainda não propagou o documento
        // que o verificar-codigo.jsx acabou de gravar. A flag _registoConcluindo
        // protege este caso durante o registo. Para logins normais subsequentes,
        // a função lerDocumentoUserComRetry com 3 tentativas já mitiga a situação.
        if (!dados) {
          // Se há registo a decorrer, aguardar — o verificar-codigo.jsx vai navegar
          let emRegisto = false;
          try { emRegisto = (await AsyncStorage.getItem('_registoConcluindo')) === '1'; } catch (_) {}
          if (emRegisto) {
            setAuthInitialized(true);
            return;
          }

          await setDoc(doc(db, 'users', firebaseUser.uid), {
            email:          firebaseUser.email || '',
            uid:            firebaseUser.uid,
            perfilCompleto: false,
            dataCriacao:    fsServerTimestamp(),
          }, { merge: true });

          setEstadoContaConfirmado(null);
          iniciarListenerPerfil(firebaseUser.uid);
          uidNavegadoRef.current = firebaseUser.uid;
          router.replace('/(auth)/profile');
          setAuthInitialized(true);
          return;
        }

        const estadoReal    = interpretarEstadoConta(dados);
        const estaBloqueada = estadoReal && ESTADOS_BLOQUEANTES.includes(estadoReal.estado);

        if (estaBloqueada) {
          pararListenerPerfil();
          setEstadoContaConfirmado(estadoReal!);
          uidNavegadoRef.current = firebaseUser.uid;
          setAuthInitialized(true);
          return;
        }

        setEstadoContaConfirmado(null);
        iniciarListenerPerfil(firebaseUser.uid);
        uidNavegadoRef.current = firebaseUser.uid;

        // ── Lê campos relevantes ──
        const tipoPerfilRaw     = dados.tipoPerfil;
        const tipoPerfil        = (tipoPerfilRaw || '').trim();
        const etapa             = (dados.etapa             || '').trim();
        const verificacaoEstado = (dados.verificacaoEstado || '').trim();
        const perfilCompleto    = !!dados.perfilCompleto;

        if (!tipoPerfil && pathname?.includes('/(auth)/verificar-codigo')) {
          router.replace('/(auth)/escolher-tipo-perfil');
          setAuthInitialized(true);
          return;
        }
        if (!tipoPerfil && pathname?.includes('/(auth)/register')) {
          router.replace('/(auth)/escolher-tipo-perfil');
          setAuthInitialized(true);
          return;
        }

        // ── RECRUTADOR ──
        if (tipoPerfil === 'recrutador') {
          if (perfilCompleto) {
            router.replace('/(main)/feed');
            setAuthInitialized(true);
            return;
          }
          router.replace('/(auth)/profile-recrutador');
          setAuthInitialized(true);
          return;
        }

        // ── EMPRESA ──
        if (tipoPerfil === 'empresa') {
          if (perfilCompleto) {
            router.replace('/(main)/feed');
            setAuthInitialized(true);
            return;
          }
          router.replace('/(auth)/profile-empresa');
          setAuthInitialized(true);
          return;
        }

        // ── ETAPA INTERMÉDIA ──
        if (etapa === 'experiencia') {
          router.replace('/(auth)/experiencia');
          setAuthInitialized(true);
          return;
        }

        // ── UTILIZADOR NORMAL ──
        if (!perfilCompleto) {
          router.replace('/(auth)/profile');
          setAuthInitialized(true);
          return;
        }

        // Perfil completo → feed
        let destinoFinal = '/(main)/feed';
        try {
          const apos = await AsyncStorage.getItem('_aposEditar');
          if (apos === 'my-profile') {
            destinoFinal = '/(main)/my-profile';
            await AsyncStorage.removeItem('_aposEditar');
          }
        } catch (_) {}
        router.replace(destinoFinal);
        setAuthInitialized(true);

      } catch (error: any) {
        if (isPermissionsError(error) || isNetworkError(error)) {
          setEstadoContaConfirmado(null);
          iniciarListenerPerfil(firebaseUser.uid);
          uidNavegadoRef.current = firebaseUser.uid;
          router.replace('/(main)/feed');
          setAuthInitialized(true);
        } else {
          console.error('Erro crítico _layout:', error);
          setEstadoContaConfirmado(null);
          pararListenerPerfil();
          uidNavegadoRef.current = null;
          router.replace('/(auth)');
          setAuthInitialized(true);
        }
      }
    });

    return () => {
      unsubscribe();
      if (presencaUnsubRef.current) presencaUnsubRef.current();
    };
  }, []);

  // ── Spinner de carregamento ───────────────────────────────────────────
  if (!authInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1677F2" />
      </View>
    );
  }

  // ── Conta bloqueada ───────────────────────────────────────────────────
  const rotasPermitidas = ['/recuperar-conta', '/verificar-codigo'];
  const rotaPermitida   = rotasPermitidas.some(r => pathname?.includes(r));
  const deveMostrarBloqueio =
    estadoConta !== null &&
    ESTADOS_BLOQUEANTES.includes(estadoConta.estado) &&
    !rotaPermitida &&
    user !== null &&
    !user.isAnonymous;

  if (deveMostrarBloqueio) {
    return (
      <ContaBloqueada
        dados={estadoConta!}
        uid={user!.uid}
        email={user!.email || perfil?.emailContacto || ''}
        nome={perfil?.nome || user!.displayName || undefined}
        onNavegar={(destino: string, params?: any) => {
          router.replace({ pathname: destino as any, params });
        }}
        onTerminarSessao={async () => {}}
      />
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 300,
        }}
      />
      <BloqueioAnonimo
        visivel={bloqueioVisivel}
        onFechar={() => setBloqueioVisivel(false)}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <UserProvider>
      <UploadProvider>
        <AppContent />
      </UploadProvider>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});