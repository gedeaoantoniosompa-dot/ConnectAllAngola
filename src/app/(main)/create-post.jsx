import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const TIPOS = [
  { id: 'conquista', icon: 'trophy-outline', label: 'Conquista', cor: '#FBBC05' },
  { id: 'ideia', icon: 'bulb-outline', label: 'Ideia', cor: '#1677F2' },
  { id: 'oportunidade', icon: 'briefcase-outline', label: 'Oportunidade', cor: '#0D9488' },
  { id: 'artigo', icon: 'newspaper-outline', label: 'Artigo', cor: '#7C3AED' },
];

export default function CreatePostScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const [texto, setTexto] = useState('');
  const [tipoSelected, setTipoSelected] = useState('conquista');
  const [publicando, setPublicando] = useState(false);

  const handlePublicar = async () => {
    if (!texto.trim()) {
      alert('Escreve algo antes de publicar.');
      return;
    }
    if (!user) return;

    setPublicando(true);
    try {
      await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        autorNome: perfil.nome || 'Utilizador',
        autorFoto: perfil.fotoURL || null,
        autorCargo: perfil.area || perfil.cargo || '',
        autorCidade: perfil.cidade || '',
        texto: texto.trim(),
        tipo: tipoSelected,
        likes: 0,
        likedBy: [],
        comentarios: 0,
        partilhas: 0,
        timestamp: serverTimestamp(),
      });
      router.back();
    } catch (err) {
      console.log('Erro ao publicar:', err);
      alert('Erro ao publicar. Tenta novamente.');
    } finally {
      setPublicando(false);
    }
  };

  const tipoAtual = TIPOS.find(t => t.id === tipoSelected);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova publicação</Text>
          <TouchableOpacity
            style={[styles.publicarBtn, (!texto.trim() || publicando) && { opacity: 0.5 }]}
            onPress={handlePublicar}
            disabled={!texto.trim() || publicando}
          >
            {publicando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.publicarText}>Publicar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Autor */}
        <View style={styles.autorWrap}>
          <View style={styles.avatar}>
            {perfil.fotoURL ? (
              <Image source={{ uri: perfil.fotoURL }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={22} color="#fff" />
            )}
          </View>
          <View>
            <Text style={styles.autorNome}>{perfil.nome || 'O teu nome'}</Text>
            <View style={[styles.tipoBadge, { backgroundColor: tipoAtual.cor + '20' }]}>
              <Ionicons name={tipoAtual.icon} size={11} color={tipoAtual.cor} />
              <Text style={[styles.tipoBadgeText, { color: tipoAtual.cor }]}>{tipoAtual.label}</Text>
            </View>
          </View>
        </View>

        {/* Texto */}
        <TextInput
          style={styles.input}
          placeholder="Partilha uma conquista, ideia ou oportunidade..."
          placeholderTextColor="#ABABAB"
          multiline
          autoFocus
          value={texto}
          onChangeText={setTexto}
          maxLength={1000}
        />
        <Text style={styles.charCount}>{texto.length}/1000</Text>

        {/* Tipo de publicação */}
        <View style={styles.tiposWrap}>
          <Text style={styles.tiposLabel}>Tipo de publicação</Text>
          <View style={styles.tiposRow}>
            {TIPOS.map(tipo => (
              <TouchableOpacity
                key={tipo.id}
                style={[
                  styles.tipoChip,
                  tipoSelected === tipo.id && { backgroundColor: tipo.cor, borderColor: tipo.cor },
                ]}
                onPress={() => setTipoSelected(tipo.id)}
              >
                <Ionicons
                  name={tipo.icon}
                  size={14}
                  color={tipoSelected === tipo.id ? '#fff' : tipo.cor}
                />
                <Text style={[
                  styles.tipoChipText,
                  tipoSelected === tipo.id && { color: '#fff' },
                ]}>
                  {tipo.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 15, color: '#6B6B6B', fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  publicarBtn: {
    backgroundColor: '#1677F2', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  publicarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  autorWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 46, height: 46, borderRadius: 23 },
  autorNome: { fontSize: 15, fontWeight: '700', color: '#1F1F1F', marginBottom: 4 },
  tipoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start',
  },
  tipoBadgeText: { fontSize: 11, fontWeight: '600' },
  input: {
    flex: 1, fontSize: 16, color: '#1F1F1F',
    paddingHorizontal: 16, paddingTop: 4,
    textAlignVertical: 'top', lineHeight: 24,
  },
  charCount: { fontSize: 11, color: '#ABABAB', textAlign: 'right', paddingHorizontal: 16, paddingBottom: 8 },
  tiposWrap: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 0.5, borderTopColor: '#EAEAEA',
  },
  tiposLabel: { fontSize: 12, fontWeight: '600', color: '#6B6B6B', marginBottom: 10 },
  tiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#EAEAEA',
    backgroundColor: '#fff',
  },
  tipoChipText: { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
});