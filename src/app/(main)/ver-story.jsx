import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const { width, height } = Dimensions.get('window');
const DURACAO_STORY_PADRAO = 7000;

const WAVE_HEIGHTS = [6,10,14,8,18,12,16,6,14,10,18,8,14,12,16,10,8,14,6,12,18,10,16,8,14,12,6,10,18,14];
const NUM_BARS = WAVE_HEIGHTS.length;

const REACOES = [
  { emoji: '❤️', cor: '#E0245E', label: 'Amor' },
  { emoji: '👍', cor: '#2196F3', label: 'Gosto' },
  { emoji: '😊', cor: '#FFC107', label: 'Feliz' },
  { emoji: '😮', cor: '#9C27B0', label: 'Surpresa' },
  { emoji: '😢', cor: '#03A9F4', label: 'Triste' },
  { emoji: '😡', cor: '#F44336', label: 'Raiva' },
];

const ESTILOS_LETRA = [
  { label: 'Regular', style: { fontWeight: '400', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Bold', style: { fontWeight: '800', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Light', style: { fontWeight: '200', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Thin', style: { fontWeight: '100', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Medium', style: { fontWeight: '500', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'SemiBold', style: { fontWeight: '600', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'ExtraBold', style: { fontWeight: '900', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Italic', style: { fontWeight: '400', fontStyle: 'italic', letterSpacing: 0 } },
  { label: 'Bold Italic', style: { fontWeight: '800', fontStyle: 'italic', letterSpacing: 0 } },
  { label: 'Light Italic', style: { fontWeight: '200', fontStyle: 'italic', letterSpacing: 0 } },
  { label: 'Spaced', style: { fontWeight: '400', letterSpacing: 8 } },
  { label: 'Spaced Bold', style: { fontWeight: '700', letterSpacing: 8 } },
  { label: 'Spaced Light', style: { fontWeight: '200', letterSpacing: 8 } },
  { label: 'Wide', style: { fontWeight: '400', letterSpacing: 12 } },
  { label: 'Ultra Wide', style: { fontWeight: '700', letterSpacing: 16 } },
  { label: 'Compact', style: { fontWeight: '900', letterSpacing: -1 } },
  { label: 'Ultra Compact', style: { fontWeight: '900', letterSpacing: -2 } },
  { label: 'CAPS', style: { fontWeight: '700', letterSpacing: 4, textTransform: 'uppercase' } },
  { label: 'CAPS Light', style: { fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase' } },
  { label: 'CAPS Wide', style: { fontWeight: '800', letterSpacing: 10, textTransform: 'uppercase' } },
  { label: 'Shadow', style: { fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 4 } },
  { label: 'Glow White', style: { fontWeight: '700', textShadowColor: '#fff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 } },
  { label: 'Glow Blue', style: { fontWeight: '700', textShadowColor: '#3A86FF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Pink', style: { fontWeight: '700', textShadowColor: '#FF006E', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Green', style: { fontWeight: '700', textShadowColor: '#06D6A0', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Gold', style: { fontWeight: '700', textShadowColor: '#FFD700', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Red', style: { fontWeight: '700', textShadowColor: '#E63946', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Shadow Soft', style: { fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 8 } },
  { label: 'Outline', style: { fontWeight: '700', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 } },
  { label: 'Double Shadow', style: { fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 } },
  { label: 'Xs', style: { fontWeight: '400', fontSize: 10 } },
  { label: 'Sm', style: { fontWeight: '400', fontSize: 16 } },
  { label: 'Md', style: { fontWeight: '500', fontSize: 22 } },
  { label: 'Lg', style: { fontWeight: '600', fontSize: 30 } },
  { label: 'Xl', style: { fontWeight: '700', fontSize: 40 } },
  { label: 'Neon Blue', style: { fontWeight: '700', textShadowColor: '#00BBF9', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Neon Pink', style: { fontWeight: '700', textShadowColor: '#F15BB5', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Neon Green', style: { fontWeight: '700', textShadowColor: '#00F5D4', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Impact', style: { fontWeight: '900', letterSpacing: -1, textTransform: 'uppercase', fontStyle: 'normal' } },
  { label: 'Elegant', style: { fontWeight: '300', fontStyle: 'italic', letterSpacing: 5 } },
  { label: 'Cinematic', style: { fontWeight: '200', letterSpacing: 14, textTransform: 'uppercase' } },
  { label: 'Monospace', style: { fontWeight: '400', letterSpacing: 4, fontFamily: 'monospace' } },
];

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

function formatTime(s) {
  const seg = Math.max(0, Math.floor(s ?? 0));
  const m = Math.floor(seg / 60);
  const ss = seg % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

// ── Toast ──
function ToastResposta({ visivel }) {
  const opacidade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visivel) {
      Animated.parallel([
        Animated.timing(opacidade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacidade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visivel]);

  return (
    <Animated.View style={[styles.toastWrap, { opacity: opacidade, transform: [{ translateY }] }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={20} color="#06D6A0" />
      <Text style={styles.toastTexto}>Resposta enviada</Text>
    </Animated.View>
  );
}

// ── AlertCustom ──
function AlertCustom({ visivel, titulo, mensagem, onCancelar, onConfirmar, textoCancelar = 'Cancelar', textoConfirmar = 'Eliminar', perigoso = true }) {
  if (!visivel) return null;
  return (
    <Modal transparent visible={visivel} animationType="fade" onRequestClose={onCancelar}>
      <View style={alertStyles.fundo}>
        <View style={alertStyles.card}>
          <Text style={alertStyles.titulo}>{titulo}</Text>
          <Text style={alertStyles.mensagem}>{mensagem}</Text>
          <View style={alertStyles.botoesRow}>
            <TouchableOpacity style={alertStyles.btnCancelar} onPress={onCancelar} activeOpacity={0.8}>
              <Text style={alertStyles.btnCancelarText}>{textoCancelar}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[alertStyles.btnConfirmar, perigoso && alertStyles.btnConfirmarPerigo]}
              onPress={onConfirmar} activeOpacity={0.8}
            >
              <Text style={alertStyles.btnConfirmarText}>{textoConfirmar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const alertStyles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12 },
  titulo: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 10 },
  mensagem: { fontSize: 14, color: '#444', lineHeight: 21, marginBottom: 24 },
  botoesRow: { flexDirection: 'row', gap: 12 },
  btnCancelar: { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelarText: { fontSize: 15, fontWeight: '600', color: '#333' },
  btnConfirmar: { flex: 1, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnConfirmarPerigo: { backgroundColor: '#EF4444' },
  btnConfirmarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ── ReacaoItem ──
function ReacaoItem({ reacao, onPress, reacaoEnviada }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -4, duration: 600 + Math.random() * 400, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 600 + Math.random() * 400, useNativeDriver: true }),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, []);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.5, useNativeDriver: true, tension: 200, friction: 5 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onPress(reacao.emoji);
  };

  const isActiva = reacaoEnviada === reacao.emoji;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }, { translateY: bounceAnim }] }}>
      <TouchableOpacity
        style={[styles.reacaoBotao, { backgroundColor: reacao.cor + '22' }, isActiva && { backgroundColor: reacao.cor + '44', borderColor: reacao.cor, borderWidth: 2 }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={styles.reacaoEmoji}>{reacao.emoji}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── PlayerVozCentral ──
function PlayerVozCentral({ uri, autorFoto, autorNome, progressAnim, duracaoTotal, onAudioTerminou }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const progressoRef = useRef(0);
  const [progressoUI, setProgressoUI] = useState(0);
  const [posicaoUI, setPosicaoUI] = useState(0);
  const [duracaoUI, setDuracaoUI] = useState(0);
  const [aTocar, setATocar] = useState(false);
  const isSeekingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const waveWidthRef = useRef(0);
  const animBarRef = useRef(null);
  const aTocarRef = useRef(false);
  const duracaoUIRef = useRef(0);

  useEffect(() => { aTocarRef.current = aTocar; }, [aTocar]);
  useEffect(() => { duracaoUIRef.current = duracaoUI; }, [duracaoUI]);

  useEffect(() => {
    if (!status || isSeekingRef.current) return;
    const dur = status.duration ?? 0;
    const pos = status.currentTime ?? 0;
    const playing = status.playing ?? false;
    setDuracaoUI(dur);
    setPosicaoUI(pos);
    setATocar(playing);
    if (dur > 0) {
      const ratio = Math.min(pos / dur, 1);
      progressoRef.current = ratio;
      setProgressoUI(ratio);
      progressAnim.setValue(ratio);
      if (playing) _lancarBarra((1 - ratio) * duracaoTotal);
    }
    if (dur > 0 && !playing && pos >= dur - 0.2) {
      _pararBarra();
      progressAnim.setValue(1);
      setTimeout(() => onAudioTerminou?.(), 350);
    }
  }, [status]);

  const _lancarBarra = (msRestantes) => {
    _pararBarra();
    animBarRef.current = Animated.timing(progressAnim, { toValue: 1, duration: Math.max(msRestantes, 0), useNativeDriver: false });
    animBarRef.current.start(({ finished }) => { if (finished) onAudioTerminou?.(); });
  };

  const _pararBarra = () => { animBarRef.current?.stop(); animBarRef.current = null; };

  const toggle = () => {
    try {
      if (aTocarRef.current) { _pararBarra(); player.pause(); }
      else { player.play(); }
    } catch (_) {}
  };

  const _ratioFromX = (x) => Math.min(Math.max(x / (waveWidthRef.current || 1), 0), 1);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (evt) => {
      isSeekingRef.current = true;
      wasPlayingRef.current = aTocarRef.current;
      _pararBarra();
      try { player.pause(); } catch (_) {}
      const ratio = _ratioFromX(evt.nativeEvent.locationX);
      progressoRef.current = ratio;
      setProgressoUI(ratio);
      progressAnim.setValue(ratio);
    },
    onPanResponderMove: (evt) => {
      const ratio = _ratioFromX(evt.nativeEvent.locationX);
      progressoRef.current = ratio;
      setProgressoUI(ratio);
      progressAnim.setValue(ratio);
    },
    onPanResponderRelease: async (evt) => {
      const ratio = _ratioFromX(evt.nativeEvent.locationX);
      progressoRef.current = ratio;
      setProgressoUI(ratio);
      progressAnim.setValue(ratio);
      try {
        const novaPosicao = ratio * (duracaoUIRef.current || 0);
        await player.seekTo(novaPosicao);
        if (wasPlayingRef.current) player.play();
      } catch (_) {}
      isSeekingRef.current = false;
    },
    onPanResponderTerminate: () => { isSeekingRef.current = false; },
  })).current;

  const barrasAtivas = Math.round(progressoUI * NUM_BARS);

  return (
    <View style={styles.playerContainer}>
      <View style={styles.playerAvatarWrap}>
        {autorFoto
          ? <Image source={{ uri: autorFoto }} style={styles.playerAvatarImg} />
          : <View style={styles.playerAvatarPlaceholder}><Text style={styles.playerAvatarText}>{(autorNome || 'U')[0]}</Text></View>
        }
        <View style={styles.playerMicBadge}><Ionicons name="mic" size={10} color="#fff" /></View>
      </View>
      <TouchableOpacity style={styles.playerPlayBtn} onPress={toggle} activeOpacity={0.8}>
        <Ionicons name={aTocar ? 'pause' : 'play'} size={16} color="#fff" />
      </TouchableOpacity>
      <View style={styles.playerWaveWrap} onLayout={(e) => { waveWidthRef.current = e.nativeEvent.layout.width; }} {...panResponder.panHandlers}>
        {WAVE_HEIGHTS.map((h, i) => (
          <View key={i} style={[styles.playerBar, { height: h, backgroundColor: i < barrasAtivas ? '#FFFFFF' : 'rgba(255,255,255,0.28)' }]} />
        ))}
      </View>
      <Text style={styles.playerTime}>{aTocar || progressoUI > 0 ? formatTime(posicaoUI) : formatTime(duracaoUI)}</Text>
    </View>
  );
}

// ── MenuFerramentas ──
function MenuFerramentas({ visivel, onFechar, story, isAutor, onEliminar, onPrivacidade }) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visivel) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start();
    }
  }, [visivel]);

  if (!visivel && slideAnim._value >= 299) return null;

  const opcoes = [
    ...(isAutor ? [
      { icone: 'trash-outline', label: 'Eliminardestaque', cor: '#EF4444', acao: onEliminar },
      { icone: 'lock-closed-outline', label: 'Editar privacidade', cor: '#fff', acao: onPrivacidade },
    ] : []),
    {
      icone: 'share-social-outline', label: 'Partilhardestaque', cor: '#fff',
      acao: async () => {
        try { await Share.share({ message: story?.texto || 'Vê estadestaque!', title: 'Partilhardestaque' }); } catch (_) {}
        onFechar();
      },
    },
    ...(story?.link ? [{ icone: 'copy-outline', label: 'Copiar endereço do link', cor: '#fff', acao: () => { Clipboard.setString(story.link); onFechar(); } }] : []),
  ];

  return (
    <Modal transparent visible={visivel} animationType="none" onRequestClose={onFechar}>
      <TouchableWithoutFeedback onPress={onFechar}>
        <View style={styles.menuOverlay} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.menuSheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.menuHandle} />
        <Text style={styles.menuTitulo}>Opções do destaque</Text>
        {opcoes.map((op, i) => (
          <TouchableOpacity key={i} style={[styles.menuItem, i < opcoes.length - 1 && styles.menuItemBorder]} onPress={op.acao} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, op.cor === '#EF4444' && styles.menuIconWrapDanger]}>
              <Ionicons name={op.icone} size={20} color={op.cor === '#EF4444' ? '#EF4444' : '#fff'} />
            </View>
            <Text style={[styles.menuItemLabel, op.cor === '#EF4444' && { color: '#EF4444' }]}>{op.label}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.menuCancelar} onPress={onFechar} activeOpacity={0.8}>
          <Text style={styles.menuCancelarText}>Cancelar</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ══════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════
export default function VerStoryScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams();
  const { user, perfil } = useUser();
  const insets = useSafeAreaInsets();

  const [stories, setStories] = useState([]);
  const [indice, setIndice] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);
  const [alertEliminar, setAlertEliminar] = useState(false);
  const [respostaTexto, setRespostaTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [reacaoEnviada, setReacaoEnviada] = useState(null);
  const [mostrarReacoes, setMostrarReacoes] = useState(false);
  const [mostrarToast, setMostrarToast] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const toastTimerRef = useRef(null);
  const inputRef = useRef(null);
  const uidAnteriorRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animStoryRef = useRef(null);
  const pausadoRef = useRef(false);
  const inicioRef = useRef(null);
  const tempoRestRef = useRef(DURACAO_STORY_PADRAO);

  // ── Teclado ──
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    const showD = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideD = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); showD.remove(); hideD.remove(); };
  }, []);

  useEffect(() => {
    if (uid && uid !== uidAnteriorRef.current) {
      uidAnteriorRef.current = uid;
      setIndice(0);
      setCarregando(true);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const agora = new Date();
    const q = query(collection(db, 'stories'), where('uid', '==', uid), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const validos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => {
        try {
          const exp = s.expiraEm?.toDate ? s.expiraEm.toDate() : new Date(s.expiraEm);
          return exp > agora;
        } catch { return false; }
      });
      setStories(validos);
      setCarregando(false);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (stories.length === 0) return;
    const story = stories[indice];
    if (!story) return;

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();

    progressAnim.setValue(0);
    pausadoRef.current = false;
    tempoRestRef.current = _duracaoStory(story);
    if (!story.audioUri) _iniciarBarraSemAudio(_duracaoStory(story));
    marcarComoVisto();
    return () => _pararBarraSemAudio();
  }, [indice, stories.length]);

  const _duracaoStory = (story) => {
    if (story?.audioDuracao && story.audioDuracao > 0) return Math.max(story.audioDuracao * 1000, 3000);
    return DURACAO_STORY_PADRAO;
  };

  const _iniciarBarraSemAudio = (duracao) => {
    _pararBarraSemAudio();
    inicioRef.current = Date.now();
    animStoryRef.current = Animated.timing(progressAnim, { toValue: 1, duration: duracao, useNativeDriver: false });
    animStoryRef.current.start(({ finished }) => { if (finished && !pausadoRef.current) proximoStory(); });
  };

  const _pararBarraSemAudio = () => { animStoryRef.current?.stop(); animStoryRef.current = null; };

  const pausarProgresso = () => {
    if (pausadoRef.current || stories[indice]?.audioUri) return;
    pausadoRef.current = true;
    _pararBarraSemAudio();
    const decorrido = Date.now() - (inicioRef.current ?? Date.now());
    tempoRestRef.current = Math.max(0, tempoRestRef.current - decorrido);
  };

  const retomarProgresso = () => {
    if (!pausadoRef.current || stories[indice]?.audioUri) return;
    pausadoRef.current = false;
    _iniciarBarraSemAudio(tempoRestRef.current);
  };

  const marcarComoVisto = async () => {
    if (!user || !stories[indice]) return;
    try { await updateDoc(doc(db, 'stories', stories[indice].id), { vistoPor: arrayUnion(user.uid) }); } catch (_) {}
  };

  const proximoStory = () => {
    if (indice < stories.length - 1) setIndice((i) => i + 1);
    else router.replace('/(main)/feed');
  };

  const anteriorStory = () => { if (indice > 0) setIndice((i) => i - 1); };

  const handleEliminar = () => { setMenuAberto(false); pausarProgresso(); setAlertEliminar(true); };

  const confirmarEliminar = async () => {
    setAlertEliminar(false);
    try {
      await deleteDoc(doc(db, 'stories', stories[indice].id));
      if (stories.length <= 1) router.replace('/(main)/feed');
      else proximoStory();
    } catch (_) {}
  };

  const cancelarEliminar = () => { setAlertEliminar(false); retomarProgresso(); };

  const handlePrivacidade = () => {
    setMenuAberto(false);
    const story = stories[indice];
    Alert.alert('Editar privacidade', `Privacidade actual: ${story?.privacidade === 'publico' ? 'Público' : 'Apenas eu'}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Público', onPress: async () => { try { await updateDoc(doc(db, 'stories', story.id), { privacidade: 'publico' }); } catch (_) {} } },
      { text: 'Apenas eu', onPress: async () => { try { await updateDoc(doc(db, 'stories', story.id), { privacidade: 'privado' }); } catch (_) {} } },
    ]);
  };

  const mostrarToastResposta = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMostrarToast(true);
    toastTimerRef.current = setTimeout(() => setMostrarToast(false), 2500);
  };

  const enviarResposta = async () => {
    if (!respostaTexto.trim() || !user || !stories[indice]) return;
    setEnviando(true);
    const story = stories[indice];
    const chatId = getChatId(user.uid, story.uid);
    const nomeRemetente = perfil?.nome || 'Utilizador';

    // ── Textos diferenciados por papel ──
    // Para o recetor (dono dadestaque): "X respondeu à suadestaque"
    // Para o emissor (quem está a ver): guardamos contexto para mostrar "Respondeste àdestaque de Y"
    const textoParaChat = respostaTexto.trim();

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        uid: user.uid,
        texto: textoParaChat,
        // contexto diferenciado: o recetor verá "respondeu à suadestaque", o emissor verá "Respondeste àdestaque de X"
        contextoEmissor: `história de ${story.autorNome || 'utilizador'}`,
        contextoRecetor: `história`,
        timestamp: serverTimestamp(),
        lida: false,
        tipo: 'resposta_story',
        storyId: story.id,
        storyAutorNome: story.autorNome || '',
      });
      await setDoc(doc(db, 'chats', chatId), {
        users: [user.uid, story.uid],
        // A última mensagem que aparece na lista de chats usa o contexto do recetor
        ultimaMensagem: `história: "${textoParaChat}"`,
        ultimoTimestamp: serverTimestamp(),
        [`nomes.${user.uid}`]: nomeRemetente,
        [`nomes.${story.uid}`]: story.autorNome || 'Utilizador',
        [`fotos.${user.uid}`]: perfil?.fotoURL || null,
        [`fotos.${story.uid}`]: story.autorFoto || null,
      }, { merge: true });

      setRespostaTexto('');
      Keyboard.dismiss();
      mostrarToastResposta();
      retomarProgresso();
    } catch (_) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem. Tenta novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const enviarReacao = async (emoji) => {
    if (!user || !stories[indice]) return;
    setReacaoEnviada(emoji);
    setMostrarReacoes(false);
    const story = stories[indice];
    const chatId = getChatId(user.uid, story.uid);
    const nomeRemetente = perfil?.nome || 'Utilizador';
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        uid: user.uid,
        texto: emoji,
        contextoEmissor: ` reagiu ao seu  destaque com ${story.autorNome || 'utilizador'} com ${emoji}`,
        contextoRecetor: `Reagiu ao seu destaque ${emoji}`,
        timestamp: serverTimestamp(),
        lida: false,
        tipo: 'reacao_story',
        storyId: story.id,
        storyAutorNome: story.autorNome || '',
      });
      await setDoc(doc(db, 'chats', chatId), {
        users: [user.uid, story.uid],
        ultimaMensagem: `história  ${emoji}`,
        ultimoTimestamp: serverTimestamp(),
        [`nomes.${user.uid}`]: nomeRemetente,
        [`nomes.${story.uid}`]: story.autorNome || 'Utilizador',
        [`fotos.${user.uid}`]: perfil?.fotoURL || null,
        [`fotos.${story.uid}`]: story.autorFoto || null,
      }, { merge: true });
      setTimeout(() => setReacaoEnviada(null), 1500);
    } catch (_) {}
  };

  // ── Loading / empty states ──
  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="albums-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.semStories}>Semdestaques disponíveis.</Text>
          <TouchableOpacity onPress={() => router.replace('/(main)/feed')} style={styles.voltarBtn}>
            <Text style={styles.voltarText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const story = stories[indice];
  if (!story) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  );

  const estiloLetraAtual = ESTILOS_LETRA[story.estiloLetraIndex ?? 0]?.style ?? {};
  const isAutor = user?.uid === story.uid;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Fundo com fade ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {story.fotoBase64 ? (
          <Image source={{ uri: `data:image/jpeg;base64,${story.fotoBase64}` }} style={styles.fundo} resizeMode="cover" />
        ) : story.fotoUri ? (
          <Image source={{ uri: story.fotoUri }} style={styles.fundo} resizeMode="cover" />
        ) : (
          <View style={[styles.fundo, { backgroundColor: story.corFundo || '#1A1A2E' }]} />
        )}
        <View style={styles.overlay} />
      </Animated.View>

      {/* ── Stickers ── */}
      {(story.stickers || []).map((s, i) => (
        <View key={i} style={[styles.stickerWrap, { left: s.x, top: s.y }]} pointerEvents="none">
          {s.isText
            ? <Text style={styles.stickerHora}>{s.emoji}</Text>
            : <Text style={styles.stickerEmoji}>{s.emoji}</Text>
          }
        </View>
      ))}

      {/* ── Localização ── */}
      {story.localizacao ? (
        <View style={[styles.localizacaoSticker, { position: 'absolute', top: height * 0.14, alignSelf: 'center', zIndex: 20 }]} pointerEvents="none">
          <Ionicons name="location" size={14} color="#fff" />
          <Text style={styles.localizacaoStickerText}>{story.localizacao}</Text>
        </View>
      ) : null}

      {/* ── Texto principal ── */}
      {story.texto ? (
        <View style={styles.textoWrap} pointerEvents="none">
          <Text style={[styles.textoStory, { fontSize: story.tamanhoTexto || 26, color: story.corTexto || '#FFFFFF', ...estiloLetraAtual }]}>
            {story.texto}
          </Text>
        </View>
      ) : null}

      {/* ── Player áudio ── */}
      {story.audioUri ? (
        <View style={styles.audioWrap} pointerEvents="box-none">
          <PlayerVozCentral
            key={story.id}
            uri={story.audioUri}
            autorFoto={story.autorFoto}
            autorNome={story.autorNome}
            progressAnim={progressAnim}
            duracaoTotal={_duracaoStory(story)}
            onAudioTerminou={proximoStory}
          />
        </View>
      ) : null}

      {/* ── Link ── */}
      {story.link ? (
        <View style={[styles.linkWrap, { bottom: isAutor ? insets.bottom + 20 : 130 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(story.link.startsWith('http') ? story.link : `https://${story.link}`)}>
            <Ionicons name="link-outline" size={16} color="#fff" />
            <Text style={styles.linkText} numberOfLines={1}>{story.link}</Text>
            <Ionicons name="open-outline" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Zonas de toque invisíveis ── */}
      <View style={styles.touchAreas} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.touchLeft}
          onPress={anteriorStory}
          onLongPress={pausarProgresso}
          onPressOut={retomarProgresso}
          delayLongPress={200}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={styles.touchRight}
          onPress={proximoStory}
          onLongPress={pausarProgresso}
          onPressOut={retomarProgresso}
          delayLongPress={200}
          activeOpacity={1}
        />
      </View>

      {/* ── Setas de navegação visíveis ── */}
      <View style={styles.setasWrap} pointerEvents="box-none">
        {indice > 0 && (
          <TouchableOpacity style={styles.setaBtn} onPress={anteriorStory} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {indice < stories.length - 1 && (
          <TouchableOpacity style={[styles.setaBtn, styles.setaBtnDireita]} onPress={proximoStory} activeOpacity={0.8}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Cabeçalho ── */}
      <SafeAreaView style={styles.topWrap} pointerEvents="box-none">
        <View style={styles.progressBars}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, {
                width: i < indice ? '100%'
                  : i === indice ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                  : '0%',
              }]} />
            </View>
          ))}
        </View>
        <View style={styles.autorRow}>
          <View style={styles.autorAvatar}>
            {story.autorFoto
              ? <Image source={{ uri: story.autorFoto }} style={styles.autorAvatarImg} />
              : <Text style={styles.autorAvatarText}>{(story.autorNome || 'U')[0]}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.autorNome}>{story.autorNome}</Text>
            {story.autorCargo ? <Text style={styles.autorCargo}>{story.autorCargo}</Text> : null}
          </View>
          {isAutor && (story.vistoPor?.length ?? 0) > 0 && (
            <View style={styles.vistosBadge}>
              <Ionicons name="eye-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.vistosText}>{story.vistoPor.length}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.ferramentasBtn}
            onPress={() => { pausarProgresso(); setMenuAberto(true); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(main)/feed')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.fecharBtn}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Toast ── */}
      <ToastResposta visivel={mostrarToast} />

      {/* ══════════════════════════════════════
          ZONA INFERIOR — só para quem não é autor
          Usa KeyboardAvoidingView para colar ao teclado
      ══════════════════════════════════════ */}
      {!isAutor && (
        <KeyboardAvoidingView
          style={styles.kavWrap}
          behavior={Platform.OS === 'android' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.bottomZone, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>

            {/* Reação de feedback */}
            {reacaoEnviada && (
              <View style={styles.reacaoFeedback}>
                <Text style={styles.reacaoFeedbackEmoji}>{reacaoEnviada}</Text>
              </View>
            )}

            {/* Popup de reações */}
            {mostrarReacoes && (
              <View style={styles.reacoesPopup}>
                {REACOES.map((reacao) => (
                  <ReacaoItem
                    key={reacao.emoji}
                    reacao={reacao}
                    onPress={enviarReacao}
                    reacaoEnviada={reacaoEnviada}
                  />
                ))}
              </View>
            )}

            {/* Input row */}
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.reacaoPrincipalBtn}
                onPress={() => { setMostrarReacoes(!mostrarReacoes); pausarProgresso(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.reacaoPrincipalEmoji}>❤️</Text>
              </TouchableOpacity>

              <View style={styles.inputWrap}>
                <TextInput
                  ref={inputRef}
                  style={styles.respostaInput}
                  placeholder={`Responde a ${story.autorNome || 'história'}...`}
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={respostaTexto}
                  onChangeText={setRespostaTexto}
                  onFocus={() => { pausarProgresso(); setMostrarReacoes(false); }}
                  onBlur={() => { if (!respostaTexto.trim()) retomarProgresso(); }}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={enviarResposta}
                />
              </View>

              <TouchableOpacity
                style={[styles.enviarBtn, (!respostaTexto.trim() || enviando) && { opacity: 0.4 }]}
                onPress={enviarResposta}
                disabled={!respostaTexto.trim() || enviando}
                activeOpacity={0.8}
              >
                {enviando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={18} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Menus / Alertas ── */}
      <MenuFerramentas
        visivel={menuAberto}
        onFechar={() => { setMenuAberto(false); retomarProgresso(); }}
        story={story}
        isAutor={isAutor}
        onEliminar={handleEliminar}
        onPrivacidade={handlePrivacidade}
      />

      <AlertCustom
        visivel={alertEliminar}
        titulo="Eliminar destaque"
        mensagem="Tens a certeza que queres eliminar este destaque? Esta ação não pode ser desfeita."
        textoCancelar="Cancelar"
        textoConfirmar="Eliminar"
        perigoso={true}
        onCancelar={cancelarEliminar}
        onConfirmar={confirmarEliminar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  semStories: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  voltarBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  voltarText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  fundo: { position: 'absolute', width, height },
  overlay: { position: 'absolute', width, height, backgroundColor: 'rgba(0,0,0,0.22)' },

  // Stickers
  stickerWrap: { position: 'absolute', zIndex: 20 },
  stickerEmoji: { fontSize: 48 },
  stickerHora: { fontSize: 28, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },

  // Localização
  localizacaoSticker: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(37,99,235,0.85)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  localizacaoStickerText: { color: '#fff', fontSize: 13, fontWeight: '600', maxWidth: 220 },

  // Texto
  textoWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  textoStory: { color: '#fff', fontSize: 26, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },

  // Áudio
  audioWrap: { position: 'absolute', top: height / 2 - 36, left: 20, right: 20, zIndex: 25, alignItems: 'center' },
  playerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 32, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', gap: 8, width: '100%' },
  playerAvatarWrap: { width: 42, height: 42, borderRadius: 21, position: 'relative' },
  playerAvatarImg: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  playerAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  playerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  playerMicBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#4B5563', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  playerPlayBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  playerWaveWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 36, paddingHorizontal: 2 },
  playerBar: { flex: 1, borderRadius: 2, minWidth: 2 },
  playerTime: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500', minWidth: 36, textAlign: 'right' },

  // Link
  linkWrap: { position: 'absolute', left: 24, right: 24, zIndex: 25 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  linkText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '500' },

  // Zonas de toque
  touchAreas: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 100, flexDirection: 'row', zIndex: 5 },
  touchLeft: { flex: 1 },
  touchRight: { flex: 1 },

  // Setas
  setasWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, zIndex: 6, pointerEvents: 'box-none' },
  setaBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  setaBtnDireita: { marginLeft: 'auto' },

  // Cabeçalho
  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
  progressBars: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingTop: 8, marginBottom: 10 },
  progressBarBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  autorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  autorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
  autorAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  autorAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  autorNome: { color: '#fff', fontWeight: '700', fontSize: 14 },
  autorCargo: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
  vistosBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  vistosText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  ferramentasBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  fecharBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  // ── KAV + Bottom zone ──
  // O KAV ocupa o espaço na parte inferior e empurra o conteúdo para cima com o teclado
  kavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  bottomZone: {
    backgroundColor: 'rgba(0,0,0,0.0)',
    paddingHorizontal: 14,
    paddingTop: 8,
  },

  // Reações
  reacoesPopup: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 40, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'center' },
  reacaoBotao: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  reacaoEmoji: { fontSize: 26 },
  reacaoFeedback: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 8 },
  reacaoFeedbackEmoji: { fontSize: 36 },

  // Input
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  reacaoPrincipalBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  reacaoPrincipalEmoji: { fontSize: 22 },
  inputWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 10 },
  respostaInput: { color: '#fff', fontSize: 14, maxHeight: 40 },
  enviarBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center' },

  // Toast
  toastWrap: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20,20,30,0.92)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  toastTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  menuSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, paddingTop: 12, paddingHorizontal: 20 },
  menuHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  menuTitulo: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  menuIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  menuIconWrapDanger: { backgroundColor: 'rgba(239,68,68,0.15)' },
  menuItemLabel: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },
  menuCancelar: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  menuCancelarText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});