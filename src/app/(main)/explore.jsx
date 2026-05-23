import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const PESSOAS = [
  { id: '1', nome: 'Ana Fernandes',  area: 'Engenharia',  cidade: 'Luanda'   },
  { id: '2', nome: 'Carlos Mbemba',  area: 'Tecnologia',  cidade: 'Benguela' },
  { id: '3', nome: 'Sofia Lopes',    area: 'Medicina',    cidade: 'Luanda'   },
  { id: '4', nome: 'Pedro Neto',     area: 'Direito',     cidade: 'Huambo'   },
];

function getInitials(nome) {
  const parts = nome.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ExploreScreen() {
  const [pesquisa, setPesquisa] = useState('');
  const [tabActiva, setTabActiva] = useState('categorias');

  const categoriasFiltradas = CATEGORIAS.filter(c =>
    c.nome.toLowerCase().includes(pesquisa.toLowerCase())
  );
  const pessoasFiltradas = PESSOAS.filter(p =>
    p.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
    p.area.toLowerCase().includes(pesquisa.toLowerCase())
  );

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
          onChangeText={setPesquisa}
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
              <TouchableOpacity key={cat.id} style={styles.catCard} activeOpacity={0.7}>
                <View style={styles.catIconWrap}>
                  <Ionicons name={cat.icon} size={16} color="#6B6B6B" />
                </View>
                <Text style={styles.catNome}>{cat.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={pessoasFiltradas}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.sectionLabel}>Sugestões</Text>}
          renderItem={({ item, index }) => (
            <View style={[
              styles.personCard,
              index === pessoasFiltradas.length - 1 && styles.personCardLast,
            ]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item.nome)}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{item.nome}</Text>
                <View style={styles.personMetaRow}>
                  <View style={styles.areaBadge}>
                    <Text style={styles.areaBadgeText}>{item.area}</Text>
                  </View>
                  <View style={styles.dot} />
                  <Text style={styles.cidadeText}>{item.cidade}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.connectBtn} activeOpacity={0.7}>
                <Text style={styles.connectBtnText}>Conectar</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F4F2',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E4E4E4',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 21,
    fontWeight: '500',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: '#ABABAB',
    marginTop: 3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 14,
    marginBottom: 0,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: '#E4E4E4',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
  },
  tabsWrap: {
    flexDirection: 'row',
    margin: 14,
    marginBottom: 0,
    backgroundColor: '#EBEBEB',
    borderRadius: 8,
    padding: 3,
    borderWidth: 0.5,
    borderColor: '#E4E4E4',
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActiva: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E4E4E4',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888888',
  },
  tabTextActiva: {
    color: '#1A1A1A',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#ABABAB',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  catCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#E4E4E4',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0EFED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNome: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    flexShrink: 1,
    lineHeight: 16,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E4E4E4',
  },
  personCardLast: {
    borderBottomWidth: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0EFED',
    borderWidth: 0.5,
    borderColor: '#E4E4E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B6B6B',
    letterSpacing: 0.5,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  personMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  areaBadge: {
    backgroundColor: '#F0EFED',
    borderWidth: 0.5,
    borderColor: '#E4E4E4',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  areaBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#888888',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ABABAB',
  },
  cidadeText: {
    fontSize: 11,
    color: '#ABABAB',
  },
  connectBtn: {
    borderWidth: 0.5,
    borderColor: '#C8C8C8',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 5,
    backgroundColor: 'transparent',
  },
  connectBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B6B6B',
  },
});