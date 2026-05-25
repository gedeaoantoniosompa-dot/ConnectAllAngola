import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
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

// Gera ID único para o chat entre dois utilizadores
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

function formatarHora(timestamp) {
  if (!timestamp) return '';
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function ConversaScreen() {
  const router = useRouter();
  const { outroUid, outroNome, outraFoto } = useLocalSearchParams();
  const { user, perfil } = useUser();
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const flatListRef = useRef(null);

  const chatId = user && outroUid ? getChatId(user.uid, outroUid) : null;

  // Ouve mensagens em tempo real
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMensagens(dados);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [chatId]);

  const enviarMensagem = async () => {
    if (!texto.trim() || !chatId || !user) return;
    const textoEnviar = texto.trim();
    setTexto('');
    setEnviando(true);
    try {
      // Guarda a mensagem
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        uid: user.uid,
        texto: textoEnviar,
        timestamp: serverTimestamp(),
        lida: false,
      });

      // Atualiza metadados do chat (para a lista de conversas)
      await setDoc(doc(db, 'chats', chatId), {
        users: [user.uid, outroUid],
        ultimaMensagem: textoEnviar,
        ultimoTimestamp: serverTimestamp(),
        [`nomes.${user.uid}`]: perfil.nome || 'Utilizador',
        [`nomes.${outroUid}`]: outroNome || 'Utilizador',
        [`fotos.${user.uid}`]: perfil.fotoURL || null,
        [`fotos.${outroUid}`]: outraFoto || null,
      }, { merge: true });
    } catch (err) {
      console.log('Erro ao enviar:', err);
    } finally {
      setEnviando(false);
    }
  };

  const renderMensagem = ({ item, index }) => {
    const eMeu = item.uid === user?.uid;
    const anterior = index > 0 ? mensagens[index - 1] : null;
    const mostrarAvatar = !eMeu && (!anterior || anterior.uid === user?.uid);

    return (
      <View style={[styles.msgRow, eMeu && styles.msgRowMeu]}>
        {!eMeu && (
          <View style={[styles.msgAvatar, !mostrarAvatar && styles.msgAvatarHidden]}>
            {mostrarAvatar && (
              outraFoto ? (
                <Image source={{ uri: outraFoto }} style={styles.msgAvatarImage} />
              ) : (
                <Text style={styles.msgAvatarText}>{(outroNome || '?')[0]}</Text>
              )
            )}
          </View>
        )}
        <View style={[styles.msgBubble, eMeu ? styles.msgBubbleMeu : styles.msgBubbleDele]}>
          <Text style={[styles.msgTexto, eMeu && styles.msgTextoBranco]}>
            {item.texto}
          </Text>
          <Text style={[styles.msgHora, eMeu && styles.msgHoraBranca]}>
            {formatarHora(item.timestamp)} {eMeu && '✓✓'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F1F1F" />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          {outraFoto ? (
            <Image source={{ uri: outraFoto }} style={styles.headerAvatarImage} />
          ) : (
            <Text style={styles.headerAvatarText}>{(outroNome || '?')[0]}</Text>
          )}
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerNome}>{outroNome || 'Conversa'}</Text>
          <Text style={styles.headerStatus}>Online agora</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Ionicons name="call-outline" size={20} color="#1677F2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Ionicons name="videocam-outline" size={20} color="#1677F2" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={mensagens}
          keyExtractor={item => item.id}
          renderItem={renderMensagem}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={40} color="#ABABAB" />
              <Text style={styles.emptyText}>Ainda sem mensagens.</Text>
              <Text style={styles.emptySubText}>Envia a primeira mensagem!</Text>
            </View>
          )}
        />

        {/* Input */}
        <View style={styles.inputWrap}>
          <TouchableOpacity style={styles.inputAction}>
            <Ionicons name="add-circle-outline" size={26} color="#1677F2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputAction}>
            <Ionicons name="image-outline" size={24} color="#6B6B6B" />
          </TouchableOpacity>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Escreve uma mensagem..."
              placeholderTextColor="#ABABAB"
              value={texto}
              onChangeText={setTexto}
              multiline
              maxLength={500}
            />
            <TouchableOpacity>
              <Ionicons name="happy-outline" size={22} color="#6B6B6B" />
            </TouchableOpacity>
          </View>
          {texto.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={enviarMensagem} disabled={enviando}>
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn}>
              <Ionicons name="mic-outline" size={24} color="#1677F2" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  headerAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#19D400', borderWidth: 1.5, borderColor: '#fff',
  },
  headerInfo: { flex: 1 },
  headerNome: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
  headerStatus: { fontSize: 12, color: '#19D400', fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerActionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center',
  },
  msgList: { padding: 16, gap: 4, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#6B6B6B' },
  emptySubText: { fontSize: 13, color: '#ABABAB' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMeu: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  msgAvatarHidden: { backgroundColor: 'transparent' },
  msgAvatarImage: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  msgBubble: { maxWidth: '75%', borderRadius: 18, padding: 10, paddingHorizontal: 14 },
  msgBubbleDele: {
    backgroundColor: '#fff', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  msgBubbleMeu: { backgroundColor: '#1677F2', borderBottomRightRadius: 4 },
  msgTexto: { fontSize: 14, color: '#1F1F1F', lineHeight: 20 },
  msgTextoBranco: { color: '#fff' },
  msgHora: { fontSize: 10, color: '#ABABAB', marginTop: 4, textAlign: 'right' },
  msgHoraBranca: { color: 'rgba(255,255,255,0.7)' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 0.5, borderTopColor: '#EAEAEA',
    gap: 6,
  },
  inputAction: { padding: 4 },
  inputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F7FA', borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#EAEAEA', gap: 8,
  },
  input: { flex: 1, fontSize: 14, color: '#1F1F1F', maxHeight: 100 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  micBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center',
  },
});