import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';

// Mantém, em tempo real, o conjunto de UIDs verificados pelo painel admin
// (campo "verificado: true" em users/{uid}, escrito por verificarConta()
// no index.html do Admin Panel).
//
// Isto substitui qualquer campo "autorVerificado" gravado directamente nos
// posts — que era apenas uma cópia estática feita no momento da publicação
// e podia (a) ficar desactualizada se a conta fosse verificada depois de já
// ter posts, ou (b) em teoria ser escrita pelo próprio cliente, já que quem
// publica os posts é a app e não uma Cloud Function.
//
// Com este hook, o badge de verificado passa a reflectir sempre o estado
// actual em users/{uid}.verificado, e nunca o que estiver gravado no post.
export function useContasVerificadas() {
  const [verificados, setVerificados] = useState(new Set());

  useEffect(() => {
    const q = query(collection(db, 'users'), where('verificado', '==', true));
    const unsub = onSnapshot(
      q,
      snap => setVerificados(new Set(snap.docs.map(d => d.id))),
      err => console.warn('[useContasVerificadas]', err)
    );
    return unsub;
  }, []);

  return verificados;
}