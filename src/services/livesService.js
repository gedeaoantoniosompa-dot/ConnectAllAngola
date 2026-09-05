// services/livesService.js
//
// Fala com o Firestore e reutiliza a Cloud Function gerarTokenAgora que já
// existe no projecto (usada pela Feira do Saber e pelas Entrevistas).
// Essa função recebe { channelName, uid } e devolve { token } — não usa
// "role"; quem decide broadcaster/audience é o AgoraEngine, localmente.
//
// Ajusta o import abaixo se config/firebase.js não estiver na raiz do projecto.
//
// ── ALTERAÇÕES ──
// 1) HEARTBEAT: o anfitrião confirma "ainda estou ao vivo" a cada 20s
//    (ver atualizarHeartbeat, chamado em broadcast.jsx). ouvirLivesAtivas
//    passa a ignorar qualquer live cujo último heartbeat tenha mais de 60s
//    — isto resolve o problema de lives "fantasma" que ficavam presas em
//    status "ao_vivo" para sempre quando o anfitrião fecha a app sem
//    terminar a transmissão de forma limpa (crash, fechar forçado, etc.).
//    O documento em si só é marcado "terminada" quando terminarLive() é
//    chamado com sucesso, mas mesmo que isso nunca aconteça, a live deixa
//    de aparecer para todos assim que o heartbeat expira.
// 2) ESTADO DE VÍDEO: novo atualizarEstadoVideo(liveId, { cameraDesligada,
//    videoPausado }) — grava no próprio documento da live, para que tanto
//    o anfitrião como os espectadores (via ouvirLive, em
//    liveInteracoesService.js, que lê o mesmo documento) saibam distinguir
//    "câmara desligada" de "vídeo em pausa".
// 3) hostFotoURL passa a ser gravado ao criar a live, para os espectadores
//    poderem mostrar a foto do anfitrião quando a câmara estiver desligada.
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

// Quanto tempo pode passar sem um heartbeat do anfitrião antes de a live
// deixar de ser considerada "ao vivo" para quem está a ver a lista.
const HEARTBEAT_EXPIRA_MS = 60000; // 60 segundos

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
    const agora = Date.now();
    const lives = [];

    snap.docs.forEach((d) => {
      const live = { id: d.id, ...d.data() };

      // Usa o heartbeat se existir; senão cai para createdAt. Importante:
      // usar "!== undefined" em vez de "??", para não confundir um campo
      // que ainda não existe (undefined) com um campo que existe mas
      // ainda está pendente de confirmação do servidor (null).
      const referencia = live.lastHeartbeat !== undefined ? live.lastHeartbeat : live.createdAt;

      let fresca;
      if (referencia === null) {
        // A live foi criada agora mesmo por este cliente e o servidor
        // ainda não confirmou o timestamp — não é uma live fantasma,
        // só ainda não resolveu. Não esconder.
        fresca = true;
      } else if (referencia && typeof referencia.toMillis === 'function') {
        fresca = agora - referencia.toMillis() < HEARTBEAT_EXPIRA_MS;
      } else {
        // CORRECÇÃO: antes, um timestamp em falta ou num formato
        // inesperado (ex: lives antigas criadas antes desta função
        // existir, ou inseridas manualmente para testes, sem um
        // Timestamp válido do Firestore) fazia esta live ser tratada
        // como "recente" e nunca mais desaparecer. Agora é tratada
        // como fantasma — some da lista e é terminada abaixo.
        fresca = false;
      }

      if (fresca) {
        lives.push(live);
      } else {
        // Limpeza real: não basta escondê-la só neste cliente — qualquer
        // app que detecte uma live fantasma marca-a como "terminada" no
        // Firestore, para desaparecer de vez para todos, não só para
        // quem a detectou primeiro. Repetir esta chamada é inofensivo
        // (o campo já fica "terminada" na próxima vez).
        terminarLive(live.id).catch(() => {});
      }
    });

    callback(lives);
  });
}

export function ouvirLivesAgendadas(callback) {
  const q = query(livesRef, where('status', '==', 'agendada'), orderBy('scheduledFor', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// --- Criar / agendar / terminar --------------------------------------------
// user: { uid, nome, cargo?, fotoURL? } — passa o que já vem de useUser()/perfil.

export async function criarLive({ user, titulo, area, cor }) {
  if (!user?.uid) throw new Error('Precisas de ter sessão iniciada.');

  const novaLive = {
    hostId: user.uid,
    hostNome: user.nome || 'Utilizador',
    hostCargo: user.cargo || '',
    hostFotoURL: user.fotoURL || null,
    titulo,
    area,
    cor,
    channelName: `live_${user.uid}_${Date.now()}`,
    status: 'ao_vivo',
    ouvintesCount: 0,
    cameraDesligada: false,
    videoPausado: false,
    scheduledFor: null,
    createdAt: serverTimestamp(),
    lastHeartbeat: serverTimestamp(),
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
    hostFotoURL: user.fotoURL || null,
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

// --- Heartbeat (mantém a live viva enquanto o anfitrião estiver ligado) ----
// Chamado periodicamente (ex: a cada 20s) enquanto broadcast.jsx está
// activo. Sem heartbeat recente, ouvirLivesAtivas deixa de mostrar a live.
export async function atualizarHeartbeat(liveId) {
  if (!liveId) return;
  await updateDoc(doc(db, 'lives', liveId), {
    lastHeartbeat: serverTimestamp(),
  }).catch(() => {});
}

// --- Estado do vídeo do anfitrião (câmara desligada / vídeo em pausa) ------
// São dois estados distintos e propositadamente separados:
//   cameraDesligada — o anfitrião desligou a câmara; os espectadores veem
//                      a foto de perfil do anfitrião.
//   videoPausado    — o anfitrião colocou o vídeo em pausa; os espectadores
//                      veem o logótipo da ConnectAll, até ele retomar.
export async function atualizarEstadoVideo(liveId, estado = {}) {
  if (!liveId) return;
  const dados = {};
  if (typeof estado.cameraDesligada === 'boolean') dados.cameraDesligada = estado.cameraDesligada;
  if (typeof estado.videoPausado === 'boolean') dados.videoPausado = estado.videoPausado;
  if (Object.keys(dados).length === 0) return;
  await updateDoc(doc(db, 'lives', liveId), dados).catch(() => {});
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