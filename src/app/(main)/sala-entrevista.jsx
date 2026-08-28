/**
 * sala-entrevista.jsx — ConnectAll Angola
 * Tela 1: Lobby (recrutador vê opções, candidato entra com código)
 * Tela 2: Sala activa com Agora RTC
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app, db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { AgoraEngine } from '../../services/AgoraEngine';

const { width: W, height: H } = Dimensions.get('window');

// ── Paletas ───────────────────────────────────────────────────────────────────
const CL = { // Lobby (claro)
  fundo:     '#EAECF5',
  card:      '#FFFFFF',
  azul:      '#1A237E',
  azulMed:   '#3949AB',
  azulClaro: '#E8EAF6',
  cinza1:    '#F0F2F8',
  cinza2:    '#C5CAE9',
  cinza3:    '#7986CB',
  cinza4:    '#3D3D3D',
  preto:     '#1A1A2E',
  branco:    '#FFFFFF',
  verde:     '#2E7D32',
  vermelho:  '#C62828',
};

const CS = { // Sala (escuro)
  fundo:      '#0A0F1E',
  fundoCard:  '#141929',
  fundoBarra: '#0D1220',
  azul:       '#1677F2',
  azulClaro:  '#3B82F6',
  verde:      '#22C55E',
  vermelho:   '#EF4444',
  amarelo:    '#F59E0B',
  cinza:      '#64748B',
  cinzaClaro: '#94A3B8',
  branco:     '#FFFFFF',
  texto:      '#E2E8F0',
  textoSub:   '#94A3B8',
  overlay:    'rgba(0,0,0,0.75)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function corAvatar(nome) {
  const cores = ['#1A237E', '#283593', '#1565C0', '#0277BD', '#00695C', '#2E7D32'];
  if (!nome) return cores[0];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffffffff;
  return cores[Math.abs(h) % cores.length];
}

function Avatar({ uri, nome, size = 40 }) {
  const cor = corAvatar(nome);
  const ini = (nome || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: cor, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700' }}>{ini}</Text>
    </View>
  );
}

function formatarTempo(seg) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ── Botão da barra de controlos ───────────────────────────────────────────────
function BtnControlo({ icone, label, ativo = true, vermelho = false, laranja = false, onPress, badge }) {
  const cor   = vermelho ? CS.vermelho : laranja ? CS.amarelo : ativo ? CS.branco : CS.cinza;
  const fundo = vermelho ? '#2D1515'   : laranja ? '#2D1A00'  : ativo ? '#1E2A3A' : '#111827';
  return (
    <TouchableOpacity style={[es.btnCtrl, { backgroundColor: fundo }]} onPress={onPress} activeOpacity={0.75}>
      {badge > 0 && (
        <View style={es.badge}>
          <Text style={es.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
      <Ionicons name={icone} size={20} color={cor} />
      <Text style={[es.btnCtrlTxt, { color: cor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════════
export default function SalaEntrevistaScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const params = useLocalSearchParams();

  // Params opcionais (quando vem de entrar com código)
  const paramSalaId     = params.salaId      || null;
  const tokenParam      = params.token       || null;
  const paramEmpresa    = params.nomeEmpresa || null;
  const paramNome       = params.meuNome     || null;
  const paramFoto       = params.minhaFoto   || null;
  const paramPapel      = params.papel       || null;

  const { user: u, perfil: p } = { user, perfil };
  const meuNome   = paramNome   || perfil?.nome    || 'Utilizador';
  const minhaFoto = paramFoto   || perfil?.fotoURL || null;
  const papel     = paramPapel  || (perfil?.tipoPerfil === 'recrutador' || perfil?.tipoPerfil === 'empresa' ? 'recrutador' : 'candidato');

  const eRecrutador = papel === 'recrutador' || papel === 'empresa';

  // ── Controlo de tela ─────────────────────────────────────────────────────
  // 'lobby' = primeira tela | 'sala' = dentro da sala
  const [tela, setTela] = useState(paramSalaId ? 'sala' : 'lobby');

  // ── Estado da sala ────────────────────────────────────────────────────────
  const [salaId,      setSalaId]      = useState(paramSalaId || null);
  const [nomeEmpresa, setNomeEmpresa] = useState(paramEmpresa || perfil?.nome || 'ConnectAll Angola');

  // ── Agora ─────────────────────────────────────────────────────────────────
  const [ligado,        setLigado]        = useState(false);
  const [micAtivo,      setMicAtivo]      = useState(true);
  const [camaraAtiva,   setCamaraAtiva]   = useState(false);
  const [partilhandoEcra, setPartilhandoEcra] = useState(false);
  const [meuUidAgora,   setMeuUidAgora]   = useState(0);
  const [remotos,       setRemotos]       = useState([]);
  const [qualidadeRede, setQualidadeRede] = useState('boa');
  const [segundos,      setSegundos]      = useState(0);
  const [ecraCarga,     setEcraCarga]     = useState(false);
  const [erroLigacao,   setErroLigacao]   = useState(null);
  const timerRef = useRef(null);

  // ── Painéis da sala ───────────────────────────────────────────────────────
  const [painelChat,          setPainelChat]          = useState(false);
  const [painelParticipantes, setPainelParticipantes] = useState(false);
  const [painelDocs,          setPainelDocs]          = useState(false);
  const [modalSair,           setModalSair]           = useState(false);
  const [modalAvaliacao,      setModalAvaliacao]       = useState(false);
  const [maoLevantada,        setMaoLevantada]        = useState(false);
  const maoAnim = useRef(new Animated.Value(1)).current;

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [mensagens,    setMensagens]    = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [msgNaoLidas,  setMsgNaoLidas]  = useState(0);
  const chatRef = useRef(null);

  // ── Documentos ────────────────────────────────────────────────────────────
  const [documentos, setDocumentos] = useState([]);
  const [envDoc,     setEnvDoc]     = useState(false);

  // ── Avaliação ─────────────────────────────────────────────────────────────
  const [estrelas,      setEstrelas]      = useState(0);
  const [notaAvaliacao, setNotaAvaliacao] = useState('');

  // ── Lobby — estado ────────────────────────────────────────────────────────
  const [modalMenu,       setModalMenu]       = useState(false);
  const [modalNovas,      setModalNovas]      = useState(false);
  const [modalCodigo,     setModalCodigo]     = useState(false);
  const [modalEntrarCod,  setModalEntrarCod]  = useState(false);
  const [modalAgendar,    setModalAgendar]    = useState(false);
  const [modalGrupo,      setModalGrupo]      = useState(false);
  const [codigoGerado,    setCodigoGerado]    = useState(null);
  const [salaIdGerada,    setSalaIdGerada]    = useState(null);
  const [copiado,         setCopiado]         = useState(false);
  const [codigoInput,     setCodigoInput]     = useState('');
  const [entrandoCod,     setEntrandoCod]     = useState(false);
  const [gerandoCodigo,   setGerandoCodigo]   = useState(false);
  const [pesquisa,        setPesquisa]        = useState('');
  const [utilizadorEncontrado, setUtilizadorEncontrado] = useState(null);
  const [pesquisando,     setPesquisando]     = useState(false);
  const [pesquisaGrupo,   setPesquisaGrupo]   = useState('');
  const [grupoSelecionados, setGrupoSelecionados] = useState([]);
  const [utilizadoresGrupo, setUtilizadoresGrupo] = useState([]);
  const [pesquisandoGrupo,  setPesquisandoGrupo]  = useState(false);
  const [salasRecentes,   setSalasRecentes]   = useState([]);

  const drawerAnim = useRef(new Animated.Value(-W * 0.75)).current;

  // ── Convite dentro da sala ────────────────────────────────────────────────
  const [modalConvidar, setModalConvidar] = useState(false);
  const [codigoSala,    setCodigoSala]    = useState(null);
  const [copiadoSala,   setCopiadoSala]   = useState(false);

  // ════════════════════════════════════════════════════════════════════════════
  // EFEITOS
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (tela === 'sala' && salaId) {
      inicializarAgora(salaId);
    }
    return () => {
      if (tela === 'sala') limparAgora();
    };
  }, [tela, salaId]);

  // Chat listener
  useEffect(() => {
    if (tela !== 'sala' || !salaId) return;
    const q = query(collection(db, 'entrevistas', salaId, 'chat'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (!painelChat) setMsgNaoLidas(prev => prev + snap.docChanges().filter(c => c.type === 'added').length);
    });
    return unsub;
  }, [tela, salaId, painelChat]);

  // Salas recentes (lobby)
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'entrevistas_sala'),
      orderBy('criadoEm', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setSalasRecentes(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.criadoPor === user.uid && s.ativa !== false));
    }, () => {});
    return unsub;
  }, [user?.uid]);

  // ════════════════════════════════════════════════════════════════════════════
  // AGORA
  // ════════════════════════════════════════════════════════════════════════════
  const obterToken = async (canal, uid) => {
    if (tokenParam) return tokenParam;
    try {
      const functions  = getFunctions(app, 'europe-west1');
      const gerarToken = httpsCallable(functions, 'gerarTokenAgora');
      const { data }   = await gerarToken({ channelName: canal, uid });
      return data?.token || null;
    } catch (e) {
      console.warn('[Entrevista] Erro token:', e);
      return null;
    }
  };

  const inicializarAgora = async (sid) => {
    setEcraCarga(true);
    setErroLigacao(null);

    const timeout = setTimeout(() => {
      console.log('[Entrevista] Timeout');
      setEcraCarga(false);
    }, 15000);

    try {
      if (!AgoraEngine.disponivel()) {
        clearTimeout(timeout);
        setErroLigacao('Módulo de áudio não disponível.');
        setEcraCarga(false);
        return;
      }

      const meuUid = user?.uid || 'anonimo';
      const numUid = Math.abs(meuUid.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000;
      const token  = await obterToken(sid, numUid);

      if (!token) {
        clearTimeout(timeout);
        setErroLigacao('Sem token de ligação. O áudio pode não funcionar.');
        setEcraCarga(false);
        return;
      }

      AgoraEngine.init();
      AgoraEngine.enableAudio();
      camaraAtiva ? AgoraEngine.enableVideo() : AgoraEngine.disableVideo();

      AgoraEngine.registarHandlers({
        onJoinChannelSuccess: (connection) => {
          clearTimeout(timeout);
          setMeuUidAgora(connection.localUid);
          setLigado(true);
          setEcraCarga(false);
          timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000);
          enviarMensagemSistema(`${meuNome} entrou na sala`, sid);
        },
        onUserJoined: (_, remoteUid) => {
          setRemotos(prev => prev.find(r => r.uid === remoteUid) ? prev : [...prev, { uid: remoteUid, nome: 'Participante', foto: null }]);
          enviarMensagemSistema('Um participante entrou na sala', sid);
        },
        onUserOffline: (_, remoteUid) => {
          setRemotos(prev => prev.filter(r => r.uid !== remoteUid));
        },
        onNetworkQuality: (_, uid, txQ, rxQ) => {
          const q = Math.max(txQ, rxQ);
          setQualidadeRede(q <= 2 ? 'boa' : q <= 4 ? 'media' : 'fraca');
        },
        onError: (code) => {
          if (code === 110) {
            clearTimeout(timeout);
            setErroLigacao('Token inválido.');
            setEcraCarga(false);
          }
        },
      });

      await AgoraEngine.entrarCanal({ canal: sid, token, uid: numUid, role: 'broadcaster', utilizador: 'entrevista' });

    } catch (e) {
      clearTimeout(timeout);
      setEcraCarga(false);
    }
  };

  const limparAgora = () => {
    clearInterval(timerRef.current);
    AgoraEngine.sairCanal('entrevista');
  };

  // ── Controlos Agora ───────────────────────────────────────────────────────
  const toggleMic = () => { AgoraEngine.mutarMic(micAtivo); setMicAtivo(p => !p); };

  const toggleCamara = () => {
    if (camaraAtiva) { AgoraEngine.disableVideo(); }
    else { AgoraEngine.enableVideo(); AgoraEngine.startPreview(); }
    setCamaraAtiva(p => !p);
  };

  const togglePartilharEcra = async () => {
    try {
      const engine = AgoraEngine.getEngine();
      if (!engine) { Alert.alert('Erro', 'Motor não disponível.'); return; }
      if (partilhandoEcra) {
        try { engine.stopScreenCapture?.(); } catch (_) {}
        setPartilhandoEcra(false);
        Alert.alert('Partilha de ecrã', 'Partilha de ecrã terminada.');
      } else {
        try {
          engine.startScreenCapture?.({ captureSignalVolume: 100 });
        } catch (_) {}
        setPartilhandoEcra(true);
        Alert.alert('Partilha de ecrã', 'O teu ecrã está a ser partilhado com os participantes.');
      }
    } catch (e) {
      Alert.alert('Partilha de ecrã', 'Função não suportada neste dispositivo.');
    }
  };

  const toggleMao = () => {
    setMaoLevantada(p => !p);
    Animated.sequence([
      Animated.timing(maoAnim, { toValue: 1.4, duration: 200, useNativeDriver: true }),
      Animated.timing(maoAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    enviarMensagemSistema(maoLevantada ? `${meuNome} baixou a mão` : `✋ ${meuNome} levantou a mão`, salaId);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CHAT
  // ════════════════════════════════════════════════════════════════════════════
  const enviarMensagemSistema = async (texto, sid) => {
    if (!sid) return;
    try {
      await addDoc(collection(db, 'entrevistas', sid, 'chat'), {
        uid: 'sistema', nome: 'Sistema', texto, tipo: 'sistema', timestamp: serverTimestamp(),
      });
    } catch (_) {}
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim()) return;
    const texto = novaMensagem.trim();
    setNovaMensagem('');
    try {
      await addDoc(collection(db, 'entrevistas', salaId, 'chat'), {
        uid: user?.uid || 'anonimo', nome: meuNome, foto: minhaFoto,
        texto, tipo: 'mensagem', timestamp: serverTimestamp(),
      });
    } catch (_) {}
  };

  const abrirChat = () => { setPainelChat(true); setMsgNaoLidas(0); setPainelParticipantes(false); setPainelDocs(false); };

  // ════════════════════════════════════════════════════════════════════════════
  // DOCUMENTOS
  // ════════════════════════════════════════════════════════════════════════════
  const partilharDocumento = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (resultado.canceled) return;
      const ficheiro = resultado.assets[0];
      setEnvDoc(true);
      const response   = await fetch(ficheiro.uri);
      const blob       = await response.blob();
      const storage    = getStorage();
      const storageRef = ref(storage, `entrevistas/${salaId}/docs/${Date.now()}_${ficheiro.name}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setDocumentos(prev => [...prev, { nome: ficheiro.name, url, tipo: ficheiro.mimeType, enviadoPor: meuNome, timestamp: new Date() }]);
      await addDoc(collection(db, 'entrevistas', salaId, 'chat'), {
        uid: user?.uid || 'anonimo', nome: meuNome, foto: minhaFoto,
        texto: `📄 ${ficheiro.name}`, tipo: 'documento', urlDoc: url, timestamp: serverTimestamp(),
      });
    } catch (e) {
      if (!DocumentPicker.isCancel?.(e)) Alert.alert('Erro', 'Não foi possível partilhar o documento.');
    } finally { setEnvDoc(false); }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SAIR / ENCERRAR
  // ════════════════════════════════════════════════════════════════════════════
  const sair = async () => {
    setModalSair(false);
    await enviarMensagemSistema(`${meuNome} saiu da sala`, salaId);
    clearInterval(timerRef.current);
    AgoraEngine.sairCanal('entrevista');
    if (papel === 'candidato') {
      setModalAvaliacao(true);
    } else {
      setTela('lobby');
      setSalaId(null);
      setLigado(false);
      setRemotos([]);
      setSegundos(0);
      setMensagens([]);
    }
  };

  const encerrarSala = () => {
    Alert.alert(
      'Encerrar sala',
      'Tens a certeza? Todas as mensagens serão apagadas e a sala ficará inacessível para todos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar sala', style: 'destructive',
          onPress: async () => {
            try {
              // Apaga todas as mensagens do chat
              const msgs  = await getDocs(collection(db, 'entrevistas', salaId, 'chat'));
              const batch = writeBatch(db);
              msgs.forEach(d => batch.delete(d.ref));
              await batch.commit();

              // Marca sala como encerrada
              await setDoc(doc(db, 'entrevistas_sala', salaId), {
                ativa: false,
                encerradaEm: new Date().toISOString(),
              }, { merge: true });

              clearInterval(timerRef.current);
              AgoraEngine.sairCanal('entrevista');

              // Volta ao lobby
              setTela('lobby');
              setSalaId(null);
              setLigado(false);
              setRemotos([]);
              setSegundos(0);
              setMensagens([]);
              Alert.alert('Sala encerrada', 'A sala foi encerrada e todas as mensagens foram apagadas.');
            } catch (e) {
              console.warn('[Encerrar]', e);
              Alert.alert('Erro', 'Não foi possível encerrar a sala. Tenta novamente.');
            }
          },
        },
      ]
    );
  };

  const submeterAvaliacao = async () => {
    try {
      await addDoc(collection(db, 'entrevistas', salaId, 'avaliacoes'), {
        uid: user?.uid, nome: meuNome, estrelas, nota: notaAvaliacao.trim(), timestamp: serverTimestamp(),
      });
    } catch (_) {}
    setModalAvaliacao(false);
    setTela('lobby');
    setSalaId(null);
    setLigado(false);
    setRemotos([]);
    setSegundos(0);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // LOBBY — funções
  // ════════════════════════════════════════════════════════════════════════════
  const abrirMenu = () => {
    setModalMenu(true);
    Animated.timing(drawerAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start();
  };

  const fecharMenu = () => {
    Animated.timing(drawerAnim, { toValue: -W * 0.75, duration: 220, useNativeDriver: true }).start(() => setModalMenu(false));
  };

  const pesquisarUtilizador = async (id) => {
    if (!id.trim()) { setUtilizadorEncontrado(null); return; }
    setPesquisando(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('connectAllId', '==', id.trim().toUpperCase())));
      if (!snap.empty) {
        setUtilizadorEncontrado({ uid: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        const snapUid = await getDoc(doc(db, 'users', id.trim()));
        setUtilizadorEncontrado(snapUid.exists() ? { uid: snapUid.id, ...snapUid.data() } : null);
      }
    } catch (_) {} finally { setPesquisando(false); }
  };

  // Precisa do import do where
  const { where } = require('firebase/firestore');

  const gerarCodigo = async () => {
    setGerandoCodigo(true);
    try {
      const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let   codigo = 'CA-';
      for (let i = 0; i < 5; i++) codigo += chars[Math.floor(Math.random() * chars.length)];

      const sid      = `entrevista-${user?.uid}-${Date.now()}`;
      const expiraEm = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

      await setDoc(doc(db, 'codigos_sala_index', codigo), {
        salaId: sid, nomeEmpresa: perfil?.nome || 'Entrevista',
        criadoPor: user?.uid, expiraEm, usado: false,
      });

      await setDoc(doc(db, 'entrevistas_sala', sid), {
        salaId: sid, titulo: `Entrevista — ${perfil?.nome || 'Recrutador'}`,
        nomeEmpresa: perfil?.nome || 'Entrevista', criadoPor: user?.uid,
        participantes: [user?.uid], ativa: true, criadoEm: new Date().toISOString(),
      });

      setCodigoGerado(codigo);
      setSalaIdGerada(sid);
      setNomeEmpresa(perfil?.nome || 'ConnectAll Angola');
      setModalNovas(false);
      setModalCodigo(true);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível gerar o código.');
    } finally { setGerandoCodigo(false); }
  };

  const copiarCodigoLobby = async () => {
    try {
      await Clipboard.setStringAsync(
        `Olá! Foi convidado/a para uma entrevista na ConnectAll Angola.\n\n` +
        `Código de acesso: ${codigoGerado}\n\n` +
        `Abre a app ConnectAll Angola → Entrevistas → "Novas" → "Entrar com código"\n` +
        `⏰ Válido por 4 horas · Uso único.`
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch (_) {}
  };

  const enviarWhatsAppLobby = () => {
    const msg =
      `Olá! Foi convidado/a para uma entrevista na ConnectAll Angola.\n\n` +
      `Código de acesso: *${codigoGerado}*\n\n` +
      `Abre a app ConnectAll Angola → Entrevistas → "Novas" → "Entrar com código"\n` +
      `⏰ Válido por 4 horas · Uso único.`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('WhatsApp não encontrado', 'Copia o código e envia manualmente.')
    );
  };

  const entrarComCodigo = async () => {
    const cod = codigoInput.replace(/\s/g, '').toUpperCase();
    if (cod.length < 7) { Alert.alert('Código inválido', 'Formato: CA-XXXXX'); return; }
    setEntrandoCod(true);
    try {
      const snap = await getDoc(doc(db, 'codigos_sala_index', cod));
      if (!snap.exists()) { Alert.alert('Código não encontrado', 'Verifica e tenta novamente.'); return; }
      const dados = snap.data();
      if (dados.usado) { Alert.alert('Código expirado', 'Este código já foi utilizado. Pede um novo.'); return; }
      if (dados.expiraEm && new Date(dados.expiraEm) < new Date()) { Alert.alert('Código expirado', 'Este código expirou (4h). Pede um novo.'); return; }

      // Marca usado — uso único
      await updateDoc(doc(db, 'codigos_sala_index', cod), { usado: true, usadoPor: user?.uid, usadoEm: new Date().toISOString() });

      setModalEntrarCod(false);
      setCodigoInput('');
      setSalaId(dados.salaId);
      setNomeEmpresa(dados.nomeEmpresa || 'Entrevista');
      setTela('sala');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível verificar o código.');
    } finally { setEntrandoCod(false); }
  };

  const iniciarSalaDirecta = (sid, empresa) => {
    setSalaId(sid || salaIdGerada);
    setNomeEmpresa(empresa || perfil?.nome || 'ConnectAll Angola');
    setModalCodigo(false);
    setTela('sala');
  };

  const pesquisarGrupo = async (texto) => {
    setPesquisaGrupo(texto);
    if (!texto.trim()) { setUtilizadoresGrupo([]); return; }
    setPesquisandoGrupo(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('connectAllId', '==', texto.trim().toUpperCase())));
      setUtilizadoresGrupo(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (_) {} finally { setPesquisandoGrupo(false); }
  };

  const toggleGrupo = (u) => {
    setGrupoSelecionados(prev => prev.find(x => x.uid === u.uid) ? prev.filter(x => x.uid !== u.uid) : [...prev, u]);
  };

  const iniciarChamadaGrupo = () => {
    if (grupoSelecionados.length === 0) { Alert.alert('Seleciona pelo menos uma pessoa'); return; }
    const sid = `grupo-${user?.uid}-${Date.now()}`;
    setSalaId(sid);
    setNomeEmpresa('Chamada em grupo');
    setModalGrupo(false);
    setGrupoSelecionados([]);
    setTela('sala');
  };

  const formatarCodigo = (t) => {
    const limpo = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpo.startsWith('CA') && limpo.length > 2) return 'CA-' + limpo.slice(2, 7);
    return limpo.slice(0, 7);
  };

  // Convite dentro da sala
  const gerarCodigoSala = async () => {
    try {
      const refDoc = doc(db, 'codigos_sala', salaId);
      const snap   = await getDoc(refDoc);
      if (snap.exists()) { setCodigoSala(snap.data().codigo); return; }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let codigo = 'CA-';
      for (let i = 0; i < 5; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
      const expiraEm = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

      await setDoc(refDoc, { codigo, salaId, nomeEmpresa, criadoEm: new Date().toISOString(), expiraEm });
      await setDoc(doc(db, 'codigos_sala_index', codigo), { salaId, nomeEmpresa, expiraEm, usado: false });
      setCodigoSala(codigo);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível gerar o código.');
    }
  };

  const abrirConvidar = async () => {
    setModalConvidar(true);
    if (!codigoSala) await gerarCodigoSala();
  };

  const copiarCodigoSala = async () => {
    try {
      await Clipboard.setStringAsync(
        `Olá! Foi convidado/a para uma entrevista na ConnectAll Angola.\n\n` +
        `Código de acesso: ${codigoSala}\n\n` +
        `App → Entrevistas → Novas → "Entrar com código"\n⏰ Válido por 4h · Uso único.`
      );
      setCopiadoSala(true);
      setTimeout(() => setCopiadoSala(false), 3000);
    } catch (_) {}
  };

  const enviarWhatsAppSala = () => {
    const msg = `Código de entrevista ConnectAll: *${codigoSala}*\n\nApp → Entrevistas → Novas → "Entrar com código"\n⏰ 4h · Uso único.`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('WhatsApp não encontrado', 'Copia o código.')
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ════════════════════ RENDER — LOBBY ════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  if (tela === 'lobby') {
    return (
      <SafeAreaView style={lb.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={CL.fundo} />

        {/* ── HEADER ── */}
        <View style={lb.header}>
          <TouchableOpacity style={lb.menuBtn} onPress={abrirMenu}>
            <Ionicons name="menu" size={24} color={CL.preto} />
          </TouchableOpacity>

          <TouchableOpacity style={lb.searchBar} activeOpacity={1}>
            <TextInput
              style={lb.searchInput}
              placeholder="Pesquisar ID do utilizador..."
              placeholderTextColor="#9BA3C8"
              value={pesquisa}
              onChangeText={t => { setPesquisa(t); pesquisarUtilizador(t); }}
              returnKeyType="search"
            />
            {pesquisando
              ? <ActivityIndicator size="small" color={CL.azulMed} />
              : <Ionicons name="search" size={18} color={CL.cinza3} />}
          </TouchableOpacity>

          <View style={{ marginLeft: 4 }}>
            <Avatar uri={perfil?.fotoURL} nome={perfil?.nome} size={38} />
          </View>
        </View>

        {/* Resultado pesquisa */}
        {utilizadorEncontrado && (
          <View style={lb.searchResult}>
            <Avatar uri={utilizadorEncontrado.fotoURL} nome={utilizadorEncontrado.nome} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={lb.searchNome}>{utilizadorEncontrado.nome}</Text>
              <Text style={lb.searchId}>ID: {utilizadorEncontrado.connectAllId || utilizadorEncontrado.uid?.slice(0, 8)}</Text>
            </View>
            <TouchableOpacity style={lb.searchBtn} onPress={() => {
              const sid = `entrevista-${user?.uid}-${Date.now()}`;
              setSalaId(sid);
              setNomeEmpresa(utilizadorEncontrado.nome || 'Entrevista');
              setUtilizadorEncontrado(null);
              setPesquisa('');
              setTela('sala');
            }}>
              <Ionicons name="videocam" size={16} color="#fff" />
              <Text style={lb.searchBtnTxt}>Iniciar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CORPO ── */}
        {salasRecentes.length === 0 ? (
          <View style={lb.vazio}>
            <View style={lb.vazioIcone}>
              <Ionicons name="people-outline" size={80} color={CL.cinza3} style={{ opacity: 0.5 }} />
            </View>
            <Text style={lb.vazioTxt}>A sua actividade mais recente irá aparecer aqui</Text>
          </View>
        ) : (
          <FlatList
            data={salasRecentes}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
              <View style={lb.salaCard}>
                <View style={lb.salaIcone}>
                  <Ionicons name="videocam" size={20} color={CL.azulMed} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={lb.salaTitulo} numberOfLines={1}>{item.titulo || 'Entrevista'}</Text>
                  <Text style={lb.salaInfo}>{item.nomeEmpresa}</Text>
                </View>
                <TouchableOpacity style={lb.salaBtn} onPress={() => {
                  setSalaId(item.salaId);
                  setNomeEmpresa(item.nomeEmpresa || 'Entrevista');
                  setTela('sala');
                }}>
                  <Ionicons name="enter-outline" size={18} color={CL.azulMed} />
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        {/* ── BOTÃO NOVAS ── */}
        <TouchableOpacity style={lb.btnNovas} onPress={() => setModalNovas(true)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={22} color={CL.azulMed} />
          <Text style={lb.btnNovasTxt}>Novas</Text>
        </TouchableOpacity>

        {/* ══ MODAL MENU LATERAL ══ */}
        <Modal visible={modalMenu} transparent animationType="none" onRequestClose={fecharMenu}>
          <TouchableOpacity style={lb.drawerOverlay} activeOpacity={1} onPress={fecharMenu}>
            <Animated.View style={[lb.drawer, { transform: [{ translateX: drawerAnim }] }]}>
              <TouchableOpacity activeOpacity={1}>
                <View style={lb.drawerHeader}>
                  <Text style={lb.drawerTitulo}>ConnectAll</Text>
                  <Text style={lb.drawerSub}>Entrevistas</Text>
                </View>
                {[
                  { icone: 'person-outline',          label: 'Perfil',                rota: '/(main)/my-profile' },
                  { icone: 'notifications-outline',   label: 'Notificações',          rota: '/(main)/notifications' },
                  { icone: 'settings-outline',        label: 'Definições',            rota: '/(auth)/profile' },
                  { icone: 'shield-checkmark-outline',label: 'Privacidade',           rota: null },
                  { icone: 'help-circle-outline',     label: 'Ajuda e comentários',  rota: null },
                ].map((item, i) => (
                  <TouchableOpacity key={i} style={lb.drawerItem} onPress={() => { fecharMenu(); if (item.rota) router.push(item.rota); }}>
                    <Ionicons name={item.icone} size={22} color={CL.cinza4} />
                    <Text style={lb.drawerItemTxt}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* ══ MODAL NOVAS ══ */}
        <Modal visible={modalNovas} transparent animationType="slide" onRequestClose={() => setModalNovas(false)}>
          <View style={lb.modalOverlay}>
            <View style={lb.modalSheet}>
              <View style={lb.modalHandle} />
              <Text style={lb.modalTitulo}>Nova entrevista</Text>

              {/* Pesquisa */}
              <View style={lb.modalSearch}>
                <Ionicons name="search-outline" size={16} color={CL.cinza3} />
                <TextInput
                  style={lb.modalSearchInput}
                  placeholder="Pesquisar ID do utilizador..."
                  placeholderTextColor="#9BA3C8"
                  value={pesquisa}
                  onChangeText={t => { setPesquisa(t); pesquisarUtilizador(t); }}
                />
              </View>

              {utilizadorEncontrado && (
                <View style={lb.searchResult}>
                  <Avatar uri={utilizadorEncontrado.fotoURL} nome={utilizadorEncontrado.nome} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={lb.searchNome}>{utilizadorEncontrado.nome}</Text>
                  </View>
                  <TouchableOpacity style={lb.searchBtn} onPress={() => {
                    const sid = `entrevista-${user?.uid}-${Date.now()}`;
                    setSalaId(sid);
                    setNomeEmpresa(utilizadorEncontrado.nome || 'Entrevista');
                    setModalNovas(false);
                    setUtilizadorEncontrado(null);
                    setTela('sala');
                  }}>
                    <Ionicons name="videocam" size={16} color="#fff" />
                    <Text style={lb.searchBtnTxt}>Iniciar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Opções */}
              {/* Entrar na sala */}
              <TouchableOpacity style={lb.opCard} onPress={() => { setModalNovas(false); setModalEntrarCod(true); }}>
                <View style={lb.opIcone}><Ionicons name="enter-outline" size={22} color={CL.azulMed} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={lb.opLabel}>Entrar na sala</Text>
                  <Text style={lb.opSub}>Introduz o código para entrar</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={CL.cinza3} />
              </TouchableOpacity>

              {/* Gerar código (só recrutador) */}
              {eRecrutador && (
                <TouchableOpacity style={lb.opCard} onPress={gerarCodigo} disabled={gerandoCodigo}>
                  <View style={lb.opIcone}>
                    {gerandoCodigo
                      ? <ActivityIndicator size="small" color={CL.azulMed} />
                      : <Ionicons name="link-outline" size={22} color={CL.azulMed} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lb.opLabel}>Gerar código de convite</Text>
                    <Text style={lb.opSub}>Cria um código de uso único (4h)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={CL.cinza3} />
                </TouchableOpacity>
              )}

              {/* Agendar */}
              <TouchableOpacity style={lb.opCard} onPress={() => { setModalNovas(false); setModalAgendar(true); }}>
                <View style={lb.opIcone}><Ionicons name="calendar-outline" size={22} color={CL.azulMed} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={lb.opLabel}>Agendar</Text>
                  <Text style={lb.opSub}>Agenda uma entrevista para mais tarde</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={CL.cinza3} />
              </TouchableOpacity>

              {/* Chamada em grupo */}
              <TouchableOpacity style={lb.opCard} onPress={() => { setModalNovas(false); setModalGrupo(true); }}>
                <View style={lb.opIcone}><Ionicons name="people-outline" size={22} color={CL.azulMed} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={lb.opLabel}>Chamada em grupo</Text>
                  <Text style={lb.opSub}>Selecciona vários participantes</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={CL.cinza3} />
              </TouchableOpacity>

              <TouchableOpacity style={lb.modalBtnCancelar} onPress={() => setModalNovas(false)}>
                <Text style={lb.modalBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ══ MODAL CÓDIGO GERADO ══ */}
        <Modal visible={modalCodigo} transparent animationType="slide" onRequestClose={() => setModalCodigo(false)}>
          <View style={lb.modalOverlay}>
            <View style={[lb.modalSheet, { paddingBottom: 32 }]}>
              <View style={lb.modalHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Text style={lb.modalTitulo}>Código de convite</Text>
                <TouchableOpacity onPress={() => setModalCodigo(false)}>
                  <Ionicons name="close" size={22} color={CL.cinza3} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: CL.cinza3, textAlign: 'center' }}>
                Partilha este código com o candidato.{'\n'}⏰ Válido por 4 horas · Uso único
              </Text>

              {/* Código */}
              <View style={lb.codigoBox}>
                <Text style={lb.codigoTxt}>{codigoGerado}</Text>
              </View>

              {/* Box partilha estilo Google Meet */}
              <View style={lb.partilharBox}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: CL.azulMed, fontWeight: '600' }} numberOfLines={1}>
                    Código: {codigoGerado}
                  </Text>
                  <Text style={{ fontSize: 11, color: CL.cinza3, marginTop: 2 }}>Válido por 4h · Uso único</Text>
                </View>
                <TouchableOpacity style={lb.partilharCopyBtn} onPress={copiarCodigoLobby}>
                  <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={20} color={CL.azulMed} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 11, color: CL.cinza3, textAlign: 'center' }}>
                App → Entrevistas → Novas → "Entrar na sala"
              </Text>

              <TouchableOpacity style={[lb.btnPrimario, { backgroundColor: copiado ? CL.verde : CL.azulMed }]} onPress={copiarCodigoLobby}>
                <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={18} color="#fff" />
                <Text style={lb.btnPrimarioTxt}>{copiado ? 'Copiado!' : 'Copiar código e mensagem'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[lb.btnPrimario, { backgroundColor: '#25D366' }]} onPress={enviarWhatsAppLobby}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={lb.btnPrimarioTxt}>Enviar por WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[lb.btnPrimario, { backgroundColor: CL.azul }]} onPress={() => iniciarSalaDirecta(salaIdGerada, perfil?.nome)}>
                <Ionicons name="enter-outline" size={18} color="#fff" />
                <Text style={lb.btnPrimarioTxt}>Participar na sala agora</Text>
              </TouchableOpacity>

              <TouchableOpacity style={lb.modalBtnCancelar} onPress={() => setModalCodigo(false)}>
                <Text style={lb.modalBtnCancelarTxt}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ══ MODAL ENTRAR COM CÓDIGO ══ */}
        <Modal visible={modalEntrarCod} transparent animationType="slide" onRequestClose={() => setModalEntrarCod(false)}>
          <View style={lb.modalOverlay}>
            <View style={lb.modalSheet}>
              <View style={lb.modalHandle} />
              <Text style={lb.modalTitulo}>Entrar na sala</Text>
              <Text style={{ fontSize: 13, color: CL.cinza3, textAlign: 'center' }}>
                Introduz o código que o recrutador te enviou
              </Text>

              <View style={lb.codigoInputWrap}>
                <TextInput
                  style={lb.codigoInput}
                  value={codigoInput}
                  onChangeText={t => setCodigoInput(formatarCodigo(t))}
                  placeholder="CA-XXXXX"
                  placeholderTextColor={CL.cinza3}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                />
              </View>

              <Text style={{ fontSize: 11, color: CL.cinza3, textAlign: 'center' }}>
                Formato: CA-XXXXX · Válido por 4h · Uso único
              </Text>

              <TouchableOpacity
                style={[lb.btnPrimario, { backgroundColor: CL.azulMed, opacity: codigoInput.length < 7 ? 0.4 : 1 }]}
                onPress={entrarComCodigo}
                disabled={codigoInput.length < 7 || entrandoCod}
              >
                {entrandoCod
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="enter-outline" size={18} color="#fff" /><Text style={lb.btnPrimarioTxt}>Entrar na sala</Text></>}
              </TouchableOpacity>

              <TouchableOpacity style={lb.modalBtnCancelar} onPress={() => { setModalEntrarCod(false); setCodigoInput(''); }}>
                <Text style={lb.modalBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ══ MODAL CHAMADA EM GRUPO ══ */}
        <Modal visible={modalGrupo} transparent animationType="slide" onRequestClose={() => setModalGrupo(false)}>
          <View style={[lb.modalOverlay, { justifyContent: 'flex-end' }]}>
            <View style={[lb.modalSheet, { maxHeight: H * 0.85 }]}>
              <View style={lb.modalHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Text style={lb.modalTitulo}>Chamada em grupo</Text>
                <TouchableOpacity
                  style={[lb.searchBtn, { opacity: grupoSelecionados.length === 0 ? 0.4 : 1 }]}
                  onPress={iniciarChamadaGrupo}
                  disabled={grupoSelecionados.length === 0}
                >
                  <Text style={lb.searchBtnTxt}>Seguinte</Text>
                </TouchableOpacity>
              </View>

              {grupoSelecionados.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 80 }} contentContainerStyle={{ gap: 10, alignItems: 'center' }}>
                  {grupoSelecionados.map(u => (
                    <TouchableOpacity key={u.uid} onPress={() => toggleGrupo(u)} style={{ alignItems: 'center', gap: 4 }}>
                      <View style={{ position: 'relative' }}>
                        <Avatar uri={u.fotoURL} nome={u.nome} size={48} />
                        <View style={lb.removeChip}><Ionicons name="close" size={10} color="#fff" /></View>
                      </View>
                      <Text style={{ fontSize: 10, color: CL.cinza4, maxWidth: 52 }} numberOfLines={1}>{u.nome?.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={lb.modalSearch}>
                <Ionicons name="search-outline" size={16} color={CL.cinza3} />
                <TextInput style={lb.modalSearchInput} placeholder="Pesquisar ID..." placeholderTextColor="#9BA3C8" value={pesquisaGrupo} onChangeText={pesquisarGrupo} autoFocus />
              </View>

              {pesquisandoGrupo ? (
                <ActivityIndicator color={CL.azulMed} style={{ marginTop: 20 }} />
              ) : utilizadoresGrupo.length > 0 ? (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, width: '100%' }}>
                  {utilizadoresGrupo.map(u => {
                    const sel = !!grupoSelecionados.find(x => x.uid === u.uid);
                    return (
                      <TouchableOpacity key={u.uid} style={lb.grupoItem} onPress={() => toggleGrupo(u)}>
                        <Avatar uri={u.fotoURL} nome={u.nome} size={44} />
                        <View style={{ flex: 1 }}>
                          <Text style={lb.grupoNome}>{u.nome}</Text>
                          <Text style={lb.grupoId}>ID: {u.connectAllId || u.uid?.slice(0, 8)}</Text>
                        </View>
                        <View style={[lb.grupoCheck, sel && lb.grupoCheckSel]}>
                          {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
                  <Ionicons name="people-outline" size={48} color={CL.cinza2} />
                  <Text style={{ color: CL.cinza3, fontSize: 14 }}>Pesquisa pelo ID do utilizador</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ══ MODAL AGENDAR ══ */}
        <Modal visible={modalAgendar} transparent animationType="slide" onRequestClose={() => setModalAgendar(false)}>
          <View style={lb.modalOverlay}>
            <View style={lb.modalSheet}>
              <View style={lb.modalHandle} />
              <View style={lb.modalIconeWrap}><Ionicons name="calendar" size={36} color={CL.azulMed} /></View>
              <Text style={lb.modalTitulo}>Agendar entrevista</Text>
              <Text style={{ fontSize: 13, color: CL.cinza3, textAlign: 'center', lineHeight: 20 }}>
                Funcionalidade em breve.{'\n'}Poderás agendar entrevistas e enviar convites por data e hora.
              </Text>
              <TouchableOpacity style={[lb.btnPrimario, { backgroundColor: CL.azulMed }]} onPress={() => setModalAgendar(false)}>
                <Text style={lb.btnPrimarioTxt}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ════════════════════ RENDER — SALA ═════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  if (ecraCarga) {
    return (
      <View style={es.ecraCarga}>
        <StatusBar barStyle="light-content" backgroundColor={CS.fundo} />
        <View style={es.logoCarga}><Ionicons name="videocam" size={48} color={CS.azul} /></View>
        <ActivityIndicator color={CS.azul} size="large" style={{ marginTop: 24 }} />
        <Text style={es.cargaTitulo}>A ligar à sala...</Text>
        <Text style={es.cargaSub}>Aguarda enquanto estabelecemos a ligação segura</Text>
        <View style={es.cargaPassos}>
          {['A verificar credenciais', 'A ligar ao servidor', 'A preparar áudio'].map((p, i) => (
            <View key={i} style={es.cargaPasso}>
              <Ionicons name="checkmark-circle" size={16} color={CS.verde} />
              <Text style={es.cargaPassoTxt}>{p}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const participantes = [{ uid: meuUidAgora, nome: meuNome, foto: minhaFoto, local: true }, ...remotos];

  return (
    <View style={es.safe}>
      <StatusBar barStyle="light-content" backgroundColor={CS.fundo} />

      {/* HEADER SALA */}
      <View style={es.header}>
        <View style={es.headerEsq}>
          <View style={es.empresaLogoBg}><Ionicons name="briefcase" size={16} color={CS.azul} /></View>
          <View>
            <Text style={es.empresaNome} numberOfLines={1}>{nomeEmpresa}</Text>
            <Text style={es.headerSub}>Entrevista em curso</Text>
          </View>
        </View>
        <View style={es.headerDir}>
          <View style={es.redeWrap}>
            <Ionicons name="wifi" size={14} color={qualidadeRede === 'boa' ? CS.verde : qualidadeRede === 'media' ? CS.amarelo : CS.vermelho} />
            <Text style={[es.redeTxt, { color: qualidadeRede === 'boa' ? CS.verde : qualidadeRede === 'media' ? CS.amarelo : CS.vermelho }]}>
              {qualidadeRede === 'boa' ? 'Boa' : qualidadeRede === 'media' ? 'Média' : 'Fraca'}
            </Text>
          </View>
          <View style={es.tempoBadge}>
            <Ionicons name="time-outline" size={13} color={CS.azulClaro} />
            <Text style={es.tempoTxt}>{formatarTempo(segundos)}</Text>
          </View>
        </View>
      </View>

      {erroLigacao && (
        <View style={es.erroBanner}>
          <Ionicons name="warning-outline" size={16} color={CS.amarelo} />
          <Text style={es.erroBannerTxt}>{erroLigacao}</Text>
          <TouchableOpacity onPress={() => setErroLigacao(null)}><Ionicons name="close" size={16} color={CS.cinzaClaro} /></TouchableOpacity>
        </View>
      )}

      {/* ÁREA VÍDEO */}
      <View style={es.areaVideo}>
        {remotos.length > 0 ? (
          <View style={es.videoRemotoWrap}>
            <RtcSurfaceView style={es.videoRemoto} canvas={{ uid: remotos[0].uid, sourceType: VideoSourceType.VideoSourceRemote }} />
            <View style={es.videoRemotoOverlay}><Text style={es.videoNome}>{remotos[0].nome}</Text></View>
          </View>
        ) : (
          <View style={es.aguardandoWrap}>
            <View style={es.aguardandoIcone}><Ionicons name="person-add-outline" size={52} color={CS.cinza} /></View>
            <Text style={es.aguardandoTitulo}>À espera de participantes</Text>
            <Text style={es.aguardandoSub}>{ligado ? 'Sala pronta. Aguarda que a outra pessoa entre.' : 'A estabelecer ligação de áudio...'}</Text>
            {eRecrutador && ligado && (
              <TouchableOpacity style={es.diaConvidarBtn} onPress={abrirConvidar}>
                <Ionicons name="person-add-outline" size={16} color={CS.azul} />
                <Text style={es.dicaConvidarTxt}>Convidar candidato com código</Text>
              </TouchableOpacity>
            )}
            <View style={es.aguardandoPulso}>
              <View style={[es.ligacaoDot, { backgroundColor: ligado ? CS.verde : erroLigacao ? CS.vermelho : CS.amarelo }]} />
              <Text style={es.aguardandoPulsoTxt}>{ligado ? 'Áudio activo' : erroLigacao ? 'Sem áudio' : 'A ligar...'}</Text>
            </View>
          </View>
        )}

        {/* Vídeo local */}
        <TouchableOpacity style={es.videoLocalWrap} onPress={() => { AgoraEngine.switchCamera(); setCamaraAtiva(p => p); }} activeOpacity={0.9}>
          {camaraAtiva ? (
            <RtcSurfaceView style={es.videoLocal} canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }} />
          ) : (
            <View style={es.videoLocalAvatarWrap}>
              {minhaFoto ? <Image source={{ uri: minhaFoto }} style={es.videoLocalAvatar} /> : (
                <View style={es.videoLocalAvatarFallback}><Text style={es.videoLocalAvatarIni}>{(meuNome || 'U')[0].toUpperCase()}</Text></View>
              )}
              <View style={es.micDesligado}>{!micAtivo && <Ionicons name="mic-off" size={10} color={CS.vermelho} />}</View>
            </View>
          )}
          <View style={es.videoLocalLabel}><Text style={es.videoLocalNome} numberOfLines={1}>{meuNome} (Tu)</Text></View>
        </TouchableOpacity>

        {maoLevantada && (
          <Animated.View style={[es.maoIndicador, { transform: [{ scale: maoAnim }] }]}>
            <Text style={es.maoEmoji}>✋</Text>
          </Animated.View>
        )}
      </View>

      {/* BARRA CONTROLOS */}
      <View style={es.barra}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={es.barraScroll}>
          <BtnControlo icone={micAtivo ? 'mic' : 'mic-off'} label={micAtivo ? 'Mudo' : 'Ativo'} ativo={micAtivo} onPress={toggleMic} />
          <BtnControlo icone={camaraAtiva ? 'videocam' : 'videocam-off'} label="Câmara" ativo={camaraAtiva} onPress={toggleCamara} />
          {camaraAtiva && <BtnControlo icone="camera-reverse-outline" label="Rodar" onPress={() => AgoraEngine.switchCamera()} />}
          <BtnControlo icone="chatbubble-ellipses-outline" label="Chat" onPress={abrirChat} badge={msgNaoLidas} />
          <BtnControlo icone="document-attach-outline" label="Docs" onPress={() => { setPainelDocs(true); setPainelChat(false); setPainelParticipantes(false); }} />
          <BtnControlo icone="people-outline" label="Pessoas" onPress={() => { setPainelParticipantes(true); setPainelChat(false); setPainelDocs(false); }} />
          {eRecrutador && <BtnControlo icone="person-add-outline" label="Convidar" onPress={abrirConvidar} />}
          <BtnControlo icone="hand-left-outline" label={maoLevantada ? 'Baixar' : 'Mão'} ativo={!maoLevantada} onPress={toggleMao} />
          <BtnControlo
            icone={partilhandoEcra ? 'phone-portrait' : 'phone-portrait-outline'}
            label="Ecrã"
            laranja={partilhandoEcra}
            ativo={partilhandoEcra}
            onPress={togglePartilharEcra}
          />
          {eRecrutador && <BtnControlo icone="stop-circle-outline" label="Encerrar" vermelho onPress={encerrarSala} />}
          <BtnControlo icone="exit-outline" label="Sair" vermelho onPress={() => setModalSair(true)} />
        </ScrollView>
      </View>

      {/* PAINÉIS */}
      {painelChat && (
        <View style={es.painel}>
          <View style={es.painelHeader}>
            <Text style={es.painelTitulo}>💬 Chat</Text>
            <TouchableOpacity onPress={() => setPainelChat(false)}><Ionicons name="close" size={22} color={CS.branco} /></TouchableOpacity>
          </View>
          <FlatList
            ref={chatRef}
            data={mensagens}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              if (item.tipo === 'sistema') return <View style={es.msgSistema}><Text style={es.msgSistemaTxt}>{item.texto}</Text></View>;
              const minha = item.uid === user?.uid;
              return (
                <View style={[es.msgWrap, minha && es.msgWrapMinha]}>
                  {!minha && (
                    <View style={es.msgAvatar}>
                      {item.foto ? <Image source={{ uri: item.foto }} style={es.msgAvatarImg} /> : <Text style={es.msgAvatarIni}>{(item.nome || 'U')[0]}</Text>}
                    </View>
                  )}
                  <View style={[es.msgBubble, minha && es.msgBubbleMinha]}>
                    {!minha && <Text style={es.msgNome}>{item.nome}</Text>}
                    <Text style={es.msgTxt}>{item.texto}</Text>
                    <Text style={es.msgHora}>{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                  </View>
                </View>
              );
            }}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={es.chatInput}>
              <TextInput style={es.chatInputField} placeholder="Escreve..." placeholderTextColor={CS.cinza} value={novaMensagem} onChangeText={setNovaMensagem} multiline maxLength={500} />
              <TouchableOpacity style={[es.chatSendBtn, !novaMensagem.trim() && { opacity: 0.4 }]} onPress={enviarMensagem} disabled={!novaMensagem.trim()}>
                <Ionicons name="send" size={18} color={CS.branco} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {painelParticipantes && (
        <View style={es.painel}>
          <View style={es.painelHeader}>
            <Text style={es.painelTitulo}>👥 Participantes ({participantes.length})</Text>
            <TouchableOpacity onPress={() => setPainelParticipantes(false)}><Ionicons name="close" size={22} color={CS.branco} /></TouchableOpacity>
          </View>
          <FlatList
            data={participantes}
            keyExtractor={item => String(item.uid)}
            contentContainerStyle={{ padding: 12, gap: 10 }}
            renderItem={({ item }) => (
              <View style={es.partItem}>
                <View style={es.partAvatar}>
                  {item.foto ? <Image source={{ uri: item.foto }} style={es.partAvatarImg} /> : <View style={es.partAvatarFb}><Text style={es.partAvatarIni}>{(item.nome || 'P')[0]}</Text></View>}
                  <View style={[es.partStatus, { backgroundColor: CS.verde }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={es.partNome}>{item.nome}{item.local ? ' (Tu)' : ''}</Text>
                  <Text style={es.partPapel}>{item.local ? papel : 'Participante'}</Text>
                </View>
                <View style={es.partIcones}>
                  <Ionicons name="mic" size={14} color={CS.verde} />
                  {camaraAtiva && item.local && <Ionicons name="videocam" size={14} color={CS.verde} />}
                </View>
              </View>
            )}
          />
          {eRecrutador && (
            <TouchableOpacity style={es.btnConvidarPainel} onPress={abrirConvidar}>
              <Ionicons name="person-add-outline" size={18} color={CS.branco} />
              <Text style={es.btnConvidarPainelTxt}>Convidar candidato</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {painelDocs && (
        <View style={es.painel}>
          <View style={es.painelHeader}>
            <Text style={es.painelTitulo}>📄 Documentos</Text>
            <TouchableOpacity onPress={() => setPainelDocs(false)}><Ionicons name="close" size={22} color={CS.branco} /></TouchableOpacity>
          </View>
          <TouchableOpacity style={es.btnPartilharDoc} onPress={partilharDocumento} disabled={envDoc}>
            {envDoc ? <ActivityIndicator color={CS.branco} /> : <><Ionicons name="cloud-upload-outline" size={20} color={CS.branco} /><Text style={es.btnPartilharDocTxt}>Partilhar documento</Text></>}
          </TouchableOpacity>
          <Text style={es.docsSubtitle}>PDF · Word · Imagens · CV</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
            {documentos.length === 0 ? (
              <View style={es.docsVazio}><Ionicons name="document-outline" size={40} color={CS.cinza} /><Text style={es.docsVazioTxt}>Nenhum documento partilhado</Text></View>
            ) : documentos.map((d, i) => (
              <View key={i} style={es.docItem}>
                <Ionicons name="document-text-outline" size={22} color={CS.azulClaro} />
                <View style={{ flex: 1 }}><Text style={es.docNome} numberOfLines={1}>{d.nome}</Text><Text style={es.docEnviado}>Enviado por {d.enviadoPor}</Text></View>
                <TouchableOpacity><Ionicons name="download-outline" size={18} color={CS.cinzaClaro} /></TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* MODAL CONVIDAR */}
      <Modal visible={modalConvidar} transparent animationType="slide" onRequestClose={() => setModalConvidar(false)}>
        <View style={es.modalOverlay}>
          <View style={es.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Text style={es.modalTitulo}>Convidar para a sala</Text>
              <TouchableOpacity onPress={() => setModalConvidar(false)}><Ionicons name="close" size={22} color={CS.cinzaClaro} /></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: CS.textoSub, textAlign: 'center' }}>Partilha este código. ⏰ 4h · Uso único</Text>
            {codigoSala ? (
              <>
                <View style={es.codigoWrap}><Text style={es.codigoTxt}>{codigoSala}</Text></View>
                <Text style={{ fontSize: 11, color: CS.textoSub, textAlign: 'center' }}>App → Entrevistas → Novas → "Entrar na sala"</Text>
                <TouchableOpacity style={[es.modalBtnSair, { backgroundColor: copiadoSala ? CS.verde : CS.azul, flexDirection: 'row', gap: 8 }]} onPress={copiarCodigoSala}>
                  <Ionicons name={copiadoSala ? 'checkmark' : 'copy-outline'} size={18} color={CS.branco} />
                  <Text style={es.modalBtnSairTxt}>{copiadoSala ? 'Copiado!' : 'Copiar código e mensagem'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[es.modalBtnSair, { backgroundColor: '#25D366', flexDirection: 'row', gap: 8 }]} onPress={enviarWhatsAppSala}>
                  <Ionicons name="logo-whatsapp" size={18} color={CS.branco} />
                  <Text style={es.modalBtnSairTxt}>Enviar por WhatsApp</Text>
                </TouchableOpacity>
              </>
            ) : <ActivityIndicator color={CS.azul} size="large" style={{ marginVertical: 24 }} />}
            <TouchableOpacity style={es.modalBtnCancelar} onPress={() => setModalConvidar(false)}><Text style={es.modalBtnCancelarTxt}>Fechar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL SAIR */}
      <Modal visible={modalSair} transparent animationType="fade" onRequestClose={() => setModalSair(false)}>
        <View style={es.modalOverlay}>
          <View style={es.modalCard}>
            <View style={es.modalIconeWrap}><Ionicons name="exit-outline" size={36} color={CS.vermelho} /></View>
            <Text style={es.modalTitulo}>Sair da entrevista?</Text>
            <Text style={es.modalSub}>A ligação será encerrada.</Text>
            <TouchableOpacity style={es.modalBtnSair} onPress={sair}><Text style={es.modalBtnSairTxt}>Sair</Text></TouchableOpacity>
            <TouchableOpacity style={es.modalBtnCancelar} onPress={() => setModalSair(false)}><Text style={es.modalBtnCancelarTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL AVALIAÇÃO */}
      <Modal visible={modalAvaliacao} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={es.modalOverlay}>
          <View style={[es.modalCard, { maxHeight: H * 0.75 }]}>
            <Ionicons name="star" size={36} color={CS.amarelo} />
            <Text style={es.modalTitulo}>Como foi a entrevista?</Text>
            <Text style={es.modalSub}>A tua opinião ajuda-nos a melhorar</Text>
            <View style={es.estrelasRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity key={i} onPress={() => setEstrelas(i)}>
                  <Ionicons name={i <= estrelas ? 'star' : 'star-outline'} size={36} color={CS.amarelo} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={es.avaliacaoInput} placeholder="Partilha a tua experiência..." placeholderTextColor={CS.cinza} value={notaAvaliacao} onChangeText={setNotaAvaliacao} multiline maxLength={300} />
            <TouchableOpacity style={[es.modalBtnSair, { backgroundColor: CS.azul }]} onPress={submeterAvaliacao}><Text style={es.modalBtnSairTxt}>Submeter e sair</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setModalAvaliacao(false); setTela('lobby'); setSalaId(null); }}><Text style={[es.modalBtnCancelarTxt, { color: CS.cinzaClaro }]}>Saltar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ESTILOS LOBBY
// ════════════════════════════════════════════════════════════════════════════════
const lb = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CL.fundo },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  menuBtn: { padding: 4 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CL.card, borderRadius: 28, paddingHorizontal: 16, paddingVertical: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  searchInput: { flex: 1, fontSize: 14, color: CL.preto },
  searchResult: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CL.card, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 12, elevation: 2 },
  searchNome: { fontSize: 14, fontWeight: '700', color: CL.preto },
  searchId:   { fontSize: 12, color: CL.cinza3, marginTop: 1 },
  searchBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CL.azulMed, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  searchBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  vazioIcone: { width: 180, height: 180, borderRadius: 90, backgroundColor: CL.azulClaro, alignItems: 'center', justifyContent: 'center' },
  vazioTxt: { fontSize: 15, color: CL.cinza4, textAlign: 'center', lineHeight: 22 },
  salaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CL.card, borderRadius: 12, padding: 14, elevation: 1 },
  salaIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: CL.azulClaro, alignItems: 'center', justifyContent: 'center' },
  salaTitulo: { fontSize: 14, fontWeight: '700', color: CL.preto },
  salaInfo:   { fontSize: 12, color: CL.cinza3, marginTop: 2 },
  salaBtn:    { padding: 8 },
  btnNovas: { position: 'absolute', bottom: 24, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CL.azulClaro, borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, elevation: 4 },
  btnNovasTxt: { fontSize: 15, fontWeight: '700', color: CL.azulMed },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: W * 0.75, backgroundColor: CL.card, paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingHorizontal: 16, elevation: 10 },
  drawerHeader: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: CL.cinza2 },
  drawerTitulo: { fontSize: 22, fontWeight: '800', color: CL.azul },
  drawerSub:    { fontSize: 14, color: CL.cinza3, marginTop: 2 },
  drawerItem:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  drawerItemTxt:{ fontSize: 15, color: CL.cinza4, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: CL.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40, gap: 14, alignItems: 'center' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: CL.cinza2, marginBottom: 6 },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: CL.preto, textAlign: 'center' },
  modalIconeWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: CL.azulClaro, alignItems: 'center', justifyContent: 'center' },
  modalSearch: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CL.cinza1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  modalSearchInput: { flex: 1, fontSize: 14, color: CL.preto },
  opCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CL.azulClaro, borderRadius: 14, padding: 16 },
  opIcone: { width: 42, height: 42, borderRadius: 21, backgroundColor: CL.card, alignItems: 'center', justifyContent: 'center' },
  opLabel: { fontSize: 14, fontWeight: '700', color: CL.preto },
  opSub:   { fontSize: 12, color: CL.cinza3, marginTop: 2 },
  btnPrimario: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  btnPrimarioTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  modalBtnCancelar: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  modalBtnCancelarTxt: { fontSize: 14, color: CL.cinza3, fontWeight: '600' },
  codigoBox: { width: '100%', backgroundColor: CL.azulClaro, borderRadius: 16, paddingVertical: 20, alignItems: 'center', borderWidth: 2, borderColor: CL.cinza2 },
  codigoTxt: { fontSize: 34, fontWeight: '900', color: CL.azul, letterSpacing: 6, fontVariant: ['tabular-nums'] },
  codigoInputWrap: { width: '100%' },
  codigoInput: { backgroundColor: CL.cinza1, borderRadius: 16, borderWidth: 2, borderColor: CL.azulMed, paddingHorizontal: 24, paddingVertical: 16, fontSize: 28, fontWeight: '800', color: CL.preto, textAlign: 'center', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  partilharBox: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', borderWidth: 1, borderColor: CL.cinza2, borderRadius: 10, padding: 12 },
  partilharCopyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: CL.azulClaro, alignItems: 'center', justifyContent: 'center' },
  grupoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: CL.cinza2, width: '100%' },
  grupoNome: { fontSize: 14, fontWeight: '600', color: CL.preto },
  grupoId:   { fontSize: 12, color: CL.cinza3, marginTop: 1 },
  grupoCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: CL.cinza2, backgroundColor: CL.cinza1, alignItems: 'center', justifyContent: 'center' },
  grupoCheckSel: { backgroundColor: CL.azulMed, borderColor: CL.azulMed },
  removeChip: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: CL.vermelho, alignItems: 'center', justifyContent: 'center' },
});

// ════════════════════════════════════════════════════════════════════════════════
// ESTILOS SALA
// ════════════════════════════════════════════════════════════════════════════════
const es = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CS.fundo },
  ecraCarga: { flex: 1, backgroundColor: CS.fundo, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoCarga: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#0D1220', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CS.azul },
  cargaTitulo: { fontSize: 20, fontWeight: '700', color: CS.branco, marginTop: 16 },
  cargaSub:    { fontSize: 13, color: CS.textoSub, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  cargaPassos: { marginTop: 28, gap: 10, alignSelf: 'flex-start' },
  cargaPasso:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cargaPassoTxt:{ fontSize: 13, color: CS.textoSub },
  erroBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A1500', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#3D3000' },
  erroBannerTxt:{ flex: 1, fontSize: 12, color: CS.amarelo },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CS.fundoBarra, borderBottomWidth: 1, borderBottomColor: '#1A2235' },
  headerEsq: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  empresaLogoBg: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#0D1729', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CS.azul },
  empresaNome: { fontSize: 14, fontWeight: '700', color: CS.branco, maxWidth: W * 0.45 },
  headerSub:   { fontSize: 11, color: CS.textoSub, marginTop: 1 },
  headerDir:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  redeWrap:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  redeTxt:     { fontSize: 11, fontWeight: '600' },
  tempoBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0D1729', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#1A2235' },
  tempoTxt:    { fontSize: 13, fontWeight: '700', color: CS.azulClaro, fontVariant: ['tabular-nums'] },
  areaVideo:   { flex: 1, backgroundColor: '#050810', position: 'relative' },
  videoRemotoWrap: { flex: 1 },
  videoRemoto: { flex: 1 },
  videoRemotoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  videoNome: { color: CS.branco, fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  aguardandoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  aguardandoIcone: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#0D1220', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1A2235' },
  aguardandoTitulo: { fontSize: 18, fontWeight: '700', color: CS.branco },
  aguardandoSub:    { fontSize: 13, color: CS.textoSub, textAlign: 'center', maxWidth: 260 },
  aguardandoPulso:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  aguardandoPulsoTxt: { fontSize: 12, color: CS.azulClaro },
  ligacaoDot: { width: 8, height: 8, borderRadius: 4 },
  diaConvidarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0D2547', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: CS.azul },
  dicaConvidarTxt:{ fontSize: 13, fontWeight: '700', color: CS.azul },
  videoLocalWrap: { position: 'absolute', top: 12, right: 12, width: 100, height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: CS.azul, backgroundColor: CS.fundoCard },
  videoLocal:     { width: '100%', height: '100%' },
  videoLocalAvatarWrap:    { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1220' },
  videoLocalAvatar:        { width: 52, height: 52, borderRadius: 26 },
  videoLocalAvatarFallback:{ width: 52, height: 52, borderRadius: 26, backgroundColor: CS.azul, alignItems: 'center', justifyContent: 'center' },
  videoLocalAvatarIni:     { color: CS.branco, fontSize: 20, fontWeight: '800' },
  videoLocalLabel:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 4 },
  videoLocalNome:          { color: CS.branco, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  micDesligado:            { position: 'absolute', bottom: 4, right: 4 },
  maoIndicador: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  maoEmoji:     { fontSize: 24 },
  barra:        { backgroundColor: CS.fundoBarra, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1A2235' },
  barraScroll:  { paddingHorizontal: 8, gap: 6 },
  btnCtrl:      { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, gap: 4, minWidth: 60, position: 'relative' },
  btnCtrlTxt:   { fontSize: 10, fontWeight: '600' },
  badge:        { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: CS.vermelho, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  badgeTxt:     { color: CS.branco, fontSize: 9, fontWeight: '900' },
  painel:       { position: 'absolute', top: 0, right: 0, bottom: 0, width: W * 0.88, backgroundColor: CS.fundoCard, borderLeftWidth: 1, borderLeftColor: '#1A2235', zIndex: 20 },
  painelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A2235' },
  painelTitulo: { fontSize: 15, fontWeight: '700', color: CS.branco },
  btnConvidarPainel:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 12, backgroundColor: CS.azul, borderRadius: 12, paddingVertical: 14 },
  btnConvidarPainelTxt: { fontSize: 14, fontWeight: '700', color: CS.branco },
  msgSistema:    { alignItems: 'center', paddingVertical: 4 },
  msgSistemaTxt: { fontSize: 11, color: CS.cinza, fontStyle: 'italic' },
  msgWrap:       { flexDirection: 'row', gap: 8, maxWidth: '85%', alignSelf: 'flex-start' },
  msgWrapMinha:  { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: CS.azul, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  msgAvatarImg:  { width: 32, height: 32 },
  msgAvatarIni:  { color: CS.branco, fontSize: 12, fontWeight: '700' },
  msgBubble:     { backgroundColor: '#1A2235', borderRadius: 12, padding: 10, gap: 3 },
  msgBubbleMinha:{ backgroundColor: '#0D2547' },
  msgNome:       { fontSize: 11, fontWeight: '700', color: CS.azulClaro, marginBottom: 2 },
  msgTxt:        { fontSize: 13, color: CS.texto, lineHeight: 19 },
  msgHora:       { fontSize: 10, color: CS.cinza, alignSelf: 'flex-end', marginTop: 2 },
  chatInput:     { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: '#1A2235', gap: 8 },
  chatInputField:{ flex: 1, backgroundColor: '#1A2235', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, color: CS.texto, fontSize: 13, maxHeight: 80 },
  chatSendBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: CS.azul, alignItems: 'center', justifyContent: 'center' },
  partItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A2235', borderRadius: 12, padding: 12 },
  partAvatar:    { position: 'relative' },
  partAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  partAvatarFb:  { width: 42, height: 42, borderRadius: 21, backgroundColor: CS.azul, alignItems: 'center', justifyContent: 'center' },
  partAvatarIni: { color: CS.branco, fontSize: 16, fontWeight: '700' },
  partStatus:    { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: CS.fundoCard },
  partNome:      { fontSize: 14, fontWeight: '600', color: CS.branco },
  partPapel:     { fontSize: 11, color: CS.textoSub, textTransform: 'capitalize' },
  partIcones:    { flexDirection: 'row', gap: 6 },
  btnPartilharDoc:    { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: CS.azul, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  btnPartilharDocTxt: { color: CS.branco, fontSize: 14, fontWeight: '700' },
  docsSubtitle:  { fontSize: 11, color: CS.cinza, textAlign: 'center', marginBottom: 4 },
  docsVazio:     { alignItems: 'center', paddingVertical: 40, gap: 10 },
  docsVazioTxt:  { fontSize: 13, color: CS.cinza, textAlign: 'center' },
  docItem:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A2235', borderRadius: 10, padding: 12 },
  docNome:       { fontSize: 13, fontWeight: '600', color: CS.branco },
  docEnviado:    { fontSize: 11, color: CS.cinza, marginTop: 2 },
  modalOverlay:  { flex: 1, backgroundColor: CS.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:     { backgroundColor: CS.fundoCard, borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#1A2235' },
  modalIconeWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2D1515', alignItems: 'center', justifyContent: 'center' },
  modalTitulo:   { fontSize: 20, fontWeight: '800', color: CS.branco, textAlign: 'center' },
  modalSub:      { fontSize: 13, color: CS.textoSub, textAlign: 'center', lineHeight: 20 },
  modalBtnSair:  { width: '100%', backgroundColor: CS.vermelho, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnSairTxt: { color: CS.branco, fontSize: 15, fontWeight: '700' },
  modalBtnCancelar: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  modalBtnCancelarTxt: { color: CS.cinzaClaro, fontSize: 14, fontWeight: '600' },
  estrelasRow:   { flexDirection: 'row', gap: 8, marginVertical: 8 },
  avaliacaoInput:{ width: '100%', backgroundColor: '#1A2235', borderRadius: 12, padding: 14, color: CS.texto, fontSize: 13, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#2A3547' },
  codigoWrap:    { backgroundColor: '#0D2547', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 20, borderWidth: 2, borderColor: CS.azul, alignItems: 'center', width: '100%' },
  codigoTxt:     { fontSize: 34, fontWeight: '900', color: CS.branco, letterSpacing: 6, fontVariant: ['tabular-nums'] },
});