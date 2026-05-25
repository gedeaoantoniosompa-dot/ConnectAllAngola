import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const CORES = ['#1677F2', '#6A11CB', '#EC4C89', '#19D400', '#FF8C00', '#00B4D8', '#EF233C', '#8338EC'];

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

export default function ChatScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const [conversas, setConversas] = useState([]);
  const [pesquisa, setPesquisa] = useState('');
  const [tabActiva, setTabActiva] = useState('todas');

  // Ouve conversas em tempo real onde o utilizador participa
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', user.uid),
      orderBy('ultimoTimestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const dados = snap.docs.map(d => {
        const data = d.data();
        // Descobre o outro utilizador
        const outroUid = data.users?.find(uid => uid !== user.uid);
        return {
          id: d.id,
          outroUid,
          outroNome: data.nomes?.[outroUid] || 'Utilizador',
          outraFoto: data.fotos?.[outroUid] || null,
          ultimaMensagem: data.ultimaMensagem || '',
          timestamp: data.ultimoTimestamp,
        };
      });
      setConversas(dados);
    }, err => console.log('Erro chats:', err));
    return unsub;
  }, [user]);

  const conversasFiltradas = conversas.filter(c => {
    return c.outroNome.toLowerCase().includes(pesquisa.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mensagens</Text>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Ionicons name="create-outline" size={22} color="#1F1F1F" />
        </TouchableOpacity>
      </View>

      {/* Pesquisa */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#ABABAB" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar conversas..."
          placeholderTextColor="#ABABAB"
          value={pesquisa}
          onChangeText={setPesquisa}
        />
        {pesquisa.length > 0 && (
          <TouchableOpacity onPress={() => setPesquisa('')}>
            <Ionicons name="close-circle" size={18} color="#ABABAB" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'todas', label: 'Todas' },
          { key: 'naoLidas', label: 'Não lidas' },
          { key: 'grupos', label: 'Grupos' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, tabActiva === tab.key && styles.tabActiva]}
            onPress={() => setTabActiva(tab.key)}
          >
            <Text style={[styles.tabText, tabActiva === tab.key && styles.tabTextActiva]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={conversasFiltradas}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.conversaItem}
            activeOpacity={0.85}
            onPress={() => router.push({
              pathname: '/(main)/conversa',
              params: {
                outroUid: item.outroUid,
                outroNome: item.outroNome,
                outraFoto: item.outraFoto || '',
              }
            })}
          >
            <View style={styles.avatarWrap}>
              {item.outraFoto ? (
                <Image source={{ uri: item.outraFoto }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: CORES[index % CORES.length] }]}>
                  <Text style={styles.avatarText}>{item.outroNome[0]}</Text>
                </View>
              )}
            </View>

            <View style={styles.conversaInfo}>
              <View style={styles.conversaTop}>
                <Text style={styles.conversaNome} numberOfLines={1}>{item.outroNome}</Text>
                <Text style={styles.conversaTempo}>{tempoRelativo(item.timestamp)}</Text>
              </View>
              <Text style={styles.conversaMensagem} numberOfLines={1}>{item.ultimaMensagem}</Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ABABAB" />
            <Text style={styles.emptyText}>Ainda não tens conversas</Text>
            <Text style={styles.emptySubText}>Conecta-te com alguém para começar!</Text>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fabBtn}>
        <Ionicons name="create" size={24} color="#fff" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F1F1F' },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EAEAEA', alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 16, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#EAEAEA',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F1F1F' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EAEAEA' },
  tabActiva: { backgroundColor: '#1677F2' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
  tabTextActiva: { color: '#fff' },
  conversaItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  conversaInfo: { flex: 1 },
  conversaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  conversaNome: { fontSize: 15, fontWeight: '700', color: '#1F1F1F', flex: 1 },
  conversaTempo: { fontSize: 12, color: '#ABABAB' },
  conversaMensagem: { fontSize: 13, color: '#6B6B6B' },
  separator: { height: 0.5, backgroundColor: '#EAEAEA', marginLeft: 80 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#6B6B6B' },
  emptySubText: { fontSize: 13, color: '#ABABAB' },
  fabBtn: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});