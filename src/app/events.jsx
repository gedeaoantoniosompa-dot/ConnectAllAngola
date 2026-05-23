import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const EVENTS = [
  { id: '1', title: 'Workshop de Empreendedorismo', date: '28 Mai', local: 'Luanda', area: 'Negócios', icon: 'briefcase' },
  { id: '2', title: 'Conferência de Tecnologia Angola', date: '02 Jun', local: 'Luanda', area: 'Tecnologia', icon: 'laptop' },
  { id: '3', title: 'Seminário de Medicina Tropical', date: '10 Jun', local: 'Benguela', area: 'Medicina', icon: 'medkit' },
  { id: '4', title: 'Hackathon Nacional 2026', date: '15 Jun', local: 'Online', area: 'Tecnologia', icon: 'code-slash' },
];

export default function EventsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Eventos</Text>
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="filter" size={20} color="#1677F2" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {EVENTS.map(event => (
          <TouchableOpacity key={event.id} style={styles.card} activeOpacity={0.85}>
            <View style={styles.cardLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name={event.icon} size={22} color="#1677F2" />
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <View style={styles.cardMeta}>
                <Ionicons name="calendar-outline" size={13} color="#6B6B6B" />
                <Text style={styles.cardMetaText}>{event.date}</Text>
                <Ionicons name="location-outline" size={13} color="#6B6B6B" />
                <Text style={styles.cardMetaText}>{event.local}</Text>
              </View>
              <View style={styles.areaBadge}>
                <Text style={styles.areaBadgeText}>{event.area}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
          </TouchableOpacity>
        ))}
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
  filterBtn: { padding: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    gap: 12,
  },
  cardLeft: { alignItems: 'center' },
  iconWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 12, color: '#6B6B6B', marginRight: 6 },
  areaBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EEF4FF',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  areaBadgeText: { fontSize: 11, color: '#1677F2', fontWeight: '600' },
});