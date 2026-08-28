// app/watch/[id].jsx
//
// Ecrã do espectador: entra no canal como audiência (via AgoraEngine) e vê
// o vídeo real do host. Regista presença no Firestore para alimentar a
// contagem real de ouvintes. Inclui as interações sociais estilo TikTok
// LIVE: comentários em tempo real, pedir para subir ao palco como
// co-apresentador, corações/gostos animados e partilha da live.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingHearts from '../../../components/live/FloatingHearts';
import LiveComments from '../../../components/live/LiveComments';
import LiveShareSheet from '../../../components/live/LiveShareSheet';
import LiveStageStrip from '../../../components/live/LiveStageStrip';
import { pedirPermissoesMedia } from '../../../config/utils/mediaPermissoes';
import { useUser } from '../../../context/UserContext';
import { AgoraEngine } from '../../../services/AgoraEngine';
import {
    cancelarPedido,
    ouvirLive,
    ouvirMeuPedido,
    ouvirPalco,
    pedirParaSubir,
    reagirLive,
    sairDoPalco,
} from '../../../services/liveInteracoesService';
import { entrarComoOuvinte, obterTokenAgora, sairComoOuvinte, uidNumericoDe } from '../../../services/livesService';
export default function WatchScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const eu = { uid: user?.uid, nome: perfil?.nome };

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

  const [liveInfo, setLiveInfo] = useState(null);
  const [palco, setPalco] = useState([]);
  const [meuPedido, setMeuPedido] = useState(null);
  const [souConvidadoAtivo, setSouConvidadoAtivo] = useState(false);
  const souConvidadoRef = useRef(false);

  const [microfoneAtivo, setMicrofoneAtivo] = useState(true);
  const [cameraAtiva, setCameraAtiva] = useState(true);
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
    AgoraEngine.tornarBroadcaster();
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
    setMicrofoneAtivo((v) => !v);
  }

  function alternarCamera() {
    if (cameraAtiva) {
      AgoraEngine.disableVideo();
    } else {
      AgoraEngine.enableVideo();
      AgoraEngine.startPreview();
    }
    setCameraAtiva((v) => !v);
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

  return (
    <View style={styles.container}>
      {hostConectado && mainVideoUid != null ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: mainVideoUid, sourceType: VideoSourceType.VideoSourceRemote }}
        />
      ) : (
        <View style={styles.aguardando}>
          <Text style={styles.aguardandoText}>{erro || 'A ligar à transmissão…'}</Text>
        </View>
      )}

      <LiveStageStrip convidados={convidadosNoPalco} souHost={false} />

      <FloatingHearts contagem={liveInfo?.gostosCount} corDestaque="#EC4C89" />

      {/* O meu próprio vídeo, quando estou no palco como convidado */}
      {souConvidadoAtivo && (
        <View style={styles.meuPalcoWrap}>
          <RtcSurfaceView
            style={styles.meuPalcoVideo}
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
          />
          <View style={styles.meuPalcoControles}>
            <TouchableOpacity style={styles.miniBtn} onPress={alternarMicrofone}>
              <Ionicons name={microfoneAtivo ? 'mic' : 'mic-off'} size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={alternarCamera}>
              <Ionicons name={cameraAtiva ? 'videocam' : 'videocam-off'} size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

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

        <View style={styles.espacador} />

        <View style={styles.bottomArea}>
          <View style={{ flex: 1 }}>
            <LiveComments liveId={liveId} user={eu} corDestaque={corAtual} />
          </View>

          <View style={styles.acoesLaterais}>
            <TouchableOpacity style={styles.acaoBtn} onPress={handleReagir}>
              <Ionicons name="heart" size={26} color="#fff" />
              <Text style={styles.acaoCount}>{liveInfo?.gostosCount || 0}</Text>
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
  acaoCount: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
    borderColor: '#EC4C89',
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
});