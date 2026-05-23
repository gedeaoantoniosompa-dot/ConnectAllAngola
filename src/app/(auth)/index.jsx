import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.shape, styles.shapeTL]} />
      <View style={[styles.shape, styles.shapeTR]} />
      <View style={[styles.shape, styles.shapeMidL]} />
      <View style={[styles.shape, styles.shapeMidR]} />
      <View style={[styles.shape, styles.shapeBL]} />

      <Animated.View style={[styles.topContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.title}>Bem-vinda(o) à{'\n'}ConnectAll Angola</Text>
        <Text style={styles.subtitle}>
          Conecta profissionais, estudantes e talentos{'\n'}de todo o país num só lugar.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
        <Image
          source={require('../../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.bottomButtons, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity
          style={styles.btnPrimary}
          activeOpacity={0.85}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.btnPrimaryText}>Criar Conta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          activeOpacity={0.85}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.btnSecondaryText}>Entrar</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  shape: { position: 'absolute', borderRadius: 999 },
  shapeTL: {
    width: 180, height: 180,
    backgroundColor: '#8EF2E2',
    top: -50, left: -60,
    opacity: 0.75, borderRadius: 40,
  },
  shapeTR: {
    width: 200, height: 200,
    backgroundColor: '#6A11CB',
    top: -70, right: -70,
    opacity: 0.55,
  },
  shapeMidL: {
    width: 130, height: 130,
    backgroundColor: '#19D400',
    top: height * 0.3, left: -50,
    opacity: 0.45, borderRadius: 20,
  },
  shapeMidR: {
    width: 110, height: 110,
    backgroundColor: '#EC4C89',
    top: height * 0.42, right: -30,
    opacity: 0.5,
  },
  shapeBL: {
    width: 160, height: 160,
    backgroundColor: '#1677F2',
    bottom: 140, left: -60,
    opacity: 0.3,
  },
  topContent: {
    paddingTop: 70,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F1F1F',
    lineHeight: 36,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 22,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    width: width * 0.75,
    height: width * 0.75,
    backgroundColor: 'transparent',
  },
  bottomButtons: {
    paddingHorizontal: 24,
    paddingBottom: 44,
    gap: 12,
  },
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
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1F1F1F',
    backgroundColor: 'transparent',
  },
  btnSecondaryText: {
    color: '#1F1F1F',
    fontSize: 16,
    fontWeight: '600',
  },
});