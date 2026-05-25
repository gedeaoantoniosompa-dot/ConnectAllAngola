import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const CATEGORIAS = [
  { id: '1',  nome: 'Tecnologia',       icon: 'hardware-chip-outline' },
  { id: '2',  nome: 'Medicina',         icon: 'pulse-outline' },
  { id: '3',  nome: 'Direito',          icon: 'scale-outline' },
  { id: '4',  nome: 'Engenharia',       icon: 'color-filter-outline' },
  { id: '5',  nome: 'Educação',         icon: 'library-outline' },
  { id: '6',  nome: 'Economia',         icon: 'trending-up-outline' },
  { id: '7',  nome: 'Gestão',           icon: 'people-outline' },
  { id: '8',  nome: 'Arquitectura',     icon: 'albums-outline' },
  { id: '9',  nome: 'Comunicação',      icon: 'radio-outline' },
  { id: '10', nome: 'Psicologia',       icon: 'sparkles-outline' },
  { id: '11', nome: 'Finanças',         icon: 'cash-outline' },
  { id: '12', nome: 'Marketing',        icon: 'bar-chart-outline' },
  { id: '13', nome: 'Agricultura',      icon: 'leaf-outline' },
  { id: '14', nome: 'Empreendedorismo', icon: 'rocket-outline' },
];

function getInitials(nome) {
  const parts = (nome || 'U').trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ExploreScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [pesquisa, setPesquisa] = useState('');
  const [tabActiva, setTabActiva] = useState('categorias');
  const [todosUtilizadores, setTodosUtilizadores] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Carrega todos os utilizadores ao abrir o ecrã
  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const lista = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.uid !== user?.uid && u.nome); // exclui o próprio e sem nome
        setTodosUtilizadores(lista);
      } catch (err) {
        console.log('Erro ao carregar utilizadores:', err);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  const categoriasFiltradas = CATEGORIAS.filter(c =>
    c.nome.toLowerCase().includes(pesquisa.toLowerCase())
  );

  const pessoasFiltradas = todosUtilizadores.filter(p =>
    p.nome?.toLowerCase().includes(pesquisa.toLowerCase()) ||
    p.area?.toLowerCase().includes(pesquisa.toLowerCase()) ||
    p.cidade?.toLowerCase().includes(pesquisa.toLowerCase())
  );

  const iniciarConversa = (utilizador) => {
    router.push({
      pathname: '/(main)/conversa',
      params: {
        outroUid: utilizador.uid,
        outroNome: utilizador.nome || 'Utilizador',
        outraFoto: utilizador.fotoURL || '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Explorar</Text>
          <Text style={styles.subtitle}>Profissionais e áreas de actividade</Text>
        </View>
        <Ionicons name="options-outline" size={20} color="#9B9B9B" />
      </View>

      {/* Barra de pesquisa */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color="#ABABAB" style={{ marginRight: 9 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar pessoas, áreas..."
          placeholderTextColor="#ABABAB"
          value={pesquisa}
          onChangeText={(t) => {
            setPesquisa(t);
            if (t.length > 0) setTabActiva('pessoas');
          }}
        />
        {pesquisa.length > 0 && (
          <TouchableOpacity onPress={() => setPesquisa('')}>
            <Ionicons name="close-circle" size={15} color="#ABABAB" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'categorias' && styles.tabActiva]}
          onPress={() => setTabActiva('categorias')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, tabActiva === 'categorias' && styles.tabTextActiva]}>
            Categorias
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'pessoas' && styles.tabActiva]}
          onPress={() => setTabActiva('pessoas')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, tabActiva === 'pessoas' && styles.tabTextActiva]}>
            Pessoas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo */}
      {tabActiva === 'categorias' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Áreas de actividade</Text>
          <View style={styles.grid}>
            {categoriasFiltradas.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={styles.catCard}
                activeOpacity={0.7}
                onPress={() => {
                  setPesquisa(cat.nome);
                  setTabActiva('pessoas');
                }}
              >
                <View style={styles.catIconWrap}>
                  <Ionicons name={cat.icon} size={16} color="#6B6B6B" />
                </View>
                <Text style={styles.catNome}>{cat.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : carregando ? (
        <ActivityIndicator color="#1677F2" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={pessoasFiltradas}
          keyExtractor={item => item.uid}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>
              {pesquisa ? `Resultados para "${pesquisa}"` : 'Sugestões'}
            </Text>
          }
          renderItem={({ item, index }) => (
            <View style={[
              styles.personCard,
              index === pessoasFiltradas.length - 1 && styles.personCardLast,
            ]}>
              {/* Avatar */}
              <View style={styles.avatarWrap}>
                {item.fotoURL ? (
                  <Image source={{ uri: item.fotoURL }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(item.nome)}</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{item.nome}</Text>
                <View style={styles.personMetaRow}>
                  {item.area ? (
                    <View style={styles.areaBadge}>
                      <Text style={styles.areaBadgeText}>{item.area}</Text>
                    </View>
                  ) : null}
                  {item.area && item.cidade ? <View style={styles.dot} /> : null}
                  {item.cidade ? (
                    <Text style={styles.cidadeText}>{item.cidade}</Text>
                  ) : null}
                </View>
              </View>

              {/* Botões */}
              <View style={styles.botoesWrap}>
                <TouchableOpacity
                  style={styles.msgBtn}
                  activeOpacity={0.7}
                  onPress={() => iniciarConversa(item)}
                >
                  <Ionicons name="chatbubble-outline" size={13} color="#1677F2" />
                  <Text style={styles.msgBtnText}>SMS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.connectBtn} activeOpacity={0.7}>
                  <Text style={styles.connectBtnText}>Conectar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Ionicons name="person-outline" size={40} color="#ABABAB" />
              <Text style={styles.emptyText}>Nenhum utilizador encontrado</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F2' },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5, borderBottomColor: '#E4E4E4',
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  title: { fontSize: 21, fontWeight: '500', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 11, color: '#ABABAB', marginTop: 3 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', margin: 14, marginBottom: 0,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5, borderColor: '#E4E4E4',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A1A' },
  tabsWrap: {
    flexDirection: 'row', margin: 14, marginBottom: 0,
    backgroundColor: '#EBEBEB', borderRadius: 8, padding: 3,
    borderWidth: 0.5, borderColor: '#E4E4E4',
  },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  tabActiva: { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E4E4E4' },
  tabText: { fontSize: 12, fontWeight: '500', color: '#888888' },
  tabTextActiva: { color: '#1A1A1A' },
  sectionLabel: {
    fontSize: 10, fontWeight: '500', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#ABABAB',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  catCard: {
    width: '47.5%', backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 0.5, borderColor: '#E4E4E4',
    padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11,
  },
  catIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F0EFED', alignItems: 'center', justifyContent: 'center',
  },
  catNome: { fontSize: 12, fontWeight: '500', color: '#1A1A1A', flexShrink: 1, lineHeight: 16 },
  personCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 13, gap: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#E4E4E4',
  },
  personCardLast: { borderBottomWidth: 0 },
  avatarWrap: {},
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F0EFED', borderWidth: 0.5, borderColor: '#E4E4E4',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { fontSize: 13, fontWeight: '500', color: '#6B6B6B', letterSpacing: 0.5 },
  personInfo: { flex: 1 },
  personName: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  personMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  areaBadge: {
    backgroundColor: '#F0EFED', borderWidth: 0.5, borderColor: '#E4E4E4',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  areaBadgeText: { fontSize: 10, fontWeight: '500', color: '#888888' },
  dot: { width: 2, height: 2, borderRadius: 1, backgroundColor: '#ABABAB' },
  cidadeText: { fontSize: 11, color: '#ABABAB' },
  botoesWrap: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#1677F2', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EEF4FF',
  },
  msgBtnText: { fontSize: 11, fontWeight: '600', color: '#1677F2' },
  connectBtn: {
    borderWidth: 0.5, borderColor: '#C8C8C8', borderRadius: 20,
    paddingHorizontal: 13, paddingVertical: 5, backgroundColor: 'transparent',
  },
  connectBtnText: { fontSize: 11, fontWeight: '500', color: '#6B6B6B' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#ABABAB' },
});