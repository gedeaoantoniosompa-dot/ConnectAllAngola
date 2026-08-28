import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { enviarNotificacao } from '../../services/notificationService';

const TIPO_CORES = { conquista: '#FBBC05', ideia: '#1677F2', oportunidade: '#0D9488', artigo: '#7C3AED' };
const REACOES_EMOJIS = ['❤️', '😢', '🫡', '💪', '🥳', '🙏'];

function tempoRelativo(timestamp) {
  if (!timestamp) return '';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((agora - data) / 1000);
  
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default function PostComentariosScreen() {
  const router = useRouter();
  // Agora usamos os params apenas como fallback inicial, pois vamos buscar os dados reais via Firestore
  const params = useLocalSearchParams();
  const { postId } = params;
  
  const { user, perfil } = useUser();
  const [post, setPost] = useState(null); // Estado para guardar o post ativo da BD
  const [comentarios, setComentarios] = useState([]);
  const [carregandoPost, setCarregandoPost] = useState(true);
  const [carregandoComentarios, setCarregandoComentarios] = useState(true);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [reacaoPickerComentario, setReacaoPickerComentario] = useState(null);
  const inputRef = useRef(null);

  const pickerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reacaoPickerComentario) {
      Animated.spring(pickerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 7,
      }).start();
    } else {
      pickerAnim.setValue(0);
    }
  }, [reacaoPickerComentario]);

  // 1. Ouve os dados do Post em tempo real (Garante o carregamento vindo das Notificações)
  useEffect(() => {
    if (!postId) return;

    const docRef = doc(db, 'posts', postId);
    const unsubPost = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists) {
        setPost({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.log("O post associado a esta notificação já não existe.");
      }
      setCarregandoPost(false);
    }, (error) => {
      console.log("Erro ao carregar post:", error);
      setCarregandoPost(false);
    });

    return unsubPost;
  }, [postId]);

  // 2. Ouve comentários em tempo real
  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, 'posts', postId, 'comentarios'),
      orderBy('timestamp', 'asc')
    );
    const unsubComentarios = onSnapshot(q, (snap) => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComentarios(dados);
      setCarregandoComentarios(false);
    });
    return unsubComentarios;
  }, [postId]);

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !user || !post) return;
    const textoEnviar = novoComentario.trim();
    setNovoComentario('');
    setEnviando(true);
    try {
      await addDoc(collection(db, 'posts', postId, 'comentarios'), {
        uid: user.uid,
        autorNome: perfil.nome || 'Utilizador',
        autorFoto: perfil.fotoURL || null,
        autorCargo: perfil.area || perfil.cargo || '',
        texto: textoEnviar,
        timestamp: serverTimestamp(),
      });

      await updateDoc(doc(db, 'posts', postId), {
        comentarios: increment(1),
      });

      // Usa o autorId dinâmico vindo diretamente do post carregado do Firestore
      const donoDoPostId = post.autorId || post.uid;
      
      if (donoDoPostId && donoDoPostId !== user.uid) {
        await enviarNotificacao(
          donoDoPostId,
          user.uid,
          'comentario',
          `${perfil.nome || 'Alguém'} comentou na tua publicação`,
          perfil.fotoURL || null,
          postId
        );
      }
    } catch (err) {
      console.log('Erro comentário:', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleReacaoComentario = async (comentario, emoji) => {
    if (!user || !postId) return;
    const comentarioRef = doc(db, 'posts', postId, 'comentarios', comentario.id);
    const emojiAntigo = comentario.reacoesMap?.[user.uid];
    setReacaoPickerComentario(null);

    try {
      if (emojiAntigo === emoji) {
        await updateDoc(comentarioRef, {
          likes: increment(-1),
          [`reacoesMap.${user.uid}`]: deleteField()
        });
      } else {
        const updates = { [`reacoesMap.${user.uid}`]: emoji };
        if (!emojiAntigo) updates.likes = increment(1);
        await updateDoc(comentarioRef, updates);
        
        if (comentario.uid !== user.uid) {
          await enviarNotificacao(comentario.uid, user.uid, 'reacao',
            `${perfil.nome} reagiu ao teu comentário: ${emoji}`,
            perfil.fotoURL, postId);
        }
      }
    } catch (err) {
      console.log('Erro reacao comentario:', err);
    }
  };

  const renderComentario = ({ item }) => (
    <View style={styles.comentarioWrap}>
      <View style={styles.comentarioAvatar}>
        {item.autorFoto ? (
          <Image source={{ uri: item.autorFoto }} style={styles.comentarioAvatarImage} />
        ) : (
          <Text style={styles.comentarioAvatarText}>{(item.autorNome || 'U')[0]}</Text>
        )}
      </View>
      <View style={styles.comentarioBubble}>
        <View style={styles.comentarioHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.comentarioNome}>{item.autorNome}</Text>
            {item.autorVerificado && (
              <Ionicons name="shield-checkmark" size={12} color="#1677F2" />
            )}
          </View>
          <Text style={styles.comentarioTempo}>{tempoRelativo(item.timestamp)}</Text>
        </View>
        {item.autorCargo ? <Text style={styles.comentarioCargo}>{item.autorCargo}</Text> : null}
        <Text style={styles.comentarioTexto}>{item.texto}</Text>
        <TouchableOpacity 
          style={styles.comentarioLikeBtn} 
          onPress={() => handleReacaoComentario(item, '❤️')}
          onLongPress={() => setReacaoPickerComentario(item)}
        >
          {item.reacoesMap?.[user?.uid] ? (
            <Text style={{ fontSize: 14 }}>{item.reacoesMap[user.uid]}</Text>
          ) : (
            <Ionicons name="heart-outline" size={13} color="#6B6B6B" />
          )}
          <Text style={[styles.comentarioLikeText, item.reacoesMap?.[user?.uid] && { color: '#EF4444' }]}>
            {item.likes || 0} Gosto
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const corDefinida = post ? (TIPO_CORES[post.tipo] || '#1677F2') : '#1677F2';

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F1F1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publicação</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={comentarios}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <View>
              {/* Renderização condicional enquanto carrega ou se o post existe */}
              {carregandoPost ? (
                <ActivityIndicator color="#1677F2" style={{ marginVertical: 30 }} />
              ) : post ? (
                <View style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={[styles.postAvatar, { backgroundColor: corDefinida }]}>
                      {post.autorFoto || post.userFoto ? (
                        <Image source={{ uri: post.autorFoto || post.userFoto }} style={styles.postAvatarImage} />
                      ) : (
                        <Text style={styles.postAvatarText}>{(post.autorNome || post.userName || 'U')[0]}</Text>
                      )}
                    </View>
                    <View style={styles.postMeta}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.postAutor}>{post.autorNome || post.userName}</Text>
                        {post.autorVerificado && (
                          <Ionicons name="shield-checkmark" size={14} color="#1677F2" />
                        )}
                      </View>
                      <Text style={styles.postCargo} numberOfLines={1}>{post.autorCargo || post.userCargo}</Text>
                      <View style={styles.postMetaRow}>
                        {post.autorCidade || post.userCidade ? (
                          <>
                            <Ionicons name="location-outline" size={11} color="#ABABAB" />
                            <Text style={styles.postMetaText}>{post.autorCidade || post.userCidade}</Text>
                            <Text style={styles.postMetaDot}>·</Text>
                          </>
                        ) : null}
                        <Text style={styles.postMetaText}>
                          {post.createdAt || post.timestamp ? tempoRelativo(post.createdAt || post.timestamp) : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.postTexto}>{post.texto || post.content}</Text>
                  <View style={styles.postStatsRow}>
                    <TouchableOpacity style={styles.postStatsLeft} onPress={() => router.push({ pathname: '/(main)/ReacoesModal', params: { postId: post.id } })}>
                      <View style={styles.emojiOverlapContainer}>
                        {post.reacoesMap ? [...new Set(Object.values(post.reacoesMap))].slice(0, 3).map((emoji, idx) => (
                          <Text key={idx} style={[styles.overlapEmoji, { zIndex: 10 - idx, marginLeft: idx === 0 ? 0 : -8 }]}>{emoji}</Text>
                        )) : (
                          <Ionicons name="heart-sharp" size={14} color="#EF4444" />
                        )}
                      </View>
                      <Text style={styles.postStatText}>{post.likes || 0} reações</Text>
                    </TouchableOpacity>
                    <Text style={styles.postStatText}>{comentarios.length} comentários</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>Não foi possível carregar esta publicação.</Text>
                </View>
              )}

              {/* Separador comentários */}
              <View style={styles.comentariosSep}>
                <Text style={styles.comentariosTitle}>Comentários</Text>
              </View>

              {carregandoComentarios && <ActivityIndicator color="#1677F2" style={{ marginTop: 20 }} />}

              {!carregandoComentarios && comentarios.length === 0 && (
                <View style={styles.emptyWrap}>
                  <Ionicons name="chatbubble-outline" size={36} color="#ABABAB" />
                  <Text style={styles.emptyText}>Ainda não há comentários.</Text>
                  <Text style={styles.emptySubText}>Sê o primeiro a comentar!</Text>
                </View>
              )}
            </View>
          )}
          renderItem={renderComentario}
          contentContainerStyle={{ paddingBottom: 16 }}
        />

        {/* Input de comentário */}
        <View style={styles.inputWrap}>
          <View style={styles.inputAvatar}>
            {perfil.fotoURL ? (
              <Image source={{ uri: perfil.fotoURL }} style={styles.inputAvatarImage} />
            ) : (
              <Ionicons name="person" size={16} color="#fff" />
            )}
          </View>
          <View style={styles.inputBox}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Adiciona um comentário..."
              placeholderTextColor="#ABABAB"
              value={novoComentario}
              onChangeText={setNovoComentario}
              multiline
              maxLength={300}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!novoComentario.trim() || enviando) && { opacity: 0.4 }]}
            onPress={enviarComentario}
            disabled={!novoComentario.trim() || enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Picker de Emojis para Comentários */}
      <Modal visible={reacaoPickerComentario !== null} transparent animationType="fade" onRequestClose={() => setReacaoPickerComentario(null)}>
        <TouchableWithoutFeedback onPress={() => setReacaoPickerComentario(null)}>
          <View style={styles.modalOverlayReacao}>
            <Animated.View style={[
              styles.pickerContainer,
              { transform: [{ scale: pickerAnim }, { translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
            ]}>
              {REACOES_EMOJIS.map(e => (
                <TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => handleReacaoComentario(reacaoPickerComentario, e)}>
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  postCard: {
    backgroundColor: '#fff', margin: 12, borderRadius: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  postHeader: { flexDirection: 'row', padding: 14, gap: 10 },
  postAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  postAvatarImage: { width: 44, height: 44, borderRadius: 22 },
  postAvatarText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  postMeta: { flex: 1, gap: 1 },
  postAutor: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  postCargo: { fontSize: 12, color: '#6B6B6B' },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  postMetaText: { fontSize: 11, color: '#ABABAB' },
  postMetaDot: { fontSize: 11, color: '#ABABAB' },
  postTexto: { fontSize: 14, color: '#1F1F1F', lineHeight: 21, paddingHorizontal: 14, paddingBottom: 12 },
  postStatsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  postStatsLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postLikeCircle: { width: 17, height: 17, borderRadius: 8.5, alignItems: 'center', justifyContent: 'center' },
  postStatText: { fontSize: 12, color: '#ABABAB' },
  emojiOverlapContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  overlapEmoji: { fontSize: 14, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#fff' },
  modalOverlayReacao: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 30, padding: 8, elevation: 4, gap: 8 },
  emojiBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  comentariosSep: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
    backgroundColor: '#fff',
  },
  comentariosTitle: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#6B6B6B' },
  emptySubText: { fontSize: 12, color: '#ABABAB' },
  comentarioWrap: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    gap: 10, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#F5F7FA',
  },
  comentarioAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  comentarioAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  comentarioAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  comentarioBubble: {
    flex: 1, backgroundColor: '#F5F7FA', borderRadius: 12,
    padding: 10, gap: 3,
  },
  comentarioHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  comentarioNome: { fontSize: 13, fontWeight: '700', color: '#1F1F1F' },
  comentarioTempo: { fontSize: 11, color: '#ABABAB' },
  comentarioCargo: { fontSize: 11, color: '#6B6B6B' },
  comentarioTexto: { fontSize: 13, color: '#1F1F1F', lineHeight: 19, marginTop: 4 },
  comentarioLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  comentarioLikeText: { fontSize: 11, color: '#6B6B6B', fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#EAEAEA', gap: 8,
  },
  inputAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  inputAvatarImage: { width: 34, height: 34, borderRadius: 17 },
  inputBox: {
    flex: 1, backgroundColor: '#F5F7FA', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#EAEAEA',
  },
  input: { fontSize: 14, color: '#1F1F1F', maxHeight: 80 },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
  },
});