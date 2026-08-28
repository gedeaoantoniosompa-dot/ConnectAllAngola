import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database';
import { useEffect, useRef } from 'react';
import { rtdb } from '../config/firebase';

/**
 * usePresenca — gere o estado online/offline do utilizador no Realtime Database.
 *
 * @param {string|null} uid  — UID do utilizador autenticado
 * @param {boolean}     ativo — se false, força offline mesmo com ligação ativa
 */
export function usePresenca(uid, ativo = true) {
  const presencaRefAtual = useRef(null);

  useEffect(() => {
    if (!uid) return;

    const presencaRef = ref(rtdb, `presenca/${uid}`);
    const connectedRef = ref(rtdb, '.info/connected');
    presencaRefAtual.current = presencaRef;

    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Quando desligar, marca sempre offline
        onDisconnect(presencaRef).set({
          online: false,
          ultimaVez: serverTimestamp(),
        });

        // Marca online ou offline consoante `ativo`
        set(presencaRef, {
          online: ativo,
          ultimaVez: serverTimestamp(),
        });
      }
    });

    return () => unsub();
  }, [uid, ativo]); // re-executa quando `ativo` muda

  const marcarOffline = () => {
    if (presencaRefAtual.current) {
      set(presencaRefAtual.current, {
        online: false,
        ultimaVez: serverTimestamp(),
      });
    }
  };

  return { marcarOffline };
}
