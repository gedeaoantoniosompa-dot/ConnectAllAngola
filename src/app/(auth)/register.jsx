import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInAnonymously } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [autenticando, setAutenticando] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Logo + Título */}
        <View style={styles.topSection}>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>
              <Text style={styles.logoConnect}>ConnectAll</Text>
              <Text style={styles.logoAngola}>Angola</Text>
            </Text>
            <Image
              source={require('../../../assets/logo2.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.subtitle}>
            Faça parte de uma comunidade de profissionais em Angola
          </Text>
        </View>

        {/* Botões */}
        <View style={styles.buttons}>

          <TouchableOpacity
            style={styles.btnEmail}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register-email')}
            disabled={autenticando}
          >
            <Ionicons name="mail-outline" size={20} color="#1F1F1F" />
            <Text style={styles.btnEmailText}>Entrar com e-mail</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnPhone}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register-phone')}
            disabled={autenticando}
          >
            <Ionicons name="call-outline" size={20} color="#1F1F1F" />
            <Text style={styles.btnPhoneText}>Entrar com telefone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAnonimo, autenticando && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={entrarSemConta}
            disabled={autenticando}
          >
            <Ionicons name="eye-outline" size={20} color="#6B6B6B" />
            <Text style={styles.btnAnonimoText}>Explorar sem conta</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.linkedinWrap}>
          <Text style={styles.linkedinQuestion}>Ainda não faz parte do ConnectAllAngola?</Text>
          <Text style={styles.linkedinQuestion}>Cadastre-se agora com as opções acima</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ao clicar em Aceite e Cadastre-se ou Continue, você aceita o{' '}
            <Text style={styles.footerLink} onPress={() => abrirPolitica('contrato')}>Contrato do Utilizador</Text>,{' '}
            <Text style={styles.footerLink} onPress={() => abrirPolitica('privacidade')}>Política de Privacidade</Text> e a{' '}
            <Text style={styles.footerLink} onPress={() => abrirPolitica('cookies')}>Política de Cookies</Text> da ConnectAll Angola.
          </Text>
        </View>

        <TouchableOpacity style={styles.loginWrap} onPress={() => router.push('/(auth)/login')} disabled={autenticando}>
          <Text style={styles.loginText}>
            Já tem uma conta? <Text style={styles.loginLink}>Entrar</Text>
          </Text>
        </TouchableOpacity>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  topSection: { alignItems: 'center', marginBottom: 48 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  logoText: { fontSize: 28, fontWeight: '800' },
  logoConnect: { color: '#1F1F1F' },
  logoAngola: { color: '#CC0000' },
  logoImg: { width: 40, height: 40 },
  subtitle: { fontSize: 16, color: '#444', textAlign: 'center', lineHeight: 24, paddingHorizontal: 16 },
  buttons: { gap: 12 },
  btnEmail: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#fff', borderRadius: 50, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#DCDCDC',
  },
  btnEmailText: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  btnPhone: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#fff', borderRadius: 50, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#DCDCDC',
  },
  btnPhoneText: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  btnAnonimo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#F8FAFC', borderRadius: 50, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  btnAnonimoText: { fontSize: 15, fontWeight: '600', color: '#6B6B6B' },
  dividerWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EAEAEA' },
  dividerText: { fontSize: 13, color: '#6B6B6B', fontWeight: '500' },
  linkedinWrap: { alignItems: 'center', gap: 4, marginBottom: 24 },
  linkedinQuestion: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  footer: { paddingHorizontal: 8, marginBottom: 16 },
  footerText: { fontSize: 11, color: '#6B6B6B', textAlign: 'center', lineHeight: 18 },
  footerLink: { color: '#1677F2', textDecorationLine: 'underline' },
  loginWrap: { alignItems: 'center' },
  loginText: { fontSize: 14, color: '#6B6B6B' },
  loginLink: { color: '#1677F2', fontWeight: '700' },
});