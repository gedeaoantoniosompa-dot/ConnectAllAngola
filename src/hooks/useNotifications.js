// hooks/useNotifications.js
// Lê de DUAS fontes em simultâneo:
//   1. notificacoes/{uid}/items  — admin panel escreve aqui
//   2. notificacoes (raiz) com userId == uid — notificações da app
// ✅ FIX: cancela listeners imediatamente ao fazer logout (user = null)
// ✅ FIX: suprime erros permission-denied (esperados durante logout)
// ✅ FIX: não volta a subscrever se o user não mudou

import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';

export function useNotifications() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);

  // Guarda os unsubscribers para podermos cancelar a qualquer momento
  const unsubSubRef  = useRef(null);
  const unsubRaizRef = useRef(null);
  const montadoRef   = useRef(true);

  // Cancela ambos os listeners de forma segura
  const cancelarListeners = () => {
    if (unsubSubRef.current)  { unsubSubRef.current();  unsubSubRef.current  = null; }
    if (unsubRaizRef.current) { unsubRaizRef.current(); unsubRaizRef.current = null; }
  };

  useEffect(() => {
    montadoRef.current = true;

    // ── SEM SESSÃO ou ANÓNIMO → cancela listeners e limpa estado ──
    if (!user || user.isAnonymous) {
      cancelarListeners();
      setNotifications([]);
      setLoading(false);
      return;
    }

    const uid = user.uid;

    // Listas separadas para mesclar quando qualquer uma atualizar
    let listaSubcolecao = [];
    let listaRaiz       = [];
    let subPronta       = false;
    let raizPronta      = false;

    const mesclar = () => {
      if (!montadoRef.current) return;
      // Só atualiza o estado quando ambas as fontes já responderam
      // (evita flickering com lista vazia no início)
      if (!subPronta || !raizPronta) return;

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
    };

    // ── FONTE 1: notificacoes/{uid}/items ──
    try {
      const qSub = query(
        collection(db, 'notificacoes', uid, 'items'),
        orderBy('enviadoEm', 'desc')
      );
      unsubSubRef.current = onSnapshot(
        qSub,
        snap => {
          if (!montadoRef.current) return;
          listaSubcolecao = snap.docs.map(d => ({
            id:        'sub_' + d.id,
            ...d.data(),
            titulo:    d.data().titulo || d.data().title || 'Notificação',
            createdAt: d.data().enviadoEm || d.data().createdAt,
            lida:      d.data().lida ?? false,
            _ref:      d.ref,
          }));
          subPronta = true;
          mesclar();
        },
        err => {
          // permission-denied é esperado durante/após logout — silencia completamente
          const cod = err?.code || '';
          if (!cod.includes('permission-denied') && !cod.includes('insufficient')) {
            console.log('[useNotifications] fonte1 err:', cod);
          }
          subPronta = true;
          mesclar();
        }
      );
    } catch (_) {
      subPronta = true;
      mesclar();
    }

    // ── FONTE 2: notificacoes (raiz) com userId == uid ──
    try {
      const qRaiz = query(
        collection(db, 'notificacoes'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      unsubRaizRef.current = onSnapshot(
        qRaiz,
        snap => {
          if (!montadoRef.current) return;
          listaRaiz = snap.docs.map(d => ({
            id:        'raiz_' + d.id,
            ...d.data(),
            titulo:    d.data().titulo || d.data().title || 'Notificação',
            createdAt: d.data().createdAt || d.data().enviadoEm,
            lida:      d.data().lida ?? false,
            _ref:      d.ref,
          }));
          raizPronta = true;
          mesclar();
        },
        err => {
          const cod = err?.code || '';
          if (!cod.includes('permission-denied') && !cod.includes('insufficient')) {
            console.log('[useNotifications] fonte2 err:', cod);
          }
          raizPronta = true;
          mesclar();
        }
      );
    } catch (_) {
      raizPronta = true;
      mesclar();
    }

    // ── CLEANUP: cancela listeners ao desmontar ou ao user mudar ──
    return () => {
      montadoRef.current = false;
      cancelarListeners();
    };
  }, [user?.uid]); // ← depende só do UID, não do objecto user inteiro

  const unreadCount = notifications.filter(n => !n.lida).length;

  return { notifications, unreadCount, loading };
}