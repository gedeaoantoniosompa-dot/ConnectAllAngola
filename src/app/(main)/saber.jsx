/**
 * saber.jsx — Feira do Saber v6
 * Adicionado: Sala Privada com código de convite
 * v6: corrigido bug do repost (campo 'criadoEm' → 'timestamp' e mapeamento
 * completo dos campos exigidos pelo feed.jsx); publicações e comentários dos
 * Clubes passam a suportar imagem anexada e nota de voz (áudio gravado com
 * expo-audio); notas de voz nunca podem ser repostadas no feed principal —
 * apenas publicações em texto (com ou sem imagem) são elegíveis a repost.
 */

import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BoasVindasSala from '../../components/BoasVindasSala';
import { app, db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { AgoraEngine } from '../../services/AgoraEngine';

const BEGE = '#F5F0EB';
const storage = getStorage(app);

// NOTA: o repost usa a coleção de topo "posts" como feed principal da app.
// Se o feed principal tiver outro nome de coleção, ajusta aqui.
const COLECAO_FEED = 'posts';

const AREAS = [
  { id: 'todas',        label: '🌍 Todas' },
  { id: 'tecnologia',   label: '💻 Tecnologia' },
  { id: 'engenharia',   label: '🛠️ Engenharia' },
  { id: 'saude',        label: '🩺 Saúde' },
  { id: 'negocios',     label: '💼 Negócios' },
  { id: 'financas',     label: '💰 Finanças' },
  { id: 'direito',      label: '⚖️ Direito' },
  { id: 'educacao',     label: '🎓 Educação' },
  { id: 'inovacao',     label: '💡 Inovação' },
  { id: 'empreendedorismo', label: '🚀 Empreendedorismo' },
  { id: 'marketing',    label: '📣 Marketing' },
  { id: 'agricultura',  label: '🌾 Agricultura' },
  { id: 'petroleogas',  label: '🛢️ Petróleo e Gás' },
  { id: 'entretenimento', label: '🎬 Entretenimento' },
  { id: 'artecultura',  label: '🎭 Arte & Cultura' },
  { id: 'connectall',   label: '🇦🇴 ConnectAll' },
  { id: 'design',       label: '🎨 Design' },
  { id: 'carreira',     label: '📚 Carreira' },
];

// ── Bandeira/cor de cada Clube (substitui as fotos fixas do Unsplash) ─────────
const COR_AREA = {
  tecnologia:        ['#1677F2', '#0B4FA8'],
  engenharia:        ['#F97316', '#9A3412'],
  saude:             ['#EF4444', '#7F1D1D'],
  negocios:          ['#0EA5A0', '#066E6A'],
  financas:          ['#EAB308', '#854D0E'],
  direito:           ['#334155', '#0F172A'],
  educacao:          ['#3B82F6', '#1D4ED8'],
  inovacao:          ['#F59E0B', '#B45309'],
  empreendedorismo:  ['#EC4899', '#9D174D'],
  marketing:         ['#8B5CF6', '#5B21B6'],
  agricultura:       ['#65A30D', '#365314'],
  petroleogas:       ['#78716C', '#292524'],
  entretenimento:    ['#F43F5E', '#9F1239'],
  artecultura:       ['#D946EF', '#86198F'],
  connectall:        ['#CE1126', '#7A0B18'],
  design:            ['#A855F7', '#6B21A8'],
  carreira:          ['#22C55E', '#15803D'],
  todas:             ['#6B7280', '#374151'],
};

function corDoClube(area) {
  return COR_AREA[area] || COR_AREA.todas;
}

// ── Gerar código de convite único ─────────────────────────────────────────────
function gerarCodigoConvite() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = 'FS-';
  for (let i = 0; i < 6; i++) {
    codigo += chars[Math.floor(Math.random() * chars.length)];
  }
  return codigo;
}

// ── Seletor de Área (com opção de escrever uma área própria) ──────────────────
function SeletorArea({ area, onChange }) {
  const ehPredefinida = AREAS.some(a => a.id === area && a.id !== 'todas');
  const [modoCustom, setModoCustom]   = useState(!ehPredefinida && !!area);
  const [textoCustom, setTextoCustom] = useState(ehPredefinida ? '' : (area || ''));

  return (
    <View>
      <View style={mc.areas}>
        {AREAS.filter(a => a.id !== 'todas').map(a => (
          <TouchableOpacity
            key={a.id}
            style={[mc.chip, !modoCustom && area === a.id && mc.chipA]}
            onPress={() => { setModoCustom(false); onChange(a.id); }}
          >
            <Text style={[mc.chipTxt, !modoCustom && area === a.id && mc.chipTxtA]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[mc.chip, modoCustom && mc.chipA]}
          onPress={() => { setModoCustom(true); onChange(textoCustom.trim()); }}
        >
          <Text style={[mc.chipTxt, modoCustom && mc.chipTxtA]}>✏️ Outra área</Text>
        </TouchableOpacity>
      </View>
      {modoCustom && (
        <TextInput
          style={[mc.input, { marginTop: 10 }]}
          value={textoCustom}
          onChangeText={t => { setTextoCustom(t); onChange(t.trim()); }}
          placeholder="Escreve o nome da tua área (ex: Petroquímica)"
          maxLength={40}
          autoFocus
        />
      )}
    </View>
  );
}

// ── Escolher e enviar foto (usado para foto de perfil de clube) ──────────────
async function escolherImagemGaleria() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permissão necessária', 'Precisamos de acesso às tuas fotos para definires a imagem do clube.');
    return null;
  }
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });
  if (resultado.canceled || !resultado.assets?.length) return null;
  return resultado.assets[0];
}

async function enviarFotoClube(uriLocal, clubeId) {
  const resposta = await fetch(uriLocal);
  const blob = await resposta.blob();
  const caminho = `clubes/${clubeId}/capa_${Date.now()}.jpg`;
  const refImagem = storageRef(storage, caminho);
  await uploadBytes(refImagem, blob);
  return await getDownloadURL(refImagem);
}

// ── Upload de imagem anexada a uma publicação/comentário do clube ────────────
async function enviarImagemClube(uriLocal, clubeId, pasta = 'posts') {
  const resposta = await fetch(uriLocal);
  const blob = await resposta.blob();
  const caminho = `clubes/${clubeId}/${pasta}/imagem_${Date.now()}.jpg`;
  const refImagem = storageRef(storage, caminho);
  await uploadBytes(refImagem, blob);
  return await getDownloadURL(refImagem);
}

// ── Upload de áudio (nota de voz) de uma publicação/comentário do clube ──────
async function enviarAudioClube(uriLocal, clubeId, pasta = 'posts') {
  const resposta = await fetch(uriLocal);
  const blob = await resposta.blob();
  const caminho = `clubes/${clubeId}/${pasta}/audio_${Date.now()}.m4a`;
  const refAudio = storageRef(storage, caminho);
  await uploadBytes(refAudio, blob);
  return await getDownloadURL(refAudio);
}

function formatarDuracao(seg) {
  const s = Math.max(0, Math.floor(seg || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// ── Hook: gravação de nota de voz (áudio) — usa expo-audio (useAudioRecorder) ─
function useGravadorAudio() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [audioUri, setAudioUri] = useState(null);

  const iniciarGravacao = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Precisamos de acesso ao microfone para gravar uma nota de voz.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setAudioUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      console.error('[Gravação de áudio]', e);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação de áudio.');
    }
  };

  const pararGravacao = async () => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      setAudioUri(recorder.uri);
    } catch (e) {
      console.error('[Gravação de áudio]', e);
    }
  };

  const cancelarGravacao = async () => {
    try { await recorder.stop(); } catch (_) {}
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setAudioUri(null);
  };

  const descartarAudio = () => setAudioUri(null);

  return {
    gravando: recorderState.isRecording,
    duracaoSeg: Math.floor((recorderState.durationMillis || 0) / 1000),
    audioUri,
    iniciarGravacao,
    pararGravacao,
    cancelarGravacao,
    descartarAudio,
  };
}

// ── Leitor compacto de nota de voz (play/pause) — usa expo-audio (useAudioPlayer) ─
function PlayerAudio({ uri, cor = '#1677F2' }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const alternar = () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      // expo-audio não reinicia sozinho no fim — se já terminou, volta ao início
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
        player.seekTo(0);
      }
      player.play();
    } catch (e) {
      console.error('[PlayerAudio]', e);
      Alert.alert('Erro', 'Não foi possível reproduzir esta nota de voz.');
    }
  };

  return (
    <TouchableOpacity style={[na.player, { borderColor: cor }]} onPress={alternar} activeOpacity={0.8}>
      <View style={[na.playerBtn, { backgroundColor: cor }]}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={13} color="#fff" />
      </View>
      <View style={na.ondaWrap}>
        {[6, 10, 14, 9, 16, 8, 12, 6, 15, 10, 7, 13].map((h, i) => (
          <View key={i} style={[na.ondaBarra, { height: h, backgroundColor: cor, opacity: status.playing ? 1 : 0.55 }]} />
        ))}
      </View>
      <Ionicons name="mic" size={13} color={cor} />
    </TouchableOpacity>
  );
}

const na = StyleSheet.create({
  player:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#fff' },
  playerBtn:   { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ondaWrap:    { flexDirection: 'row', alignItems: 'center', gap: 2, height: 18 },
  ondaBarra:   { width: 2.5, borderRadius: 2 },
  anexoPreview:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 8, marginTop: 6 },
  anexoImg:    { width: 46, height: 46, borderRadius: 8 },
  anexoTxt:    { fontSize: 12, color: '#374151', fontWeight: '600', flex: 1 },
  anexoRemover:{ padding: 4 },
  gravandoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 10, marginTop: 6 },
  gravandoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  gravandoTxt: { fontSize: 12, color: '#991B1B', fontWeight: '700', flex: 1 },
  acoesRow:    { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 6 },
  acaoIcon:    { padding: 4 },
});

// ── Menu de ações genérico (bottom sheet) ─────────────────────────────────────
function MenuAcoes({ visivel, onFechar, titulo, opcoes = [] }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visivel} animationType="fade" transparent onRequestClose={onFechar}>
      <TouchableOpacity style={ma.fundo} activeOpacity={1} onPress={onFechar}>
        <View style={[ma.folha, { paddingBottom: 12 + insets.bottom }]}>
          {titulo ? <Text style={ma.titulo}>{titulo}</Text> : null}
          {opcoes.map((op, i) => (
            <TouchableOpacity
              key={i}
              style={[ma.linha, i === opcoes.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => { onFechar(); setTimeout(op.onPress, 200); }}
            >
              <Ionicons name={op.icon} size={19} color={op.destrutivo ? '#DC2626' : '#374151'} />
              <Text style={[ma.linhaTxt, op.destrutivo && { color: '#DC2626' }]}>{op.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={ma.cancelar} onPress={onFechar}>
            <Text style={ma.cancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const ma = StyleSheet.create({
  fundo:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  folha:        { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 8 },
  titulo:       { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textAlign: 'center', paddingVertical: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  linha:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  linhaTxt:     { fontSize: 15, color: '#111827', fontWeight: '600' },
  cancelar:     { marginTop: 8, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelarTxt:  { fontSize: 15, fontWeight: '700', color: '#374151' },
});

function iniciais(nome) {
  if (!nome) return '?';
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function Avatar({ uri, nome, size = 56, falando = false }) {
  const st = { width: size, height: size, borderRadius: size / 2 };
  const anel = falando ? { borderWidth: 3, borderColor: '#4CAF50' } : {};
  if (uri) return <Image source={{ uri }} style={[st, anel]} />;
  return (
    <View style={[st, { backgroundColor: '#555', alignItems: 'center', justifyContent: 'center' }, anel]}>
      <Text style={{ color: '#fff', fontSize: size * 0.33, fontWeight: '700' }}>{iniciais(nome)}</Text>
    </View>
  );
}

// ── Hook Agora RTC ────────────────────────────────────────────────────────────
function useAgoraRTC({ ativo, salaId, token, uid, role }) {
  const [falam,  setFalam]  = useState({});
  const [ligado, setLigado] = useState(false);

  useEffect(() => {
    if (!ativo || !salaId || !token || !uid) return;
    if (!AgoraEngine.disponivel()) return;

    const pedirPermissao = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            { title: 'Permissão de Microfone', message: 'Precisamos do microfone para as salas de voz ao vivo.', buttonPositive: 'Permitir' }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
        } catch (_) { return false; }
      }
      return true;
    };

    (async () => {
      const temPermissao = await pedirPermissao();
      if (!temPermissao) return;

      AgoraEngine.init();
      AgoraEngine.enableAudio();
      AgoraEngine.setSpeakerphone(true);
      AgoraEngine.enableVolumeIndication();

      const isHost = role === 'host' || role === 'orador';
      const numUid = Math.abs(uid.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000;

      AgoraEngine.registarHandlers({
        onJoinChannelSuccess: (connection) => { console.log('[Agora/Feira] ✅ Entrou:', connection.channelId); setLigado(true); },
        onLeaveChannel:       ()            => { setLigado(false); },
        onUserJoined:         (conn, ruid)  => { console.log('[Agora/Feira] 👤 Entrou:', ruid); },
        onUserOffline:        (conn, ruid)  => { console.log('[Agora/Feira] 👤 Saiu:', ruid); },
        onAudioVolumeIndication: (_conn, speakers) => {
          const m = {};
          (speakers || []).forEach(s => { if (s.volume > 10) m[s.uid] = true; });
          setFalam(m);
        },
        onError: (code, msg) => console.warn('[Agora/Feira] ❌ Erro:', code, msg),
      });

      await AgoraEngine.entrarCanal({
        canal: salaId, token, uid: numUid,
        role: isHost ? 'broadcaster' : 'audience',
        utilizador: 'feira',
      });
    })();

    return () => { AgoraEngine.sairCanal('feira'); setLigado(false); setFalam({}); };
  }, [ativo, salaId, token]);

  useEffect(() => {
    if (!ativo) return;
    AgoraEngine.setClientRole(role);
  }, [role]);

  const mutarMic = (mudo) => AgoraEngine.mutarMic(mudo);
  return { falam, mutarMic, ligado };
}

// ── Modal Entrar com Código (para salas privadas) ─────────────────────────────
function ModalEntrarComCodigo({ visivel, onFechar, onEntrar }) {
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const insets = useSafeAreaInsets();

  const formatar = (t) => {
    const limpo = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpo.startsWith('FS') && limpo.length > 2) {
      return 'FS-' + limpo.slice(2, 8);
    }
    return limpo.slice(0, 8);
  };

  const verificar = async () => {
    const codigoLimpo = codigo.replace(/\s/g, '').toUpperCase();
    if (codigoLimpo.length < 8) {
      Alert.alert('Código inválido', 'O código deve ter o formato FS-XXXXXX.');
      return;
    }
    setVerificando(true);
    try {
      // Procura a sala com este código de convite
      const q = query(
        collection(db, 'salas'),
        where('codigoConvite', '==', codigoLimpo),
        where('ativa', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('Código inválido', 'Este código não existe ou a sala já foi encerrada.');
        return;
      }
      const sala = { id: snap.docs[0].id, ...snap.docs[0].data() };
      onEntrar(sala.id);
      onFechar();
      setCodigo('');
    } catch (e) {
      console.warn('[EntrarCodigo]', e);
      Alert.alert('Erro', 'Não foi possível verificar o código.');
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 24 + insets.bottom }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111' }}>Entrar com código</Text>
            <TouchableOpacity onPress={onFechar}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
            Introduz o código de convite partilhado pelo anfitrião da sala privada.
          </Text>
          <View style={{ borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 }}>
            <TextInput
              style={{ fontSize: 20, fontWeight: '700', color: '#111', letterSpacing: 2, textAlign: 'center' }}
              placeholder="FS-XXXXXX"
              placeholderTextColor="#CCC"
              value={codigo}
              onChangeText={t => setCodigo(formatar(t))}
              autoCapitalize="characters"
              maxLength={9}
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={{ backgroundColor: codigo.length >= 8 ? '#1677F2' : '#E5E7EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center' }}
            onPress={verificar}
            disabled={codigo.length < 8 || verificando}
          >
            <Text style={{ color: codigo.length >= 8 ? '#fff' : '#9CA3AF', fontSize: 15, fontWeight: '700' }}>
              {verificando ? 'A verificar...' : 'Entrar na sala'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Modal Criar Sala ──────────────────────────────────────────────────────────
function ModalCriarSala({ visivel, onFechar, onCriada, uid, perfil }) {
  const [titulo,     setTitulo]     = useState('');
  const [descricao,  setDescricao]  = useState('');
  const [area,       setArea]       = useState('tecnologia');
  const [privada,    setPrivada]    = useState(false);
  const [criando,    setCriando]    = useState(false);
  const [codigoGerado, setCodigoGerado] = useState('');
  const [copiado,    setCopiado]    = useState(false);

  const gerarCodigo = () => {
    const novo = gerarCodigoConvite();
    setCodigoGerado(novo);
  };

  const copiarCodigo = async () => {
    if (!codigoGerado) return;
    await Clipboard.setStringAsync(
      `Fui convidado para uma sala privada na Feira do Saber (ConnectAll Angola).\n\nCódigo de acesso: ${codigoGerado}\n\nAbre a app → Comunidade → Feira do Saber → "Entrar com código"`
    );
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const partilharCodigo = async () => {
    if (!codigoGerado) return;
    await Share.share({
      message: `Fui convidado para uma sala privada na Feira do Saber (ConnectAll Angola).\n\nCódigo de acesso: ${codigoGerado}\n\nAbre a app → Comunidade → Feira do Saber → "Entrar com código"`,
      title: 'Convite para Sala Privada',
    });
  };

  const criar = async () => {
    if (!titulo.trim()) { Alert.alert('Campo obrigatório', 'Introduz um título.'); return; }
    if (privada && !codigoGerado) { Alert.alert('Código necessário', 'Gera o código de convite antes de criar a sala privada.'); return; }
    setCriando(true);
    try {
      const dadosSala = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        area,
        hostUid:   uid,
        hostNome:  perfil?.nome || 'Utilizador',
        hostFoto:  perfil?.fotoURL || null,
        ativa:     true,
        privada:   privada,
        microfones: 1,
        ouvintes:   0,
        criadoEm:  serverTimestamp(),
      };
      if (privada && codigoGerado) {
        dadosSala.codigoConvite = codigoGerado;
      }

      const ref = await addDoc(collection(db, 'salas'), dadosSala);
      await setDoc(doc(db, 'salas', ref.id, 'participantes', uid), {
        uid, nome: perfil?.nome || 'Utilizador', foto: perfil?.fotoURL || null,
        role: 'host', micAtivo: true, pedindoPalavra: false, entradoEm: serverTimestamp(),
      });

      setTitulo(''); setDescricao(''); setArea('tecnologia');
      setPrivada(false); setCodigoGerado(''); setCopiado(false);
      onCriada(ref.id);
      onFechar();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível criar a sala.');
    } finally { setCriando(false); }
  };

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={mc.container} edges={['top', 'bottom']}>
        <View style={mc.header}>
          <TouchableOpacity onPress={onFechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={mc.cancelar}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={mc.titulo}>Nova Sala de Voz</Text>
          <TouchableOpacity onPress={criar} disabled={criando} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[mc.criar, criando && { opacity: 0.4 }]}>Criar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={mc.scroll}>
          <Text style={mc.label}>Título *</Text>
          <TextInput style={mc.input} value={titulo} onChangeText={setTitulo} placeholder="Ex: Ecossistema tech em Angola" maxLength={80} />

          <Text style={mc.label}>Descrição</Text>
          <TextInput style={[mc.input, mc.inputArea]} value={descricao} onChangeText={setDescricao} placeholder="Sobre o que vamos falar?" multiline maxLength={300} />

          <Text style={mc.label}>Área</Text>
          <SeletorArea area={area} onChange={setArea} />

          {/* ── Toggle Sala Privada ── */}
          <View style={mc.privadaRow}>
            <View style={{ flex: 1 }}>
              <Text style={mc.privadaTitulo}>🔒 Sala Privada</Text>
              <Text style={mc.privadaSub}>Apenas quem tiver o código poderá entrar</Text>
            </View>
            <TouchableOpacity
              style={[mc.toggle, privada && mc.toggleOn]}
              onPress={() => {
                const novo = !privada;
                setPrivada(novo);
                if (novo && !codigoGerado) {
                  setCodigoGerado(gerarCodigoConvite());
                }
                if (!novo) {
                  setCodigoGerado('');
                  setCopiado(false);
                }
              }}
            >
              <View style={[mc.toggleCircle, privada && mc.toggleCircleOn]} />
            </TouchableOpacity>
          </View>

          {/* ── Código de Convite ── */}
          {privada && (
            <View style={mc.codigoBox}>
              <View style={mc.codigoHeader}>
                <Text style={mc.codigoLabel}>Código de convite</Text>
                <TouchableOpacity onPress={gerarCodigo}>
                  <Text style={mc.codigoRegerar}>🔄 Gerar novo</Text>
                </TouchableOpacity>
              </View>

              {codigoGerado ? (
                <>
                  <View style={mc.codigoDisplay}>
                    <Text style={mc.codigoTxt}>{codigoGerado}</Text>
                  </View>
                  <Text style={mc.codigoInfo}>Este código expira quando a sala for encerrada.</Text>
                  <View style={mc.codigoBtns}>
                    <TouchableOpacity
                      style={[mc.codigoBtn, copiado && { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]}
                      onPress={copiarCodigo}
                    >
                      <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={16} color={copiado ? '#10B981' : '#1677F2'} />
                      <Text style={[mc.codigoBtnTxt, copiado && { color: '#10B981' }]}>
                        {copiado ? 'Copiado!' : 'Copiar'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[mc.codigoBtn, { backgroundColor: '#F0FDF4', borderColor: '#22C55E' }]} onPress={partilharCodigo}>
                      <Ionicons name="share-social-outline" size={16} color="#22C55E" />
                      <Text style={[mc.codigoBtnTxt, { color: '#22C55E' }]}>Partilhar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity style={mc.gerarBtn} onPress={gerarCodigo}>
                  <Ionicons name="key-outline" size={18} color="#1677F2" />
                  <Text style={mc.gerarBtnTxt}>Gerar código de convite</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const mc = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  titulo:    { fontSize: 16, fontWeight: '700' },
  cancelar:  { fontSize: 15, color: '#666' },
  criar:     { fontSize: 15, fontWeight: '700', color: '#1677F2' },
  scroll:    { padding: 20, gap: 4 },
  label:     { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6, marginTop: 18 },
  input:     { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 15 },
  inputArea: { height: 100, textAlignVertical: 'top' },
  areas:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  chipA:     { backgroundColor: '#EFF6FF', borderColor: '#1677F2' },
  chipTxt:   { fontSize: 13, color: '#555' },
  chipTxtA:  { color: '#1677F2', fontWeight: '700' },
  // Sala Privada
  privadaRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 24, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  privadaTitulo: { fontSize: 15, fontWeight: '700', color: '#111' },
  privadaSub:    { fontSize: 12, color: '#6B7280', marginTop: 2 },
  toggle:        { width: 48, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', padding: 2, justifyContent: 'center' },
  toggleOn:      { backgroundColor: '#1677F2' },
  toggleCircle:  { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleCircleOn:{ alignSelf: 'flex-end' },
  // Código
  codigoBox:    { marginTop: 16, padding: 16, backgroundColor: '#EFF6FF', borderRadius: 14, borderWidth: 1.5, borderColor: '#BFDBFE', gap: 10 },
  codigoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codigoLabel:  { fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  codigoRegerar:{ fontSize: 12, color: '#1677F2', fontWeight: '600' },
  codigoDisplay:{ backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  codigoTxt:    { fontSize: 28, fontWeight: '900', color: '#1E3A8A', letterSpacing: 4 },
  codigoInfo:   { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  codigoBtns:   { flexDirection: 'row', gap: 10 },
  codigoBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 10, borderWidth: 1.5, borderColor: '#BFDBFE' },
  codigoBtnTxt: { fontSize: 13, fontWeight: '700', color: '#1677F2' },
  gerarBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1677F2', borderRadius: 10, paddingVertical: 12 },
  gerarBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Foto do clube
  fotoBox:        { width: '100%', height: 130, borderRadius: 16, backgroundColor: '#F3F4F6', overflow: 'hidden', marginBottom: 6 },
  fotoPreview:    { width: '100%', height: '100%' },
  fotoVazia:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 16 },
  fotoVaziaTxt:   { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  fotoEditarBadge:{ position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});

// ── Modal Criar Clube ──────────────────────────────────────────────────────────
function ModalCriarClube({ visivel, onFechar, onCriado, uid, perfil }) {
  const [titulo,    setTitulo]    = useState('');
  const [descricao, setDescricao] = useState('');
  const [area,      setArea]      = useState('tecnologia');
  const [fotoLocal, setFotoLocal] = useState(null);
  const [dimensoesFoto, setDimensoesFoto] = useState(null);
  const [criando,   setCriando]   = useState(false);

  const escolherFoto = async () => {
    const asset = await escolherImagemGaleria();
    if (asset) {
      setFotoLocal(asset.uri);
      setDimensoesFoto({ largura: asset.width, altura: asset.height });
    }
  };

  const criar = async () => {
    if (!titulo.trim()) { Alert.alert('Campo obrigatório', 'Introduz um título.'); return; }
    setCriando(true);
    try {
      const dadosClube = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        area,
        fotoURL: null,
        fotoLargura: dimensoesFoto?.largura || null,
        fotoAltura: dimensoesFoto?.altura || null,
        criadorUid:  uid,
        criadorNome: perfil?.nome || 'Utilizador',
        criadorFoto: perfil?.fotoURL || null,
        ativo: true,
        membrosCount: 1,
        membrosUids: [uid],
        criadoEm: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'clubes'), dadosClube);
      await setDoc(doc(db, 'clubes', ref.id, 'membros', uid), {
        uid, nome: perfil?.nome || 'Utilizador', foto: perfil?.fotoURL || null,
        role: 'admin', entradoEm: serverTimestamp(),
      });

      if (fotoLocal) {
        try {
          const url = await enviarFotoClube(fotoLocal, ref.id);
          await updateDoc(doc(db, 'clubes', ref.id), {
            fotoURL: url,
            fotoLargura: dimensoesFoto?.largura || null,
            fotoAltura: dimensoesFoto?.altura || null,
          });
        } catch (e) {
          console.warn('[ModalCriarClube] Falha ao enviar foto:', e);
        }
      }

      setTitulo(''); setDescricao(''); setArea('tecnologia'); setFotoLocal(null); setDimensoesFoto(null);
      onCriado(ref.id);
      onFechar();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível criar o clube.');
    } finally { setCriando(false); }
  };

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={mc.container} edges={['top', 'bottom']}>
        <View style={mc.header}>
          <TouchableOpacity onPress={onFechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={mc.cancelar}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={mc.titulo}>Novo Clube</Text>
          <TouchableOpacity onPress={criar} disabled={criando} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[mc.criar, criando && { opacity: 0.4 }]}>{criando ? 'A criar...' : 'Criar'}</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView contentContainerStyle={mc.scroll} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={mc.fotoBox} onPress={escolherFoto} activeOpacity={0.85}>
              {fotoLocal ? (
                <Image source={{ uri: fotoLocal }} style={mc.fotoPreview} />
              ) : (
                <View style={mc.fotoVazia}>
                  <Ionicons name="camera-outline" size={26} color="#9CA3AF" />
                  <Text style={mc.fotoVaziaTxt}>Adicionar foto do clube</Text>
                </View>
              )}
              <View style={mc.fotoEditarBadge}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </TouchableOpacity>

            <Text style={mc.label}>Título *</Text>
            <TextInput style={mc.input} value={titulo} onChangeText={setTitulo} placeholder="Ex: Inovadores de Angola" maxLength={60} />

            <Text style={mc.label}>Descrição</Text>
            <TextInput
              style={[mc.input, mc.inputArea]}
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Sobre o que é este clube?"
              multiline
              maxLength={280}
            />

            <Text style={mc.label}>Área</Text>
            <SeletorArea area={area} onChange={setArea} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Modal Detalhe do Clube (info, publicações, membros, aderir/sair) ─────────
// ── Publicação interativa dentro de um Clube (like + comentários) ─────────────
function PostClube({ clubeId, clubeTitulo, post, meuUid, meuPerfil, souMembro, podeApagarPost, onApagar, onFocarComentario, onLayoutPost }) {
  const [expandido,       setExpandido]       = useState(false);
  const [comentarios,     setComentarios]     = useState([]);
  const [curtindo,        setCurtindo]        = useState(false);
  const [menuVisivel,     setMenuVisivel]     = useState(false);
  const [repostando,      setRepostando]      = useState(false);
  const [comentarioRepost, setComentarioRepost] = useState('');
  const [modalRepost,      setModalRepost]      = useState(false);

  const curtiu = !!post.curtidas?.includes(meuUid);

  useEffect(() => {
    if (!expandido) return;
    const q = query(collection(db, 'clubes', clubeId, 'posts', post.id, 'comentarios'), orderBy('criadoEm', 'asc'));
    return onSnapshot(q, snap => setComentarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [expandido, clubeId, post.id]);

  const toggleCurtir = async () => {
    if (!souMembro || curtindo) return;
    setCurtindo(true);
    try {
      await updateDoc(doc(db, 'clubes', clubeId, 'posts', post.id), {
        curtidas: curtiu ? arrayRemove(meuUid) : arrayUnion(meuUid),
      });
    } catch (e) {
      console.error(e);
    } finally { setCurtindo(false); }
  };

  const partilharPost = async () => {
    try {
      await Share.share({
        message: `${post.autorNome} partilhou no clube "${clubeTitulo}" (Feira do Saber — ConnectAll Angola):\n\n"${post.texto}"`,
        title: 'Partilhar publicação',
      });
    } catch (e) { console.warn('[Partilhar]', e); }
  };

  // Notas de voz (áudio) nunca podem ser repartilhadas no feed principal —
  // apenas publicações em texto (podendo ter imagem) são elegíveis a repost.
  const podeRepostar = !post.audioURL;

  const abrirRepost = () => {
    setComentarioRepost('');
    setModalRepost(true);
  };

  const repostarNoFeed = async () => {
    if (repostando) return;
    if (!podeRepostar) {
      Alert.alert('Não é possível repostar', 'Notas de voz não podem ser repartilhadas no feed. Apenas publicações em texto (com ou sem imagem) podem ser repostadas.');
      return;
    }
    const comentario = comentarioRepost.trim();
    setModalRepost(false);
    setRepostando(true);
    try {
      // IMPORTANTE: o feed principal (feed.jsx) ordena por 'timestamp' e lê os
      // campos 'uid', 'autorNome', 'autorFoto', 'likes', 'likedBy', 'comentarios',
      // 'mediaUrls' e 'reacoesMap'. Gravar com nomes diferentes (ex: 'criadoEm')
      // faz o Firestore excluir o documento do orderBy('timestamp') e o repost
      // nunca aparece no feed — é exactamente esse o bug que estava a acontecer.
      await addDoc(collection(db, COLECAO_FEED), {
        texto: comentario || post.texto || '',
        repostTextoOriginal: post.texto || '',
        uid:  meuUid,
        autorNome: meuPerfil?.nome || 'Utilizador',
        autorFoto: meuPerfil?.fotoURL || null,
        autorCargo: meuPerfil?.cargo || meuPerfil?.profissao || '',
        autorCidade: meuPerfil?.cidade || '',
        autorVerificado: !!meuPerfil?.verificado,
        tipo: 'geral',
        likes: 0,
        likedBy: [],
        comentarios: 0,
        mediaUrls: post.imagemURL ? [{ url: post.imagemURL, type: 'image' }] : [],
        reacoesMap: {},
        timestamp: serverTimestamp(),
        repostadoDe: {
          clubeId,
          clubeTitulo,
          postId: post.id,
          autorNomeOriginal: post.autorNome,
          autorFotoOriginal: post.autorFoto || null,
        },
      });
      Alert.alert('Repostado!', 'Esta publicação foi repartilhada no teu feed.');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível repostar esta publicação no feed.');
    } finally { setRepostando(false); }
  };

  const denunciarPost = async () => {
    try {
      await addDoc(collection(db, 'denuncias'), {
        tipo: 'post_clube',
        clubeId, postId: post.id,
        denuncianteUid: meuUid,
        denunciadoUid: post.autorUid,
        criadoEm: serverTimestamp(),
      });
      Alert.alert('Denúncia enviada', 'Obrigado, a nossa equipa vai analisar esta publicação.');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível enviar a denúncia.');
    }
  };

  const opcoesMenu = [
    ...(podeRepostar ? [{ icon: 'repeat-outline', label: 'Repostar no feed', onPress: abrirRepost }] : []),
    { icon: 'share-social-outline', label: 'Partilhar', onPress: partilharPost },
    ...(post.autorUid !== meuUid ? [{ icon: 'flag-outline', label: 'Denunciar publicação', onPress: denunciarPost, destrutivo: true }] : []),
    ...(podeApagarPost ? [{ icon: 'trash-outline', label: 'Apagar publicação', onPress: () => onApagar(post.id), destrutivo: true }] : []),
  ];

  const apagarComentario = (comentarioId) => {
    Alert.alert('Apagar comentário', 'Tens a certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'clubes', clubeId, 'posts', post.id, 'comentarios', comentarioId));
          await updateDoc(doc(db, 'clubes', clubeId, 'posts', post.id), { comentariosCount: increment(-1) });
        }
      },
    ]);
  };

  return (
    <View style={cd.post} onLayout={e => onLayoutPost?.(post.id, e.nativeEvent.layout.y)}>
      <Avatar uri={post.autorFoto} nome={post.autorNome} size={38} />
      <View style={{ flex: 1 }}>
        <View style={cd.postHeader}>
          <Text style={cd.postAutor}>{post.autorNome}</Text>
          <TouchableOpacity onPress={() => setMenuVisivel(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={17} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        {!!post.texto && <Text style={cd.postTexto}>{post.texto}</Text>}
        {!!post.imagemURL && (
          <Image
            source={{ uri: post.imagemURL }}
            style={[cd.postImagem, post.imagemLargura && post.imagemAltura && { aspectRatio: post.imagemLargura / post.imagemAltura }]}
            resizeMode="contain"
          />
        )}
        {!!post.audioURL && <PlayerAudio uri={post.audioURL} />}

        <View style={cd.postAcoes}>
          <TouchableOpacity style={cd.postAcaoBtn} onPress={toggleCurtir} disabled={!souMembro || curtindo}>
            <Ionicons name={curtiu ? 'heart' : 'heart-outline'} size={17} color={curtiu ? '#DC2626' : '#6B7280'} />
            <Text style={[cd.postAcaoTxt, curtiu && { color: '#DC2626', fontWeight: '700' }]}>
              {post.curtidas?.length || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={cd.postAcaoBtn} onPress={() => setExpandido(v => !v)}>
            <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
            <Text style={cd.postAcaoTxt}>{post.comentariosCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cd.postAcaoBtn} onPress={partilharPost}>
            <Ionicons name="share-social-outline" size={16} color="#6B7280" />
          </TouchableOpacity>
          {podeRepostar && (
            <TouchableOpacity style={cd.postAcaoBtn} onPress={abrirRepost} disabled={repostando}>
              <Ionicons name="repeat-outline" size={17} color={repostando ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={modalRepost} transparent animationType="fade" onRequestClose={() => setModalRepost(false)}>
          <View style={cd.repostOverlay}>
            <View style={cd.repostSheet}>
              <View style={cd.repostTituloRow}>
                <Text style={cd.repostTitulo}>Repartilhar no feed</Text>
                <TouchableOpacity onPress={() => setModalRepost(false)}>
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={cd.repostInput}
                value={comentarioRepost}
                onChangeText={setComentarioRepost}
                placeholder="Adiciona um comentário (opcional)..."
                multiline
                maxLength={500}
                autoFocus
              />
              <View style={cd.repostPreview}>
                <Ionicons name="repeat-outline" size={16} color="#059669" />
                <Text style={cd.repostPreviewTxt} numberOfLines={2}>{post.texto || 'Publicação do Clube do Saber'}</Text>
              </View>
              <View style={cd.repostBtns}>
                <TouchableOpacity style={cd.repostCancelar} onPress={() => setModalRepost(false)}>
                  <Text style={cd.repostCancelarTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={cd.repostConfirmar} onPress={repostarNoFeed} disabled={repostando}>
                  {repostando ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="repeat-outline" size={16} color="#fff" /><Text style={cd.repostConfirmarTxt}>Repartilhar</Text></>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>



      <MenuAcoes visivel={menuVisivel} onFechar={() => setMenuVisivel(false)} titulo="Publicação" opcoes={opcoesMenu} />

        {expandido && (
          <View style={cd.comentariosBox}>
            {comentarios.map(c => (
              <View key={c.id} style={cd.comentarioLinha}>
                <Avatar uri={c.autorFoto} nome={c.autorNome} size={26} />
                <View style={{ flex: 1 }}>
                  <View style={cd.comentarioHeader}>
                    <Text style={cd.comentarioAutor}>{c.autorNome}</Text>
                    {(c.autorUid === meuUid || podeApagarPost) && (
                      <TouchableOpacity onPress={() => apagarComentario(c.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close" size={13} color="#D1D5DB" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {!!c.texto && <Text style={cd.comentarioTexto}>{c.texto}</Text>}
                  {!!c.imagemURL && (
                    <Image source={{ uri: c.imagemURL }} style={cd.comentarioImagem} resizeMode="cover" />
                  )}
                  {!!c.audioURL && <PlayerAudio uri={c.audioURL} cor="#374151" />}
                </View>
              </View>
            ))}
            {souMembro && (
              <ComposerComentarioClube
                clubeId={clubeId}
                postId={post.id}
                meuUid={meuUid}
                meuPerfil={meuPerfil}
                onFocar={onFocarComentario}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Composer de comentário (texto + imagem + nota de voz) de um Clube ────────
// Isolado num componente próprio para que o gravador de áudio só exista
// enquanto a caixa de comentários estiver aberta (expandido === true).
function ComposerComentarioClube({ clubeId, postId, meuUid, meuPerfil, onFocar }) {
  const [texto,        setTexto]        = useState('');
  const [imagemLocal,  setImagemLocal]  = useState(null);
  const [enviando,     setEnviando]     = useState(false);
  const gravador = useGravadorAudio();

  const anexarImagem = async () => {
    const asset = await escolherImagemGaleria();
    if (asset) setImagemLocal(asset.uri);
  };

  const enviar = async () => {
    const temTexto  = !!texto.trim();
    const temImagem = !!imagemLocal;
    const temAudio  = !!gravador.audioUri;
    if ((!temTexto && !temImagem && !temAudio) || enviando || gravador.gravando) return;
    setEnviando(true);
    try {
      let imagemURL = null;
      let audioURL  = null;
      if (temImagem) imagemURL = await enviarImagemClube(imagemLocal, clubeId, `posts/${postId}/comentarios`);
      if (temAudio)  audioURL  = await enviarAudioClube(gravador.audioUri, clubeId, `posts/${postId}/comentarios`);

      await addDoc(collection(db, 'clubes', clubeId, 'posts', postId, 'comentarios'), {
        texto: texto.trim(),
        imagemURL,
        audioURL,
        audioDuracaoSeg: temAudio ? gravador.duracaoSeg : null,
        autorUid:  meuUid,
        autorNome: meuPerfil?.nome || 'Utilizador',
        autorFoto: meuPerfil?.fotoURL || null,
        criadoEm: serverTimestamp(),
      });
      await updateDoc(doc(db, 'clubes', clubeId, 'posts', postId), { comentariosCount: increment(1) });
      setTexto('');
      setImagemLocal(null);
      gravador.descartarAudio();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível comentar.');
    } finally { setEnviando(false); }
  };

  const podeEnviar = !!(texto.trim() || imagemLocal || gravador.audioUri) && !enviando && !gravador.gravando;

  return (
    <View>
      {!!imagemLocal && (
        <View style={na.anexoPreview}>
          <Image source={{ uri: imagemLocal }} style={na.anexoImg} />
          <Text style={na.anexoTxt}>Imagem anexada</Text>
          <TouchableOpacity style={na.anexoRemover} onPress={() => setImagemLocal(null)}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}
      {gravador.gravando && (
        <View style={na.gravandoBox}>
          <View style={na.gravandoDot} />
          <Text style={na.gravandoTxt}>A gravar... {formatarDuracao(gravador.duracaoSeg)}</Text>
          <TouchableOpacity onPress={gravador.cancelarGravacao}>
            <Ionicons name="trash-outline" size={18} color="#991B1B" />
          </TouchableOpacity>
        </View>
      )}
      {!gravador.gravando && !!gravador.audioUri && (
        <View style={na.anexoPreview}>
          <PlayerAudio uri={gravador.audioUri} />
          <Text style={na.anexoTxt}>{formatarDuracao(gravador.duracaoSeg)}</Text>
          <TouchableOpacity style={na.anexoRemover} onPress={gravador.descartarAudio}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}
      <View style={cd.comentarioInputRow}>
        <TouchableOpacity onPress={anexarImagem} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={gravador.gravando}>
          <Ionicons name="image-outline" size={19} color={gravador.gravando ? '#D1D5DB' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={gravador.gravando ? gravador.pararGravacao : gravador.iniciarGravacao}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={gravador.gravando ? 'stop-circle' : 'mic-outline'} size={20} color={gravador.gravando ? '#DC2626' : '#6B7280'} />
        </TouchableOpacity>
        <TextInput
          style={cd.comentarioInput}
          placeholder="Escreve um comentário..."
          value={texto}
          onChangeText={setTexto}
          onFocus={onFocar}
          maxLength={280}
        />
        <TouchableOpacity onPress={enviar} disabled={!podeEnviar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="send" size={18} color={podeEnviar ? '#1677F2' : '#D1D5DB'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ModalClubeDetalhe({ clubeId, onFechar, meuUid, meuPerfil, focoPostId }) {
  const [mostrarInfoClube, setMostrarInfoClube] = useState(false);
  const [clube,      setClube]      = useState(null);
  const [membros,    setMembros]    = useState([]);
  const [posts,      setPosts]      = useState([]);
  const [subTab,     setSubTab]     = useState('posts');
  const [novoPost,   setNovoPost]   = useState('');
  const [imagemPostLocal, setImagemPostLocal] = useState(null);
  const [dimensoesImagemPost, setDimensoesImagemPost] = useState(null);
  const gravadorPost = useGravadorAudio();
  const [publicando, setPublicando] = useState(false);
  const [processando,setProcessando]= useState(false);
  const [enviandoFoto,   setEnviandoFoto]   = useState(false);
  const [menuVisivel,    setMenuVisivel]    = useState(false);
  const [editarVisivel,  setEditarVisivel]  = useState(false);
  const [notifMutadas,   setNotifMutadas]   = useState(false);
  const [fotoAberta, setFotoAberta] = useState(false);
  const [aGuardarFoto, setAGuardarFoto] = useState(false);
  const [membrosBusca, setMembrosBusca] = useState('');
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const posicoesPosts = useRef({});
  const posicaoNovoPost = useRef(0);
  const jaFocouPost = useRef(false);

  const souMembro = !!clube?.membrosUids?.includes(meuUid);
  const meuMembro = membros.find(m => m.uid === meuUid);
  const souAdmin  = clube?.criadorUid === meuUid || meuMembro?.role === 'admin';
  const membrosFiltrados = membros.filter(m =>
    !membrosBusca.trim() || m.nome?.toLowerCase().includes(membrosBusca.trim().toLowerCase())
  );

  useEffect(() => {
    setNotifMutadas(!!meuMembro?.notificacoesMutadas);
  }, [meuMembro?.notificacoesMutadas]);

  // A capa/info/abas agora fazem parte do scroll (deslizam com o conteúdo),
  // por isso ao focar um campo rolamos até à posição real dele, nunca para y:0 fixo
  const focarNovoPost = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, posicaoNovoPost.current - 10), animated: true }), 150);
  };

  // Cada publicação regista a sua posição vertical; ao focar o comentário
  // dessa publicação específica, rola até ela ficar visível acima do teclado
  const registarPosicaoPost = (postId, y) => { posicoesPosts.current[postId] = y; };
  const focarComentarioDe = (postId) => {
    setTimeout(() => {
      const y = posicoesPosts.current[postId] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
    }, 150);
  };

  useEffect(() => {
    if (!focoPostId || jaFocouPost.current || posicoesPosts.current[focoPostId] === undefined) return;
    jaFocouPost.current = true;
    const temporizador = setTimeout(() => {
      const y = posicoesPosts.current[focoPostId] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    }, 400);
    return () => clearTimeout(temporizador);
  }, [focoPostId, posts]);

  useEffect(() => {
    if (!clubeId) return;
    const unsub = onSnapshot(doc(db, 'clubes', clubeId), snap => {
      if (!snap.exists() || snap.data()?.ativo === false) { onFechar(); return; }
      setClube({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [clubeId]);

  useEffect(() => {
    if (!clubeId) return;
    const q = query(collection(db, 'clubes', clubeId, 'membros'), orderBy('entradoEm', 'asc'));
    return onSnapshot(q, snap => setMembros(snap.docs.map(d => d.data())));
  }, [clubeId]);

  useEffect(() => {
    if (!clubeId) return;
    const q = query(collection(db, 'clubes', clubeId, 'posts'), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [clubeId]);

  const aderir = async () => {
    if (!clubeId || !meuUid || processando) return;
    setProcessando(true);
    try {
      await updateDoc(doc(db, 'clubes', clubeId), {
        membrosUids: arrayUnion(meuUid),
        membrosCount: increment(1),
      });
      await setDoc(doc(db, 'clubes', clubeId, 'membros', meuUid), {
        uid: meuUid, nome: meuPerfil?.nome || 'Utilizador', foto: meuPerfil?.fotoURL || null,
        role: 'membro', entradoEm: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível aderir ao clube.');
    } finally { setProcessando(false); }
  };

  const sair = async () => {
    if (!clubeId || !meuUid || processando) return;
    if (clube?.criadorUid === meuUid) {
      Alert.alert('Não é possível sair', 'És o criador deste clube. Podes eliminá-lo em vez disso.');
      return;
    }
    setProcessando(true);
    try {
      await updateDoc(doc(db, 'clubes', clubeId), {
        membrosUids: arrayRemove(meuUid),
        membrosCount: increment(-1),
      });
      await deleteDoc(doc(db, 'clubes', clubeId, 'membros', meuUid));
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível sair do clube.');
    } finally { setProcessando(false); }
  };

  const eliminarClube = () => {
    Alert.alert('Eliminar clube', 'Esta ação é permanente. Tens a certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await updateDoc(doc(db, 'clubes', clubeId), { ativo: false });
            onFechar();
          } catch (e) {
            console.error(e);
            Alert.alert('Erro', 'Não foi possível eliminar o clube.');
          }
        }
      },
    ]);
  };

  const escolherImagemPost = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às tuas fotos para anexares uma imagem.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const imagem = resultado.assets[0];
    setImagemPostLocal(imagem.uri);
    setDimensoesImagemPost({ largura: imagem.width, altura: imagem.height });
  };

  const publicar = async () => {
    const temTexto  = !!novoPost.trim();
    const temImagem = !!imagemPostLocal;
    const temAudio  = !!gravadorPost.audioUri;
    if ((!temTexto && !temImagem && !temAudio) || publicando || gravadorPost.gravando) return;
    setPublicando(true);
    try {
      let imagemURL = null;
      let audioURL  = null;
      if (temImagem) imagemURL = await enviarImagemClube(imagemPostLocal, clubeId, 'posts');
      if (temAudio)  audioURL  = await enviarAudioClube(gravadorPost.audioUri, clubeId, 'posts');

      await addDoc(collection(db, 'clubes', clubeId, 'posts'), {
        texto: novoPost.trim(),
        imagemURL,
        imagemLargura: dimensoesImagemPost?.largura || null,
        imagemAltura: dimensoesImagemPost?.altura || null,
        audioURL,
        audioDuracaoSeg: temAudio ? gravadorPost.duracaoSeg : null,
        autorUid:  meuUid,
        autorNome: meuPerfil?.nome || 'Utilizador',
        autorFoto: meuPerfil?.fotoURL || null,
        curtidas: [],
        comentariosCount: 0,
        criadoEm: serverTimestamp(),
      });
      setNovoPost('');
      setImagemPostLocal(null);
      setDimensoesImagemPost(null);
      gravadorPost.descartarAudio();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível publicar.');
    } finally { setPublicando(false); }
  };

  const apagarPost = (postId) => {
    Alert.alert('Apagar publicação', 'Tens a certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => deleteDoc(doc(db, 'clubes', clubeId, 'posts', postId)) },
    ]);
  };

  const alterarFotoClube = async () => {
    const asset = await escolherImagemGaleria();
    if (!asset) return;
    setEnviandoFoto(true);
    try {
      const url = await enviarFotoClube(asset.uri, clubeId);
      await updateDoc(doc(db, 'clubes', clubeId), {
        fotoURL: url,
        fotoLargura: asset.width || null,
        fotoAltura: asset.height || null,
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível atualizar a foto do clube.');
    } finally { setEnviandoFoto(false); }
  };

  const fotoClube = clube?.fotoURL || clube?.capaURL || clube?.foto || null;

  const guardarFotoClube = async () => {
    if (!fotoClube || aGuardarFoto) return;
    setAGuardarFoto(true);
    try {
      const permissao = await MediaLibrary.requestPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Permissão necessária', 'Permite o acesso à galeria para guardar a foto.');
        return;
      }
      const destino = `${FileSystem.cacheDirectory}clube_${clubeId}_${Date.now()}.jpg`;
      const download = await FileSystem.downloadAsync(fotoClube, destino);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      Alert.alert('Foto guardada', 'A foto do clube foi guardada na tua galeria.');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível guardar a foto.');
    } finally { setAGuardarFoto(false); }
  };

  const partilharClube = async () => {
    try {
      await Share.share({
        message: `Vem conhecer o clube "${clube.titulo}" na Feira do Saber (ConnectAll Angola)!${clube.descricao ? `\n\n${clube.descricao}` : ''}\n\nAbre a app → Comunidade → Feira do Saber → Clube do Saber → pesquisa "${clube.titulo}"`,
        title: 'Partilhar clube',
      });
    } catch (e) { console.warn('[PartilharClube]', e); }
  };

  const copiarLinkClube = async () => {
    await Clipboard.setStringAsync(
      `Clube "${clube.titulo}" — Feira do Saber (ConnectAll Angola).\nPesquisa por este nome no separador "Clube do Saber" para aderir.`
    );
    Alert.alert('Copiado', 'O convite do clube foi copiado para a área de transferência.');
  };

  const alternarNotificacoes = async () => {
    if (!meuUid || !souMembro) return;
    try {
      await updateDoc(doc(db, 'clubes', clubeId, 'membros', meuUid), { notificacoesMutadas: !notifMutadas });
      setNotifMutadas(v => !v);
    } catch (e) { console.error(e); }
  };

  const denunciarClube = async () => {
    try {
      await addDoc(collection(db, 'denuncias'), {
        tipo: 'clube', clubeId, denuncianteUid: meuUid, criadoEm: serverTimestamp(),
      });
      Alert.alert('Denúncia enviada', 'Obrigado, a nossa equipa vai analisar este clube.');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível enviar a denúncia.');
    }
  };

  if (!clube) return null;
  const [corA, corB] = corDoClube(clube.area);

  const opcoesMenuClube = [
    ...(souAdmin ? [{ icon: 'camera-outline', label: 'Alterar foto do clube', onPress: alterarFotoClube }] : []),
    ...(souAdmin ? [{ icon: 'create-outline', label: 'Editar informações', onPress: () => setEditarVisivel(true) }] : []),
    { icon: 'share-social-outline', label: 'Partilhar clube', onPress: partilharClube },
    { icon: 'link-outline', label: 'Copiar convite do clube', onPress: copiarLinkClube },
    ...(souMembro ? [{ icon: notifMutadas ? 'notifications-outline' : 'notifications-off-outline', label: notifMutadas ? 'Ativar notificações' : 'Silenciar notificações', onPress: alternarNotificacoes }] : []),
    ...(!souAdmin ? [{ icon: 'flag-outline', label: 'Denunciar clube', onPress: denunciarClube, destrutivo: true }] : []),
  ];

  return (
    <Modal visible={!!clubeId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={cd.container} edges={['top', 'bottom']}>
        <View style={cd.topo}>
          <TouchableOpacity style={cd.topoIconBtn} onPress={onFechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-down" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={cd.topoCentro}>
            <Text style={cd.topoTitulo} numberOfLines={1}>{clube.titulo}</Text>
            <View style={cd.topoEstado}>
              <View style={[cd.estadoDot, { backgroundColor: corA }]} />
              <Text style={cd.topoEstadoTxt}>{souMembro ? 'Membro do clube' : 'Comunidade aberta'}</Text>
            </View>
          </View>
          <View style={cd.topoAcoes}>
            <TouchableOpacity style={cd.topoIconBtn} onPress={() => setMostrarInfoClube(true)}>
              <Ionicons name="information-circle-outline" size={22} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity style={cd.topoIconBtn} onPress={() => setMenuVisivel(true)}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top + 10}
        >
          <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={[cd.capa, { backgroundColor: corA }]}>
              {fotoClube ? (
                <TouchableOpacity style={cd.capaToque} activeOpacity={0.9} onPress={() => setFotoAberta(true)}>
                  <Image source={{ uri: fotoClube }} style={cd.capaImagem} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                <Text style={cd.capaEmoji}>{AREAS.find(a => a.id === clube.area)?.label?.split(' ')[0] || '📚'}</Text>
              )}
              {enviandoFoto && (
                <View style={cd.capaOverlay}><ActivityIndicator color="#fff" /></View>
              )}
              {souAdmin && !enviandoFoto && (
                <TouchableOpacity style={cd.capaEditarBadge} onPress={alterarFotoClube}>
                  <Ionicons name="camera" size={13} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <Modal visible={fotoAberta} transparent animationType="fade" onRequestClose={() => setFotoAberta(false)}>
              <View style={cd.fotoViewer}>
                <TouchableOpacity style={cd.fotoViewerFechar} onPress={() => setFotoAberta(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Image source={{ uri: fotoClube }} style={cd.fotoViewerImagem} resizeMode="contain" />
                <TouchableOpacity style={cd.fotoViewerGuardar} onPress={guardarFotoClube} disabled={aGuardarFoto}>
                  {aGuardarFoto ? <ActivityIndicator color="#fff" /> : <><Ionicons name="download-outline" size={20} color="#fff" /><Text style={cd.fotoViewerGuardarTxt}>Guardar foto</Text></>}
                </TouchableOpacity>
              </View>
            </Modal>

            <View style={cd.info}>
              <View style={cd.tituloRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cd.titulo}>{clube.titulo}</Text>
                  <View style={cd.areaBadge}>
                    <Text style={cd.areaBadgeTxt}>{AREAS.find(a => a.id === clube.area)?.label || clube.area}</Text>
                  </View>
                </View>
                <View style={cd.clubVerified}>
                  <Ionicons name="school-outline" size={17} color={corA} />
                </View>
              </View>

              {clube.descricao ? <Text style={cd.desc}>{clube.descricao}</Text> : null}

              <View style={cd.metricCards}>
                <View style={cd.metricCard}>
                  <Ionicons name="people-outline" size={18} color={corA} />
                  <Text style={cd.metricValue}>{clube.membrosCount || 0}</Text>
                  <Text style={cd.metricLabel}>Membros</Text>
                </View>
                <View style={cd.metricCard}>
                  <Ionicons name="chatbubbles-outline" size={18} color={corA} />
                  <Text style={cd.metricValue}>{posts.length}</Text>
                  <Text style={cd.metricLabel}>Publicações</Text>
                </View>
                <View style={cd.metricCard}>
                  <Ionicons name="person-circle-outline" size={18} color={corA} />
                  <Text style={cd.metricValue} numberOfLines={1}>{clube.criadorNome?.split(' ')[0] || 'Admin'}</Text>
                  <Text style={cd.metricLabel}>Criador</Text>
                </View>
              </View>

              <View style={cd.actionRow}>
                {souMembro ? (
                  <TouchableOpacity style={[cd.primaryAction, { backgroundColor: corA }]} onPress={() => setSubTab('posts')} disabled={processando}>
                    <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                    <Text style={cd.primaryActionTxt}>Membro</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[cd.primaryAction, { backgroundColor: corA }]} onPress={aderir} disabled={processando}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={cd.primaryActionTxt}>{processando ? 'A aderir...' : 'Aderir ao clube'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={cd.secondaryAction} onPress={partilharClube}>
                  <Ionicons name="share-social-outline" size={17} color="#374151" />
                  <Text style={cd.secondaryActionTxt}>Partilhar</Text>
                </TouchableOpacity>
                {souMembro && clube.criadorUid !== meuUid && (
                  <TouchableOpacity style={cd.iconAction} onPress={sair} disabled={processando}>
                    <Ionicons name="exit-outline" size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={cd.subTabs}>
              {[
                { id: 'posts', icon: 'newspaper-outline', label: 'Publicações', count: posts.length },
                { id: 'membros', icon: 'people-outline', label: 'Membros', count: membros.length },
              ].map(t => (
                <TouchableOpacity key={t.id} style={[cd.subTab, subTab === t.id && cd.subTabActiva]} onPress={() => setSubTab(t.id)}>
                  <Ionicons name={t.icon} size={16} color={subTab === t.id ? corA : '#9CA3AF'} />
                  <Text style={[cd.subTabTxt, subTab === t.id && { color: corA, fontWeight: '800' }]}>{t.label}</Text>
                  <View style={[cd.tabCount, subTab === t.id && { backgroundColor: corA }]}>
                    <Text style={[cd.tabCountTxt, subTab === t.id && { color: '#fff' }]}>{t.count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {subTab === 'posts' ? (
              <View style={cd.corpo}>
                {souMembro && (
                  <View style={[cd.welcomeStrip, { borderLeftColor: corA, backgroundColor: `${corA}12` }]}>
                    <View style={[cd.welcomeIcon, { backgroundColor: `${corA}20` }]}>
                      <Ionicons name="sparkles-outline" size={18} color={corA} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={cd.welcomeTitle}>Espaço de aprendizagem</Text>
                      <Text style={cd.welcomeText}>Partilha ideias, materiais, dúvidas e experiências com a comunidade.</Text>
                    </View>
                  </View>
                )}
                {souMembro && (
                  <View
                    style={cd.novoPostBox}
                    onLayout={e => { posicaoNovoPost.current = e.nativeEvent.layout.y; }}
                  >
                    <TextInput
                      style={cd.novoPostInput}
                      placeholder="Partilha algo com o clube..."
                      value={novoPost}
                      onChangeText={setNovoPost}
                      onFocus={focarNovoPost}
                      multiline
                      maxLength={500}
                    />

                    {!!imagemPostLocal && (
                      <View style={na.anexoPreview}>
                        <Image
                          source={{ uri: imagemPostLocal }}
                          style={[na.anexoImg, dimensoesImagemPost?.largura && dimensoesImagemPost?.altura && { aspectRatio: dimensoesImagemPost.largura / dimensoesImagemPost.altura }]}
                          resizeMode="contain"
                        />
                        <Text style={na.anexoTxt}>Imagem anexada</Text>
                        <TouchableOpacity style={na.anexoRemover} onPress={() => { setImagemPostLocal(null); setDimensoesImagemPost(null); }}>
                          <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {gravadorPost.gravando && (
                      <View style={na.gravandoBox}>
                        <View style={na.gravandoDot} />
                        <Text style={na.gravandoTxt}>A gravar nota de voz... {formatarDuracao(gravadorPost.duracaoSeg)}</Text>
                        <TouchableOpacity onPress={gravadorPost.cancelarGravacao}>
                          <Ionicons name="trash-outline" size={18} color="#991B1B" />
                        </TouchableOpacity>
                      </View>
                    )}
                    {!gravadorPost.gravando && !!gravadorPost.audioUri && (
                      <View style={na.anexoPreview}>
                        <PlayerAudio uri={gravadorPost.audioUri} />
                        <Text style={na.anexoTxt}>{formatarDuracao(gravadorPost.duracaoSeg)}</Text>
                        <TouchableOpacity style={na.anexoRemover} onPress={gravadorPost.descartarAudio}>
                          <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={na.acoesRow}>
                        <TouchableOpacity style={na.acaoIcon} onPress={escolherImagemPost} disabled={gravadorPost.gravando}>
                          <Ionicons name="image-outline" size={21} color={gravadorPost.gravando ? '#D1D5DB' : '#6B7280'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={na.acaoIcon}
                          onPress={gravadorPost.gravando ? gravadorPost.pararGravacao : gravadorPost.iniciarGravacao}
                        >
                          <Ionicons name={gravadorPost.gravando ? 'stop-circle' : 'mic-outline'} size={22} color={gravadorPost.gravando ? '#DC2626' : '#6B7280'} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[cd.novoPostBtn, (!novoPost.trim() && !imagemPostLocal && !gravadorPost.audioUri || publicando || gravadorPost.gravando) && { opacity: 0.4 }]}
                        onPress={publicar}
                        disabled={(!novoPost.trim() && !imagemPostLocal && !gravadorPost.audioUri) || publicando || gravadorPost.gravando}
                      >
                        <Text style={cd.novoPostBtnTxt}>{publicando ? 'A publicar...' : 'Publicar'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {posts.length === 0 ? (
                  <View style={cd.vazio}>
                    <Ionicons name="chatbubbles-outline" size={34} color="#D1D5DB" />
                    <Text style={cd.vazioTxt}>Ainda sem publicações. Sê o primeiro a partilhar!</Text>
                  </View>
                ) : posts.map(p => (
                  <PostClube
                    key={p.id}
                    clubeId={clubeId}
                    clubeTitulo={clube.titulo}
                    post={p}
                    meuUid={meuUid}
                    meuPerfil={meuPerfil}
                    souMembro={souMembro}
                    podeApagarPost={p.autorUid === meuUid || souAdmin}
                    onApagar={apagarPost}
                    onFocarComentario={() => focarComentarioDe(p.id)}
                    onLayoutPost={registarPosicaoPost}
                  />
                ))}
              </View>
            ) : (
              <View style={cd.corpo}>
                <View style={cd.membrosIntro}>
                  <View>
                    <Text style={cd.membrosTitulo}>Comunidade</Text>
                    <Text style={cd.membrosSub}>{membros.length} pessoas fazem parte deste clube</Text>
                  </View>
                  <View style={[cd.membrosCountBadge, { backgroundColor: `${corA}16` }]}>
                    <Ionicons name="people" size={16} color={corA} />
                    <Text style={[cd.membrosCountTxt, { color: corA }]}>{membros.length}</Text>
                  </View>
                </View>
                <View style={cd.membrosBusca}>
                  <Ionicons name="search-outline" size={17} color="#9CA3AF" />
                  <TextInput
                    style={cd.membrosBuscaInput}
                    placeholder="Pesquisar membro..."
                    placeholderTextColor="#9CA3AF"
                    value={membrosBusca}
                    onChangeText={setMembrosBusca}
                  />
                  {!!membrosBusca && (
                    <TouchableOpacity onPress={() => setMembrosBusca('')}>
                      <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
                {membrosFiltrados.length === 0 ? (
                  <View style={cd.emptyMembers}>
                    <Ionicons name="person-outline" size={30} color="#D1D5DB" />
                    <Text style={cd.emptyMembersTxt}>Nenhum membro encontrado.</Text>
                  </View>
                ) : membrosFiltrados.map((m, index) => (
                  <View key={m.uid} style={cd.membroCard}>
                    <Avatar uri={m.foto} nome={m.nome} size={46} />
                    <View style={{ flex: 1 }}>
                      <View style={cd.memberNameRow}>
                        <Text style={cd.membroNome}>{m.nome}</Text>
                        {m.uid === clube.criadorUid && <Ionicons name="ribbon-outline" size={15} color={corA} />}
                      </View>
                      <Text style={[cd.memberRole, m.role === 'admin' && { color: corA }]}>
                        {m.role === 'admin' ? 'Administrador' : 'Membro da comunidade'}
                      </Text>
                    </View>
                    <Text style={cd.memberIndex}>#{index + 1}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

        <Modal visible={mostrarInfoClube} transparent animationType="fade" onRequestClose={() => setMostrarInfoClube(false)}>
        <View style={cd.infoOverlay}>
          <View style={cd.infoModal}>
            <View style={cd.infoModalTop}>
              <View style={[cd.infoModalIcon, { backgroundColor: `${corA}16` }]}>
                <Ionicons name="school-outline" size={24} color={corA} />
              </View>
              <TouchableOpacity onPress={() => setMostrarInfoClube(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={cd.infoModalTitle}>Sobre este clube</Text>
            <Text style={cd.infoModalDesc}>{clube.descricao || 'Uma comunidade criada para aprender, trocar conhecimento e crescer em conjunto.'}</Text>
            <View style={cd.infoInfoRow}><Ionicons name="pricetag-outline" size={17} color={corA} /><Text style={cd.infoInfoTxt}>Área: {AREAS.find(a => a.id === clube.area)?.label || clube.area}</Text></View>
            <View style={cd.infoInfoRow}><Ionicons name="person-outline" size={17} color={corA} /><Text style={cd.infoInfoTxt}>Criado por {clube.criadorNome || 'Utilizador'}</Text></View>
            <View style={cd.infoInfoRow}><Ionicons name="people-outline" size={17} color={corA} /><Text style={cd.infoInfoTxt}>{clube.membrosCount || 0} membros</Text></View>
            <View style={cd.infoInfoRow}><Ionicons name="shield-checkmark-outline" size={17} color={corA} /><Text style={cd.infoInfoTxt}>Comunidade moderada e colaborativa</Text></View>
            <TouchableOpacity style={[cd.infoModalBtn, { backgroundColor: corA }]} onPress={() => setMostrarInfoClube(false)}>
              <Text style={cd.infoModalBtnTxt}>Continuar no clube</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MenuAcoes visivel={menuVisivel} onFechar={() => setMenuVisivel(false)} titulo={clube.titulo} opcoes={opcoesMenuClube} />

      <ModalEditarClube
        visivel={editarVisivel}
        onFechar={() => setEditarVisivel(false)}
        clube={clube}
      />
    </Modal>
  );
}

// ── Modal Editar Clube (apenas administradores) ───────────────────────────────
function ModalEditarClube({ visivel, onFechar, clube }) {
  const [titulo,    setTitulo]    = useState(clube?.titulo || '');
  const [descricao, setDescricao] = useState(clube?.descricao || '');
  const [area,      setArea]      = useState(clube?.area || 'tecnologia');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visivel && clube) {
      setTitulo(clube.titulo || '');
      setDescricao(clube.descricao || '');
      setArea(clube.area || 'tecnologia');
    }
  }, [visivel, clube]);

  const guardar = async () => {
    if (!titulo.trim()) { Alert.alert('Campo obrigatório', 'Introduz um título.'); return; }
    setGuardando(true);
    try {
      await updateDoc(doc(db, 'clubes', clube.id), {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        area,
      });
      onFechar();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível guardar as alterações.');
    } finally { setGuardando(false); }
  };

  if (!clube) return null;

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={mc.container} edges={['top', 'bottom']}>
        <View style={mc.header}>
          <TouchableOpacity onPress={onFechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={mc.cancelar}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={mc.titulo}>Editar Clube</Text>
          <TouchableOpacity onPress={guardar} disabled={guardando} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[mc.criar, guardando && { opacity: 0.4 }]}>{guardando ? 'A guardar...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={60}>
          <ScrollView contentContainerStyle={mc.scroll} keyboardShouldPersistTaps="handled">
            <Text style={mc.label}>Título *</Text>
            <TextInput style={mc.input} value={titulo} onChangeText={setTitulo} placeholder="Ex: Inovadores de Angola" maxLength={60} />

            <Text style={mc.label}>Descrição</Text>
            <TextInput
              style={[mc.input, mc.inputArea]}
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Sobre o que é este clube?"
              multiline
              maxLength={280}
            />

            <Text style={mc.label}>Área</Text>
            <SeletorArea area={area} onChange={setArea} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const cd = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F8FAFC' },
  topo:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  topoIconBtn:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  topoCentro:    { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  topoTitulo:    { maxWidth: '90%', fontSize: 14, fontWeight: '800', color: '#111827' },
  topoEstado:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  estadoDot:     { width: 6, height: 6, borderRadius: 3 },
  topoEstadoTxt: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  topoAcoes:     { flexDirection: 'row', gap: 5 },
  capa:          { height: 210, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  capaToque:     { flex: 1, width: '100%' },
  capaEmoji:     { fontSize: 44 },
  capaImagem:    { width: '100%', height: '100%' },
  capaOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  capaEditarBadge:{ position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  fotoViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  fotoViewerImagem: { width: '100%', height: '78%' },
  fotoViewerFechar: { position: 'absolute', top: 48, right: 18, zIndex: 2, padding: 8 },
  fotoViewerGuardar: { position: 'absolute', bottom: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1677F2', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  fotoViewerGuardarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  info:          { padding: 18, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  tituloRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titulo:        { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.3 },
  area:          { fontSize: 13, color: '#6B7280' },
  areaBadge:     { alignSelf: 'flex-start', marginTop: 7, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  areaBadgeTxt:  { fontSize: 11, color: '#4B5563', fontWeight: '700' },
  clubVerified:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB' },
  desc:          { fontSize: 14, color: '#4B5563', lineHeight: 21, marginTop: 14 },
  metricCards:   { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard:    { flex: 1, minHeight: 76, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#EEF0F3' },
  metricValue:   { fontSize: 15, fontWeight: '900', color: '#111827', marginTop: 5 },
  metricLabel:   { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },
  actionRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  primaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, paddingVertical: 12 },
  primaryActionTxt:{ color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryAction:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12 },
  secondaryActionTxt:{ color: '#374151', fontSize: 13, fontWeight: '700' },
  iconAction:    { width: 42, height: 42, borderRadius: 13, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  btnAderir:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1677F2', borderRadius: 14, paddingVertical: 12, marginTop: 12 },
  btnAderirTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnSair:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 12, marginTop: 12 },
  btnSairTxt:    { color: '#374151', fontWeight: '700', fontSize: 14 },
  subTabs:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  subTab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  subTabActiva:  { borderBottomColor: '#1677F2' },
  subTabTxt:     { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  subTabTxtActiva:{ color: '#1677F2', fontWeight: '800' },
  tabCount:      { minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 5 },
  tabCountTxt:   { fontSize: 9, fontWeight: '800', color: '#6B7280' },
  corpo:         { padding: 16, gap: 14 },
  novoPostBox:   { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 12, gap: 8 },
  novoPostInput: { fontSize: 14, color: '#111827', minHeight: 44, textAlignVertical: 'top' },
  novoPostBtn:   { alignSelf: 'flex-end', backgroundColor: '#1677F2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  novoPostBtnTxt:{ color: '#fff', fontWeight: '700', fontSize: 12 },
  vazio:         { alignItems: 'center', paddingVertical: 40, gap: 10 },
  vazioTxt:      { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 30 },
  post:          { flexDirection: 'row', gap: 10 },
  postHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postAutor:     { fontSize: 13, fontWeight: '700', color: '#111827' },
  postTexto:     { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 2 },
  postImagem:    { width: '100%', aspectRatio: 1.5, borderRadius: 14, marginTop: 6, backgroundColor: '#F3F4F6' },
  postAcoes:     { flexDirection: 'row', gap: 18, marginTop: 8 },
  postAcaoBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postAcaoTxt:   { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  repostOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  repostSheet: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 12 },
  repostTituloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repostTitulo: { fontSize: 17, fontWeight: '800', color: '#111827' },
  repostInput: { minHeight: 92, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', textAlignVertical: 'top' },
  repostPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F0FDF4', borderRadius: 10 },
  repostPreviewTxt: { flex: 1, fontSize: 12, color: '#374151' },
  repostBtns: { flexDirection: 'row', gap: 10 },
  repostCancelar: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#F3F4F6', borderRadius: 10 },
  repostCancelarTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
  repostConfirmar: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#059669', borderRadius: 10 },
  repostConfirmarTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  comentariosBox:    { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 10 },
  comentarioLinha:   { flexDirection: 'row', gap: 8 },
  comentarioHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  comentarioAutor:   { fontSize: 12, fontWeight: '700', color: '#111827' },
  comentarioTexto:   { fontSize: 13, color: '#374151', lineHeight: 18, marginTop: 1 },
  comentarioImagem:  { width: 140, height: 100, borderRadius: 10, marginTop: 4, backgroundColor: '#F3F4F6' },
  comentarioInputRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 2 },
  comentarioInput:   { flex: 1, fontSize: 13, color: '#111827' },
  membroLinha:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  membroNome:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  membroAdmin:   { fontSize: 11, color: '#1677F2', fontWeight: '700', marginTop: 2 },
  welcomeStrip:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderLeftWidth: 3 },
  welcomeIcon:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle:  { fontSize: 12, fontWeight: '800', color: '#111827' },
  welcomeText:   { fontSize: 11, color: '#6B7280', lineHeight: 16, marginTop: 2 },
  membrosIntro:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  membrosTitulo: { fontSize: 18, fontWeight: '900', color: '#111827' },
  membrosSub:    { fontSize: 12, color: '#6B7280', marginTop: 2 },
  membrosCountBadge:{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 1 },
  membrosCountTxt:{ fontSize: 12, fontWeight: '900' },
  membrosBusca:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 4 },
  membrosBuscaInput:{ flex: 1, fontSize: 13, color: '#111827' },
  membroCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#EEF0F3' },
  memberNameRow:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  memberRole:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 3 },
  memberIndex:  { fontSize: 10, color: '#D1D5DB', fontWeight: '800' },
  emptyMembers: { alignItems: 'center', justifyContent: 'center', paddingVertical: 35, gap: 8 },
  emptyMembersTxt:{ fontSize: 12, color: '#9CA3AF' },
  infoOverlay:  { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  infoModal:    { width: '100%', backgroundColor: '#fff', borderRadius: 22, padding: 20, gap: 10 },
  infoModalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoModalIcon:{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  infoModalTitle:{ fontSize: 20, fontWeight: '900', color: '#111827', marginTop: 4 },
  infoModalDesc:{ fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 4 },
  infoInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  infoInfoTxt: { flex: 1, fontSize: 12, color: '#374151', fontWeight: '600' },
  infoModalBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingVertical: 12, marginTop: 6 },
  infoModalBtnTxt:{ color: '#fff', fontSize: 13, fontWeight: '800' },
});

// ── Modal Sala Activa ─────────────────────────────────────────────────────────
function ModalSalaActiva({ salaId, onFechar, meuUid, meuPerfil, foiCriador }) {
  const [sala,          setSala]          = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [token,         setToken]         = useState(null);
  const [tokenErr,      setTokenErr]      = useState(false);
  const [entrou,        setEntrou]        = useState(false);
  const [convidarVis,   setConvidarVis]   = useState(false);
  const [codigoVis,     setCodigoVis]     = useState(false);
  const [copiado,       setCopiado]       = useState(false);
  const insets = useSafeAreaInsets();

  const eu          = participantes.find(p => p.uid === meuUid);
  const meuRole     = eu?.role || 'ouvinte';
  const souHost     = meuRole === 'host';
  const souOrador   = meuRole === 'host' || meuRole === 'orador';

  const hostsOradores  = participantes.filter(p => p.role === 'host' || p.role === 'orador');
  const ouvintes       = participantes.filter(p => p.role === 'ouvinte');
  const pedidosPalavra = ouvintes.filter(p => p.pedindoPalavra);

  const { falam, mutarMic, ligado } = useAgoraRTC({
    ativo: entrou && !!token,
    salaId, token, uid: meuUid, role: meuRole,
  });

  useEffect(() => {
    if (foiCriador && token && !entrou) setEntrou(true);
  }, [foiCriador, token]);

  useEffect(() => {
    if (!salaId || !meuUid) return;
    (async () => {
      try {
        const functions  = getFunctions(app, 'europe-west1');
        const gerarToken = httpsCallable(functions, 'gerarTokenAgora');
        const numUid     = Math.abs(meuUid.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000;
        const { data }   = await gerarToken({ channelName: salaId, uid: numUid });
        if (data?.token) setToken(data.token);
        else setTokenErr(true);
      } catch (e) { console.warn('[Token]', e); setTokenErr(true); }
    })();
  }, [salaId, meuUid]);

  useEffect(() => {
    if (!salaId) return;
    const unsubSala = onSnapshot(doc(db, 'salas', salaId), snap => {
      if (!snap.exists() || snap.data()?.ativa === false) { onFechar(); return; }
      setSala({ id: snap.id, ...snap.data() });
    });
    const unsubPart = onSnapshot(
      collection(db, 'salas', salaId, 'participantes'),
      snap => setParticipantes(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    );
    return () => { unsubSala(); unsubPart(); };
  }, [salaId]);

  const entrarNaSala = async () => {
    setEntrou(true);
    if (!foiCriador) {
      await setDoc(doc(db, 'salas', salaId, 'participantes', meuUid), {
        uid: meuUid, nome: meuPerfil?.nome || 'Utilizador',
        foto: meuPerfil?.fotoURL || null, role: 'ouvinte',
        micAtivo: false, pedindoPalavra: false, entradoEm: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }
  };

  const sair = () => {
    Alert.alert(
      'Sair da sala',
      souHost ? 'Queres fechar a sala para todos ou apenas sair?' : 'Tens a certeza?',
      souHost
        ? [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apenas sair', onPress: sairSemFechar },
            { text: 'Fechar sala', style: 'destructive', onPress: fecharSala },
          ]
        : [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sair', style: 'destructive', onPress: sairSemFechar },
          ]
    );
  };

  const sairSemFechar = async () => {
    await deleteDoc(doc(db, 'salas', salaId, 'participantes', meuUid)).catch(() => {});
    setTimeout(async () => {
      const snap = await getDocs(collection(db, 'salas', salaId, 'participantes')).catch(() => null);
      if (snap && snap.empty) {
        await updateDoc(doc(db, 'salas', salaId), { ativa: false }).catch(() => {});
      }
    }, 2000);
    onFechar();
  };

  const fecharSala = async () => {
    await updateDoc(doc(db, 'salas', salaId), { ativa: false }).catch(() => {});
    onFechar();
  };

  const toggleMic = async () => {
    if (!eu) return;
    const novo = !eu.micAtivo;
    mutarMic(!novo);
    await updateDoc(doc(db, 'salas', salaId, 'participantes', meuUid), { micAtivo: novo }).catch(() => {});
  };

  const pedirPalavra = async () => {
    if (!eu) return;
    await updateDoc(doc(db, 'salas', salaId, 'participantes', meuUid), { pedindoPalavra: !eu.pedindoPalavra }).catch(() => {});
  };

  const aceitarPalavra = async (uid) => {
    await updateDoc(doc(db, 'salas', salaId, 'participantes', uid), { role: 'orador', micAtivo: true, pedindoPalavra: false }).catch(() => {});
    await updateDoc(doc(db, 'salas', salaId), { microfones: hostsOradores.length + 1 }).catch(() => {});
  };

  const rebaixar = async (uid) => {
    await updateDoc(doc(db, 'salas', salaId, 'participantes', uid), { role: 'ouvinte', micAtivo: false }).catch(() => {});
    await updateDoc(doc(db, 'salas', salaId), { microfones: Math.max(1, hostsOradores.length - 1) }).catch(() => {});
  };

  const convidarOrador  = async (uid) => { await updateDoc(doc(db, 'salas', salaId, 'participantes', uid), { convidadoParaOrador: true, pedindoPalavra: false }).catch(() => {}); };
  const aceitarConvite  = async ()    => {
    await updateDoc(doc(db, 'salas', salaId, 'participantes', meuUid), { role: 'orador', micAtivo: true, convidadoParaOrador: false }).catch(() => {});
    await updateDoc(doc(db, 'salas', salaId), { microfones: hostsOradores.length + 1 }).catch(() => {});
  };

  const copiarCodigoSala = async () => {
    if (!sala?.codigoConvite) return;
    await Clipboard.setStringAsync(
      `Convite para sala privada na Feira do Saber (ConnectAll Angola).\n\nCódigo: ${sala.codigoConvite}\n\nAbre a app → Comunidade → Feira do Saber → "Entrar com código"`
    );
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const partilharCodigoSala = async () => {
    if (!sala?.codigoConvite) return;
    await Share.share({
      message: `Convite para sala privada na Feira do Saber (ConnectAll Angola).\n\nCódigo: ${sala.codigoConvite}\n\nAbre a app → Comunidade → Feira do Saber → "Entrar com código"`,
      title: 'Convite Sala Privada',
    });
  };

  if (!entrou) return <BoasVindasSala onEntrar={entrarNaSala} />;
  if (!sala)   return null;

  const foiConvidado = eu?.convidadoParaOrador === true;

  return (
    <Modal visible={!!salaId} animationType="slide" presentationStyle="fullScreen" onRequestClose={sair}>
      <View style={sa.safe}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: BEGE }}>
          <View style={sa.header}>
            <TouchableOpacity style={sa.sairBtn} onPress={sair} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="call" size={18} color="#E53935" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={sa.sairTxt}>Sair</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {/* Botão código (só anfitrião de sala privada) */}
            {souHost && sala?.privada && (
              <TouchableOpacity style={sa.headerIconBtn} onPress={() => setCodigoVis(true)}>
                <Ionicons name="key-outline" size={22} color="#1677F2" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={sa.headerIconBtn}>
              <Ionicons name="information-circle-outline" size={22} color="#333" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[sa.scroll, { paddingBottom: 180 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={sa.salaTitulo}>{sala.titulo}</Text>
            {sala.privada && (
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#BFDBFE' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1677F2' }}>🔒 Privada</Text>
              </View>
            )}
          </View>
          {sala.descricao ? <Text style={sa.salaDesc}>{sala.descricao}</Text> : null}
          <View style={sa.areaRow}>
            <Text style={sa.areaEmoji}>🌍</Text>
            <Text style={sa.areaTxt}>{AREAS.find(a => a.id === sala.area)?.label?.replace(/^\S+\s/, '') || sala.area}</Text>
          </View>

          <Text style={sa.secTitulo}>ANFITRIÕES E ORADORES</Text>
          <View style={sa.gridPalco}>
            {hostsOradores.map(p => (
              <TouchableOpacity
                key={p.uid}
                style={sa.avatarWrap}
                onLongPress={() => {
                  if (!souHost || p.uid === meuUid || p.role === 'host') return;
                  Alert.alert(p.nome, '', [
                    { text: '⬇️ Mover para ouvintes', onPress: () => rebaixar(p.uid), style: 'destructive' },
                    { text: 'Cancelar', style: 'cancel' },
                  ]);
                }}
              >
                <View style={sa.avatarRelativo}>
                  <Avatar uri={p.foto} nome={p.nome} size={80} falando={!!falam[p.uid] && p.micAtivo} />
                  <View style={[sa.micBadge, { backgroundColor: p.micAtivo ? '#4CAF50' : '#9E9E9E' }]}>
                    <Ionicons name={p.micAtivo ? 'mic' : 'mic-off'} size={12} color="#fff" />
                  </View>
                </View>
                <Text style={sa.avatarNome} numberOfLines={1}>{p.nome?.split(' ')[0]}</Text>
                {p.role === 'host' && <Text style={sa.hostLabel}>Anfitrião</Text>}
              </TouchableOpacity>
            ))}
          </View>

          <View style={sa.ouvintesSec}>
            <Text style={sa.secTitulo}>OUVINTES · {ouvintes.length}</Text>
            <View style={sa.gridOuvintes}>
              {ouvintes.map(p => (
                <TouchableOpacity
                  key={p.uid}
                  style={sa.avatarWrapSmall}
                  onPress={() => {
                    if (!souOrador || p.uid === meuUid) return;
                    const ops = [];
                    if (p.pedindoPalavra) ops.push({ text: '✅ Aceitar pedido de palavra', onPress: () => aceitarPalavra(p.uid) });
                    if (!p.convidadoParaOrador) ops.push({ text: '🎤 Convidar para falar', onPress: () => convidarOrador(p.uid) });
                    ops.push({ text: 'Cancelar', style: 'cancel' });
                    Alert.alert(p.nome, '', ops);
                  }}
                >
                  <View style={sa.avatarRelativo}>
                    <Avatar uri={p.foto} nome={p.nome} size={52} />
                    {p.pedindoPalavra && <View style={sa.maoBadge}><Ionicons name="hand-left" size={12} color="#F59E0B" /></View>}
                    {p.convidadoParaOrador && <View style={sa.convBadge}><Ionicons name="mic" size={11} color="#fff" /></View>}
                  </View>
                  <Text style={sa.avatarNomeSmall} numberOfLines={1}>{p.nome?.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {foiConvidado && (
          <View style={sa.conviteBanner}>
            <View style={{ flex: 1 }}>
              <Text style={sa.conviteTxt}>🎤 Foste convidado para falar!</Text>
              <Text style={sa.conviteSub}>Queres subir ao palco?</Text>
            </View>
            <TouchableOpacity style={sa.conviteAceitar} onPress={aceitarConvite}>
              <Text style={sa.conviteAceitarTxt}>Aceitar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => updateDoc(doc(db, 'salas', salaId, 'participantes', meuUid), { convidadoParaOrador: false }).catch(() => {})}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[sa.barraInferior, { paddingBottom: 20 + insets.bottom }]}>
          <View style={sa.barraLinha1}>
            {souOrador ? (
              <TouchableOpacity style={[sa.ctrlBtn, eu?.micAtivo ? sa.ctrlMicOn : sa.ctrlMicOff]} onPress={toggleMic}>
                <Ionicons name={eu?.micAtivo ? 'mic' : 'mic-off'} size={24} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[sa.ctrlBtn, eu?.pedindoPalavra ? sa.ctrlActivo : sa.ctrlCinza]} onPress={pedirPalavra}>
                <Ionicons name="hand-left" size={24} color={eu?.pedindoPalavra ? '#fff' : '#555'} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[sa.ctrlBtn, sa.ctrlCinza]}>
              <Ionicons name="heart-outline" size={24} color="#555" />
            </TouchableOpacity>
            {souOrador && (
              <TouchableOpacity style={[sa.ctrlBtn, sa.ctrlCinza]} onPress={() => setConvidarVis(true)}>
                <Ionicons name="person-add-outline" size={24} color="#555" />
              </TouchableOpacity>
            )}
            {souHost && (
              <TouchableOpacity style={[sa.ctrlBtn, sa.ctrlFechar]} onPress={fecharSala}>
                <Ionicons name="power" size={24} color="#E53935" />
              </TouchableOpacity>
            )}
          </View>
          <View style={sa.barraLinha2}>
            <Text style={sa.barraLabel}>{souOrador ? (eu?.micAtivo ? 'Mudo' : 'Falar') : (eu?.pedindoPalavra ? 'Cancelar' : 'Pedir')}</Text>
            <Text style={sa.barraLabel}>Reagir</Text>
            {souOrador && <Text style={sa.barraLabel}>Convidar</Text>}
            {souHost   && <Text style={sa.barraLabel}>Fechar</Text>}
          </View>
          <View style={sa.ligacaoRow}>
            <View style={[sa.ligacaoDot, { backgroundColor: ligado ? '#4CAF50' : tokenErr ? '#E53935' : '#FFA000' }]} />
            <Text style={sa.ligacaoTxt}>
              {ligado ? 'Ligado · Áudio activo' : tokenErr ? 'Erro de ligação' : 'A ligar...'}
            </Text>
          </View>
        </View>

        {convidarVis && (
          <View style={[sa.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={sa.sheetHeader}>
              <Text style={sa.sheetTitulo}>CONVIDAR</Text>
              <TouchableOpacity onPress={() => setConvidarVis(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            {pedidosPalavra.length > 0 && (
              <>
                <Text style={sa.sheetSec}>Pediram para falar</Text>
                {pedidosPalavra.map(p => (
                  <SheetLinha key={p.uid} p={p} label="Aceitar"
                    onPress={() => { aceitarPalavra(p.uid); setConvidarVis(false); }} />
                ))}
                <View style={sa.sheetDiv} />
              </>
            )}
            <Text style={sa.sheetSec}>Ouvintes</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {ouvintes.filter(p => !p.pedindoPalavra).map(p => (
                <SheetLinha key={p.uid} p={p}
                  label={p.convidadoParaOrador ? 'Aguarda...' : 'Convidar'}
                  disabled={!!p.convidadoParaOrador}
                  onPress={() => { convidarOrador(p.uid); setConvidarVis(false); }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Modal Código da Sala Privada (só anfitrião) ── */}
        <Modal visible={codigoVis} transparent animationType="fade" onRequestClose={() => setCodigoVis(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="key" size={26} color="#1677F2" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111' }}>Código de Convite</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                Partilha este código para convidar pessoas para a tua sala privada.
              </Text>
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 16, borderWidth: 1.5, borderColor: '#BFDBFE', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#1E3A8A', letterSpacing: 4 }}>{sala?.codigoConvite}</Text>
              </View>
              <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
                O código expira automaticamente quando a sala for encerrada.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: copiado ? '#D1FAE5' : '#EFF6FF', borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: copiado ? '#10B981' : '#BFDBFE' }}
                  onPress={copiarCodigoSala}
                >
                  <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={16} color={copiado ? '#10B981' : '#1677F2'} />
                  <Text style={{ color: copiado ? '#10B981' : '#1677F2', fontWeight: '700', fontSize: 13 }}>{copiado ? 'Copiado!' : 'Copiar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: '#22C55E' }}
                  onPress={partilharCodigoSala}
                >
                  <Ionicons name="share-social-outline" size={16} color="#22C55E" />
                  <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 13 }}>Partilhar</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={{ paddingVertical: 8 }} onPress={() => setCodigoVis(false)}>
                <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function SheetLinha({ p, label, onPress, disabled }) {
  return (
    <TouchableOpacity style={sa.sheetLinha} onPress={onPress} disabled={disabled}>
      <Avatar uri={p.foto} nome={p.nome} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={sa.sheetNome}>{p.nome}</Text>
        {p.pedindoPalavra && <Text style={sa.sheetPediu}>✋ Pediu para falar</Text>}
      </View>
      <View style={[sa.sheetBtnMic, disabled && { backgroundColor: '#F3F4F6' }]}>
        <Ionicons name="mic" size={14} color={disabled ? '#9CA3AF' : '#1677F2'} />
        <Text style={[sa.sheetBtnMicTxt, disabled && { color: '#9CA3AF' }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const sa = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: BEGE },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: BEGE },
  sairBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4 },
  sairTxt:     { color: '#E53935', fontSize: 16, fontWeight: '700' },
  headerIconBtn: { padding: 8 },
  scroll:      { paddingHorizontal: 20, paddingTop: 8 },
  salaTitulo:  { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  salaDesc:    { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 10 },
  areaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  areaEmoji:   { fontSize: 16 },
  areaTxt:     { fontSize: 14, color: '#333', fontWeight: '500' },
  secTitulo:   { fontSize: 13, fontWeight: '800', color: '#1A1A1A', letterSpacing: 0.5, marginBottom: 16, marginTop: 8 },
  gridPalco:   { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 28 },
  ouvintesSec: { borderTopWidth: 1, borderTopColor: '#E0D8D0', paddingTop: 16 },
  gridOuvintes:{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  avatarWrap:      { alignItems: 'center', width: 88 },
  avatarWrapSmall: { alignItems: 'center', width: 66 },
  avatarRelativo:  { position: 'relative' },
  avatarNome:      { fontSize: 13, color: '#333', fontWeight: '600', marginTop: 8, textAlign: 'center' },
  avatarNomeSmall: { fontSize: 11, color: '#555', marginTop: 5, textAlign: 'center' },
  hostLabel:       { fontSize: 10, color: '#1677F2', fontWeight: '700', marginTop: 2 },
  micBadge:  { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BEGE },
  maoBadge:  { position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDD835' },
  convBadge: { position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center' },
  barraInferior: { backgroundColor: BEGE, paddingTop: 12, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: '#E0D8D0' },
  barraLinha1: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 8 },
  barraLinha2: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 10 },
  barraLabel:  { width: 64, textAlign: 'center', fontSize: 11, color: '#6B7280' },
  ctrlBtn:     { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E2DC' },
  ctrlMicOn:   { backgroundColor: '#4CAF50' },
  ctrlMicOff:  { backgroundColor: '#9E9E9E' },
  ctrlActivo:  { backgroundColor: '#F59E0B' },
  ctrlCinza:   { backgroundColor: '#E8E2DC' },
  ctrlFechar:  { backgroundColor: '#FEE2E2' },
  ligacaoRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ligacaoDot:  { width: 8, height: 8, borderRadius: 4 },
  ligacaoTxt:  { fontSize: 11, color: '#9CA3AF' },
  conviteBanner: { position: 'absolute', bottom: 140, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, borderLeftWidth: 4, borderLeftColor: '#1677F2' },
  conviteTxt:        { fontSize: 14, fontWeight: '700', color: '#111827' },
  conviteSub:        { fontSize: 12, color: '#6B7280', marginTop: 2 },
  conviteAceitar:    { backgroundColor: '#1677F2', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  conviteAceitarTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 16, maxHeight: '65%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 16 },
  sheetHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitulo:    { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  sheetSec:       { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 8, marginTop: 4 },
  sheetDiv:       { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  sheetLinha:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  sheetNome:      { fontSize: 14, fontWeight: '600', color: '#111827' },
  sheetPediu:     { fontSize: 12, color: '#D97706', marginTop: 2 },
  sheetBtnMic:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  sheetBtnMicTxt: { fontSize: 12, color: '#1677F2', fontWeight: '700' },
});

// ── ECRÃ PRINCIPAL ────────────────────────────────────────────────────────────
export default function SaberScreen() {
  const { user, perfil } = useUser();
  const isAnonymous = user?.isAnonymous ?? true;
  const router = useRouter();
  const params = useLocalSearchParams();

  const bloqueioAnonimo = () => {
    if (!isAnonymous) return false;
    Alert.alert(
      'Conta necessária',
      'Para participar na Feira do Saber precisas de criar uma conta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Criar conta', onPress: () => router.push('/(auth)/register') },
      ]
    );
    return true;
  };

  const [tabActiva,       setTabActiva]       = useState('feira');
  const [areaActiva,      setAreaActiva]       = useState('todas');
  const [salas,           setSalas]           = useState([]);
  const [modalCriar,      setModalCriar]       = useState(false);
  const [modalCodigo,     setModalCodigo]      = useState(false);
  const [salaAbertaId,    setSalaAbertaId]     = useState(null);
  const [foiCriador,      setFoiCriador]       = useState(false);

  const [clubes,          setClubes]          = useState([]);
  const [modalCriarClube, setModalCriarClube] = useState(false);
  const [clubeAbertoId,   setClubeAbertoId]   = useState(null);
  const [focoPostId,      setFocoPostId]      = useState(null);
  const [aderindoId,      setAderindoId]      = useState(null);
  const [buscaClube,      setBuscaClube]      = useState('');

  useEffect(() => {
    if (!params?.clubeId) return;
    setTabActiva('clube');
    setClubeAbertoId(String(params.clubeId));
    setFocoPostId(params?.postId ? String(params.postId) : null);
  }, [params?.clubeId, params?.postId]);

  // Apenas salas públicas no feed
  useEffect(() => {
    const q = query(
      collection(db, 'salas'),
      where('ativa', '==', true),
      where('privada', '==', false),
      orderBy('criadoEm', 'desc')
    );
    return onSnapshot(q, snap => setSalas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Clubes activos, em tempo real
  // NOTA: a query usa apenas 1 "where" (sem orderBy) de propósito — assim não
  // precisa de um índice composto no Firestore, que é a causa mais comum de
  // clubes criados não aparecerem (a query falha silenciosamente sem índice).
  // A ordenação por mais recente é feita aqui no cliente.
  useEffect(() => {
    const q = query(collection(db, 'clubes'), where('ativo', '==', true));
    return onSnapshot(
      q,
      snap => {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => (b.criadoEm?.toMillis?.() ?? Date.now()) - (a.criadoEm?.toMillis?.() ?? Date.now()));
        setClubes(lista);
      },
      erro => console.warn('[Clubes] Falha ao carregar clubes:', erro?.code, erro?.message)
    );
  }, []);

  const salasFiltradas = areaActiva === 'todas' ? salas : salas.filter(s => s.area === areaActiva);
  const clubesPorArea  = areaActiva === 'todas' ? clubes : clubes.filter(c => c.area === areaActiva);
  const termoBusca     = buscaClube.trim().toLowerCase();
  const clubesFiltrados = !termoBusca
    ? clubesPorArea
    : clubesPorArea.filter(c =>
        c.titulo?.toLowerCase().includes(termoBusca) ||
        c.descricao?.toLowerCase().includes(termoBusca)
      );
  const meusClubes      = clubesFiltrados.filter(c => c.membrosUids?.includes(user?.uid));
  const clubesDescobrir = clubesFiltrados.filter(c => !c.membrosUids?.includes(user?.uid));

  const abrirSala = (id, criou = false) => {
    setFoiCriador(criou);
    setSalaAbertaId(id);
  };

  const aderirClube = async (clubeId) => {
    if (bloqueioAnonimo() || aderindoId) return;
    setAderindoId(clubeId);
    try {
      await updateDoc(doc(db, 'clubes', clubeId), {
        membrosUids: arrayUnion(user.uid),
        membrosCount: increment(1),
      });
      await setDoc(doc(db, 'clubes', clubeId, 'membros', user.uid), {
        uid: user.uid, nome: perfil?.nome || 'Utilizador', foto: perfil?.fotoURL || null,
        role: 'membro', entradoEm: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível aderir ao clube.');
    } finally { setAderindoId(null); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Avatar uri={perfil?.fotoURL} nome={perfil?.nome} size={34} />
        <Text style={styles.title}>
          <Text style={{ color: '#CE1126' }}>Li</Text>
          <Text style={{ color: '#000000' }}>nk</Text>
          <Text style={{ color: '#FCD116' }}>Up</Text>
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Botão entrar com código */}
          <TouchableOpacity
            style={[styles.criarBtn, { backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' }]}
            onPress={() => {
              if (bloqueioAnonimo()) return;
              setModalCodigo(true);
            }}
          >
            <Ionicons name="key-outline" size={16} color="#374151" />
            <Text style={[styles.criarBtnText, { color: '#374151' }]}>Código</Text>
          </TouchableOpacity>
          {/* Botão criar sala ou clube, consoante o separador activo */}
          <TouchableOpacity style={styles.criarBtn} onPress={() => {
            if (bloqueioAnonimo()) return;
            if (tabActiva === 'feira') setModalCriar(true);
            else setModalCriarClube(true);
          }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.criarBtnText}>
              {tabActiva === 'feira' ? 'Criar sala' : 'Criar clube'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        {[{ id: 'feira', label: 'Feira do Saber' }, { id: 'clube', label: 'Clube do Saber' }].map(t => (
          <TouchableOpacity key={t.id} style={[styles.tab, tabActiva === t.id && styles.tabActiva]} onPress={() => setTabActiva(t.id)}>
            <Text style={[styles.tabText, tabActiva === t.id && styles.tabTextActiva]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tabActiva === 'clube' && (
        <View style={styles.buscaRow}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" />
          <TextInput
            style={styles.buscaInput}
            placeholder="Pesquisar clubes por nome..."
            value={buscaClube}
            onChangeText={setBuscaClube}
            returnKeyType="search"
          />
          {buscaClube.length > 0 && (
            <TouchableOpacity onPress={() => setBuscaClube('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow} contentContainerStyle={styles.filtersContent}>
        {AREAS.map(a => (
          <TouchableOpacity key={a.id} style={[styles.chip, areaActiva === a.id && styles.chipActivo]} onPress={() => setAreaActiva(a.id)}>
            <Text style={[styles.chipTxt, areaActiva === a.id && styles.chipTxtActivo]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {tabActiva === 'feira' ? (
          <View style={styles.listGap}>
            {salasFiltradas.length === 0 ? (
              <View style={styles.vazioWrap}>
                <View style={styles.vazioIconWrap}><Ionicons name="mic-outline" size={40} color="#9CA3AF" /></View>
                <Text style={styles.vazioTitulo}>Nenhuma sala activa</Text>
                <Text style={styles.vazioSub}>Sê o primeiro a iniciar uma conversa ao vivo!</Text>
                <TouchableOpacity style={styles.vazioBtn} onPress={() => {
                  if (bloqueioAnonimo()) return;
                  setModalCriar(true);
                }}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.vazioBtnTxt}>Criar sala agora</Text>
                </TouchableOpacity>
              </View>
            ) : salasFiltradas.map(sala => (
              <TouchableOpacity key={sala.id} style={styles.cardFeira} activeOpacity={0.95} onPress={() => {
                if (bloqueioAnonimo()) return;
                abrirSala(sala.id, false);
              }}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardArea}>{AREAS.find(a => a.id === sala.area)?.label || sala.area}</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveTxt}>AO VIVO</Text>
                  </View>
                </View>
                <Text style={styles.cardTitulo}>{sala.titulo}</Text>
                {sala.descricao ? <Text style={styles.cardDesc} numberOfLines={2}>{sala.descricao}</Text> : null}
                <View style={styles.cardFooter}>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Ionicons name="mic-outline" size={13} color="#6B7280" />
                      <Text style={styles.statTxt}>{sala.microfones || 1} falando</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="headset-outline" size={13} color="#6B7280" />
                      <Text style={styles.statTxt}>{sala.ouvintes || 0} ouvindo</Text>
                    </View>
                  </View>
                  <View style={styles.entrarBtn}>
                    <Ionicons name="volume-medium" size={16} color="#1677F2" />
                    <Text style={styles.entrarBtnTxt}>Entrar</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View>
            <View style={styles.clubHero}>
              <View style={styles.clubHeroIcon}>
                <Ionicons name="school-outline" size={24} color="#1677F2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clubHeroTitle}>Clube do Saber</Text>
                <Text style={styles.clubHeroSub}>Aprende, partilha conhecimento e encontra pessoas com os mesmos interesses.</Text>
              </View>
              <View style={styles.clubHeroCount}>
                <Text style={styles.clubHeroCountValue}>{clubes.length}</Text>
                <Text style={styles.clubHeroCountLabel}>clubes</Text>
              </View>
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Seus Clubes 🏡</Text>
              <Text style={styles.sectionSub}>Confira as novidades nos seus Clubes</Text>
            </View>
            {meusClubes.length === 0 ? (
              <View style={[styles.vazioWrap, { paddingVertical: 30 }]}>
                <Text style={styles.vazioSub}>Ainda não aderiste a nenhum clube.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seusClubesScroll}>
                {meusClubes.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.miniClubeCard, { backgroundColor: corDoClube(c.area)[0] }]}
                    onPress={() => { if (bloqueioAnonimo()) return; setClubeAbertoId(c.id); }}
                  >
                    {c.fotoURL && <Image source={{ uri: c.fotoURL }} style={styles.miniClubeImagem} />}
                    <View style={styles.miniClubeOverlay}>
                      <Text style={styles.miniClubeTitulo} numberOfLines={2}>{c.titulo}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Descubra Clubes 🔎</Text>
            </View>
            {clubesDescobrir.length === 0 ? (
              <View style={styles.vazioWrap}>
                <View style={styles.vazioIconWrap}><Ionicons name={termoBusca ? 'search-outline' : 'people-outline'} size={40} color="#9CA3AF" /></View>
                <Text style={styles.vazioTitulo}>{termoBusca ? 'Nenhum clube encontrado' : 'Nenhum clube por aqui'}</Text>
                <Text style={styles.vazioSub}>
                  {termoBusca ? `Não encontrámos clubes para "${buscaClube}".` : 'Sê o primeiro a criar um clube nesta área!'}
                </Text>
                {!termoBusca && (
                  <TouchableOpacity style={styles.vazioBtn} onPress={() => {
                    if (bloqueioAnonimo()) return;
                    setModalCriarClube(true);
                  }}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.vazioBtnTxt}>Criar clube agora</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.listGap}>
                {clubesDescobrir.map(c => (
                  <TouchableOpacity key={c.id} style={styles.cardClube} activeOpacity={0.95} onPress={() => {
                    if (bloqueioAnonimo()) return;
                    setClubeAbertoId(c.id);
                  }}>
                    <View style={[styles.clubeCover, { backgroundColor: corDoClube(c.area)[0], alignItems: 'center', justifyContent: 'center' }]}>
                      {c.fotoURL ? (
                        <Image source={{ uri: c.fotoURL }} style={styles.clubeCoverImagem} />
                      ) : (
                        <Text style={{ fontSize: 40 }}>{AREAS.find(a => a.id === c.area)?.label?.split(' ')[0] || '📚'}</Text>
                      )}
                    </View>
                    <View style={styles.clubeBody}>
                      <Text style={styles.clubeArea}>{AREAS.find(a => a.id === c.area)?.label || c.area} • {c.membrosCount || 0} membros</Text>
                      <Text style={styles.clubeCoverTituloEscuro}>{c.titulo}</Text>
                      {c.descricao ? <Text style={styles.clubeDesc} numberOfLines={2}>{c.descricao}</Text> : null}
                      <TouchableOpacity
                        style={[styles.aderirBtn, aderindoId === c.id && { opacity: 0.5 }]}
                        onPress={() => aderirClube(c.id)}
                        disabled={aderindoId === c.id}
                      >
                        <Ionicons name="add" size={16} color="#1677F2" />
                        <Text style={styles.aderirBtnTxt}>{aderindoId === c.id ? 'A aderir...' : 'Aderir ao clube'}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <ModalCriarSala
        visivel={modalCriar}
        onFechar={() => setModalCriar(false)}
        onCriada={id => abrirSala(id, true)}
        uid={user?.uid}
        perfil={perfil}
      />

      <ModalEntrarComCodigo
        visivel={modalCodigo}
        onFechar={() => setModalCodigo(false)}
        onEntrar={id => abrirSala(id, false)}
      />

      {salaAbertaId && (
        <ModalSalaActiva
          salaId={salaAbertaId}
          onFechar={() => { setSalaAbertaId(null); setFoiCriador(false); }}
          meuUid={user?.uid}
          meuPerfil={perfil}
          foiCriador={foiCriador}
        />
      )}

      <ModalCriarClube
        visivel={modalCriarClube}
        onFechar={() => setModalCriarClube(false)}
        onCriado={id => setClubeAbertoId(id)}
        uid={user?.uid}
        perfil={perfil}
      />

      {clubeAbertoId && (
        <ModalClubeDetalhe
          clubeId={clubeAbertoId}
          focoPostId={focoPostId}
          onFechar={() => { setClubeAbertoId(null); setFocoPostId(null); }}
          meuUid={user?.uid}
          meuPerfil={perfil}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F9FAFB' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  title:         { flex: 1, fontSize: 20, fontWeight: '700', color: '#111827' },
  criarBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1677F2', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 5 },
  criarBtnText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  buscaRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  buscaInput:    { flex: 1, fontSize: 14, color: '#111827' },
  tabs:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab:           { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActiva:     { borderBottomColor: '#111827' },
  tabText:       { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActiva: { color: '#111827', fontWeight: '700' },
  filtersRow:    { paddingVertical: 10, flexGrow: 0 },
  filtersContent:{ paddingHorizontal: 16, gap: 8 },
  chip:          { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipActivo:    { backgroundColor: '#111827' },
  chipTxt:       { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTxtActivo: { color: '#fff', fontWeight: '700' },
  scrollContent: { paddingBottom: 80 },
  clubHero:      { marginHorizontal: 16, marginTop: 10, padding: 15, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8ECF2', flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  clubHeroIcon:  { width: 46, height: 46, borderRadius: 15, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  clubHeroTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  clubHeroSub:   { fontSize: 11, color: '#6B7280', lineHeight: 16, marginTop: 3 },
  clubHeroCount:  { alignItems: 'center', minWidth: 45 },
  clubHeroCountValue:{ fontSize: 18, fontWeight: '900', color: '#1677F2' },
  clubHeroCountLabel:{ fontSize: 9, color: '#9CA3AF', fontWeight: '700' },
  listGap:       { padding: 16, gap: 14 },
  vazioWrap:     { alignItems: 'center', paddingVertical: 60, gap: 14 },
  vazioIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  vazioTitulo:   { fontSize: 18, fontWeight: '700', color: '#111827' },
  vazioSub:      { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20 },
  vazioBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1677F2', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 4 },
  vazioBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardFeira:     { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardArea:      { fontSize: 13, color: '#6B7280' },
  liveBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveTxt:       { fontSize: 11, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 },
  cardTitulo:    { fontSize: 17, fontWeight: '700', color: '#111827', lineHeight: 23 },
  cardDesc:      { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsRow:      { flexDirection: 'row', gap: 12 },
  statItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTxt:       { fontSize: 12, color: '#6B7280' },
  entrarBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  entrarBtnTxt:  { color: '#1677F2', fontSize: 13, fontWeight: '700' },
  sectionHeader:    { paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  sectionTitle:     { fontSize: 16, fontWeight: '700', color: '#111827' },
  sectionSub:       { fontSize: 13, color: '#6B7280', marginTop: 2 },
  seusClubesScroll: { paddingLeft: 16, gap: 12, paddingRight: 16 },
  miniClubeCard:    { width: 110, height: 110, borderRadius: 18, overflow: 'hidden' },
  miniClubeImagem:  { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  miniClubeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', padding: 10, justifyContent: 'flex-end' },
  miniClubeTitulo:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardClube:        { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#EEF0F3' },
  clubeCover:       { width: '100%', height: 100, overflow: 'hidden' },
  clubeCoverImagem: { width: '100%', height: '100%' },
  clubeBody:        { padding: 14, gap: 6 },
  clubeArea:        { fontSize: 12, color: '#6B7280' },
  clubeCoverTituloEscuro: { fontSize: 17, fontWeight: '700', color: '#111827' },
  clubeDesc:        { fontSize: 13, color: '#374151', lineHeight: 18 },
  aderirBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 10, gap: 5, marginTop: 4 },
  aderirBtnTxt:     { color: '#1677F2', fontSize: 13, fontWeight: '700' },
});