// hooks/useAnonGuard.ts
// Deteta utilizadores anónimos, gere o timer de 10 minutos
// e expõe a função bloqueadoParaAnonimo() para usar em qualquer ecrã

import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { auth } from '../config/firebase';

const TEMPO_LIMITE_MS = 10 * 60 * 1000; // 10 minutos em milissegundos

export function useAnonGuard() {
  const router = useRouter();
  const [isAnonimo, setIsAnonimo] = useState(false);
  const [bloqueioVisivel, setBloqueioVisivel] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.isAnonymous) {
        setIsAnonimo(true);
        // Inicia o contador de 10 minutos assim que o anónimo entra
        timerRef.current = setTimeout(() => {
          setBloqueioVisivel(true);
        }, TEMPO_LIMITE_MS);
      } else {
        setIsAnonimo(false);
        setBloqueioVisivel(false);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Chama esta função em qualquer ação que o anónimo não pode fazer.
   * Ex: onPress={() => { if (bloqueadoParaAnonimo()) return; fazerComentario(); }}
   * Retorna true se for anónimo (ação bloqueada), false se pode continuar.
   */
  const bloqueadoParaAnonimo = (): boolean => {
    if (!isAnonimo) return false;
    Alert.alert(
      'Ação não permitida',
      'Precisas de criar uma conta ou fazer login para participar.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Fazer login', onPress: () => router.replace('/(auth)/login') },
      ]
    );
    return true;
  };

  return { isAnonimo, bloqueioVisivel, setBloqueioVisivel, bloqueadoParaAnonimo };
}