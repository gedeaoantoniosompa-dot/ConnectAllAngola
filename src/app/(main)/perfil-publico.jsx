import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';

import { useVideoPlayer, VideoView } from 'expo-video';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PostComentariosModal from '../../components/PostComentariosModal';
import { useVisualizador } from '../../components/VisualizadorFicheiro';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const { width, height: SCREEN_H } = Dimensions.get('window');

const C = {
  azul:       '#0A66C2',
  azulEscuro: '#004182',
  azulClaro:  '#EEF3FB',
  branco:     '#FFFFFF',
  preto:      '#000000',
  cinza1:     '#F3F2EE',
  cinza2:     '#E9E5DF',
  cinza3:     '#666360',
  cinza4:     '#1B1B1B',
  verde:      '#057642',
  vermelho:   '#E00000',
  error:      '#CC1016',
  roxo:       '#7C3AED',
  roxoClaro:  '#F3EEFF',
};

function tempoRelativo(timestamp) {
  if (!timestamp) return '';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((agora - data) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// NOVO: normaliza mediaUrls para { url, type }, aceitando tanto o
// formato novo (objectos { url, type }) como publicações antigas
// (strings simples, sempre tratadas como imagem). Mesma lógica usada
// na Página da Empresa / Perfil Público da Empresa.
function normalizarMedia(mediaUrls) {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls
    .map(m => {
      if (typeof m === 'string') return { url: m, type: 'image' };
      if (m && typeof m === 'object') {
        return { url: m.url || null, type: m.type === 'video' ? 'video' : 'image' };
      }
      return null;
    })
    .filter(item => item && item.url);
}

function BadgeVerificado({ size = 16 }) {
  return <Ionicons name="shield-checkmark" size={size} color="#1677F2" />;
}

function Divisor() {
  return <View style={s.divisorLinha} />;
}

function SeccaoCard({ children, estilo }) {
  return <View style={[s.seccaoCard, estilo]}>{children}</View>;
}

function InfoLinha({ icone, label, valor }) {
  if (!valor) return null;
  return (
    <View style={s.infoLinha}>
      <View style={s.infoIconBox}><Feather name={icone} size={15} color={C.azul} /></View>
      <View style={s.infoMeta}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValor}>{String(valor)}</Text>
      </View>
    </View>
  );
}

// Variante roxa, usada só nos dados profissionais de contas de Recrutador,
// para dar destaque visual (a mesma linguagem de cor usada no perfil do
// próprio recrutador para o vínculo profissional).
function InfoLinhaInstitucional({ icone, label, valor }) {
  if (!valor) return null;
  return (
    <View style={s.infoLinha}>
      <View style={[s.infoIconBox, { backgroundColor: C.roxoClaro }]}><Feather name={icone} size={15} color={C.roxo} /></View>
      <View style={s.infoMeta}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValor}>{String(valor)}</Text>
      </View>
    </View>
  );
}

// Tag "Recrutador", mostrada junto ao nome quando o perfil visitado
// pertence a uma conta de recrutador — dá destaque imediato ao tipo de
// conta, tal como um selo de verificação.
function TagRecrutador() {
  return (
    <View style={s.recrutadorTag}>
      <Ionicons name="business" size={12} color={C.roxo} />
      <Text style={s.recrutadorTagTxt}>Recrutador</Text>
    </View>
  );
}

function Chip({ label, destaque }) {
  return (
    <View style={[s.chip, destaque && s.chipDestaque]}>
      <Text style={[s.chipTxt, destaque && s.chipTxtDestaque]}>{label}</Text>
    </View>
  );
}

function PessoasParaConhecer({ empresaAtual, uidActual }) {
  const router = useRouter();
  const [pessoas, setPessoas] = useState([]);
  useEffect(() => {
    if (!empresaAtual || empresaAtual === 'Desempregado') return;
    const q = query(collection(db, 'users'), where('empresa', '==', empresaAtual));
    const unsub = onSnapshot(q, snap => {
      setPessoas(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== uidActual).slice(0, 5));
    });
    return unsub;
  }, [empresaAtual]);
  if (pessoas.length === 0) return null;
  return (
    <SeccaoCard>
      <Text style={s.seccaoTitulo}>Pessoas que talvez conheças</Text>
      <Text style={[s.infoLabel, { marginBottom: 12 }]}>Da mesma empresa</Text>
      {pessoas.map((p, i) => {
        const iniciais = (p.nome || 'U').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
        return (
          <TouchableOpacity key={p.uid} style={[s.pessoaItem, i < pessoas.length - 1 && s.pessoaItemBorda]}
            onPress={() => router.push({ pathname: '/(main)/perfil-publico', params: { uid: p.uid } })}>
            <View style={s.pessoaAvatar}>
              {p.fotoURL ? <Image source={{ uri: p.fotoURL }} style={s.pessoaAvatarImg} />
                : <View style={s.pessoaAvatarFallback}><Text style={s.pessoaAvatarIniciais}>{iniciais}</Text></View>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pessoaNome} numberOfLines={1}>{p.nome || 'Utilizador'}</Text>
              <Text style={s.pessoaCargo} numberOfLines={1}>{p.cargo || p.empresa || '—'}</Text>
            </View>
            <TouchableOpacity style={s.pessoaBtnConectar}>
              <Feather name="user-plus" size={12} color={C.azul} />
              <Text style={s.pessoaBtnTxt}>Conectar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </SeccaoCard>
  );
}

function MaisPerfis({ areaAtual, uidActual }) {
  const router = useRouter();
  const [perfis, setPerfis] = useState([]);
  useEffect(() => {
    if (!areaAtual) return;
    const q = query(collection(db, 'users'), where('area', '==', areaAtual));
    const unsub = onSnapshot(q, snap => {
      setPerfis(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== uidActual).slice(0, 5));
    });
    return unsub;
  }, [areaAtual]);
  if (perfis.length === 0) return null;
  return (
    <SeccaoCard>
      <Text style={s.seccaoTitulo}>Mais perfis para você</Text>
      {perfis.map((p, i) => {
        const iniciais = (p.nome || 'U').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
        return (
          <TouchableOpacity key={p.uid} style={[s.pessoaItem, i < perfis.length - 1 && s.pessoaItemBorda]}
            onPress={() => router.push({ pathname: '/(main)/perfil-publico', params: { uid: p.uid } })}>
            <View style={s.pessoaAvatar}>
              {p.fotoURL ? <Image source={{ uri: p.fotoURL }} style={s.pessoaAvatarImg} />
                : <View style={s.pessoaAvatarFallback}><Text style={s.pessoaAvatarIniciais}>{iniciais}</Text></View>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pessoaNome} numberOfLines={1}>{p.nome || 'Utilizador'}</Text>
              <Text style={s.pessoaCargo} numberOfLines={2}>{p.cargo || '—'}</Text>
            </View>
            <TouchableOpacity style={s.pessoaBtnConectar}>
              <Feather name="user-plus" size={12} color={C.azul} />
              <Text style={s.pessoaBtnTxt}>Conectar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </SeccaoCard>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VÍDEO — mesma forma de visualização usada na Página da Empresa e no
// Perfil Público da Empresa: reprodução inline no cartão, com controlos
// nativos, sem overlay de play e sem abrir um visualizador fullscreen à
// parte. Toca/pausa automaticamente consoante `isActive` (100% visível
// na lista + ecrã em foco).
// ════════════════════════════════════════════════════════════════════════════
function PostVideoInline({ uri, isActive }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = false;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      style={s.postVideo}
      player={player}
      contentFit="cover"
      nativeControls
      allowsFullscreen
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CARTÃO DE PUBLICAÇÃO — mesmo layout/comportamento da página da empresa
// (cabeçalho com avatar/nome, texto, imagem OU vídeo, stats e acções)
// ════════════════════════════════════════════════════════════════════════════
function PostPerfil({ post, perfil, estaVerificado, meuUid, isActive, onAbrirImagem, onLike, onComentar, onPartilhar }) {
  const itensMedia = normalizarMedia(post.mediaUrls);
  const imagens = itensMedia.filter(item => item.type !== 'video');
  const video = itensMedia.find(item => item.type === 'video');

  const jaGostei = Array.isArray(post.likedBy) && meuUid ? post.likedBy.includes(meuUid) : false;
  const nomeAutor = post.autorNome || perfil?.nome || 'Utilizador';
  const iniciais = nomeAutor.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <View style={s.postAvatar}>
          {(post.autorFoto || perfil?.fotoURL)
            ? <Image source={{ uri: post.autorFoto || perfil.fotoURL }} style={s.postAvatarImg} />
            : <View style={s.postAvatarFallback}><Text style={s.postAvatarIniciais}>{iniciais}</Text></View>}
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.postNameRow}>
            <Text style={s.postAuthor} numberOfLines={1}>{nomeAutor}</Text>
            {estaVerificado && <Ionicons name="checkmark-circle" size={14} color={C.azul} />}
          </View>
          <Text style={s.postRole} numberOfLines={1}>
            {post.autorCargo || perfil?.tituloProfissional || perfil?.cargo || ''} · {tempoRelativo(post.timestamp)}
          </Text>
        </View>
      </View>

      {!!post.texto && <Text style={s.postText}>{post.texto}</Text>}

      {/* Publicação com vídeo — igual à Página da Empresa: reprodução
          inline com controlos nativos, sem abrir fullscreen à parte.
          Toca/pausa automaticamente consoante `isActive`. */}
      {video ? (
        <PostVideoInline uri={video.url} isActive={isActive} />
      ) : (
        imagens.length > 0 && (
          <View style={s.mediaGrid}>
            {imagens.map((item) => {
              const indice = itensMedia.indexOf(item);
              return (
                <TouchableOpacity
                  key={`${post.id}-${indice}`}
                  activeOpacity={0.92}
                  onPress={() => onAbrirImagem(post, indice)}
                  style={[
                    s.postImageWrap,
                    imagens.length === 1 ? s.postImageOne : s.postImageMany,
                  ]}
                >
                  <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} />
                </TouchableOpacity>
              );
            })}
          </View>
        )
      )}

      <View style={s.postStats}>
        <Text style={s.statText}>❤️ {Number(post.likes || 0)}</Text>
        <Text style={s.statText}>💬 {Number(post.comentarios || 0)}</Text>
        <Text style={s.statText}>↗ {Number(post.partilhas || 0)}</Text>
      </View>

      <View style={s.postActions}>
        <TouchableOpacity style={s.postAction} onPress={() => onLike(post)}>
          <Ionicons
            name={jaGostei ? 'heart-sharp' : 'heart-outline'}
            size={18}
            color={jaGostei ? C.vermelho : C.cinza3}
          />
          <Text style={[s.postActionText, jaGostei && { color: C.vermelho, fontWeight: '700' }]}>Gosto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.postAction} onPress={() => onComentar(post)}>
          <Ionicons name="chatbubble-outline" size={18} color={C.cinza3} />
          <Text style={s.postActionText}>Comentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.postAction} onPress={() => onPartilhar(post)}>
          <Ionicons name="paper-plane-outline" size={18} color={C.cinza3} />
          <Text style={s.postActionText}>Partilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VISUALIZADOR FULLSCREEN DAS PUBLICAÇÕES (imagem + acções sobrepostas)
// Nota: o vídeo NUNCA abre aqui — segue o mesmo padrão da Página da
// Empresa, onde o vídeo é sempre reproduzido inline no cartão. Este
// visualizador continua a existir apenas para publicações com imagens.
// ════════════════════════════════════════════════════════════════════════════
function FullscreenPostPerfil({ visivel, post, perfil, indiceInicial, meuUid, jaGostei, onFechar, onLike, onComentar, onPartilhar }) {
  const [indice, setIndice] = useState(indiceInicial || 0);

  useEffect(() => {
    if (visivel) setIndice(indiceInicial || 0);
  }, [visivel, indiceInicial]);

  if (!post) return null;

  const imagens = normalizarMedia(post.mediaUrls)
    .filter(item => item.type !== 'video')
    .map(item => item.url);
  const n = imagens.length;

  return (
    <Modal visible={visivel} transparent={false} animationType="fade" onRequestClose={onFechar} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <TouchableOpacity style={fs.voltar} onPress={onFechar}>
          <Ionicons name="arrow-back" size={26} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        {n > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: indice * width, y: 0 }}
            onMomentumScrollEnd={e => setIndice(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={{ flex: 1 }}
          >
            {imagens.map((url, i) => (
              <View key={i} style={{ width, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: url }} style={{ width, height: SCREEN_H, resizeMode: 'contain' }} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff' }}>{post.texto}</Text>
          </View>
        )}

        <View style={fs.acoes}>
          <TouchableOpacity activeOpacity={0.8} onPress={onLike} style={{ alignItems: 'center' }}>
            <Ionicons
              name={jaGostei ? 'heart-sharp' : 'heart-outline'}
              size={28}
              color={jaGostei ? C.vermelho : 'rgba(255,255,255,0.9)'}
            />
            <Text style={fs.contagem}>{Number(post.likes || 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={onComentar} style={{ alignItems: 'center' }}>
            <Ionicons name="chatbubble-outline" size={26} color="rgba(255,255,255,0.9)" />
            <Text style={fs.contagem}>{Number(post.comentarios || 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={onPartilhar} style={{ alignItems: 'center' }}>
            <Ionicons name="paper-plane-outline" size={26} color="rgba(255,255,255,0.9)" />
            <Text style={fs.contagem}>{Number(post.partilhas || 0)}</Text>
          </TouchableOpacity>
        </View>

        <View style={fs.rodape}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={s.postAvatar}>
              {(post.autorFoto || perfil?.fotoURL)
                ? <Image source={{ uri: post.autorFoto || perfil.fotoURL }} style={s.postAvatarImg} />
                : <View style={s.postAvatarFallback}><Text style={s.postAvatarIniciais}>{(post.autorNome || perfil?.nome || 'U').charAt(0).toUpperCase()}</Text></View>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fs.autorNome} numberOfLines={1}>{post.autorNome || perfil?.nome || 'Utilizador'}</Text>
              <Text style={fs.autorCargo} numberOfLines={1}>{tempoRelativo(post.timestamp)}</Text>
            </View>
          </View>
          {!!post.texto && <Text style={fs.textoPost} numberOfLines={4}>{post.texto}</Text>}
        </View>

        {n > 1 && (
          <View style={fs.contadorPaginas}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{indice + 1} / {n}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function PerfilPublicoScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams();
  const { user, perfil: meuPerfil } = useUser();
  const { abrir, Visualizador } = useVisualizador();
  const [perfil, setPerfil] = useState(null);
  const [profissional, setProfissional] = useState(null);
  const [posts, setPosts] = useState([]);

  const [banners, setBanners] = useState([]);
  const [bannerIdx, setBannerIdx] = useState(0);

  const [carregando, setCarregando] = useState(true);

  // ── Estado de conexão sincronizado com o mesmo esquema usado em
  //    conexoes.jsx: users/{uid}/conexoes/{outroUid} com estado
  //    'pendente' | 'confirmado', e notificações em
  //    users/{uid}/notificacoes_conexao/{outroUid}. ──
  const [minhaConexao, setMinhaConexao] = useState(null); // doc de users/{meuUid}/conexoes/{uid}
  const [pedidoRecebido, setPedidoRecebido] = useState(null); // doc de users/{meuUid}/notificacoes_conexao/{uid}
  const [conectando, setConectando] = useState(false);

  const [mostrarTudoBio, setMostrarTudoBio] = useState(false);
  const [modalImagem, setModalImagem] = useState(false);
  const [imagemExpandida, setImagemExpandida] = useState('');

  const [fsPost, setFsPost] = useState(null);
  const [fsIndice, setFsIndice] = useState(0);
  const [modalComentarios, setModalComentarios] = useState(null);

  // NOVO: id da publicação cujo vídeo está 100% visível na lista (só
  // esse reproduz — o mesmo mecanismo usado na Página da Empresa e no
  // Perfil Público da Empresa).
  const [postAtivoId, setPostAtivoId] = useState(null);

  // NOVO: indica se ESTE ecrã está em foco. O Expo Router mantém ecrãs
  // anteriores montados na pilha de navegação, por isso sem isto um
  // vídeo marcado como "activo" continuaria a tocar em segundo plano
  // mesmo depois de sair deste ecrã (voltar, abrir outro perfil, etc.).
  const [ecraFocado, setEcraFocado] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setEcraFocado(true);
      return () => {
        setEcraFocado(false);
        setPostAtivoId(null);
      };
    }, []),
  );

  // viewabilityConfig/callback precisam de referência estável entre
  // renders, por isso usamos useRef em vez de recriá-los a cada render.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 100 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visivel = viewableItems.find(v => v.isViewable);
    setPostAtivoId(visivel ? visivel.item.id : null);
  }).current;

  const eProprio = user?.uid === uid;

  useEffect(() => {
    if (!uid) return;
    setCarregando(true);
    setPerfil(null);
    setPosts([]);
    const carregar = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) setPerfil({ uid: snap.id, ...snap.data() });
      } catch (err) { console.log('Erro perfil:', err); }
      finally { setCarregando(false); }
    };
    carregar();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    setPosts([]);
    const q = query(collection(db, 'posts'), where('uid', '==', uid), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(lista);
      // Mantém o post aberto em fullscreen sincronizado (likes/comentários em tempo real)
      setFsPost(prev => (prev ? lista.find(p => p.id === prev.id) || prev : prev));
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', uid, 'perfis', 'profissional'),
      (snap) => snap.exists() ? setProfissional(snap.data()) : setProfissional(null)
    );
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracoes', 'banners'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const lista = [d.banner1, d.banner2, d.banner3, d.utilizador]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i);
        setBanners(lista);
        setBannerIdx(0);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const iv = setInterval(() => {
      setBannerIdx(prev => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(iv);
  }, [banners]);

  // ── Estado de conexão em tempo real — MESMO esquema de dados usado em
  //    conexoes.jsx, para que as duas telas fiquem sempre sincronizadas.
  //    Um pedido enviado fica 'pendente' até o outro utilizador aceitar
  //    (o que actualiza o estado para 'confirmado' em ambos os lados). ──
  useEffect(() => {
    if (!user?.uid || !uid || eProprio) {
      setMinhaConexao(null);
      setPedidoRecebido(null);
      return;
    }

    const unsubConexao = onSnapshot(
      doc(db, 'users', user.uid, 'conexoes', uid),
      snap => setMinhaConexao(snap.exists() ? snap.data() : null),
      () => setMinhaConexao(null),
    );

    const unsubPedido = onSnapshot(
      doc(db, 'users', user.uid, 'notificacoes_conexao', uid),
      snap => setPedidoRecebido(snap.exists() && snap.data()?.estado === 'pendente' ? snap.data() : null),
      () => setPedidoRecebido(null),
    );

    return () => { unsubConexao(); unsubPedido(); };
  }, [user?.uid, uid, eProprio]);

  const conectado         = minhaConexao?.estado === 'confirmado';
  const pendenteEnviado   = minhaConexao?.estado === 'pendente';
  const pendenteRecebido  = !conectado && !pendenteEnviado && !!pedidoRecebido;

  // ── Enviar pedido de conexão: cria doc 'pendente' + notificação para o
  //    outro utilizador. Só fica "Conectado" quando ele aceitar. ──
  const enviarPedido = async () => {
    if (!user?.uid || eProprio || conectando) return;
    setConectando(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'conexoes', uid), {
        uid, conectadoEm: new Date().toISOString(), estado: 'pendente',
      });
      await setDoc(doc(db, 'users', uid, 'notificacoes_conexao', user.uid), {
        uid: user.uid,
        nome: meuPerfil?.nome || 'Utilizador',
        fotoURL: meuPerfil?.fotoURL || null,
        estado: 'pendente',
        data: new Date().toISOString(),
      });
    } catch (err) {
      console.log('Erro conexão:', err);
      Alert.alert('Erro', 'Não foi possível enviar o pedido.');
    } finally {
      setConectando(false);
    }
  };

  // ── Cancelar um pedido que EU enviei e ainda está pendente ──
  const cancelarPedido = () => {
    if (conectando) return;
    Alert.alert('Cancelar pedido', 'Tens a certeza?', [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: async () => {
          setConectando(true);
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'conexoes', uid));
            await deleteDoc(doc(db, 'users', uid, 'notificacoes_conexao', user.uid));
          } catch (_) {
          } finally {
            setConectando(false);
          }
        },
      },
    ]);
  };

  // ── Aceitar um pedido que EU recebi deste utilizador ──
  const aceitarPedidoRecebido = async () => {
    if (!user?.uid || conectando) return;
    setConectando(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'conexoes', uid), {
        uid, conectadoEm: new Date().toISOString(), estado: 'confirmado',
      });
      await setDoc(doc(db, 'users', uid, 'conexoes', user.uid), {
        uid: user.uid, conectadoEm: new Date().toISOString(), estado: 'confirmado',
      });
      await deleteDoc(doc(db, 'users', user.uid, 'notificacoes_conexao', uid));
    } catch (err) {
      console.log('Erro ao aceitar pedido:', err);
    } finally {
      setConectando(false);
    }
  };

  // ── Ignorar um pedido que EU recebi deste utilizador ──
  const ignorarPedidoRecebido = async () => {
    if (!user?.uid || conectando) return;
    setConectando(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notificacoes_conexao', uid));
    } catch (_) {
    } finally {
      setConectando(false);
    }
  };

  // ── Remover uma conexão já confirmada ──
  const removerLigacao = () => {
    Alert.alert('Remover conexão', `Remover ${perfil?.nome || 'esta pessoa'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'conexoes', uid));
            await deleteDoc(doc(db, 'users', uid, 'conexoes', user.uid));
          } catch (_) {}
        },
      },
    ]);
  };

  const iniciarConversa = () => {
    router.push({
      pathname: '/(main)/conversa',
      params: { outroUid: uid, outroNome: perfil?.nome || 'Utilizador', outraFoto: perfil?.fotoURL || '' },
    });
  };

  const abrirImagem = (url) => { if (url) { setImagemExpandida(url); setModalImagem(true); } };

  // ── Gosto: mesmo schema usado no feed geral / página da empresa
  //    (likes/likedBy/reacoesMap) ──
  const alternarLike = async (post) => {
    if (!user?.uid) {
      Alert.alert('Sessão necessária', 'Inicia sessão para reagir a esta publicação.');
      return;
    }
    const postRef = doc(db, 'posts', post.id);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(postRef);
        if (!snap.exists()) return;

        const data = snap.data() || {};
        const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
        const jaGostou = likedBy.includes(user.uid);
        const novoLikedBy = jaGostou
          ? likedBy.filter(id => id !== user.uid)
          : [...new Set([...likedBy, user.uid])];

        const novoReacoesMap = { ...(data.reacoesMap || {}) };
        if (jaGostou) delete novoReacoesMap[user.uid];
        else novoReacoesMap[user.uid] = '❤️';

        transaction.update(postRef, {
          likedBy: novoLikedBy,
          likes: novoLikedBy.length,
          reacoesMap: novoReacoesMap,
        });
      });
    } catch (err) {
      console.log('Erro like:', err);
      Alert.alert('Erro', 'Não foi possível registar o gosto.');
    }
  };

  const abrirComentarios = (post) => setModalComentarios({ postId: post.id, post });

  const partilharPost = async (post) => {
    try {
      await Share.share({ message: `${perfil?.nome || 'Utilizador'}\n\n${post.texto || ''}` });
      await updateDoc(doc(db, 'posts', post.id), { partilhas: Number(post.partilhas || 0) + 1 });
    } catch (err) {
      console.log('Erro partilhar:', err);
    }
  };

  const abrirFullscreen = (post, indice = 0) => { setFsPost(post); setFsIndice(indice); };

  const estaVerificado = profissional?.verificado === true || perfil?.verificado === true || perfil?.isVerified === true;

  if (carregando) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centro}><ActivityIndicator size="large" color={C.azul} /></View>
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centro}><Text style={s.erroText}>Perfil não encontrado.</Text></View>
      </SafeAreaView>
    );
  }

  const nome             = perfil.nome || 'Utilizador';
  const iniciais         = nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const titulo           = perfil.tituloProfissional || perfil.cargo || 'Profissional';
  const localizacao      = [perfil.municipio, perfil.provincia].filter(Boolean).join(', ') || perfil.cidade || '';
  const telefone         = perfil.telPrincipal || perfil.telefone || '';
  const gmail            = perfil.email || '';
  const emailPerfil      = perfil.emailCorporativo || perfil.emailContacto || '';
  const resumoPerfil     = perfil.resumo || perfil.bio || '';
  const formacoes        = Array.isArray(perfil.formacoes)            ? perfil.formacoes            : [];
  const experiencias     = Array.isArray(perfil.experiencias)         ? perfil.experiencias         : [];
  const certificacoes    = Array.isArray(perfil.certificacoes)        ? perfil.certificacoes        : [];
  const compTecnicas     = Array.isArray(perfil.competenciasTecnicas) ? perfil.competenciasTecnicas : [];
  const compPessoais     = Array.isArray(perfil.competenciasPessoais) ? perfil.competenciasPessoais : [];
  const idiomas          = Array.isArray(perfil.idiomas)              ? perfil.idiomas              : [];
  const certUrls         = Array.isArray(perfil.certUrls)             ? perfil.certUrls             : [];
  const interesses       = Array.isArray(perfil.interesses)           ? perfil.interesses           : [];
  const numConexoes      = perfil.conexoes?.length || 0;
  const bioLonga         = resumoPerfil.length > 120;

  // ── Conta de Recrutador: dados profissionais/institucionais gravados em
  // dadosProfissionais (mesmo campo usado em my-profile-recrutador.jsx) ──
  const dadosProf        = perfil.dadosProfissionais || {};
  const ehRecrutador      = perfil.tipoPerfil === 'recrutador' || !!dadosProf.empresa;
  const vinculoAprovadoRecrutador = perfil.statusVerificacaoRecrutador === 'aprovado';
  const anosExpRecrutador = dadosProf.anosExp ? `${dadosProf.anosExp} ano(s)` : '';
  const temDadosProfRecrutador = !!(dadosProf.empresa || dadosProf.cargo || dadosProf.departamento || dadosProf.setor || dadosProf.areaRH || anosExpRecrutador || dadosProf.dataEntrada);

  // NOVO: cabeçalho — tudo o que antes vinha antes da lista de
  // publicações (card principal, resumo, experiência, formação,
  // competências, certificações, idiomas, dados pessoais, perfil
  // profissional, dados profissionais de recrutador, documentos, redes,
  // interesses, contacto e o cabeçalho da secção de publicações) passa a
  // ser o ListHeaderComponent do FlatList — só assim conseguimos usar
  // onViewableItemsChanged para saber qual publicação está 100% visível.
  const cabecalho = (
    <>
      {/* ── CARD PRINCIPAL ── */}
      <View style={s.cardPrincipal}>
        <TouchableOpacity onPress={() => perfil.capaURL && abrirImagem(perfil.capaURL)} activeOpacity={0.9}>
          {perfil.capaURL
            ? <ImageBackground source={{ uri: perfil.capaURL }} style={s.capa} />
            : <View style={s.capaVazia} />}
        </TouchableOpacity>

        <View style={s.avatarRow}>
          <TouchableOpacity onPress={() => perfil.fotoURL && abrirImagem(perfil.fotoURL)} style={s.avatarCirculo}>
            {perfil.fotoURL
              ? <Image source={{ uri: perfil.fotoURL }} style={s.avatarImagem} />
              : <View style={s.avatarFallback}><Text style={s.avatarLetra}>{iniciais}</Text></View>}
          </TouchableOpacity>
          {(perfil.empresa && perfil.empresa !== 'Desempregado') ? (
            <View style={s.empresaBadge}>
              <View style={s.empresaLogo}><Feather name="briefcase" size={14} color="#555" /></View>
              <Text style={s.empresaBadgeTxt} numberOfLines={2}>{perfil.empresa}</Text>
            </View>
          ) : formacoes[0]?.instituicao ? (
            <View style={s.empresaBadge}>
              <View style={s.empresaLogo}><Feather name="book" size={14} color="#555" /></View>
              <Text style={s.empresaBadgeTxt} numberOfLines={2}>{formacoes[0].instituicao}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.infoPrincipalWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <Text style={s.nome}>{nome}</Text>
            {estaVerificado && <BadgeVerificado size={22} />}
            {ehRecrutador && <TagRecrutador />}
          </View>

          <Text style={s.tituloProfissional}>
            {titulo}{experiencias[0]?.empresa ? ` na ${experiencias[0].empresa}` : ''}
          </Text>

          {localizacao ? (
            <View style={s.localizacaoRow}>
              <Text style={s.localizacaoTxt}>{localizacao}</Text>
              {(telefone || emailPerfil) && <Text style={s.separadorDot}>·</Text>}
              {(telefone || emailPerfil) && <Text style={s.linkAzul}>Contacto</Text>}
            </View>
          ) : null}

          <View style={s.metaRow}>
            {numConexoes > 0 && (
              <Text style={s.conexoesTxt}>{numConexoes >= 500 ? '+ de 500' : numConexoes} conexões</Text>
            )}
            {estaVerificado && (
              <View style={[s.badgeVerde, { borderColor: '#1677F2', backgroundColor: '#EEF4FF' }]}>
                <BadgeVerificado size={12} />
                <Text style={[s.badgeVerdeTxt, { color: '#1677F2' }]}>Verificado</Text>
              </View>
            )}
          </View>

          {(perfil.situacaoProf || perfil.disponibilidade) && (
            <View style={s.situacaoCard}>
              <Text style={s.situacaoTitulo}>{perfil.situacaoProf || 'Disponível'}</Text>
              {localizacao ? <Text style={s.situacaoSub}>{localizacao}</Text> : null}
              {perfil.disponibilidade ? <Text style={s.linkAzul}>{perfil.disponibilidade}</Text> : null}
            </View>
          )}

          {/* ── Botões de acção: Conectar / Pedido enviado / Aceitar-Ignorar / Conectado ──
              Usa exactamente o mesmo esquema de dados da tela de Conexões,
              por isso os dois ecrãs ficam sempre sincronizados. */}
          {!eProprio && (
            <View style={s.botoesAcaoRow}>
              {pendenteRecebido ? (
                <>
                  <TouchableOpacity style={s.btnConectar} onPress={aceitarPedidoRecebido} disabled={conectando}>
                    {conectando
                      ? <ActivityIndicator size="small" color={C.branco} />
                      : <>
                          <Feather name="user-check" size={14} color={C.branco} />
                          <Text style={s.btnConectarTxt}>Aceitar</Text>
                        </>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnMais} onPress={ignorarPedidoRecebido} disabled={conectando}>
                    <Text style={s.btnMaisTxt}>Ignorar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[s.btnConectar, (conectado || pendenteEnviado) && s.btnConectado]}
                  onPress={conectado ? removerLigacao : pendenteEnviado ? cancelarPedido : enviarPedido}
                  disabled={conectando}
                >
                  {conectando
                    ? <ActivityIndicator size="small" color={(conectado || pendenteEnviado) ? C.azul : C.branco} />
                    : <>
                        <Feather
                          name={conectado ? 'user-check' : pendenteEnviado ? 'clock' : 'user-plus'}
                          size={14}
                          color={(conectado || pendenteEnviado) ? C.azul : C.branco}
                        />
                        <Text style={[s.btnConectarTxt, (conectado || pendenteEnviado) && s.btnConectadoTxt]}>
                          {conectado ? 'Conectado' : pendenteEnviado ? 'Pedido enviado' : 'Conectar'}
                        </Text>
                      </>}
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnMsg} onPress={iniciarConversa}>
                <Feather name="message-circle" size={14} color={C.azul} />
                <Text style={s.btnMsgTxt}>Mensagem</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── Resumo Professional ── */}
      {resumoPerfil ? (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Resumo Professional</Text>
          <Text style={s.bioTexto} numberOfLines={mostrarTudoBio ? undefined : 5}>{resumoPerfil}</Text>
          {bioLonga && (
            <TouchableOpacity onPress={() => setMostrarTudoBio(!mostrarTudoBio)}>
              <Text style={s.verMais}>{mostrarTudoBio ? '...ver menos' : '...ver mais'}</Text>
            </TouchableOpacity>
          )}
        </SeccaoCard>
      ) : null}

      {/* ── EXPERIÊNCIA PROFISSIONAL ── */}
      {experiencias.length > 0 && (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Experiência</Text>
          {experiencias.map((e, i) => (
            <View key={i} style={[s.expItem, i < experiencias.length - 1 && s.expItemBorda]}>
              <View style={s.expLogoBg}>
                {e.logoEmpresa
                  ? <Image source={{ uri: e.logoEmpresa }} style={s.expLogo} />
                  : <Feather name="briefcase" size={20} color={C.cinza3} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.expCargo}>{e.cargo}</Text>
                <Text style={s.expEmpresa}>{e.empresa}{e.setor ? ` · ${e.setor}` : ''}</Text>
                <Text style={s.expData}>{e.dataInicio}{e.atual ? ' · Atual' : e.dataFim ? ` → ${e.dataFim}` : ''}</Text>
                {e.descricao ? <Text style={s.expDesc}>{e.descricao}</Text> : null}
                {e.resultados ? (
                  <View style={s.resultadosBox}>
                    <Text style={s.resultadosTitulo}>Principais resultados</Text>
                    <Text style={s.resultadosTxt}>{e.resultados}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </SeccaoCard>
      )}

      {/* ── FORMAÇÃO ACADÉMICA ── */}
      {formacoes.length > 0 && (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Formação académica</Text>
          {formacoes.map((f, i) => (
            <View key={i} style={[s.expItem, i < formacoes.length - 1 && s.expItemBorda]}>
              <View style={s.expLogoBg}><Feather name="book-open" size={20} color={C.cinza3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.expCargo}>{f.curso}</Text>
                <Text style={s.expEmpresa}>{f.instituicao}{f.grau ? ` · ${f.grau}` : ''}</Text>
                {f.area ? <Text style={s.expData}>{f.area}</Text> : null}
                <Text style={s.expData}>{f.anoInicio}{f.emCurso ? ' · Em curso' : f.anoConclusao ? ` → ${f.anoConclusao}` : ''}</Text>
              </View>
            </View>
          ))}
        </SeccaoCard>
      )}

      {/* ── COMPETÊNCIAS ── */}
      {(compTecnicas.length + compPessoais.length) > 0 && (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Competências</Text>
          {compTecnicas.length > 0 && (
            <>
              <Text style={s.subSecTitulo}>Técnicas</Text>
              <View style={s.chipGrupo}>{compTecnicas.map(c => <Chip key={c} label={c} destaque />)}</View>
            </>
          )}
          {compPessoais.length > 0 && (
            <>
              <Text style={[s.subSecTitulo, { marginTop: 12 }]}>Interpessoais</Text>
              <View style={s.chipGrupo}>{compPessoais.map(c => <Chip key={c} label={c} />)}</View>
            </>
          )}
        </SeccaoCard>
      )}

      {/* ── CERTIFICAÇÕES ── */}
      {(certificacoes.length > 0 || certUrls.length > 0) && (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Certificações e Formações</Text>
          {certificacoes.map((c, i) => (
            <View key={i} style={[s.expItem, i < certificacoes.length - 1 && s.expItemBorda]}>
              <View style={s.expLogoBg}><Feather name="award" size={20} color={C.cinza3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.expCargo}>{c.nome}</Text>
                {c.instituicao ? <Text style={s.expEmpresa}>{c.instituicao}</Text> : null}
                {c.data ? <Text style={s.expData}>{c.data}</Text> : null}
                {c.certificadoUri ? (
                  <TouchableOpacity onPress={() => abrir(c.certificadoUri, c.nome)} style={s.linkBtn}>
                    <Feather name="external-link" size={13} color={C.azul} />
                    <Text style={s.linkBtnTxt}>Ver certificado</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
          {certUrls.map((url, i) => (
            <TouchableOpacity key={`url-${i}`} style={[s.expItem, s.expItemBorda]} onPress={() => abrir(url, `Certificado ${i + 1}`)}>
              <View style={s.expLogoBg}><Feather name="award" size={20} color={C.cinza3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.expCargo}>{`Certificado ${i + 1}`}</Text>
                <Text style={s.expData}>Toque para visualizar</Text>
              </View>
              <Feather name="external-link" size={14} color={C.cinza3} />
            </TouchableOpacity>
          ))}
        </SeccaoCard>
      )}

      {/* ── IDIOMAS ── */}
      {idiomas.length > 0 && (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Idiomas</Text>
          {idiomas.map((id, i) => (
            <View key={i} style={s.idiomaItem}>
              <Text style={s.idiomaNome}>{id.idioma}</Text>
              <View style={s.idiomaGrid}>
                <View style={s.idiomaCol}><Text style={s.idiomaLabel}>Leitura</Text><Text style={s.idiomaValor}>{id.leitura}</Text></View>
                <View style={s.idiomaDivisor} />
                <View style={s.idiomaCol}><Text style={s.idiomaLabel}>Escrita</Text><Text style={s.idiomaValor}>{id.escrita}</Text></View>
                <View style={s.idiomaDivisor} />
                <View style={s.idiomaCol}><Text style={s.idiomaLabel}>Conversação</Text><Text style={s.idiomaValor}>{id.conversacao}</Text></View>
              </View>
            </View>
          ))}
        </SeccaoCard>
      )}

      {/* ── DADOS PESSOAIS ── */}
      <SeccaoCard>
        <Text style={s.seccaoTitulo}>Dados Pessoais</Text>
        <InfoLinha icone="calendar"    label="Data de Nascimento"   valor={perfil.dataNasc} />
        <InfoLinha icone="users"       label="Género"               valor={perfil.genero} />
        <InfoLinha icone="flag"        label="Nacionalidade"        valor={perfil.nacionalidade} />
        <InfoLinha icone="heart"       label="Estado Civil"         valor={perfil.estadoCivil} />
        <InfoLinha icone="phone"       label="Telefone Principal"   valor={telefone ? `+244 ${telefone}` : null} />
        <InfoLinha icone="phone"       label="Telefone Alternativo" valor={perfil.telAlternativo ? `+244 ${perfil.telAlternativo}` : null} />
        <InfoLinha icone="mail"        label="E-mail"               valor={emailPerfil} />
        <InfoLinha icone="map-pin"     label="Província"            valor={perfil.provincia} />
        <InfoLinha icone="map-pin"     label="Município"            valor={perfil.municipio} />
        <InfoLinha icone="home"        label="Endereço"             valor={perfil.endereco} />
      </SeccaoCard>

      {/* ── PERFIL PROFISSIONAL ── */}
      <SeccaoCard>
        <Text style={s.seccaoTitulo}>Perfil Profissional</Text>
        <InfoLinha icone="award"       label="Título Profissional"   valor={titulo} />
        <InfoLinha icone="activity"    label="Situação Profissional" valor={perfil.situacaoProf} />
        <InfoLinha icone="clock"       label="Disponibilidade"       valor={perfil.disponibilidade} />
        <InfoLinha icone="dollar-sign" label="Pretensão Salarial"    valor={perfil.pretensaoSalarial ? `${perfil.pretensaoSalarial} Kz` : null} />
        {resumoPerfil ? (
          <View style={s.resumoBox}>
            <Text style={s.resumoLabel}>Resumo</Text>
            <Text style={s.resumoTxt}>{resumoPerfil}</Text>
          </View>
        ) : null}
      </SeccaoCard>

      {/* ── DADOS PROFISSIONAIS (conta de Recrutador) ──
          Mostrado com destaque (acento roxo) sempre que o perfil visitado
          pertence a uma conta de Recrutador com vínculo profissional
          preenchido — mesma fonte de dados (dadosProfissionais) usada em
          my-profile-recrutador.jsx. */}
      {ehRecrutador && temDadosProfRecrutador ? (
        <SeccaoCard estilo={s.cardRecrutador}>
          <View style={s.recrutadorTituloRow}>
            <Ionicons name="business" size={16} color={C.roxo} />
            <Text style={[s.seccaoTitulo, { color: C.roxo, marginBottom: 0 }]}>Dados Profissionais</Text>
            {vinculoAprovadoRecrutador && (
              <View style={s.recrutadorVerifBadge}>
                <Ionicons name="checkmark-circle" size={13} color={C.roxo} />
                <Text style={s.recrutadorVerifTxt}>Vínculo Verificado</Text>
              </View>
            )}
          </View>
          <InfoLinhaInstitucional icone="briefcase"   label="Empresa"            valor={dadosProf.empresa} />
          <InfoLinhaInstitucional icone="award"       label="Cargo"              valor={dadosProf.cargo} />
          <InfoLinhaInstitucional icone="layers"      label="Departamento"       valor={dadosProf.departamento} />
          <InfoLinhaInstitucional icone="tag"         label="Setor de Atuação"   valor={dadosProf.setor} />
          <InfoLinhaInstitucional icone="users"       label="Área de RH"         valor={dadosProf.areaRH} />
          <InfoLinhaInstitucional icone="trending-up" label="Experiência em RH"  valor={anosExpRecrutador} />
          <InfoLinhaInstitucional icone="calendar"    label="Na Empresa Desde"   valor={dadosProf.dataEntrada} />
        </SeccaoCard>
      ) : null}

      {/* ── DOCUMENTOS ── */}
      {(perfil.uriCV || perfil.cvUrl || perfil.uriBilhete || perfil.uriCertificados || perfil.uriCartaConducao || perfil.uriPortefolio || perfil.uriDiploma) ? (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Documentos</Text>
          {(perfil.uriCV || perfil.cvUrl) ? (
            <TouchableOpacity style={s.docCard} onPress={() => abrir(perfil.uriCV || perfil.cvUrl, 'Curriculum Vitae')}>
              <View style={s.docIcone}><Feather name="file-text" size={18} color={C.azul} /></View>
              <View style={{ flex: 1 }}><Text style={s.docNome}>Curriculum Vitae</Text><Text style={s.docSub}>Visualizar PDF</Text></View>
              <Feather name="external-link" size={15} color={C.verde} />
            </TouchableOpacity>
          ) : null}
          {perfil.uriBilhete ? (
            <TouchableOpacity style={s.docCard} onPress={() => abrir(perfil.uriBilhete, 'Bilhete de Identidade')}>
              <View style={s.docIcone}><Feather name="credit-card" size={18} color={C.azul} /></View>
              <View style={{ flex: 1 }}><Text style={s.docNome}>Bilhete de Identidade</Text><Text style={s.docSub}>Visualizar documento</Text></View>
              <Feather name="external-link" size={15} color={C.verde} />
            </TouchableOpacity>
          ) : null}
          {perfil.uriCertificados ? (
            <TouchableOpacity style={s.docCard} onPress={() => abrir(perfil.uriCertificados, 'Certificados')}>
              <View style={s.docIcone}><Feather name="award" size={18} color={C.azul} /></View>
              <View style={{ flex: 1 }}><Text style={s.docNome}>Certificados</Text><Text style={s.docSub}>Visualizar documento</Text></View>
              <Feather name="external-link" size={15} color={C.verde} />
            </TouchableOpacity>
          ) : null}
          {perfil.uriCartaConducao ? (
            <TouchableOpacity style={s.docCard} onPress={() => abrir(perfil.uriCartaConducao, 'Carta de Condução')}>
              <View style={s.docIcone}><Feather name="truck" size={18} color={C.azul} /></View>
              <View style={{ flex: 1 }}><Text style={s.docNome}>Carta de Condução</Text><Text style={s.docSub}>Visualizar documento</Text></View>
              <Feather name="external-link" size={15} color={C.verde} />
            </TouchableOpacity>
          ) : null}
          {perfil.uriPortefolio ? (
            <TouchableOpacity style={s.docCard} onPress={() => abrir(perfil.uriPortefolio, 'Portefólio')}>
              <View style={s.docIcone}><Feather name="folder" size={18} color={C.azul} /></View>
              <View style={{ flex: 1 }}><Text style={s.docNome}>Portefólio</Text><Text style={s.docSub}>Visualizar documento</Text></View>
              <Feather name="external-link" size={15} color={C.verde} />
            </TouchableOpacity>
          ) : null}
          {perfil.uriDiploma ? (
            <TouchableOpacity style={s.docCard} onPress={() => abrir(perfil.uriDiploma, 'Diploma')}>
              <View style={s.docIcone}><Feather name="book-open" size={18} color={C.azul} /></View>
              <View style={{ flex: 1 }}><Text style={s.docNome}>Diploma</Text><Text style={s.docSub}>Visualizar documento</Text></View>
              <Feather name="external-link" size={15} color={C.verde} />
            </TouchableOpacity>
          ) : null}
        </SeccaoCard>
      ) : null}

      {/* ── REDES PROFISSIONAIS ── */}
      {(perfil.linkedin || perfil.github || perfil.behance || perfil.website || perfil.facebook || perfil.instagram) ? (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Redes Profissionais</Text>
          {perfil.linkedin ? (
            <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.linkedin)}>
              <View style={[s.redeIcone, { backgroundColor: '#EEF4FF' }]}><Feather name="linkedin" size={15} color={C.azul} /></View>
              <Text style={s.redeTxt}>LinkedIn</Text>
              <Feather name="external-link" size={13} color={C.cinza3} />
            </TouchableOpacity>
          ) : null}
          {perfil.github ? (
            <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.github)}>
              <View style={[s.redeIcone, { backgroundColor: C.cinza1 }]}><Feather name="github" size={15} color={C.cinza4} /></View>
              <Text style={s.redeTxt}>GitHub</Text>
              <Feather name="external-link" size={13} color={C.cinza3} />
            </TouchableOpacity>
          ) : null}
          {perfil.behance ? (
            <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.behance)}>
              <View style={[s.redeIcone, { backgroundColor: '#EEF4FF' }]}><Feather name="grid" size={15} color={C.azul} /></View>
              <Text style={s.redeTxt}>Behance</Text>
              <Feather name="external-link" size={13} color={C.cinza3} />
            </TouchableOpacity>
          ) : null}
          {perfil.website ? (
            <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.website)}>
              <View style={[s.redeIcone, { backgroundColor: C.cinza1 }]}><Feather name="globe" size={15} color={C.cinza4} /></View>
              <Text style={s.redeTxt}>Website</Text>
              <Feather name="external-link" size={13} color={C.cinza3} />
            </TouchableOpacity>
          ) : null}
          {perfil.facebook ? (
            <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.facebook)}>
              <View style={[s.redeIcone, { backgroundColor: '#EEF4FF' }]}><Feather name="facebook" size={15} color={C.azul} /></View>
              <Text style={s.redeTxt}>Facebook</Text>
              <Feather name="external-link" size={13} color={C.cinza3} />
            </TouchableOpacity>
          ) : null}
          {perfil.instagram ? (
            <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.instagram)}>
              <View style={[s.redeIcone, { backgroundColor: '#FFF0F5' }]}><Feather name="instagram" size={15} color="#E1306C" /></View>
              <Text style={s.redeTxt}>Instagram</Text>
              <Feather name="external-link" size={13} color={C.cinza3} />
            </TouchableOpacity>
          ) : null}
        </SeccaoCard>
      ) : null}

      {/* ── INTERESSES ── */}
      {interesses.length > 0 && (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Interesses</Text>
          {interesses.map((int, i) => (
            <View key={i} style={[s.interesseItem, i < interesses.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: C.cinza2 }]}>
              <View style={s.interesseLogoBg}><Feather name="star" size={18} color={C.cinza3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.interesseNome}>{int.nome || int}</Text>
                {int.seguidores ? <Text style={s.interesseSeg}>{int.seguidores} seguidores</Text> : null}
              </View>
            </View>
          ))}
        </SeccaoCard>
      )}

      {/* ── CONTACTO ── */}
      {(telefone || emailPerfil || gmail) ? (
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Informações de contacto</Text>
          {telefone ? (
            <View style={s.contactoItem}>
              <Feather name="phone" size={14} color={C.azul} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.contactoValor}>+244 {telefone}</Text>
                <Text style={s.contactoLabel}>Telefone</Text>
              </View>
            </View>
          ) : null}
          {gmail ? (
            <View style={s.contactoItem}>
              <Feather name="mail" size={14} color={C.azul} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.contactoValor}>{gmail}</Text>
                <Text style={s.contactoLabel}>Gmail</Text>
              </View>
            </View>
          ) : null}
          {emailPerfil ? (
            <View style={s.contactoItem}>
              <Feather name="mail" size={14} color={C.azul} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.contactoValor}>{emailPerfil}</Text>
                <Text style={s.contactoLabel}>Email</Text>
              </View>
            </View>
          ) : null}
        </SeccaoCard>
      ) : null}

      {/* ── ATIVIDADES / PUBLICAÇÕES ──
          Cabeçalho da lista de publicações: quem entra vê primeiro TODOS
          os dados preenchidos no perfil e só depois as publicações. */}
      <View style={s.postsHeader}>
        <View>
          <Text style={s.postsTitle}>Publicações</Text>
          <Text style={s.postsSubtitle}>
            {posts.length} publicação{posts.length === 1 ? '' : 'ões'}{numConexoes > 0 ? ` · ${numConexoes} seguidores` : ''}
          </Text>
        </View>
      </View>
    </>
  );

  // NOVO: rodapé — tudo o que vem depois das publicações (banner
  // ConnectAll, sugestões de pessoas e o rodapé de links) passa a ser o
  // ListFooterComponent do FlatList.
  const rodapeCompleto = (
    <>
      {/* ── BANNER CONNECTALL ── */}
      <View style={s.pubBloco}>
        {banners.length > 0 ? (
          <View>
            <Image
              source={{ uri: banners[bannerIdx] }}
              style={{ width: '100%', height: 180 }}
              resizeMode="cover"
            />
            {banners.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, position: 'absolute', bottom: 8, width: '100%' }}>
                {banners.map((_, i) => (
                  <View key={i} style={{ width: i === bannerIdx ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === bannerIdx ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={s.pubBlocoInner}>
            <View style={s.pubLogoRow}>
              <Text style={s.pubLogoConnect}>Connect</Text>
              <Text style={s.pubLogoAll}>All</Text>
            </View>
            <Text style={s.pubTitulo}>A tua carreira,{'\n'}<Text style={s.pubTituloAzul}>impulsionada pela tua rede</Text></Text>
            <TouchableOpacity style={s.pubBtn}>
              <Text style={s.pubBtnTxt}>Explorar oportunidades</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <PessoasParaConhecer empresaAtual={perfil.empresa} uidActual={uid} />
      <MaisPerfis areaAtual={perfil.area} uidActual={uid} />

      <View style={s.rodape}>
        {['Sobre', 'Acessibilidade', 'Ajuda', 'Privacidade', 'Termos'].map(item => (
          <TouchableOpacity key={item}><Text style={s.rodapeLink}>{item}</Text></TouchableOpacity>
        ))}
        <Text style={s.rodapeCopyright}>ConnectAll Angola © {new Date().getFullYear()}</Text>
      </View>

      <View style={{ height: 32 }} />
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={C.cinza4} />
        </TouchableOpacity>
        <Text style={s.headerNome} numberOfLines={1}>{nome}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* NOVO: FlatList em vez de ScrollView — permite viewabilityConfig
          / onViewableItemsChanged para saber qual publicação está 100%
          visível e controlar a reprodução dos vídeos a partir disso
          (mesmo mecanismo da Página da Empresa / Perfil Público da
          Empresa). */}
      <FlatList
        style={{ backgroundColor: C.cinza1 }}
        showsVerticalScrollIndicator={false}
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostPerfil
            post={item}
            perfil={perfil}
            estaVerificado={estaVerificado}
            meuUid={user?.uid}
            // Só reproduz se estiver 100% visível na lista E este ecrã
            // continuar em foco.
            isActive={postAtivoId === item.id && ecraFocado}
            onAbrirImagem={abrirFullscreen}
            onLike={alternarLike}
            onComentar={abrirComentarios}
            onPartilhar={partilharPost}
          />
        )}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="copy-outline" size={44} color="#98A2B3" />
            <Text style={s.emptyTitle}>Ainda não há publicações</Text>
            <Text style={s.emptyText}>As publicações feitas por {nome} aparecerão aqui.</Text>
          </View>
        }
        ListFooterComponent={rodapeCompleto}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
      />

      {Visualizador}
      <Modal visible={modalImagem} transparent animationType="fade" onRequestClose={() => setModalImagem(false)}>
        <View style={s.modalFundo}>
          <TouchableOpacity style={s.modalFechar} onPress={() => setModalImagem(false)}>
            <Feather name="x" size={28} color={C.branco} />
          </TouchableOpacity>
          {imagemExpandida ? <Image source={{ uri: imagemExpandida }} style={s.modalImagem} resizeMode="contain" /> : null}
        </View>
      </Modal>

      <FullscreenPostPerfil
        visivel={!!fsPost}
        post={fsPost}
        perfil={perfil}
        indiceInicial={fsIndice}
        meuUid={user?.uid}
        jaGostei={!!(fsPost && Array.isArray(fsPost.likedBy) && user?.uid && fsPost.likedBy.includes(user.uid))}
        onFechar={() => setFsPost(null)}
        onLike={() => fsPost && alternarLike(fsPost)}
        onComentar={() => fsPost && abrirComentarios(fsPost)}
        onPartilhar={() => fsPost && partilharPost(fsPost)}
      />

      <PostComentariosModal
        visivel={!!modalComentarios}
        postId={modalComentarios?.postId}
        post={modalComentarios?.post}
        onFechar={() => setModalComentarios(null)}
      />
    </SafeAreaView>
  );
}

const fs = StyleSheet.create({
  voltar: { position: 'absolute', top: 48, left: 16, zIndex: 30, padding: 8 },
  acoes: { position: 'absolute', right: 14, bottom: 150, alignItems: 'center', gap: 24, zIndex: 30 },
  contagem: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', marginTop: 4 },
  rodape: { position: 'absolute', left: 0, right: 80, bottom: 26, paddingHorizontal: 16, zIndex: 25 },
  autorNome: { color: '#fff', fontSize: 15, fontWeight: '800' },
  autorCargo: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
  textoPost: { color: '#fff', fontSize: 14, lineHeight: 20 },
  contadorPaginas: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, zIndex: 20 },
});

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.cinza1 },
  centro:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  erroText:   { fontSize: 15, color: '#888' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.branco, borderBottomWidth: 1, borderBottomColor: C.cinza2 },
  backBtn:    { padding: 4 },
  headerNome: { fontSize: 15, fontWeight: '600', color: C.cinza4, flex: 1, textAlign: 'center' },
  cardPrincipal: { backgroundColor: C.branco, marginBottom: 8 },
  capa:          { width: '100%', height: 160 },
  capaVazia:     { width: '100%', height: 160, backgroundColor: '#1A365D' },
  avatarRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -48, marginBottom: 8 },
  avatarCirculo: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: C.branco, overflow: 'hidden', backgroundColor: C.cinza2, zIndex: 5 },
  avatarImagem:  { width: '100%', height: '100%' },
  avatarFallback:{ flex: 1, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' },
  avatarLetra:   { color: C.branco, fontSize: 28, fontWeight: '700' },
  empresaBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.branco, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.cinza2, maxWidth: width * 0.45, marginTop: 52, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  empresaLogo:   { width: 36, height: 36, borderRadius: 4, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center' },
  empresaBadgeTxt: { fontSize: 12, color: C.cinza4, fontWeight: '500', flex: 1 },
  infoPrincipalWrap: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  nome:              { fontSize: 22, fontWeight: '800', color: C.preto, letterSpacing: -0.3 },
  tituloProfissional:{ fontSize: 14, color: C.cinza4, lineHeight: 20, marginBottom: 6 },
  localizacaoRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  localizacaoTxt:    { fontSize: 13, color: C.cinza3 },
  separadorDot:      { fontSize: 13, color: C.cinza3 },
  linkAzul:          { fontSize: 13, color: C.azul, fontWeight: '600' },
  metaRow:           { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  conexoesTxt:       { fontSize: 13, color: C.cinza3 },
  badgeVerde:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EAF6EF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeVerdeTxt:     { fontSize: 11, fontWeight: '600', color: C.verde },
  situacaoCard:      { backgroundColor: C.cinza1, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.cinza2, borderStyle: 'dashed', marginBottom: 12 },
  situacaoTitulo:    { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 2 },
  situacaoSub:       { fontSize: 13, color: C.cinza4 },
  botoesAcaoRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btnConectar:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.azul, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9 },
  btnConectado:      { backgroundColor: C.branco, borderWidth: 1.5, borderColor: C.azul },
  btnConectarTxt:    { fontSize: 14, fontWeight: '700', color: C.branco },
  btnConectadoTxt:   { color: C.azul },
  btnMsg:            { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: C.azul, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: C.branco },
  btnMsgTxt:         { fontSize: 14, fontWeight: '600', color: C.azul },
  btnMais:           { borderWidth: 1.5, borderColor: C.cinza4, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: C.branco },
  btnMaisTxt:        { fontSize: 14, fontWeight: '600', color: C.cinza4 },
  seccaoCard:        { backgroundColor: C.branco, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 16 },
  seccaoHeaderRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  seccaoTitulo:      { fontSize: 18, fontWeight: '700', color: C.preto, marginBottom: 8 },

  // ── Destaque de conta Recrutador ──
  recrutadorTag:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.roxoClaro, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  recrutadorTagTxt:     { fontSize: 11, fontWeight: '700', color: C.roxo },
  cardRecrutador:       { borderLeftWidth: 3, borderLeftColor: C.roxo },
  recrutadorTituloRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  recrutadorVerifBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.roxoClaro, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 'auto' },
  recrutadorVerifTxt:   { fontSize: 11, fontWeight: '700', color: C.roxo },
  seguidoresTxt:     { fontSize: 13, color: C.azul, fontWeight: '600', marginTop: 2 },
  bioTexto:          { fontSize: 14, color: C.cinza4, lineHeight: 22 },
  verMais:           { fontSize: 13, color: '#666', marginTop: 4 },

  // ── Cabeçalho da secção de publicações (estilo página da empresa) ──
  postsHeader:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 7 },
  postsTitle:        { fontSize: 18, fontWeight: '700', color: C.preto },
  postsSubtitle:     { fontSize: 12, color: C.cinza3, marginTop: 3 },

  // ── Cartão de publicação (estilo página da empresa) ──
  postCard:          { backgroundColor: C.branco, marginHorizontal: 12, marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: C.cinza2, overflow: 'hidden' },
  postHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  postAvatar:        { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', backgroundColor: C.cinza2 },
  postAvatarImg:     { width: '100%', height: '100%' },
  postAvatarFallback:{ flex: 1, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' },
  postAvatarIniciais:{ color: C.branco, fontSize: 16, fontWeight: '700' },
  postNameRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postAuthor:        { maxWidth: '88%', fontSize: 14, fontWeight: '800', color: C.preto },
  postRole:          { marginTop: 3, fontSize: 11, color: C.cinza3 },
  postText:          { paddingHorizontal: 14, paddingBottom: 12, fontSize: 14, lineHeight: 21, color: C.cinza4 },
  mediaGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 2, backgroundColor: '#F1F5F9' },
  postImageWrap:     { backgroundColor: '#E2E8F0' },
  postImageOne:      { width: '100%', height: 300 },
  postImageMany:     { width: '49.7%', height: 190 },
  // Mesma altura/formato de vídeo usado na Página da Empresa.
  postVideo: {
    width: '100%',
    height: Math.min(width * 0.78, 430),
    backgroundColor: '#000',
  },
  postStats:         { flexDirection: 'row', gap: 18, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  statText:          { fontSize: 11, color: C.cinza3 },
  postActions:       { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F2F4F7', paddingVertical: 4, paddingHorizontal: 6 },
  postAction:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  postActionText:    { fontSize: 12, fontWeight: '600', color: C.cinza3 },

  // ── Estado vazio das publicações (estilo página da empresa) ──
  empty:             { marginHorizontal: 12, marginTop: 8, padding: 35, backgroundColor: C.branco, borderRadius: 14, borderWidth: 1, borderColor: C.cinza2, alignItems: 'center' },
  emptyTitle:        { marginTop: 10, fontSize: 15, fontWeight: '800', color: C.preto },
  emptyText:         { marginTop: 6, textAlign: 'center', fontSize: 12, lineHeight: 18, color: C.cinza3 },

  expItem:           { flexDirection: 'row', gap: 12, marginBottom: 16, paddingBottom: 16 },
  expItemBorda:      { borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  expLogoBg:         { width: 48, height: 48, borderRadius: 4, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },
  expLogo:           { width: 48, height: 48, borderRadius: 4 },
  expCargo:          { fontSize: 15, fontWeight: '700', color: C.preto, marginBottom: 2 },
  expEmpresa:        { fontSize: 13, color: C.cinza4, marginBottom: 2 },
  expData:           { fontSize: 12, color: C.cinza3 },
  expDesc:           { fontSize: 13, color: C.cinza4, lineHeight: 19, marginTop: 6 },
  resultadosBox:     { backgroundColor: C.cinza1, borderRadius: 8, padding: 10, marginTop: 8 },
  resultadosTitulo:  { fontSize: 11, fontWeight: '700', color: C.cinza3, textTransform: 'uppercase', marginBottom: 4 },
  resultadosTxt:     { fontSize: 13, color: C.cinza4, lineHeight: 18 },
  subSecTitulo:      { fontSize: 12, fontWeight: '700', color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  chipGrupo:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:              { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.cinza2, backgroundColor: C.cinza1 },
  chipDestaque:      { borderColor: C.azul, backgroundColor: C.azulClaro },
  chipTxt:           { fontSize: 12, color: C.cinza3, fontWeight: '500' },
  chipTxtDestaque:   { color: C.azul, fontWeight: '700' },
  idiomaItem:        { borderWidth: 1, borderColor: C.cinza2, borderRadius: 8, padding: 14, marginBottom: 12 },
  idiomaNome:        { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 10 },
  idiomaGrid:        { flexDirection: 'row', alignItems: 'center' },
  idiomaCol:         { flex: 1, alignItems: 'center' },
  idiomaDivisor:     { width: 1, height: 30, backgroundColor: C.cinza2 },
  idiomaLabel:       { fontSize: 10, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  idiomaValor:       { fontSize: 12, fontWeight: '700', color: C.azul },
  infoLinha:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoIconBox:       { width: 32, height: 32, borderRadius: 8, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  infoMeta:          { flex: 1 },
  infoLabel:         { fontSize: 11, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  infoValor:         { fontSize: 14, fontWeight: '600', color: C.cinza4 },
  resumoBox:         { backgroundColor: C.cinza1, borderRadius: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: C.azul, marginTop: 8 },
  resumoLabel:       { fontSize: 11, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, fontWeight: '700' },
  resumoTxt:         { fontSize: 13, color: C.cinza4, lineHeight: 20, fontStyle: 'italic' },
  docCard:           { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: C.cinza2, borderRadius: 8, marginBottom: 10, backgroundColor: C.cinza1 },
  docIcone:          { width: 36, height: 36, borderRadius: 8, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center' },
  docNome:           { fontSize: 13, fontWeight: '700', color: C.preto },
  docSub:            { fontSize: 11, color: C.cinza3, marginTop: 1 },
  redeLinha:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  redeIcone:         { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  redeTxt:           { flex: 1, fontSize: 14, fontWeight: '600', color: C.cinza4 },
  linkBtn:           { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  linkBtnTxt:        { fontSize: 12, color: C.azul, fontWeight: '600' },
  interesseItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  interesseLogoBg:   { width: 48, height: 48, borderRadius: 4, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },
  interesseNome:     { fontSize: 14, fontWeight: '700', color: C.preto },
  interesseSeg:      { fontSize: 12, color: C.cinza3, marginTop: 2 },
  contactoItem:      { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  contactoValor:     { fontSize: 14, fontWeight: '600', color: C.cinza4 },
  contactoLabel:     { fontSize: 12, color: C.cinza3, marginTop: 1 },
  pessoaItem:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pessoaItemBorda:   { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  pessoaAvatar:      { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  pessoaAvatarImg:   { width: 48, height: 48 },
  pessoaAvatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.cinza2, alignItems: 'center', justifyContent: 'center' },
  pessoaAvatarIniciais: { fontSize: 16, fontWeight: '700', color: '#555' },
  pessoaNome:        { fontSize: 14, fontWeight: '600', color: C.cinza4 },
  pessoaCargo:       { fontSize: 12, color: C.cinza3, marginTop: 1 },
  pessoaBtnConectar: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: C.azul, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  pessoaBtnTxt:      { fontSize: 12, fontWeight: '600', color: C.azul },
  pubBloco:          { marginBottom: 8 },
  pubBlocoInner:     { backgroundColor: '#0D2137', padding: 24, alignItems: 'center' },
  pubLogoRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pubLogoConnect:    { fontSize: 22, fontWeight: '900', color: C.branco },
  pubLogoAll:        { fontSize: 22, fontWeight: '900', color: '#5EB6FF' },
  pubTitulo:         { fontSize: 18, fontWeight: '700', color: C.branco, textAlign: 'center', marginBottom: 16, lineHeight: 26 },
  pubTituloAzul:     { color: '#5EB6FF' },
  pubBtn:            { backgroundColor: C.branco, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  pubBtnTxt:         { fontSize: 14, fontWeight: '700', color: '#0D2137' },
  divisorLinha:      { height: 0.5, backgroundColor: C.cinza2, marginVertical: 4 },
  rodape:            { backgroundColor: C.cinza1, paddingHorizontal: 16, paddingVertical: 20, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rodapeLink:        { fontSize: 12, color: C.cinza3 },
  rodapeCopyright:   { width: '100%', fontSize: 11, color: C.cinza3, marginTop: 8 },
  modalFundo:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalFechar:       { position: 'absolute', top: 40, right: 24, zIndex: 20, padding: 10 },
  modalImagem:       { width: '92%', height: '75%' },
});