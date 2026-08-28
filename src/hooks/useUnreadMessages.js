// useUnreadMessages.js — VERSÃO DE DIAGNÓSTICO (temporária)
// Remove os console.log assim que confirmarmos onde está o problema.

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';

export function useUnreadMessages(uid) {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useUnreadMessages] uid recebido:', uid);

    if (!uid) {
      console.log('[useUnreadMessages] sem uid, a abortar.');
      setUnreadMessagesCount(0);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'chats'), where('users', 'array-contains', uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        // ← NOVO: metadata do snapshot inteiro. Se "fromCache" andar a
        // alternar true/false repetidamente, ou "hasPendingWrites" vier
        // true sem nenhuma acção tua, o disparo repetido é do listener
        // (reconexão/reautenticação), não de escritas reais no Firestore.
        console.log('[useUnreadMessages] metadata do snapshot:', {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        });

        console.log('[useUnreadMessages] snapshot recebido, docs:', snap.docs.length);
        let total = 0;
        snap.docs.forEach((d) => {
          const dados = d.data();
          const valor = dados?.naoLidas?.[uid] || 0;
          // ← NOVO: metadata por documento — mostra se ESTE documento em
          // concreto veio da cache local ou do servidor, e se tem escritas
          // locais pendentes (ainda não confirmadas pelo servidor).
          console.log(
            '[useUnreadMessages] chat', d.id,
            '| users:', dados?.users,
            '| naoLidas completo:', dados?.naoLidas,
            '| valor para este uid:', valor,
            '| doc.metadata:', { fromCache: d.metadata.fromCache, hasPendingWrites: d.metadata.hasPendingWrites }
          );
          total += valor;
        });
        console.log('[useUnreadMessages] TOTAL calculado:', total);
        setUnreadMessagesCount(total);
        setLoading(false);
      },
      (err) => {
        console.log('[useUnreadMessages] ERRO no onSnapshot:', err.code, err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid]);

  return { unreadMessagesCount, loading };
}