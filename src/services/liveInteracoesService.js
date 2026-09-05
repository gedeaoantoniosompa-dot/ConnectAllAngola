/**
 * src/services/liveInteracoesService.js — ConnectAll Angola
 *
 * Interações sociais das lives, complementares ao livesService.js:
 *  - Comentários em tempo real (chat sobreposto ao vídeo, estilo TikTok)
 *  - Pedidos de espectadores para subirem ao palco como co-apresentadores
 *  - Gestão do palco (quem está a co-apresentar neste momento)
 *  - Reações (gostos) com contagem em tempo real
 *  - Partilha da live para o feed da app
 *
 * ── ALTERAÇÃO ──
 * Cada convidado no palco passa a ter o seu próprio estado de vídeo
 * (cameraDesligada, videoPausado, microfoneDesligado) gravado no respectivo
 * documento em lives/{liveId}/palco/{uid}. Antes, quando um convidado
 * desligava a câmara ou punha o vídeo em pausa, isso só se via no próprio
 * ecrã dele — agora, como o LiveStageStrip lê estes campos do mesmo
 * documento, TODOS os espectadores veem correctamente a foto de perfil
 * (câmara desligada) ou o logótipo da ConnectAll (pausa) desse convidado.
 * fotoURL também passa a ser guardado, para o LiveStageStrip poder mostrar
 * a foto certa sem precisar de mais nenhuma consulta.
 *
 * ATENÇÃO: assume-se que `db` (instância do Firestore) está exportada em
 * '../config/firebase', o mesmo padrão que livesService.js já usa. Se a tua
 * configuração do Firebase estiver noutro caminho, ajusta apenas a linha de
 * import abaixo — o resto do ficheiro não depende de mais nada específico
 * do projeto além de `uidNumericoDe`, já existente em livesService.js.
 *
 * Estrutura de dados no Firestore, por live (lives/{liveId}):
 *   comentarios/{autoId}   — { uid, nome, texto, criadoEm }
 *   pedidos/{uid}          — { uid, nome, fotoURL, numUid, estado, criadoEm }
 *   palco/{uid}            — { uid, nome, fotoURL, numUid, entrouEm,
 *                               cameraDesligada, videoPausado, microfoneDesligado }
 *   (documento da live)    — ganha os campos hostUidNumerico e gostosCount
 */

import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    increment,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uidNumericoDe } from './livesService';

// --- Live (documento principal, em tempo real) ---------------------------

export function ouvirLive(liveId, callback) {
  if (!liveId) return () => {};
  return onSnapshot(
    doc(db, 'lives', liveId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (e) => console.warn('[liveInteracoesService] Erro ao ouvir live:', e)
  );
}

// Regista o uid numérico (Agora) do host assim que ele entra no canal, para
// que os espectadores saibam qual vídeo remoto é o do apresentador principal.
export async function definirHostUidNumerico(liveId, numUid) {
  if (!liveId) return;
  await updateDoc(doc(db, 'lives', liveId), { hostUidNumerico: numUid }).catch(() => {});
}

// --- Comentários -----------------------------------------------------------

export async function enviarComentario(liveId, user, texto) {
  if (!liveId || !user?.uid || !texto?.trim()) return;
  await addDoc(collection(db, 'lives', liveId, 'comentarios'), {
    uid: user.uid,
    nome: user.nome || 'Anónimo',
    texto: texto.trim().slice(0, 200),
    criadoEm: serverTimestamp(),
  });
}

// Devolve sempre a lista completa (até ao limite), já ordenada do mais
// antigo para o mais recente — pronta a apresentar numa lista scrollável.
export function ouvirComentarios(liveId, callback, limiteVisivel = 200) {
  if (!liveId) return () => {};
  const q = query(collection(db, 'lives', liveId, 'comentarios'), orderBy('criadoEm', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(lista.slice(-limiteVisivel));
    },
    (e) => console.warn('[liveInteracoesService] Erro ao ouvir comentários:', e)
  );
}

// --- Pedidos para subir ao palco --------------------------------------------
// user: { uid, nome, fotoURL? }

export async function pedirParaSubir(liveId, user) {
  if (!liveId || !user?.uid) return;
  await setDoc(doc(db, 'lives', liveId, 'pedidos', user.uid), {
    uid: user.uid,
    nome: user.nome || 'Anónimo',
    fotoURL: user.fotoURL || null,
    numUid: uidNumericoDe(user.uid),
    estado: 'pendente',
    criadoEm: serverTimestamp(),
  });
}

export async function cancelarPedido(liveId, uid) {
  if (!liveId || !uid) return;
  await deleteDoc(doc(db, 'lives', liveId, 'pedidos', uid)).catch(() => {});
}

export function ouvirMeuPedido(liveId, uid, callback) {
  if (!liveId || !uid) return () => {};
  return onSnapshot(
    doc(db, 'lives', liveId, 'pedidos', uid),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (e) => console.warn('[liveInteracoesService] Erro ao ouvir o meu pedido:', e)
  );
}

// Usado pelo host: lista de pedidos ainda por responder.
export function ouvirPedidosPendentes(liveId, callback) {
  if (!liveId) return () => {};
  const q = query(
    collection(db, 'lives', liveId, 'pedidos'),
    where('estado', '==', 'pendente'),
    orderBy('criadoEm', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.warn('[liveInteracoesService] Erro ao ouvir pedidos pendentes:', e)
  );
}

// aceite=true → o pedido passa a "aceite" e o espectador entra na coleção
// 'palco'. aceite=false → fica marcado como "recusado" (o cliente deve
// depois limpar com cancelarPedido para permitir um novo pedido).
export async function responderPedido(liveId, pedido, aceite) {
  if (!liveId || !pedido?.uid) return;
  await updateDoc(doc(db, 'lives', liveId, 'pedidos', pedido.uid), {
    estado: aceite ? 'aceite' : 'recusado',
  });
  if (aceite) {
    await setDoc(doc(db, 'lives', liveId, 'palco', pedido.uid), {
      uid: pedido.uid,
      nome: pedido.nome,
      fotoURL: pedido.fotoURL || null,
      numUid: pedido.numUid,
      // Estado inicial do vídeo do convidado — ver atualizarEstadoConvidado.
      cameraDesligada: false,
      videoPausado: false,
      microfoneDesligado: false,
      entrouEm: serverTimestamp(),
    });
  }
}

// --- Palco (co-apresentadores atualmente em direto) -------------------------

export function ouvirPalco(liveId, callback) {
  if (!liveId) return () => {};
  return onSnapshot(
    collection(db, 'lives', liveId, 'palco'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.warn('[liveInteracoesService] Erro ao ouvir palco:', e)
  );
}

// Remove um convidado do palco. Chamado pelo host (para "descer" alguém) ou
// pelo próprio convidado (para sair voluntariamente) — o efeito é o mesmo.
export async function removerDoPalco(liveId, uid) {
  if (!liveId || !uid) return;
  await deleteDoc(doc(db, 'lives', liveId, 'palco', uid)).catch(() => {});
  await deleteDoc(doc(db, 'lives', liveId, 'pedidos', uid)).catch(() => {});
}

export async function sairDoPalco(liveId, uid) {
  return removerDoPalco(liveId, uid);
}

// Actualiza o estado de vídeo/áudio de UM convidado específico no palco.
// Chamado pelo próprio convidado (watch/[id].jsx) sempre que ele liga/
// desliga a câmara, põe o vídeo em pausa, ou muda o microfone — é isto que
// faz o LiveStageStrip mostrar a foto/logótipo correctos para TODOS os
// espectadores, e não só no ecrã do próprio convidado.
export async function atualizarEstadoConvidado(liveId, uid, estado = {}) {
  if (!liveId || !uid) return;
  const dados = {};
  if (typeof estado.cameraDesligada === 'boolean') dados.cameraDesligada = estado.cameraDesligada;
  if (typeof estado.videoPausado === 'boolean') dados.videoPausado = estado.videoPausado;
  if (typeof estado.microfoneDesligado === 'boolean') dados.microfoneDesligado = estado.microfoneDesligado;
  if (Object.keys(dados).length === 0) return;
  await updateDoc(doc(db, 'lives', liveId, 'palco', uid), dados).catch(() => {});
}

// --- Reações (gostos) ---------------------------------------------------------

export async function reagirLive(liveId) {
  if (!liveId) return;
  await updateDoc(doc(db, 'lives', liveId), { gostosCount: increment(1) }).catch(() => {});
}

// --- Partilhar a live no feed ---------------------------------------------------

// NOTA: assume uma coleção 'posts' com um campo `tipo` para distinguir os
// diferentes tipos de publicação no feed. Ajusta o nome da coleção e os
// campos abaixo para corresponderem ao esquema do teu feed, se for diferente.
export async function partilharLiveNoFeed(live, user) {
  if (!live?.id || !user?.uid) return;
  await addDoc(collection(db, 'posts'), {
    tipo: 'live_partilhada',
    liveId: live.id,
    channelName: live.channelName,
    titulo: live.titulo,
    cor: live.cor || '#1677F2',
    hostNome: live.hostNome,
    autorUid: user.uid,
    autorNome: user.nome || 'Anónimo',
    criadoEm: serverTimestamp(),
  });
}