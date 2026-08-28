// hooks/useNotifications.js
// Lê de DUAS fontes em simultâneo:
//   1. notificacoes/{uid}/items  — admin panel escreve aqui (ban, suspensão, notif manual)
//   2. notificacoes (raiz) com userId == uid — notificações da app (reações, comentários, etc.)
// Mescla, ordena e expõe uma lista unificada.

import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';

export function useNotifications() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const uid = user.uid;

    // Guarda as duas listas separadas para as mesclar sempre que qualquer uma mudar
    let listaSubcolecao = [];
    let listaRaiz = [];

    function mesclar() {
      const mapa = new Map();
      [...listaSubcolecao, ...listaRaiz].forEach(n => mapa.set(n.id, n));
      const todos = Array.from(mapa.values()).sort((a, b) => {
        const ta = a.enviadoEm || a.createdAt || a.timestamp;
        const tb = b.enviadoEm || b.createdAt || b.timestamp;
        const da = ta?.toDate ? ta.toDate() : new Date(ta || 0);
        const db2 = tb?.toDate ? tb.toDate() : new Date(tb || 0);
        return db2 - da;
      });
      setNotifications(todos);
      setLoading(false);
    }

    // ── Fonte 1: notificacoes/{uid}/items (admin panel) ──
    const refSub = collection(db, 'notificacoes', uid, 'items');
    const qSub = query(refSub, orderBy('enviadoEm', 'desc'));
    const unsubSub = onSnapshot(qSub, snap => {
      listaSubcolecao = snap.docs.map(d => ({
        id: 'sub_' + d.id,
        ...d.data(),
        // Normaliza campos para o ecrã de notificações
        titulo: d.data().titulo || d.data().title || 'Notificação',
        createdAt: d.data().enviadoEm || d.data().createdAt,
        lida: d.data().lida ?? false,
        _ref: d.ref,   // guarda ref para poder marcar como lida
      }));
      mesclar();
    }, err => {
      console.log('[useNotifications] subcolecao err:', err.code);
      mesclar();
    });

    // ── Fonte 2: notificacoes (raiz) com userId == uid (app mobile) ──
    const refRaiz = collection(db, 'notificacoes');
    const qRaiz = query(refRaiz, where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const unsubRaiz = onSnapshot(qRaiz, snap => {
      listaRaiz = snap.docs.map(d => ({
        id: 'raiz_' + d.id,
        ...d.data(),
        titulo: d.data().titulo || d.data().title || 'Notificação',
        createdAt: d.data().createdAt || d.data().enviadoEm,
        lida: d.data().lida ?? false,
        _ref: d.ref,
      }));
      mesclar();
    }, err => {
      // Pode falhar se não houver índice composto — não é crítico
      console.log('[useNotifications] raiz err:', err.code);
      mesclar();
    });

    return () => {
      unsubSub();
      unsubRaiz();
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.lida).length;

  return { notifications, unreadCount, loading };
}
