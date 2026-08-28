/**
 * chamada-recebida.jsx — ConnectAll Angola
 * Tela de chamada recebida (voz + vídeo) com Agora RTC
 * Fix: joinChannel usa null no token + numUid consistente com emissor
 */

import { Ionicons } from '@expo/vector-icons';
import { AudioModule } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  RtcSurfaceView,
  VideoSourceType,
} from 'react-native-agora';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const AGORA_APP_ID = '4e413d4d82d14eeeb5f36a3853c846a3';
const { width: W, height: H } = Dimensions.get('window');
const VERDE = '#25D366';

function formatarTempo(seg) {
  const m = Math.floor(seg / 60).toString().padStart(2, '0');
  const s = (seg % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatarNome(nome) {
  return nome?.trim() || 'Utilizador';
}

export default function ChamadaRecebidaScreen() {
  const router = useRouter();
  const { chatId, deUid, tipo, channel, deNome, deFoto } = useLocalSearchParams();
  const { user } = useUser();

  const [estadoChamada, setEstadoChamada] = useState('a_receber');
  const [tempoChamada,  setTempoChamada]  = useState(0);
  const [micAtivo,      setMicAtivo]      = useState(true);
  const [cameraAtiva,   setCameraAtiva]   = useState(tipo === 'video');
  const [altifalante,   setAltifalante]   = useState(false);
  const [remoteUid,     setRemoteUid]     = useState(null);
  const [perfilDe,      setPerfilDe]      = useState(null);
  const [modalAudio,    setModalAudio]    = useState(false);

  const engineRef       = useRef(null);
  const timerRef        = useRef(null);
  const timerRecusaRef  = useRef(null);

  const nomeResolvido = perfilDe?.nome    || deNome || 'Utilizador';
  const fotoResolvida = perfilDe?.fotoURL || (deFoto && deFoto !== 'null' ? deFoto : null);

  // ── numUid consistente com o emissor ──────────────────────────────────
  const numUid = user?.uid
    ? Math.abs(user.uid.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000
    : 0;

  // ── Carrega perfil de quem ligou ──────────────────────────────────────
  useEffect(() => {
    if (!deUid) return;
    getDoc(doc(db, 'users', deUid)).then(snap => {
      if (snap.exists()) setPerfilDe(snap.data());
    });
  }, [deUid]);

  // ── Ouve estado da chamada (cancelada pelo emissor) ───────────────────
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, 'chamadas', chatId), snap => {
      if (!snap.exists()) return;
      const est = snap.data().estado;
      if (est === 'terminada' || est === 'cancelada' || est === 'nao_atendida') {
        terminarInterno();
      }
    });
    return unsub;
  }, [chatId]);

  // ── Timer: se não atender em 40s, recusa automaticamente ─────────────
  useEffect(() => {
    timerRecusaRef.current = setTimeout(() => {
      if (estadoChamada === 'a_receber') recusar();
    }, 40000);
    return () => clearTimeout(timerRecusaRef.current);
  }, []);

  // ── Inicializa Agora ──────────────────────────────────────────────────
  const iniciarAgora = async () => {
    try {
      const micStatus = await AudioModule.requestRecordingPermissionsAsync();
      if (!micStatus.granted) {
        Alert.alert('Permissão necessária', 'Precisamos do microfone.');
        return false;
      }
      if (tipo === 'video') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'Precisamos da câmara.');
          return false;
        }
      }

      const engine = createAgoraRtcEngine();
      engine.initialize({ appId: AGORA_APP_ID });
      engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);

      engine.registerEventHandler({
        onUserJoined: (_conn, uid) => {
          setRemoteUid(uid);
        },
        onUserOffline: () => {
          terminarInterno();
        },
        onLeaveChannel: () => {
          clearInterval(timerRef.current);
        },
        onError: (code, msg) => console.warn('[Agora recebida]', code, msg),
      });

      engine.enableAudio();
      if (tipo === 'video') {
        engine.enableVideo();
        engine.startPreview();
      }

      engineRef.current = engine;
      return true;
    } catch (e) {
      console.error('[Agora recebida init]', e);
      return false;
    }
  };

  // ── Atender chamada ───────────────────────────────────────────────────
  const atender = async () => {
    clearTimeout(timerRecusaRef.current);
    const ok = await iniciarAgora();
    if (!ok) return;

    setEstadoChamada('em_curso');

    const canalFinal = channel || chatId;

    try {
      engineRef.current?.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      // ← null no token (igual ao emissor) + numUid consistente
      await engineRef.current?.joinChannel(null, canalFinal, numUid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: tipo === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: tipo === 'video',
      });
    } catch (e) {
      console.log('[joinChannel recebida]', e);
    }

    // Actualiza Firestore para 'em_curso' — emissor recebe via listener
    await updateDoc(doc(db, 'chamadas', chatId), { estado: 'em_curso' }).catch(() => {});

    // Inicia contador (sincronizado pelo Agora onUserJoined no emissor)
    setTempoChamada(0);
    timerRef.current = setInterval(() => setTempoChamada(t => t + 1), 1000);
  };

  // ── Recusar chamada ───────────────────────────────────────────────────
  const recusar = async () => {
    clearTimeout(timerRecusaRef.current);
    await updateDoc(doc(db, 'chamadas', chatId), { estado: 'nao_atendida' }).catch(() => {});
    terminarInterno();
  };

  // ── Terminar chamada ──────────────────────────────────────────────────
  const terminarInterno = async () => {
    clearInterval(timerRef.current);
    clearTimeout(timerRecusaRef.current);
    try {
      engineRef.current?.leaveChannel();
      engineRef.current?.release();
      engineRef.current = null;
    } catch (_) {}
    await updateDoc(doc(db, 'chamadas', chatId), { estado: 'terminada' }).catch(() => {});
    router.back();
  };

  const toggleMic = () => {
    setMicAtivo(v => {
      engineRef.current?.muteLocalAudioStream(v);
      return !v;
    });
  };

  const toggleCamera = () => {
    setCameraAtiva(v => {
      engineRef.current?.muteLocalVideoStream(v);
      return !v;
    });
  };

  const toggleAltifalante = () => {
    setAltifalante(v => {
      engineRef.current?.setEnableSpeakerphone(!v);
      return !v;
    });
  };

  // ── Cleanup ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(timerRecusaRef.current);
      try { engineRef.current?.release(); } catch (_) {}
    };
  }, []);

  /* ════════════════════════════════════════════════════════
     RENDER — VOZ (a_receber ou em_curso)
  ════════════════════════════════════════════════════════ */
  if (tipo !== 'video' || estadoChamada === 'a_receber') {
    return (
      <View style={cs.safe}>
        {/* Fundo com foto em blur */}
        <View style={cs.fundo}>
          {fotoResolvida
            ? <Image source={{ uri: fotoResolvida }} style={cs.fundoImg} blurRadius={22} />
            : <View style={[cs.fundoImg, { backgroundColor: '#1a1a2e' }]} />}
          <View style={cs.fundoOverlay} />
        </View>

        {/* Header */}
        <SafeAreaView style={cs.headerRow}>
          <TouchableOpacity style={cs.headerBtn}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          {estadoChamada === 'em_curso' && (
            <TouchableOpacity style={cs.headerBtn} onPress={() => setModalAudio(true)}>
              <Ionicons name="volume-high-outline" size={26} color="#fff" />
            </TouchableOpacity>
          )}
        </SafeAreaView>

        {/* Corpo central */}
        <View style={cs.corpo}>
          {estadoChamada === 'a_receber' && (
            <Text style={cs.subtitulo}>
              {tipo === 'video' ? 'Chamada de vídeo' : 'Chamada de áudio'}
            </Text>
          )}
          {estadoChamada === 'em_curso' && (
            <Text style={cs.subtitulo}>Chamada em curso</Text>
          )}
          <Text style={cs.nome}>{formatarNome(nomeResolvido)}</Text>
          <Text style={cs.estado}>
            {estadoChamada === 'a_receber'
              ? 'A ligar...'
              : estadoChamada === 'em_curso'
              ? formatarTempo(tempoChamada)
              : 'Não atendida'}
          </Text>
          <View style={cs.avatarWrap}>
            {fotoResolvida
              ? <Image source={{ uri: fotoResolvida }} style={cs.avatar} />
              : <View style={[cs.avatar, { backgroundColor: VERDE, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 60, fontWeight: '800' }}>
                    {nomeResolvido[0]?.toUpperCase()}
                  </Text>
                </View>}
          </View>
        </View>

        {/* Botões */}
        {estadoChamada === 'a_receber' ? (
          <SafeAreaView style={cs.botoesAtender}>
            <View style={cs.botaoItem}>
              <TouchableOpacity style={cs.btnRecusar} onPress={recusar}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={cs.btnLabel}>Recusar</Text>
            </View>
            <View style={cs.botaoItem}>
              <TouchableOpacity style={cs.btnAtender} onPress={atender}>
                <Ionicons name="call" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={cs.btnLabel}>Atender</Text>
            </View>
          </SafeAreaView>
        ) : (
          <SafeAreaView style={cs.botoesEmCurso}>
            <TouchableOpacity style={cs.btnSec} onPress={toggleMic}>
              <Ionicons name={micAtivo ? 'mic-outline' : 'mic-off-outline'} size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={cs.btnTerminar} onPress={terminarInterno}>
              <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <TouchableOpacity style={cs.btnSec} onPress={toggleAltifalante}>
              <Ionicons name={altifalante ? 'volume-high' : 'volume-medium-outline'} size={26} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        )}

        {/* Modal áudio */}
        <Modal visible={modalAudio} transparent animationType="slide" onRequestClose={() => setModalAudio(false)}>
          <TouchableWithoutFeedback onPress={() => setModalAudio(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }} />
          </TouchableWithoutFeedback>
          <View style={cs.audioModal}>
            {[
              { icon: 'volume-high-outline', label: 'Altifalante',   onPress: () => { toggleAltifalante(); setModalAudio(false); } },
              { icon: 'call-outline',        label: 'Telefone',      onPress: () => setModalAudio(false), check: !altifalante },
              { icon: 'volume-mute-outline', label: 'Desativar som', onPress: () => { toggleMic(); setModalAudio(false); } },
              { icon: 'close',               label: 'Cancelar',      onPress: () => setModalAudio(false) },
            ].map((opt, i) => (
              <TouchableOpacity key={i} style={cs.audioModalItem} onPress={opt.onPress}>
                <Ionicons name={opt.icon} size={22} color="#111" />
                <Text style={cs.audioModalLabel}>{opt.label}</Text>
                {opt.check && <Ionicons name="checkmark" size={20} color="#007AFF" style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      </View>
    );
  }

  /* ════════════════════════════════════════════════════════
     RENDER — VIDEOCHAMADA EM CURSO
  ════════════════════════════════════════════════════════ */
  return (
    <View style={cs.safe}>
      {remoteUid ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: remoteUid, sourceType: VideoSourceType.VideoSourceRemote }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center' }]}>
          {fotoResolvida
            ? <Image source={{ uri: fotoResolvida }} style={StyleSheet.absoluteFill} blurRadius={25} />
            : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
          <View style={{ alignItems: 'center', gap: 16 }}>
            {fotoResolvida
              ? <Image source={{ uri: fotoResolvida }} style={cs.videoPoster} />
              : <View style={[cs.videoPoster, { backgroundColor: VERDE, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 48, fontWeight: '800' }}>{nomeResolvido[0]?.toUpperCase()}</Text>
                </View>}
            <Text style={cs.videoNome}>{formatarNome(nomeResolvido)}</Text>
            <Text style={cs.videoEstado}>
              {estadoChamada === 'a_receber' ? 'A ligar...' : 'Conectando...'}
            </Text>
          </View>
        </View>
      )}

      {estadoChamada === 'em_curso' && cameraAtiva && (
        <View style={cs.videoLocalWrap}>
          <RtcSurfaceView
            style={cs.videoLocal}
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
          />
        </View>
      )}

      <SafeAreaView style={cs.videoHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {fotoResolvida && <Image source={{ uri: fotoResolvida }} style={{ width: 36, height: 36, borderRadius: 18 }} />}
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{formatarNome(nomeResolvido)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              {estadoChamada === 'em_curso' ? formatarTempo(tempoChamada) : 'A ligar...'}
            </Text>
          </View>
        </View>
        <Ionicons name="volume-high-outline" size={24} color="#fff" />
      </SafeAreaView>

      {estadoChamada === 'a_receber' ? (
        <SafeAreaView style={cs.botoesAtender}>
          <View style={cs.botaoItem}>
            <TouchableOpacity style={cs.btnRecusar} onPress={recusar}>
              <Ionicons name="videocam-off" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={cs.btnLabel}>Recusar</Text>
          </View>
          <View style={cs.botaoItem}>
            <TouchableOpacity style={cs.btnAtender} onPress={atender}>
              <Ionicons name="videocam" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={cs.btnLabel}>Atender</Text>
          </View>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={cs.videoBotoes}>
          <TouchableOpacity style={cs.btnSec} onPress={toggleCamera}>
            <Ionicons name={cameraAtiva ? 'videocam-outline' : 'videocam-off-outline'} size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={cs.btnSec} onPress={toggleMic}>
            <Ionicons name={micAtivo ? 'mic-outline' : 'mic-off-outline'} size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={cs.btnTerminar} onPress={terminarInterno}>
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#000' },
  fundo:          { ...StyleSheet.absoluteFillObject },
  fundoImg:       { width: '100%', height: '100%', position: 'absolute' },
  fundoOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  headerBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  corpo:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  subtitulo:      { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '400' },
  nome:           { fontSize: 42, fontWeight: '300', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  estado:         { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  avatarWrap:     { marginTop: 20 },
  avatar:         { width: 140, height: 140, borderRadius: 70 },
  botoesAtender:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 60, paddingBottom: 48 },
  botaoItem:      { alignItems: 'center', gap: 10 },
  btnRecusar:     { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  btnAtender:     { width: 70, height: 70, borderRadius: 35, backgroundColor: VERDE, alignItems: 'center', justifyContent: 'center' },
  btnLabel:       { fontSize: 13, color: '#fff', fontWeight: '500' },
  botoesEmCurso:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 48 },
  btnSec:         { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  btnTerminar:    { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  audioModal:     { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 10 },
  audioModalItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  audioModalLabel:{ fontSize: 16, color: '#111' },
  videoPoster:    { width: 120, height: 120, borderRadius: 60 },
  videoNome:      { fontSize: 28, fontWeight: '300', color: '#fff', textAlign: 'center' },
  videoEstado:    { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  videoLocalWrap: { position: 'absolute', top: 100, right: 16, width: 100, height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', zIndex: 10 },
  videoLocal:     { width: '100%', height: '100%' },
  videoHeader:    { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 5 },
  videoBotoes:    { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 48, backgroundColor: 'rgba(0,0,0,0.4)' },
});