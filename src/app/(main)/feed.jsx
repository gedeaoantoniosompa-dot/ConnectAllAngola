import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField,
  doc, getDocs, increment, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, startAfter, updateDoc, where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, FlatList,
  Modal, RefreshControl,
  Image as RNImage,
  ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BloqueioAnonimo from '../../components/BloqueioAnonimo';
import PostComentariosModal from '../../components/PostComentariosModal';
import PostMedia from '../../components/PostMedia';
import { db } from '../../config/firebase';
import { useUpload } from '../../context/UploadContext';
import { useUser } from '../../context/UserContext';
import { useContasVerificadas } from '../../hooks/useContasVerificadas';
import { useNotifications } from '../../hooks/useNotifications';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { enviarNotificacao } from '../../services/notificationService';
import { ouvirLivesAtivas } from '../../services/livesService';

const { width: W, height: H } = Dimensions.get('window');
const PAGE_SIZE = 7;

// As Oportunidades de Carreira já não são estáticas: vêm em tempo real do
// Firestore (posts com tipo === 'oportunidade'), ver useEffect de "oportunidades" mais abaixo.
function tempoRelativoVaga(timestamp) {
  if (!timestamp) return 'recentemente';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffDias = Math.floor((agora.getTime() - data.getTime()) / 86400000);
  if (diffDias <= 0) return 'hoje';
  if (diffDias === 1) return 'há 1 dia';
  if (diffDias < 7) return `há ${diffDias} dias`;
  const semanas = Math.floor(diffDias / 7);
  if (semanas < 5) return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`;
  const meses = Math.floor(diffDias / 30);
  return meses <= 1 ? 'há 1 mês' : `há ${meses} meses`;
}

const TIPO_CORES = { conquista: '#D97706', ideia: '#2563EB', oportunidade: '#059669', artigo: '#7C3AED' };
const REACOES_EMOJIS = ['❤️', '😢', '🫡', '💪', '🥳', '🙏'];
const MOTIVOS_DENUNCIA = [
  { id: 'spam',      label: 'Spam ou conteúdo irrelevante',       icon: 'megaphone-outline' },
  { id: 'odio',      label: 'Discurso de ódio ou discriminação',  icon: 'warning-outline' },
  { id: 'falsa',     label: 'Informação falsa ou enganosa',       icon: 'information-circle-outline' },
  { id: 'violencia', label: 'Violência ou conteúdo perturbador',  icon: 'shield-outline' },
  { id: 'assedio',   label: 'Assédio ou bullying',                icon: 'person-remove-outline' },
  { id: 'adulto',    label: 'Conteúdo adulto inapropriado',       icon: 'eye-off-outline' },
  { id: 'outro',     label: 'Outro motivo',                       icon: 'ellipsis-horizontal-outline' },
];

function tempoRelativo(timestamp) {
  if (!timestamp) return '';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((agora.getTime() - data.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function BadgeVerificado({ size = 14 }) {
  return <Ionicons name="shield-checkmark" size={size} color="#1677F2" />;
}

function ImagemUnica({ uri, onPress }) {
  const [alturaCalculada, setAlturaCalculada] = useState(W * 0.75);
  useEffect(() => {
    RNImage.getSize(uri, (w, h) => {
      const ratio = h / w;
      setAlturaCalculada(ratio > 1 ? Math.min(W * ratio, W * 1.4) : Math.min(W * ratio, 400));
    }, () => setAlturaCalculada(W * 0.75));
  }, [uri]);
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
      <Image source={{ uri }} style={{ width: '100%', height: alturaCalculada }} contentFit="cover" />
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GRID DE IMAGENS
// ════════════════════════════════════════════════════════════════════════════
function GridImagens({ imagens, post, acoes, onAbrirComentarios }) {
  const [fsVisivel,       setFsVisivel]       = useState(false);
  const [fsIndice,        setFsIndice]        = useState(0);
  const [reacaoPickerVis, setReacaoPickerVis] = useState(false);
  // ✅ Ver mais/menos no texto da descrição
  const [verMaisTexto,    setVerMaisTexto]    = useState(false);
  const pickerAnim = useRef(new Animated.Value(0)).current;

  const n             = imagens.length;
  const autorNome     = post?.autorNome    || '';
  const autorFoto     = post?.autorFoto    || null;
  const autorCargo    = post?.autorCargo   || post?.cargo || '';
  const textoPost     = post?.texto        || '';
  const likesCount    = acoes?.likesCount  ?? 0;
  const commentsCount = acoes?.commentsCount ?? 0;
  const sharesCount   = post?.partilhas    || 0;
  const liked         = acoes?.liked       || false;
  // ✅ Emoji dinâmico da reação do utilizador actual
  const emojiActual   = post?.reacoesMap?.[post?.meuUid] || null;

  const abrir = (i) => { setFsIndice(i); setFsVisivel(true); };

  const abrirReacao = () => {
    setReacaoPickerVis(true);
    Animated.spring(pickerAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }).start();
  };
  const fecharReacao = () => {
    pickerAnim.setValue(0);
    setReacaoPickerVis(false);
  };
  const escolherReacao = (emoji) => {
    fecharReacao();
    acoes?.onReacao?.(emoji);
    if (!acoes?.onReacao) acoes?.onLike?.();
  };

  const renderGrid = () => {
    if (n === 0) return null;
    if (n === 1) return <ImagemUnica uri={imagens[0].url} onPress={() => abrir(0)} />;
    if (n === 2) return (
      <View style={{ flexDirection: 'row', gap: 2, height: 280 }}>
        {imagens.map((im, i) => (
          <TouchableOpacity key={i} style={{ flex: 1 }} activeOpacity={0.92} onPress={() => abrir(i)}>
            <Image source={{ uri: im.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </TouchableOpacity>
        ))}
      </View>
    );
    if (n === 3) return (
      <View style={{ flexDirection: 'row', gap: 2, height: 320 }}>
        <TouchableOpacity style={{ flex: 1.1 }} activeOpacity={0.92} onPress={() => abrir(0)}>
          <Image source={{ uri: imagens[0].url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </TouchableOpacity>
        <View style={{ flex: 0.9, gap: 2 }}>
          {[1, 2].map(i => (
            <TouchableOpacity key={i} style={{ flex: 1 }} activeOpacity={0.92} onPress={() => abrir(i)}>
              <Image source={{ uri: imagens[i].url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
    const lado     = (W - 36) / 2;
    const visiveis = imagens.slice(0, 4);
    const extras   = n - 4;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {visiveis.map((im, i) => (
          <TouchableOpacity key={i} activeOpacity={0.92} onPress={() => abrir(i)} style={{ width: lado, height: lado + 12 }}>
            <Image source={{ uri: im.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            {i === 3 && extras > 0 && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>+{extras}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <>
      {renderGrid()}

      {/* ── FULLSCREEN ── */}
      <Modal visible={fsVisivel} transparent={false} animationType="fade" onRequestClose={() => setFsVisivel(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>

          {/* Seta voltar */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 48, left: 16, zIndex: 30, padding: 8 }}
            onPress={() => setFsVisivel(false)}
          >
            <Ionicons name="arrow-back" size={26} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>

          {/* Imagens */}
          <ScrollView
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            contentOffset={{ x: fsIndice * W, y: 0 }}
            onMomentumScrollEnd={e => setFsIndice(Math.round(e.nativeEvent.contentOffset.x / W))}
            style={{ flex: 1 }}
          >
            {imagens.map((im, i) => (
              <View key={i} style={{ width: W, height: H, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: im.url }} style={{ width: W, height: H }} contentFit="contain" />
              </View>
            ))}
          </ScrollView>

          {/* ── Ícones lado direito — SEM círculos, com sombra para visibilidade ── */}
          <View style={{
            position: 'absolute',
            right: 14,
            bottom: 160,
            alignItems: 'center',
            gap: 24,
            zIndex: 30,
          }}>
            {/* ✅ Like com pressão longa = emojis; ícone muda com a reação */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={acoes?.onLike}
              onLongPress={abrirReacao}
              style={{ alignItems: 'center' }}
            >
              {emojiActual && emojiActual !== '❤️'
                ? <Text style={{ fontSize: 28, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>{emojiActual}</Text>
                : <Ionicons
                    name={liked ? 'heart-sharp' : 'heart-outline'}
                    size={28}
                    color={liked ? '#EF4444' : 'rgba(255,255,255,0.9)'}
                    style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
                  />
              }
              <Text style={fsIcStyles.count}>{likesCount}</Text>
            </TouchableOpacity>

            {/* Comentários */}
            <TouchableOpacity activeOpacity={0.8} onPress={onAbrirComentarios} style={{ alignItems: 'center' }}>
              <Ionicons name="chatbubble-outline" size={26} color="rgba(255,255,255,0.9)" style={fsIcStyles.sombra} />
              <Text style={fsIcStyles.count}>{commentsCount}</Text>
            </TouchableOpacity>

            {/* Partilhar */}
            <TouchableOpacity activeOpacity={0.8} onPress={acoes?.onShare} style={{ alignItems: 'center' }}>
              <Ionicons name="repeat-outline" size={28} color="rgba(255,255,255,0.9)" style={fsIcStyles.sombra} />
              <Text style={fsIcStyles.count}>{sharesCount}</Text>
            </TouchableOpacity>

            {/* Enviar */}
            <TouchableOpacity activeOpacity={0.8} onPress={acoes?.onShare} style={{ alignItems: 'center' }}>
              <Ionicons name="paper-plane-outline" size={26} color="rgba(255,255,255,0.9)" style={fsIcStyles.sombra} />
            </TouchableOpacity>

            {/* Mais opções */}
            <TouchableOpacity activeOpacity={0.8} onPress={acoes?.onMore} style={{ alignItems: 'center' }}>
              <Ionicons name="ellipsis-horizontal" size={26} color="rgba(255,255,255,0.9)" style={fsIcStyles.sombra} />
            </TouchableOpacity>
          </View>

          {/* ── Rodapé: foto + nome + cargo + texto com "ver mais" ── */}
          <View style={{
            position: 'absolute',
            left: 0,
            right: 80,
            bottom: 30,
            paddingHorizontal: 16,
            zIndex: 25,
          }}>
            {/* Avatar + nome + cargo */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              {autorFoto
                ? <Image source={{ uri: autorFoto }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff' }} contentFit="cover" />
                : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{(autorNome || 'U')[0]}</Text>
                  </View>}
              <View style={{ flex: 1 }}>
                <Text style={fsIcStyles.autorNome} numberOfLines={1}>{autorNome}</Text>
                {!!autorCargo && (
                  <Text style={fsIcStyles.autorCargo} numberOfLines={1}>{autorCargo}</Text>
                )}
              </View>
            </View>

            {/* ✅ Texto com ver mais / ver menos */}
            {!!textoPost && (
              <>
                <Text
                  numberOfLines={verMaisTexto ? undefined : 3}
                  style={fsIcStyles.textoPost}
                >
                  {textoPost}
                </Text>
                {textoPost.length > 120 && (
                  <TouchableOpacity onPress={() => setVerMaisTexto(v => !v)}>
                    <Text style={fsIcStyles.verMais}>
                      {verMaisTexto ? 'ver menos' : 'ver mais'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Contador páginas */}
          {n > 1 && (
            <View style={{ position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, zIndex: 20 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{fsIndice + 1} / {n}</Text>
            </View>
          )}
        </View>

        {/* ── Picker de reações ── */}
        <Modal visible={reacaoPickerVis} transparent animationType="fade" onRequestClose={fecharReacao}>
          <TouchableWithoutFeedback onPress={fecharReacao}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
              <Animated.View style={{
                flexDirection: 'row',
                backgroundColor: '#fff',
                borderRadius: 30,
                padding: 10,
                gap: 10,
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                transform: [
                  { scale: pickerAnim },
                  { translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                ],
              }}>
                {REACOES_EMOJIS.map(e => (
                  <TouchableOpacity key={e} onPress={() => escolherReacao(e)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#F8FAFC' }}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </Modal>
    </>
  );
}

// Estilos dos ícones fullscreen
const fsIcStyles = StyleSheet.create({
  sombra: {
    // textShadow não é suportado directamente em StyleSheet no RN,
    // mas Ionicons aceita style e renderiza via Text internamente
  },
  count: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  autorNome: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  autorCargo: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  textoPost: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  verMais: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    textDecorationLine: 'underline',
  },
});

// ── PostMediaCard ─────────────────────────────────────────────────────────────
function PostMediaCard({ post, acoes, onAbrirComentarios }) {
  const media = (post.mediaUrls || []).map(m =>
    typeof m === 'string'
      ? { url: m, type: m.match(/\.(mp4|mov|avi|mkv|webm)/i) ? 'video' : 'image' }
      : m
  ).filter(m => !!m?.url);
  if (media.length === 0) return null;
  const videos  = media.filter(m => m.type === 'video');
  const imagens = media.filter(m => m.type !== 'video');
  return (
    <View style={{ overflow: 'hidden' }}>
      {videos.map((v, i) => (
        <PostMedia key={`v-${i}`} mediaUrls={[v]}
          post={{ autorNome: post.autorNome, autorFoto: post.autorFoto, texto: post.texto }}
          acoes={acoes} onAbrirComentarios={onAbrirComentarios} />
      ))}
      {imagens.length > 0 && (
        <GridImagens imagens={imagens} post={post} acoes={acoes} onAbrirComentarios={onAbrirComentarios} />
      )}
    </View>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────
// NOTA: o badge de verificado já não é decidido pelo campo "autorVerificado"
// gravado no próprio post (esse campo é apenas uma cópia estática, feita no
// momento da publicação, e podia ficar desactualizada ou até ser forjada no
// cliente). Em vez disso, o PostCard recebe a prop "verificado", calculada
// ao vivo em FeedScreen a partir da colecção "users" (ver useContasVerificadas),
// que reflecte exactamente o que o painel admin marcou como verificado.
//
// NOVO — "aoVivoAgora": quando este post veio de "Partilhar no Feed" a
// partir de uma live (tem post.liveId) E essa live ainda consta na lista de
// lives activas (ver ouvirLivesAtivas em FeedScreen), o post deixa de se
// comportar como uma publicação normal: mostra um preview "AO VIVO" e o
// toque abre directamente /watch/[id] com os dados gravados no próprio
// post (liveChannelName, liveHostUidNumerico, liveCor). Assim que a live
// termina, aoVivoAgora passa a false automaticamente (o id sai da lista de
// activas) e o post volta a comportar-se como uma publicação normal.
const PostCard = React.memo(function PostCard({
  post, user, indice, verificado, aoVivoAgora,
  onLike, onLongLike, onComentar, onMenu, onPerfil, onVerReacoes, onAbrirLive,
}) {
  const router = useRouter();
  const jaDeuLike = post.likedBy?.includes(user?.uid);
  const cor = TIPO_CORES[post.tipo] || '#2563EB';
  const ehLiveAtiva = !!post.liveId && aoVivoAgora;

  const acoes = useMemo(() => ({
    liked:         jaDeuLike,
    likesCount:    post.likes || 0,
    commentsCount: post.comentarios || 0,
    onLike:        () => onLike(post),
    onReacao:      (emoji) => onLike(post, emoji),
    onShare:       () => {},
    onMore:        () => onMenu(post),
  }), [jaDeuLike, post.likes, post.comentarios, onLike, onMenu, post]);

  // Passa o uid do utilizador actual ao post para o GridImagens poder ler emojiActual
  const postComUid = useMemo(() => ({ ...post, meuUid: user?.uid }), [post, user?.uid]);

  return (
    <View style={styles.postCard}>
      {!!post.repostadoDe && (
        <TouchableOpacity
          style={styles.repostBanner}
          activeOpacity={0.7}
          onPress={() => router.push({
            pathname: '/(main)/saber',
            params: {
              clubeId: post.repostadoDe.clubeId,
              postId: post.repostadoDe.postId,
            },
          })}
        >
          <Ionicons name="repeat-outline" size={14} color="#059669" />
          <Text style={styles.repostBannerText} numberOfLines={1}>
            Repartilhado do Clube do Saber · {post.repostadoDe.clubeTitulo}
          </Text>
          {post.repostadoDe.autorFotoOriginal ? (
            <Image source={{ uri: post.repostadoDe.autorFotoOriginal }} style={styles.repostBannerAvatar} contentFit="cover" />
          ) : post.repostadoDe.autorNomeOriginal ? (
            <View style={styles.repostBannerAvatarFallback}>
              <Text style={styles.repostBannerAvatarFallbackText}>
                {post.repostadoDe.autorNomeOriginal[0]}
              </Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={14} color="#A0AEC0" />
        </TouchableOpacity>
      )}
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => onPerfil(post.uid, post.autorTipo)}>
          <View style={[styles.postAvatar, { backgroundColor: cor }]}>
            {typeof post.autorFoto === 'string' && post.autorFoto
              ? <Image source={{ uri: post.autorFoto }} style={styles.postAvatarImage} contentFit="cover" />
              : <Text style={styles.postAvatarText}>{(post.autorNome || 'U')[0]}</Text>}
          </View>
          {ehLiveAtiva && (
            <View style={styles.avatarLiveBadge}>
              <View style={styles.avatarLiveDot} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.postMeta}>
          <TouchableOpacity onPress={() => onPerfil(post.uid, post.autorTipo)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.postAutor}>{post.autorNome}</Text>
            {!!verificado && <BadgeVerificado size={14} />}
          </TouchableOpacity>
          <Text style={styles.postCargo} numberOfLines={1}>{post.autorCargo}</Text>
          <View style={styles.postMetaRow}>
            {!!post.autorCidade && (
              <><Ionicons name="location-sharp" size={10} color="#718096" /><Text style={styles.postMetaText}>{post.autorCidade}</Text><Text style={styles.postMetaDot}>•</Text></>
            )}
            <Text style={styles.postMetaText}>{tempoRelativo(post.timestamp)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.postMore} onPress={() => onMenu(post)}>
          <Ionicons name="ellipsis-horizontal-sharp" size={16} color="#718096" />
        </TouchableOpacity>
      </View>

      {/* ── Preview de live em curso ──
          Substitui o texto normal enquanto a live estiver activa. Ao
          terminar, esta secção desaparece e o texto volta a aparecer como
          publicação normal (ver bloco {!!post.texto && ...} mais abaixo). */}
      {ehLiveAtiva && (
        <TouchableOpacity
          style={styles.liveFeedCard}
          activeOpacity={0.9}
          onPress={() => onAbrirLive(post)}
        >
          <View style={styles.liveFeedTopo}>
            <View style={styles.liveFeedBadge}>
              <View style={styles.liveFeedDot} />
              <Text style={styles.liveFeedBadgeText}>AO VIVO</Text>
            </View>
          </View>
          {!!post.texto && (
            <Text style={styles.liveFeedTitulo} numberOfLines={2}>{post.texto}</Text>
          )}
          <View style={styles.liveFeedBtn}>
            <Ionicons name="play-circle" size={17} color="#fff" />
            <Text style={styles.liveFeedBtnTxt}>Assistir agora</Text>
          </View>
        </TouchableOpacity>
      )}

      {!ehLiveAtiva && !!post.texto && <Text style={styles.postTexto}>{post.texto}</Text>}
      {!!post.repostadoDe && !!post.repostTextoOriginal && post.texto !== post.repostTextoOriginal && (
        <View style={styles.repostConteudo}>
          <Text style={styles.repostConteudoLabel}>Publicação original</Text>
          <Text style={styles.repostConteudoTexto}>{post.repostTextoOriginal}</Text>
        </View>
      )}
      {!ehLiveAtiva && <PostMediaCard post={postComUid} acoes={acoes} onAbrirComentarios={() => onComentar(post)} />}
      <View style={styles.postStatsRow}>
        <TouchableOpacity style={styles.postStatsLeft} onPress={() => onVerReacoes(post.id)}>
          <View style={styles.emojiOverlapContainer}>
            {post.reacoesMap
              ? [...new Set(Object.values(post.reacoesMap))].slice(0, 3).map((emoji, idx) => (
                  <Text key={idx} style={[styles.overlapEmoji, { zIndex: 10 - idx, marginLeft: idx === 0 ? 0 : -8 }]}>{emoji}</Text>
                ))
              : <Ionicons name="heart-sharp" size={14} color="#EF4444" />}
          </View>
          <Text style={styles.postStatText}>{post.likes || 0} reações</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onComentar(post)}>
          <Text style={styles.postStatText}>{post.comentarios || 0} comentários</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postAction} onPress={() => onLike(post)} onLongPress={() => onLongLike(post)}>
          {post.reacoesMap?.[user?.uid] && post.reacoesMap[user?.uid] !== '❤️'
            ? <Text style={{ fontSize: 18 }}>{post.reacoesMap[user?.uid]}</Text>
            : <Ionicons name={jaDeuLike ? 'heart-sharp' : 'heart-outline'} size={18} color={jaDeuLike ? '#EF4444' : '#4A5568'} />}
          <Text style={[styles.postActionText, jaDeuLike && { color: '#EF4444', fontWeight: '700' }]}>
            {post.reacoesMap?.[user?.uid] && post.reacoesMap[user?.uid] !== '❤️' ? 'Reagiu' : 'Gosto'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postAction} onPress={() => onComentar(post)}>
          <Ionicons name="chatbubble-outline" size={18} color="#4A5568" />
          <Text style={styles.postActionText}>Comentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postAction}>
          <Ionicons name="paper-plane-outline" size={18} color="#4A5568" />
          <Text style={styles.postActionText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}, (prev, next) =>
  prev.post.id          === next.post.id          &&
  prev.post.likes       === next.post.likes       &&
  prev.post.comentarios === next.post.comentarios &&
  prev.post.reacoesMap  === next.post.reacoesMap  &&
  prev.post.mediaUrls   === next.post.mediaUrls   &&
  prev.post.repostadoDe  === next.post.repostadoDe  &&
  prev.verificado        === next.verificado        &&
  prev.aoVivoAgora       === next.aoVivoAgora       &&
  prev.indice           === next.indice           &&
  prev.user?.uid        === next.user?.uid
);

// ── Banner upload ─────────────────────────────────────────────────────────────
function BannerUpload({ estado, onFechar }) {
  if (!estado) return null;
  const { fase, progresso, tipo } = estado;
  const icone = tipo === 'video' ? 'play-circle-outline' : 'images-outline';
  const corFundo = fase === 'erro' ? '#FEF2F2' : '#EFF6FF';
  const corBarra = fase === 'erro' ? '#EF4444' : '#1677F2';
  let mensagem = '';
  if (fase === 'upload')     mensagem = 'Mantenha o aplicativo aberto até à conclusão do upload';
  if (fase === 'publicando') mensagem = 'A publicar...';
  if (fase === 'concluido')  mensagem = '✅ Publicação concluída!';
  if (fase === 'erro')       mensagem = 'Erro no upload. Tenta novamente.';
  return (
    <View style={{ backgroundColor: corFundo, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
      <Ionicons name={icone} size={22} color="#1677F2" />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 12, color: '#1A202C', fontWeight: '600' }}>{mensagem}</Text>
        {(fase === 'upload' || fase === 'publicando') && (
          <View style={{ height: 3, backgroundColor: '#DBEAFE', borderRadius: 2 }}>
            <View style={{ width: `${progresso}%`, height: 3, backgroundColor: corBarra, borderRadius: 2 }} />
          </View>
        )}
        {(fase === 'upload' || fase === 'publicando') && tipo === 'video' && (
          <Text style={{ fontSize: 11, color: '#718096' }}>{progresso}%</Text>
        )}
      </View>
      {(fase === 'concluido' || fase === 'erro') && (
        <TouchableOpacity onPress={onFechar}><Ionicons name="close" size={18} color="#718096" /></TouchableOpacity>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FEED SCREEN
// ════════════════════════════════════════════════════════════════════════════
export default function FeedScreen() {
  const router = useRouter();
  const upload = useUpload();
  const { user, perfil, carregando: authCarregando } = useUser();
  const { unreadCount } = useNotifications();
  const { unreadMessagesCount } = useUnreadMessages(user?.uid);
  // Conjunto de UIDs verificados pelo painel admin, actualizado em tempo real.
  const verificados = useContasVerificadas();

  const [posts,          setPosts]          = useState([]);
  const [stories,        setStories]        = useState([]);
  const [carregando,     setCarregando]     = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais,        setTemMais]        = useState(true);
  const ultimoDocRef = useRef(null);

  const [oportunidades, setOportunidades] = useState([]);

  // NOVO: ids de lives actualmente ao vivo (com heartbeat recente — ver
  // livesService.js). Usado só para decidir se um post partilhado a partir
  // de uma live (post.liveId) ainda deve mostrar o preview "AO VIVO" e
  // apontar para /watch/[id], ou se já deve comportar-se como uma
  // publicação normal (live terminada).
  const [idsLivesAtivas, setIdsLivesAtivas] = useState(() => new Set());

  const [menuPost,            setMenuPost]            = useState(null);
  const [reacaoPickerPost,    setReacaoPickerPost]    = useState(null);
  const [bloqueioAcaoVisivel, setBloqueioAcaoVisivel] = useState(false);
  const [modalComentarios,    setModalComentarios]    = useState(null);
  const [modalDenuncia,       setModalDenuncia]       = useState(null);
  const [motivoDenuncia,      setMotivoDenuncia]      = useState(null);
  const [detalheDenuncia,     setDetalheDenuncia]     = useState('');
  const [enviandoDenuncia,    setEnviandoDenuncia]    = useState(false);
  const [denunciaEnviada,     setDenunciaEnviada]     = useState(false);

  const pickerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reacaoPickerPost) {
      Animated.spring(pickerAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }).start();
    } else { pickerAnim.setValue(0); }
  }, [reacaoPickerPost]);

  const bloqueioAnonimo = useCallback(() => {
    if (!user?.isAnonymous) return false;
    setBloqueioAcaoVisivel(true); return true;
  }, [user]);

  // ── Feed principal: exclui posts do tipo "oportunidade" (vagas) ──
  // As vagas não aparecem como publicação normal no feed; vivem apenas no
  // carrossel "Oportunidades de Carreira" e na área de Vagas (events.jsx).
  const filtrarNaoVagas = useCallback((docs) =>
    docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.tipo !== 'oportunidade')
  , []);

  const carregarPrimeiraPagina = useCallback(async (silencioso = false) => {
    if (!user) return;
    if (!silencioso) setCarregando(true);
    try {
      const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      if (snap.empty) { setTemMais(false); setCarregando(false); setRefreshing(false); return; }
      ultimoDocRef.current = snap.docs[snap.docs.length - 1];
      setTemMais(snap.docs.length === PAGE_SIZE);
      setPosts(filtrarNaoVagas(snap.docs));
    } catch (err) { console.log('Erro feed:', err); }
    finally { setCarregando(false); setRefreshing(false); }
  }, [user, filtrarNaoVagas]);

  const onRefresh = useCallback(() => { setRefreshing(true); carregarPrimeiraPagina(true); }, [carregarPrimeiraPagina]);

  const carregarMais = useCallback(async () => {
    if (!user || carregandoMais || !temMais || !ultimoDocRef.current) return;
    setCarregandoMais(true);
    try {
      const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), startAfter(ultimoDocRef.current), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      if (snap.empty) { setTemMais(false); return; }
      ultimoDocRef.current = snap.docs[snap.docs.length - 1];
      setTemMais(snap.docs.length === PAGE_SIZE);
      const novos = filtrarNaoVagas(snap.docs);
      setPosts(prev => {
        const existentes = new Set(prev.map(p => p.id));
        return [...prev, ...novos.filter(p => !existentes.has(p.id))];
      });
    } catch (err) { console.log('Erro carregarMais:', err); }
    finally { setCarregandoMais(false); }
  }, [user, carregandoMais, temMais, filtrarNaoVagas]);

  useEffect(() => { if (!authCarregando && !user) setCarregando(false); }, [authCarregando, user]);

  useFocusEffect(useCallback(() => {
    if (user && !authCarregando) carregarPrimeiraPagina();
  }, [user, authCarregando]));

  const estadoAnterior = useRef(null);
  useEffect(() => {
    const estadoAtual = upload.estado?.fase;
    if (estadoAnterior.current === 'publicando' && estadoAtual === 'concluido') {
      setTimeout(() => carregarPrimeiraPagina(true), 1000);
    }
    estadoAnterior.current = estadoAtual;
  }, [upload.estado?.fase]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'stories'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const agora = new Date(); const agrupados = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const expira = data.expiraEm?.toDate ? data.expiraEm.toDate() : new Date(data.expiraEm);
        if (expira > agora) {
          if (!agrupados[data.uid]) agrupados[data.uid] = { uid: data.uid, autorNome: data.autorNome, autorFoto: data.autorFoto, previewFoto: data.fotoUri || data.autorFoto || null, visto: (data.vistoPor || []).includes(user.uid), totalStories: 1 };
          else { agrupados[data.uid].totalStories += 1; if (!(data.vistoPor || []).includes(user.uid)) agrupados[data.uid].visto = false; }
        }
      });
      setStories(Object.values(agrupados));
    });
    return unsub;
  }, [user]);

  // Oportunidades de Carreira: publicações (de qualquer conta — utilizador,
  // recrutador ou empresa) criadas em "Nova publicação" com o tipo "Oportunidade".
  // É a mesma fonte de dados usada na área de Vagas (events.jsx).
  // Inclui autorFoto/autorNome do recrutador para mostrar o avatar em vez de um ícone genérico.
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'posts'),
      where('tipo', '==', 'oportunidade'),
      orderBy('timestamp', 'desc'),
      limit(8)
    );
    const unsub = onSnapshot(q, snap => {
      setOportunidades(snap.docs.map(d => {
        const data = d.data();
        return {
          id:         d.id,
          titulo:     (data.texto || 'Oportunidade').split('\n')[0].slice(0, 70),
          empresa:    data.autorNome || 'ConnectAll',
          local:      data.autorCidade || 'Angola',
          tipo:       'Vaga',
          cor:        '#059669',
          visto:      tempoRelativoVaga(data.timestamp),
          autorFoto:  data.autorFoto || null,
          autorNome:  data.autorNome || 'ConnectAll',
        };
      }));
    }, err => console.log('Erro oportunidades:', err));
    return unsub;
  }, [user]);

  // NOVO: mantém a lista de ids de lives ao vivo agora — é o que decide se
  // um post partilhado a partir de uma live ainda mostra o preview "AO
  // VIVO" ou se já volta a ser uma publicação normal.
  useEffect(() => {
    if (!user) return;
    const unsub = ouvirLivesAtivas((lista) => {
      setIdsLivesAtivas(new Set(lista.map((l) => l.id)));
    });
    return unsub;
  }, [user]);

  const handleReacao = useCallback(async (post, emoji) => {
    if (bloqueioAnonimo()) return;
    if (!user) return;
    const postRef = doc(db, 'posts', post.id);
    const reacaoRef = doc(db, 'posts', post.id, 'reacoes', user.uid);
    const emojiAntigo = post.reacoesMap?.[user.uid];
    const jaReagiu = post.likedBy?.includes(user.uid);
    setReacaoPickerPost(null);
    try {
      if (emojiAntigo === emoji) {
        await updateDoc(postRef, { likes: increment(-1), likedBy: arrayRemove(user.uid), [`reacoesMap.${user.uid}`]: deleteField() });
        await deleteDoc(reacaoRef);
      } else {
        const updates = { [`reacoesMap.${user.uid}`]: emoji };
        if (!jaReagiu) { updates.likes = increment(1); updates.likedBy = arrayUnion(user.uid); }
        await updateDoc(postRef, updates);
        await setDoc(reacaoRef, { uid: user.uid, nome: perfil?.nome || 'Utilizador', foto: perfil?.fotoURL || null, emoji, timestamp: serverTimestamp() });
        if (!jaReagiu && post.uid !== user.uid) await enviarNotificacao(post.uid, user.uid, 'reacao', `${perfil?.nome || 'Alguém'} reagiu: ${emoji}`, perfil?.fotoURL || null, post.id);
      }
      setPosts(prev => prev.map(p => {
        if (p.id !== post.id) return p;
        const novoMapa = { ...(p.reacoesMap || {}) };
        if (emojiAntigo === emoji) { delete novoMapa[user.uid]; return { ...p, likes: (p.likes || 1) - 1, likedBy: (p.likedBy || []).filter(id => id !== user.uid), reacoesMap: novoMapa }; }
        else { novoMapa[user.uid] = emoji; return { ...p, likes: jaReagiu ? (p.likes || 0) : (p.likes || 0) + 1, likedBy: jaReagiu ? p.likedBy : [...(p.likedBy || []), user.uid], reacoesMap: novoMapa }; }
      }));
    } catch (err) { console.log('Erro reacao:', err); }
  }, [user, perfil, bloqueioAnonimo]);

  const handleLike        = useCallback((post, emoji) => handleReacao(post, emoji || '❤️'), [handleReacao]);
  const abrirReacaoPicker = useCallback((post) => setReacaoPickerPost(post), []);
  const abrirComentarios  = useCallback((post) => { if (bloqueioAnonimo()) return; setModalComentarios({ postId: post.id, post }); }, [bloqueioAnonimo]);
  const abrirMenu         = useCallback((post) => { if (bloqueioAnonimo()) return; setMenuPost(post); }, [bloqueioAnonimo]);

  const eliminarPost = useCallback(async (post) => {
    setMenuPost(null);
    Alert.alert('Eliminar publicação', 'Tens a certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteDoc(doc(db, 'posts', post.id)); setPosts(prev => prev.filter(p => p.id !== post.id)); }
        catch { Alert.alert('Erro', 'Não foi possível eliminar.'); }
      }},
    ]);
  }, []);

  const abrirDenuncia = useCallback((post) => {
    setMenuPost(null); setMotivoDenuncia(null); setDetalheDenuncia(''); setDenunciaEnviada(false); setModalDenuncia({ post });
  }, []);

  const submeterDenuncia = useCallback(async () => {
    if (!motivoDenuncia || !modalDenuncia || !user) return;
    setEnviandoDenuncia(true);
    try {
      const post = modalDenuncia.post;
      const q = query(collection(db, 'reports'), where('conteudoId', '==', post.id), where('denunciadoPor', '==', user.uid));
      const existente = await getDocs(q);
      if (!existente.empty) { setEnviandoDenuncia(false); setModalDenuncia(null); Alert.alert('Já denunciaste', 'Já enviaste uma denúncia anteriormente.'); return; }
      await addDoc(collection(db, 'reports'), { conteudoId: post.id, conteudoTexto: post.texto || '', tipo: 'post', motivo: motivoDenuncia, detalhe: detalheDenuncia.trim(), denunciadoPor: user.uid, denunciadoPorNome: perfil?.nome || 'Utilizador', autorDoConteudo: post.uid, autorNome: post.autorNome || '', status: 'pendente', timestamp: serverTimestamp() });
      await updateDoc(doc(db, 'posts', post.id), { denuncias: increment(1) });
      setDenunciaEnviada(true);
      setTimeout(() => { setModalDenuncia(null); setDenunciaEnviada(false); }, 2200);
    } catch { Alert.alert('Erro', 'Não foi possível enviar a denúncia.'); }
    finally { setEnviandoDenuncia(false); }
  }, [motivoDenuncia, modalDenuncia, user, perfil, detalheDenuncia]);

  const guardarPost  = useCallback((post) => { setMenuPost(null); Alert.alert('Guardado', 'Publicação guardada.'); }, []);
  const naoInteressa = useCallback((post) => { setMenuPost(null); setPosts(prev => prev.filter(p => p.id !== post.id)); }, []);
  const irParaPerfil = useCallback((uid, autorTipo) => {
    if (bloqueioAnonimo()) return;
    if (autorTipo === 'empresa') {
      router.push({ pathname: '/(main)/perfil-publicoempresa', params: { uid } });
      return;
    }
    router.push({ pathname: '/(main)/perfil-publico', params: { uid } });
  }, [bloqueioAnonimo, router]);
  const verReacoes   = useCallback((postId) => { router.push({ pathname: '/(main)/ReacoesModal', params: { postId } }); }, [router]);

  // NOVO: abre a live a partir do preview no Feed, com os mesmos parâmetros
  // usados em live.jsx (assistir), lidos directamente do post partilhado.
  const abrirLiveDoPost = useCallback((post) => {
    if (bloqueioAnonimo()) return;
    if (!post?.liveId) return;
    router.push({
      pathname: '/watch/[id]',
      params: {
        id: post.liveId,
        channelName: post.liveChannelName,
        titulo: post.texto || 'Ao vivo',
        hostNome: post.autorNome,
        hostUidNumerico: post.liveHostUidNumerico != null ? String(post.liveHostUidNumerico) : undefined,
        cor: post.liveCor || '#0A66C2',
      },
    });
  }, [bloqueioAnonimo, router]);

  // ✅ FIX: só é anónimo se isAnonymous vier explicitamente "true".
  // Antes: `user?.isAnonymous ?? true` fazia com que QUALQUER conta normal
  // (onde isAnonymous não vinha definido no objecto do useUser()) fosse
  // tratada como anónima — o que escondia as bolinhas de mensagens e
  // de notificações mesmo havendo mensagens por ler.
  const isAnonymous = user?.isAnonymous === true;
  const fotoURL     = perfil?.fotoURL ?? null;

  const ListFooter = useMemo(() => {
    if (carregandoMais) return (<View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color="#0A66C2" /><Text style={{ fontSize: 12, color: '#718096', marginTop: 6 }}>A carregar mais publicações...</Text></View>);
    if (!temMais && posts.length > 0) return (<View style={styles.proFooter}><Text style={styles.proFooterText}>Para veres mais conteúdos, adquire o plano Pro.</Text><TouchableOpacity style={styles.proBtnSecondary} activeOpacity={0.8} onPress={() => router.push('/(main)/planos')}><Text style={styles.proBtnSecundaryTxt}>Ver Planos</Text></TouchableOpacity></View>);
    return <View style={{ height: 30 }} />;
  }, [carregandoMais, temMais, posts.length]);

  const ListHeader = useMemo(() => (
    <>
      <View style={styles.publishCard}>
        <View style={styles.publishTop}>
          <View style={styles.publishAvatar}>
            {!isAnonymous && fotoURL ? <Image source={{ uri: fotoURL }} style={styles.publishAvatarImage} contentFit="cover" /> : <Ionicons name="person-sharp" size={16} color="#fff" />}
          </View>
          <TouchableOpacity style={styles.publishInput} activeOpacity={0.8} onPress={() => {
            if (bloqueioAnonimo()) return;
            router.push('/(main)/create-post');
          }}>
            <Text style={styles.publishPlaceholder}>Partilhe uma conquista, ideia ou oportunidade...</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.publishActions}>
          <TouchableOpacity style={styles.publishAction} onPress={() => {
            if (bloqueioAnonimo()) return;
            router.push('/(main)/create-post');
          }}><Ionicons name="image-outline" size={16} color="#2563EB" /><Text style={styles.publishActionText}>Foto</Text></TouchableOpacity>
          <TouchableOpacity style={styles.publishAction} onPress={() => {
            if (bloqueioAnonimo()) return;
            router.push('/(main)/create-post');
          }}><Ionicons name="briefcase-outline" size={16} color="#059669" /><Text style={styles.publishActionText}>Vaga</Text></TouchableOpacity>
          <TouchableOpacity style={styles.publishAction} onPress={() => {
            if (bloqueioAnonimo()) return;
            router.push('/(main)/create-post');
          }}><Ionicons name="document-text-outline" size={16} color="#7C3AED" /><Text style={styles.publishActionText}>Artigo</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Ligações em Destaque</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 4 }}>
          <TouchableOpacity style={styles.storyItem} activeOpacity={0.8} onPress={() => {
            if (bloqueioAnonimo()) return;
            router.push('/(main)/create-story');
          }}>
            <View style={styles.storyCreateRing}>
              {!isAnonymous && fotoURL ? <Image source={{ uri: fotoURL }} style={styles.storyCreateImage} contentFit="cover" /> : <Ionicons name="person-sharp" size={20} color="#A0AEC0" />}
              <View style={styles.storyPlus}><Ionicons name="add-sharp" size={12} color="#fff" /></View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>Seu Destaque</Text>
          </TouchableOpacity>
          {stories.map(story => (
            <TouchableOpacity key={story.uid} style={styles.storyItem} activeOpacity={0.8} onPress={() => router.push({ pathname: '/(main)/ver-story', params: { uid: story.uid } })}>
              <View style={[styles.storyRing, story.visto && styles.storyRingVisto]}>
                <View style={styles.storyPreviewWrap}>
                  {story.previewFoto ? <Image source={{ uri: story.previewFoto }} style={styles.storyPreviewImg} contentFit="cover" /> : <View style={[styles.storyInner, { backgroundColor: '#1677F2' }]}><Text style={styles.storyInitial}>{(story.autorNome || 'U')[0]}</Text></View>}
                </View>
              </View>
              <Text style={styles.storyName} numberOfLines={1}>{story.autorNome?.split(' ')[0] || 'Utilizador'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Oportunidades de Carreira</Text>
          <TouchableOpacity onPress={() => {
            if (bloqueioAnonimo()) return;
            router.push('/(main)/events');
          }}>
            <Text style={styles.sectionLink}>Ver todas</Text>
          </TouchableOpacity>
        </View>
        {oportunidades.length === 0 ? (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={styles.emptySubText}>Ainda sem oportunidades publicadas.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {oportunidades.map(op => (
              <TouchableOpacity
                key={op.id}
                style={styles.opCard}
                activeOpacity={0.9}
                onPress={() => {
                  if (bloqueioAnonimo()) return;
                  router.push({ pathname: '/(main)/events', params: { postId: op.id } });
                }}
              >
                <View style={styles.opHeaderRow}>
                  {/* ── Avatar do recrutador/empresa em vez do ícone de pasta ── */}
                  <View style={styles.opAvatar}>
                    {op.autorFoto
                      ? <Image source={{ uri: op.autorFoto }} style={styles.opAvatarImage} contentFit="cover" />
                      : <Text style={styles.opAvatarText}>{(op.autorNome || 'U')[0]}</Text>}
                  </View>
                  <View style={[styles.opTipo, { backgroundColor: op.cor + '15' }]}>
                    <Text style={[styles.opTipoText, { color: op.cor }]}>{op.tipo}</Text>
                  </View>
                </View>
                <Text style={styles.opTitulo} numberOfLines={1}>{op.titulo}</Text>
                <Text style={styles.opEmpresa}>{op.empresa}</Text>
                <View style={styles.opMeta}><Ionicons name="location-sharp" size={12} color="#718096" /><Text style={styles.opMetaText}>{op.local} · {op.visto}</Text></View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Publicações</Text></View>
        {(carregando || authCarregando) && <ActivityIndicator color="#111111" style={{ marginTop: 30 }} />}
        {!carregando && !authCarregando && posts.length === 0 && (
          <View style={styles.emptyWrap}><Ionicons name="copy-outline" size={32} color="#A0AEC0" /><Text style={styles.emptyText}>Sem atividade recente.</Text><Text style={styles.emptySubText}>Comece uma conversa partilhando uma atualização.</Text></View>
        )}
      </View>
    </>
  ), [stories, oportunidades, carregando, authCarregando, posts.length, fotoURL, isAnonymous]);

  const renderItem = useCallback(({ item: post, index }) => (
    <PostCard
      post={post} user={user} indice={index}
      verificado={verificados.has(post.uid)}
      aoVivoAgora={!!post.liveId && idsLivesAtivas.has(post.liveId)}
      onLike={handleLike} onLongLike={abrirReacaoPicker} onComentar={abrirComentarios}
      onMenu={abrirMenu} onPerfil={irParaPerfil} onVerReacoes={verReacoes}
      onAbrirLive={abrirLiveDoPost}
    />
  ), [user, verificados, idsLivesAtivas, handleLike, abrirReacaoPicker, abrirComentarios, abrirMenu, irParaPerfil, verReacoes, abrirLiveDoPost]);

  return (
    <SafeAreaView style={styles.safe}>
      <BloqueioAnonimo visivel={bloqueioAcaoVisivel} tipo="acao" onFechar={() => setBloqueioAcaoVisivel(false)} />

      <Modal visible={menuPost !== null} transparent animationType="fade" onRequestClose={() => setMenuPost(null)}>
        <TouchableWithoutFeedback onPress={() => setMenuPost(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuSheet}>
                <View style={styles.menuHeader}>
                  <View style={[styles.menuAvatar, { backgroundColor: TIPO_CORES[menuPost?.tipo] || '#2563EB' }]}>
                    {typeof menuPost?.autorFoto === 'string' && menuPost?.autorFoto ? <Image source={{ uri: menuPost.autorFoto }} style={styles.menuAvatarImg} contentFit="cover" /> : <Text style={styles.menuAvatarText}>{(menuPost?.autorNome || 'U')[0]}</Text>}
                  </View>
                  <View style={{ flex: 1 }}><Text style={styles.menuAutorNome}>{menuPost?.autorNome}</Text><Text style={styles.menuPostTexto} numberOfLines={1}>{menuPost?.texto}</Text></View>
                </View>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => guardarPost(menuPost)}><View style={styles.menuItemIcon}><Ionicons name="bookmark-outline" size={22} color="#2563EB" /></View><View><Text style={styles.menuItemTitle}>Guardar publicação</Text><Text style={styles.menuItemSub}>Adiciona aos guardados no teu perfil</Text></View></TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => naoInteressa(menuPost)}><View style={styles.menuItemIcon}><Ionicons name="eye-off-outline" size={22} color="#4A5568" /></View><View><Text style={styles.menuItemTitle}>Não me interessa</Text><Text style={styles.menuItemSub}>Vê menos publicações deste tipo</Text></View></TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => setMenuPost(null)}><View style={styles.menuItemIcon}><Ionicons name="link-outline" size={22} color="#4A5568" /></View><View><Text style={styles.menuItemTitle}>Copiar link</Text><Text style={styles.menuItemSub}>Copia o link desta publicação</Text></View></TouchableOpacity>
                {menuPost?.uid === user?.uid && (<TouchableOpacity style={styles.menuItem} onPress={() => eliminarPost(menuPost)}><View style={[styles.menuItemIcon, { backgroundColor: '#FEF2F2' }]}><Ionicons name="trash-outline" size={22} color="#EF4444" /></View><View><Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Eliminar publicação</Text><Text style={styles.menuItemSub}>Remove permanentemente</Text></View></TouchableOpacity>)}
                {menuPost?.uid !== user?.uid && (<TouchableOpacity style={styles.menuItem} onPress={() => abrirDenuncia(menuPost)}><View style={[styles.menuItemIcon, { backgroundColor: '#FEF2F2' }]}><Ionicons name="flag-outline" size={22} color="#EF4444" /></View><View><Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Denunciar publicação</Text><Text style={styles.menuItemSub}>Reporta conteúdo inapropriado</Text></View></TouchableOpacity>)}
                <TouchableOpacity style={styles.menuCancelar} onPress={() => setMenuPost(null)}><Text style={styles.menuCancelarText}>Cancelar</Text></TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={reacaoPickerPost !== null} transparent animationType="fade" onRequestClose={() => setReacaoPickerPost(null)}>
        <TouchableWithoutFeedback onPress={() => setReacaoPickerPost(null)}>
          <View style={styles.modalOverlayReacao}>
            <Animated.View style={[styles.pickerContainer, { transform: [{ scale: pickerAnim }, { translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
              {REACOES_EMOJIS.map(e => (<TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => handleReacao(reacaoPickerPost, e)}><Text style={styles.emojiText}>{e}</Text></TouchableOpacity>))}
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={modalDenuncia !== null} transparent animationType="slide" onRequestClose={() => !enviandoDenuncia && setModalDenuncia(null)}>
        <TouchableWithoutFeedback onPress={() => !enviandoDenuncia && setModalDenuncia(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.denunciaSheet}>
                <View style={styles.denunciaHandle} />
                <View style={styles.denunciaHeader}>
                  <View style={styles.denunciaHeaderIcon}><Ionicons name="flag" size={20} color="#EF4444" /></View>
                  <View style={{ flex: 1 }}><Text style={styles.denunciaTitulo}>Denunciar publicação</Text><Text style={styles.denunciaSubtitulo}>Porque estás a denunciar este conteúdo?</Text></View>
                  {!denunciaEnviada && (<TouchableOpacity style={styles.denunciaFechar} onPress={() => !enviandoDenuncia && setModalDenuncia(null)} disabled={enviandoDenuncia}><Ionicons name="close" size={18} color="#4A5568" /></TouchableOpacity>)}
                </View>
                {denunciaEnviada ? (
                  <View style={styles.denunciaSucesso}><View style={styles.denunciaSucessoIconWrap}><Ionicons name="checkmark-circle-sharp" size={56} color="#059669" /></View><Text style={styles.denunciaSucessoTxt}>Denúncia enviada!</Text><Text style={styles.denunciaSucessoSub}>A nossa equipa irá analisar em breve.{'\n'}Obrigado por ajudares a manter a comunidade segura.</Text></View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    {modalDenuncia?.post?.texto ? (<View style={styles.denunciaPostPreview}><View style={styles.denunciaPostPreviewAvatar}>{modalDenuncia.post.autorFoto ? <Image source={{ uri: modalDenuncia.post.autorFoto }} style={styles.denunciaPostPreviewAvatarImg} contentFit="cover" /> : <Text style={styles.denunciaPostPreviewAvatarTxt}>{(modalDenuncia.post.autorNome || 'U')[0]}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.denunciaPostPreviewNome} numberOfLines={1}>{modalDenuncia.post.autorNome}</Text><Text style={styles.denunciaPostPreviewTexto} numberOfLines={2}>{modalDenuncia.post.texto}</Text></View></View>) : null}
                    <View style={styles.denunciaMotivos}>
                      <Text style={styles.denunciaSecaoLabel}>Selecciona um motivo</Text>
                      {MOTIVOS_DENUNCIA.map(m => (<TouchableOpacity key={m.id} style={[styles.denunciaMotivo, motivoDenuncia === m.id && styles.denunciaMotivoActivo]} onPress={() => setMotivoDenuncia(m.id)} activeOpacity={0.7}><View style={[styles.denunciaMotivoIconWrap, motivoDenuncia === m.id && styles.denunciaMotivoIconWrapActivo]}><Ionicons name={m.icon} size={18} color={motivoDenuncia === m.id ? '#DC2626' : '#718096'} /></View><Text style={[styles.denunciaMotivoTxt, motivoDenuncia === m.id && styles.denunciaMotivoTxtActivo]}>{m.label}</Text><View style={[styles.denunciaCheck, motivoDenuncia === m.id && styles.denunciaCheckActivo]}>{motivoDenuncia === m.id && <Ionicons name="checkmark-sharp" size={11} color="#fff" />}</View></TouchableOpacity>))}
                    </View>
                    {motivoDenuncia === 'violencia' && (<View style={styles.denunciaAviso}><Ionicons name="warning" size={16} color="#B45309" /><Text style={styles.denunciaAvisoTxt}>Se existe perigo imediato, contacta as autoridades (113 / 112).</Text></View>)}
                    {motivoDenuncia && (<View style={styles.denunciaDetalheWrap}><Text style={styles.denunciaDetalheLabel}>Detalhes adicionais <Text style={{ color: '#A0AEC0', fontWeight: '400' }}>(opcional)</Text></Text><TextInput style={styles.denunciaDetalheInput} placeholder="Descreve melhor a situação…" placeholderTextColor="#A0AEC0" multiline numberOfLines={3} value={detalheDenuncia} onChangeText={setDetalheDenuncia} maxLength={500} textAlignVertical="top" /><Text style={styles.denunciaCharCount}>{detalheDenuncia.length}/500</Text></View>)}
                    <View style={styles.denunciaBtns}><TouchableOpacity style={styles.denunciaBtnCancelar} onPress={() => setModalDenuncia(null)} disabled={enviandoDenuncia}><Text style={styles.denunciaBtnCancelarTxt}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={[styles.denunciaBtnEnviar, (!motivoDenuncia || enviandoDenuncia) && styles.denunciaBtnDisabled]} onPress={submeterDenuncia} disabled={!motivoDenuncia || enviandoDenuncia}>{enviandoDenuncia ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="flag-sharp" size={15} color="#fff" /><Text style={styles.denunciaBtnEnviarTxt}>Enviar denúncia</Text></>}</TouchableOpacity></View>
                    <View style={styles.denunciaPrivacidadeRow}><Ionicons name="lock-closed-outline" size={12} color="#A0AEC0" /><Text style={styles.denunciaPrivacidade}>A denúncia é confidencial.</Text></View>
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoNome}><Text style={styles.logoConnect}>Connect</Text><Text style={styles.logoAll}>All</Text></Text>
          <Image source={require('../../../assets/logo2.png')} style={styles.logoImg} contentFit="contain" />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(main)/explore')}><Ionicons name="search-sharp" size={19} color="#111111" /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { if (bloqueioAnonimo()) return; router.push('/(main)/chat'); }}><Ionicons name="chatbubble-ellipses-outline" size={19} color="#111111" />{!isAnonymous && unreadMessagesCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}</Text></View>}</TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { if (bloqueioAnonimo()) return; router.push('/(main)/notifications'); }}><Ionicons name="notifications-outline" size={19} color="#111111" />{!isAnonymous && unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}</TouchableOpacity>
        </View>
      </View>

      <BannerUpload estado={upload.estado} onFechar={upload.limpar} />

      <FlatList
        data={posts} keyExtractor={item => item.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }} ListHeaderComponent={ListHeader}
        renderItem={renderItem} ListFooterComponent={ListFooter}
        onEndReached={carregarMais} onEndReachedThreshold={0.4}
        removeClippedSubviews maxToRenderPerBatch={3} windowSize={4}
        initialNumToRender={3} updateCellsBatchingPeriod={80}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1677F2']} tintColor="#1677F2" />}
      />

      <PostComentariosModal visivel={!!modalComentarios} postId={modalComentarios?.postId} post={modalComentarios?.post} onFechar={() => setModalComentarios(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoNome: { fontSize: 22, fontWeight: '800' },
  logoConnect: { color: '#1A202C' },
  logoAll: { color: '#CC0000' },
  logoImg: { width: 32, height: 32 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { fontSize: 8, color: '#fff', fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayReacao: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  menuSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 32 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  menuAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  menuAvatarImg: { width: 40, height: 40, borderRadius: 12 },
  menuAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  menuAutorNome: { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  menuPostTexto: { fontSize: 12, color: '#718096', marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  menuItemIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  menuItemTitle: { fontSize: 15, fontWeight: '600', color: '#1A202C' },
  menuItemSub: { fontSize: 12, color: '#718096', marginTop: 2 },
  menuCancelar: { marginHorizontal: 20, marginTop: 8, paddingVertical: 14, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' },
  menuCancelarText: { fontSize: 15, fontWeight: '700', color: '#4A5568' },
  pickerContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 30, padding: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, gap: 10 },
  emojiBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#F8FAFC' },
  emojiText: { fontSize: 24 },
  emojiOverlapContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  overlapEmoji: { fontSize: 14, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#fff' },
  denunciaSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, maxHeight: '92%' },
  denunciaHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  denunciaHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  denunciaHeaderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  denunciaTitulo: { fontSize: 16, fontWeight: '700', color: '#1A202C' },
  denunciaSubtitulo: { fontSize: 12, color: '#718096', marginTop: 2 },
  denunciaFechar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  denunciaPostPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  denunciaPostPreviewAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#CBD5E0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  denunciaPostPreviewAvatarImg: { width: 36, height: 36, borderRadius: 10 },
  denunciaPostPreviewAvatarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  denunciaPostPreviewNome: { fontSize: 13, fontWeight: '600', color: '#1A202C' },
  denunciaPostPreviewTexto: { fontSize: 12, color: '#718096', marginTop: 2, lineHeight: 16 },
  denunciaMotivos: { paddingHorizontal: 16, paddingTop: 14, gap: 7 },
  denunciaSecaoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#A0AEC0', marginBottom: 4 },
  denunciaMotivo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  denunciaMotivoActivo: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  denunciaMotivoIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  denunciaMotivoIconWrapActivo: { backgroundColor: '#FEE2E2' },
  denunciaMotivoTxt: { flex: 1, fontSize: 13, color: '#2D3748', fontWeight: '500' },
  denunciaMotivoTxtActivo: { color: '#DC2626', fontWeight: '600' },
  denunciaCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  denunciaCheckActivo: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  denunciaAviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginTop: 10, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 1, borderColor: '#FCD34D' },
  denunciaAvisoTxt: { flex: 1, fontSize: 12, color: '#B45309', lineHeight: 18 },
  denunciaDetalheWrap: { paddingHorizontal: 16, marginTop: 14 },
  denunciaDetalheLabel: { fontSize: 12, fontWeight: '600', color: '#4A5568', marginBottom: 6 },
  denunciaDetalheInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 13, color: '#2D3748', minHeight: 80 },
  denunciaCharCount: { fontSize: 11, color: '#A0AEC0', textAlign: 'right', marginTop: 4 },
  denunciaBtns: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 18 },
  denunciaBtnCancelar: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  denunciaBtnCancelarTxt: { fontSize: 14, fontWeight: '600', color: '#4A5568' },
  denunciaBtnEnviar: { flex: 2, flexDirection: 'row', gap: 6, padding: 13, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  denunciaBtnEnviarTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  denunciaBtnDisabled: { opacity: 0.4 },
  denunciaPrivacidadeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14, paddingHorizontal: 20 },
  denunciaPrivacidade: { fontSize: 11, color: '#A0AEC0', textAlign: 'center' },
  denunciaSucesso: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 30, gap: 10 },
  denunciaSucessoIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  denunciaSucessoTxt: { fontSize: 20, fontWeight: '800', color: '#059669' },
  denunciaSucessoSub: { fontSize: 13, color: '#718096', textAlign: 'center', lineHeight: 20 },
  publishCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, gap: 14 },
  publishTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  publishAvatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1A365D', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  publishAvatarImage: { width: 36, height: 36, borderRadius: 12 },
  publishInput: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  publishPlaceholder: { fontSize: 13, color: '#718096', fontWeight: '400' },
  publishActions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  publishAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8 },
  publishActionText: { fontSize: 13, fontWeight: '600', color: '#4A5568' },
  section: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A202C', letterSpacing: -0.3 },
  sectionLink: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  storyItem: { alignItems: 'center', gap: 8, width: 68 },
  storyRing: { padding: 2, borderRadius: 22, borderWidth: 2, borderColor: '#1677F2' },
  storyRingVisto: { borderColor: '#CBD5E1' },
  storyPreviewWrap: { width: 52, height: 52, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  storyPreviewImg: { width: 52, height: 52, borderRadius: 18 },
  storyInner: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  storyInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  storyCreateRing: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed' },
  storyCreateImage: { width: 58, height: 58, borderRadius: 20 },
  storyPlus: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 6, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  storyName: { fontSize: 11, color: '#4A5568', fontWeight: '500', textAlign: 'center' },
  opCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: 210, gap: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  opHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  // ── Avatar do recrutador no carrossel (substitui o ícone de pasta) ──
  opAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  opAvatarImage: { width: 32, height: 32, borderRadius: 16 },
  opAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  opTitulo: { fontSize: 14, fontWeight: '700', color: '#1A202C', lineHeight: 18, marginTop: 4 },
  opEmpresa: { fontSize: 12, color: '#4A5568', fontWeight: '500' },
  opMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  opMetaText: { fontSize: 11, color: '#718096' },
  opTipo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  opTipoText: { fontSize: 10, fontWeight: '700', letterSpacing: -0.1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8, marginHorizontal: 20 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#4A5568' },
  emptySubText: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  postCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  repostBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  repostBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#059669' },
  repostBannerAvatar: { width: 18, height: 18, borderRadius: 9 },
  repostBannerAvatarFallback: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  repostBannerAvatarFallbackText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  repostConteudo: { marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  repostConteudoLabel: { fontSize: 11, fontWeight: '700', color: '#059669', marginBottom: 4 },
  repostConteudoTexto: { fontSize: 13, color: '#4A5568', lineHeight: 19 },
  postHeader: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' },
  postAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  postAvatarImage: { width: 40, height: 40, borderRadius: 14 },
  postAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // ── Badge "AO VIVO" no avatar, quando o post é uma live em curso ──
  avatarLiveBadge: {
    position: 'absolute', bottom: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  avatarLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E00000' },
  postMeta: { flex: 1, gap: 1 },
  postAutor: { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  postCargo: { fontSize: 12, color: '#4A5568', fontWeight: '400' },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  postMetaText: { fontSize: 11, color: '#718096' },
  postMetaDot: { fontSize: 11, color: '#718096' },
  postMore: { padding: 4, alignSelf: 'flex-start' },
  postTexto: { fontSize: 14, color: '#2D3748', lineHeight: 22, paddingHorizontal: 16, paddingBottom: 12 },
  // ── Preview de live em curso, dentro do PostCard ──
  liveFeedCard: {
    marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12,
    backgroundColor: '#004182', gap: 10,
  },
  liveFeedTopo: { flexDirection: 'row', alignItems: 'center' },
  liveFeedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E00000', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  liveFeedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveFeedBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  liveFeedTitulo: { fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20 },
  liveFeedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 18, paddingVertical: 10,
  },
  liveFeedBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  postStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  postStatsLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postStatText: { fontSize: 12, color: '#718096', fontWeight: '500' },
  postActions: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6 },
  postAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  postActionText: { fontSize: 12, fontWeight: '600', color: '#4A5568' },
  proFooter: { paddingVertical: 28, paddingHorizontal: 16, gap: 12 },
  proFooterText: { fontSize: 13, color: '#718096', textAlign: 'center' },
  proBtnSecondary: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1677F2' },
  proBtnSecundaryTxt: { color: '#1677F2', fontSize: 13, fontWeight: '800' },
});