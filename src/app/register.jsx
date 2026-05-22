import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
    Animated,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

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
      <StatusBar barStyle="dark-content" backgroundColor="#F8F8F8" />
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

          <TouchableOpacity style={styles.btnGoogle} activeOpacity={0.85}>
            <View style={styles.btnIconWrap}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={styles.btnGoogleText}>Continuar com Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnFacebook} activeOpacity={0.85}>
            <View style={styles.btnIconWrap}>
              <Text style={styles.fbIcon}>f</Text>
            </View>
            <Text style={styles.btnFbText}>Continuar com Facebook</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnPhone} activeOpacity={0.85}>
            <View style={styles.btnIconWrap}>
              <Text style={styles.phoneIcon}>📱</Text>
            </View>
            <Text style={styles.btnPhoneText}>Continuar com Telefone</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnEmail} activeOpacity={0.85}>
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
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0EEF8' },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 20 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  closeIcon: { fontSize: 18, color: '#1F1F1F', fontWeight: '600' },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F1F1F', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6B6B6B', lineHeight: 20, textAlign: 'center' },
  link: { color: '#1677F2', textDecorationLine: 'underline' },
  buttons: { gap: 14 },
  btnGoogle: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 50, paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 1, borderColor: '#EAEAEA', elevation: 2,
  },
  btnGoogleText: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  googleIcon: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  btnFacebook: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1877F2',
    borderRadius: 50, paddingVertical: 14, paddingHorizontal: 20,
  },
  btnFbText: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#fff' },
  fbIcon: { fontSize: 20, fontWeight: '800', color: '#fff' },
  btnPhone: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1677F2',
    borderRadius: 50, paddingVertical: 14, paddingHorizontal: 20,
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnPhoneText: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#fff' },
  phoneIcon: { fontSize: 18 },
  btnIconWrap: { width: 28, alignItems: 'center' },
  btnEmail: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  btnEmailText: { fontSize: 15, fontWeight: '600', color: '#1F1F1F', textDecorationLine: 'underline' },
  footer: { position: 'absolute', bottom: 36, left: 28, right: 28, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B6B6B' },
  footerLink: { color: '#1677F2', fontWeight: '600', textDecorationLine: 'underline' },
});