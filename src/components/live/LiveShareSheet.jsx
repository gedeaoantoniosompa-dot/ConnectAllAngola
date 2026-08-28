// components/live/LiveShareSheet.jsx
//
// Folha de partilha de uma live: publicar no feed da app, partilhar através
// das apps nativas do telefone (WhatsApp, SMS, etc.) ou copiar o link.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { partilharLiveNoFeed } from '../../services/liveInteracoesService';

export default function LiveShareSheet({ visible, onClose, live, user }) {
  const [aPartilhar, setAPartilhar] = useState(false);

  const link = `connectallangola://watch/${live?.id}`;

  async function partilharNoFeed() {
    if (aPartilhar) return;
    setAPartilhar(true);
    try {
      await partilharLiveNoFeed(live, user);
      Alert.alert('Partilhado', 'A live foi publicada no teu feed.');
      onClose();
    } catch (e) {
      console.warn('[LiveShareSheet] Erro ao partilhar no feed:', e);
      Alert.alert('Erro', 'Não foi possível partilhar a live agora. Tenta novamente.');
    } finally {
      setAPartilhar(false);
    }
  }

  async function partilharFora() {
    try {
      await Share.share({
        message: `Estou a assistir "${live?.titulo}" ao vivo no ConnectAll Angola! ${link}`,
      });
    } catch (_) {}
  }

  async function copiarLink() {
    await Clipboard.setStringAsync(link);
    Alert.alert('Copiado', 'O link da live foi copiado.');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.titulo}>Partilhar live</Text>

          <TouchableOpacity style={styles.opcao} onPress={partilharNoFeed} disabled={aPartilhar}>
            <View style={[styles.icone, { backgroundColor: '#1677F2' }]}>
              <Ionicons name="newspaper" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.opcaoTitulo}>Partilhar no feed</Text>
              <Text style={styles.opcaoDesc}>Os teus amigos veem esta live no feed</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcao} onPress={partilharFora}>
            <View style={[styles.icone, { backgroundColor: '#25D366' }]}>
              <Ionicons name="share-social" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.opcaoTitulo}>Partilhar fora da app</Text>
              <Text style={styles.opcaoDesc}>WhatsApp, SMS, e-mail, etc.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcao} onPress={copiarLink}>
            <View style={[styles.icone, { backgroundColor: '#6B6B6B' }]}>
              <Ionicons name="link" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.opcaoTitulo}>Copiar link</Text>
              <Text style={styles.opcaoDesc} numberOfLines={1}>{link}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelarBtn} onPress={onClose}>
            <Text style={styles.cancelarText}>Cancelar</Text>
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
    gap: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADADA',
    alignSelf: 'center',
    marginBottom: 10,
  },
  titulo: { fontSize: 17, fontWeight: '800', color: '#1F1F1F', marginBottom: 10 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  opcaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
  opcaoDesc: { fontSize: 12, color: '#6B6B6B', marginTop: 1 },
  cancelarBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  cancelarText: { fontSize: 15, fontWeight: '700', color: '#EC4C89' },
});