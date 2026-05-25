import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import { uploadFotoPerfil } from '../../config/utils/uploadFoto';
import { useUser } from '../../context/UserContext';

const STATS = [
  { label: 'Conexões', valor: '248' },
  { label: 'Publicações', valor: '34' },
  { label: 'Seguidores', valor: '1.2k' },
];

const CONQUISTAS = [
  { id: '1', icon: 'trophy', label: 'Top Tecnologia', cor: '#FBBC05' },
  { id: '2', icon: 'star', label: 'Colaborador', cor: '#1677F2' },
  { id: '3', icon: 'ribbon', label: 'Especialista', cor: '#EC4C89' },
];

const MENU_ITEMS = [
  { id: '1', icon: 'bookmark-outline', label: 'Publicações guardadas', cor: '#1677F2' },
  { id: '2', icon: 'briefcase-outline', label: 'Oportunidades', cor: '#0D9488' },
  { id: '3', icon: 'people-outline', label: 'As minhas conexões', cor: '#7C3AED' },
  { id: '4', icon: 'calendar-outline', label: 'Os meus eventos', cor: '#EA580C' },
  { id: '5', icon: 'mic-outline', label: 'Salas criadas', cor: '#EC4C89' },
  { id: '6', icon: 'settings-outline', label: 'Definições', cor: '#6B6B6B' },
  { id: '7', icon: 'help-circle-outline', label: 'Ajuda e suporte', cor: '#6B6B6B' },
];

export default function MyProfileScreen() {
  const router = useRouter();
  const { user, perfil, atualizarFoto } = useUser();
  const [uploadandoFoto, setUploadandoFoto] = useState(false);

  const escolherFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Precisamos de permissão para aceder às tuas fotos!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && user) {
      setUploadandoFoto(true);
      try {
        const urlRemota = await uploadFotoPerfil(user.uid, result.assets[0].uri);
        await atualizarFoto(urlRemota);
      } catch (err) {
        console.log('Erro upload foto:', err);
        alert('Erro ao guardar a foto. Tenta novamente.');
      } finally {
        setUploadandoFoto(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)');
    } catch (error) {
      console.log(error);
    }
  };

  const nomeExibir = perfil.nome || 'O teu nome';
  const cargoExibir = perfil.area || perfil.cargo || 'A tua área profissional';
  const cidadeExibir = perfil.cidade || 'Luanda, Angola';
  const bioExibir = perfil.bio || 'Adiciona uma biografia para te apresentares à comunidade ConnectAll Angola';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>O meu perfil</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color="#1F1F1F" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.capaWrap}>
          <View style={styles.capa} />
          <View style={styles.avatarWrap}>
            <TouchableOpacity onPress={escolherFoto} activeOpacity={0.85} disabled={uploadandoFoto}>
              <View style={styles.avatar}>
                {uploadandoFoto ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : perfil.fotoURL ? (
                  <Image source={{ uri: perfil.fotoURL }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={44} color="#fff" />
                )}
              </View>
              <View style={styles.avatarEditBtn}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoWrap}>
          <Text style={styles.nome}>{nomeExibir}</Text>
          <Text style={styles.cargo}>{cargoExibir}</Text>
          <View style={styles.locWrap}>
            <Ionicons name="location-outline" size={14} color="#6B6B6B" />
            <Text style={styles.locText}>{cidadeExibir}</Text>
          </View>
          <Text style={styles.bio}>{bioExibir}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/(auth)/profile')}>
            <Ionicons name="create-outline" size={16} color="#1677F2" />
            <Text style={styles.editBtnText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsWrap}>
          {STATS.map((stat, i) => (
            <View key={i} style={[styles.statItem, i < STATS.length - 1 && styles.statBorder]}>
              <Text style={styles.statValor}>{stat.valor}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conquistas</Text>
          <View style={styles.conquistasWrap}>
            {CONQUISTAS.map(c => (
              <View key={c.id} style={styles.conquistaItem}>
                <View style={[styles.conquistaIcon, { backgroundColor: c.cor + '20' }]}>
                  <Ionicons name={c.icon} size={22} color={c.cor} />
                </View>
                <Text style={styles.conquistaLabel}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.menuWrap}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity key={item.id} style={styles.menuItem} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: item.cor + '18' }]}>
                <Ionicons name={item.icon} size={20} color={item.cor} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Terminar sessão</Text>
        </TouchableOpacity>

      </ScrollView>
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
  settingsBtn: { padding: 4 },
  capaWrap: { alignItems: 'center', marginBottom: 50 },
  capa: { width: '100%', height: 120, backgroundColor: '#1677F2' },
  avatarWrap: { position: 'absolute', bottom: -48 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#6A11CB', alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
    overflow: 'hidden',
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarEditBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  infoWrap: { alignItems: 'center', paddingHorizontal: 24, gap: 6, marginBottom: 16 },
  nome: { fontSize: 22, fontWeight: '800', color: '#1F1F1F' },
  cargo: { fontSize: 14, color: '#6B6B6B', fontWeight: '500' },
  locWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText: { fontSize: 13, color: '#6B6B6B' },
  bio: { fontSize: 13, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#1677F2', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 4,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#1677F2' },
  statsWrap: {
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 16, borderRadius: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statBorder: { borderRightWidth: 0.5, borderRightColor: '#EAEAEA' },
  statValor: { fontSize: 20, fontWeight: '800', color: '#1F1F1F' },
  statLabel: { fontSize: 12, color: '#6B6B6B', fontWeight: '500' },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F', marginBottom: 12 },
  conquistasWrap: { flexDirection: 'row', gap: 12 },
  conquistaItem: { alignItems: 'center', gap: 6 },
  conquistaIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  conquistaLabel: { fontSize: 11, color: '#6B6B6B', fontWeight: '600', textAlign: 'center' },
  menuWrap: {
    backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#F5F7FA',
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1F1F1F' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FEF2F2', borderRadius: 16,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});