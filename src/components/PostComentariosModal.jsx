/**
 * PostComentariosModal.jsx
 * Modal de comentários estilo LinkedIn — abre por cima do feed
 * com animação slide-up, cobre 100% do ecrã
 */

import { Ionicons } from '@expo/vector-icons';
import {
    addDoc,
    collection,
    deleteField,
    doc,
    increment,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { enviarNotificacao } from '../services/notificationService';

const { height: H, width: W } = Dimensions.get('window');
const TIPO_CORES = { conquista: '#FBBC05', ideia: '#1677F2', oportunidade: '#0D9488', artigo: '#7C3AED' };
const REACOES_EMOJIS = ['❤️', '😢', '🫡', '💪', '🥳', '🙏'];

function tempoRelativo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Picker de emojis ──────────────────────────────────────────────────────────
function EmojiPicker({ visivel, onSelect, onFechar }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visivel ? 1 : 0, useNativeDriver: true, tension: 60, friction: 7 }).start();
  }, [visivel]);
  if (!visivel) return null;
  return (
    <TouchableWithoutFeedback onPress={onFechar}>
      <View style={ep.overlay}>
        <TouchableWithoutFeedback>
          <Animated.View style={[ep.container, { transform: [{ scale: anim }] }]}>
            {REACOES_EMOJIS.map(e => (
              <TouchableOpacity key={e} style={ep.btn} onPress={() => onSelect(e)}>
                <Text style={ep.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}
const ep = StyleSheet.create({
  overlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  container: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 30, padding: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, gap: 8 },
  btn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#F8FAFC' },
  emoji:     { fontSize: 24 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function PostComentariosModal({ visivel, postId, post, onFechar }) {
  const { user, perfil } = useUser();
  const insets = useSafeAreaInsets();

  const [comentarios, setComentarios]           = useState([]);
  const [carregando, setCarregando]             = useState(true);
  const [novoComentario, setNovoComentario]     = useState('');
  const [enviando, setEnviando]                 = useState(false);
  const [emojiPickerComent, setEmojiPickerComent] = useState(null);

  // Animação slide-up
  const slideAnim = useRef(new Animated.Value(H)).current;

  useEffect(() => {
    if (visivel) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: H,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visivel]);

  // Carrega comentários
  useEffect(() => {
    if (!postId || !visivel) return;
    setCarregando(true);
    const q = query(
      collection(db, 'posts', postId, 'comentarios'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setComentarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    });
    return unsub;
  }, [postId, visivel]);

  // Swipe para fechar
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideAnim.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          onFechar();
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !user || !postId) return;
    const texto = novoComentario.trim();
    setNovoComentario('');
    setEnviando(true);
    try {
      await addDoc(collection(db, 'posts', postId, 'comentarios'), {
        uid: user.uid,
        autorNome: perfil?.nome || 'Utilizador',
        autorFoto: perfil?.fotoURL || null,
        autorCargo: perfil?.area || perfil?.cargo || '',
        texto,
        timestamp: serverTimestamp(),
      });
      await updateDoc(doc(db, 'posts', postId), { comentarios: increment(1) });
      const donoId = post?.uid;
      if (donoId && donoId !== user.uid) {
        await enviarNotificacao(
          donoId, user.uid, 'comentario',
          `${perfil?.nome || 'Alguém'} comentou na tua publicação`,
          perfil?.fotoURL || null, postId
        );
      }
    } catch (e) { console.log('Erro comentário:', e); }
    finally { setEnviando(false); }
  };

  const handleReacao = async (comentario, emoji) => {
    if (!user || !postId) return;
    setEmojiPickerComent(null);
    const ref = doc(db, 'posts', postId, 'comentarios', comentario.id);
    const antigo = comentario.reacoesMap?.[user.uid];
    try {
      if (antigo === emoji) {
        await updateDoc(ref, { likes: increment(-1), [`reacoesMap.${user.uid}`]: deleteField() });
      } else {
        const up = { [`reacoesMap.${user.uid}`]: emoji };
        if (!antigo) up.likes = increment(1);
        await updateDoc(ref, up);
      }
    } catch (e) { console.log('Erro reação:', e); }
  };

  const renderComentario = ({ item }) => (
    <View style={s.comentWrap}>
      <View style={s.comentAvatar}>
        {item.autorFoto
          ? <Image source={{ uri: item.autorFoto }} style={s.comentAvatarImg} />
          : <Text style={s.comentAvatarLetra}>{(item.autorNome || 'U')[0]}</Text>
        }
      </View>
      <View style={s.comentBubble}>
        <View style={s.comentTopRow}>
          <Text style={s.comentNome}>{item.autorNome}</Text>
          <Text style={s.comentTempo}>{tempoRelativo(item.timestamp)}</Text>
        </View>
        {item.autorCargo ? <Text style={s.comentCargo}>{item.autorCargo}</Text> : null}
        <Text style={s.comentTexto}>{item.texto}</Text>
        <TouchableOpacity
          style={s.comentLikeRow}
          onPress={() => handleReacao(item, '❤️')}
          onLongPress={() => setEmojiPickerComent(item)}
        >
          {item.reacoesMap?.[user?.uid]
            ? <Text style={{ fontSize: 13 }}>{item.reacoesMap[user.uid]}</Text>
            : <Ionicons name="heart-outline" size={13} color="#718096" />
          }
          <Text style={[s.comentLikeTxt, item.reacoesMap?.[user?.uid] && { color: '#EF4444' }]}>
            {item.likes || 0} Gosto
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const cor = TIPO_CORES[post?.tipo] || '#1677F2';

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="none"
      onRequestClose={onFechar}
      statusBarTranslucent
    >
      {/* Fundo escuro semi-transparente */}
      <TouchableWithoutFeedback onPress={onFechar}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet animado */}
      <Animated.View
        style={[s.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom }]}
      >
        {/* Handle + header com pan responder para swipe */}
        <View {...panResponder.panHandlers}>
          <View style={s.handleWrap}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitulo}>
              Comentários{comentarios.length > 0 ? ` (${comentarios.length})` : ''}
            </Text>
            <TouchableOpacity style={s.fecharBtn} onPress={onFechar}>
              <Ionicons name="close" size={22} color="#4A5568" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview do post */}
        {post && (
          <View style={s.postPreview}>
            <View style={[s.postPreviewAvatar, { backgroundColor: cor }]}>
              {post.autorFoto
                ? <Image source={{ uri: post.autorFoto }} style={s.postPreviewAvatarImg} />
                : <Text style={s.postPreviewAvatarLetra}>{(post.autorNome || 'U')[0]}</Text>
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.postPreviewNome}>{post.autorNome}</Text>
              {post.texto ? (
                <Text style={s.postPreviewTexto} numberOfLines={2}>{post.texto}</Text>
              ) : null}
            </View>
          </View>
        )}

        <View style={s.divisor} />

        {/* Lista de comentários */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {carregando ? (
            <ActivityIndicator color="#1677F2" style={{ marginTop: 40 }} />
          ) : comentarios.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="chatbubble-outline" size={48} color="#CBD5E0" />
              <Text style={s.vazioTitulo}>Seja o primeiro a comentar</Text>
              <Text style={s.vazioSub}>Partilha a tua opinião sobre esta publicação</Text>
            </View>
          ) : (
            <FlatList
              data={comentarios}
              keyExtractor={item => item.id}
              renderItem={renderComentario}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
            />
          )}

          {/* Input */}
          <View style={s.inputWrap}>
            <View style={s.inputAvatar}>
              {perfil?.fotoURL
                ? <Image source={{ uri: perfil.fotoURL }} style={s.inputAvatarImg} />
                : <Ionicons name="person" size={16} color="#fff" />
              }
            </View>
            <View style={s.inputBox}>
              <TextInput
                style={s.input}
                placeholder="Adiciona um comentário..."
                placeholderTextColor="#A0AEC0"
                value={novoComentario}
                onChangeText={setNovoComentario}
                multiline
                maxLength={300}
              />
            </View>
            <TouchableOpacity
              style={[s.enviarBtn, (!novoComentario.trim() || enviando) && { opacity: 0.4 }]}
              onPress={enviarComentario}
              disabled={!novoComentario.trim() || enviando}
            >
              {enviando
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="send" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Emoji picker */}
        <EmojiPicker
          visivel={!!emojiPickerComent}
          onSelect={emoji => handleReacao(emojiPickerComent, emoji)}
          onFechar={() => setEmojiPickerComent(null)}
        />
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Backdrop
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Sheet
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: H * 0.92,           // 92% do ecrã — estilo LinkedIn
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  // Handle
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitulo:{ fontSize: 16, fontWeight: '700', color: '#1A202C' },
  fecharBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

  // Preview do post
  postPreview:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC' },
  postPreviewAvatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  postPreviewAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  postPreviewAvatarLetra: { color: '#fff', fontSize: 15, fontWeight: '700' },
  postPreviewNome:      { fontSize: 13, fontWeight: '700', color: '#1A202C', marginBottom: 2 },
  postPreviewTexto:     { fontSize: 12, color: '#718096', lineHeight: 17 },

  divisor: { height: 1, backgroundColor: '#E2E8F0' },

  // Vazio
  vazio:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  vazioTitulo: { fontSize: 16, fontWeight: '700', color: '#2D3748' },
  vazioSub:    { fontSize: 13, color: '#718096', textAlign: 'center', lineHeight: 19 },

  // Comentários
  comentWrap:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  comentAvatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  comentAvatarImg:    { width: 36, height: 36, borderRadius: 18 },
  comentAvatarLetra:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  comentBubble:       { flex: 1, backgroundColor: '#F7F8FA', borderRadius: 14, padding: 10 },
  comentTopRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 },
  comentNome:         { fontSize: 13, fontWeight: '700', color: '#1A202C' },
  comentTempo:        { fontSize: 11, color: '#A0AEC0' },
  comentCargo:        { fontSize: 11, color: '#718096', marginBottom: 4 },
  comentTexto:        { fontSize: 13, color: '#2D3748', lineHeight: 19, marginTop: 4 },
  comentLikeRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  comentLikeTxt:      { fontSize: 12, color: '#718096', fontWeight: '600' },

  // Input
  inputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#fff' },
  inputAvatar:  { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  inputAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  inputBox:     { flex: 1, backgroundColor: '#F7F8FA', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 40, maxHeight: 100 },
  input:        { fontSize: 14, color: '#1A202C' },
  enviarBtn:    { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center' },
});