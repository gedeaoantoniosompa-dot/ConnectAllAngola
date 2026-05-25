import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword
} from 'firebase/auth';
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

/**
 * RegisterPhoneScreen — versão sem expo-firebase-recaptcha
 *
 * Como a verificação por SMS exige módulos nativos (não disponíveis
 * no Expo Go), este ecrã usa registo por email/password como alternativa.
 * O utilizador insere o número de telefone apenas para guardar no perfil.
 */
export default function RegisterPhoneScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [etapa, setEtapa] = useState('telefone'); // 'telefone' | 'conta'
  const [loading, setLoading] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Ao avançar do passo 1, apenas valida o número e vai para passo 2
  const avancarParaConta = () => {
    if (!telefone || telefone.length < 9) {
      Alert.alert('Erro', 'Introduz um número de telefone válido (9 dígitos).');
      return;
    }
    setEtapa('conta');
  };

  // Cria a conta com email + password no Firebase Auth
  const criarConta = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Erro', 'Introduz um endereço de email válido.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Erro', 'A password deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Redireciona para completar o perfil
      router.replace('/(auth)/profile');
    } catch (error) {
      let mensagem = 'Ocorreu um erro. Tenta novamente.';
      if (error.code === 'auth/email-already-in-use') {
        mensagem = 'Este email já está em uso. Tenta iniciar sessão.';
      } else if (error.code === 'auth/invalid-email') {
        mensagem = 'Email inválido.';
      } else if (error.code === 'auth/weak-password') {
        mensagem = 'Password demasiado fraca. Usa pelo menos 6 caracteres.';
      }
      Alert.alert('Erro ao criar conta', mensagem);
    }
    setLoading(false);
  };

  const voltar = () => {
    if (etapa === 'conta') {
      setEtapa('telefone');
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0EEF8" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.container,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Botão Voltar */}
            <TouchableOpacity style={styles.backBtn} onPress={voltar}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>

            {/* ────────────── ETAPA 1: Número de Telefone ────────────── */}
            {etapa === 'telefone' && (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>
                    O teu número{'\n'}de telefone 📱
                  </Text>
                  <Text style={styles.subtitle}>
                    Introduz o teu número angolano. Será guardado no teu perfil.
                  </Text>
                </View>

                <View style={styles.form}>
                  <Text style={styles.label}>Número de telefone</Text>
                  <View style={styles.phoneWrap}>
                    <View style={styles.prefixWrap}>
                      <Text style={styles.flag}>🇦🇴</Text>
                      <Text style={styles.prefix}>+244</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="9XX XXX XXX"
                      placeholderTextColor="#ABABAB"
                      keyboardType="phone-pad"
                      maxLength={9}
                      value={telefone}
                      onChangeText={setTelefone}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  activeOpacity={0.85}
                  onPress={avancarParaConta}
                >
                  <Text style={styles.btnPrimaryText}>Continuar →</Text>
                </TouchableOpacity>

                {/* Nota informativa */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    ℹ️ O registo é feito por email e password. O número de
                    telefone fica guardado no teu perfil público.
                  </Text>
                </View>
              </>
            )}

            {/* ────────────── ETAPA 2: Email + Password ────────────── */}
            {etapa === 'conta' && (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>
                    Criar a tua{'\n'}conta ✨
                  </Text>
                  <Text style={styles.subtitle}>
                    Número guardado: <Text style={styles.bold}>+244 {telefone}</Text>
                    {'\n'}Agora define o teu email e password.
                  </Text>
                </View>

                <View style={styles.form}>
                  {/* Email */}
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="exemplo@email.com"
                      placeholderTextColor="#ABABAB"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  {/* Password */}
                  <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
                  <View style={[styles.inputWrap, styles.passwordWrap]}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor="#ABABAB"
                      secureTextEntry={!mostrarPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setMostrarPassword(!mostrarPassword)}
                    >
                      <Text style={styles.eyeIcon}>
                        {mostrarPassword ? '🙈' : '👁️'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                  onPress={criarConta}
                  disabled={loading}
                >
                  <Text style={styles.btnPrimaryText}>
                    {loading ? 'A criar conta...' : 'Criar conta'}
                  </Text>
                </TouchableOpacity>

                {/* Link para login */}
                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.loginText}>
                    Já tens conta?{' '}
                    <Text style={styles.loginLink}>Iniciar sessão</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0EEF8' },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Botão voltar
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  backIcon: { fontSize: 24, color: '#1F1F1F' },

  // Cabeçalho
  header: { marginBottom: 36 },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1F1F1F',
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: { fontSize: 15, color: '#6B6B6B', lineHeight: 22 },
  bold: { fontWeight: '700', color: '#1F1F1F' },

  // Formulário
  form: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#1F1F1F', marginBottom: 8 },

  // Campo de telefone
  phoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  prefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#EAEAEA',
    backgroundColor: '#F8F8F8',
  },
  flag: { fontSize: 18 },
  prefix: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F1F1F',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  // Campos de input genéricos
  inputWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  input: {
    fontSize: 15,
    color: '#1F1F1F',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeBtn: { paddingHorizontal: 14 },
  eyeIcon: { fontSize: 18 },

  // Botão principal
  btnPrimary: {
    backgroundColor: '#1677F2',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#1677F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 16,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Link de login
  loginBtn: { alignItems: 'center', paddingVertical: 8 },
  loginText: { fontSize: 14, color: '#6B6B6B' },
  loginLink: { color: '#1677F2', fontWeight: '600' },

  // Caixa informativa
  infoBox: {
    backgroundColor: '#EAF2FF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#1677F2',
    marginTop: 8,
  },
  infoText: { fontSize: 13, color: '#1F1F1F', lineHeight: 20 },
});