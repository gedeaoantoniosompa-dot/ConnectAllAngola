import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIAS = ['Todas', 'Tecnologia', 'Negócios', 'Saúde', 'Educação', 'Arte'];

const LIVES = [
  {
    id: '1',
    titulo: 'O futuro das startups em Angola 🚀',
    host: 'Carlos Mbemba',
    cargo: 'CEO · TechAgro Angola',
    area: 'Tecnologia',
    ouvintes: 1240,
    ao_vivo: true,
    cor: '#1677F2',
    destaque: true,
  },
  {
    id: '2',
    titulo: 'Saúde mental no ambiente de trabalho',
    host: 'Sofia Lopes',
    cargo: 'Psicóloga Clínica',
    area: 'Saúde',
    ouvintes: 890,
    ao_vivo: true,
    cor: '#EC4C89',
    destaque: false,
  },
  {
    id: '3',
    titulo: 'Como captar investimento para o teu negócio',
    host: 'Pedro Neto',
    cargo: 'Investidor · Angola Ventures',
    area: 'Negócios',
    ouvintes: 654,
    ao_vivo: true,
    cor: '#6A11CB',
    destaque: false,
  },
  {
    id: '4',
    titulo: 'Engenharia Civil em Angola — oportunidades',
    host: 'Ana Fernandes',
    cargo: 'Engenheira Civil Sénior',
    area: 'Educação',
    ouvintes: 0,
    ao_vivo: false,
    cor: '#FF8C00',
    destaque: false,
    hora: 'Hoje às 19:00',
  },
  {
    id: '5',
    titulo: 'Design gráfico para marcas angolanas',
    host: 'Lucas Ferreira',
    cargo: 'Designer · Creative Studio',
    area: 'Arte',
    ouvintes: 0,
    ao_vivo: false,
    cor: '#0D9488',
    destaque: false,
    hora: 'Amanhã às 15:00',
  },
];

export default function LiveScreen() {
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [tabActiva, setTabActiva] = useState('aoVivo');

  const livesFiltradas = LIVES.filter(l => {
    const matchCat = categoriaActiva === 'Todas' || l.area === categoriaActiva;
    const matchTab = tabActiva === 'aoVivo' ? l.ao_vivo : !l.ao_vivo;
    return matchCat && matchTab;
  });

  const liveDestaque = LIVES.find(l => l.destaque);

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live</Text>
        <TouchableOpacity style={styles.criarBtn}>
          <Ionicons name="radio" size={16} color="#fff" />
          <Text style={styles.criarBtnText}>Ir ao vivo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tabActiva === 'aoVivo' && styles.tabActiva]}
            onPress={() => setTabActiva('aoVivo')}
          >
            <View style={styles.tabInner}>
              {tabActiva === 'aoVivo' && <View style={styles.liveDot} />}
              <Text style={[styles.tabText, tabActiva === 'aoVivo' && styles.tabTextActiva]}>
                Ao vivo
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tabActiva === 'agendadas' && styles.tabActiva]}
            onPress={() => setTabActiva('agendadas')}
          >
            <Text style={[styles.tabText, tabActiva === 'agendadas' && styles.tabTextActiva]}>
              Agendadas
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live destaque */}
        {tabActiva === 'aoVivo' && liveDestaque && (
          <TouchableOpacity
            style={[styles.destaqueCard, { backgroundColor: liveDestaque.cor }]}
            activeOpacity={0.85}
          >
            <View style={styles.destaqueTop}>
              <View style={styles.liveAoVivoBadge}>
                <View style={styles.liveDotWhite} />
                <Text style={styles.liveAoVivoText}>AO VIVO</Text>
              </View>
              <View style={styles.ouvintesWrap}>
                <Ionicons name="people" size={14} color="#fff" />
                <Text style={styles.ouvintesText}>{liveDestaque.ouvintes.toLocaleString()}</Text>
              </View>
            </View>

            <Text style={styles.destaqueTitulo}>{liveDestaque.titulo}</Text>

            <View style={styles.destaqueHost}>
              <View style={styles.destaqueAvatar}>
                <Text style={styles.destaqueAvatarText}>{liveDestaque.host[0]}</Text>
              </View>
              <View>
                <Text style={styles.destaqueHostNome}>{liveDestaque.host}</Text>
                <Text style={styles.destaqueHostCargo}>{liveDestaque.cargo}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.assistirBtn}>
              <Ionicons name="play-circle" size={18} color={liveDestaque.cor} />
              <Text style={[styles.assistirBtnText, { color: liveDestaque.cor }]}>
                Assistir agora
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Categorias */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}
        >
          {CATEGORIAS.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, categoriaActiva === cat && styles.catChipActiva]}
              onPress={() => setCategoriaActiva(cat)}
            >
              <Text style={[styles.catChipText, categoriaActiva === cat && styles.catChipTextActiva]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista de lives */}
        <View style={styles.listaWrap}>
          {livesFiltradas.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="radio-outline" size={48} color="#ABABAB" />
              <Text style={styles.emptyText}>Nenhuma live encontrada</Text>
            </View>
          ) : (
            livesFiltradas.map(live => (
              <TouchableOpacity key={live.id} style={styles.liveCard} activeOpacity={0.85}>

                {/* Avatar e info */}
                <View style={styles.liveCardTop}>
                  <View style={[styles.liveAvatar, { backgroundColor: live.cor }]}>
                    <Text style={styles.liveAvatarText}>{live.host[0]}</Text>
                    {live.ao_vivo && (
                      <View style={styles.liveAvatarBadge}>
                        <Text style={styles.liveAvatarBadgeText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.liveInfo}>
                    <Text style={styles.liveTitulo} numberOfLines={2}>{live.titulo}</Text>
                    <Text style={styles.liveHostNome}>{live.host}</Text>
                    <Text style={styles.liveHostCargo}>{live.cargo}</Text>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.liveCardBottom}>
                  <View style={[styles.areaBadge, { backgroundColor: live.cor + '18' }]}>
                    <Text style={[styles.areaBadgeText, { color: live.cor }]}>{live.area}</Text>
                  </View>
                  {live.ao_vivo ? (
                    <View style={styles.ouvintesRow}>
                      <Ionicons name="people-outline" size={13} color="#6B6B6B" />
                      <Text style={styles.ouvintesRowText}>{live.ouvintes.toLocaleString()} a assistir</Text>
                    </View>
                  ) : (
                    <View style={styles.ouvintesRow}>
                      <Ionicons name="time-outline" size={13} color="#6B6B6B" />
                      <Text style={styles.ouvintesRowText}>{live.hora}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={[styles.liveBtn, { backgroundColor: live.ao_vivo ? live.cor : '#F5F7FA' }]}>
                  {live.ao_vivo ? (
                    <>
                      <Ionicons name="play-circle" size={16} color="#fff" />
                      <Text style={styles.liveBtnTextWhite}>Assistir</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="notifications-outline" size={16} color="#1677F2" />
                      <Text style={styles.liveBtnTextBlue}>Lembrar-me</Text>
                    </>
                  )}
                </TouchableOpacity>

              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fabBtn}>
        <Ionicons name="radio" size={24} color="#fff" />
      </TouchableOpacity>

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
  title: { fontSize: 22, fontWeight: '800', color: '#1F1F1F' },
  criarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EC4C89', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  criarBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActiva: { borderBottomColor: '#1677F2' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B6B6B' },
  tabTextActiva: { color: '#1677F2' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EC4C89' },
  destaqueCard: {
    margin: 16, borderRadius: 20, padding: 20, gap: 14,
  },
  destaqueTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveAoVivoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDotWhite: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveAoVivoText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  ouvintesWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ouvintesText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  destaqueTitulo: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 28 },
  destaqueHost: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  destaqueAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  destaqueAvatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  destaqueHostNome: { fontSize: 14, fontWeight: '700', color: '#fff' },
  destaqueHostCargo: { fontSize: 12, color: '#fff', opacity: 0.8 },
  assistirBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12,
  },
  assistirBtnText: { fontSize: 14, fontWeight: '800' },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#EAEAEA',
  },
  catChipActiva: { backgroundColor: '#1677F2' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
  catChipTextActiva: { color: '#fff' },
  listaWrap: { paddingHorizontal: 16, gap: 12, paddingBottom: 100 },
  liveCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12,
  },
  liveCardTop: { flexDirection: 'row', gap: 12 },
  liveAvatar: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  liveAvatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  liveAvatarBadge: {
    position: 'absolute', bottom: -4, left: '50%',
    backgroundColor: '#EC4C89', borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1.5, borderColor: '#fff',
  },
  liveAvatarBadgeText: { fontSize: 8, color: '#fff', fontWeight: '800' },
  liveInfo: { flex: 1, gap: 3 },
  liveTitulo: { fontSize: 14, fontWeight: '700', color: '#1F1F1F', lineHeight: 20 },
  liveHostNome: { fontSize: 13, fontWeight: '600', color: '#1F1F1F' },
  liveHostCargo: { fontSize: 12, color: '#6B6B6B' },
  liveCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  areaBadgeText: { fontSize: 11, fontWeight: '700' },
  ouvintesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ouvintesRowText: { fontSize: 12, color: '#6B6B6B' },
  liveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 20, paddingVertical: 10,
  },
  liveBtnTextWhite: { color: '#fff', fontSize: 14, fontWeight: '700' },
  liveBtnTextBlue: { color: '#1677F2', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#ABABAB' },
  fabBtn: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#EC4C89', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#EC4C89', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});