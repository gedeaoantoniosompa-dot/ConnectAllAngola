// app/watch/[id].jsx
//
// Ecrã do espectador: entra no canal como audiência (via AgoraEngine) e vê
// o vídeo real do host. Regista presença no Firestore para alimentar a
// contagem real de ouvintes. Inclui as interações sociais estilo TikTok
// LIVE: comentários em tempo real, pedir para subir ao palco como
// co-apresentador, corações/gostos animados e partilha da live.
//
// NOTA: o vídeo já não importa `react-native-agora` diretamente — usa o
// componente AgoraSurface (que tem versão .native.jsx e .web.jsx), para a
// build web não tentar empacotar o módulo nativo do Agora.
//
// ── ALTERAÇÕES ──
// 1) Já não mostra o número de vezes que se tocou no coração — o toque
//    continua a reagir e a animar (FloatingHearts), só deixou de haver um
//    contador visível ao lado do ícone.
// 2) Quando o anfitrião desliga a câmara (liveInfo.cameraDesligada), passa
//    a mostrar-se a foto de perfil dele em vez de ecrã preto/parado.
// 3) Quando o anfitrião põe o vídeo em pausa (liveInfo.videoPausado),
//    mostra-se o logótipo da ConnectAll em círculo, até ele retomar.
//    Estes dois campos vêm do mesmo documento da live lido por ouvirLive
//    (liveInteracoesService.js), já actualizado pelo broadcast.jsx.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgoraSurface, { VideoSourceType } from '../../../components/live/AgoraSurface';
import FloatingHearts from '../../../components/live/FloatingHearts';
import LiveComments from '../../../components/live/LiveComments';
import LiveShareSheet from '../../../components/live/LiveShareSheet';
import LiveStageStrip from '../../../components/live/LiveStageStrip';
import { pedirPermissoesMedia } from '../../../config/utils/mediaPermissoes';
import { useUser } from '../../../context/UserContext';
import { AgoraEngine } from '../../../services/AgoraEngine';
import {
  atualizarEstadoConvidado,
  cancelarPedido,
  ouvirLive,
  ouvirMeuPedido,
  ouvirPalco,
  pedirParaSubir,
  reagirLive,
  sairDoPalco,
} from '../../../services/liveInteracoesService';
import { entrarComoOuvinte, obterTokenAgora, sairComoOuvinte, uidNumericoDe } from '../../../services/livesService';

// Caminho corrigido: o ficheiro está em src/app/(main)/watch/[id].jsx (uma
// pasta mais profundo que o broadcast.jsx) e o assets/ vive na raiz do
// projecto (fora de src/) — por isso são precisos 4 níveis (../../../../).
const LOGO_CONNECTALL = require('../../../../assets/icon-app.png');

export default function WatchScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const eu = { uid: user?.uid, nome: perfil?.nome, fotoURL: perfil?.fotoURL };

  const {
    id: liveId,
    channelName,
    titulo,
    hostNome,
    hostUidNumerico,
    cor,
  } = useLocalSearchParams();

  const corAtual = cor || '#1677F2';
  const hostNumUid = hostUidNumerico ? Number(hostUidNumerico) : null;
  const hostNumUidLegadoRef = useRef(null); // fallback para lives antigas sem hostUidNumerico

  const [hostConectado, setHostConectado] = useState(false);
  const [erro, setErro] = useState(null);

  // ── Altura do teclado, aplicada manualmente ──
  // Mesma razão do broadcast.jsx: este ecrã tem uma view nativa de vídeo
  // (AgoraSurface) a preencher o ecrã todo por baixo, e o
  // KeyboardAvoidingView não conseguia produzir nenhum efeito visível no
  // telemóvel por causa disso. Ouvir os eventos do teclado directamente e
  // animar o paddingBottom só na zona de comentários/acções (sem nenhuma
  // view nativa dentro) resolve isto de forma fiável.
  const tecladoAltura = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const eventoMostrar = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const eventoEsconder = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subMostrar = Keyboard.addListener(eventoMostrar, (e) => {
      Animated.timing(tecladoAltura, {
        toValue: e.endCoordinates?.height || 0,
        duration: e.duration || 220,
        useNativeDriver: false,
      }).start();
    });

    const subEsconder = Keyboard.addListener(eventoEsconder, (e) => {
      Animated.timing(tecladoAltura, {
        toValue: 0,
        duration: e?.duration || 220,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      subMostrar.remove();
      subEsconder.remove();
    };
  }, []);

  const [liveInfo, setLiveInfo] = useState(null);
  const [palco, setPalco] = useState([]);
  const [meuPedido, setMeuPedido] = useState(null);
  const [souConvidadoAtivo, setSouConvidadoAtivo] = useState(false);
  const souConvidadoRef = useRef(false);

  const [microfoneAtivo, setMicrofoneAtivo] = useState(true);
  const [cameraAtiva, setCameraAtiva] = useState(true);
  const [videoPausadoConvidado, setVideoPausadoConvidado] = useState(false);
  const [shareAberto, setShareAberto] = useState(false);

  useEffect(() => {
    souConvidadoRef.current = souConvidadoAtivo;
  }, [souConvidadoAtivo]);

  // --- Ligação ao canal Agora + presença ------------------------------------
  useEffect(() => {
    // Aguarda os parâmetros da rota estarem realmente disponíveis.
    // No primeiro render (mount "fantasma" usado pela navegação/animação),
    // useLocalSearchParams() pode devolver undefined por uma fração de
    // segundo — sem isto, o channelName undefined quebrava o Agora/token.
    if (!liveId || !channelName) return;

    let cancelado = false;

    async function entrar() {
      if (!AgoraEngine.disponivel()) {
        setErro('Módulo de vídeo não disponível.');
        return;
      }

      try {
        await entrarComoOuvinte(liveId, user?.uid);

        const numUid = uidNumericoDe(user?.uid);
        const token = await obterTokenAgora(channelName, numUid);
        if (cancelado) return;

        AgoraEngine.init();

        AgoraEngine.registarHandlers({
          onUserJoined: (_connection, remoteUid) => {
            const alvo = hostNumUid ?? hostNumUidLegadoRef.current;
            if (alvo == null || remoteUid === alvo) {
              if (hostNumUid == null) hostNumUidLegadoRef.current = remoteUid;
              setHostConectado(true);
            }
          },
          onUserOffline: (_connection, remoteUid) => {
            const alvo = hostNumUid ?? hostNumUidLegadoRef.current;
            if (remoteUid === alvo) setHostConectado(false);
          },
          onError: (code) => setErro(`Erro Agora (${code}).`),
        });

        await AgoraEngine.entrarCanal({
          canal: channelName,
          token,
          uid: numUid,
          role: 'audience',
          utilizador: 'live',
        });
      } catch (e) {
        console.error('Erro ao ligar à transmissão:', e);
        setErro('Não foi possível ligar à transmissão. Tenta novamente.');
      }
    }

    entrar();

    return () => {
      cancelado = true;
      if (souConvidadoRef.current) {
        sairDoPalco(liveId, user?.uid).catch(() => {});
      }
      if (liveId) {
        sairComoOuvinte(liveId, user?.uid);
      }
      AgoraEngine.sairCanal('live');
    };
  }, [liveId, channelName]);

  // --- Dados sociais em tempo real: live, palco, o meu pedido ----------------
  useEffect(() => {
    if (!liveId) return;
    const unsubLive = ouvirLive(liveId, setLiveInfo);
    const unsubPalco = ouvirPalco(liveId, setPalco);
    const unsubPedido = user?.uid ? ouvirMeuPedido(liveId, user.uid, setMeuPedido) : () => {};
    return () => {
      unsubLive();
      unsubPalco();
      unsubPedido();
    };
  }, [liveId, user?.uid]);

  // --- Reage a ser aceite/removido do palco -----------------------------------
  useEffect(() => {
    const agoraSouConvidado = palco.some((p) => p.uid === user?.uid);
    if (agoraSouConvidado === souConvidadoAtivo) return;
    setSouConvidadoAtivo(agoraSouConvidado);

    if (agoraSouConvidado) {
      promoverParaConvidado();
    } else {
      AgoraEngine.voltarAudiencia();
      setVideoPausadoConvidado(false);
    }
  }, [palco, user?.uid]);

  // --- Avisa se o pedido foi recusado -----------------------------------------
  useEffect(() => {
    if (meuPedido?.estado === 'recusado') {
      Alert.alert('Pedido recusado', 'O apresentador não aceitou o teu pedido desta vez.');
      cancelarPedido(liveId, user?.uid);
    }
  }, [meuPedido?.estado]);

  async function promoverParaConvidado() {
    const permitido = await pedirPermissoesMedia();
    if (!permitido) {
      Alert.alert('Permissão necessária', 'Ativa a câmara e o microfone para subires ao palco.');
      return;
    }
    try {
      const numUid = uidNumericoDe(user?.uid);
      const token = await obterTokenAgora(channelName, numUid);
      AgoraEngine.renovarToken(token);
    } catch (e) {
      console.warn('[Watch] Erro ao renovar token para subir ao palco:', e);
    }
    await AgoraEngine.tornarBroadcaster();
    setMicrofoneAtivo(true);
    setCameraAtiva(true);
  }

  async function sair() {
    if (souConvidadoAtivo) {
      await sairDoPalco(liveId, user?.uid).catch(() => {});
    }
    if (liveId) {
      await sairComoOuvinte(liveId, user?.uid);
    }
    AgoraEngine.sairCanal('live');
    router.back();
  }

  function handlePedirSubir() {
    if (souConvidadoAtivo) {
      sairDoPalco(liveId, user?.uid);
    } else if (meuPedido?.estado === 'pendente') {
      cancelarPedido(liveId, user?.uid);
    } else {
      pedirParaSubir(liveId, eu);
    }
  }

  function alternarMicrofone() {
    AgoraEngine.mutarMic(microfoneAtivo);
    const novoEstado = !microfoneAtivo;
    setMicrofoneAtivo(novoEstado);
    if (souConvidadoAtivo && liveId && user?.uid) {
      atualizarEstadoConvidado(liveId, user.uid, { microfoneDesligado: !novoEstado });
    }
  }

  // Mantém consistência com o botão de pausa: se estiver pausado, ligar a
  // câmara aqui também sai da pausa (evita ficar "preso" com a câmara
  // marcada como ligada mas o overlay de pausa ainda por cima). O estado
  // é gravado em lives/{liveId}/palco/{uid} — é isto que faz TODOS os
  // espectadores verem a minha foto quando desligo a câmara, não só eu.
  function alternarCamera() {
    const vaiFicarAtiva = !cameraAtiva;
    if (vaiFicarAtiva) {
      AgoraEngine.enableVideo();
      AgoraEngine.startPreview();
      setVideoPausadoConvidado(false);
    } else {
      AgoraEngine.disableVideo();
    }
    setCameraAtiva(vaiFicarAtiva);
    if (souConvidadoAtivo && liveId && user?.uid) {
      atualizarEstadoConvidado(liveId, user.uid, {
        cameraDesligada: !vaiFicarAtiva,
        videoPausado: false,
      });
    }
  }

  // Pausar vídeo enquanto convidado no palco — igual ao anfitrião: mostra
  // o logótipo da ConnectAll no meu preview (visível para todos, via
  // LiveStageStrip) até eu retomar. Se a câmara já estava desligada antes
  // de pausar, ao despausar não a liga.
  function alternarPausaConvidado() {
    const vaiPausar = !videoPausadoConvidado;
    if (vaiPausar) {
      AgoraEngine.disableVideo();
    } else if (cameraAtiva) {
      AgoraEngine.enableVideo();
      AgoraEngine.startPreview();
    }
    setVideoPausadoConvidado(vaiPausar);
    if (liveId && user?.uid) {
      atualizarEstadoConvidado(liveId, user.uid, { videoPausado: vaiPausar });
    }
  }

  function handleReagir() {
    reagirLive(liveId);
  }

  const pedirLabel = souConvidadoAtivo
    ? 'Descer'
    : meuPedido?.estado === 'pendente'
      ? 'Cancelar'
      : 'Subir';
  const pedirIcone = souConvidadoAtivo
    ? 'exit-outline'
    : meuPedido?.estado === 'pendente'
      ? 'time-outline'
      : 'hand-left-outline';

  const convidadosNoPalco = palco.filter((p) => p.uid !== user?.uid);
  const mainVideoUid = hostNumUid ?? hostNumUidLegadoRef.current;

  const videoPausado = !!liveInfo?.videoPausado;
  const cameraDesligada = !videoPausado && !!liveInfo?.cameraDesligada;

  return (
    <View style={styles.container}>
      {hostConectado && mainVideoUid != null ? (
        <>
          <AgoraSurface
            style={StyleSheet.absoluteFill}
            uid={mainVideoUid}
            sourceType={VideoSourceType.VideoSourceRemote}
          />

          {videoPausado && (
            <View style={styles.overlayCentro}>
              <View style={styles.logoCirculo}>
                <Image source={LOGO_CONNECTALL} style={styles.logoImg} resizeMode="contain" />
              </View>
              <Text style={styles.overlayTexto}>Vídeo em pausa</Text>
            </View>
          )}

          {cameraDesligada && (
            <View style={styles.overlayCentro}>
              {liveInfo?.hostFotoURL ? (
                <Image source={{ uri: liveInfo.hostFotoURL }} style={styles.avatarCirculo} />
              ) : (
                <View style={[styles.avatarCirculo, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackTxt}>{(hostNome || 'U')[0]}</Text>
                </View>
              )}
              <Text style={styles.overlayTexto}>Câmara desligada</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.aguardando}>
          <Text style={styles.aguardandoText}>{erro || 'A ligar à transmissão…'}</Text>
        </View>
      )}

      <LiveStageStrip convidados={convidadosNoPalco} souHost={false} />

      <FloatingHearts contagem={liveInfo?.gostosCount} corDestaque="#EC4C89" />

      {/* O meu próprio vídeo, quando estou no palco como convidado. A
          AgoraSurface fica sempre montada — só o overlay por cima muda —
          exactamente pela mesma razão do anfitrião: remontar a view nativa
          ao ligar/desligar causava vídeo a não voltar correctamente. */}
      {souConvidadoAtivo && (
        <View style={styles.meuPalcoWrap}>
          <AgoraSurface
            style={styles.meuPalcoVideo}
            uid={0}
            sourceType={VideoSourceType.VideoSourceCamera}
          />

          {videoPausadoConvidado && (
            <View style={styles.meuPalcoOverlay}>
              <Image source={LOGO_CONNECTALL} style={styles.meuPalcoLogoImg} resizeMode="contain" />
            </View>
          )}

          {!videoPausadoConvidado && !cameraAtiva && (
            <View style={styles.meuPalcoOverlay}>
              {perfil?.fotoURL ? (
                <Image source={{ uri: perfil.fotoURL }} style={styles.meuPalcoAvatarImg} />
              ) : (
                <View style={[styles.meuPalcoAvatarImg, styles.meuPalcoAvatarFallback]}>
                  <Text style={styles.meuPalcoAvatarFallbackTxt}>{(perfil?.nome || 'U')[0]}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.meuPalcoControles}>
            <TouchableOpacity style={styles.miniBtn} onPress={alternarMicrofone}>
              <Ionicons name={microfoneAtivo ? 'mic' : 'mic-off'} size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={alternarCamera}>
              <Ionicons name={cameraAtiva ? 'videocam' : 'videocam-off'} size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.miniBtn, videoPausadoConvidado && styles.miniBtnActivo]}
              onPress={alternarPausaConvidado}
            >
              <Ionicons name={videoPausadoConvidado ? 'play' : 'pause'} size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* IMPORTANTE: o topBar fica FORA do KeyboardAvoidingView (tal como
          o cabeçalho em conversa.jsx) — só o que está por baixo dele
          (comentários + acções laterais) precisa de subir com o teclado.
          behavior "height" no Android (com keyboardVerticalOffset) é a
          mesma regra já comprovada em conversa.jsx; "undefined" tinha
          deixado o teclado sem qualquer efeito no Android. */}
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.voltarBtn} onPress={sair}>
            <Ionicons name="chevron-down" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.infoWrap}>
            <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
            <Text style={styles.host}>{hostNome}</Text>
          </View>
        </View>

        <Animated.View style={{ flex: 1, paddingBottom: tecladoAltura }}>
          <View style={styles.espacador} />

          <View style={styles.bottomArea}>
            <View style={{ flex: 1 }}>
              <LiveComments liveId={liveId} user={eu} corDestaque={corAtual} />
            </View>

            <View style={styles.acoesLaterais}>
              {/* Reage e anima (FloatingHearts) — já não mostra um número de
                  toques ao lado do coração. */}
              <TouchableOpacity style={styles.acaoBtn} onPress={handleReagir}>
                <Ionicons name="heart" size={26} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.acaoBtn} onPress={() => setShareAberto(true)}>
                <Ionicons name="arrow-redo" size={24} color="#fff" />
                <Text style={styles.acaoLabel}>Partilhar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.acaoBtn} onPress={handlePedirSubir}>
                <Ionicons name={pedirIcone} size={24} color="#fff" />
                <Text style={styles.acaoLabel}>{pedirLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>

      <LiveShareSheet
        visible={shareAberto}
        onClose={() => setShareAberto(false)}
        live={{ id: liveId, titulo, channelName, hostNome, cor: corAtual }}
        user={eu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  aguardando: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  aguardandoText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  voltarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoWrap: { flex: 1 },
  titulo: { color: '#fff', fontSize: 15, fontWeight: '700' },
  host: { color: '#fff', fontSize: 12, opacity: 0.8 },
  espacador: { flex: 1 },
  bottomArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  acoesLaterais: { alignItems: 'center', gap: 18, paddingBottom: 6 },
  acaoBtn: { alignItems: 'center', gap: 3 },
  acaoLabel: { color: '#fff', fontSize: 10, fontWeight: '600' },
  meuPalcoWrap: {
    position: 'absolute',
    bottom: 190,
    right: 16,
    width: 84,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1F1F1F',
    borderWidth: 2,
    borderColor: '#0A66C2',
  },
  meuPalcoVideo: { ...StyleSheet.absoluteFillObject },
  meuPalcoControles: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  miniBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnActivo: {
    backgroundColor: 'rgba(10,102,194,0.9)',
  },

  // ── Overlay dentro do preview do convidado (câmara desligada / pausa) ──
  // Cobre por completo a AgoraSurface, que fica sempre montada por baixo.
  meuPalcoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meuPalcoLogoImg: { width: 40, height: 40 },
  meuPalcoAvatarImg: { width: 46, height: 46, borderRadius: 23 },
  meuPalcoAvatarFallback: {
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meuPalcoAvatarFallbackTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },

  // ── Sobreposições: vídeo em pausa / câmara desligada (vídeo principal) ──
  overlayCentro: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoCirculo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  logoImg: { width: '100%', height: '100%' },
  avatarCirculo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarFallback: {
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackTxt: { color: '#fff', fontSize: 42, fontWeight: '800' },
  overlayTexto: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
});