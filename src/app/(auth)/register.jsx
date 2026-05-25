import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useRef } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { auth } from '../../config/firebase';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '90320321734-vqhghbin6ns5rkpnsqul14rf4kmmln79.apps.googleusercontent.com',
    androidClientId: '90320321734-gjfogjldm3o601a1n0ujg2qg6nurpogh.apps.googleusercontent.com',
    redirectUri: 'https://auth.expo.io/@miguelsompa/connectallangola',
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(() => router.replace('/(auth)/profile'))
        .catch(error => Alert.alert('Erro', error.message));
    } else if (response?.type === 'error') {
      Alert.alert('Erro', 'Não foi possível fazer login com Google.');
    }
  }, [response]);

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

          {/* Google */}
          <TouchableOpacity
            style={styles.btnGoogle}
            activeOpacity={0.85}
            onPress={() => promptAsync()}
            disabled={!request}
          >
            <Svg width="20" height="20" viewBox="0 0 48 48">
              <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.05 17.74 9.5 24 9.5z"/>
              <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.55-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <Path fill="none" d="M0 0h48v48H0z"/>
            </Svg>
            <Text style={styles.btnGoogleText}>Prosseguir com o Google</Text>
          </TouchableOpacity>

          {/* Email */}
          <TouchableOpacity
            style={styles.btnEmail}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register-email')}
          >
            <Ionicons name="mail-outline" size={20} color="#1F1F1F" />
            <Text style={styles.btnEmailText}>Entrar com e-mail</Text>
          </TouchableOpacity>

          {/* Telefone */}
          <TouchableOpacity
            style={styles.btnPhone}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register-phone')}
          >
            <Ionicons name="call-outline" size={20} color="#1F1F1F" />
            <Text style={styles.btnPhoneText}>Entrar com telefone</Text>
          </TouchableOpacity>

        </View>

        {/* Divisor */}
        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Info */}
        <TouchableOpacity style={styles.linkedinWrap} activeOpacity={0.85}>
          <Text style={styles.linkedinQuestion}>Ainda não faz parte do ConnectAllAngola?</Text>
          <Text style={styles.linkedinQuestion}>Cadastre-se agora com as opções acima</Text>
        </TouchableOpacity>

        {/* Rodapé legal */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ao clicar em Aceite e Cadastre-se ou Continue, você aceita o{' '}
            <Text
              style={styles.footerLink}
              onPress={() => abrirPolitica('contrato')}
            >
              Contrato do Utilizador
            </Text>,{' '}
            <Text
              style={styles.footerLink}
              onPress={() => abrirPolitica('privacidade')}
            >
              Política de Privacidade
            </Text> e a{' '}
            <Text
              style={styles.footerLink}
              onPress={() => abrirPolitica('cookies')}
            >
              Política de Cookies
            </Text> da ConnectAll Angola.
          </Text>
        </View>

        {/* Já tem conta */}
        <TouchableOpacity style={styles.loginWrap} onPress={() => router.push('/(auth)/login')}>
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
  btnGoogle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#1677F2',
    borderRadius: 50, paddingVertical: 15,
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  btnGoogleText: { fontSize: 15, fontWeight: '700', color: '#fff' },
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