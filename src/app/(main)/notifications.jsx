import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NOTIFICACOES = [
  {
    id: '1',
    tipo: 'conexao',
    icon: 'person-add',
    cor: '#1677F2',
    titulo: 'Ana Fernandes quer conectar-se contigo',
    tempo: '2m',
    lida: false,
  },
  {
    id: '2',
    tipo: 'gosto',
    icon: 'heart',
    cor: '#EC4C89',
    titulo: 'Carlos Mbemba gostou da tua publicação',
    tempo: '15m',
    lida: false,
  },
  {
    id: '3',
    tipo: 'comentario',
    icon: 'chatbubble',
    cor: '#6A11CB',
    titulo: 'Sofia Lopes comentou: "Parabéns pela conquista! 🎓"',
    tempo: '1h',
    lida: false,
  },
  {
    id: '4',
    tipo: 'evento',
    icon: 'calendar',
    cor: '#FF8C00',
    titulo: 'O evento "Hackathon Angola Tech" começa amanhã!',
    tempo: '2h',
    lida: true,
  },
  {
    id: '5',
    tipo: 'live',
    icon: 'radio',
    cor: '#EC4C89',
    titulo: 'Pedro Neto iniciou uma live: "Direito angolano 2026"',
    tempo: '3h',
    lida: true,
  },
  {
    id: '6',
    tipo: 'conexao',
    icon: 'person-add',
    cor: '#1677F2',
    titulo: 'Maria João aceitou o teu pedido de conexão',
    tempo: '5h',
    lida: true,
  },
  {
    id: '7',
    tipo: 'partilha',
    icon: 'share-social',
    cor: '#19D400',
    titulo: 'Lucas Ferreira partilhou a tua publicação',
    tempo: '1d',
    lida: true,
  },
  {
    id: '8',
    tipo: 'oportunidade',
    icon: 'briefcase',
    cor: '#0D9488',
    titulo: 'Nova vaga: Desenvolvedor React Native em TechAngola',
    tempo: '1d',
    lida: true,
  },
  {
    id: '9',
    tipo: 'conquista',
    icon: 'trophy',
    cor: '#FBBC05',
    titulo: 'Parabéns! Atingiste 100 conexões na ConnectAll Angola 🎉',
    tempo: '2d',
    lida: true,
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState(NOTIFICACOES);
  const [tabActiva, setTabActiva] = useState('todas');

  const marcarTodasLidas = () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const marcarLida = (id) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const notificacoesFiltradas = tabActiva === 'todas'
    ? notificacoes
    : notificacoes.filter(n => !n.lida);

  const renderNotificacao = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, !item.lida && styles.cardNaoLida]}
      activeOpacity={0.85}
      onPress={() => marcarLida(item.id)}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.cor + '20' }]}>
        <Ionicons name={item.icon} size={22} color={item.cor} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitulo, !item.lida && styles.cardTituloNaoLido]}>
          {item.titulo}
        </Text>
        <Text style={styles.cardTempo}>{item.tempo} atrás</Text>
      </View>
      {!item.lida && <View style={styles.dotNaoLida} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F1F1F" />
        </TouchableOpacity>
        <Text style={styles.title}>Notificações</Text>
        {naoLidas > 0 && (
          <TouchableOpacity onPress={marcarTodasLidas}>
            <Text style={styles.marcarBtn}>Marcar todas</Text>
          </TouchableOpacity>
        )}
        {naoLidas === 0 && <View style={{ width: 80 }} />}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'todas' && styles.tabActiva]}
          onPress={() => setTabActiva('todas')}
        >
          <Text style={[styles.tabText, tabActiva === 'todas' && styles.tabTextActiva]}>
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'naoLidas' && styles.tabActiva]}
          onPress={() => setTabActiva('naoLidas')}
        >
          <Text style={[styles.tabText, tabActiva === 'naoLidas' && styles.tabTextActiva]}>
            Não lidas {naoLidas > 0 && `(${naoLidas})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <FlatList
        data={notificacoesFiltradas}
        keyExtractor={item => item.id}
        renderItem={renderNotificacao}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color="#ABABAB" />
            <Text style={styles.emptyText}>Nenhuma notificação</Text>
          </View>
        )}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1F1F1F' },
  marcarBtn: { fontSize: 13, fontWeight: '600', color: '#1677F2' },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActiva: { borderBottomColor: '#1677F2' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B6B6B' },
  tabTextActiva: { color: '#1677F2' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', gap: 12,
  },
  cardNaoLida: { backgroundColor: '#EEF4FF' },
  iconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 4 },
  cardTitulo: { fontSize: 14, color: '#6B6B6B', lineHeight: 20 },
  cardTituloNaoLido: { color: '#1F1F1F', fontWeight: '600' },
  cardTempo: { fontSize: 12, color: '#ABABAB' },
  dotNaoLida: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1677F2', flexShrink: 0,
  },
  separator: { height: 0.5, backgroundColor: '#EAEAEA' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: '#ABABAB' },
});