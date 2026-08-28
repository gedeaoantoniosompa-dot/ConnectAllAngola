// services/livesService.js
//
// Fala com o Firestore e reutiliza a Cloud Function gerarTokenAgora que já
// existe no projecto (usada pela Feira do Saber e pelas Entrevistas).
// Essa função recebe { channelName, uid } e devolve { token } — não usa
// "role"; quem decide broadcaster/audience é o AgoraEngine, localmente.
//
// Ajusta o import abaixo se config/firebase.js não estiver na raiz do projecto.
import { app, db } from '../config/firebase';

import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const livesRef = collection(db, 'lives');

// Mesma fórmula usada em sala-entrevista.jsx para derivar um uid numérico
// estável a partir do uid (string) do Firebase Auth — importante manter
// igual, senão o mesmo utilizador entra com uids diferentes em features
// diferentes.
export function uidNumericoDe(uid) {
  if (!uid) return Math.floor(Math.random() * 100000);
  return Math.abs(uid.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000;
}

// --- Leitura em tempo real -------------------------------------------------

export function ouvirLivesAtivas(callback) {
  const q = query(livesRef, where('status', '==', 'ao_vivo'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function ouvirLivesAgendadas(callback) {
  const q = query(livesRef, where('status', '==', 'agendada'), orderBy('scheduledFor', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// --- Criar / agendar / terminar --------------------------------------------
// user: { uid, nome, cargo? } — passa o que já vem de useUser()/perfil.

export async function criarLive({ user, titulo, area, cor }) {
  if (!user?.uid) throw new Error('Precisas de ter sessão iniciada.');

  const novaLive = {
    hostId: user.uid,
    hostNome: user.nome || 'Utilizador',
    hostCargo: user.cargo || '',
    titulo,
    area,
    cor,
    channelName: `live_${user.uid}_${Date.now()}`,
    status: 'ao_vivo',
    ouvintesCount: 0,
    scheduledFor: null,
    createdAt: serverTimestamp(),
    endedAt: null,
  };

  const docRef = await addDoc(livesRef, novaLive);
  return { id: docRef.id, ...novaLive };
}

export async function agendarLive({ user, titulo, area, cor, scheduledFor }) {
  if (!user?.uid) throw new Error('Precisas de ter sessão iniciada.');

  const novaLive = {
    hostId: user.uid,
    hostNome: user.nome || 'Utilizador',
    hostCargo: user.cargo || '',
    titulo,
    area,
    cor,
    channelName: `live_${user.uid}_${Date.now()}`,
    status: 'agendada',
    ouvintesCount: 0,
    scheduledFor,
    createdAt: serverTimestamp(),
    endedAt: null,
  };

  const docRef = await addDoc(livesRef, novaLive);
  return { id: docRef.id, ...novaLive };
}

export async function terminarLive(liveId) {
  await updateDoc(doc(db, 'lives', liveId), {
    status: 'terminada',
    endedAt: serverTimestamp(),
  });
}

// --- Token Agora (reutiliza gerarTokenAgora já existente) ------------------

export async function obterTokenAgora(channelName, uid) {
  const functions = getFunctions(app, 'europe-west1');
  const gerarToken = httpsCallable(functions, 'gerarTokenAgora');
  const { data } = await gerarToken({ channelName, uid });
  return data?.token || null;
}

// --- Presença de ouvintes (alimenta ouvintesCount via Cloud Function) ------

export async function entrarComoOuvinte(liveId, uid) {
  if (!uid) return;
  await setDoc(doc(db, 'lives', liveId, 'viewers', uid), {
    joinedAt: serverTimestamp(),
  });
}

export async function sairComoOuvinte(liveId, uid) {
  if (!uid) return;
  await deleteDoc(doc(db, 'lives', liveId, 'viewers', uid)).catch(() => {});
}

// --- Lembretes para lives agendadas -----------------------------------------

export async function ativarLembrete(liveId, uid) {
  if (!uid) throw new Error('Precisas de ter sessão iniciada.');
  await setDoc(doc(db, 'lives', liveId, 'lembretes', uid), {
    criadoEm: serverTimestamp(),
  });
}

export async function desativarLembrete(liveId, uid) {
  if (!uid) return;
  await deleteDoc(doc(db, 'lives', liveId, 'lembretes', uid)).catch(() => {});
}