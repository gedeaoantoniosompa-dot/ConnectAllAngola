/**
 * src/app/(main)/perfil-publico-empresa.jsx
 * ConnectAll Angola — PERFIL PÚBLICO EXCLUSIVO DA EMPRESA
 *
 * IMPORTANTE:
 * Este ficheiro NÃO trata Utilizadores nem Recrutadores.
 * Os dados da empresa vêm exclusivamente de:
 *   users/{uid}/perfis/empresa
 *
 * As publicações vêm de posts onde:
 *   uid === uid da empresa
 *   autorTipo === 'empresa'
 *
 * Assim, uma publicação empresarial nunca abre o perfil do recrutador.
 *
 * SCHEMA DOS POSTS (igual ao feed geral — feed.jsx):
 *   likes: number          -> contagem total de reações
 *   likedBy: string[]       -> uids que reagiram
 *   reacoesMap: { [uid]: emoji }
 *   comentarios: number
 *   partilhas: number
 *   mediaUrls: { url, type: 'image' | 'video' }[]
 *
 * VÍDEO (NOVO):
 * - usa expo-video (useVideoPlayer + VideoView);
 * - a lista de publicações é um FlatList (não ScrollView) porque só o
 *   FlatList tem onViewableItemsChanged — é assim que sabemos, com
 *   precisão, qual publicação está 100% visível no ecrã;
 * - só o vídeo 100% visível reproduz; ao sair de vista, pausa
 *   automaticamente e o vídeo seguinte que ficar 100% visível arranca;
 * - o mesmo se aplica ao visualizador fullscreen (só a página do
 *   vídeo actualmente aberta reproduz).
 *
 * CORRIGIDO (foco do ecrã):
 * - o Expo Router mantém ecrãs anteriores montados na pilha de
 *   navegação; sem detectar perda de foco, um vídeo marcado como
 *   "activo" continuava a tocar em segundo plano mesmo depois de
 *   sair deste ecrã (voltar, navegar para outro separador, etc.);
 * - useFocusEffect (agora importado de 'expo-router/react-navigation',
 *   conforme exigido a partir do SDK 56) marca `ecraFocado` a
 *   false ao perder o foco e limpa `postAtivoId`, forçando todos os
 *   vídeos — tanto na lista como no visualizador fullscreen — a
 *   pausar.
 *
 * CORRIGIDO (texto solto / "Unexpected text node"):
 * - as condições `{(a || b) && (<View>...)}` foram trocadas por
 *   `{!!(a || b) && (<View>...)}` em três pontos (localização,
 *   contactos, presença online). Quando os campos vêm do Firestore
 *   como strings vazias ('') em vez de undefined, `'' || ''` resulta
 *   em '' (string), e '' && (<View>) devolve '' — uma string vazia a
 *   ser renderizada directamente como filho de <View>, o que o React
 *   Native Web rejeita ("Unexpected text node"). O !! força o
 *   resultado a ser sempre um boolean antes do &&.
 *
 * Dependência nova:
 *   npx expo install expo-video
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PostComentariosModal from '../../components/PostComentariosModal';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  azul: '#0A66C2',
  azulEscuro: '#084C91',
  azulClaro: '#EEF5FF',
  branco: '#FFFFFF',
  fundo: '#F6F8FB',
  preto: '#101828',
  texto: '#344054',
  cinza: '#667085',
  cinzaClaro: '#F2F4F7',
  borda: '#E4E7EC',
  verde: '#12B76A',
  vermelho: '#EF4444',
};

function AvatarEmpresa({ uri, nome, size = 92 }) {
  const inicial = (nome || 'E').trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: 18,
        },
      ]}
    >
      {typeof uri === 'string' && uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%', borderRadius: 18 }}
          contentFit="cover"
        />
      ) : (
        <Text style={[styles.avatarInicial, { fontSize: size * 0.36 }]}>
          {inicial}
        </Text>
      )}
    </View>
  );
}

function Campo({ icon, label, value, onPress }) {
  if (!value) return null;

  const content = (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={C.azul} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {onPress && <Feather name="external-link" size={15} color={C.cinza} />}
    </View>
  );

  return onPress ? (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      {content}
    </TouchableOpacity>
  ) : content;
}

function Secao({ titulo, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{titulo}</Text>
      {children}
    </View>
  );
}

function formatarData(timestamp) {
  if (!timestamp) return '';
  const data = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(data.getTime())) return '';

  const diff = Math.floor((Date.now() - data.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  return data.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// NOVO: normaliza mediaUrls para { url, type }, aceitando tanto o
// formato novo (objectos) como publicações antigas (strings simples,
// sempre tratadas como imagem).
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

// ════════════════════════════════════════════════════════════════════════════
// VÍDEO — mesma forma de visualização usada na Página da Empresa:
// reprodução inline no cartão, com controlos nativos, sem overlay de
// play e sem abrir um visualizador fullscreen à parte. Toca/pausa
// automaticamente consoante `isActive` (100% visível + ecrã em foco).
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
      style={styles.postVideo}
      player={player}
      contentFit="cover"
      nativeControls
      allowsFullscreen
    />
  );
}

function FullscreenMediaItem({ item, isActive }) {
  const isVideo = item.type === 'video';

  const player = useVideoPlayer(isVideo ? item.url : null, p => {
    p.loop = true;
  });

  useEffect(() => {
    if (!isVideo) return;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isVideo, player]);

  if (isVideo) {
    return (
      <VideoView
        style={{ width: W, height: H }}
        player={player}
        contentFit="contain"
        nativeControls
        allowsFullscreen
      />
    );
  }

  return <Image source={{ uri: item.url }} style={{ width: W, height: H }} contentFit="contain" />;
}

// ════════════════════════════════════════════════════════════════════════════
// VISUALIZADOR FULLSCREEN (imagem/vídeo + acções sobrepostas)
// ════════════════════════════════════════════════════════════════════════════
function FullscreenPost({ visivel, post, empresa, indiceInicial, meuUid, jaGostei, ecraFocado, onFechar, onLike, onComentar, onPartilhar }) {
  const [indice, setIndice] = useState(indiceInicial || 0);

  useEffect(() => {
    if (visivel) setIndice(indiceInicial || 0);
  }, [visivel, indiceInicial]);

  if (!post) return null;

  const itens = normalizarMedia(post.mediaUrls);
  const n = itens.length;

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
            contentOffset={{ x: indice * W, y: 0 }}
            onMomentumScrollEnd={e => setIndice(Math.round(e.nativeEvent.contentOffset.x / W))}
            style={{ flex: 1 }}
          >
            {itens.map((item, i) => (
              <View key={i} style={{ width: W, height: H, justifyContent: 'center', alignItems: 'center' }}>
                {/* Só a página actualmente visível (indice === i), com o modal
                    aberto E o ecrã pai em foco, é que reproduz o vídeo. */}
                <FullscreenMediaItem item={item} isActive={visivel && ecraFocado && indice === i} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff' }}>{post.texto}</Text>
          </View>
        )}

        {/* Ícones de acção lado direito */}
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

        {/* Rodapé com identidade + legenda */}
        <View style={fs.rodape}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AvatarEmpresa uri={post.autorFoto || empresa?.logoURL} nome={post.autorNome || empresa?.nomeEmpresa} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={fs.autorNome} numberOfLines={1}>{post.autorNome || empresa?.nomeEmpresa || 'Empresa'}</Text>
              <Text style={fs.autorCargo} numberOfLines={1}>{formatarData(post.timestamp)}</Text>
            </View>
          </View>
          {!!post.texto && (
            <Text style={fs.textoPost} numberOfLines={4}>{post.texto}</Text>
          )}
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

// ════════════════════════════════════════════════════════════════════════════
// CARTÃO DE PUBLICAÇÃO (com acções: gosto / comentar / partilhar)
// ════════════════════════════════════════════════════════════════════════════
function PostEmpresa({ post, empresa, meuUid, isActive, onAbrirImagem, onLike, onComentar, onPartilhar }) {
  const itensMedia = useMemo(() => normalizarMedia(post.mediaUrls), [post.mediaUrls]);
  const imagens = itensMedia.filter(item => item.type !== 'video');
  const video = itensMedia.find(item => item.type === 'video');

  const jaGostei = Array.isArray(post.likedBy) && meuUid ? post.likedBy.includes(meuUid) : false;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <AvatarEmpresa
          uri={post.autorFoto || empresa.logoURL}
          nome={post.autorNome || empresa.nomeEmpresa}
          size={46}
        />

        <View style={{ flex: 1 }}>
          <View style={styles.postNameRow}>
            <Text style={styles.postAuthor} numberOfLines={1}>
              {post.autorNome || empresa.nomeEmpresa || 'Empresa'}
            </Text>
            <Ionicons name="checkmark-circle" size={14} color={C.azul} />
          </View>
          <Text style={styles.postRole} numberOfLines={1}>
            {post.autorCargo || empresa.setor || 'Empresa'} · {formatarData(post.timestamp)}
          </Text>
        </View>
      </View>

      {!!post.texto && <Text style={styles.postText}>{post.texto}</Text>}

      {/* Publicação com vídeo — igual à Página da Empresa: reprodução
          inline com controlos nativos, sem abrir fullscreen à parte.
          Toca/pausa automaticamente consoante `isActive`. */}
      {video ? (
        <PostVideoInline uri={video.url} isActive={isActive} />
      ) : (
        imagens.length > 0 && (
          <View style={styles.mediaGrid}>
            {imagens.map(item => {
              const indice = itensMedia.indexOf(item);
              return (
                <TouchableOpacity
                  key={`${post.id}-${indice}`}
                  activeOpacity={0.92}
                  onPress={() => onAbrirImagem(post, indice)}
                  style={[
                    styles.postImageWrap,
                    imagens.length === 1 ? styles.postImageOne : styles.postImageMany,
                  ]}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )
      )}

      <View style={styles.postStats}>
        <Text style={styles.statText}>❤️ {Number(post.likes || 0)}</Text>
        <Text style={styles.statText}>💬 {Number(post.comentarios || 0)}</Text>
        <Text style={styles.statText}>↗ {Number(post.partilhas || 0)}</Text>
      </View>

      {/* ── Barra de acções: Gosto / Comentar / Partilhar ── */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postAction} onPress={() => onLike(post)}>
          <Ionicons
            name={jaGostei ? 'heart-sharp' : 'heart-outline'}
            size={18}
            color={jaGostei ? C.vermelho : C.cinza}
          />
          <Text style={[styles.postActionText, jaGostei && { color: C.vermelho, fontWeight: '700' }]}>
            Gosto
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postAction} onPress={() => onComentar(post)}>
          <Ionicons name="chatbubble-outline" size={18} color={C.cinza} />
          <Text style={styles.postActionText}>Comentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postAction} onPress={() => onPartilhar(post)}>
          <Ionicons name="paper-plane-outline" size={18} color={C.cinza} />
          <Text style={styles.postActionText}>Partilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PerfilPublicoEmpresaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const uid = Array.isArray(params.uid) ? params.uid[0] : params.uid;
  const { user } = useUser();

  const [empresa, setEmpresa] = useState(null);
  const [posts, setPosts] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fsPost, setFsPost] = useState(null);
  const [fsIndice, setFsIndice] = useState(0);
  const [modalComentarios, setModalComentarios] = useState(null);

  // NOVO: id da publicação cujo vídeo está 100% visível (só esse reproduz).
  const [postAtivoId, setPostAtivoId] = useState(null);

  // CORRIGIDO: indica se ESTE ecrã está em foco. O Expo Router mantém
  // ecrãs anteriores montados na pilha de navegação, por isso sem isto
  // os vídeos continuavam a tocar "por trás" ao sair deste ecrã (voltar,
  // navegar para outro separador, etc.). Quando perde o foco, limpamos
  // postAtivoId e marcamos ecraFocado como false, o que força isActive a
  // false em todos os vídeos (lista e fullscreen).
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

  // viewabilityConfig/callback precisam de referência estável entre renders,
  // por isso usamos useRef em vez de recriá-los a cada render.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 100 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visivel = viewableItems.find(v => v.isViewable);
    setPostAtivoId(visivel ? visivel.item.id : null);
  }).current;

  useEffect(() => {
    if (!uid) {
      setCarregando(false);
      return;
    }

    const empresaRef = doc(db, 'users', uid, 'perfis', 'empresa');

    const unsub = onSnapshot(
      empresaRef,
      snap => {
        if (snap.exists()) {
          setEmpresa({ id: snap.id, ...snap.data() });
        } else {
          setEmpresa(null);
        }
        setCarregando(false);
      },
      error => {
        console.error('[PerfilPublicoEmpresa] empresa:', error);
        setEmpresa(null);
        setCarregando(false);
      }
    );

    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    // Apenas uid aqui. Ordenamos localmente para evitar depender de índice
    // composto do Firestore. Depois filtramos obrigatoriamente autorTipo=empresa.
    const q = query(collection(db, 'posts'), where('uid', '==', uid));

    const unsub = onSnapshot(
      q,
      snap => {
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(post => post.autorTipo === 'empresa')
          .sort((a, b) => {
            const ta = a.timestamp?.toMillis?.() || 0;
            const tb = b.timestamp?.toMillis?.() || 0;
            return tb - ta;
          });

        setPosts(lista);

        // Mantém o post aberto em fullscreen sincronizado (likes/comentários em tempo real)
        setFsPost(prev => (prev ? lista.find(p => p.id === prev.id) || prev : prev));
      },
      error => {
        console.error('[PerfilPublicoEmpresa] posts:', error);
        setPosts([]);
      }
    );

    return unsub;
  }, [uid]);

  const dados = useMemo(() => {
    const e = empresa || {};

    return {
      nome: e.nomeEmpresa || 'Empresa',
      foto: e.logoURL || null,
      capa: e.capaURL || null,
      bio: e.sobre || '',
      setor: e.setor || '',
      telefone: e.telefone || e.telPrincipal || '',
      email: e.email || e.emailContacto || '',
      nif: e.nif || '',
      endereco: e.endereco || e.morada || '',
      cidade: e.cidade || e.municipio || '',
      provincia: e.provincia || '',
      website: e.website || '',
      linkedin: e.linkedin || '',
      instagram: e.instagram || '',
      facebook: e.facebook || '',
      horario: e.horario || '',
      fundacao: e.anoFundacao || e.fundacao || '',
      tamanho: e.tamanho || e.numeroFuncionarios || '',
    };
  }, [empresa]);

  const abrirLink = async value => {
    if (!value) return;
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link indisponível', 'Não foi possível abrir este endereço.');
    }
  };

  const contactarEmail = () => {
    if (dados.email) Linking.openURL(`mailto:${dados.email}`);
  };

  const contactarTelefone = () => {
    if (dados.telefone) Linking.openURL(`tel:${dados.telefone}`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (uid) {
        const snap = await getDoc(doc(db, 'users', uid, 'perfis', 'empresa'));
        if (snap.exists()) setEmpresa({ id: snap.id, ...snap.data() });
      }
    } finally {
      setRefreshing(false);
    }
  };

  // ── Gosto: mesmo schema usado no feed geral (likes/likedBy/reacoesMap) ──
  const alternarLike = async post => {
    if (!user?.uid) {
      Alert.alert('Sessão necessária', 'Inicia sessão para reagir a esta publicação.');
      return;
    }
    const postRef = doc(db, 'posts', post.id);
    try {
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
        });
      });
    } catch (error) {
      console.error('[PerfilPublicoEmpresa] like:', error);
      Alert.alert('Erro', 'Não foi possível registar o gosto.');
    }
  };

  const abrirComentarios = post => {
    setModalComentarios({ postId: post.id, post });
  };

  const partilharPost = async post => {
    try {
      await Share.share({
        message: `${dados.nome}\n\n${post.texto || ''}`,
      });
      await updateDoc(doc(db, 'posts', post.id), {
        partilhas: Number(post.partilhas || 0) + 1,
      });
    } catch (error) {
      console.error('[PerfilPublicoEmpresa] partilhar:', error);
    }
  };

  const abrirFullscreen = (post, indice = 0) => {
    setFsPost(post);
    setFsIndice(indice);
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.azul} />
          <Text style={styles.loadingText}>A carregar página da empresa...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!empresa) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={C.preto} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Página da Empresa</Text>
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="business-outline" size={52} color="#98A2B3" />
          <Text style={styles.errorTitle}>Empresa não encontrada</Text>
          <Text style={styles.errorText}>Esta página da empresa não está disponível.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // NOVO: cabeçalho (capa, identidade, secções de informação) passa a
  // ser o ListHeaderComponent do FlatList — só assim conseguimos usar
  // onViewableItemsChanged para saber qual publicação está 100% visível.
  const cabecalho = (
    <>
      {/* CAPA */}
      <View style={styles.cover}>
        {dados.capa ? (
          <Image source={{ uri: dados.capa }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="business-outline" size={58} color="#B8C7DA" />
          </View>
        )}
      </View>

      {/* IDENTIDADE DA EMPRESA */}
      <View style={styles.identityCard}>
        <View style={styles.avatarOverlap}>
          <AvatarEmpresa uri={dados.foto} nome={dados.nome} size={96} />
        </View>

        <View style={styles.nameLine}>
          <Text style={styles.nome}>{dados.nome}</Text>
          <View style={styles.empresaBadge}>
            <Ionicons name="business" size={12} color={C.azul} />
            <Text style={styles.empresaBadgeText}>Empresa</Text>
          </View>
        </View>

        {!!dados.setor && <Text style={styles.subtitulo}>{dados.setor}</Text>}

        {/* CORRIGIDO: !!(...) força boolean — evita renderizar '' quando
            cidade/provincia vêm como string vazia do Firestore. */}
        {!!(dados.cidade || dados.provincia) && (
          <View style={styles.locationLine}>
            <Ionicons name="location-outline" size={15} color={C.cinza} />
            <Text style={styles.locationText}>
              {[dados.cidade, dados.provincia].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          {!!dados.email && (
            <TouchableOpacity style={styles.actionBtn} onPress={contactarEmail}>
              <Ionicons name="mail-outline" size={18} color={C.azul} />
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>
          )}
          {!!dados.telefone && (
            <TouchableOpacity style={styles.actionBtn} onPress={contactarTelefone}>
              <Ionicons name="call-outline" size={18} color={C.azul} />
              <Text style={styles.actionText}>Contactar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SOBRE */}
      {!!dados.bio && (
        <Secao titulo="Sobre a empresa">
          <Text style={styles.bio}>{dados.bio}</Text>
        </Secao>
      )}

      {/* INFORMAÇÕES */}
      <Secao titulo="Informações da empresa">
        <Campo icon="business-outline" label="Setor de actividade" value={dados.setor} />
        <Campo icon="document-text-outline" label="NIF" value={dados.nif} />
        <Campo icon="location-outline" label="Endereço" value={dados.endereco} />
        <Campo icon="location-outline" label="Localização" value={[dados.cidade, dados.provincia].filter(Boolean).join(', ')} />
        <Campo icon="time-outline" label="Horário de funcionamento" value={dados.horario} />
        <Campo icon="calendar-outline" label="Fundação" value={String(dados.fundacao || '')} />
        <Campo icon="people-outline" label="Dimensão da empresa" value={String(dados.tamanho || '')} />
        <Campo icon="globe-outline" label="Website" value={dados.website} onPress={() => abrirLink(dados.website)} />
      </Secao>

      {/* CONTACTOS */}
      {/* CORRIGIDO: !!(...) força boolean pelo mesmo motivo acima. */}
      {!!(dados.email || dados.telefone) && (
        <Secao titulo="Contactos">
          <Campo icon="mail-outline" label="E-mail" value={dados.email} onPress={contactarEmail} />
          <Campo icon="call-outline" label="Telefone" value={dados.telefone} onPress={contactarTelefone} />
        </Secao>
      )}

      {/* REDES */}
      {/* CORRIGIDO: !!(...) força boolean pelo mesmo motivo acima. */}
      {!!(dados.linkedin || dados.instagram || dados.facebook) && (
        <Secao titulo="Presença online">
          <Campo icon="logo-linkedin" label="LinkedIn" value={dados.linkedin} onPress={() => abrirLink(dados.linkedin)} />
          <Campo icon="logo-instagram" label="Instagram" value={dados.instagram} onPress={() => abrirLink(dados.instagram)} />
          <Campo icon="logo-facebook" label="Facebook" value={dados.facebook} onPress={() => abrirLink(dados.facebook)} />
        </Secao>
      )}

      {/* PUBLICAÇÕES EXCLUSIVAS DA EMPRESA */}
      <View style={styles.postsHeader}>
        <View>
          <Text style={styles.postsTitle}>Publicações da empresa</Text>
          <Text style={styles.postsSubtitle}>
            {posts.length} publicação{posts.length === 1 ? '' : 'ões'}
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={C.preto} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>Página da Empresa</Text>
        <View style={{ width: 42 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostEmpresa
            post={item}
            empresa={empresa}
            meuUid={user?.uid}
            // CORRIGIDO: só reproduz se estiver 100% visível NA LISTA
            // E este ecrã continuar em foco.
            isActive={postAtivoId === item.id && ecraFocado}
            onAbrirImagem={abrirFullscreen}
            onLike={alternarLike}
            onComentar={abrirComentarios}
            onPartilhar={partilharPost}
          />
        )}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="newspaper-outline" size={44} color="#98A2B3" />
            <Text style={styles.emptyTitle}>Ainda não há publicações</Text>
            <Text style={styles.emptyText}>
              As publicações feitas em nome de {dados.nome} aparecerão aqui.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 35 }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        // NOVO: só um vídeo reproduz de cada vez — o que estiver 100%
        // dentro do ecrã. Ao rolar, pausa o anterior e liga o seguinte.
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
      />

      <FullscreenPost
        visivel={!!fsPost}
        post={fsPost}
        empresa={empresa}
        indiceInicial={fsIndice}
        meuUid={user?.uid}
        jaGostei={!!(fsPost && Array.isArray(fsPost.likedBy) && user?.uid && fsPost.likedBy.includes(user.uid))}
        ecraFocado={ecraFocado}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fundo },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25 },
  loadingText: { marginTop: 10, color: C.cinza, fontSize: 13 },
  errorTitle: { marginTop: 12, fontSize: 18, fontWeight: '900', color: C.preto },
  errorText: { marginTop: 5, textAlign: 'center', color: C.cinza, fontSize: 13 },

  topbar: {
    height: 58,
    backgroundColor: C.branco,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borda,
  },
  topBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: C.preto },

  cover: { height: 190, backgroundColor: '#E8EEF6' },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  identityCard: {
    backgroundColor: C.branco,
    paddingHorizontal: 16,
    paddingBottom: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.borda,
  },
  avatarOverlap: {
    marginTop: -48,
    marginBottom: 10,
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: 21,
    backgroundColor: C.branco,
  },
  avatar: { backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInicial: { color: C.branco, fontWeight: '900' },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  nome: { fontSize: 23, fontWeight: '900', color: C.preto },
  empresaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.azulClaro, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  empresaBadgeText: { color: C.azul, fontSize: 11, fontWeight: '800' },
  subtitulo: { marginTop: 5, fontSize: 14, color: C.cinza },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  locationText: { color: C.cinza, fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 15 },
  actionBtn: { flex: 1, height: 40, borderWidth: 1, borderColor: '#B2DDFF', backgroundColor: C.azulClaro, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionText: { color: C.azul, fontSize: 12, fontWeight: '800' },

  card: { backgroundColor: C.branco, marginTop: 10, padding: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.borda },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: C.preto, marginBottom: 12 },
  bio: { color: C.texto, fontSize: 14, lineHeight: 21 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  infoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 10, color: C.cinza, marginBottom: 2 },
  infoValue: { fontSize: 13, color: C.texto, fontWeight: '600' },

  postsHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 7 },
  postsTitle: { fontSize: 18, fontWeight: '900', color: C.preto },
  postsSubtitle: { fontSize: 11, color: C.cinza, marginTop: 3 },
  postCard: { backgroundColor: C.branco, marginHorizontal: 12, marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: C.borda, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postAuthor: { maxWidth: '88%', fontSize: 14, fontWeight: '800', color: C.preto },
  postRole: { marginTop: 3, fontSize: 11, color: C.cinza },
  postText: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 14, lineHeight: 21, color: C.texto },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, backgroundColor: '#F1F5F9' },
  postImageWrap: { backgroundColor: '#E2E8F0' },
  postImageOne: { width: '100%', height: 300 },
  postImageMany: { width: '49.7%', height: 190 },
  // Mesma altura/formato de vídeo usado na Página da Empresa.
  postVideo: {
    width: '100%',
    height: Math.min(W * 0.78, 430),
    backgroundColor: '#000',
  },
  postStats: { flexDirection: 'row', gap: 18, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  statText: { fontSize: 11, color: C.cinza },
  postActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F2F4F7', paddingVertical: 4, paddingHorizontal: 6 },
  postAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  postActionText: { fontSize: 12, fontWeight: '600', color: C.cinza },

  empty: { marginHorizontal: 12, marginTop: 8, padding: 35, backgroundColor: C.branco, borderRadius: 14, borderWidth: 1, borderColor: C.borda, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: '800', color: C.preto },
  emptyText: { marginTop: 6, textAlign: 'center', fontSize: 12, lineHeight: 18, color: C.cinza },
});