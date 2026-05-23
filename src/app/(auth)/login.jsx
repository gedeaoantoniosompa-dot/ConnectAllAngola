import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
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

export default function LoginScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preenche o email e a palavra-passe!');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(main)/feed');
    } catch (error) {
      let msg = 'Erro ao entrar. Tenta novamente.';
      if (error.code === 'auth/user-not-found') msg = 'Utilizador não encontrado.';
      if (error.code === 'auth/wrong-password') msg = 'Palavra-passe incorrecta.';
      if (error.code === 'auth/invalid-email') msg = 'Email inválido.';
      Alert.alert('Erro', msg);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F8F8" />
      <View style={styles.bgGradient} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Bem-vindo(a){'\n'}de volta! 👋</Text>
              <Text style={styles.subtitle}>Entra na tua conta ConnectAll Angola</Text>
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
                    placeholder="A tua palavra-passe"
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

              <TouchableOpacity style={styles.forgotWrap}>
                <Text style={styles.forgotText}>Esqueceste a palavra-passe?</Text>
              </TouchableOpacity>

            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'A entrar...' : 'Entrar'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou continua com</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtons}>

              <TouchableOpacity style={styles.socialBtn}>
                <Text style={styles.socialBtnText}>
                  <Text style={{ color: '#4285F4' }}>G</Text>
                  <Text style={{ color: '#EA4335' }}>o</Text>
                  <Text style={{ color: '#FBBC05' }}>o</Text>
                  <Text style={{ color: '#4285F4' }}>g</Text>
                  <Text style={{ color: '#34A853' }}>l</Text>
                  <Text style={{ color: '#EA4335' }}>e</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.socialBtn, styles.socialBtnLi]}>
                <View style={styles.btnInner}>
                  <View style={styles.linkedinIcon}>
                    <Text style={styles.linkedinIn}>in</Text>
                  </View>
                  <Text style={[styles.socialBtnText, { color: '#fff' }]}>LinkedIn</Text>
                </View>
              </TouchableOpacity>

            </View>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.footerText}>
                  Não tens conta? <Text style={styles.footerLink}>Cria uma agora</Text>
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
  forgotWrap: { alignItems: 'flex-end', marginTop: 4 },
  forgotText: { fontSize: 13, color: '#1677F2', fontWeight: '600' },
  btnPrimary: {
    backgroundColor: '#1677F2', borderRadius: 50, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    marginBottom: 24,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EAEAEA' },
  dividerText: { fontSize: 13, color: '#6B6B6B', marginHorizontal: 12 },
  socialButtons: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  socialBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 50, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAEAEA', elevation: 1,
  },
  socialBtnLi: { backgroundColor: '#0A66C2', borderColor: '#0A66C2' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkedinIcon: {
    backgroundColor: '#fff', borderRadius: 3,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  linkedinIn: { color: '#0A66C2', fontSize: 11, fontWeight: '800' },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  footer: { alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B6B6B' },
  footerLink: { color: '#1677F2', fontWeight: '600', textDecorationLine: 'underline' },
});