import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';

export default function RegisterEmailScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Erro', 'Preenche todos os campos!');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As palavras-passe não coincidem!');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erro', 'A palavra-passe deve ter pelo menos 6 caracteres!');
      return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.replace('/(main)/feed'); // ✅ vai para o feed com tab bar
    } catch (error) {
      let msg = 'Erro ao criar conta. Tenta novamente.';
      if (error.code === 'auth/email-already-in-use') msg = 'Este email já está em uso.';
      if (error.code === 'auth/invalid-email') msg = 'Email inválido.';
      if (error.code === 'auth/weak-password') msg = 'Palavra-passe muito fraca.';
      Alert.alert('Erro', msg);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F8F8" />
      <View style={styles.bgGradient} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Criar conta{'\n'}com email 📧</Text>
              <Text style={styles.subtitle}>Preenche os campos abaixo para te registares</Text>
            </View>

            <View style={styles.form}>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="o_teu_email@gmail.com"
                    placeholderTextColor="#ABABAB"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Palavra-passe</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#ABABAB"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <Ionicons name="eye" size={24} color="gray" style={styles.eyeIcon} />
                    ) : (
                      <Ionicons name="eye-off" size={24} color="gray" style={styles.eyeIcon} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar palavra-passe</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Repete a palavra-passe"
                    placeholderTextColor="#ABABAB"
                    secureTextEntry={!showConfirm}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? (
                      <Ionicons name="eye" size={24} color="gray" style={styles.eyeIcon} />
                    ) : (
                      <Ionicons name="eye-off" size={24} color="gray" style={styles.eyeIcon} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'A criar conta...' : 'Criar conta'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.footerText}>
                  Já tens conta? <Text style={styles.footerLink}>Entra aqui</Text>
                </Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0EEF8' },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  backIcon: { fontSize: 24, color: '#1F1F1F' },
  header: { marginBottom: 36 },
  title: { fontSize: 30, fontWeight: '800', color: '#1F1F1F', lineHeight: 38, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B6B6B' },
  form: { marginBottom: 24 },
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
  eyeIcon: { marginLeft: 8 },
  btnPrimary: {
    backgroundColor: '#1677F2', borderRadius: 50, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    marginBottom: 24,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B6B6B' },
  footerLink: { color: '#1677F2', fontWeight: '600', textDecorationLine: 'underline' },
});