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

const CATEGORIAS = ['Todos', 'Tecnologia', 'Saúde', 'Negócios', 'Educação', 'Arte'];

const EVENTOS = [
  {
    id: '1',
    titulo: 'Hackathon Angola Tech 2026',
    data: 'Sáb, 30 Mai',
    hora: '09:00',
    local: 'Hotel Intercontinental, Luanda',
    area: 'Tecnologia',
    tipo: 'Presencial',
    inscritos: 120,
    gratuito: false,
    preco: 'USD 10',
    cor: '#1677F2',
    icon: 'laptop-outline',
    destaque: true,
  },
  {
    id: '2',
    titulo: 'Conferência de Saúde Mental',
    data: 'Dom, 01 Jun',
    hora: '14:00',
    local: 'Online — Google Meet',
    area: 'Saúde',
    tipo: 'Online',
    inscritos: 85,
    gratuito: true,
    cor: '#EC4C89',
    icon: 'heart-outline',
    destaque: false,
  },
  {
    id: '3',
    titulo: 'Workshop de Empreendedorismo',
    data: 'Ter, 03 Jun',
    hora: '10:00',
    local: 'INAPEM, Luanda',
    area: 'Negócios',
    tipo: 'Presencial',
    inscritos: 60,
    gratuito: false,
    preco: 'USD 25',
    cor: '#6A11CB',
    icon: 'briefcase-outline',
    destaque: false,
  },
  {
    id: '4',
    titulo: 'Seminário de Inovação Educacional',
    data: 'Sex, 06 Jun',
    hora: '08:00',
    local: 'Universidade Agostinho Neto',
    area: 'Educação',
    tipo: 'Presencial',
    inscritos: 200,
    gratuito: true,
    cor: '#FF8C00',
    icon: 'school-outline',
    destaque: true,
  },
  {
    id: '5',
    titulo: 'Live: Oportunidades no Mercado Digital',
    data: 'Qua, 04 Jun',
    hora: '19:00',
    local: 'Online — ConnectAll Angola',
    area: 'Tecnologia',
    tipo: 'Online',
    inscritos: 310,
    gratuito: true,
    cor: '#19D400',
    icon: 'videocam-outline',
    destaque: false,
  },
];

export default function EventsScreen() {
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [tabActiva, setTabActiva] = useState('proximos');

  const eventosFiltrados = EVENTOS.filter(e => {
    if (categoriaActiva === 'Todos') return true;
    return e.area === categoriaActiva;
  });

  const eventoDestaque = EVENTOS.find(e => e.destaque);

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Eventos</Text>
        <TouchableOpacity style={styles.criarBtn}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.criarBtnText}>Criar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'proximos', label: 'Próximos' },
            { key: 'meus', label: 'Os meus' },
            { key: 'passados', label: 'Passados' },
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

        {/* Evento destaque */}
        {eventoDestaque && (
          <TouchableOpacity style={[styles.destaqueCard, { backgroundColor: eventoDestaque.cor }]} activeOpacity={0.85}>
            <View style={styles.destaqueTop}>
              <View style={styles.destaqueBadge}>
                <Ionicons name="star" size={12} color={eventoDestaque.cor} />
                <Text style={[styles.destaqueBadgeText, { color: eventoDestaque.cor }]}>Destaque</Text>
              </View>
              <View style={styles.tipoBadge}>
                <Text style={styles.tipoBadgeText}>{eventoDestaque.tipo}</Text>
              </View>
            </View>
            <Text style={styles.destaqueTitulo}>{eventoDestaque.titulo}</Text>
            <View style={styles.destaqueInfo}>
              <View style={styles.destaqueInfoItem}>
                <Ionicons name="calendar-outline" size={14} color="#fff" />
                <Text style={styles.destaqueInfoText}>{eventoDestaque.data} · {eventoDestaque.hora}</Text>
              </View>
              <View style={styles.destaqueInfoItem}>
                <Ionicons name="location-outline" size={14} color="#fff" />
                <Text style={styles.destaqueInfoText}>{eventoDestaque.local}</Text>
              </View>
              <View style={styles.destaqueInfoItem}>
                <Ionicons name="people-outline" size={14} color="#fff" />
                <Text style={styles.destaqueInfoText}>{eventoDestaque.inscritos} inscritos</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.destaqueBtn}>
              <Text style={[styles.destaqueBtnText, { color: eventoDestaque.cor }]}>
                {eventoDestaque.gratuito ? 'Inscrever-me grátis' : `Inscrever — ${eventoDestaque.preco}`}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Categorias */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriasWrap}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
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

        {/* Lista de eventos */}
        <View style={styles.listaWrap}>
          {eventosFiltrados.map(evento => (
            <TouchableOpacity key={evento.id} style={styles.eventoCard} activeOpacity={0.85}>
              <View style={[styles.eventoIconWrap, { backgroundColor: evento.cor + '20' }]}>
                <Ionicons name={evento.icon} size={26} color={evento.cor} />
              </View>
              <View style={styles.eventoInfo}>
                <View style={styles.eventoTop}>
                  <Text style={styles.eventoTitulo} numberOfLines={2}>{evento.titulo}</Text>
                  <View style={[styles.eventoBadge, { backgroundColor: evento.cor + '20' }]}>
                    <Text style={[styles.eventoBadgeText, { color: evento.cor }]}>{evento.tipo}</Text>
                  </View>
                </View>
                <View style={styles.eventoMeta}>
                  <Ionicons name="calendar-outline" size={12} color="#6B6B6B" />
                  <Text style={styles.eventoMetaText}>{evento.data} · {evento.hora}</Text>
                </View>
                <View style={styles.eventoMeta}>
                  <Ionicons name="location-outline" size={12} color="#6B6B6B" />
                  <Text style={styles.eventoMetaText} numberOfLines={1}>{evento.local}</Text>
                </View>
                <View style={styles.eventoBottom}>
                  <View style={styles.eventoMeta}>
                    <Ionicons name="people-outline" size={12} color="#6B6B6B" />
                    <Text style={styles.eventoMetaText}>{evento.inscritos} inscritos</Text>
                  </View>
                  <TouchableOpacity style={[styles.inscBtn, { backgroundColor: evento.cor }]}>
                    <Text style={styles.inscBtnText}>
                      {evento.gratuito ? 'Grátis' : evento.preco}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
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
    flexDirection: 'row', paddingHorizontal: 16,
    paddingVertical: 12, gap: 8,
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#EAEAEA',
  },
  tabActiva: { backgroundColor: '#1677F2' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
  tabTextActiva: { color: '#fff' },
  destaqueCard: {
    margin: 16, borderRadius: 20, padding: 20, gap: 12,
  },
  destaqueTop: { flexDirection: 'row', gap: 8 },
  destaqueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  destaqueBadgeText: { fontSize: 11, fontWeight: '800' },
  tipoBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tipoBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  destaqueTitulo: { fontSize: 18, fontWeight: '800', color: '#fff', lineHeight: 24 },
  destaqueInfo: { gap: 6 },
  destaqueInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  destaqueInfoText: { fontSize: 13, color: '#fff', opacity: 0.9 },
  destaqueBtn: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingVertical: 12, alignItems: 'center',
  },
  destaqueBtnText: { fontSize: 14, fontWeight: '800' },
  categoriasWrap: { marginBottom: 12 },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#EAEAEA',
  },
  catChipActiva: { backgroundColor: '#1677F2' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
  catChipTextActiva: { color: '#fff' },
  listaWrap: { paddingHorizontal: 16, gap: 12, paddingBottom: 24 },
  eventoCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  eventoIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  eventoInfo: { flex: 1, gap: 5 },
  eventoTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  eventoTitulo: { fontSize: 14, fontWeight: '700', color: '#1F1F1F', flex: 1, lineHeight: 20 },
  eventoBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  eventoBadgeText: { fontSize: 10, fontWeight: '700' },
  eventoMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventoMetaText: { fontSize: 12, color: '#6B6B6B', flex: 1 },
  eventoBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  inscBtn: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  inscBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});