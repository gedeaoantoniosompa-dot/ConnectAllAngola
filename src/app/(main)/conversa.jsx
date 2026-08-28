// conversa.jsx — ConnectAll Angola
// Fix: emissor para de tocar quando destinatário atende,
//      contador começa nos dois lados, áudio/vídeo funciona
// Fix 2: mensagens só são marcadas como lidas / naoLidas só é zerado
//        quando a conversa está mesmo em primeiro plano (useFocusEffect)

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, rtdb, storage } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { usePresenca } from '../../hooks/usePresenca';
import { usePrivacidade } from '../../hooks/usePrivacidade';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  RtcSurfaceView,
  VideoSourceType,
} from '../../services/agoraNative';
import { enviarNotificacao } from '../../services/notificationService';

const FUNDO_CHAT   = require('../../../assets/slideshow/fundo-chat.png');
const AGORA_APP_ID = '4e413d4d82d14eeeb5f36a3853c846a3';
const SOM_ESPERA        = require('../../../assets/toqueEspera.mp3');
const SOM_NAO_ATENDIDA  = require('../../../assets/toqueNaoAtendida.mp3');

function getChatId(u1, u2)    { return [u1, u2].sort().join('_'); }
function formatarNome(n)       { return n?.trim() || 'Utilizador'; }
function primeiroNome(n)       { return n?.trim().split(/\s+/)[0] || 'utilizador'; }
function formatarHora(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}
function formatarDivisor(ts) {
  if (!ts) return '';
  const d  = ts.toDate ? ts.toDate() : new Date(ts);
  const h  = new Date();
  if (d.toDateString() === h.toDateString()) return 'Hoje';
  const o  = new Date(); o.setDate(h.getDate() - 1);
  if (d.toDateString() === o.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatarTempo(seg) {
  const m = Math.floor(seg / 60).toString().padStart(2, '0');
  const s = (seg % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const VERDE   = '#25D366';
const VERDE_WA = '#128C7E';
const HEADER  = '#1F2C34';
const WAVE_H  = [8,12,18,10,14,20,12,16,8,14,18,10,12,16,14,8];

/* ── AudioBubble ─────────────────────────────────────────────────────────── */
function AudioBubble({ uri, eMeu, duracao }) {
  const player    = useAudioPlayer(uri ? { uri } : null);
  const status    = useAudioPlayerStatus(player);
  const aTocar    = status?.playing ?? false;
  const posicao   = status?.currentTime ?? 0;
  const durReal   = status?.duration ?? duracao ?? 0;
  const wRef      = useRef(0);

  useEffect(() => {
    if (status?.didJustFinish) { player.seekTo(0); player.pause(); }
  }, [status?.didJustFinish]);

  const toggle = () => {
    if (aTocar) { player.pause(); }
    else { if (durReal > 0 && posicao >= durReal - 0.1) player.seekTo(0); player.play(); }
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: e => { const r = Math.max(0,Math.min(1,e.nativeEvent.locationX/(wRef.current||1))); if(durReal>0) player.seekTo(r*durReal); },
    onPanResponderMove:  e => { const r = Math.max(0,Math.min(1,e.nativeEvent.locationX/(wRef.current||1))); if(durReal>0) player.seekTo(r*durReal); },
  })).current;

  return (
    <View style={s.audioBox}>
      <TouchableOpacity onPress={toggle}>
        <Ionicons name={aTocar?'pause-circle':'play-circle'} size={32} color={eMeu?'#fff':'#25D366'} />
      </TouchableOpacity>
      <View style={s.audioOnda} onLayout={e=>{wRef.current=e.nativeEvent.layout.width;}} {...pan.panHandlers}>
        {WAVE_H.map((h,i)=>{
          const prog=posicao/(durReal||1); const r=(i+1)/WAVE_H.length; const ativo=r<=prog;
          return <View key={i} style={[s.audioBar,{height:h,backgroundColor:ativo?(eMeu?'#fff':'#128C7E'):(eMeu?'rgba(255,255,255,0.4)':'#ccc')}]} />;
        })}
      </View>
      <Text style={[s.audioDur,eMeu&&{color:'#fff'}]}>{formatarTempo(aTocar||posicao>0?Math.floor(posicao):(duracao||0))}</Text>
    </View>
  );
}

function Ticks({ eMeu, lida, entregue }) {
  if (!eMeu) return null;
  const cor = lida ? '#53BDEB' : 'rgba(255,255,255,0.6)';
  if (lida || entregue) return (
    <View style={{flexDirection:'row',marginLeft:3}}>
      <Ionicons name="checkmark" size={12} color={cor} />
      <Ionicons name="checkmark" size={12} color={cor} style={{marginLeft:-6}} />
    </View>
  );
  return <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.6)" style={{marginLeft:3}} />;
}

const SUGESTOES      = n => ['Olá 👋',`Olá, ${n}!`,'Como estás? 😊'];
const CAT_DENUNCIA   = [
  {key:'spam',   label:'Spam',       icon:'mail-unread-outline'},
  {key:'assedio',label:'Assédio',    icon:'sad-outline'},
  {key:'ameaca', label:'Ameaça',     icon:'warning-outline'},
  {key:'fraude', label:'Fraude',     icon:'alert-circle-outline'},
  {key:'impr',   label:'Impróprio',  icon:'eye-off-outline'},
  {key:'outro',  label:'Outro',      icon:'ellipsis-horizontal-outline'},
];

/* ══════════════════════════════════════════════
   TELA DE CHAMADA (emissor)
══════════════════════════════════════════════ */
function TelaChamada({ tipo, nome, foto, estado, tempo, micAtivo, altifalanteAtivo, cameraAtiva,
  remoteUid, onTerminar, onToggleMic, onToggleAltifalante, onToggleCamera, onLigarNovamente }) {
  const [modalAudio, setModalAudio] = useState(false);

  const textoEstado = () => {
    if (estado==='a_ligar')      return tipo==='voz' ? 'Chamada de áudio' : 'Chamada de vídeo';
    if (estado==='conectando')   return 'Conectando...';
    if (estado==='em_curso')     return formatarTempo(tempo);
    if (estado==='nao_atendida') return 'Não atendida';
    return '';
  };

  if (tipo !== 'video') {
    return (
      <View style={cs.safe}>
        <View style={cs.vozFundo}>
          {foto ? <Image source={{uri:foto}} style={cs.vozFundoImg} blurRadius={20}/> : <View style={[cs.vozFundoImg,{backgroundColor:'#1a1a2e'}]}/>}
          <View style={cs.vozFundoOverlay}/>
        </View>
        <SafeAreaView style={cs.vozHeader}>
          <TouchableOpacity style={cs.vozHeaderBtn}><Ionicons name="chevron-back" size={28} color="#fff"/></TouchableOpacity>
          {estado==='em_curso' && (
            <TouchableOpacity style={cs.vozHeaderBtn} onPress={()=>setModalAudio(true)}>
              <Ionicons name="volume-high-outline" size={26} color="#fff"/>
            </TouchableOpacity>
          )}
        </SafeAreaView>
        <View style={cs.vozCorpo}>
          {estado==='a_ligar'   && <Text style={cs.vozSub}>A ligar...</Text>}
          {estado==='em_curso'  && <Text style={cs.vozSub}>Chamada em curso</Text>}
          <Text style={cs.vozNome}>{formatarNome(nome)}</Text>
          <Text style={cs.vozEstado}>{textoEstado()}</Text>
          <View style={cs.vozAvatarWrap}>
            {foto ? <Image source={{uri:foto}} style={cs.vozAvatar}/>
              : <View style={[cs.vozAvatar,{backgroundColor:'#25D366',alignItems:'center',justifyContent:'center'}]}>
                  <Text style={{color:'#fff',fontSize:60,fontWeight:'800'}}>{nome?.[0]?.toUpperCase()}</Text>
                </View>}
          </View>
        </View>
        {estado==='nao_atendida' ? (
          <SafeAreaView style={cs.vozBotoesNA}>
            <TouchableOpacity style={cs.btnCancel} onPress={onTerminar}>
              <Ionicons name="close" size={28} color="#fff"/>
              <Text style={cs.btnLabel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.btnMic} onPress={()=>{}}>
              <Ionicons name="mic-outline" size={28} color="#fff"/>
              <Text style={cs.btnLabel}>Gravar mensagem</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.btnLigar} onPress={onLigarNovamente}>
              <Ionicons name="call" size={28} color="#fff"/>
              <Text style={cs.btnLabel}>Voltar a ligar</Text>
            </TouchableOpacity>
          </SafeAreaView>
        ) : (
          <SafeAreaView style={cs.vozBotoes}>
            <TouchableOpacity style={cs.btnSec} onPress={onToggleMic}>
              <Ionicons name={micAtivo?'mic-outline':'mic-off-outline'} size={26} color="#fff"/>
            </TouchableOpacity>
            <TouchableOpacity style={cs.btnTerminar} onPress={onTerminar}>
              <Ionicons name="call" size={30} color="#fff" style={{transform:[{rotate:'135deg'}]}}/>
            </TouchableOpacity>
            <TouchableOpacity style={cs.btnSec} onPress={onToggleAltifalante}>
              <Ionicons name={altifalanteAtivo?'volume-high':'volume-medium-outline'} size={26} color="#fff"/>
            </TouchableOpacity>
          </SafeAreaView>
        )}
        <Modal visible={modalAudio} transparent animationType="slide" onRequestClose={()=>setModalAudio(false)}>
          <TouchableWithoutFeedback onPress={()=>setModalAudio(false)}>
            <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.3)',justifyContent:'flex-end'}}/>
          </TouchableWithoutFeedback>
          <View style={cs.audioModal}>
            {[
              {icon:'volume-high-outline', label:'Altifalante', onPress:()=>{onToggleAltifalante();setModalAudio(false);}},
              {icon:'call-outline',        label:'Telefone',    onPress:()=>setModalAudio(false), check:!altifalanteAtivo},
              {icon:'volume-mute-outline', label:'Desativar som',onPress:()=>{onToggleMic();setModalAudio(false);}},
            ].map((o,i)=>(
              <TouchableOpacity key={i} style={cs.audioItem} onPress={o.onPress}>
                <Ionicons name={o.icon} size={22} color="#111"/>
                <Text style={cs.audioLabel}>{o.label}</Text>
                {o.check && <Ionicons name="checkmark" size={20} color="#007AFF" style={{marginLeft:'auto'}}/>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={cs.audioItem} onPress={()=>setModalAudio(false)}>
              <Ionicons name="close" size={20} color="#666"/>
              <Text style={[cs.audioLabel,{color:'#666'}]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    );
  }

  /* ── Videochamada ── */
  return (
    <View style={cs.safe}>
      {estado==='em_curso' && remoteUid ? (
        <RtcSurfaceView style={StyleSheet.absoluteFill}
          canvas={{uid:remoteUid, sourceType:VideoSourceType.VideoSourceRemote}}/>
      ) : (
        <View style={[StyleSheet.absoluteFill,{backgroundColor:'#0d1117'}]}>
          {foto ? <Image source={{uri:foto}} style={StyleSheet.absoluteFill} blurRadius={25}/> : null}
          <View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.6)'}]}/>
          <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
            {foto ? <Image source={{uri:foto}} style={cs.videoPoster}/>
              : <View style={[cs.videoPoster,{backgroundColor:'#25D366',alignItems:'center',justifyContent:'center'}]}>
                  <Text style={{color:'#fff',fontSize:48,fontWeight:'800'}}>{nome?.[0]?.toUpperCase()}</Text>
                </View>}
            <Text style={cs.videoNome}>{formatarNome(nome)}</Text>
            <Text style={cs.videoEstado}>{estado==='a_ligar'?'A ligar...':estado==='conectando'?'Conectando...':'Não atendida'}</Text>
          </View>
        </View>
      )}
      {/* Stream local miniatura */}
      {estado==='em_curso' && cameraAtiva && (
        <View style={cs.videoLocalWrap}>
          <RtcSurfaceView style={cs.videoLocal} canvas={{uid:0,sourceType:VideoSourceType.VideoSourceCamera}}/>
        </View>
      )}
      <SafeAreaView style={cs.videoHeader}>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          {foto && <Image source={{uri:foto}} style={{width:36,height:36,borderRadius:18}}/>}
          <View>
            <Text style={{color:'#fff',fontSize:16,fontWeight:'700'}}>{formatarNome(nome)}</Text>
            <Text style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>{estado==='em_curso'?formatarTempo(tempo):'A ligar...'}</Text>
          </View>
        </View>
        <Ionicons name="volume-high-outline" size={24} color="#fff"/>
      </SafeAreaView>
      {estado==='nao_atendida' ? (
        <SafeAreaView style={cs.vozBotoesNA}>
          <TouchableOpacity style={cs.btnCancel} onPress={onTerminar}>
            <Ionicons name="close" size={28} color="#fff"/>
            <Text style={cs.btnLabel}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cs.btnMic} onPress={()=>{}}>
            <Ionicons name="camera-outline" size={28} color="#fff"/>
            <Text style={cs.btnLabel}>Gravar nota</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cs.btnLigar} onPress={onLigarNovamente}>
            <Ionicons name="videocam" size={28} color="#fff"/>
            <Text style={cs.btnLabel}>Voltar a ligar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={cs.videoBotoes}>
          <TouchableOpacity style={cs.btnSec} onPress={onToggleCamera}>
            <Ionicons name={cameraAtiva?'videocam-outline':'videocam-off-outline'} size={26} color="#fff"/>
          </TouchableOpacity>
          <TouchableOpacity style={cs.btnSec} onPress={onToggleMic}>
            <Ionicons name={micAtivo?'mic-outline':'mic-off-outline'} size={26} color="#fff"/>
          </TouchableOpacity>
          <TouchableOpacity style={cs.btnTerminar} onPress={onTerminar}>
            <Ionicons name="call" size={28} color="#fff" style={{transform:[{rotate:'135deg'}]}}/>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════ */
export default function ConversaScreen() {
  const router = useRouter();
  const { outroUid, outroNome, outraFoto } = useLocalSearchParams();
  const { user, perfil } = useUser();

  const [mensagens,     setMensagens]     = useState([]);
  const [outroPerfil,   setOutroPerfil]   = useState(null);
  const [texto,         setTexto]         = useState('');
  const [enviando,      setEnviando]      = useState(false);
  const [carregando,    setCarregando]    = useState(false);
  const [outroOnline,   setOutroOnline]   = useState(false);
  const [temMensagens,  setTemMensagens]  = useState(false);
  const [replyMsg,      setReplyMsg]      = useState(null);
  const [modalAnexos,   setModalAnexos]   = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalDenuncia, setModalDenuncia] = useState(false);
  const [alertConfig,   setAlertConfig]   = useState({visivel:false,titulo:'',botoes:[]});
  const [headerSub,     setHeaderSub]     = useState('');
  const preloadFeito = useRef(false);

  // ← NOVO: controla se este ecrã está mesmo em primeiro plano.
  // Evita que um ecrã "vivo" em segundo plano (mantido pelo Expo Router
  // para navegação rápida) continue a marcar mensagens como lidas.
  const estaFocado = useRef(false);
  useFocusEffect(
    useCallback(() => {
      estaFocado.current = true;
      return () => { estaFocado.current = false; };
    }, [])
  );

  // Chamada
  const [emChamada,     setEmChamada]     = useState(false);
  const [tipoChamada,   setTipoChamada]   = useState('voz');
  const [estadoChamada, setEstadoChamada] = useState('a_ligar');
  const [tempoChamada,  setTempoChamada]  = useState(0);
  const [micAtivo,      setMicAtivo]      = useState(true);
  const [altifalante,   setAltifalante]   = useState(false);
  const [cameraAtiva,   setCameraAtiva]   = useState(true);
  const [remoteUid,     setRemoteUid]     = useState(null);
  const engineRef        = useRef(null);
  const timerChamadaRef  = useRef(null);
  const timerMarcacaoRef = useRef(null);
  const unsubChamadaRef  = useRef(null); // ← listener do doc chamada

  // Áudio
  const [gravando,    setGravando]    = useState(false);
  const [tempoGrav,   setTempoGrav]   = useState(0);
  const timerGravRef  = useRef(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const somEspera        = useAudioPlayer(SOM_ESPERA);
  const somNaoAtendida   = useAudioPlayer(SOM_NAO_ATENDIDA);

  useEffect(() => { somEspera.loop = true; }, []);

  // Denúncia
  const [motivoDenuncia,    setMotivoDenuncia]    = useState('');
  const [categoriaSelected, setCategoriaSelected] = useState('');
  const [capturasDenuncia,  setCapturasDenuncia]  = useState([]);
  const [enviandoDenuncia,  setEnviandoDenuncia]  = useState(false);
  const [recibosLeitura,    setRecibosLeitura]    = useState(true);
  const [mensagensTemp,     setMensagensTemp]     = useState(false);

  const flatListRef = useRef(null);
  const chatId = user && outroUid ? getChatId(user.uid, outroUid) : null;
  const { privacidade }        = usePrivacidade(user?.uid);
  const { privacidade: privO } = usePrivacidade(outroUid);
  usePresenca(user?.uid, privacidade.onlineActivo);

  const nomeR  = outroPerfil?.nome    || outroNome || 'Utilizador';
  const fotoR  = outroPerfil?.fotoURL || (outraFoto && outraFoto!=='null' ? outraFoto : null);
  const cargoR = outroPerfil?.cargo   || outroPerfil?.area || '';
  const cidR   = outroPerfil?.cidade  || '';
  const empR   = outroPerfil?.empresa || '';
  const bioR   = outroPerfil?.bio     || '';
  const resumo = [cargoR, empR].filter(Boolean).join(' · ');

  useEffect(()=>{
    if(outroOnline){
      setHeaderSub('online');
      const t=setTimeout(()=>setHeaderSub(resumo||'ConnectAll Angola'),4000);
      return ()=>clearTimeout(t);
    } else setHeaderSub(resumo||'ConnectAll Angola');
  },[outroOnline,resumo]);

  /* ── Inicializa Agora ─────────────────────────────────────────────── */
  const iniciarAgora = async (tipo) => {
    try {
      if (engineRef.current) { engineRef.current.release(); engineRef.current = null; }

      if (tipo==='video') {
        const {status} = await ImagePicker.requestCameraPermissionsAsync();
        if (status!=='granted') { Alert.alert('Permissão','Precisamos da câmara.'); return false; }
      }
      const mic = await AudioModule.requestRecordingPermissionsAsync();
      if (!mic.granted) { Alert.alert('Permissão','Precisamos do microfone.'); return false; }

      const engine = createAgoraRtcEngine();
      engine.initialize({ appId: AGORA_APP_ID });
      engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);

      engine.registerEventHandler({
        onUserJoined: (_conn, uid) => {
          setRemoteUid(uid);
          // ← destinatário atendeu: para som de espera e inicia contador
          try { somEspera.pause(); somEspera.seekTo(0); } catch(_){}
          clearTimeout(timerMarcacaoRef.current);
          setEstadoChamada('em_curso');
          setTempoChamada(0);
          timerChamadaRef.current = setInterval(()=>setTempoChamada(t=>t+1),1000);
        },
        onUserOffline: () => { setRemoteUid(null); terminarInterno(); },
        onLeaveChannel: () => clearInterval(timerChamadaRef.current),
        onError: (code,msg) => console.warn('[Agora]',code,msg),
      });

      if (tipo==='video') { engine.enableVideo(); engine.startPreview(); }
      engine.enableAudio();
      engineRef.current = engine;
      return true;
    } catch(e) { console.error('[Agora init]',e); return false; }
  };

  /* ── Iniciar chamada ──────────────────────────────────────────────── */
  const iniciarChamada = async (tipo) => {
    setModalDetalhes(false);
    const ok = await iniciarAgora(tipo);
    if (!ok) return;

    setTipoChamada(tipo);
    setEstadoChamada('a_ligar');
    setEmChamada(true);
    setTempoChamada(0);
    setRemoteUid(null);
    setMicAtivo(true);
    setAltifalante(false);
    if (tipo==='video') setCameraAtiva(true);

    const channel = chatId || `${user?.uid}_${outroUid}`;
    const numUid  = Math.abs((user?.uid||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % 100000;

    try {
      engine_ref_set: {
        engineRef.current?.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        await engineRef.current?.joinChannel('', channel, numUid, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: tipo==='video',
          autoSubscribeAudio: true,
          autoSubscribeVideo: tipo==='video',
        });
      }
    } catch(e) { console.log('[joinChannel emissor]',e); }

    // Grava chamada no Firestore (trigger para FCM push no backend)
    if (chatId) {
      await setDoc(doc(db,'chamadas',chatId),{
        de: user?.uid, deNome: perfil?.nome||'Utilizador', deFoto: perfil?.fotoURL||'',
        para: outroUid, tipo, channel, estado:'a_ligar', timestamp: serverTimestamp(),
      }).catch(()=>{});
    }

    // ← Ouve alterações no doc chamada para saber quando o outro atende
    if (unsubChamadaRef.current) unsubChamadaRef.current();
    unsubChamadaRef.current = onSnapshot(doc(db,'chamadas',chatId||'_'), snap => {
      if (!snap.exists()) return;
      const est = snap.data()?.estado;
      if (est === 'em_curso' && estadoChamada !== 'em_curso') {
        // Destinatário atendeu — garante que o som para (caso onUserJoined ainda não disparou)
        try { somEspera.pause(); somEspera.seekTo(0); } catch(_){}
        clearTimeout(timerMarcacaoRef.current);
        setEstadoChamada('em_curso');
        if (!timerChamadaRef.current) {
          setTempoChamada(0);
          timerChamadaRef.current = setInterval(()=>setTempoChamada(t=>t+1),1000);
        }
      }
      if (est==='nao_atendida' || est==='terminada' || est==='cancelada') {
        try { somEspera.pause(); somEspera.seekTo(0); } catch(_){}
        if (est==='nao_atendida') {
          try { somNaoAtendida.seekTo(0); somNaoAtendida.play(); } catch(_){}
          setEstadoChamada('nao_atendida');
        } else {
          terminarInterno();
        }
      }
    });

    try { somEspera.seekTo(0); somEspera.play(); } catch(_){}

    // 40s sem resposta
    timerMarcacaoRef.current = setTimeout(async()=>{
      try { somEspera.pause(); somEspera.seekTo(0); } catch(_){}
      try { somNaoAtendida.seekTo(0); somNaoAtendida.play(); } catch(_){}
      setEstadoChamada('nao_atendida');
      if (chatId) await updateDoc(doc(db,'chamadas',chatId),{estado:'nao_atendida'}).catch(()=>{});
    },40000);
  };

  /* ── Terminar chamada ─────────────────────────────────────────────── */
  const terminarInterno = async () => {
    clearInterval(timerChamadaRef.current); timerChamadaRef.current = null;
    // Gravar chamada na conversa
    if (chatId && tempoChamada >= 0) {
      const duracaoTexto = tempoChamada > 0
        ? `📞 Chamada de ${tipoChamada === 'video' ? 'vídeo' : 'voz'} • ${formatarTempo(tempoChamada)}`
        : `📵 Chamada perdida de ${tipoChamada === 'video' ? 'vídeo' : 'voz'}`;

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        uid: user?.uid,
        tipo: 'chamada',
        texto: duracaoTexto,
        duracao: tempoChamada,
        tipoChamada: tipoChamada,
        perdida: tempoChamada === 0,
        timestamp: serverTimestamp(),
        lida: false,
        entregue: outroOnline,
      }).catch(() => {});

      await setDoc(doc(db, 'chats', chatId), {
        ultimaMensagem: duracaoTexto,
        ultimoTimestamp: serverTimestamp(),
        users: [user?.uid, outroUid],
        [`naoLidas.${outroUid}`]: increment(1),
        ocultoPara: arrayRemove(outroUid),
      }, { merge: true }).catch(() => {});
    }
    clearTimeout(timerMarcacaoRef.current);
    if (unsubChamadaRef.current) { unsubChamadaRef.current(); unsubChamadaRef.current = null; }
    try { somEspera.pause(); somEspera.seekTo(0); } catch(_){}
    try { somNaoAtendida.pause(); somNaoAtendida.seekTo(0); } catch(_){}
    try { engineRef.current?.leaveChannel(); engineRef.current?.release(); engineRef.current=null; } catch(_){}
    if (chatId) await updateDoc(doc(db,'chamadas',chatId),{estado:'terminada'}).catch(()=>{});
    setEmChamada(false); setEstadoChamada('a_ligar'); setRemoteUid(null); setTempoChamada(0);
  };
  const terminarChamada  = () => terminarInterno();
  const ligarNovamente   = () => { setEstadoChamada('a_ligar'); iniciarChamada(tipoChamada); };
  const toggleMic        = () => setMicAtivo(v=>{ engineRef.current?.muteLocalAudioStream(v); return !v; });
  const toggleAltifalante = () => setAltifalante(v => {
    engineRef.current?.setEnableSpeakerphone(!v);
    return !v;
  });
  const toggleCamera     = () => setCameraAtiva(v=>{ engineRef.current?.muteLocalVideoStream(v); return !v; });

  useEffect(()=>()=>{
    clearInterval(timerChamadaRef.current);
    clearTimeout(timerMarcacaoRef.current);
    if (unsubChamadaRef.current) unsubChamadaRef.current();
    try { engineRef.current?.release(); } catch(_){}
  },[]);

  /* ── SwipeableMessage ─────────────────────────────────────────────── */
  const SwipeableMessage = ({children,onSwipe}) => {
    const tx  = useRef(new Animated.Value(0)).current;
    const pan = useRef(PanResponder.create({
      onMoveShouldSetPanResponder:(_,gs)=>Math.abs(gs.dx)>15&&Math.abs(gs.dx)>Math.abs(gs.dy),
      onPanResponderMove:(_,gs)=>{if(gs.dx>0)tx.setValue(gs.dx);},
      onPanResponderRelease:(_,gs)=>{if(gs.dx>70)onSwipe();Animated.spring(tx,{toValue:0,useNativeDriver:true}).start();},
    })).current;
    return <Animated.View style={{transform:[{translateX:tx}]}} {...pan.panHandlers}>{children}</Animated.View>;
  };

  /* ── Effects ──────────────────────────────────────────────────────── */
  useEffect(()=>{
    if(!outroUid) return;
    return onValue(ref(rtdb,`presenca/${outroUid}`),snap=>{
      const d=snap.val(); const m=privO?.onlineActivo!==false;
      setOutroOnline(d?.online===true&&m);
    });
  },[outroUid,privO]);

  useEffect(()=>{ if(!outroUid) return; return onSnapshot(doc(db,'users',outroUid),s=>{if(s.exists())setOutroPerfil(s.data());}); },[outroUid]);

  useEffect(()=>{
    if(!chatId) return;
    setMensagens([]); setTemMensagens(false); setCarregando(false);
    AsyncStorage.getItem(`msgs_${chatId}`).then(c=>{
      if(c){const p=JSON.parse(c);if(p.length>0){setMensagens(p);setTemMensagens(true);setCarregando(false);}}
    });
    const q=query(collection(db,'chats',chatId,'messages'),orderBy('timestamp','desc'));
    const unsub=onSnapshot(q,{includeMetadataChanges:false},snap=>{
      const raw=snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!m.apagadaPara?.[user?.uid]);
      setTemMensagens(raw.length>0);
      const proc=[];
      raw.forEach((msg,i)=>{
        proc.push(msg);
        const dA=msg.timestamp?.toDate?msg.timestamp.toDate().toDateString():null;
        const dB=raw[i+1]?.timestamp?.toDate?raw[i+1].timestamp.toDate().toDateString():null;
        if(dA&&dB&&dA!==dB) proc.push({id:`div-${msg.id}`,tipo:'divisor',label:formatarDivisor(msg.timestamp)});
      });
      setMensagens(proc); setCarregando(false);
      AsyncStorage.setItem(`msgs_${chatId}`,JSON.stringify(proc)).catch(()=>{});

      // ← SÓ marca como lida / zera naoLidas se a conversa está mesmo em
      //    primeiro plano neste momento. Um ecrã "vivo" em segundo plano
      //    (mantido pelo Expo Router) já não passa aqui.
      if (!estaFocado.current) return;

      let marcouAlguma=false;
      snap.docs.forEach(async d=>{
        const dt=d.data();
        if(dt.uid!==user?.uid&&dt.lida===false){
          marcouAlguma=true;
          try{await updateDoc(doc(db,'chats',chatId,'messages',d.id),{lida:true});}catch(_){}
        }
      });
      // Repõe o contador de não lidas do próprio utilizador para este chat
      if(marcouAlguma&&user?.uid){
        updateDoc(doc(db,'chats',chatId),{[`naoLidas.${user.uid}`]:0}).catch(()=>{});
      }
    });
    return ()=>{unsub();setMensagens([]);setTemMensagens(false);preloadFeito.current=false;};
  },[chatId]);

  // ← Quando a conversa volta a ganhar foco, marca de imediato as mensagens
  //    que tiverem ficado por ler enquanto estava em segundo plano.
  useFocusEffect(
    useCallback(() => {
      if (!chatId || !user?.uid) return;
      (async () => {
        try {
          const q = query(collection(db,'chats',chatId,'messages'), orderBy('timestamp','desc'));
          const snap = await getDocs(q);
          let marcouAlguma = false;
          for (const d of snap.docs) {
            const dt = d.data();
            if (dt.uid !== user.uid && dt.lida === false) {
              marcouAlguma = true;
              await updateDoc(doc(db,'chats',chatId,'messages',d.id),{lida:true}).catch(()=>{});
            }
          }
          if (marcouAlguma) {
            await updateDoc(doc(db,'chats',chatId),{[`naoLidas.${user.uid}`]:0}).catch(()=>{});
          }
        } catch (_) {}
      })();
    }, [chatId, user?.uid])
  );

  useEffect(()=>{
    if(!chatId||!outroPerfil||!user||!perfil) return;
    (async()=>{
      let novaSala=false;
      try{
        const snap=await getDoc(doc(db,'chats',chatId));
        novaSala=!snap.exists();
      }catch(_){}

      await setDoc(doc(db,'chats',chatId),{
        users:[user.uid,outroUid],
        [`nomes.${user.uid}`]:perfil.nome||'Utilizador',
        [`nomes.${outroUid}`]:outroPerfil.nome||outroNome||'Utilizador',
        [`fotos.${user.uid}`]:perfil.fotoURL||null,
        [`fotos.${outroUid}`]:outroPerfil.fotoURL||null,
      },{merge:true}).catch(()=>{});

      // Sala nova (primeira vez que esta conversa é aberta) — notifica o outro utilizador
      if(novaSala){
        enviarNotificacao(
          outroUid,
          user.uid,
          'mensagem',
          `${perfil.nome || 'Alguém'} iniciou uma conversa contigo`,
          perfil.fotoURL || null
        ).catch(()=>{});
      }
    })();
  },[outroPerfil,chatId]);

  /* ── Upload helpers ───────────────────────────────────────────────── */
  const uriToBlob=uri=>new Promise((res,rej)=>{
    const x=new XMLHttpRequest(); x.onload=()=>res(x.response); x.onerror=()=>rej(new TypeError('fail'));
    x.responseType='blob'; x.open('GET',uri,true); x.send(null);
  });

  /* ── Enviar mensagem ──────────────────────────────────────────────── */
  const enviarMensagem=async(tc)=>{
    const tf=(tc||texto).trim(); if(!tf||!chatId||!user) return;
    setTexto(''); setReplyMsg(null); setEnviando(true);
    try{
      const p={uid:user.uid,texto:tf,timestamp:serverTimestamp(),lida:false,entregue:outroOnline};
      if(replyMsg) p.reply={id:replyMsg.id,texto:replyMsg.texto||(replyMsg.tipo==='imagem'?'📷 Imagem':replyMsg.tipo==='audio'?'🎤 Áudio':'📎 Ficheiro'),uid:replyMsg.uid,nome:replyMsg.uid===user.uid?(perfil?.nome||'Tu'):nomeR};
      await addDoc(collection(db,'chats',chatId,'messages'),p);
      await setDoc(doc(db,'chats',chatId),{users:[user.uid,outroUid],ultimaMensagem:tf,ultimoTimestamp:serverTimestamp(),[`nomes.${user.uid}`]:perfil?.nome||'Utilizador',[`nomes.${outroUid}`]:nomeR,[`fotos.${user.uid}`]:perfil?.fotoURL||null,[`fotos.${outroUid}`]:fotoR||null,[`naoLidas.${outroUid}`]:increment(1),ocultoPara:arrayRemove(outroUid)},{merge:true});
    }catch(e){console.log('[enviarMensagem] ERRO:',e?.code,e?.message,e);}finally{setEnviando(false);}
  };

  const enviarImagem=async uri=>{
    if(!chatId||!user) return;
    try{
      const b=await uriToBlob(uri); const r=storageRef(storage,`chats/${chatId}/${Date.now()}.jpg`);
      await uploadBytes(r,b); const u=await getDownloadURL(r);
      await addDoc(collection(db,'chats',chatId,'messages'),{uid:user.uid,tipo:'imagem',imagemURL:u,texto:'📷 Imagem',timestamp:serverTimestamp(),lida:false,entregue:outroOnline});
      await setDoc(doc(db,'chats',chatId),{ultimaMensagem:'📷 Imagem',ultimoTimestamp:serverTimestamp(),users:[user.uid,outroUid],[`naoLidas.${outroUid}`]:increment(1),ocultoPara:arrayRemove(outroUid)},{merge:true});
    }catch(e){console.log('[enviarImagem] ERRO:',e?.code,e?.message,e);Alert.alert('Erro','Não foi possível enviar a imagem.');}
  };

  const enviarFicheiro=async(uri,nome)=>{
    if(!chatId||!user) return;
    try{
      const b=await uriToBlob(uri); const r=storageRef(storage,`chats/${chatId}/${Date.now()}_${nome}`);
      await uploadBytes(r,b); const u=await getDownloadURL(r);
      await addDoc(collection(db,'chats',chatId,'messages'),{uid:user.uid,tipo:'ficheiro',ficheiroURL:u,ficheiroNome:nome,texto:`📎 ${nome}`,timestamp:serverTimestamp(),lida:false,entregue:outroOnline});
      await setDoc(doc(db,'chats',chatId),{ultimaMensagem:`📎 ${nome}`,ultimoTimestamp:serverTimestamp(),users:[user.uid,outroUid],[`naoLidas.${outroUid}`]:increment(1),ocultoPara:arrayRemove(outroUid)},{merge:true});
    }catch(e){console.log('[enviarFicheiro] ERRO:',e?.code,e?.message,e);Alert.alert('Erro','Não foi possível enviar o ficheiro.');}
  };

  const iniciarGravacao=async()=>{
    try{
      const st=await AudioModule.requestRecordingPermissionsAsync();
      if(!st.granted){Alert.alert('Permissão','Precisamos do microfone.');return;}
      await audioRecorder.prepareToRecordAsync(); audioRecorder.record();
      setGravando(true); setTempoGrav(0);
      timerGravRef.current=setInterval(()=>setTempoGrav(t=>t+1),1000);
    }catch(e){console.log(e);}
  };

  const pararGravacao=async()=>{
    clearInterval(timerGravRef.current); setGravando(false);
    try{
      await audioRecorder.stop(); const uri=audioRecorder.uri;
      if(!uri||!chatId||!user) return;
      const b=await uriToBlob(uri); const r=storageRef(storage,`chats/${chatId}/audio_${Date.now()}.m4a`);
      await uploadBytes(r,b); const u=await getDownloadURL(r);
      await addDoc(collection(db,'chats',chatId,'messages'),{uid:user.uid,tipo:'audio',audioURL:u,duracao:tempoGrav,texto:'🎤 Áudio',timestamp:serverTimestamp(),lida:false,entregue:outroOnline});
      await setDoc(doc(db,'chats',chatId),{ultimaMensagem:'🎤 Áudio',ultimoTimestamp:serverTimestamp(),users:[user.uid,outroUid],[`naoLidas.${outroUid}`]:increment(1),ocultoPara:arrayRemove(outroUid)},{merge:true});
      setTempoGrav(0);
    }catch(e){console.log('[pararGravacao] ERRO:',e?.code,e?.message,e);}
  };

  const cancelarGravacao=async()=>{
    clearInterval(timerGravRef.current); setGravando(false); setTempoGrav(0);
    try{await audioRecorder.stop();}catch(_){}
  };

  const abrirCamera=async()=>{
    setModalAnexos(false);
    const {status}=await ImagePicker.requestCameraPermissionsAsync();
    if(status!=='granted'){Alert.alert('Permissão negada');return;}
    const r=await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:0.8});
    if(!r.canceled) await enviarImagem(r.assets[0].uri);
  };

  const abrirGaleria=async()=>{
    setModalAnexos(false);
    const {status}=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(status!=='granted'){Alert.alert('Permissão negada');return;}
    const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,quality:0.8});
    if(!r.canceled) for(const a of r.assets) await enviarImagem(a.uri);
  };

  const abrirFicheiro=async()=>{
    setModalAnexos(false);
    try{
      const r=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
      if(!r.canceled&&r.assets[0]){const {uri,name}=r.assets[0]; await enviarFicheiro(uri,name);}
    }catch(e){console.log('[abrirFicheiro] ERRO:',e?.code,e?.message,e);}
  };

  const adicionarCaptura=async()=>{
    const {status}=await ImagePicker.requestMediaLibraryPermissionsAsync(); if(status!=='granted') return;
    const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,quality:0.8});
    if(!r.canceled) setCapturasDenuncia(p=>[...p,...r.assets.map(a=>a.uri)]);
  };

  const enviarDenuncia=async()=>{
    if(!categoriaSelected||!motivoDenuncia.trim()){Alert.alert('Atenção','Preenche todos os campos.');return;}
    setEnviandoDenuncia(true);
    try{
      const urls=[];
      for(const uri of capturasDenuncia){
        try{const b=await uriToBlob(uri);const r=storageRef(storage,`denuncias/${user?.uid}/${Date.now()}.jpg`);await uploadBytes(r,b);urls.push(await getDownloadURL(r));}catch(_){}
      }
      await addDoc(collection(db,'denuncias'),{tipo:'conversa',categoria:categoriaSelected,motivo:motivoDenuncia.trim(),capturas:urls,conteudoId:chatId||'',denunciadoPor:user?.uid||'',denunciadoUid:outroUid||'',denunciadoNome:nomeR,status:'pendente',timestamp:serverTimestamp()});
      setModalDenuncia(false);setMotivoDenuncia('');setCategoriaSelected('');setCapturasDenuncia([]);
      Alert.alert('✅ Denúncia enviada','A nossa equipa irá analisar em breve.');
    }catch{Alert.alert('Erro','Não foi possível enviar a denúncia.');}
    finally{setEnviandoDenuncia(false);}
  };

  const abrirMenuMsg=item=>{
    const eMeu=item.uid===user?.uid;
    const b=[{text:'Encaminhar',onPress:()=>encaminharMensagem(item)},{text:'Apagar para mim',style:'destructive',onPress:()=>apagarMsg(item,false)}];
    if(eMeu) b.splice(1,0,{text:'Apagar para todos',style:'destructive',onPress:()=>apagarMsg(item,true)});
    b.push({text:'Cancelar',style:'cancel'});
    setAlertConfig({visivel:true,titulo:'Opções da mensagem',botoes:b});
  };

  const apagarMsg=async(item,paraTodos)=>{
    try{
      if(paraTodos) await deleteDoc(doc(db,'chats',chatId,'messages',item.id));
      else await updateDoc(doc(db,'chats',chatId,'messages',item.id),{[`apagadaPara.${user.uid}`]:true});
    }catch(e){console.log(e);}
  };

  // ── Encaminhar mensagem (texto, imagem, áudio ou ficheiro) ──────────
  const encaminharMensagem = (item) => {
    const payload = {
      tipo: item.tipo || 'texto',
      texto: item.texto || '',
      imagemURL: item.imagemURL || null,
      audioURL: item.audioURL || null,
      duracao: item.duracao || null,
      ficheiroURL: item.ficheiroURL || null,
      ficheiroNome: item.ficheiroNome || null,
    };
    router.push({
      pathname: '/(main)/encaminhar-mensagem',
      params: { mensagem: JSON.stringify(payload) },
    });
  };

  // ── Apagar conversa: só para mim (a outra pessoa mantém o histórico) ──
  const apagarConversaSoParaMim = async () => {
    if (!chatId || !user?.uid) return;
    try {
      const snap = await getDocs(collection(db,'chats',chatId,'messages'));
      await Promise.all(snap.docs.map(d =>
        updateDoc(doc(db,'chats',chatId,'messages',d.id),{[`apagadaPara.${user.uid}`]:true}).catch(()=>{})
      ));
      await updateDoc(doc(db,'chats',chatId),{ocultoPara:arrayUnion(user.uid)}).catch(()=>{});
      await AsyncStorage.removeItem(`msgs_${chatId}`).catch(()=>{});
      setMensagens([]); setTemMensagens(false);
      setModalDetalhes(false);
      router.back();
    } catch(e) { console.log(e); }
  };

  // ── Apagar conversa para todos: apaga a conversa e todas as mensagens
  //    para os dois lados, de forma permanente (não é possível desfazer) ──
  const apagarConversaParaTodos = async () => {
    if (!chatId) return;
    try {
      const snap = await getDocs(collection(db,'chats',chatId,'messages'));
      await Promise.all(snap.docs.map(d =>
        deleteDoc(doc(db,'chats',chatId,'messages',d.id)).catch(()=>{})
      ));
      await deleteDoc(doc(db,'chats',chatId)).catch(()=>{});
      await AsyncStorage.removeItem(`msgs_${chatId}`).catch(()=>{});
      setMensagens([]); setTemMensagens(false);
      setModalDetalhes(false);
      router.back();
    } catch(e) { console.log(e); }
  };

  const confirmarApagarSoParaMim = () => {
    Alert.alert(
      'Apagar só para mim',
      'As mensagens deixam de aparecer para ti. A pessoa continuará a vê-las do lado dela.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: apagarConversaSoParaMim },
      ]
    );
  };

  const confirmarApagarParaTodos = () => {
    Alert.alert(
      'Apagar para todos',
      'Isto apaga a conversa e todas as mensagens para os dois lados, de forma permanente. Não é possível desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar para todos', style: 'destructive', onPress: apagarConversaParaTodos },
      ]
    );
  };

  const confirmarApagarConversa = () => {
    setModalDetalhes(false);
    setTimeout(() => {
      setAlertConfig({
        visivel: true,
        titulo: 'Apagar conversa',
        botoes: [
          { text: 'Apagar só para mim', onPress: () => setTimeout(confirmarApagarSoParaMim, 300) },
          { text: 'Apagar para todos', style: 'destructive', onPress: () => setTimeout(confirmarApagarParaTodos, 300) },
          { text: 'Cancelar', style: 'cancel' },
        ],
      });
    }, 300);
  };

  const irParaPerfil=()=>{setModalDetalhes(false);router.push({pathname:'/(main)/perfil-publico',params:{uid:outroUid}});};

  /* ── Render mensagem ──────────────────────────────────────────────── */
  const renderMensagem=({item,index})=>{
    if(item.tipo==='divisor') return (
      <View style={s.divWrap}><View style={s.divPilula}><Text style={s.divTxt}>{item.label}</Text></View></View>
    );
    const eMeu=item.uid===user?.uid;
    const prox=mensagens[index+1];
    const mostrarAvatar=!eMeu&&(!prox||prox.uid!==item.uid||prox.tipo==='divisor');
    const mesmo=prox&&prox.uid===item.uid&&prox.tipo!=='divisor';
    return (
      <SwipeableMessage onSwipe={()=>setReplyMsg(item)}>
        <TouchableOpacity activeOpacity={0.8} onLongPress={()=>abrirMenuMsg(item)}
          style={[s.msgRow,eMeu?s.msgRowM:s.msgRowD,mesmo&&{marginBottom:1}]}>
          {!eMeu&&(
            <View style={[s.avWrap,!mostrarAvatar&&{opacity:0}]}>
              {fotoR?<Image source={{uri:fotoR}} style={s.avImg}/>:<View style={s.avFallback}><Text style={s.avFallTxt}>{nomeR[0].toUpperCase()}</Text></View>}
            </View>
          )}
          <View style={[s.bolha,eMeu?s.bolhaM:s.bolhaD,!mesmo&&(eMeu?s.bolhaMT:s.bolhaDT)]}>
            {item.encaminhada&&(
              <View style={s.encaminhadaRow}>
                <Ionicons name="arrow-redo-outline" size={12} color={eMeu?'rgba(255,255,255,0.75)':'#8696A0'}/>
                <Text style={[s.encaminhadaTxt,eMeu&&{color:'rgba(255,255,255,0.75)'}]}>Encaminhada</Text>
              </View>
            )}
            {item.reply&&(
              <View style={[s.replyBox,eMeu?s.replyBoxM:s.replyBoxD]}>
                <View style={[s.replyBar,{backgroundColor:eMeu?'#53BDEB':'#25D366'}]}/>
                <View style={s.replyCont}>
                  <Text style={[s.replyNome,{color:eMeu?'#53BDEB':'#25D366'}]}>{item.reply.nome}</Text>
                  <Text style={[s.replyTxt,eMeu?{color:'rgba(255,255,255,0.8)'}:{color:'#555'}]}>{item.reply.texto}</Text>
                </View>
              </View>
            )}
            {item.tipo==='imagem'&&item.imagemURL?<Image source={{uri:item.imagemURL}} style={s.msgImg}/>
            :item.tipo==='audio'?<AudioBubble uri={item.audioURL} eMeu={eMeu} duracao={item.duracao}/>
            :item.tipo==='ficheiro'?(<View style={s.ficBox}><Ionicons name="document-outline" size={22} color={eMeu?'#fff':'#25D366'}/><Text style={[s.ficNome,eMeu&&{color:'#fff'}]} numberOfLines={1}>{item.ficheiroNome||'Ficheiro'}</Text></View>)
            : item.tipo === 'chamada' ? (
              <View style={s.chamadaBox}>
                <Ionicons
                  name={item.perdida
                    ? 'call-outline'
                    : item.tipoChamada === 'video' ? 'videocam-outline' : 'call-outline'}
                  size={18}
                  color={item.perdida ? '#E53935' : eMeu ? '#fff' : '#25D366'}
                />
                <Text style={[s.chamadaTxt, eMeu && { color: '#fff' }, item.perdida && { color: '#E53935' }]}>
                  {item.texto}
                </Text>
              </View>
            )
            :(<Text style={[s.msgTxt,eMeu&&s.msgTxtM]}>{item.texto}</Text>)}
            <View style={[s.metaRow,eMeu&&s.metaRowM]}>
              <Text style={[s.hora,eMeu&&s.horaM]}>{formatarHora(item.timestamp)}</Text>
              <Ticks eMeu={eMeu} lida={item.lida} entregue={item.entregue}/>
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableMessage>
    );
  };

  const AlertWA=()=>(
    <Modal transparent visible={alertConfig.visivel} animationType="fade" onRequestClose={()=>setAlertConfig({...alertConfig,visivel:false})}>
      <TouchableWithoutFeedback onPress={()=>setAlertConfig({...alertConfig,visivel:false})}>
        <View style={s.alertOv}>
          <TouchableWithoutFeedback>
            <View style={s.alertCard}>
              {alertConfig.titulo?<Text style={s.alertTit}>{alertConfig.titulo}</Text>:null}
              <View style={s.alertBtns}>
                {alertConfig.botoes.map((b,i)=>(
                  <TouchableOpacity key={i} style={[s.alertBtn,i===alertConfig.botoes.length-1&&{borderBottomWidth:0}]}
                    onPress={()=>{b.onPress?.();setAlertConfig({...alertConfig,visivel:false});}}>
                    <Text style={[s.alertBtnTxt,b.style==='destructive'&&{color:'#FF3B30'},b.style==='cancel'&&{color:'#666'}]}>{b.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <>
      {emChamada&&(
        <Modal visible animationType="slide" statusBarTranslucent>
          <TelaChamada tipo={tipoChamada} nome={nomeR} foto={fotoR} estado={estadoChamada} tempo={tempoChamada}
            micAtivo={micAtivo} altifalanteAtivo={altifalante} cameraAtiva={cameraAtiva} remoteUid={remoteUid}
            onTerminar={terminarChamada} onToggleMic={toggleMic} onToggleAltifalante={toggleAltifalante}
            onToggleCamera={toggleCamera} onLigarNovamente={ligarNovamente}/>
        </Modal>
      )}

      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={()=>router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff"/>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setModalDetalhes(true)} style={s.hAvWrap}>
            {fotoR?<Image source={{uri:fotoR}} style={s.hAv}/>:<View style={s.hAvFall}><Text style={s.hAvFallTxt}>{nomeR[0].toUpperCase()}</Text></View>}
            {outroOnline&&<View style={s.onlineDot}/>}
          </TouchableOpacity>
          <TouchableOpacity style={{flex:1}} onPress={()=>setModalDetalhes(true)}>
            <Text style={s.hNome} numberOfLines={1}>{formatarNome(nomeR)}</Text>
            <Text style={[s.hStatus,headerSub==='online'&&{color:VERDE,fontWeight:'700'}]} numberOfLines={1}>{headerSub}</Text>
          </TouchableOpacity>
          <View style={s.hAcoes}>
            <TouchableOpacity style={s.hAcaoBtn} onPress={()=>iniciarChamada('voz')}><Ionicons name="call" size={22} color="#fff"/></TouchableOpacity>
            <TouchableOpacity style={s.hAcaoBtn} onPress={()=>iniciarChamada('video')}><Ionicons name="videocam" size={22} color="#fff"/></TouchableOpacity>
            <TouchableOpacity style={s.hAcaoBtn} onPress={()=>setModalDetalhes(true)}><Ionicons name="ellipsis-vertical" size={22} color="#fff"/></TouchableOpacity>
          </View>
        </View>

        <ImageBackground source={FUNDO_CHAT} style={{flex:1}} resizeMode="cover">
          <View style={s.overlay2}>
            <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='android'?100:60}>
              {carregando?<View style={s.loadWrap}><ActivityIndicator color="#25D366" size="large"/></View>
              :!temMensagens?(
                <ScrollView contentContainerStyle={s.semMsgWrap} keyboardShouldPersistTaps="handled">
                  <View style={s.perfilCardWrap}>
                    <View style={s.perfilCard}>
                      <View style={s.perfilFotoWrap}>
                        {fotoR?<Image source={{uri:fotoR}} style={s.perfilFoto}/>:<View style={s.perfilFotoFall}><Text style={{color:'#fff',fontSize:36,fontWeight:'800'}}>{nomeR[0]}</Text></View>}
                        {outroOnline&&<View style={s.perfilOnlineDot}/>}
                      </View>
                      <Text style={s.perfilNome}>{formatarNome(nomeR)}</Text>
                      {resumo?<Text style={s.perfilResumo}>{resumo}</Text>:null}
                      {bioR?<Text style={s.perfilBio} numberOfLines={2}>{bioR}</Text>:null}
                      {cidR?<Text style={s.perfilInfo}>📍 {cidR}</Text>:null}
                      <TouchableOpacity style={s.verPerfilBtn} onPress={irParaPerfil}><Text style={s.verPerfilTxt}>Ver perfil completo</Text></TouchableOpacity>
                    </View>
                  </View>
                  <Text style={s.tocaTxt}>Toca numa sugestão para começar</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:16}}>
                    {SUGESTOES(primeiroNome(nomeR)).map((sg,i)=>(
                      <TouchableOpacity key={i} style={s.sugestaoBtn} onPress={()=>enviarMensagem(sg)}><Text style={s.sugestaoTxt}>{sg}</Text></TouchableOpacity>
                    ))}
                  </ScrollView>
                </ScrollView>
              ):(
                <FlatList ref={flatListRef} data={mensagens} inverted keyExtractor={i=>i.id}
                  renderItem={renderMensagem} contentContainerStyle={s.msgList} showsVerticalScrollIndicator={false}/>
              )}

              {replyMsg&&(
                <View style={s.replyPrev}>
                  <View style={s.replyPrevBar}/>
                  <View style={{flex:1}}>
                    <Text style={s.replyPrevNome}>{replyMsg.uid===user?.uid?'Tu':nomeR}</Text>
                    <Text style={s.replyPrevTxt}>{replyMsg.texto||'📷 Imagem'}</Text>
                  </View>
                  <TouchableOpacity onPress={()=>setReplyMsg(null)} style={{padding:4}}><Ionicons name="close" size={20} color="#65676B"/></TouchableOpacity>
                </View>
              )}

              {gravando?(
                <View style={s.inputWrap}>
                  <TouchableOpacity onPress={cancelarGravacao} style={s.inputIconBtn}><Ionicons name="trash-outline" size={26} color="#E53935"/></TouchableOpacity>
                  <View style={s.inputCampo}><View style={s.gravDot}/><Text style={s.gravTxt}>A gravar... {formatarTempo(tempoGrav)}</Text></View>
                  <TouchableOpacity onPress={pararGravacao} style={s.enviarAudioBtn}><Ionicons name="send" size={20} color="#fff"/></TouchableOpacity>
                </View>
              ):(
                <View style={s.inputWrap}>
                  <TouchableOpacity style={s.inputIconBtn} onPress={()=>setModalAnexos(true)}><Ionicons name="attach" size={26} color="#54656F"/></TouchableOpacity>
                  <View style={s.inputCampo}>
                    <TextInput style={s.inputTexto} placeholder="Mensagem" placeholderTextColor="#8696A0"
                      value={texto} onChangeText={setTexto} multiline maxLength={500}/>
                    <TouchableOpacity style={{paddingLeft:6}}><Ionicons name="happy-outline" size={22} color="#54656F"/></TouchableOpacity>
                  </View>
                  {texto.trim()?(
                    <TouchableOpacity style={s.enviarBtn} onPress={()=>enviarMensagem()} disabled={enviando}><Ionicons name="send" size={20} color="#fff"/></TouchableOpacity>
                  ):(
                    <TouchableOpacity style={s.enviarBtn} onLongPress={iniciarGravacao} onPress={iniciarGravacao}><Ionicons name="mic" size={22} color="#fff"/></TouchableOpacity>
                  )}
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        </ImageBackground>

        <AlertWA/>

        {/* Modal Anexos */}
        <Modal visible={modalAnexos} transparent animationType="slide" onRequestClose={()=>setModalAnexos(false)}>
          <TouchableWithoutFeedback onPress={()=>setModalAnexos(false)}><View style={s.overlay}/></TouchableWithoutFeedback>
          <View style={s.sheet}>
            <View style={s.handle}/><Text style={s.sheetTit}>Anexar</Text>
            <View style={s.anexosGrid}>
              {[
                {icon:'document-text',label:'Ficheiro',cor:'#7B1FA2',bg:'#F3E5F5',onPress:abrirFicheiro},
                {icon:'images',label:'Galeria',cor:'#1565C0',bg:'#E3F2FD',onPress:abrirGaleria},
                {icon:'camera',label:'Câmara',cor:'#00695C',bg:'#E0F2F1',onPress:abrirCamera},
                {icon:'mic',label:'Áudio',cor:'#E53935',bg:'#FEE8E8',onPress:()=>{setModalAnexos(false);iniciarGravacao();}},
                {icon:'call',label:'Chamada',cor:'#FF8C00',bg:'#FFF3E0',onPress:()=>{setModalAnexos(false);iniciarChamada('voz');}},
                {icon:'videocam',label:'Vídeo',cor:'#00897B',bg:'#E0F2F1',onPress:()=>{setModalAnexos(false);iniciarChamada('video');}},
              ].map((b,i)=>(
                <TouchableOpacity key={i} style={s.anexoItem} onPress={b.onPress}>
                  <View style={[s.anexoIcone,{backgroundColor:b.bg}]}><Ionicons name={b.icon} size={28} color={b.cor}/></View>
                  <Text style={s.anexoLabel}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.cancelarBtn} onPress={()=>setModalAnexos(false)}><Text style={s.cancelarTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </Modal>

        {/* Modal Detalhes */}
        <Modal visible={modalDetalhes} transparent animationType="slide" onRequestClose={()=>setModalDetalhes(false)}>
          <TouchableWithoutFeedback onPress={()=>setModalDetalhes(false)}><View style={s.overlay}/></TouchableWithoutFeedback>
          <View style={md.sheet}>
            <TouchableOpacity style={md.voltarBtn} onPress={()=>setModalDetalhes(false)}><Ionicons name="chevron-back" size={26} color="#111"/></TouchableOpacity>
            <View style={md.topo}>
              <View style={md.fotoWrap}>
                {fotoR?<Image source={{uri:fotoR}} style={md.foto}/>
                  :<View style={[md.foto,{backgroundColor:VERDE,alignItems:'center',justifyContent:'center'}]}><Text style={{color:'#fff',fontSize:36,fontWeight:'800'}}>{nomeR[0]?.toUpperCase()}</Text></View>}
              </View>
              <Text style={md.nome}>{formatarNome(nomeR)}</Text>
              <View style={md.criptoBadge}><Ionicons name="lock-closed" size={13} color="#555"/><Text style={md.criptoTxt}>Encriptado ponto a ponto</Text></View>
            </View>
            <View style={md.acoesBtns}>
              {[
                {icon:'call-outline',label:'Chamada',onPress:()=>{setModalDetalhes(false);iniciarChamada('voz');}},
                {icon:'videocam-outline',label:'Vídeo',onPress:()=>{setModalDetalhes(false);iniciarChamada('video');}},
                {icon:'person-outline',label:'Perfil',onPress:irParaPerfil},
                {icon:'notifications-outline',label:'Silenciar',onPress:()=>{}},
              ].map((a,i)=>(
                <TouchableOpacity key={i} style={md.acaoItem} onPress={a.onPress}>
                  <View style={md.acaoCirculo}><Ionicons name={a.icon} size={22} color="#111"/></View>
                  <Text style={md.acaoLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
              <Text style={md.secTitulo}>Ações</Text>
              {[{icon:'mail-unread-outline',label:'Marcar como não lida',onPress:()=>{}},{icon:'share-social-outline',label:'Partilhar contacto',onPress:()=>{}},{icon:'people-outline',label:`Criar grupo com ${primeiroNome(nomeR)}`,onPress:()=>{}}].map((it,i)=>(
                <TouchableOpacity key={i} style={md.itemLinha} onPress={it.onPress}><View style={md.itemIcone}><Ionicons name={it.icon} size={20} color="#111"/></View><Text style={md.itemTxt}>{it.label}</Text></TouchableOpacity>
              ))}
              <Text style={md.secTitulo}>Personalização</Text>
              {[{icon:'heart-outline',label:'Reação rápida',onPress:()=>{}},{icon:'text-outline',label:'Alcunhas',onPress:()=>{}}].map((it,i)=>(
                <TouchableOpacity key={i} style={md.itemLinha} onPress={it.onPress}><View style={md.itemIcone}><Ionicons name={it.icon} size={20} color="#111"/></View><Text style={md.itemTxt}>{it.label}</Text></TouchableOpacity>
              ))}
              <Text style={md.secTitulo}>Privacidade e suporte</Text>
              <TouchableOpacity style={md.itemLinha} onPress={()=>{}}><View style={md.itemIcone}><Ionicons name="lock-closed-outline" size={20} color="#111"/></View><Text style={md.itemTxt}>Verificar encriptação</Text></TouchableOpacity>
              <View style={md.itemLinha}><View style={md.itemIcone}><Ionicons name="timer-outline" size={20} color="#111"/></View><Text style={[md.itemTxt,{flex:1}]}>Mensagens temporárias</Text><Switch value={mensagensTemp} onValueChange={setMensagensTemp} trackColor={{false:'#ccc',true:VERDE}} thumbColor="#fff"/></View>
              <View style={md.itemLinha}><View style={md.itemIcone}><Ionicons name="eye-outline" size={20} color="#111"/></View><Text style={[md.itemTxt,{flex:1}]}>Recibos de leitura</Text><Text style={md.itemValor}>{recibosLeitura?'Ativado':'Desativado'}</Text></View>
              <TouchableOpacity style={md.itemLinha} onPress={confirmarApagarConversa}>
                <View style={[md.itemIcone,{backgroundColor:'#FEE8E8'}]}><Ionicons name="trash-outline" size={20} color="#E53935"/></View>
                <View><Text style={[md.itemTxt,{color:'#E53935'}]}>Apagar conversa</Text><Text style={md.itemSubTxt}>Só para ti ou para todos</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={md.itemLinha} onPress={()=>Alert.alert(`Bloquear ${primeiroNome(nomeR)}`,'Tens a certeza?',[{text:'Cancelar',style:'cancel'},{text:'Bloquear',style:'destructive'}])}>
                <View style={[md.itemIcone,{backgroundColor:'#eee'}]}><Ionicons name="remove-circle-outline" size={20} color="#111"/></View>
                <Text style={md.itemTxt}>Bloquear {primeiroNome(nomeR)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[md.itemLinha,{marginBottom:40}]} onPress={()=>{setModalDetalhes(false);setTimeout(()=>setModalDenuncia(true),350);}}>
                <View style={[md.itemIcone,{backgroundColor:'#eee'}]}><Ionicons name="warning-outline" size={20} color="#111"/></View>
                <View><Text style={md.itemTxt}>Denunciar</Text><Text style={md.itemSubTxt}>Enviar feedback e denunciar conversa</Text></View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Modal Denúncia */}
        <Modal visible={modalDenuncia} transparent animationType="slide" onRequestClose={()=>setModalDenuncia(false)}>
          <TouchableWithoutFeedback onPress={()=>setModalDenuncia(false)}><View style={s.overlay}/></TouchableWithoutFeedback>
          <View style={s.denunciaSheet}>
            <View style={s.handle}/>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:14}}>
              <TouchableOpacity onPress={()=>setModalDenuncia(false)}><Ionicons name="close" size={24} color="#65676B"/></TouchableOpacity>
              <Text style={s.sheetTit}>Denunciar conversa</Text>
              <View style={{width:24}}/>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:40}}>
              <Text style={s.denSecTit}>Motivo</Text>
              <View style={s.catGrid}>
                {CAT_DENUNCIA.map(cat=>{const sel=categoriaSelected===cat.key;return(
                  <TouchableOpacity key={cat.key} style={[s.catItem,sel&&s.catItemSel]} onPress={()=>setCategoriaSelected(cat.key)}>
                    <Ionicons name={cat.icon} size={14} color={sel?'#fff':'#25D366'}/>
                    <Text style={[s.catLabel,sel&&{color:'#fff'}]}>{cat.label}</Text>
                  </TouchableOpacity>
                );})}
              </View>
              <Text style={s.denSecTit}>Capturas de ecrã</Text>
              <View style={s.capturaWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>
                  {capturasDenuncia.map((uri,i)=>(
                    <View key={i} style={s.capturaItem}>
                      <Image source={{uri}} style={s.capturaImg}/>
                      <TouchableOpacity style={s.capturaRem} onPress={()=>setCapturasDenuncia(p=>p.filter((_,idx)=>idx!==i))}><Ionicons name="close-circle" size={20} color="#FF3B30"/></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={s.addCapturaBtn} onPress={adicionarCaptura}><Ionicons name="camera-outline" size={24} color="#25D366"/><Text style={s.addCapturaTxt}>Adicionar</Text></TouchableOpacity>
                </ScrollView>
              </View>
              <Text style={s.denSecTit}>Descrição</Text>
              <TextInput style={s.denInput} placeholder="Descreve o que aconteceu..." placeholderTextColor="#BCC0C4" multiline maxLength={800} value={motivoDenuncia} onChangeText={setMotivoDenuncia} textAlignVertical="top"/>
              <TouchableOpacity style={[s.denEnviarBtn,(!categoriaSelected||!motivoDenuncia.trim())&&{backgroundColor:'#BCC0C4'}]}
                onPress={enviarDenuncia} disabled={enviandoDenuncia||!categoriaSelected||!motivoDenuncia.trim()}>
                {enviandoDenuncia?<ActivityIndicator color="#fff"/>:<Text style={s.denEnviarTxt}>Enviar denúncia</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

/* ══ ESTILOS ══ */
const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:HEADER},
  overlay2:{flex:1,backgroundColor:'rgba(0,0,0,0.08)'},
  header:{flexDirection:'row',alignItems:'center',backgroundColor:HEADER,paddingHorizontal:8,paddingVertical:10,gap:6},
  backBtn:{padding:4},
  hAvWrap:{position:'relative'},
  hAv:{width:40,height:40,borderRadius:20},
  hAvFall:{width:40,height:40,borderRadius:20,backgroundColor:VERDE,alignItems:'center',justifyContent:'center'},
  hAvFallTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
  onlineDot:{position:'absolute',bottom:0,right:0,width:12,height:12,borderRadius:6,backgroundColor:VERDE,borderWidth:2,borderColor:HEADER},
  hNome:{fontSize:16,fontWeight:'700',color:'#fff'},
  hStatus:{fontSize:12,color:'#8696A0'},
  hAcoes:{flexDirection:'row',gap:4},
  hAcaoBtn:{padding:6},
  loadWrap:{flex:1,alignItems:'center',justifyContent:'center'},
  semMsgWrap:{flexGrow:1,alignItems:'center',paddingTop:30,paddingBottom:24},
  perfilCardWrap:{width:'85%',marginBottom:20},
  perfilCard:{backgroundColor:'rgba(255,255,255,0.95)',borderRadius:16,padding:20,alignItems:'center',gap:6},
  perfilFotoWrap:{position:'relative',marginBottom:6},
  perfilFoto:{width:80,height:80,borderRadius:40},
  perfilFotoFall:{width:80,height:80,borderRadius:40,backgroundColor:VERDE,alignItems:'center',justifyContent:'center'},
  perfilOnlineDot:{position:'absolute',bottom:2,right:2,width:16,height:16,borderRadius:8,backgroundColor:VERDE,borderWidth:2.5,borderColor:'#fff'},
  perfilNome:{fontSize:18,fontWeight:'800',color:'#111'},
  perfilResumo:{fontSize:13,color:VERDE,fontWeight:'600'},
  perfilBio:{fontSize:12,color:'#555',textAlign:'center'},
  perfilInfo:{fontSize:12,color:'#777'},
  verPerfilBtn:{marginTop:10,backgroundColor:VERDE,borderRadius:20,paddingHorizontal:20,paddingVertical:8},
  verPerfilTxt:{color:'#fff',fontWeight:'700',fontSize:14},
  tocaTxt:{fontSize:12,color:'rgba(255,255,255,0.8)',marginBottom:10,textAlign:'center'},
  sugestaoBtn:{backgroundColor:'rgba(255,255,255,0.9)',borderRadius:20,paddingHorizontal:14,paddingVertical:9},
  sugestaoTxt:{fontSize:14,color:'#111',fontWeight:'500'},
  msgList:{padding:8,paddingBottom:4},
  divWrap:{alignItems:'center',marginVertical:10},
  divPilula:{backgroundColor:'rgba(255,255,255,0.85)',borderRadius:12,paddingHorizontal:12,paddingVertical:4},
  divTxt:{fontSize:12,color:'#54656F',fontWeight:'500'},
  msgRow:{flexDirection:'row',alignItems:'flex-end',marginBottom:3,gap:6,paddingHorizontal:6},
  msgRowM:{flexDirection:'row-reverse'},
  msgRowD:{},
  avWrap:{width:30,height:30,marginBottom:2},
  avImg:{width:30,height:30,borderRadius:15},
  avFallback:{width:30,height:30,borderRadius:15,backgroundColor:VERDE,alignItems:'center',justifyContent:'center'},
  avFallTxt:{color:'#fff',fontSize:12,fontWeight:'800'},
  bolha:{maxWidth:'78%',borderRadius:8,paddingHorizontal:10,paddingTop:6,paddingBottom:4,elevation:1,minWidth:120},
  bolhaM:{backgroundColor:'#555'},
  bolhaD:{backgroundColor:'#fff',alignSelf:'flex-start'},
  bolhaMT:{borderBottomRightRadius:2},
  bolhaDT:{borderBottomLeftRadius:2},
  replyBox:{flexDirection:'row',borderRadius:6,marginBottom:6,overflow:'hidden',backgroundColor:'rgba(0,0,0,0.06)',minWidth:250},
  encaminhadaRow:{flexDirection:'row',alignItems:'center',gap:4,marginBottom:3},
  encaminhadaTxt:{fontSize:11,color:'#8696A0',fontStyle:'italic',fontWeight:'600'},
  replyBoxM:{backgroundColor:'rgba(0,0,0,0.08)'},
  replyBoxD:{backgroundColor:'rgba(0,0,0,0.06)'},
  replyBar:{width:4},
  replyCont:{flex:1,padding:6},
  replyNome:{fontSize:12,fontWeight:'700',marginBottom:2},
  replyTxt:{fontSize:12,color:'#555'},
  msgTxt:{fontSize:15,color:'#111',lineHeight:20,minWidth:40},
  msgTxtM:{color:'#fff'},
  msgImg:{width:200,height:200,borderRadius:6,marginBottom:2},
  audioBox:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4,minWidth:160},
  audioOnda:{flex:1,flexDirection:'row',alignItems:'center',gap:2},
  audioBar:{width:3,borderRadius:2},
  audioDur:{fontSize:12,color:'#555',minWidth:36},
  ficBox:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4,maxWidth:180},
  chamadaBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  chamadaTxt: { fontSize: 14, color: '#111', fontWeight: '500' },
  ficNome:{fontSize:13,color:'#111',flex:1},
  metaRow:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:3,marginTop:2},
  metaRowM:{},
  hora:{fontSize:11,color:'#8696A0'},
  horaM:{color:'#8696A0'},
  replyPrev:{flexDirection:'row',alignItems:'center',backgroundColor:'#F0F2F5',paddingHorizontal:14,paddingVertical:8,borderTopWidth:1,borderTopColor:'#E4E6EB',gap:10},
  replyPrevBar:{width:4,height:'100%',backgroundColor:VERDE,borderRadius:2},
  replyPrevNome:{fontSize:13,fontWeight:'700',color:VERDE},
  replyPrevTxt:{fontSize:13,color:'#555'},
  inputWrap:{flexDirection:'row',alignItems:'center',paddingHorizontal:8,paddingVertical:6,gap:6,backgroundColor:'transparent'},
  inputIconBtn:{padding:4},
  inputCampo:{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderRadius:24,paddingHorizontal:14,paddingVertical:Platform.OS==='ios'?10:6,minHeight:42},
  inputTexto:{flex:1,fontSize:15,color:'#111',maxHeight:100},
  enviarBtn:{width:44,height:44,borderRadius:22,backgroundColor:VERDE_WA,alignItems:'center',justifyContent:'center'},
  enviarAudioBtn:{width:44,height:44,borderRadius:22,backgroundColor:VERDE,alignItems:'center',justifyContent:'center'},
  gravDot:{width:10,height:10,borderRadius:5,backgroundColor:'#E53935',marginRight:6},
  gravTxt:{fontSize:15,color:'#E53935',fontWeight:'600'},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)'},
  handle:{width:36,height:4,backgroundColor:'#CED0D4',borderRadius:2,alignSelf:'center',marginTop:10,marginBottom:6},
  sheet:{backgroundColor:'#fff',borderTopLeftRadius:22,borderTopRightRadius:22,paddingHorizontal:20,paddingBottom:36},
  sheetTit:{fontSize:16,fontWeight:'800',color:'#111',textAlign:'center',marginBottom:16,marginTop:4},
  anexosGrid:{flexDirection:'row',flexWrap:'wrap',gap:14,justifyContent:'center'},
  anexoItem:{alignItems:'center',gap:8,width:80},
  anexoIcone:{width:60,height:60,borderRadius:30,alignItems:'center',justifyContent:'center'},
  anexoLabel:{fontSize:12,color:'#333',fontWeight:'600',textAlign:'center'},
  cancelarBtn:{marginTop:20,backgroundColor:'#F0F2F5',borderRadius:12,paddingVertical:14,alignItems:'center'},
  cancelarTxt:{fontSize:15,fontWeight:'700',color:'#333'},
  denunciaSheet:{backgroundColor:'#fff',borderTopLeftRadius:22,borderTopRightRadius:22,maxHeight:'90%',paddingHorizontal:18},
  denSecTit:{fontSize:14,fontWeight:'700',color:'#111',marginBottom:10,marginTop:8},
  catGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},
  catItem:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:'#E4E6EB',backgroundColor:'#FAFAFA'},
  catItemSel:{backgroundColor:VERDE,borderColor:VERDE},
  catLabel:{fontSize:13,fontWeight:'600',color:'#333'},
  denInput:{borderWidth:1.5,borderColor:'#E4E6EB',borderRadius:12,padding:12,fontSize:14,color:'#111',minHeight:100,backgroundColor:'#FAFAFA'},
  denEnviarBtn:{backgroundColor:VERDE,borderRadius:12,paddingVertical:14,alignItems:'center',marginTop:16},
  denEnviarTxt:{fontSize:16,fontWeight:'800',color:'#fff'},
  capturaWrap:{marginBottom:16},
  capturaItem:{position:'relative',width:80,height:120,borderRadius:8,overflow:'hidden',borderWidth:1,borderColor:'#E4E6EB'},
  capturaImg:{width:'100%',height:'100%'},
  capturaRem:{position:'absolute',top:2,right:2,backgroundColor:'#fff',borderRadius:10,zIndex:5},
  addCapturaBtn:{width:80,height:120,borderRadius:8,borderStyle:'dashed',borderWidth:1.5,borderColor:'#25D366',alignItems:'center',justifyContent:'center',backgroundColor:'#F0F9F1'},
  addCapturaTxt:{fontSize:11,color:'#25D366',fontWeight:'700',marginTop:4},
  alertOv:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center',padding:30},
  alertCard:{backgroundColor:'#fff',borderRadius:16,width:'100%',overflow:'hidden',elevation:10},
  alertTit:{fontSize:16,fontWeight:'700',color:'#111',padding:20,textAlign:'center',borderBottomWidth:0.5,borderBottomColor:'#F0F0F5'},
  alertBtns:{flexDirection:'column'},
  alertBtn:{paddingVertical:16,alignItems:'center',borderBottomWidth:0.5,borderBottomColor:'#F0F0F5'},
  alertBtnTxt:{fontSize:17,color:'#007AFF',fontWeight:'500'},
});

const md = StyleSheet.create({
  sheet:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#fff',borderTopLeftRadius:22,borderTopRightRadius:22,maxHeight:'95%'},
  voltarBtn:{padding:16,paddingBottom:0},
  topo:{alignItems:'center',paddingTop:8,paddingBottom:16,borderBottomWidth:0.5,borderBottomColor:'#eee'},
  fotoWrap:{marginBottom:10},
  foto:{width:90,height:90,borderRadius:45},
  nome:{fontSize:22,fontWeight:'700',color:'#111',marginBottom:8},
  criptoBadge:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#F3F4F6',borderRadius:20,paddingHorizontal:12,paddingVertical:6},
  criptoTxt:{fontSize:13,color:'#555'},
  acoesBtns:{flexDirection:'row',justifyContent:'space-around',paddingVertical:20,borderBottomWidth:0.5,borderBottomColor:'#eee'},
  acaoItem:{alignItems:'center',gap:6,width:75},
  acaoCirculo:{width:54,height:54,borderRadius:27,backgroundColor:'#F3F4F6',alignItems:'center',justifyContent:'center'},
  acaoLabel:{fontSize:11,color:'#333',fontWeight:'500',textAlign:'center'},
  secTitulo:{fontSize:13,fontWeight:'700',color:'#111',paddingHorizontal:20,paddingTop:18,paddingBottom:8},
  itemLinha:{flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:20,paddingVertical:14,borderBottomWidth:0.5,borderBottomColor:'#F5F5F5'},
  itemIcone:{width:36,height:36,borderRadius:18,backgroundColor:'#F3F4F6',alignItems:'center',justifyContent:'center'},
  itemTxt:{fontSize:15,color:'#111',fontWeight:'400'},
  itemSubTxt:{fontSize:12,color:'#888',marginTop:2},
  itemValor:{fontSize:14,color:'#888',marginLeft:'auto'},
});

const cs = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#000'},
  vozFundo:{...StyleSheet.absoluteFillObject},
  vozFundoImg:{width:'100%',height:'100%',position:'absolute'},
  vozFundoOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.55)'},
  vozHeader:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:16,paddingTop:8},
  vozHeaderBtn:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,0.15)',alignItems:'center',justifyContent:'center'},
  vozCorpo:{flex:1,alignItems:'center',justifyContent:'center',gap:12},
  vozSub:{fontSize:16,color:'rgba(255,255,255,0.7)',fontWeight:'400'},
  vozNome:{fontSize:42,fontWeight:'300',color:'#fff',textAlign:'center',letterSpacing:-0.5},
  vozEstado:{fontSize:16,color:'rgba(255,255,255,0.7)'},
  vozAvatarWrap:{marginTop:20},
  vozAvatar:{width:140,height:140,borderRadius:70},
  vozBotoes:{flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingHorizontal:40,paddingBottom:48},
  vozBotoesNA:{flexDirection:'row',justifyContent:'space-around',alignItems:'flex-end',paddingHorizontal:10,paddingBottom:48},
  btnSec:{width:54,height:54,borderRadius:27,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  btnTerminar:{width:68,height:68,borderRadius:34,backgroundColor:'#FF3B30',alignItems:'center',justifyContent:'center'},
  btnCancel:{alignItems:'center',gap:8,width:80,height:80,borderRadius:40,backgroundColor:'rgba(255,255,255,0.2)',justifyContent:'center'},
  btnMic:{alignItems:'center',gap:8,width:80,height:80,borderRadius:40,backgroundColor:'rgba(255,255,255,0.15)',justifyContent:'center',paddingHorizontal:4},
  btnLigar:{alignItems:'center',gap:8,width:80,height:80,borderRadius:40,backgroundColor:VERDE,justifyContent:'center'},
  btnLabel:{fontSize:10,color:'#fff',textAlign:'center',fontWeight:'500'},
  audioModal:{backgroundColor:'#fff',borderTopLeftRadius:16,borderTopRightRadius:16,paddingHorizontal:20,paddingBottom:36,paddingTop:10},
  audioItem:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:16,borderBottomWidth:0.5,borderBottomColor:'#F0F0F0'},
  audioLabel:{fontSize:16,color:'#111',fontWeight:'400'},
  videoPoster:{width:120,height:120,borderRadius:60,marginBottom:16},
  videoNome:{fontSize:28,fontWeight:'300',color:'#fff',textAlign:'center',marginTop:16},
  videoEstado:{fontSize:15,color:'rgba(255,255,255,0.7)',marginTop:8},
  videoLocalWrap:{position:'absolute',top:100,right:16,width:100,height:140,borderRadius:12,overflow:'hidden',borderWidth:2,borderColor:'#fff',zIndex:10},
  videoLocal:{width:'100%',height:'100%'},
  videoHeader:{position:'absolute',top:0,left:0,right:0,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingTop:8,backgroundColor:'rgba(0,0,0,0.4)',zIndex:5},
  videoBotoes:{position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingHorizontal:40,paddingBottom:48,backgroundColor:'rgba(0,0,0,0.4)'},
});