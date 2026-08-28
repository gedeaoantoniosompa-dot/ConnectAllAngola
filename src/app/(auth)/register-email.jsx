/**
 * register-email.jsx — ConnectAll Angola
 * FLUXO CORRECTO:
 * 1. Utilizador mete email + senha → guarda em AsyncStorage
 * 2. Vai para escolher-tipo-perfil
 * 3. Escolhe tipo → vai para profile
 * 4. Preenche perfil → envia OTP → vai para verificar-codigo
 * 5. Verifica OTP → cria conta Firebase + grava Firestore → feed
 *
 * ✅ NÃO envia OTP aqui
 * ✅ NÃO cria conta Firebase aqui
 * ✅ Só valida email + senha e guarda temporariamente
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import PasswordStrengthIndicator, { getPasswordStrength } from '../../components/PasswordStrengthIndicator';

export default function RegisterEmailScreen() {
  const router = useRouter();

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);

  const passwordIsStrong = getPasswordStrength(password).score >= 3;

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Erro', 'Preenche todos os campos!');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As palavras-passe não coincidem!');
      return;
    }
    if (!passwordIsStrong) {
      Alert.alert('Palavra-passe fraca', 'A tua palavra-passe deve ter letras maiúsculas, minúsculas, números e um símbolo.');
      return;
    }

    setLoading(true);
    try {
      const emailLimpo = email.trim().toLowerCase();

      // ── Guarda email + senha em AsyncStorage ──
      // NÃO envia OTP aqui — o OTP será enviado no final do formulário de perfil
      await AsyncStorage.setItem('_registoPendente', JSON.stringify({
        email:    emailLimpo,
        password, // guardado apenas localmente, nunca enviado à rede
        criadoEm: Date.now(),
      }));

      // ── Vai escolher o tipo de perfil ──
      router.push('/(auth)/escolher-tipo-perfil');

    } catch (error) {
      console.log('[RegisterEmail]', error.code, error.message);
      Alert.alert('Erro', 'Não foi possível continuar. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#1F1F1F" />
          </TouchableOpacity>

          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Regista-te com o teu endereço de email.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="o_teu_email@gmail.com"
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
                style={styles.input}
                secureTextEntry={!showPassword}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={24} color="gray" />
              </TouchableOpacity>
            </View>
            {password.length > 0 && <PasswordStrengthIndicator password={password} />}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar palavra-passe</Text>
            <View style={[
              styles.inputWrap,
              confirmPassword.length > 0 && password !== confirmPassword && styles.inputWrapError,
            ]}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showConfirm}
                placeholder="Repete a palavra-passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={24} color="gray" />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorText}>As palavras-passe não coincidem</Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.btnPrimary,
              (!passwordIsStrong || !email || !confirmPassword || loading) && styles.btnDisabled,
            ]}
            onPress={handleRegister}
            disabled={!passwordIsStrong || !email || !confirmPassword || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnPrimaryText}>Avançar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginLinkTxt}>
              Já tens conta? <Text style={styles.loginLinkDestaque}>Iniciar sessão</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#F8F8F8' },
  container: { padding: 24, paddingTop: 12 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:    { fontSize: 28, fontWeight: '800', color: '#1F1F1F', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28 },
  inputGroup: { marginBottom: 20 },
  label:      { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#374151' },
  inputWrap:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  inputWrapError: { borderColor: '#E53935' },
  input:     { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1F1F1F' },
  errorText: { color: '#E53935', fontSize: 12, marginTop: 6, marginLeft: 4 },
  btnPrimary:    { backgroundColor: '#1677F2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:   { backgroundColor: '#D1D5DB' },
  btnPrimaryText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink:         { alignItems: 'center', paddingVertical: 16 },
  loginLinkTxt:      { fontSize: 14, color: '#6B7280' },
  loginLinkDestaque: { color: '#1677F2', fontWeight: '700' },
});