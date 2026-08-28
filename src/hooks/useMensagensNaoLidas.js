// hooks/useMensagensNaoLidas.js — ConnectAll Angola
//
// Soma, em tempo real, o número de mensagens não lidas em TODAS as
// conversas do utilizador (campo `naoLidas.{uid}` em cada doc de `chats`).
// Usa-se em qualquer ícone que precise de mostrar este contador —
// tab bar, header do feed, etc.

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';

export function useMensagensNaoLidas(uid) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!uid) { setTotal(0); return; }

    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      let soma = 0;
      snap.forEach((d) => {
        const naoLidas = d.data()?.naoLidas?.[uid] || 0;
        soma += naoLidas;
      });
      setTotal(soma);
    }, () => {});

    return () => unsub();
  }, [uid]);

  return total;
}