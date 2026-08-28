// components/live/FloatingHearts.jsx
//
// Anima corações a subir e a desaparecer sempre que a contagem de gostos
// aumenta — visível para todos os espectadores em tempo real, tal como no
// TikTok LIVE. Basta passar a contagem atual (vinda do Firestore); o
// componente deteta o incremento e dispara a animação sozinho.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

let proximoId = 0;

export default function FloatingHearts({ contagem, corDestaque = '#EC4C89' }) {
  const [coracoes, setCoracoes] = useState([]);
  const anteriorRef = useRef(null);

  useEffect(() => {
    if (contagem == null) return;
    if (anteriorRef.current == null) {
      // Primeira leitura: só regista a base, não dispara animação retroativa.
      anteriorRef.current = contagem;
      return;
    }
    const diferenca = contagem - anteriorRef.current;
    anteriorRef.current = contagem;
    if (diferenca <= 0) return;

    // Limita a explosão visual a no máximo 6 corações de cada vez.
    const quantos = Math.min(diferenca, 6);
    for (let i = 0; i < quantos; i++) {
      setTimeout(() => dispararCoracao(), i * 120);
    }
  }, [contagem]);

  function dispararCoracao() {
    const id = proximoId++;
    const deslocX = Math.random() * 50 - 25;
    const valor = new Animated.Value(0);
    setCoracoes((prev) => [...prev, { id, valor, deslocX }]);
    Animated.timing(valor, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setCoracoes((prev) => prev.filter((c) => c.id !== id));
    });
  }

  return (
    <>
      {coracoes.map((c) => {
        const translateY = c.valor.interpolate({ inputRange: [0, 1], outputRange: [0, -240] });
        const opacity = c.valor.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
        const scale = c.valor.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.1, 0.9] });
        return (
          <Animated.View
            key={c.id}
            pointerEvents="none"
            style={[
              styles.coracao,
              { transform: [{ translateY }, { translateX: c.deslocX }, { scale }], opacity },
            ]}
          >
            <Ionicons name="heart" size={26} color={corDestaque} />
          </Animated.View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  coracao: { position: 'absolute', bottom: 130, right: 28 },
});