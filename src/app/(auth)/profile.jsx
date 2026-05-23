
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AREAS = [
  'Engenharia', 'Medicina', 'Direito', 'Educação',
  'Economia', 'Tecnologia', 'Gestão', 'Arquitetura',
  'Comunicação', 'Psicologia', 'Finanças', 'Marketing',
  'Agricultura', 'Empreendedorismo',
];

export default function ProfileScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [nome, setNome] = useState('');
  const [bio, setBio] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cidade, setCidade] = useState('');
  const [areaSelected, setAreaSelected] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F8F8" />
      <View style={styles.bgGradient} />

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>O meu perfil</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarIcon}>👤</Text>
              </View>
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditIcon}>✏️</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Toca para adicionar foto</Text>
          </View>

          <View style={styles.form}>

            {/* Nome */}
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

            {/* Bio */}
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

            {/* Empresa / Universidade */}
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

            {/* Cidade */}
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

            {/* Área de actuação */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Área de actuação</Text>
              <View style={styles.areasGrid}>
                {AREAS.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[
                      styles.areaChip,
                      areaSelected === area && styles.areaChipSelected,
                    ]}
                    onPress={() => setAreaSelected(area)}
                  >
                    <Text style={[
                      styles.areaChipText,
                      areaSelected === area && styles.areaChipTextSelected,
                    ]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>

          {/* Botão guardar */}
          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={styles.btnPrimary}
              activeOpacity={0.85}
              onPress={() => router.replace('/(main)/feed')}
            >
              <Text style={styles.btnPrimaryText}>Guardar e continuar</Text>
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
    borderWidth: 3, borderColor: '#1677F2',
  },
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
    borderRadius: 20, borderWidth: 1.5, borderColor: '#EAEAEA',
    backgroundColor: '#fff',
  },
  areaChipSelected: {
    backgroundColor: '#1677F2', borderColor: '#1677F2',
  },
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