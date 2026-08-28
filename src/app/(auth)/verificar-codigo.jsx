/**
 * verificar-codigo.jsx — ConnectAll Angola
 * ✅ Após confirmar o OTP, valida o OTP e encaminha para o fluxo de perfil.
 *    A criação do Firebase/UID deverá ser feita no final do registo (depois do perfil + senha).

 * ✅ Fix teclado Android — input posicionado fora do ecrã.
 *
 * FIXES aplicados:
 * 1. Flag _registoConcluindo — impede o _layout de interceptar o onAuthStateChanged
 *    durante a criação da conta e redirecionar de volta para este ecrã.
 * 2. URIs locais (bilhete, CV, etc.) são removidos antes de gravar no Firestore
 *    porque são caminhos do dispositivo, não URLs do Firebase Storage.
 * 3. Campo otpVerificado:true gravado no Firestore — o _layout usa este campo
 *    para não redirecionar utilizadores que usaram o OTP personalizado (cujo
 *    emailVerified do Firebase fica sempre false).
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app, db, auth as firebaseAuth } from '../../config/firebase';

// Campos de URI local que nunca devem ir para o Firestore
// (são caminhos do dispositivo, não URLs do Firebase Storage)
const CAMPOS_URI_LOCAL = [
  'uriBilhete', 'uriCV', 'uriCertificados',
  'uriCartaConducao', 'uriPortefolio', 'uriDiploma',
];

// ── Caixa de dígito ──────────────────────────────────────────────────────────
function DigitoBox({ valor, activo, preenchido }) {
  return (
    <View style={[dg.box, preenchido && dg.boxFilled, activo && dg.boxActive]}>
      <Text style={dg.digit}>{valor || ''}</Text>
    </View>
  );
}

const dg = StyleSheet.create({
  box:       { width: 46, height: 56, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: '#1677F2', backgroundColor: '#EEF4FF' },
  boxFilled: { borderColor: '#1677F2', backgroundColor: '#EEF4FF' },
  digit:     { fontSize: 22, fontWeight: '700', color: '#111827' },
});

// ════════════════════════════════════════════════════════════════════════════
export default function VerificarCodigoScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  const [codigo,       setCodigo]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [reenviando,   setReenviando]   = useState(false);
  const [timer,        setTimer]        = useState(30);
  const [podeReenviar, setPodeReenviar] = useState(false);

  const inputRef = useRef(null);

  // ── Foca o input ao montar ───────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(t);
  }, []);

  // ── Contador de reenvio ──────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) { setPodeReenviar(true); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  // ── Confirma o OTP e cria a conta Firebase ───────────────────────────────
  const confirmarCodigo = async () => {
    if (codigo.length !== 6) {
      Alert.alert('Código incompleto', 'O código tem 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      // 1. Validar OTP no servidor
      const functions = getFunctions(app, 'europe-west1');
      const confirmarCodigoEmail = httpsCallable(functions, 'confirmarCodigoEmail');
      await confirmarCodigoEmail({ email, codigo });

      // 2. Ler dados do registo pendente
      const pendenteStr = await AsyncStorage.getItem('_registoPendente');
      const pendente = pendenteStr ? JSON.parse(pendenteStr) : null;

      if (!pendente?.email || !pendente?.password) {
        Alert.alert('Erro', 'Dados de registo em falta. Começa de novo.');
        router.replace('/(auth)/register-email');
        return;
      }

      // 3. Sinalizar ao _layout que estamos a concluir o registo.
      //    Isto impede o onAuthStateChanged de interceptar e redirecionar
      //    de volta para este ecrã quando a conta for criada (passo 4).
      await AsyncStorage.setItem('_registoConcluindo', '1');

      // 4. Criar a conta Firebase
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth, pendente.email, pendente.password
      );
      const uid = cred.user.uid;

      // 5. Preparar dados do perfil para o Firestore:
      //    Remover URIs locais (caminhos do dispositivo como file:///...) porque
      //    não são URLs válidas — o upload ao Firebase Storage ainda não foi feito.
      //    Estes ficheiros serão geridos separadamente após o login.
      const dadosPerfil = { ...(pendente.dadosPerfil || {}) };
      CAMPOS_URI_LOCAL.forEach(campo => {
        if (dadosPerfil[campo] && !String(dadosPerfil[campo]).startsWith('http')) {
          delete dadosPerfil[campo];
        }
      });

      // 6. Gravar o perfil completo no Firestore
      await setDoc(doc(db, 'users', uid), {
        ...dadosPerfil,
        email: pendente.email,
        uid,
        tipoPerfil: pendente.tipoPerfil || 'utilizador',
        perfilCompleto: true,
        // otpVerificado:true informa o _layout que este utilizador foi verificado
        // pelo nosso OTP personalizado. O emailVerified do Firebase ficará false
        // (não usamos o link de email do Firebase), mas o _layout usa este campo
        // para não redirecionar o utilizador para verificar-codigo ao fazer login.
        otpVerificado: true,
        emailVerificado: true,
        dataCriacao: serverTimestamp(),
        dataAtualizacao: serverTimestamp(),
      }, { merge: true }); // merge:true evita apagar campos escritos em paralelo (ex: fcmToken do useFcmToken)

      // 7. Limpar dados temporários e navegar para o feed
      await AsyncStorage.multiRemove([
        '_registoPendente',
        '_registoConcluindo',
        `perfil_rascunho_${uid}`,
        `perfil_passo_${uid}`,
      ]);
      router.replace('/(main)/feed');

    } catch (e) {
      // Sempre limpar a flag para não bloquear fluxos futuros
      try { await AsyncStorage.removeItem('_registoConcluindo'); } catch (_) {}

      console.log('[VerificarCodigo]', e?.code, e?.message);

      const msgOtp = {
        'functions/invalid-argument':   e?.message || 'Código incorreto.',
        'functions/not-found':          'Nenhum código pedido para este email. Pede um novo.',
        'functions/deadline-exceeded':  'O código expirou. Pede um novo código.',
        'functions/resource-exhausted': 'Demasiadas tentativas falhadas. Pede um novo código.',
      };

      const msgAuth = {
        'auth/email-already-in-use': 'Este email já tem uma conta. Vai ao login para entrar.',
        'auth/weak-password':        'Palavra-passe muito fraca.',
        'auth/invalid-email':        'Email inválido.',
        'auth/network-request-failed': 'Sem ligação à internet.',
      };

      const msg = msgOtp[e?.code] || msgAuth[e?.code] || e?.message || 'Não foi possível verificar. Tenta novamente.';

      if (e?.code === 'auth/email-already-in-use') {
        Alert.alert('Conta existente', msg, [
          { text: 'Ir para o login', onPress: () => router.replace('/(auth)/login') },
          { text: 'Cancelar', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Erro', msg);
      }

      setCodigo('');
    } finally {
      setLoading(false);
    }
  };

  // ── Reenvio do código ────────────────────────────────────────────────────
  const reenviarCodigo = async () => {
    if (!podeReenviar || reenviando) return;
    setReenviando(true);
    try {
      const functions = getFunctions(app, 'europe-west1');
      const enviarCodigoEmail = httpsCallable(functions, 'enviarCodigoEmail');
      await enviarCodigoEmail({ email });
      setCodigo('');
      setTimer(30);
      setPodeReenviar(false);
      Alert.alert('Enviado', 'Código reenviado com sucesso!');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível reenviar o código.');
    } finally {
      setReenviando(false);
    }
  };

  // ── Força foco no Android ────────────────────────────────────────────────
  const forcarFoco = () => {
    inputRef.current?.blur();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={s.container}>

          {/* Ícone */}
          <View style={s.iconeWrap}>
            <Ionicons name="mail-unread-outline" size={48} color="#1677F2" />
          </View>

          <Text style={s.titulo}>Verifica o teu email</Text>
          <Text style={s.subtitulo}>
            Enviámos um código de 6 dígitos para{'\n'}
            <Text style={s.emailDestaque}>{email}</Text>
          </Text>

          {/* Caixas OTP */}
          <TouchableOpacity
            style={s.otpRow}
            activeOpacity={1}
            onPress={forcarFoco}
          >
            {[0,1,2,3,4,5].map(i => (
              <DigitoBox
                key={i}
                valor={codigo[i]}
                activo={codigo.length === i}
                preenchido={codigo.length > i}
              />
            ))}
          </TouchableOpacity>

          {/* Input invisível fora do ecrã — fix teclado Android */}
          <TextInput
            ref={inputRef}
            style={s.inputOculto}
            value={codigo}
            onChangeText={c => {
              const v = c.replace(/\D/g, '').slice(0, 6);
              setCodigo(v);
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            caretHidden
          />

          <Text style={s.dica}>Toca nas caixas para abrir o teclado</Text>

          {/* Botão confirmar */}
          <TouchableOpacity
            style={[s.btnPrimario, (codigo.length !== 6 || loading) && s.btnDesativado]}
            onPress={confirmarCodigo}
            disabled={codigo.length !== 6 || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnPrimarioTxt}>Confirmar código</Text>
            }
          </TouchableOpacity>

          {/* Reenvio */}
          <View style={s.reenviarWrap}>
            {podeReenviar ? (
              <TouchableOpacity onPress={reenviarCodigo} disabled={reenviando} style={s.reenviarBtn}>
                <Ionicons name="refresh-outline" size={15} color="#1677F2" />
                <Text style={s.reenviarTxt}>
                  {reenviando ? 'A reenviar...' : 'Reenviar código'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.reenviarEspera}>Reenviar em {timer}s</Text>
            )}
          </View>

          {/* Voltar */}
          <TouchableOpacity
            style={s.voltarBtn}
            onPress={() => router.replace('/(auth)/register-email')}
          >
            <Ionicons name="arrow-back" size={16} color="#6B7280" />
            <Text style={s.voltarBtnTxt}>Voltar e corrigir o email</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#F8F8F8' },
  container:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconeWrap:      { width: 92, height: 92, borderRadius: 46, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  titulo:         { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  subtitulo:      { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emailDestaque:  { fontWeight: '700', color: '#111827' },
  otpRow:         { flexDirection: 'row', justifyContent: 'space-between', width: '100%', maxWidth: 340, marginBottom: 12 },
  inputOculto:    { position: 'absolute', top: -999, left: -999, width: 1, height: 1, opacity: 0 },
  dica:           { fontSize: 12, color: '#9CA3AF', marginBottom: 24 },
  btnPrimario:    { width: '100%', maxWidth: 340, backgroundColor: '#1677F2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 18 },
  btnDesativado:  { backgroundColor: '#D1D5DB' },
  btnPrimarioTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  reenviarWrap:   { alignItems: 'center', marginBottom: 20 },
  reenviarEspera: { fontSize: 13, color: '#6B7280' },
  reenviarBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reenviarTxt:    { fontSize: 14, color: '#1677F2', fontWeight: '700' },
  voltarBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  voltarBtnTxt:   { fontSize: 13, color: '#6B7280' },
});