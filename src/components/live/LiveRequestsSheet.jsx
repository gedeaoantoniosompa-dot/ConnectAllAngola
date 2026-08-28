// components/live/LiveRequestsSheet.jsx
//
// Lista de pedidos para subir ao palco, vista pelo host. Permite aceitar
// (o espectador passa a co-apresentador, com câmara e microfone) ou recusar.

import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LiveRequestsSheet({ visible, onClose, pedidos, onResponder }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.titulo}>Pedidos para subir ao palco</Text>

          {pedidos.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="hand-left-outline" size={36} color="#ABABAB" />
              <Text style={styles.vazioText}>Sem pedidos por agora</Text>
            </View>
          ) : (
            <FlatList
              data={pedidos}
              keyExtractor={(item) => item.uid}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <View style={styles.linha}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.nome?.[0] || '?'}</Text>
                  </View>
                  <Text style={styles.nome} numberOfLines={1}>{item.nome}</Text>
                  <TouchableOpacity style={styles.recusarBtn} onPress={() => onResponder(item, false)}>
                    <Ionicons name="close" size={18} color="#EC4C89" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.aceitarBtn} onPress={() => onResponder(item, true)}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          <TouchableOpacity style={styles.fecharBtn} onPress={onClose}>
            <Text style={styles.fecharText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADADA',
    alignSelf: 'center',
    marginBottom: 6,
  },
  titulo: { fontSize: 17, fontWeight: '800', color: '#1F1F1F', marginBottom: 6 },
  vazio: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  vazioText: { color: '#ABABAB', fontSize: 14 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1677F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800' },
  nome: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  recusarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FCE8EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aceitarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1677F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fecharBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  fecharText: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },
});