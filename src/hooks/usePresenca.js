import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { rtdb } from '../config/firebase';

/**
 * usePresenca — gere o estado online/offline do utilizador no Realtime Database.
 *
 * @param {string|null} uid  — UID do utilizador autenticado
 * @param {boolean}     ativo — se false, força offline mesmo com ligação ativa
 *
 * ── CORREÇÃO ──
 * Antes, "online" só passava a false quando a LIGAÇÃO ao Firebase caía
 * (onDisconnect) — ou seja, só quando a app fechava mesmo. Mas sobretudo
 * no Android, a ligação costuma continuar activa durante muito tempo com
 * a app apenas MINIMIZADA (em segundo plano, não fechada) — por isso
 * "online" ficava aceso mesmo com a pessoa a nem estar a usar a app.
 * Agora também ouve o AppState: ao minimizar/sair para outra app, marca
 * offline de imediato; ao voltar para primeiro plano, marca online de
 * novo (se `ativo` continuar a permitir). Isto dá uma presença muito
 * mais fiel ao que a pessoa está mesmo a fazer, sem depender só da
 * ligação cair.
 */
export function usePresenca(uid, ativo = true) {
  const presencaRefAtual = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!uid) return;

    const presencaRef = ref(rtdb, `presenca/${uid}`);
    const connectedRef = ref(rtdb, '.info/connected');
    presencaRefAtual.current = presencaRef;

    const marcarPresenca = (emPrimeiroPlano) => {
      set(presencaRef, {
        online: !!ativo && emPrimeiroPlano,
        ultimaVez: serverTimestamp(),
      });
    };

    const unsubConectado = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Quando a ligação cair de verdade (app fechada, sem rede, etc.),
        // marca sempre offline — continua a ser a rede de segurança.
        onDisconnect(presencaRef).set({
          online: false,
          ultimaVez: serverTimestamp(),
        });

        // Estado inicial, consoante `ativo` e se a app está mesmo em
        // primeiro plano neste momento.
        marcarPresenca(appStateRef.current === 'active');
      }
    });

    // NOVO: reage a ir para segundo plano / voltar a primeiro plano.
    const subscricaoAppState = AppState.addEventListener('change', (proximoEstado) => {
      appStateRef.current = proximoEstado;
      marcarPresenca(proximoEstado === 'active');
    });

    return () => {
      unsubConectado();
      subscricaoAppState.remove();
    };
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