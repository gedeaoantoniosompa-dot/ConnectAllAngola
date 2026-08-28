import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { app, auth, db } from '../../config/firebase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [autenticando, setAutenticando] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [modalSaibaMais, setModalSaibaMais] = useState(false);

  // ── Novo: estado de bloqueio ──────────────────────────────────────
  const [bloqueioDefinitivo, setBloqueioDefinitivo] = useState(false);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const emailGuardado = await AsyncStorage.getItem('login_email');
        const rememberGuardado = await AsyncStorage.getItem('login_remember');
        if (rememberGuardado === 'true' && emailGuardado) {
          setEmail(emailGuardado);
          setRemember(true);
        }
      } catch {}
    };
    carregarDados();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    const emailLimpo = email.trim().toLowerCase();
    setLoading(true);
    setBloqueioDefinitivo(false);

    try {
      const functions = getFunctions(app, 'europe-west1');
      const verificarBloqueio = httpsCallable(functions, 'verificarBloqueioLogin');
      const registarTentativa = httpsCallable(functions, 'registarTentativaLogin');

      // 1. Verifica se esta conta está actualmente bloqueada
      const { data: estadoBloqueio } = await verificarBloqueio({ email: emailLimpo });

      if (estadoBloqueio.bloqueado) {
        setLoading(false);

        // ── Bloqueio DEFINITIVO → navega para recuperação de conta ───
        if (estadoBloqueio.definitivo) {
          setBloqueioDefinitivo(true);
          return;
        }

        // ── Bloqueio TEMPORÁRIO → alerta com minutos restantes ───────
        Alert.alert(
          'Conta temporariamente bloqueada',
          `Demasiadas tentativas falhadas. Tenta novamente em ${estadoBloqueio.minutosRestantes} minutos, ou contacta o suporte para desbloqueio imediato.`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Contactar suporte', onPress: () => router.push('/(auth)/contactar-suporte') },
          ]
        );
        return;
      }

      // 2. Tenta autenticar
      try {
        const credencial = await signInWithEmailAndPassword(auth, emailLimpo, password);

        // Login bem-sucedido — reseta o contador de tentativas
        await registarTentativa({ email: emailLimpo, sucesso: true });

        // Se havia recuperação facial pendente, marca como concluída
        // O trigger desbloquearAposRedefinicao irá processar e desbloquear
        try {
          await setDoc(
            doc(db, 'redefinicoesSenha', credencial.user.uid),
            { email: emailLimpo, concluido: true, data: serverTimestamp() },
            { merge: true }
          );
        } catch { /* não crítico */ }

        if (remember) {
          await AsyncStorage.setItem('login_email', emailLimpo);
          await AsyncStorage.setItem('login_remember', 'true');
        } else {
          await AsyncStorage.removeItem('login_email');
          await AsyncStorage.setItem('login_remember', 'false');
        }
        // Redirecionamento continua a cargo do _layout.tsx

      } catch (authError) {
        setLoading(false);

        // Login falhou — regista a tentativa falhada
        const { data: resultado } = await registarTentativa({ email: emailLimpo, sucesso: false });

        if (resultado.bloqueado) {
          if (resultado.definitivo) {
            // Bloqueio definitivo após esta tentativa
            setBloqueioDefinitivo(true);
          } else {
            Alert.alert(
              'Conta bloqueada',
              `Excedeste o número de tentativas permitidas. A tua conta foi bloqueada por ${resultado.minutosRestantes} minutos. Para desbloqueio imediato, contacta o suporte.`,
              [
                { text: 'OK', style: 'cancel' },
                { text: 'Contactar suporte', onPress: () => router.push('/(auth)/contactar-suporte') },
              ]
            );
          }
        } else {
          let msg = 'Email ou palavra-passe incorrectos.';
          if (resultado.restantes !== undefined) {
            msg += ` Restam ${resultado.restantes} tentativa(s) antes do bloqueio temporário.`;
          }
          Alert.alert('Erro', msg);
        }
      }

    } catch (error) {
      setLoading(false);
      console.log('Erro verificação bloqueio:', error);
      Alert.alert('Erro', 'Não foi possível processar o login. Verifica a tua ligação à internet.');
    }
  };

  const entrarSemConta = async () => {
    Alert.alert(
      'Entrar sem conta',
      'Poderás explorar a app, mas os teus dados não serão guardados. Desejas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            setAutenticando(true);
            try {
              await signInAnonymously(auth);
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível entrar anonimamente: ' + error.message);
            } finally {
              setAutenticando(false);
            }
          },
        },
      ]
    );
  };

  const abrirPolitica = (tipo) => {
    router.push({ pathname: '/(auth)/politicas', params: { tipo } });
  };

  // ── Ecrã de bloqueio definitivo ───────────────────────────────────
  if (bloqueioDefinitivo) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.bloqueioContainer}>
          <View style={styles.bloqueioIconeWrap}>
            <Ionicons name="shield-outline" size={56} color="#E00000" />
          </View>
          <Text style={styles.bloqueioTitulo}>Conta Bloqueada</Text>
          <Text style={styles.bloqueioDesc}>
            A tua conta foi bloqueada por motivos de segurança devido a múltiplas tentativas de acesso falhadas.{'\n\n'}
            Para recuperares o acesso, precisamos de{' '}
            <Text style={{ fontWeight: '800', color: '#1A202C' }}>verificar a tua identidade</Text>
            {' '}com uma selfie e o teu Bilhete de Identidade.
          </Text>
          <TouchableOpacity
            style={styles.btnRecuperar}
            onPress={() => router.push({
              pathname: '/(auth)/recuperar-conta',
              params: { email: email.trim().toLowerCase() },
            })}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#FFF" />
            <Text style={styles.btnRecuperarTxt}>Recuperar Conta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnVoltarSec} onPress={() => setBloqueioDefinitivo(false)}>
            <Text style={styles.btnVoltarSecTxt}>Voltar ao Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Ecrã de login normal (igual ao original) ──────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          <View style={styles.header}>
            <Text style={styles.brandTitle}>
              <Text style={{ color: '#000' }}>Connect</Text>
              <Text style={{ color: '#FF3B30' }}>All</Text>
            </Text>
            <Image
              source={require('../../../assets/logo2.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity
            style={[styles.btnAnonimo, autenticando && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={entrarSemConta}
            disabled={autenticando}
          >
            <Ionicons name="eye-outline" size={20} color="#6B6B6B" />
            <Text style={styles.btnAnonimoText}>Explorar sem conta</Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            Ao clicar em Continuar, você aceita o{' '}
            <Text style={styles.link} onPress={() => abrirPolitica('contrato')}>Contrato do Usuário</Text>,{' '}
            <Text style={styles.link} onPress={() => abrirPolitica('privacidade')}>Política de Privacidade</Text> e a{' '}
            <Text style={styles.link} onPress={() => abrirPolitica('cookies')}>Política de Cookies</Text>.
          </Text>

          <View style={styles.dividerContainer}>
            <View style={styles.line} />
            <Text style={styles.orText}>ou</Text>
            <View style={styles.line} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={{ flex: 1, fontSize: 16 }}
              placeholder="Senha"
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setRemember(!remember)}>
            <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={22} color={remember ? '#1677F2' : '#666'} />
            <Text style={styles.checkboxText}>
              Lembrar o meu e-mail.{' '}
              <Text style={styles.link} onPress={() => setModalSaibaMais(true)}>Saiba mais</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotPass} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotPassText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>Continuar</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.criarContaBtn} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.criarContaText}>
              Não tens conta? <Text style={styles.criarContaLink}>Criar conta</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalSaibaMais} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Lembrar e-mail de acesso</Text>
            <Text style={styles.modalTexto}>
              Ao activar esta opção, o teu e-mail será guardado de forma segura no teu dispositivo para não precisares introduzi-lo novamente.{'\n\n'}
              A tua palavra-passe é gerida pela <Text style={{ fontWeight: '700' }}>Google Password Manager</Text>, que oferece armazenamento seguro e preenchimento automático directamente pelo teu dispositivo Android.{'\n\n'}
              Os teus dados <Text style={{ fontWeight: '700' }}>não são partilhados</Text> com terceiros. Podes desactivar esta opção a qualquer momento.
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setModalSaibaMais(false)}>
              <Text style={styles.modalBtnText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContainer: { padding: 24, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10, marginBottom: 30 },
  brandTitle: { fontSize: 28, fontWeight: '800' },
  logo: { width: 35, height: 35 },
  btnAnonimo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 50, paddingVertical: 14, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 12 },
  btnAnonimoText: { fontSize: 15, fontWeight: '600', color: '#6B6B6B' },
  legalText: { fontSize: 12, color: '#666', textAlign: 'center', marginVertical: 15 },
  link: { color: '#1677F2', fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  line: { flex: 1, height: 1, backgroundColor: '#CCC' },
  orText: { marginHorizontal: 10, color: '#666' },
  input: { borderBottomWidth: 1, borderColor: '#666', paddingVertical: 10, fontSize: 16, marginBottom: 20 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#666', paddingVertical: 10, marginBottom: 20 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  checkboxText: { color: '#666', fontSize: 13, flex: 1 },
  forgotPass: { marginBottom: 24 },
  forgotPassText: { color: '#1677F2', fontWeight: 'bold' },
  btnPrimary: { backgroundColor: '#1677F2', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  criarContaBtn: { alignItems: 'center', paddingVertical: 8 },
  criarContaText: { fontSize: 14, color: '#666' },
  criarContaLink: { color: '#1677F2', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: '#1F1F1F', marginBottom: 16 },
  modalTexto: { fontSize: 14, color: '#6B6B6B', lineHeight: 22 },
  modalBtn: { backgroundColor: '#1677F2', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // ── Estilos de bloqueio definitivo ──
  bloqueioContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  bloqueioIconeWrap: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bloqueioTitulo: { fontSize: 22, fontWeight: '800', color: '#E00000', textAlign: 'center' },
  bloqueioDesc: { fontSize: 15, color: '#666', lineHeight: 24, textAlign: 'center' },
  btnRecuperar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1677F2', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28, marginTop: 8 },
  btnRecuperarTxt: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  btnVoltarSec: { paddingVertical: 12 },
  btnVoltarSecTxt: { color: '#666', fontSize: 14, fontWeight: '600' },
});