import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

const SLIDES = [
  require('../../../assets/slideshow/foto1.jpg.png'),
  require('../../../assets/slideshow/foto2.jpg'),
  require('../../../assets/slideshow/foto3.jpg'),
  require('../../../assets/slideshow/foto4.jpg'),
  require('../../../assets/slideshow/foto5.jpg'),
  require('../../../assets/slideshow/foto6.jpg'),
  require('../../../assets/slideshow/foto7.jpg'),
  require('../../../assets/slideshow/foto8.jpg'),
  require('../../../assets/slideshow/foto9.jpg'),
  require('../../../assets/slideshow/foto10.jpg'),
  require('../../../assets/slideshow/foto11.jpg'),
];

const SLIDE_DURATION = 4000; // 4 segundos por slide
const FADE_DURATION  = 1000; // 1 segundo de crossfade

export default function WelcomeScreen() {
  const router = useRouter();

  // Animação de entrada dos textos/botões
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  // ── Slideshow ────────────────────────────────────────────────────────────
  // Duas camadas:
  //   A (baixo) — foto actual, sempre opaca, nunca animada
  //   B (cima)  — próxima foto, faz fade 0→1, depois desaparece instantaneamente
  //
  // Regra anti-flash:
  //   • fadeDuration={0} desliga o fade nativo do Android
  //   • A source de B só é actualizada quando B está com opacity=0
  //   • A source de A só é actualizada depois do fade de B terminar (A invisível nesse frame)

  const [srcA, setSrcA] = useState(0); // índice para camada A
  const [srcB, setSrcB] = useState(0); // índice para camada B (começa igual a A)
  const currentIdx  = useRef(0);
  const opacityB    = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    // Entrada dos textos
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();

    const advance = () => {
      if (isAnimating.current) return;
      isAnimating.current = true;

      const nextIdx = (currentIdx.current + 1) % SLIDES.length;

      // Passo 1 — coloca a próxima foto em B com opacity 0 (invisível, sem flash)
      opacityB.setValue(0);
      setSrcB(nextIdx);

      // Passo 2 — após o React renderizar B com a nova source (ainda invisível),
      // inicia o fade-in de B
      setTimeout(() => {
        Animated.timing(opacityB, {
          toValue: 1,
          duration: FADE_DURATION,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) {
            isAnimating.current = false;
            return;
          }

          // Passo 3 — B está totalmente visível.
          // Actualiza A para ter a mesma foto de B e esconde B instantaneamente.
          // O utilizador não vê nada porque A e B têm a mesma foto neste momento.
          setSrcA(nextIdx);
          // Pequeno timeout para garantir que o setSrcA foi commitado antes de
          // esconder B, evitando o flash da foto anterior em A
          setTimeout(() => {
            opacityB.setValue(0);
            currentIdx.current = nextIdx;
            isAnimating.current = false;
          }, 32); // ~2 frames a 60fps
        });
      }, 16); // ~1 frame para garantir o render de setSrcB
    };

    const timer = setInterval(advance, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Camada A — base fixa, sempre opaca */}
      <Image
        source={SLIDES[srcA]}
        style={styles.backgroundImage}
        resizeMode="cover"
        fadeDuration={0}
      />

      {/* Camada B — fade-in da próxima foto */}
      <Animated.Image
        source={SLIDES[srcB]}
        style={[styles.backgroundImage, { opacity: opacityB }]}
        resizeMode="cover"
        fadeDuration={0}
      />

      {/* Overlay escuro */}
      <View style={styles.overlay} />

      {/* Textos de Boas-Vindas */}
      <Animated.View
        style={[
          styles.topContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={styles.title}>Bem-vindo(a) à{'\n'}ConnectAll Angola</Text>
        <Text style={styles.subtitle}>
          Conecta profissionais, estudantes e talentos{'\n'}de todo o país num só lugar.
        </Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* Botões de Ação */}
      <Animated.View
        style={[
          styles.bottomButtons,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.btnPrimary}
          activeOpacity={0.85}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.btnPrimaryText}>Criar Conta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          activeOpacity={0.85}
          onPress={() => router.push('/(auth)/login')}
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
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    width: width,
    height: height,
    top: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
    width: width,
    height: height,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  topContent: {
    paddingTop: 70,
    paddingHorizontal: 28,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomButtons: {
    paddingHorizontal: 24,
    paddingBottom: 44,
    gap: 12,
    zIndex: 10,
  },
  btnPrimary: {
    backgroundColor: '#1677F2',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#1677F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
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
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  btnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});