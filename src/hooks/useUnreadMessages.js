// useUnreadMessages.js

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';

export function useUnreadMessages(uid) {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUnreadMessagesCount(0);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'chats'), where('users', 'array-contains', uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let total = 0;
        snap.docs.forEach((d) => {
          const dados = d.data();
          const valor = dados?.naoLidas?.[uid] || 0;
          total += valor;
        });
        setUnreadMessagesCount(total);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
      }
    );

    return unsub;
  }, [uid]);

  return { unreadMessagesCount, loading };
}