/**
 * criar-senha-email.jsx — ConnectAll Angola
 * Passo: "Criar palavra passe" (email)
 * Objetivo: receber email (params), guardar password temporariamente e ir para o formulário do tipo.
 * A criação da conta Firebase/UID será feita em verificar-codigo.jsx após OTP.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

export default function CriarSenhaEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = (params?.email || '').toString().trim().toLowerCase();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordIsStrong = useMemo(() => {
    if (!password) return false;
    return getPasswordStrength(password).score >= 3;
  }, [password]);

  const guardarESeguir = async () => {
    if (!email) {
      Alert.alert('Erro', 'Email em falta.');
      return;
    }
    if (!password || !confirmPassword) {
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
      // Guardar para ser usada no final (OTP) em verificar-codigo
      // Mantemos o mesmo formato que register-email guarda em _registoPendente.
      const pendenteStr = await AsyncStorage.getItem('_registoPendente');
      const pendente = pendenteStr ? JSON.parse(pendenteStr) : {};

      await AsyncStorage.setItem(
        '_registoPendente',
        JSON.stringify({
          ...pendente,
          email,
          password,
          criadoEm: pendente?.criadoEm || Date.now(),
          passouPelaCriacaoSenha: true,
        })
      );

      router.replace({
        pathname: '/(auth)/verificar-codigo',
        params: { email },
      });
    } catch (e) {
      console.log('[criar-senha-email]', e?.code, e?.message);
      Alert.alert('Erro', 'Não foi possível guardar a palavra-passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#1F1F1F" />
          </TouchableOpacity>

          <Text style={s.title}>Criar palavra-passe</Text>
          <Text style={s.subtitle}>Define a tua palavra-passe para concluir o registo.</Text>

          <View style={s.inputGroup}>
            <Text style={s.label}>Palavra-passe</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
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

          <View style={s.inputGroup}>
            <Text style={s.label}>Confirmar palavra-passe</Text>
            <View
              style={[
                s.inputWrap,
                confirmPassword.length > 0 && password !== confirmPassword && s.inputWrapError,
              ]}
            >
              <TextInput
                style={s.input}
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
              <Text style={s.errorText}>As palavras-passe não coincidem</Text>
            )}
          </View>

          <TouchableOpacity
            style={[s.btnPrimary, (!passwordIsStrong || !password || !confirmPassword || loading) && s.btnDisabled]}
            onPress={guardarESeguir}
            disabled={!passwordIsStrong || !password || !confirmPassword || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnPrimaryText}>Avançar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.loginLink} onPress={() => router.replace('/(auth)/register-email')}>
            <Text style={s.loginLinkTxt}>
              Voltar e corrigir
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  container: { padding: 24, paddingTop: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1F1F1F', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28 },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputWrapError: { borderColor: '#E53935' },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1F1F1F' },
  errorText: { color: '#E53935', fontSize: 12, marginTop: 6, marginLeft: 4 },

  btnPrimary: { backgroundColor: '#1677F2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  loginLink: { alignItems: 'center', paddingVertical: 16 },
  loginLinkTxt: { fontSize: 14, color: '#6B7280' },
});

