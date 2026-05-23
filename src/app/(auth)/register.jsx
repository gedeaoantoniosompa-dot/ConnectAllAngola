import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 18 18">
    <Path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <Path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
    <Path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </Svg>
);

export default function RegisterScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0EEF8" />
      <View style={styles.bgGradient} />

      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Criar nova conta</Text>
          <Text style={styles.subtitle}>
            Li e concordo com a <Text style={styles.link}>Política de Privacidade</Text> e os <Text style={styles.link}>Termos de Serviço</Text>
          </Text>
        </View>

        <View style={styles.buttons}>

          {/* Google */}
          <TouchableOpacity style={styles.btn} activeOpacity={0.85}>
            <View style={styles.btnIconWrap}>
              <GoogleIcon />
            </View>
            <Text style={styles.btnDarkText}>Continuar com Google</Text>
          </TouchableOpacity>

          {/* LinkedIn */}
          <TouchableOpacity style={styles.btn} activeOpacity={0.85}>
            <View style={styles.btnIconWrap}>
              <View style={styles.linkedinIcon}>
                <Text style={styles.linkedinIn}>in</Text>
              </View>
            </View>
            <Text style={styles.btnDarkText}>Continuar com LinkedIn</Text>
          </TouchableOpacity>

          {/* Telefone */}
          <TouchableOpacity style={styles.btn} activeOpacity={0.85}>
            <View style={styles.btnIconWrap}>
              <Ionicons name="call-outline" size={22} color="#1F1F1F" />
            </View>
            <Text style={styles.btnDarkText}>Continuar com Telefone</Text>
          </TouchableOpacity>

          {/* Email */}
          <TouchableOpacity
            style={styles.btnEmail}
            activeOpacity={0.85}
            onPress={() => router.push('/register-email')}
          >
            <Text style={styles.btnEmailText}>Continuar com email</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.footerText}>
              Já tem uma conta? <Text style={styles.footerLink}>Conecte-se já</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0EEF8' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0EEF8' },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 20 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  closeIcon: { fontSize: 18, color: '#1F1F1F', fontWeight: '600' },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F1F1F', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6B6B6B', lineHeight: 20, textAlign: 'center' },
  link: { color: '#1677F2', textDecorationLine: 'underline' },
  buttons: { gap: 14 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#DCDCDC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  btnDarkText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  linkedinIcon: {
    backgroundColor: '#0A66C2',
    borderRadius: 5,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedinIn: { color: '#fff', fontSize: 13, fontWeight: '800' },
  btnIconWrap: { width: 32, alignItems: 'center' },
  btnEmail: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  btnEmailText: { fontSize: 15, fontWeight: '600', color: '#1F1F1F', textDecorationLine: 'underline' },
  footer: { position: 'absolute', bottom: 36, left: 28, right: 28, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B6B6B' },
  footerLink: { color: '#1677F2', fontWeight: '600' },
});