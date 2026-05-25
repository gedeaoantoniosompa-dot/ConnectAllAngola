import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uploadFotoPerfil } from '../../config/utils/uploadFoto';
import { useUser } from '../../context/UserContext';

const AREAS = [
  'Engenharia', 'Medicina', 'Direito', 'Educação',
  'Economia', 'Tecnologia', 'Gestão', 'Arquitetura',
  'Comunicação', 'Psicologia', 'Finanças', 'Marketing',
  'Agricultura', 'Empreendedorismo',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, perfil, guardarPerfil, atualizarFoto } = useUser();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [nome, setNome] = useState('');
  const [bio, setBio] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cidade, setCidade] = useState('');
  const [areaSelected, setAreaSelected] = useState('');
  const [fotoLocal, setFotoLocal] = useState(null);
  const [aguardando, setAguardando] = useState(false);

  useEffect(() => {
    setNome(perfil.nome || '');
    setBio(perfil.bio || '');
    setEmpresa(perfil.empresa || '');
    setCidade(perfil.cidade || '');
    setAreaSelected(perfil.area || '');
  }, [perfil]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

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
    if (!result.canceled) {
      setFotoLocal(result.assets[0].uri);
    }
  };

  const handleGuardar = async () => {
    if (!nome.trim()) {
      alert('Por favor, insere o teu nome.');
      return;
    }
    setAguardando(true);
    try {
      if (fotoLocal && user) {
        const urlRemota = await uploadFotoPerfil(user.uid, fotoLocal);
        await atualizarFoto(urlRemota);
      }
      await guardarPerfil({
        nome,
        bio,
        empresa,
        cidade,
        area: areaSelected,
        cargo: areaSelected,
      });
      router.replace('/(main)/feed');
    } catch (err) {
      console.log('Erro ao guardar:', err);
      alert('Ocorreu um erro ao guardar o perfil. Tenta novamente.');
    } finally {
      setAguardando(false);
    }
  };

  const fotoMostrar = fotoLocal || perfil.fotoURL;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F8F8" />
      <View style={styles.bgGradient} />

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>O meu perfil</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={escolherFoto}>
              <View style={styles.avatar}>
                {fotoMostrar ? (
                  <Image source={{ uri: fotoMostrar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarIcon}>👤</Text>
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditIcon}>✏️</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              {fotoMostrar ? 'Toca para alterar a foto' : 'Toca para adicionar foto'}
            </Text>
          </View>

          <View style={styles.form}>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome completo</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="O teu nome"
                  placeholderTextColor="#ABABAB"
                  value={nome}
                  onChangeText={setNome}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Biografia</Text>
              <View style={[styles.inputWrap, { alignItems: 'flex-start' }]}>
                <TextInput
                  style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder="Fala um pouco sobre ti..."
                  placeholderTextColor="#ABABAB"
                  multiline
                  maxLength={200}
                  value={bio}
                  onChangeText={setBio}
                />
              </View>
              <Text style={styles.charCount}>{bio.length}/200</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Empresa ou Universidade</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Onde trabalhas ou estudas"
                  placeholderTextColor="#ABABAB"
                  value={empresa}
                  onChangeText={setEmpresa}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cidade</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Luanda, Benguela..."
                  placeholderTextColor="#ABABAB"
                  value={cidade}
                  onChangeText={setCidade}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Área de actuação</Text>
              <View style={styles.areasGrid}>
                {AREAS.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[styles.areaChip, areaSelected === area && styles.areaChipSelected]}
                    onPress={() => setAreaSelected(area)}
                  >
                    <Text style={[styles.areaChipText, areaSelected === area && styles.areaChipTextSelected]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>

          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={[styles.btnPrimary, aguardando && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleGuardar}
              disabled={aguardando}
            >
              {aguardando ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.btnPrimaryText}>A guardar...</Text>
                </View>
              ) : (
                <Text style={styles.btnPrimaryText}>Guardar e continuar</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0EEF8' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
    backgroundColor: '#fff',
  },
  backIcon: { fontSize: 24, color: '#1F1F1F', width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1F1F1F' },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#1677F2', overflow: 'hidden',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarIcon: { fontSize: 44 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarEditIcon: { fontSize: 13 },
  avatarHint: { fontSize: 13, color: '#6B6B6B', marginTop: 8 },
  form: { paddingHorizontal: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#1F1F1F', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 4,
    borderWidth: 1, borderColor: '#EAEAEA',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  input: { flex: 1, fontSize: 15, color: '#1F1F1F', paddingVertical: 14 },
  charCount: { fontSize: 11, color: '#ABABAB', textAlign: 'right', marginTop: 4 },
  areasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#EAEAEA', backgroundColor: '#fff',
  },
  areaChipSelected: { backgroundColor: '#1677F2', borderColor: '#1677F2' },
  areaChipText: { fontSize: 13, color: '#6B6B6B', fontWeight: '500' },
  areaChipTextSelected: { color: '#fff', fontWeight: '700' },
  btnWrap: { paddingHorizontal: 24, marginTop: 8 },
  btnPrimary: {
    backgroundColor: '#1677F2', borderRadius: 50, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});