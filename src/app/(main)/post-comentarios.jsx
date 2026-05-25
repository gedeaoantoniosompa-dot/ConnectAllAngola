import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    collection,
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
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const TIPO_CORES = { conquista: '#FBBC05', ideia: '#1677F2', oportunidade: '#0D9488', artigo: '#7C3AED' };

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

export default function PostComentariosScreen() {
  const router = useRouter();
  const { postId, autorNome, autorFoto, autorCargo, autorCidade, texto, tipo, timestamp, likes } = useLocalSearchParams();
  const { user, perfil } = useUser();
  const [comentarios, setComentarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);

  const cor = TIPO_CORES[tipo] || '#1677F2';

  // Ouve comentários em tempo real
  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, 'posts', postId, 'comentarios'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComentarios(dados);
      setCarregando(false);
    });
    return unsub;
  }, [postId]);

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !user) return;
    const textoEnviar = novoComentario.trim();
    setNovoComentario('');
    setEnviando(true);
    try {
      // Guarda o comentário
      await addDoc(collection(db, 'posts', postId, 'comentarios'), {
        uid: user.uid,
        autorNome: perfil.nome || 'Utilizador',
        autorFoto: perfil.fotoURL || null,
        autorCargo: perfil.area || perfil.cargo || '',
        texto: textoEnviar,
        timestamp: serverTimestamp(),
      });

      // Incrementa contador de comentários no post
      await updateDoc(doc(db, 'posts', postId), {
        comentarios: increment(1),
      });
    } catch (err) {
      console.log('Erro comentário:', err);
    } finally {
      setEnviando(false);
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
          <Text style={styles.comentarioNome}>{item.autorNome}</Text>
          <Text style={styles.comentarioTempo}>{tempoRelativo(item.timestamp)}</Text>
        </View>
        {item.autorCargo ? <Text style={styles.comentarioCargo}>{item.autorCargo}</Text> : null}
        <Text style={styles.comentarioTexto}>{item.texto}</Text>
        <TouchableOpacity style={styles.comentarioLikeBtn}>
          <Ionicons name="heart-outline" size={13} color="#6B6B6B" />
          <Text style={styles.comentarioLikeText}>Gosto</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
              {/* Post original */}
              <View style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={[styles.postAvatar, { backgroundColor: cor }]}>
                    {autorFoto ? (
                      <Image source={{ uri: autorFoto }} style={styles.postAvatarImage} />
                    ) : (
                      <Text style={styles.postAvatarText}>{(autorNome || 'U')[0]}</Text>
                    )}
                  </View>
                  <View style={styles.postMeta}>
                    <Text style={styles.postAutor}>{autorNome}</Text>
                    <Text style={styles.postCargo} numberOfLines={1}>{autorCargo}</Text>
                    <View style={styles.postMetaRow}>
                      {autorCidade ? (
                        <>
                          <Ionicons name="location-outline" size={11} color="#ABABAB" />
                          <Text style={styles.postMetaText}>{autorCidade}</Text>
                          <Text style={styles.postMetaDot}>·</Text>
                        </>
                      ) : null}
                      <Text style={styles.postMetaText}>{tempoRelativo(timestamp ? { toDate: () => new Date(Number(timestamp)) } : null)}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.postTexto}>{texto}</Text>
                <View style={styles.postStatsRow}>
                  <View style={styles.postStatsLeft}>
                    <View style={[styles.postLikeCircle, { backgroundColor: cor }]}>
                      <Ionicons name="heart" size={9} color="#fff" />
                    </View>
                    <Text style={styles.postStatText}>{likes || 0} gostos</Text>
                  </View>
                  <Text style={styles.postStatText}>{comentarios.length} comentários</Text>
                </View>
              </View>

              {/* Separador comentários */}
              <View style={styles.comentariosSep}>
                <Text style={styles.comentariosTitle}>Comentários</Text>
              </View>

              {carregando && <ActivityIndicator color="#1677F2" style={{ marginTop: 20 }} />}

              {!carregando && comentarios.length === 0 && (
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