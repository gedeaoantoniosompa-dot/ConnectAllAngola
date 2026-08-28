// app/broadcast.jsx
//
// Ecrã do host: cria a live no Firestore e transmite vídeo/áudio reais
// através do AgoraEngine singleton já partilhado com a Feira do Saber e
// as Entrevistas. Inclui as interações sociais estilo TikTok LIVE:
// comentários em tempo real, gestão de pedidos para subir ao palco, palco
// de co-apresentadores e contagem de gostos.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingHearts from '../../components/live/FloatingHearts';
import LiveComments from '../../components/live/LiveComments';
import LiveRequestsSheet from '../../components/live/LiveRequestsSheet';
import LiveStageStrip from '../../components/live/LiveStageStrip';
import { pedirPermissoesMedia } from '../../config/utils/mediaPermissoes';
import { useUser } from '../../context/UserContext';
import { AgoraEngine } from '../../services/AgoraEngine';
import {
    definirHostUidNumerico,
    ouvirLive,
    ouvirPalco,
    ouvirPedidosPendentes,
    removerDoPalco,
    responderPedido,
} from '../../services/liveInteracoesService';
import { criarLive, obterTokenAgora, terminarLive, uidNumericoDe } from '../../services/livesService';

export default function BroadcastScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const { titulo, area, cor } = useLocalSearchParams();

  const liveIdRef = useRef(null);

  const [pronto, setPronto] = useState(false);
  const [microfoneAtivo, setMicrofoneAtivo] = useState(true);
  const [cameraAtiva, setCameraAtiva] = useState(true);
  const [erro, setErro] = useState(null);

  const [liveInfo, setLiveInfo] = useState(null);
  const [palco, setPalco] = useState([]);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [pedidosAberto, setPedidosAberto] = useState(false);

  useEffect(() => {
    // Aguarda os parâmetros da rota estarem realmente disponíveis.
    // No primeiro render (mount "fantasma" usado pela navegação/animação),
    // useLocalSearchParams() pode devolver undefined por uma fração de
    // segundo — sem isto, criarLive() era chamado com titulo undefined.
    if (!titulo || !area) return;

    let cancelado = false;

    async function iniciar() {
      if (!AgoraEngine.disponivel()) {
        setErro('Módulo de vídeo não disponível.');
        return;
      }

      const permitido = await pedirPermissoesMedia();
      if (cancelado) return;
      if (!permitido) {
        setErro('É necessário permitir o acesso à câmara e ao microfone para transmitires.');
        return;
      }

      try {
        const live = await criarLive({
          user: { uid: user?.uid, nome: perfil?.nome, cargo: perfil?.cargo },
          titulo,
          area,
          cor: cor || '#1677F2',
        });
        liveIdRef.current = live.id;

        const numUid = uidNumericoDe(user?.uid);
        const token = await obterTokenAgora(live.channelName, numUid);
        if (cancelado) return;

        AgoraEngine.init();
        AgoraEngine.enableAudio();
        AgoraEngine.enableVideo();

        AgoraEngine.registarHandlers({
          onError: (code) => setErro(`Erro Agora (${code}).`),
        });

        const ok = await AgoraEngine.entrarCanal({
          canal: live.channelName,
          token,
          uid: numUid,
          role: 'broadcaster',
          utilizador: 'live',
        });

        if (!ok) {
          setErro('Não foi possível iniciar a transmissão.');
          return;
        }

        AgoraEngine.startPreview();
        setPronto(true);

        // Regista qual é o uid numérico do host, para os espectadores
        // saberem qual vídeo remoto mostrar como principal.
        definirHostUidNumerico(live.id, numUid);
      } catch (e) {
        console.error('Erro ao iniciar transmissão:', e);
        setErro('Não foi possível iniciar a transmissão. Tenta novamente.');
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      if (liveIdRef.current) terminarLive(liveIdRef.current).catch(() => {});
      AgoraEngine.sairCanal('live');
    };
  }, [titulo, area, cor]);

  // --- Dados sociais em tempo real: live, palco, pedidos pendentes -----------
  useEffect(() => {
    if (!pronto || !liveIdRef.current) return;
    const liveId = liveIdRef.current;
    const unsubLive = ouvirLive(liveId, setLiveInfo);
    const unsubPalco = ouvirPalco(liveId, setPalco);
    const unsubPedidos = ouvirPedidosPendentes(liveId, setPedidosPendentes);
    return () => {
      unsubLive();
      unsubPalco();
      unsubPedidos();
    };
  }, [pronto]);

  async function terminar() {
    if (liveIdRef.current) await terminarLive(liveIdRef.current).catch(() => {});
    AgoraEngine.sairCanal('live');
    router.back();
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

  function responderAoPedido(pedido, aceite) {
    responderPedido(liveIdRef.current, pedido, aceite);
  }

  function removerConvidado(convidado) {
    removerDoPalco(liveIdRef.current, convidado.uid);
  }

  if (erro) {
    return (
      <SafeAreaView style={styles.safeErro}>
        <Text style={styles.erroText}>{erro}</Text>
        <TouchableOpacity style={styles.erroBtn} onPress={() => router.back()}>
          <Text style={styles.erroBtnText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {pronto && (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
        />
      )}

      <LiveStageStrip convidados={palco} souHost onRemover={removerConvidado} />

      <FloatingHearts contagem={liveInfo?.gostosCount} corDestaque="#EC4C89" />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.liveAoVivoBadge}>
            <View style={styles.liveDotWhite} />
            <Text style={styles.liveAoVivoText}>AO VIVO</Text>
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.pedidosBtn} onPress={() => setPedidosAberto(true)}>
            <Ionicons name="hand-left" size={16} color="#fff" />
            <Text style={styles.pedidosBtnText}>Pedidos</Text>
            {pedidosPendentes.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pedidosPendentes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.meioArea}>
          <View style={{ flex: 1 }}>
            {pronto && liveIdRef.current && (
              <LiveComments
                liveId={liveIdRef.current}
                user={{ uid: user?.uid, nome: perfil?.nome }}
                corDestaque={cor || '#1677F2'}
              />
            )}
          </View>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.controlBtn} onPress={alternarMicrofone}>
            <Ionicons name={microfoneAtivo ? 'mic' : 'mic-off'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={alternarCamera}>
            <Ionicons name={cameraAtiva ? 'videocam' : 'videocam-off'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => AgoraEngine.switchCamera()}>
            <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.terminarBtn} onPress={terminar}>
            <Text style={styles.terminarBtnText}>Terminar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <LiveRequestsSheet
        visible={pedidosAberto}
        onClose={() => setPedidosAberto(false)}
        pedidos={pedidosPendentes}
        onResponder={responderAoPedido}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeErro: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  erroText: { color: '#fff', fontSize: 15, textAlign: 'center' },
  erroBtn: { backgroundColor: '#EC4C89', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  erroBtnText: { color: '#fff', fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  liveAoVivoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDotWhite: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EC4C89' },
  liveAoVivoText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  pedidosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pedidosBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EC4C89',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  meioArea: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 30,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminarBtn: { backgroundColor: '#EC4C89', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 },
  terminarBtnText: { color: '#fff', fontWeight: '800' },
});