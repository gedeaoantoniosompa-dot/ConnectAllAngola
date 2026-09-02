// functions/analytics.js
//
// Contadores de "Análise" do perfil: visualizações de perfil e aberturas
// de publicações, cada um com um ciclo fixo de 30 dias — o contador
// reinicia para 0 assim que a primeira visualização/abertura seguinte ao
// fim desse ciclo acontece (não há um relógio de fundo a repor sozinho;
// se quiseres reposição automática mesmo sem visitas novas, isto pode ser
// complementado com uma função agendada — diz-me se quiseres essa opção
// também).
//
// Guardado em users/{uid}.analytics:
//   analytics.perfilVisualizacoes   = { count, cicloInicio }
//   analytics.publicacoesImpressoes = { count, cicloInicio }
//
// Ambas as funções ignoram auto-visualizações (o próprio utilizador a
// ver o seu perfil, ou o autor a abrir a própria publicação) — não é
// suposto essas contarem para as estatísticas.

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
const REGIAO = 'europe-west1'; // mesma região usada em enviarCodigoEmail

function proximoContador(contadorAtual, agoraMs) {
  const cicloInicioMs = contadorAtual?.cicloInicio?.toMillis?.() ?? null;
  const cicloExpirado = !cicloInicioMs || (agoraMs - cicloInicioMs) >= TRINTA_DIAS_MS;
  if (cicloExpirado) {
    return { count: 1, cicloInicio: admin.firestore.Timestamp.fromMillis(agoraMs) };
  }
  return { count: (contadorAtual.count || 0) + 1, cicloInicio: contadorAtual.cicloInicio };
}

async function incrementarContador(uidAlvo, campo) {
  const ref = admin.firestore().doc(`users/${uidAlvo}`);
  const agoraMs = Date.now();
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const dados = snap.data() || {};
    const atual = dados.analytics?.[campo];
    const novo = proximoContador(atual, agoraMs);
    tx.set(ref, { analytics: { [campo]: novo } }, { merge: true });
  });
}

// Chamar quando alguém abre o perfil público de outro utilizador
// (perfil-publico.jsx). data: { uidPerfil }
exports.registrarVisualizacaoPerfil = functions.region(REGIAO).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Precisas de sessão iniciada.');
  }
  const uidVisitante = context.auth.uid;
  const uidPerfil = data?.uidPerfil;
  if (!uidPerfil || typeof uidPerfil !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uidPerfil em falta.');
  }
  if (uidVisitante === uidPerfil) return { ignorado: true }; // auto-visualização não conta

  await incrementarContador(uidPerfil, 'perfilVisualizacoes');
  return { ok: true };
});

// Chamar quando alguém abre/toca numa publicação (não em cada aparição no
// scroll do feed — só ao abrir/tocar, como decidido). data: { uidAutor }
exports.registrarAberturaPublicacao = functions.region(REGIAO).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Precisas de sessão iniciada.');
  }
  const uidVisitante = context.auth.uid;
  const uidAutor = data?.uidAutor;
  if (!uidAutor || typeof uidAutor !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uidAutor em falta.');
  }
  if (uidVisitante === uidAutor) return { ignorado: true }; // o próprio autor a abrir não conta

  await incrementarContador(uidAutor, 'publicacoesImpressoes');
  return { ok: true };
});