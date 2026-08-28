import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';

/**
 * usePrivacidade — lê e guarda as preferências de privacidade do utilizador.
 *
 * Estrutura guardada em Firestore: users/{uid}.privacidade
 * {
 *   onlineActivo: boolean,        // mostrar estado online
 *   quemPodeEnviar: 'todos' | 'ligacoes' | 'ninguem',
 *   notificacoesActivas: boolean,
 * }
 */
export function usePrivacidade(uid) {
  const [privacidade, setPrivacidade] = useState({
    onlineActivo: true,
    quemPodeEnviar: 'todos',
    notificacoesActivas: true,
  });
  const [carregando, setCarregando] = useState(true);

  // Ouve em tempo real as preferências do utilizador
  useEffect(() => {
    if (!uid) return;

    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists) {
        const dados = snap.data();
        const priv = dados.privacidade;
        if (priv) {
          setPrivacidade({
            onlineActivo: priv.onlineActivo !== undefined ? priv.onlineActivo : true,
            quemPodeEnviar: priv.quemPodeEnviar || 'todos',
            notificacoesActivas: priv.notificacoesActivas !== undefined ? priv.notificacoesActivas : true,
          });
        }
      }
      setCarregando(false);
    });

    return () => unsub();
  }, [uid]);

  // Atualiza um ou mais campos de privacidade no Firestore
  const atualizarPrivacidade = async (novosCampos) => {
    if (!uid) return;
    try {
      // Atualiza localmente de imediato (otimista)
      setPrivacidade((prev) => ({ ...prev, ...novosCampos }));
      // Guarda no Firestore
      await setDoc(
        doc(db, 'users', uid),
        { privacidade: { ...privacidade, ...novosCampos } },
        { merge: true }
      );
    } catch (err) {
      console.error('Erro ao guardar privacidade:', err);
      // Reverte em caso de erro
      setPrivacidade((prev) => ({ ...prev }));
    }
  };

  return { privacidade, atualizarPrivacidade, carregando };
}
