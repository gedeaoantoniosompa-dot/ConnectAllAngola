import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FEIRA_SALAS = [
  {
    id: '1',
    area: '💻 Tecnologia',
    titulo: 'O futuro das startups em Angola',
    descricao: 'Debate aberto sobre oportunidades no ecossistema tech angolano. Todos os níveis.',
    hosts: ['Carlos M.', 'Ana F.'],
    microfones: 13,
    ouvintes: 54,
    ao_vivo: true,
  },
  {
    id: '2',
    area: '⚕️ Medicina · 💼 Negócios',
    titulo: 'Empreendedorismo na área da saúde',
    descricao: 'Como criar um negócio sustentável na área da saúde em Angola.',
    hosts: ['Sofia L.'],
    microfones: 10,
    ouvintes: 11,
    ao_vivo: true,
  },
  {
    id: '3',
    area: '⚖️ Direito',
    titulo: 'Novidades jurídicas 2026 — o que muda?',
    descricao: 'Discussão sobre as principais mudanças legais este ano em Angola.',
    hosts: ['Pedro N.', 'Maria J.'],
    microfones: 8,
    ouvintes: 32,
    ao_vivo: false,
  },
  {
    id: '4',
    area: '🎨 Arte · 📱 Tecnologia',
    titulo: 'Design e criatividade na era digital',
    descricao: 'Como unir arte e tecnologia para criar produtos inovadores.',
    hosts: ['Lucas F.'],
    microfones: 5,
    ouvintes: 21,
    ao_vivo: false,
  },
];

const CLUBE_SALAS = [
  {
    id: '1',
    area: '💡 Inovação',
    titulo: 'Clube de Inovadores de Angola',
    descricao: 'Encontro semanal de inovadores e criadores de soluções para Angola.',
    hosts: ['Ana F.', 'Carlos M.'],
    microfones: 20,
    ouvintes: 80,
    membros: 340,
  },
  {
    id: '2',
    area: '📚 Educação',
    titulo: 'Clube de Leitura Profissional',
    descricao: 'Lemos e debatemos livros de desenvolvimento pessoal e profissional.',
    hosts: ['Sofia L.'],
    microfones: 8,
    ouvintes: 45,
    membros: 210,
  },
  {
    id: '3',
    area: '🚀 Startups',
    titulo: 'Founders de Angola',
    descricao: 'Espaço exclusivo para fundadores de startups angolanas partilharem experiências.',
    hosts: ['Pedro N.'],
    microfones: 12,
    ouvintes: 67,
    membros: 180,
  },
];

export default function ComunidadeScreen() {
  const [tabActiva, setTabActiva] = useState('feira');

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Comunidade</Text>
        {tabActiva === 'feira' && (
          <TouchableOpacity style={styles.criarBtn}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.criarBtnText}>Criar sala</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'feira' && styles.tabActiva]}
          onPress={() => setTabActiva('feira')}
        >
          <Text style={[styles.tabText, tabActiva === 'feira' && styles.tabTextActiva]}>
            Feira do Saber
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'clube' && styles.tabActiva]}
          onPress={() => setTabActiva('clube')}
        >
          <Text style={[styles.tabText, tabActiva === 'clube' && styles.tabTextActiva]}>
            Clube do Saber
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>

        {tabActiva === 'feira' ? (
          <>
            {FEIRA_SALAS.map(sala => (
              <TouchableOpacity key={sala.id} style={styles.card} activeOpacity={0.85}>

                <View style={styles.cardTop}>
                  <Text style={styles.cardArea}>{sala.area}</Text>
                  <TouchableOpacity>
                    <Ionicons name="ellipsis-vertical" size={18} color="#6B6B6B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.cardTitulo}>{sala.titulo}</Text>
                <Text style={styles.cardDescricao}>{sala.descricao}</Text>

                <View style={styles.cardBottom}>
                  <View style={styles.hostsWrap}>
                    {sala.hosts.map((host, i) => (
                      <View key={i} style={[styles.hostAvatar, { backgroundColor: ['#1677F2', '#6A11CB', '#EC4C89'][i % 3] }]}>
                        <Text style={styles.hostAvatarText}>{host[0]}</Text>
                      </View>
                    ))}
                    <View style={styles.hostsNames}>
                      {sala.hosts.map((host, i) => (
                        <Text key={i} style={styles.hostNome}>{host}</Text>
                      ))}
                    </View>
                  </View>
                  <View style={styles.stats}>
                    <View style={styles.statItem}>
                      <Ionicons name="mic-outline" size={14} color="#6B6B6B" />
                      <Text style={styles.statText}>{sala.microfones}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="headset-outline" size={14} color="#6B6B6B" />
                      <Text style={styles.statText}>{sala.ouvintes}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={sala.ao_vivo ? styles.entrarBtn : styles.lembreteBtn}>
                  {sala.ao_vivo ? (
                    <>
                      <Ionicons name="mic-outline" size={16} color="#fff" />
                      <Text style={styles.entrarBtnText}>Entrar na sala</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="notifications-outline" size={16} color="#1677F2" />
                      <Text style={styles.lembreteBtnText}>Lembrar-me</Text>
                    </>
                  )}
                </TouchableOpacity>

              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            {CLUBE_SALAS.map(clube => (
              <TouchableOpacity key={clube.id} style={styles.card} activeOpacity={0.85}>

                <View style={styles.cardTop}>
                  <Text style={styles.cardArea}>{clube.area}</Text>
                  <TouchableOpacity>
                    <Ionicons name="ellipsis-vertical" size={18} color="#6B6B6B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.cardTitulo}>{clube.titulo}</Text>
                <Text style={styles.cardDescricao}>{clube.descricao}</Text>

                <View style={styles.cardBottom}>
                  <View style={styles.hostsWrap}>
                    {clube.hosts.map((host, i) => (
                      <View key={i} style={[styles.hostAvatar, { backgroundColor: ['#1677F2', '#6A11CB', '#EC4C89'][i % 3] }]}>
                        <Text style={styles.hostAvatarText}>{host[0]}</Text>
                      </View>
                    ))}
                    <View style={styles.hostsNames}>
                      {clube.hosts.map((host, i) => (
                        <Text key={i} style={styles.hostNome}>{host}</Text>
                      ))}
                    </View>
                  </View>
                  <View style={styles.stats}>
                    <View style={styles.statItem}>
                      <Ionicons name="people-outline" size={14} color="#6B6B6B" />
                      <Text style={styles.statText}>{clube.membros}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.entrarBtn}>
                  <Ionicons name="people-outline" size={16} color="#fff" />
                  <Text style={styles.entrarBtnText}>Juntar-me ao clube</Text>
                </TouchableOpacity>

              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>

      {/* FAB - só na Feira */}
      {tabActiva === 'feira' && (
        <TouchableOpacity style={styles.fabBtn}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

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
  criarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1677F2', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  criarBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
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
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardArea: { fontSize: 13, color: '#6B6B6B', fontWeight: '500' },
  cardTitulo: { fontSize: 17, fontWeight: '800', color: '#1F1F1F', lineHeight: 24 },
  cardDescricao: { fontSize: 13, color: '#6B6B6B', lineHeight: 20 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hostsWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  hostAvatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  hostsNames: { gap: 1 },
  hostNome: { fontSize: 12, color: '#6B6B6B', fontWeight: '500' },
  stats: { flexDirection: 'row', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: '#6B6B6B', fontWeight: '600' },
  entrarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1677F2', borderRadius: 20, paddingVertical: 10,
  },
  entrarBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lembreteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#EEF4FF', borderRadius: 20, paddingVertical: 10,
  },
  lembreteBtnText: { color: '#1677F2', fontSize: 14, fontWeight: '700' },
  fabBtn: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});