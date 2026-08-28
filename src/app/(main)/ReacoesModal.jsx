import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';

export default function ReacoesModal() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const [reacoes, setReacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, 'posts', postId, 'reacoes'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [postId]);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Image source={item.foto ? { uri: item.foto } : require('../../../assets/logo2.png')} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.nome}>{item.nome}</Text>
      </View>
      <Text style={styles.emoji}>{item.emoji}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#1F1F1F" />
        </TouchableOpacity>
        <Text style={styles.title}>Reações</Text>
        <View style={{ width: 28 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#1677F2" />
      ) : (
        <FlatList
          data={reacoes}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma reação ainda.</Text>}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA' },
  title: { fontSize: 18, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAEAEA' },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '600' },
  emoji: { fontSize: 24 },
  empty: { textAlign: 'center', marginTop: 40, color: '#ABABAB' }
});