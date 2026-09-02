/**
 * src/app/(main)/pagina-empresa.jsx
 *
 * FEED COMPLETO DA PÁGINA DA EMPRESA — ConnectAll Angola
 *
 * ── CORREÇÃO ──
 * Esta versão do ecrã tinha deixado de ter QUALQUER formulário de criação:
 * se `perfilEmpresa` não existisse, mostrava apenas uma mensagem "Ainda não
 * existe uma Página da Empresa" com um botão "Voltar" — sem nenhuma forma
 * de avançar. Foi reposto o formulário de criação (Nome, Setor, NIF,
 * Telefone, E-mail, Sobre), usando o mesmo `guardarPerfilEmpresa` que já é
 * usado neste ficheiro para editar o perfil, o logotipo e a capa. Depois
 * de criada, o próprio UserContext (via listener em tempo real) actualiza
 * `perfilEmpresa`, e este ecrã passa automaticamente a mostrar o feed da
 * empresa — sem precisar de navegar para outro lado.
 *
 * Compatível com o UserContext fornecido:
 * - usa users/{uid}/perfis/empresa como identidade da Página;
 * - publica em posts com autorTipo: "empresa" (campo extra) e
 *   tipo: "artigo" (categoria reconhecida pelo Feed Geral);
 * - mediaUrls segue EXACTAMENTE o mesmo formato do Feed Geral:
 *   lista de objectos { url, type: 'image' | 'video' };
 * - upload de ficheiros usa a MESMA função (uploadFicheiroStorage,
 *   via expo-file-system) do ecrã "Nova publicação" do Feed Geral;
 * - as publicações aparecem no Feed Geral que lê a coleção posts;
 * - nunca usa o nome/foto pessoal do recrutador como autor público;
 * - permite texto + imagens OU vídeo, edição, eliminação, fixar, likes,
 *   comentários, estatísticas e gestão da página;
 * - logo/capa são actualizados através do UserContext.
 *
 * NOVO (controlo de reprodução de vídeo):
 * - a lista de publicações passou de ScrollView+map para FlatList, para
 *   podermos usar viewabilityConfig/onViewableItemsChanged e saber, a
 *   cada momento, qual publicação está 100% visível no ecrã;
 * - cada vídeo só reproduz quando a sua publicação está 100% visível;
 *   assim que deixa de estar totalmente visível (scroll), pausa;
 * - useFocusEffect (expo-router / @react-navigation/native) deteta
 *   quando o utilizador sai deste ecrã (navega para outro) e força a
 *   pausa de todos os vídeos, para não continuarem a tocar em segundo
 *   plano nem aparecerem a tocar noutro ecrã.
 *
 * Dependências já habituais no projecto Expo:
 * @expo/vector-icons
 * expo-image-picker
 * expo-file-system  (para o upload, igual ao Feed Geral)
 * expo-video        (para reprodução de vídeo)
 * firebase
 *
 * Se ainda não tiveres o expo-video instalado, corre:
 *   npx expo install expo-video
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import {
    getDownloadURL,
    getStorage,
    ref,
} from 'firebase/storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  blue: '#0A66C2',
  blueDark: '#084C91',
  blueLight: '#EAF3FF',
  white: '#FFFFFF',
  black: '#111111',
  text: '#242424',
  muted: '#666666',
  border: '#E5E5E5',
  background: '#F3F2EF',
  green: '#057642',
  red: '#CC1016',
  gold: '#C58B18',
  purple: '#B240A0',
};

const MAX_IMAGES = 10;
const MAX_VIDEO_DURATION_SECONDS = 120;

function formatDate(value) {
  if (!value) return 'Agora';
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Agora';

    const diff = Date.now() - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return 'Agora';
    if (diff < hour) return `${Math.floor(diff / minute)} min`;
    if (diff < day) return `${Math.floor(diff / hour)} h`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} d`;

    return date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Agora';
  }
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map(p => p[0]).join('') || 'E').toUpperCase();
}

function Avatar({ uri, name, size = 48 }) {
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size * 0.34 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

// MESMA função usada no ecrã de "Nova publicação" (Feed Geral).
// Usa FileSystem.uploadAsync com token do utilizador em vez de blob,
// que é o método comprovadamente estável neste projecto (Android/iOS).
async function uploadFicheiroStorage(uri, caminho) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Utilizador não autenticado');

  const bucket = 'connectallangola.firebasestorage.app';
  const caminhoEncoded = encodeURIComponent(caminho);
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${caminhoEncoded}`;

  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const mimeTypes = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    mkv: 'video/x-matroska', webm: 'video/webm',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  const resultado = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Authorization': `Firebase ${token}`, 'Content-Type': mimeType },
  });

  if (resultado.status < 200 || resultado.status >= 300) {
    throw new Error(`Upload falhou com status ${resultado.status}`);
  }

  const storage = getStorage();
  const storageRef = ref(storage, caminho);
  return await getDownloadURL(storageRef);
}

export default function PaginaEmpresa() {
  const router = useRouter();
  const { user, perfilEmpresa, contextoAtivo, trocarContexto, guardarPerfilEmpresa } = useUser();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [texto, setTexto] = useState('');
  const [mediaUris, setMediaUris] = useState([]);
  const [videoUri, setVideoUri] = useState(null); // NOVO
  const [publicando, setPublicando] = useState(false);

  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [menuPost, setMenuPost] = useState(null);
  const [statsPost, setStatsPost] = useState(null);

  const [commentsPost, setCommentsPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Editor completo do perfil da empresa
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nomeEmpresa: '',
    setor: '',
    nif: '',
    telefone: '',
    email: '',
    sobre: '',
    endereco: '',
    cidade: '',
    website: '',
    linkedin: '',
    instagram: '',
    facebook: '',
    horario: '',
  });

  // ── CRIAÇÃO DA PÁGINA (quando perfilEmpresa ainda não existe) ──
  const [criarForm, setCriarForm] = useState({
    nomeEmpresa: '',
    setor: '',
    nif: '',
    telefone: '',
    email: '',
    sobre: '',
  });
  const [criandoPagina, setCriandoPagina] = useState(false);

  const atualizarCampoCriar = (campo, valor) => {
    setCriarForm(prev => ({ ...prev, [campo]: valor }));
  };

  const criarPaginaEmpresa = async () => {
    if (!user?.uid) return;

    if (!criarForm.nomeEmpresa.trim()) {
      Alert.alert('Campo obrigatório', 'Introduz o nome da empresa.');
      return;
    }
    if (!criarForm.setor.trim()) {
      Alert.alert('Campo obrigatório', 'Introduz o setor de actividade.');
      return;
    }
    if (!criarForm.nif.trim()) {
      Alert.alert('Campo obrigatório', 'Introduz o NIF da empresa.');
      return;
    }
    if (!criarForm.telefone.trim()) {
      Alert.alert('Campo obrigatório', 'Introduz o telefone da empresa.');
      return;
    }
    if (!criarForm.email.trim() || !criarForm.email.includes('@')) {
      Alert.alert('E-mail inválido', 'Introduz um e-mail válido da empresa.');
      return;
    }

    setCriandoPagina(true);
    try {
      await guardarPerfilEmpresa({
        nomeEmpresa: criarForm.nomeEmpresa.trim(),
        setor: criarForm.setor.trim(),
        nif: criarForm.nif.trim(),
        telefone: criarForm.telefone.trim(),
        email: criarForm.email.trim(),
        sobre: criarForm.sobre.trim(),
        criadaPor: user.uid,
      });

      // Assim que a página existe, muda já a identidade activa para
      // "empresa" — tal como acontece nas Páginas do Facebook, entra-se
      // directamente a gerir a página que se acabou de criar.
      try {
        await trocarContexto('empresa');
      } catch (_) {
        // Não crítico: se ainda não propagou a tempo, o utilizador troca
        // manualmente pelo menu — a página já foi criada com sucesso.
      }
    } catch (error) {
      console.error('[PaginaEmpresa] criar página:', error);
      Alert.alert('Erro', error?.message || 'Não foi possível criar a página da empresa.');
    } finally {
      setCriandoPagina(false);
    }
  };

  const companyName = perfilEmpresa?.nomeEmpresa || 'Página da Empresa';
  const companyLogo = perfilEmpresa?.logoURL || null;
  const companyCover = perfilEmpresa?.capaURL || null;
  const companySector = perfilEmpresa?.setor || 'Empresa';

  const isCompanyMode = contextoAtivo === 'empresa';

  // NOVO: id da publicação cujo vídeo está atualmente 100% visível no ecrã.
  // Só esta publicação pode reproduzir o seu vídeo — todas as outras pausam.
  const [visiblePostId, setVisiblePostId] = useState(null);

  // NOVO: indica se ESTE ecrã (Página da Empresa) está em foco. O Expo
  // Router mantém ecrãs anteriores montados na pilha de navegação, por
  // isso sem isto os vídeos continuavam a tocar "por trás" ao navegar
  // para outro ecrã. Quando perde o foco, forçamos a pausa de tudo.
  const [screenFocused, setScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        setScreenFocused(false);
        setVisiblePostId(null);
      };
    }, []),
  );

  // NOVO: configuração de "viewability" da FlatList — uma publicação só
  // conta como visível quando 100% da sua área está dentro do ecrã.
  // Os objectos passados aqui têm de ser estáveis (useRef), senão a
  // FlatList avisa/ignora a config.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 100,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const fullyVisible = viewableItems.find(v => v.isViewable);
    setVisiblePostId(fullyVisible ? fullyVisible.item.id : null);
  }).current;

  // NOVO: player do vídeo selecionado no composer (antes de publicar).
  const composerVideoPlayer = useVideoPlayer(videoUri || null, player => {
    player.loop = false;
  });

  // NOVO: pausa também o vídeo do composer quando se sai do ecrã.
  useEffect(() => {
    if (!screenFocused) {
      composerVideoPlayer.pause();
    }
  }, [screenFocused, composerVideoPlayer]);

  // NOVO: player do vídeo da publicação a ser editada (só leitura do já publicado).
  const editVideoPlayer = useVideoPlayer(
    editingPost?.mediaUrls?.find(m => m?.type === 'video')?.url || null,
    player => {
      player.loop = false;
    },
  );

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const ta = a.timestamp?.toMillis?.() || 0;
        const tb = b.timestamp?.toMillis?.() || 0;
        return tb - ta;
      }),
    [posts],
  );

  const carregarPosts = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const snap = await getDocs(
        query(collection(db, 'posts')),
      );

      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(
          p =>
            p.uid === user.uid &&
            p.autorTipo === 'empresa',
        );

      setPosts(data);
    } catch (error) {
      console.error('[PaginaEmpresa] erro ao carregar posts:', error);
      Alert.alert('Erro', 'Não foi possível carregar as publicações da empresa.');
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    // Não usa orderBy/where composto para evitar exigir índice composto.
    const unsub = onSnapshot(
      collection(db, 'posts'),
      snap => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(
            p =>
              p.uid === user.uid &&
              p.autorTipo === 'empresa',
          );

        setPosts(data);
        setLoading(false);
      },
      error => {
        console.error('[PaginaEmpresa] listener:', error);
        setLoading(false);
      },
    );

    return unsub;
  }, [user?.uid]);

  const refresh = async () => {
    setRefreshing(true);
    await carregarPosts();
    setRefreshing(false);
  };

  const escolherImagens = async () => {
    try {
      if (videoUri) {
        Alert.alert(
          'Não é possível combinar',
          'Uma publicação pode ter imagens OU um vídeo, não ambos. Remove o vídeo primeiro.',
        );
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Autoriza o acesso à galeria para adicionar imagens.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES,
        quality: 0.85,
      });

      if (result.canceled) return;

      const selected = result.assets?.map(asset => asset.uri).filter(Boolean) || [];

      if (selected.length) {
        setMediaUris(prev => [...prev, ...selected].slice(0, MAX_IMAGES));
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível abrir a galeria.');
    }
  };

  const removerImagem = uri => {
    setMediaUris(prev => prev.filter(item => item !== uri));
  };

  // NOVO: selecionar vídeo da galeria.
  const escolherVideo = async () => {
    try {
      if (mediaUris.length > 0) {
        Alert.alert(
          'Não é possível combinar',
          'Uma publicação pode ter imagens OU um vídeo, não ambos. Remove as imagens primeiro.',
        );
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Autoriza o acesso à galeria para adicionar um vídeo.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.8,
        videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      if (asset.duration && asset.duration / 1000 > MAX_VIDEO_DURATION_SECONDS) {
        Alert.alert(
          'Vídeo demasiado longo',
          `Escolhe um vídeo com no máximo ${MAX_VIDEO_DURATION_SECONDS} segundos.`,
        );
        return;
      }

      setVideoUri(asset.uri);
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível abrir a galeria.');
    }
  };

  // NOVO: remover vídeo selecionado antes de publicar.
  const removerVideo = () => setVideoUri(null);

  const publicar = async () => {
    if (!user?.uid || !perfilEmpresa) return;

    const textoLimpo = texto.trim();

    if (!textoLimpo && mediaUris.length === 0 && !videoUri) {
      Alert.alert('Publicação vazia', 'Escreve alguma coisa ou adiciona uma imagem/vídeo.');
      return;
    }

    if (!isCompanyMode) {
      Alert.alert(
        'Modo empresa',
        'Troca para a conta da empresa antes de publicar.',
      );
      return;
    }

    setPublicando(true);

    try {
      // NOVO: mesmo formato do Feed Geral — mediaUrls é uma lista de
      // objectos { url, type }, não apenas strings. É este objecto que
      // o Feed Geral espera para conseguir distinguir imagem de vídeo.
      const mediaUrls = [];

      for (let i = 0; i < mediaUris.length; i++) {
        const uri = mediaUris[i];
        const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
        const caminho = `posts/${user.uid}/${Date.now()}_${i}.${ext}`;
        const url = await uploadFicheiroStorage(uri, caminho);
        mediaUrls.push({ url: String(url), type: 'image' });
      }

      if (videoUri) {
        const ext = videoUri.split('.').pop()?.split('?')[0] || 'mp4';
        const caminho = `posts/${user.uid}/${Date.now()}_video.${ext}`;
        const url = await uploadFicheiroStorage(videoUri, caminho);
        mediaUrls.push({ url: String(url), type: 'video' });
      }

      await addDoc(collection(db, 'posts'), {
        uid: user.uid,

        // IDENTIDADE PÚBLICA: sempre a Página da Empresa.
        autorNome: companyName,
        autorFoto: companyLogo,
        autorCargo: companySector,
        autorCidade: perfilEmpresa?.cidade || '',
        autorVerificado: true,

        texto: textoLimpo,
        mediaUrls,

        // MESMA configuração do Feed Geral: 'tipo' tem de ser uma das
        // categorias reconhecidas (conquista/ideia/oportunidade/artigo)
        // para a publicação aparecer e ser filtrada correctamente lá.
        tipo: 'artigo',

        // Campos extra só usados pela Página da Empresa (não interferem
        // com a leitura do Feed Geral, que ignora campos que não conhece).
        autorTipo: 'empresa',
        autorCapa: companyCover,
        empresaId: user.uid,
        pinned: false,
        likedBy: [],
        reacoesMap: {},
        partilhas: 0,
        dataCriacao: serverTimestamp(),
        dataAtualizacao: serverTimestamp(),

        likes: 0,
        comentarios: 0,
        timestamp: serverTimestamp(),
      });

      setTexto('');
      setMediaUris([]);
      setVideoUri(null);

      Alert.alert('Publicado', 'A publicação foi publicada como a Página da Empresa.');
    } catch (error) {
      console.error('[PaginaEmpresa] publicar:', error);
      Alert.alert(
        'Erro ao publicar',
        error?.message || 'Não foi possível publicar agora.',
      );
    } finally {
      setPublicando(false);
    }
  };

  const editarPost = post => {
    setMenuPost(null);
    setEditingPost(post);
    setEditText(post.texto || '');
  };

  const guardarEdicao = async () => {
    if (!editingPost?.id) return;

    const novoTexto = editText.trim();

    if (!novoTexto && !(editingPost.mediaUrls?.length > 0)) {
      Alert.alert('Publicação vazia', 'A publicação precisa de conteúdo.');
      return;
    }

    setSavingEdit(true);

    try {
      await updateDoc(doc(db, 'posts', editingPost.id), {
        texto: novoTexto,
        dataAtualizacao: serverTimestamp(),
      });

      setEditingPost(null);
      setEditText('');
    } catch (error) {
      Alert.alert('Erro', error?.message || 'Não foi possível editar a publicação.');
    } finally {
      setSavingEdit(false);
    }
  };

  const eliminarPost = post => {
    setMenuPost(null);

    Alert.alert(
      'Eliminar publicação',
      'Esta publicação será removida do Feed da Empresa e do Feed Geral.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'posts', post.id));
            } catch (error) {
              Alert.alert(
                'Erro',
                error?.message || 'Não foi possível eliminar.',
              );
            }
          },
        },
      ],
    );
  };

  const alternarFixado = async post => {
    setMenuPost(null);

    try {
      await updateDoc(doc(db, 'posts', post.id), {
        pinned: !post.pinned,
        dataAtualizacao: serverTimestamp(),
      });
    } catch (error) {
      Alert.alert('Erro', error?.message || 'Não foi possível atualizar.');
    }
  };

  const alternarLike = async post => {
    if (!user?.uid || !post?.id) return;

    try {
      const postRef = doc(db, 'posts', post.id);
      await runTransaction(db, async transaction => {
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
          dataAtualizacao: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('[PaginaEmpresa] like:', error);
      Alert.alert('Erro', error?.message || 'Não foi possível registar o gosto.');
    }
  };

  const abrirComentarios = post => {
    setCommentsPost(post);
    setCommentText('');
    carregarComentarios(post.id);
  };

  const carregarComentarios = async postId => {
    try {
      const snap = await getDocs(collection(db, 'posts', postId, 'comentarios'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.timestamp?.toMillis?.() || 0;
        const tb = b.timestamp?.toMillis?.() || 0;
        return ta - tb;
      });
      setComments(list);
    } catch (error) {
      console.error('[PaginaEmpresa] comentários:', error);
      setComments([]);
    }
  };

  const enviarComentario = async () => {
    if (!commentsPost?.id || !user?.uid || !commentText.trim()) return;

    setSendingComment(true);

    try {
      await addDoc(
        collection(db, 'posts', commentsPost.id, 'comentarios'),
        {
          uid: user.uid,
          autorNome: perfilEmpresa?.nomeEmpresa || companyName,
          autorFoto: companyLogo,
          autorTipo: 'empresa',
          texto: commentText.trim(),
          timestamp: serverTimestamp(),
        },
      );

      const postRef = doc(db, 'posts', commentsPost.id);
      await runTransaction(db, async transaction => {
        const snap = await transaction.get(postRef);
        if (!snap.exists()) return;
        const data = snap.data() || {};
        transaction.update(postRef, {
          comentarios: Number(data.comentarios || 0) + 1,
          dataAtualizacao: serverTimestamp(),
        });
      });

      setCommentText('');
      await carregarComentarios(commentsPost.id);
    } catch (error) {
      Alert.alert('Erro', error?.message || 'Não foi possível comentar.');
    } finally {
      setSendingComment(false);
    }
  };

  const partilhar = async post => {
    try {
      await Share.share({ message: `${companyName}\n\n${post.texto || ''}` });
      await updateDoc(doc(db, 'posts', post.id), {
        partilhas: Number(post.partilhas || 0) + 1,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const abrirEdicaoPerfil = () => {
    setProfileForm({
      nomeEmpresa: perfilEmpresa?.nomeEmpresa || '',
      setor: perfilEmpresa?.setor || '',
      nif: perfilEmpresa?.nif || '',
      telefone: perfilEmpresa?.telefone || '',
      email: perfilEmpresa?.email || '',
      sobre: perfilEmpresa?.sobre || '',
      endereco: perfilEmpresa?.endereco || '',
      cidade: perfilEmpresa?.cidade || '',
      website: perfilEmpresa?.website || '',
      linkedin: perfilEmpresa?.linkedin || '',
      instagram: perfilEmpresa?.instagram || '',
      facebook: perfilEmpresa?.facebook || '',
      horario: perfilEmpresa?.horario || '',
    });
    setEditProfileVisible(true);
  };

  const atualizarCampoPerfil = (campo, valor) => {
    setProfileForm(prev => ({ ...prev, [campo]: valor }));
  };

  const guardarEdicaoPerfil = async () => {
    if (!user?.uid) return;
    if (!profileForm.nomeEmpresa.trim()) {
      Alert.alert('Campo obrigatório', 'Introduz o nome da página/empresa.');
      return;
    }
    if (!profileForm.email.trim() || !profileForm.email.includes('@')) {
      Alert.alert('E-mail inválido', 'Introduz um e-mail válido da empresa.');
      return;
    }

    setSavingProfile(true);
    try {
      const dados = Object.fromEntries(
        Object.entries(profileForm).map(([key, value]) => [key, String(value || '').trim()])
      );

      await guardarPerfilEmpresa(dados);
      setEditProfileVisible(false);
      Alert.alert('Perfil actualizado', 'As informações da Página da Empresa foram guardadas.');
    } catch (error) {
      console.error('[PaginaEmpresa] editar perfil:', error);
      Alert.alert('Erro', error?.message || 'Não foi possível guardar o perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const escolherLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Autoriza o acesso à galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri || !user?.uid) return;

      setUploadingProfile(true);
      const ext = result.assets[0].uri.split('.').pop()?.split('?')[0] || 'jpg';
      const caminho = `empresas/${user.uid}/perfil/logo_${Date.now()}.${ext}`;
      const url = await uploadFicheiroStorage(result.assets[0].uri, caminho);
      await guardarPerfilEmpresa({ logoURL: url });
    } catch (error) {
      Alert.alert('Erro', error?.message || 'Não foi possível atualizar o logotipo.');
    } finally {
      setUploadingProfile(false);
    }
  };

  const escolherCapa = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Autoriza o acesso à galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 6],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri || !user?.uid) return;

      setUploadingCover(true);
      const ext = result.assets[0].uri.split('.').pop()?.split('?')[0] || 'jpg';
      const caminho = `empresas/${user.uid}/perfil/capa_${Date.now()}.${ext}`;
      const url = await uploadFicheiroStorage(result.assets[0].uri, caminho);
      await guardarPerfilEmpresa({ capaURL: url });
    } catch (error) {
      Alert.alert('Erro', error?.message || 'Não foi possível atualizar a capa.');
    } finally {
      setUploadingCover(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Inicia sessão para continuar.</Text>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // AINDA NÃO EXISTE PÁGINA — FORMULÁRIO DE CRIAÇÃO
  // ═══════════════════════════════════════════════════════════
  // Antes desta correcção, chegar aqui sem perfilEmpresa mostrava só uma
  // mensagem e um botão "Voltar" — sem nenhuma forma de criar a página.
  // Agora mostra logo o formulário; assim que a criação for concluída, o
  // UserContext actualiza perfilEmpresa e este ecrã passa sozinho a
  // mostrar o feed abaixo, sem precisar de nenhuma navegação extra.
  if (!perfilEmpresa) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={C.white} />

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </TouchableOpacity>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Criar Página da Empresa</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.criarWrap} showsVerticalScrollIndicator={false}>
            <View style={styles.emptyIcon}>
              <Ionicons name="business" size={34} color={C.blue} />
            </View>
            <Text style={styles.criarTitulo}>Cria a página da tua empresa</Text>
            <Text style={styles.criarSubtitulo}>
              Publica conteúdos, mostra vagas e apresenta a tua empresa aos profissionais na ConnectAll Angola.
            </Text>

            <Text style={styles.formLabel}>Nome da Empresa *</Text>
            <TextInput
              style={styles.formInput}
              value={criarForm.nomeEmpresa}
              onChangeText={v => atualizarCampoCriar('nomeEmpresa', v)}
              placeholder="Ex: Unitel S.A."
              placeholderTextColor="#999"
            />

            <Text style={styles.formLabel}>Setor de Actividade *</Text>
            <TextInput
              style={styles.formInput}
              value={criarForm.setor}
              onChangeText={v => atualizarCampoCriar('setor', v)}
              placeholder="Ex: Tecnologia, Banca, Construção"
              placeholderTextColor="#999"
            />

            <Text style={styles.formLabel}>NIF *</Text>
            <TextInput
              style={styles.formInput}
              value={criarForm.nif}
              onChangeText={v => atualizarCampoCriar('nif', v)}
              placeholder="Número de Identificação Fiscal"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            <Text style={styles.formLabel}>Telefone *</Text>
            <TextInput
              style={styles.formInput}
              value={criarForm.telefone}
              onChangeText={v => atualizarCampoCriar('telefone', v)}
              placeholder="9XX XXX XXX"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />

            <Text style={styles.formLabel}>E-mail *</Text>
            <TextInput
              style={styles.formInput}
              value={criarForm.email}
              onChangeText={v => atualizarCampoCriar('email', v)}
              placeholder="empresa@email.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.formLabel}>Sobre a Empresa</Text>
            <TextInput
              style={[styles.formInput, styles.formTextarea]}
              value={criarForm.sobre}
              onChangeText={v => atualizarCampoCriar('sobre', v)}
              placeholder="Uma breve descrição da empresa..."
              placeholderTextColor="#999"
              multiline
            />

            <TouchableOpacity
              style={[styles.primaryButton, styles.criarBtn, criandoPagina && { opacity: 0.6 }]}
              onPress={criarPaginaEmpresa}
              disabled={criandoPagina}
            >
              {criandoPagina ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Criar Página</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // NOVO: cabeçalho da lista (tudo o que estava antes do feed de posts)
  // passou a ser o ListHeaderComponent da FlatList.
  const ListHeader = (
    <>
      {/* CABEÇALHO DA EMPRESA */}
      <View style={styles.companyCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={escolherCapa}
          style={styles.coverWrap}
        >
          {companyCover ? (
            <Image source={{ uri: companyCover }} style={styles.cover} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="business-outline" size={38} color="#FFFFFF" />
              <Text style={styles.coverPlaceholderText}>Adicionar capa</Text>
            </View>
          )}

          <View style={styles.coverEdit}>
            {uploadingCover ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Feather name="camera" size={16} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.companyInfo}>
          <TouchableOpacity
            onPress={escolherLogo}
            style={styles.logoContainer}
            activeOpacity={0.85}
          >
            <Avatar uri={companyLogo} name={companyName} size={82} />
            <View style={styles.logoEdit}>
              {uploadingProfile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={13} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.companyText}>
            <View style={styles.nameRow}>
              <Text style={styles.companyName} numberOfLines={2}>
                {companyName}
              </Text>
              <View style={styles.companyBadge}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.companySector}>{companySector}</Text>
            {!!perfilEmpresa.sobre && (
              <Text style={styles.companyAbout} numberOfLines={3}>
                {perfilEmpresa.sobre}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.pageActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={abrirEdicaoPerfil}
          >
            <Feather name="edit-2" size={16} color={C.text} />
            <Text style={styles.secondaryButtonText}>Editar página</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AVISO DE IDENTIDADE */}
      <View style={styles.identityNotice}>
        <View style={styles.identityIcon}>
          <Ionicons name="business" size={18} color={C.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.identityTitle}>
            Estás a publicar como {companyName}
          </Text>
          <Text style={styles.identityText}>
            As publicações usam o logotipo e o nome da Página, não o perfil do recrutador.
          </Text>
        </View>
      </View>

      {/* COMPOSER */}
      <View style={styles.composerCard}>
        <View style={styles.composerHeader}>
          <Avatar uri={companyLogo} name={companyName} size={46} />
          <TouchableOpacity
            style={styles.composerInput}
            onPress={() => {}}
            activeOpacity={0.8}
          >
            <TextInput
              value={texto}
              onChangeText={setTexto}
              multiline
              placeholder={`O que ${companyName} quer publicar?`}
              placeholderTextColor="#777"
              style={styles.composerText}
            />
          </TouchableOpacity>
        </View>

        {mediaUris.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaPreviewScroll}
          >
            {mediaUris.map(uri => (
              <View key={uri} style={styles.previewItem}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeMedia}
                  onPress={() => removerImagem(uri)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* NOVO: pré-visualização do vídeo selecionado */}
        {!!videoUri && (
          <View style={styles.videoPreviewWrap}>
            <VideoView
              style={styles.videoPreview}
              player={composerVideoPlayer}
              contentFit="cover"
              nativeControls
              allowsFullscreen
            />
            <TouchableOpacity
              style={styles.removeMedia}
              onPress={removerVideo}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composerDivider} />

        <View style={styles.composerActions}>
          <TouchableOpacity style={styles.composerAction} onPress={escolherImagens}>
            <Ionicons name="images-outline" size={21} color={C.green} />
            <Text style={styles.composerActionText}>Imagem</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.composerAction}
            onPress={escolherVideo}
          >
            <Ionicons name="videocam-outline" size={21} color={C.purple} />
            <Text style={styles.composerActionText}>Vídeo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.publishButton}
            onPress={publicar}
            disabled={publicando}
          >
            {publicando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.publishButtonText}>Publicar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* CABEÇALHO DO FEED */}
      <View style={styles.feedHeader}>
        <View>
          <Text style={styles.feedTitle}>Publicações da empresa</Text>
          <Text style={styles.feedSubtitle}>
            Tudo o que publicares aqui também fica disponível no Feed Geral.
          </Text>
        </View>
        <View style={styles.postCount}>
          <Text style={styles.postCountText}>{sortedPosts.length}</Text>
        </View>
      </View>
    </>
  );

  const ListEmpty = loading ? (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={C.blue} />
      <Text style={styles.loadingText}>A carregar publicações...</Text>
    </View>
  ) : (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name="newspaper-outline" size={34} color={C.blue} />
      </View>
      <Text style={styles.emptyTitle}>Ainda não há publicações</Text>
      <Text style={styles.emptyText}>
        Começa a construir a presença da tua empresa publicando notícias,
        oportunidades, eventos, conquistas e conteúdos profissionais.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>

        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>Página da Empresa</Text>
          <Text style={styles.topSubtitle}>Feed profissional</Text>
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => Alert.alert('Gestão', 'Use o menu da página para gerir os conteúdos.')}
        >
          <Feather name="more-horizontal" size={24} color={C.text} />
        </TouchableOpacity>
      </View>

      {/* NOVO: FlatList em vez de ScrollView — permite viewabilityConfig
          / onViewableItemsChanged para saber qual publicação está 100%
          visível e controlar a reprodução dos vídeos a partir disso. */}
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        data={sortedPosts}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={<View style={{ height: 50 }} />}
        renderItem={({ item: post }) => (
          <CompanyPost
            post={post}
            companyName={companyName}
            companyLogo={companyLogo}
            userId={user.uid}
            // NOVO: só reproduz vídeo se esta publicação está 100%
            // visível E o ecrã da Página da Empresa está em foco.
            isVisible={visiblePostId === post.id && screenFocused}
            onMenu={() => setMenuPost(post)}
            onLike={() => alternarLike(post)}
            onComment={() => abrirComentarios(post)}
            onShare={() => partilhar(post)}
            onStats={() => setStatsPost(post)}
          />
        )}
      />

      {/* MENU DA PUBLICAÇÃO */}
      <Modal
        visible={!!menuPost}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPost(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMenuPost(null)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Gerir publicação</Text>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => editarPost(menuPost)}
            >
              <Feather name="edit-3" size={21} color={C.text} />
              <Text style={styles.sheetText}>Editar publicação</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => alternarFixado(menuPost)}
            >
              <Ionicons
                name={menuPost?.pinned ? 'pin' : 'pin-outline'}
                size={21}
                color={C.text}
              />
              <Text style={styles.sheetText}>
                {menuPost?.pinned ? 'Desafixar publicação' : 'Fixar no topo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setMenuPost(null);
                setStatsPost(menuPost);
              }}
            >
              <Feather name="bar-chart-2" size={21} color={C.text} />
              <Text style={styles.sheetText}>Ver estatísticas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => eliminarPost(menuPost)}
            >
              <Feather name="trash-2" size={21} color={C.red} />
              <Text style={[styles.sheetText, { color: C.red }]}>
                Eliminar publicação
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* EDITAR */}
      <Modal
        visible={!!editingPost}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPost(null)}
      >
        <KeyboardAvoidingView
          style={styles.fullModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.editModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar publicação</Text>
              <TouchableOpacity onPress={() => setEditingPost(null)}>
                <Ionicons name="close" size={25} color={C.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="Texto da publicação"
              placeholderTextColor="#888"
              style={styles.editInput}
            />

            {!!editingPost?.mediaUrls?.filter(m => m?.type !== 'video')?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {editingPost.mediaUrls
                  .filter(m => m?.type !== 'video')
                  .map(m => (
                    <Image key={m.url} source={{ uri: m.url }} style={styles.editImage} />
                  ))}
              </ScrollView>
            )}

            {!!editingPost?.mediaUrls?.find(m => m?.type === 'video') && (
              <VideoView
                style={styles.editVideo}
                player={editVideoPlayer}
                contentFit="cover"
                nativeControls
                allowsFullscreen
              />
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={guardarEdicao}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Guardar alterações</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ESTATÍSTICAS */}
      <Modal
        visible={!!statsPost}
        transparent
        animationType="slide"
        onRequestClose={() => setStatsPost(null)}
      >
        <View style={styles.fullModal}>
          <View style={styles.statsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Estatísticas</Text>
              <TouchableOpacity onPress={() => setStatsPost(null)}>
                <Ionicons name="close" size={25} color={C.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.statsPostDate}>
              Publicado {formatDate(statsPost?.timestamp)}
            </Text>

            <View style={styles.statsGrid}>
              <StatBox
                icon="heart-outline"
                label="Gostos"
                value={statsPost?.likes || 0}
              />
              <StatBox
                icon="chatbubble-outline"
                label="Comentários"
                value={statsPost?.comentarios || 0}
              />
              <StatBox
                icon="share-social-outline"
                label="Partilhas"
                value={statsPost?.partilhas || 0}
              />
            </View>

            <View style={styles.statsInsight}>
              <Ionicons name="analytics-outline" size={24} color={C.blue} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statsInsightTitle}>Desempenho</Text>
                <Text style={styles.statsInsightText}>
                  Usa estas métricas para perceber quais conteúdos geram mais
                  interação com profissionais e candidatos.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDITAR PERFIL DA EMPRESA */}
      <Modal
        visible={editProfileVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.fullModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.profileEditModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Editar perfil da empresa</Text>
                <Text style={styles.modalSubtitle}>Completa as informações que os visitantes verão.</Text>
              </View>
              <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                <Ionicons name="close" size={25} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.formSectionTitle}>Identidade</Text>
              <Text style={styles.formLabel}>Nome da página / empresa *</Text>
              <TextInput style={styles.formInput} value={profileForm.nomeEmpresa} onChangeText={v => atualizarCampoPerfil('nomeEmpresa', v)} placeholder="Nome da empresa" placeholderTextColor="#999" />

              <Text style={styles.formLabel}>Setor de actividade</Text>
              <TextInput style={styles.formInput} value={profileForm.setor} onChangeText={v => atualizarCampoPerfil('setor', v)} placeholder="Ex.: Tecnologia, Consultoria, Construção" placeholderTextColor="#999" />

              <Text style={styles.formLabel}>NIF</Text>
              <TextInput style={styles.formInput} value={profileForm.nif} onChangeText={v => atualizarCampoPerfil('nif', v)} placeholder="NIF da empresa" placeholderTextColor="#999" keyboardType="numeric" />

              <Text style={styles.formLabel}>Sobre a empresa</Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} value={profileForm.sobre} onChangeText={v => atualizarCampoPerfil('sobre', v)} placeholder="Apresenta a empresa, missão, serviços e diferenciais..." placeholderTextColor="#999" multiline />

              <Text style={styles.formSectionTitle}>Contactos</Text>
              <Text style={styles.formLabel}>E-mail</Text>
              <TextInput style={styles.formInput} value={profileForm.email} onChangeText={v => atualizarCampoPerfil('email', v)} placeholder="empresa@email.com" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.formLabel}>Telefone</Text>
              <TextInput style={styles.formInput} value={profileForm.telefone} onChangeText={v => atualizarCampoPerfil('telefone', v)} placeholder="+244 ..." placeholderTextColor="#999" keyboardType="phone-pad" />

              <Text style={styles.formLabel}>Endereço</Text>
              <TextInput style={styles.formInput} value={profileForm.endereco} onChangeText={v => atualizarCampoPerfil('endereco', v)} placeholder="Rua, bairro, edifício..." placeholderTextColor="#999" />

              <Text style={styles.formLabel}>Cidade / Província</Text>
              <TextInput style={styles.formInput} value={profileForm.cidade} onChangeText={v => atualizarCampoPerfil('cidade', v)} placeholder="Luanda, Cabinda..." placeholderTextColor="#999" />

              <Text style={styles.formLabel}>Horário de funcionamento</Text>
              <TextInput style={styles.formInput} value={profileForm.horario} onChangeText={v => atualizarCampoPerfil('horario', v)} placeholder="Seg-Sex: 08h00–17h00" placeholderTextColor="#999" />

              <Text style={styles.formSectionTitle}>Presença digital</Text>
              <Text style={styles.formLabel}>Website</Text>
              <TextInput style={styles.formInput} value={profileForm.website} onChangeText={v => atualizarCampoPerfil('website', v)} placeholder="https://..." placeholderTextColor="#999" autoCapitalize="none" />

              <Text style={styles.formLabel}>LinkedIn</Text>
              <TextInput style={styles.formInput} value={profileForm.linkedin} onChangeText={v => atualizarCampoPerfil('linkedin', v)} placeholder="Página do LinkedIn" placeholderTextColor="#999" autoCapitalize="none" />

              <Text style={styles.formLabel}>Instagram</Text>
              <TextInput style={styles.formInput} value={profileForm.instagram} onChangeText={v => atualizarCampoPerfil('instagram', v)} placeholder="@empresa" placeholderTextColor="#999" autoCapitalize="none" />

              <Text style={styles.formLabel}>Facebook</Text>
              <TextInput style={styles.formInput} value={profileForm.facebook} onChangeText={v => atualizarCampoPerfil('facebook', v)} placeholder="Página do Facebook" placeholderTextColor="#999" autoCapitalize="none" />

              <TouchableOpacity style={styles.primaryButton} onPress={guardarEdicaoPerfil} disabled={savingProfile}>
                {savingProfile ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Guardar alterações</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* COMENTÁRIOS */}
      <Modal
        visible={!!commentsPost}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentsPost(null)}
      >
        <KeyboardAvoidingView
          style={styles.fullModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.commentsModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Comentários</Text>
                <Text style={styles.modalSubtitle}>
                  {comments.length} comentário(s)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCommentsPost(null)}>
                <Ionicons name="close" size={25} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 15 }}
            >
              {comments.length === 0 ? (
                <View style={styles.noComments}>
                  <Ionicons name="chatbubble-ellipses-outline" size={36} color="#AAA" />
                  <Text style={styles.noCommentsText}>Ainda não há comentários.</Text>
                </View>
              ) : (
                comments.map(comment => (
                  <View style={styles.commentRow} key={comment.id}>
                    <Avatar uri={comment.autorFoto} name={comment.autorNome} size={38} />
                    <View style={styles.commentBubble}>
                      <Text style={styles.commentAuthor}>{comment.autorNome}</Text>
                      <Text style={styles.commentText}>{comment.texto}</Text>
                      <Text style={styles.commentDate}>
                        {formatDate(comment.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.commentComposer}>
              <Avatar uri={companyLogo} name={companyName} size={38} />
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Escreve um comentário..."
                placeholderTextColor="#888"
                style={styles.commentInput}
              />
              <TouchableOpacity
                style={styles.commentSend}
                onPress={enviarComentario}
                disabled={sendingComment || !commentText.trim()}
              >
                {sendingComment ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="send" size={17} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function CompanyPost({
  post,
  companyName,
  companyLogo,
  userId,
  isVisible, // NOVO: só true quando 100% visível e o ecrã está em foco
  onMenu,
  onLike,
  onComment,
  onShare,
  onStats,
}) {
  const liked =
    Array.isArray(post.likedBy) && post.likedBy.includes(userId);

  // Compatível com o novo formato ({ url, type }) e com publicações
  // antigas que ainda tenham mediaUrls como lista de strings.
  const mediaItems = Array.isArray(post.mediaUrls) ? post.mediaUrls.filter(Boolean) : [];
  const images = mediaItems
    .filter(m => (typeof m === 'string' ? true : m?.type !== 'video'))
    .map(m => (typeof m === 'string' ? m : m?.url))
    .filter(Boolean);
  const videoUrl =
    mediaItems.find(m => typeof m !== 'string' && m?.type === 'video')?.url ||
    post.videoUrl || // compatibilidade com publicações antigas
    null;

  // NOVO: player do vídeo da publicação (se existir). Não reproduz
  // automaticamente ao criar — só quando isVisible passa a true.
  const postVideoPlayer = useVideoPlayer(videoUrl, player => {
    player.loop = false;
  });

  // NOVO: dá play/pause consoante a publicação está ou não 100% visível
  // no ecrã (e o ecrã em foco). Isto garante que só um vídeo toca de
  // cada vez, e que pausa automaticamente ao sair do ecrã visível.
  useEffect(() => {
    if (!videoUrl) return;

    if (isVisible) {
      postVideoPlayer.play();
    } else {
      postVideoPlayer.pause();
    }
  }, [isVisible, videoUrl, postVideoPlayer]);

  return (
    <View style={styles.postCard}>
      {post.pinned && (
        <View style={styles.pinnedBar}>
          <Ionicons name="pin" size={13} color={C.blue} />
          <Text style={styles.pinnedText}>Publicação fixada pela empresa</Text>
        </View>
      )}

      <View style={styles.postHeader}>
        <Avatar uri={companyLogo} name={companyName} size={48} />

        <View style={styles.postAuthorInfo}>
          <View style={styles.postNameRow}>
            <Text style={styles.postAuthor} numberOfLines={1}>
              {companyName}
            </Text>
            <View style={styles.verifiedSmall}>
              <Ionicons name="checkmark" size={9} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.postRole}>{post.autorCargo || 'Empresa'}</Text>
          <Text style={styles.postTime}>{formatDate(post.timestamp)} · 🌐</Text>
        </View>

        <TouchableOpacity onPress={onMenu} style={styles.postMenu}>
          <Feather name="more-horizontal" size={22} color={C.muted} />
        </TouchableOpacity>
      </View>

      {!!post.texto && (
        <Text style={styles.postText}>
          {post.texto}
        </Text>
      )}

      {/* Reprodução do vídeo da publicação, se existir */}
      {!!videoUrl && (
        <VideoView
          style={styles.postVideo}
          player={postVideoPlayer}
          contentFit="cover"
          nativeControls
          allowsFullscreen
        />
      )}

      {images.length > 0 && (
        <View style={styles.postImages}>
          {images.length === 1 ? (
            <Image source={{ uri: images[0] }} style={styles.singleImage} />
          ) : (
            <View style={styles.imageGrid}>
              {images.slice(0, 4).map((uri, index) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={[
                    styles.gridImage,
                    images.length === 2 && styles.gridImageTwo,
                    images.length >= 3 && index === 0 && styles.gridImageLarge,
                  ]}
                />
              ))}
              {images.length > 4 && (
                <View style={styles.moreImagesOverlay}>
                  <Text style={styles.moreImagesText}>+{images.length - 4}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.postMetrics}>
        <View style={styles.metricLeft}>
          {Number(post.likes || 0) > 0 && (
            <View style={styles.likeMetric}>
              <Ionicons name="thumbs-up" size={13} color="#FFFFFF" />
            </View>
          )}
          <Text style={styles.metricText}>
            {Number(post.likes || 0)}
          </Text>
        </View>

        <View style={styles.metricRight}>
          <Text style={styles.metricText}>
            {Number(post.comentarios || 0)} comentários
          </Text>
          <Text style={styles.metricDot}>·</Text>
          <Text style={styles.metricText}>
            {Number(post.partilhas || 0)} partilhas
          </Text>
        </View>
      </View>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postAction} onPress={onLike}>
          <Ionicons
            name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
            size={20}
            color={liked ? C.blue : C.muted}
          />
          <Text
            style={[
              styles.postActionText,
              liked && { color: C.blue, fontWeight: '700' },
            ]}
          >
            Gostar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.postAction} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={19} color={C.muted} />
          <Text style={styles.postActionText}>Comentar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.postAction} onPress={onShare}>
          <Ionicons name="share-social-outline" size={20} color={C.muted} />
          <Text style={styles.postActionText}>Partilhar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.postAction} onPress={onStats}>
          <Ionicons name="bar-chart-outline" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={25} color={C.blue} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.background,
    padding: 30,
  },
  topBar: {
    height: 62,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitleWrap: {
    flex: 1,
    marginLeft: 4,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
  },
  topSubtitle: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },

  // ── Formulário de criação da página ──
  criarWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'stretch',
  },
  criarTitulo: {
    fontSize: 22,
    fontWeight: '900',
    color: C.text,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  criarSubtitulo: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  criarBtn: {
    marginTop: 18,
    marginHorizontal: 0,
  },

  companyCard: {
    backgroundColor: C.white,
    marginBottom: 10,
  },
  coverWrap: {
    height: 155,
    backgroundColor: '#D9E5F2',
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.blueDark,
  },
  coverPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 7,
  },
  coverEdit: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyInfo: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    marginTop: -41,
  },
  logoContainer: {
    position: 'relative',
    width: 88,
    height: 88,
    padding: 3,
    borderRadius: 44,
    backgroundColor: C.white,
  },
  logoEdit: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: C.blue,
    borderWidth: 2,
    borderColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyText: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 48,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  companyName: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
  },
  companyBadge: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companySector: {
    fontSize: 13,
    color: C.muted,
    marginTop: 3,
  },
  companyAbout: {
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
    marginTop: 6,
  },
  pageActions: {
    padding: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 14,
  },
  secondaryButton: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B9B9B9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },

  identityNotice: {
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.blueLight,
    flexDirection: 'row',
    gap: 10,
  },
  identityIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
  },
  identityText: {
    fontSize: 11,
    color: '#4E5E70',
    lineHeight: 15,
    marginTop: 2,
  },

  composerCard: {
    backgroundColor: C.white,
    padding: 15,
    marginBottom: 10,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  composerInput: {
    flex: 1,
    minHeight: 54,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  composerText: {
    color: C.text,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 110,
    textAlignVertical: 'top',
  },
  composerDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 13,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    gap: 16,
  },
  composerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  composerActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },
  publishButton: {
    marginLeft: 'auto',
    minWidth: 82,
    height: 37,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '800',
  },
  mediaPreviewScroll: {
    marginTop: 12,
  },
  previewItem: {
    width: 100,
    height: 100,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeMedia: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // Pré-visualização do vídeo no composer
  videoPreviewWrap: {
    marginTop: 12,
    width: '100%',
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },

  feedHeader: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
  },
  feedSubtitle: {
    fontSize: 11,
    color: C.muted,
    marginTop: 3,
    maxWidth: SCREEN_WIDTH - 70,
  },
  postCount: {
    marginLeft: 'auto',
    minWidth: 32,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.blue,
  },

  postCard: {
    backgroundColor: C.white,
    marginBottom: 10,
    paddingTop: 13,
  },
  pinnedBar: {
    marginHorizontal: 15,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pinnedText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.blue,
  },
  postHeader: {
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAuthorInfo: {
    flex: 1,
    marginLeft: 10,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postAuthor: {
    maxWidth: SCREEN_WIDTH - 145,
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  verifiedSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postRole: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  postTime: {
    fontSize: 10,
    color: '#888',
    marginTop: 1,
  },
  postMenu: {
    padding: 8,
  },
  postText: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 12,
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
  },
  postVideo: {
    width: '100%',
    height: Math.min(SCREEN_WIDTH * 0.78, 430),
    backgroundColor: '#000',
  },
  postImages: {
    width: '100%',
  },
  singleImage: {
    width: '100%',
    height: Math.min(SCREEN_WIDTH * 0.78, 430),
    backgroundColor: '#EEE',
  },
  imageGrid: {
    width: '100%',
    height: Math.min(SCREEN_WIDTH * 0.72, 390),
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
    gap: 2,
  },
  gridImage: {
    width: (SCREEN_WIDTH - 2) / 2,
    height: (Math.min(SCREEN_WIDTH * 0.72, 390) - 2) / 2,
    backgroundColor: '#EEE',
  },
  gridImageTwo: {
    width: (SCREEN_WIDTH - 2) / 2,
    height: '100%',
  },
  gridImageLarge: {
    width: SCREEN_WIDTH,
  },
  moreImagesOverlay: {
    position: 'absolute',
    right: 15,
    bottom: 15,
    minWidth: 48,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreImagesText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 14,
  },
  postMetrics: {
    minHeight: 39,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricRight: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  likeMetric: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricText: {
    color: C.muted,
    fontSize: 11,
  },
  metricDot: {
    color: '#999',
  },
  postActions: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  postAction: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  postActionText: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },

  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: C.muted,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: C.white,
    marginHorizontal: 10,
    borderRadius: 10,
    padding: 28,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: C.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  primaryButton: {
    height: 45,
    borderRadius: 8,
    backgroundColor: C.blue,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryButtonText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 14,
  },
  avatarFallback: {
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: C.white,
    fontWeight: '800',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.42)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCC',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    marginBottom: 8,
  },
  sheetRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sheetText: {
    fontSize: 15,
    color: C.text,
    fontWeight: '600',
  },

  fullModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.42)',
    justifyContent: 'flex-end',
  },
  profileEditModal: {
    backgroundColor: C.white,
    height: '92%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 8,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.blue,
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 18,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    marginTop: 9,
    marginBottom: 5,
    paddingHorizontal: 18,
  },
  formInput: {
    marginHorizontal: 18,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D8D8D8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    backgroundColor: '#FFFFFF',
  },
  formTextarea: {
    minHeight: 105,
    textAlignVertical: 'top',
  },
  editModal: {
    backgroundColor: C.white,
    minHeight: '58%',
    maxHeight: '90%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
  },
  statsModal: {
    backgroundColor: C.white,
    minHeight: '48%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
  },
  commentsModal: {
    backgroundColor: C.white,
    height: '82%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 18,
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  editInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: C.text,
    textAlignVertical: 'top',
    marginVertical: 15,
  },
  editImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 15,
  },
  editVideo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#000',
  },
  statsPostDate: {
    fontSize: 12,
    color: C.muted,
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 20,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 23,
    fontWeight: '800',
    color: C.text,
    marginTop: 7,
  },
  statLabel: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  statsInsight: {
    marginTop: 18,
    padding: 14,
    backgroundColor: C.blueLight,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 11,
  },
  statsInsightTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
  },
  statsInsightText: {
    fontSize: 11,
    color: '#526274',
    lineHeight: 16,
    marginTop: 3,
  },
  noComments: {
    paddingVertical: 70,
    alignItems: 'center',
  },
  noCommentsText: {
    color: C.muted,
    fontSize: 13,
    marginTop: 10,
  },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 12,
    gap: 9,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    padding: 10,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '800',
    color: C.text,
  },
  commentText: {
    fontSize: 13,
    color: C.text,
    lineHeight: 18,
    marginTop: 2,
  },
  commentDate: {
    fontSize: 9,
    color: '#888',
    marginTop: 5,
  },
  commentComposer: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    borderRadius: 20,
    backgroundColor: '#F1F1F1',
    paddingHorizontal: 14,
    fontSize: 13,
    color: C.text,
  },
  commentSend: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
});