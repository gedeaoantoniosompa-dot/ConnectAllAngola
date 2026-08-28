/**
 * functions/index.js — ConnectAll Angola
 */

const { setGlobalOptions }   = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten, onDocumentUpdated, onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
} = require('@aws-sdk/client-rekognition');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ maxInstances: 10, region: 'europe-west1' });

const db   = admin.firestore();
const mess = admin.messaging();
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function eTokenExpo(token) {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

async function enviarPush({ token, title, body, data = {}, channelId = 'default' }) {
  if (!token) return null;

  if (eTokenExpo(token)) {
    const resposta = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default', channelId }),
    });
    if (!resposta.ok) throw new Error(`Expo Push HTTP ${resposta.status}`);
    return resposta.json();
  }

  return mess.send({
    token,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')])),
    android: { priority: 'high', notification: { channelId, defaultSound: true, defaultVibrateTimings: true } },
    apns: { payload: { aps: { alert: { title, body }, sound: 'default' } } },
  });
}

async function tokenDoUtilizador(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data()?.fcmToken : null;
}

function criarClienteRekognition() {
  return new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

async function verificarAdmin(uid) {
  if (!uid) return false;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return false;
  return snap.data().role === 'admin';
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO 1 — verificarFacial
// ══════════════════════════════════════════════════════════════════════════════
exports.verificarFacial = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { selfie, documento, uid } = request.data;

    if (!selfie || !documento) {
      throw new HttpsError('invalid-argument', 'selfie e documento são obrigatórios.');
    }
    if (!request.auth && !uid) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const uidFinal = request.auth?.uid || uid;

    try {
      const client = criarClienteRekognition();

      const selfieBuffer    = Buffer.from(selfie,    'base64');
      const documentoBuffer = Buffer.from(documento, 'base64');

      const detectResult = await client.send(new DetectFacesCommand({
        Image: { Bytes: selfieBuffer },
        Attributes: ['DEFAULT'],
      }));

      if (!detectResult.FaceDetails || detectResult.FaceDetails.length === 0) {
        return {
          aprovado: false,
          similaridade: 0,
          mensagem: 'Nenhum rosto detectado na selfie. Certifica-te que o teu rosto está visível e bem iluminado.',
        };
      }

      const compareResult = await client.send(new CompareFacesCommand({
        SourceImage: { Bytes: selfieBuffer },
        TargetImage: { Bytes: documentoBuffer },
        SimilarityThreshold: 70,
      }));

      const similaridade = compareResult.FaceMatches?.[0]?.Similarity || 0;
      const aprovado     = similaridade >= 80;

      if (uidFinal) {
        await db.collection('users').doc(uidFinal)
          .collection('verificacaoFacial').doc('resultado')
          .set({
            aprovado,
            similaridade,
            dataValidacao: admin.firestore.FieldValue.serverTimestamp(),
            metodo: 'aws-rekognition',
          }, { merge: true });

        if (aprovado) {
          await db.collection('users').doc(uidFinal).set({
            verificacaoFacialAprovada:     true,
            verificacaoFacialSimilaridade: similaridade,
          }, { merge: true });
        }
      }

      return {
        aprovado,
        similaridade: Math.round(similaridade * 10) / 10,
        mensagem: aprovado
          ? `Identidade confirmada com ${similaridade.toFixed(1)}% de correspondência.`
          : `Correspondência insuficiente (${similaridade.toFixed(1)}%). Mínimo exigido: 80%.`,
      };

    } catch (err) {
      console.error('Erro Rekognition:', err);
      if (err.name === 'InvalidParameterException') {
        return { aprovado: false, similaridade: 0, mensagem: 'Não foi possível detectar um rosto claro no documento.' };
      }
      if (err.name === 'ImageTooLargeException') {
        return { aprovado: false, similaridade: 0, mensagem: 'Imagem demasiado grande. Usa uma foto com menor resolução.' };
      }
      throw new HttpsError('internal', 'Erro interno na verificação facial. Tenta novamente.');
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO 2 — verificarDocumentoEmpresa
// ══════════════════════════════════════════════════════════════════════════════
exports.verificarDocumentoEmpresa = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { selfie, docFrente, uid } = request.data;

    if (!selfie || !docFrente) {
      throw new HttpsError('invalid-argument', 'selfie e docFrente são obrigatórios.');
    }

    const uidFinal = request.auth?.uid || uid;

    try {
      const client = criarClienteRekognition();

      const selfieBuffer = Buffer.from(selfie,    'base64');
      const docBuffer    = Buffer.from(docFrente, 'base64');

      const detectResult = await client.send(new DetectFacesCommand({
        Image: { Bytes: selfieBuffer },
        Attributes: ['DEFAULT'],
      }));

      if (!detectResult.FaceDetails?.length) {
        return { aprovado: false, similaridade: 0, mensagem: 'Nenhum rosto detectado na selfie.' };
      }

      const compareResult = await client.send(new CompareFacesCommand({
        SourceImage: { Bytes: selfieBuffer },
        TargetImage: { Bytes: docBuffer },
        SimilarityThreshold: 70,
      }));

      const similaridade = compareResult.FaceMatches?.[0]?.Similarity || 0;
      const aprovado     = similaridade >= 80;

      if (uidFinal) {
        await db.collection('users').doc(uidFinal).set({
          verificacaoResponsavelAprovada:     aprovado,
          verificacaoResponsavelSimilaridade: similaridade,
        }, { merge: true });
      }

      return {
        aprovado,
        similaridade: Math.round(similaridade * 10) / 10,
        mensagem: aprovado
          ? `Responsável verificado com ${similaridade.toFixed(1)}% de correspondência.`
          : `Correspondência insuficiente (${similaridade.toFixed(1)}%). Mínimo exigido: 80%.`,
      };

    } catch (err) {
      console.error('Erro verificação empresa:', err);
      if (err.name === 'InvalidParameterException') {
        return { aprovado: false, similaridade: 0, mensagem: 'Rosto não detectado no documento.' };
      }
      throw new HttpsError('internal', 'Erro interno. Tenta novamente.');
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO 3 — gerarTokenAgora
// ══════════════════════════════════════════════════════════════════════════════
exports.gerarTokenAgora = onCall({ enforceAppCheck: false }, async (request) => {
  const { channelName, uid } = request.data;

  if (!channelName || uid === undefined) {
    throw new HttpsError('invalid-argument', 'channelName e uid são obrigatórios.');
  }

  const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

  const appID              = process.env.AGORA_APP_ID;
  const appCertificate     = process.env.AGORA_APP_CERTIFICATE;
  const role               = RtcRole.PUBLISHER;
  const currentTimestamp   = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + 3600;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appID, appCertificate, channelName, uid, role, privilegeExpiredTs
  );

  return { token, appId: appID };
});

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO 4 — notificarChamadaRecebida
// ══════════════════════════════════════════════════════════════════════════════
exports.notificarChamadaRecebida = onDocumentWritten(
  { document: 'chamadas/{chamadaId}', region: 'europe-west1' },
  async (event) => {
    const depois = event.data.after;
    const antes  = event.data.before;

    if (!depois.exists) return null;

    const dadosDepois = depois.data();
    const dadosAntes  = antes.exists ? antes.data() : {};

    if (dadosDepois.estado !== 'a_ligar') return null;
    if (dadosAntes.estado  === 'a_ligar') return null;

    const { para, de, tipo, channel } = dadosDepois;
    if (!para || !de) return null;

    const destinatarioSnap = await db.collection('users').doc(para).get();
    if (!destinatarioSnap.exists) return null;

    const fcmToken = destinatarioSnap.data()?.fcmToken;
    if (!fcmToken) {
      console.log(`[FCM] Utilizador ${para} sem fcmToken — notificação ignorada.`);
      return null;
    }

    const remetenteSnap = await db.collection('users').doc(de).get();
    const remetente     = remetenteSnap.exists ? remetenteSnap.data() : {};
    const nomeRemetente = remetente?.nome    || 'ConnectAll Angola';
    const fotoRemetente = remetente?.fotoURL || '';

    const chamadaId  = event.params.chamadaId;
    const eTipoVideo = tipo === 'video';

    try {
      const res = await enviarPush({
        token: fcmToken,
        title: eTipoVideo ? '📹 Videochamada recebida' : '📞 Chamada recebida',
        body: `${nomeRemetente} está a ligar...`,
        channelId: 'chamadas',
        data: {
          tipo: 'chamada_recebida', chatId: chamadaId, deUid: de,
          deNome: nomeRemetente, deFoto: fotoRemetente,
          tipoCham: tipo || 'voz', channel: channel || chamadaId,
        },
      });
      console.log(`[FCM] Notificação enviada: ${res}`);
    } catch (err) {
      console.error('[FCM] Erro ao enviar notificação:', err);
    }

    return null;
  }
);

// Envia uma notificação do Firestore para o dispositivo mesmo com a app fechada.
exports.notificarNovaNotificacao = onDocumentCreated(
  { document: 'notificacoes/{notificacaoId}', region: 'europe-west1' },
  async (event) => {
    const dados = event.data?.data();
    if (!dados?.userId) return null;

    const token = await tokenDoUtilizador(dados.userId);
    if (!token) return null;

    try {
      await enviarPush({
        token,
        title: 'ConnectAll Angola',
        body: dados.titulo || dados.title || 'Tens uma nova notificação na app ConnectAll.',
        channelId: 'default',
        data: { tipo: 'notificacao', notificacaoId: event.params.notificacaoId, url: '/(main)/notifications' },
      });
    } catch (err) {
      console.error('[Push] Erro ao notificar utilizador:', err);
    }
    return null;
  }
);

// Salas públicas são anunciadas aos utilizadores que têm um dispositivo registado.
// Salas privadas continuam acessíveis apenas por convite/código.
exports.notificarNovaSala = onDocumentCreated(
  { document: 'salas/{salaId}', region: 'europe-west1' },
  async (event) => {
    const sala = event.data?.data();
    if (!sala || sala.privada === true || sala.ativa === false) return null;

    const utilizadores = await db.collection('users').get();
    const envios = [];
    utilizadores.forEach((utilizador) => {
      const dados = utilizador.data();
      if (utilizador.id === sala.hostUid || !dados.fcmToken) return;
      envios.push(enviarPush({
        token: dados.fcmToken,
        title: 'Nova sala na ConnectAll',
        body: `${sala.hostNome || 'Alguém'} criou a sala "${sala.titulo || 'Feira do Saber'}".`,
        channelId: 'default',
        data: { tipo: 'nova_sala', salaId: event.params.salaId, url: '/(main)/saber' },
      }).catch(err => console.error(`[Push] Erro para ${utilizador.id}:`, err)));
    });
    await Promise.all(envios);
    return null;
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PROTECÇÃO CONTRA FORÇA BRUTA NO LOGIN
// ══════════════════════════════════════════════════════════════════════════════
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const MAX_TENTATIVAS_FASE1     = 3;
const MAX_TENTATIVAS_FASE2     = 3;
const DURACAO_BLOQUEIO_MINUTOS = 30;

// FUNÇÃO 5 — verificarBloqueioLogin
exports.verificarBloqueioLogin = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const email = (request.data?.email || '').trim().toLowerCase();
    if (!email) throw new HttpsError('invalid-argument', 'Email é obrigatório.');

    const db   = getFirestore();
    const ref  = db.collection('tentativasLogin').doc(email);
    const snap = await ref.get();

    if (!snap.exists) return { bloqueado: false, definitivo: false, tentativas: 0 };

    const dados        = snap.data();
    const bloqueadoAte = dados.bloqueadoAte?.toMillis?.() || 0;
    const agora        = Date.now();

    if (dados.bloqueioDefinitivo === true) return { bloqueado: true, definitivo: true };

    if (bloqueadoAte && agora < bloqueadoAte) {
      return {
        bloqueado: true, definitivo: false,
        minutosRestantes: Math.ceil((bloqueadoAte - agora) / 60000),
        tentativas: dados.tentativas || 0,
      };
    }

    if (bloqueadoAte && agora >= bloqueadoAte) {
      await ref.set({ tentativas: 0, bloqueadoAte: null, passouFase1: true }, { merge: true });
      return { bloqueado: false, definitivo: false, tentativas: 0 };
    }

    return { bloqueado: false, definitivo: false, tentativas: dados.tentativas || 0 };
  }
);

// FUNÇÃO 6 — registarTentativaLogin
exports.registarTentativaLogin = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const email   = (request.data?.email || '').trim().toLowerCase();
    const sucesso = request.data?.sucesso === true;

    if (!email) throw new HttpsError('invalid-argument', 'Email é obrigatório.');

    const db  = getFirestore();
    const ref = db.collection('tentativasLogin').doc(email);

    if (sucesso) {
      await ref.set({
        tentativas: 0, bloqueadoAte: null, passouFase1: false,
        bloqueioDefinitivo: false, ultimoSucesso: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { bloqueado: false, definitivo: false };
    }

    const snap  = await ref.get();
    const dados = snap.exists ? snap.data() : {};

    if (dados.bloqueioDefinitivo === true) return { bloqueado: true, definitivo: true };

    const jaPassouFase1   = dados.passouFase1 === true;
    const novasTentativas = (dados.tentativas || 0) + 1;
    const limiteActual    = jaPassouFase1 ? MAX_TENTATIVAS_FASE2 : MAX_TENTATIVAS_FASE1;

    if (novasTentativas >= limiteActual) {
      if (jaPassouFase1) {
        await ref.set({
          tentativas: novasTentativas, bloqueioDefinitivo: true,
          bloqueadoAte: null, ultimaTentativaFalhada: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { bloqueado: true, definitivo: true };
      } else {
        const bloqueadoAte = new Date(Date.now() + DURACAO_BLOQUEIO_MINUTOS * 60000);
        await ref.set({
          tentativas: novasTentativas, bloqueadoAte,
          ultimaTentativaFalhada: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { bloqueado: true, definitivo: false, minutosRestantes: DURACAO_BLOQUEIO_MINUTOS };
      }
    }

    await ref.set({
      tentativas: novasTentativas,
      ultimaTentativaFalhada: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { bloqueado: false, definitivo: false, tentativas: novasTentativas, restantes: limiteActual - novasTentativas };
  }
);

// FUNÇÃO 7 — desbloquearLoginAdmin
exports.desbloquearLoginAdmin = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');

    const eAdmin = await verificarAdmin(request.auth.uid);
    if (!eAdmin) throw new HttpsError('permission-denied', 'Apenas administradores podem desbloquear logins.');

    const email = (request.data?.email || '').trim().toLowerCase();
    if (!email) throw new HttpsError('invalid-argument', 'Email é obrigatório.');

    await db.collection('tentativasLogin').doc(email).set({
      tentativas: 0, bloqueadoAte: null, bloqueioDefinitivo: false, passouFase1: false,
      desbloqueadoEm:  admin.firestore.FieldValue.serverTimestamp(),
      desbloqueadoPor: request.auth.uid,
    }, { merge: true });

    return { mensagem: 'Login desbloqueado com sucesso para ' + email };
  }
);

// FUNÇÃO 8 — listarBloqueiosAdmin
exports.listarBloqueiosAdmin = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');

    const eAdmin = await verificarAdmin(request.auth.uid);
    if (!eAdmin) throw new HttpsError('permission-denied', 'Apenas administradores podem listar bloqueios.');

    const snap = await db.collection('tentativasLogin').where('tentativas', '>=', 3).get();

    const bloqueios = snap.docs.map(d => {
      const data         = d.data();
      const agora        = Date.now();
      const bloqueadoAte = data.bloqueadoAte?.toMillis?.() || 0;
      const ativo        = data.bloqueioDefinitivo === true || (bloqueadoAte && agora < bloqueadoAte);
      return {
        id: d.id, email: d.id, nome: d.id, tipo: 'bloqueio_login',
        mensagem: 'Bloqueado por excesso de tentativas falhadas (' + (data.tentativas || 0) + ' tentativas).' +
                  (data.bloqueioDefinitivo ? ' BLOQUEIO DEFINITIVO.' : ''),
        timestamp:  data.ultimaTentativaFalhada || null,
        status:     data.bloqueioDefinitivo ? 'definitivo' : (ativo ? 'bloqueado' : 'expirado'),
        bloqueadoAte: data.bloqueadoAte || null,
        tentativas: data.tentativas || 0,
        definitivo: data.bloqueioDefinitivo === true,
        _isBloqueioDireto: true,
      };
    });

    return { bloqueios };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO 9 — recuperarContaBloqueada
// ══════════════════════════════════════════════════════════════════════════════
exports.recuperarContaBloqueada = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { email, selfie, bi, selfieBi } = request.data;

    if (!email || !selfie || !bi || !selfieBi) {
      throw new HttpsError('invalid-argument', 'Todos os campos são obrigatórios: email, selfie, bi, selfieBi.');
    }

    const emailNorm = email.trim().toLowerCase();
    const dbInst    = getFirestore();
    const ref       = dbInst.collection('tentativasLogin').doc(emailNorm);
    const snap      = await ref.get();

    if (!snap.exists || snap.data()?.bloqueioDefinitivo !== true) {
      throw new HttpsError('failed-precondition', 'Esta conta não está bloqueada definitivamente.');
    }

    try {
      const client = criarClienteRekognition();

      const selfieBuffer   = Buffer.from(selfie,   'base64');
      const biBuffer       = Buffer.from(bi,       'base64');
      const selfieBiBuffer = Buffer.from(selfieBi, 'base64');

      const detectResult = await client.send(new DetectFacesCommand({
        Image: { Bytes: selfieBuffer },
        Attributes: ['DEFAULT'],
      }));

      if (!detectResult.FaceDetails?.length) {
        return {
          aprovado: false,
          mensagem: 'Nenhum rosto detectado na selfie. Certifica-te que o teu rosto está bem visível e iluminado.',
        };
      }

      const compareSelfieBI = await client.send(new CompareFacesCommand({
        SourceImage: { Bytes: selfieBuffer },
        TargetImage: { Bytes: biBuffer },
        SimilarityThreshold: 70,
      }));
      const similaridadeBI = compareSelfieBI.FaceMatches?.[0]?.Similarity || 0;

      if (similaridadeBI < 80) {
        return {
          aprovado: false,
          mensagem: `A selfie não corresponde ao BI (${similaridadeBI.toFixed(1)}%). Mínimo exigido: 80%.`,
        };
      }

      const compareSelfieComBI = await client.send(new CompareFacesCommand({
        SourceImage: { Bytes: selfieBuffer },
        TargetImage: { Bytes: selfieBiBuffer },
        SimilarityThreshold: 70,
      }));
      const similaridadeComBI = compareSelfieComBI.FaceMatches?.[0]?.Similarity || 0;

      if (similaridadeComBI < 75) {
        return {
          aprovado: false,
          mensagem: `Não foi possível confirmar que és a mesma pessoa na selfie com o BI (${similaridadeComBI.toFixed(1)}%).`,
        };
      }

      try {
        await admin.auth().getUserByEmail(emailNorm);
      } catch {
        throw new HttpsError('not-found', 'Conta não encontrada para este e-mail.');
      }

      try {
        const resetLink = await admin.auth().generatePasswordResetLink(emailNorm);
        console.log(`[Recuperação] Link de reset gerado para ${emailNorm}:`, resetLink);
      } catch (resetErr) {
        console.error('[Recuperação] Erro ao gerar link de reset:', resetErr);
      }

      await ref.set({
        pendentDesbloqueio:   true,
        recuperacaoIniciada:  FieldValue.serverTimestamp(),
        recuperacaoAprovada:  true,
        similaridadeBI:       Math.round(similaridadeBI * 10) / 10,
        similaridadeComBI:    Math.round(similaridadeComBI * 10) / 10,
        bloqueioDefinitivo:   false,
        tentativas:           0,
        passouFase1:          false,
        bloqueadoAte:         null,
        desbloqueadoEm:       FieldValue.serverTimestamp(),
        desbloqueadoPor:      'recuperacao_facial',
        historicoRecuperacao: FieldValue.arrayUnion({
          data:             new Date().toISOString(),
          aprovado:         true,
          similaridadeBI:   Math.round(similaridadeBI * 10) / 10,
          similaridadeComBI: Math.round(similaridadeComBI * 10) / 10,
        }),
      }, { merge: true });

      console.log(`[Recuperação] Conta ${emailNorm} aprovada e desbloqueada.`);
      return {
        aprovado: true,
        mensagem: `Identidade verificada com sucesso. Enviámos um link de redefinição de senha para ${emailNorm}.`,
      };

    } catch (err) {
      console.error('[Recuperação] Erro:', err);
      if (err.name === 'InvalidParameterException') {
        return { aprovado: false, mensagem: 'Não foi possível detectar um rosto claro numa das fotos.' };
      }
      if (err.name === 'ImageTooLargeException') {
        return { aprovado: false, mensagem: 'Uma das imagens é demasiado grande. Usa fotos com menor resolução.' };
      }
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Erro interno. Tenta novamente mais tarde.');
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO 10 — desbloquearAposRedefinicao
// ══════════════════════════════════════════════════════════════════════════════
exports.desbloquearAposRedefinicao = onDocumentWritten(
  { document: 'redefinicoesSenha/{uid}', region: 'europe-west1' },
  async (event) => {
    const depois = event.data.after;
    if (!depois.exists) return null;

    const dados = depois.data();
    if (!dados?.email || !dados?.concluido) return null;

    const emailNorm = dados.email.trim().toLowerCase();
    const dbInst    = getFirestore();
    const ref       = dbInst.collection('tentativasLogin').doc(emailNorm);
    const snap      = await ref.get();

    if (!snap.exists || snap.data()?.pendentDesbloqueio !== true) return null;

    await ref.set({
      bloqueioDefinitivo: false, pendentDesbloqueio: false,
      tentativas: 0, passouFase1: false, bloqueadoAte: null,
      desbloqueadoEm:  FieldValue.serverTimestamp(),
      desbloqueadoPor: 'recuperacao_facial',
    }, { merge: true });

    console.log(`[Desbloqueio] Conta ${emailNorm} desbloqueada após redefinição de senha.`);
    return null;
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// RECOMENDAÇÕES — Pessoas e Vagas por IA
// ══════════════════════════════════════════════════════════════════════════════

function interseccao(a = [], b = []) {
  const setB = new Set(
    b.map(x => (typeof x === 'string' ? x : x?.nome || x?.idioma || JSON.stringify(x)).toLowerCase())
  );
  return a.filter(x => {
    const v = (typeof x === 'string' ? x : x?.nome || x?.idioma || JSON.stringify(x)).toLowerCase();
    return setB.has(v);
  });
}

function calcularScorePessoa(eu, outro) {
  let score = 0;
  const razoes = [];

  if (eu.area && outro.area && eu.area === outro.area) {
    score += 40; razoes.push(`Mesma área: ${eu.area}`);
  }
  if (eu.provincia && outro.provincia && eu.provincia === outro.provincia) {
    score += 20; razoes.push(`Mesma província: ${eu.provincia}`);
    if (eu.municipio && outro.municipio && eu.municipio === outro.municipio) {
      score += 10; razoes.push(`Mesmo município: ${eu.municipio}`);
    }
  }
  if (eu.empresa && outro.empresa && eu.empresa === outro.empresa && eu.empresa !== 'Desempregado') {
    score += 30; razoes.push(`Mesma empresa: ${eu.empresa}`);
  }
  const compComuns = interseccao(eu.competenciasTecnicas || [], outro.competenciasTecnicas || []);
  if (compComuns.length > 0) {
    score += compComuns.length * 6; razoes.push(`${compComuns.length} competência(s) em comum`);
  }
  const intComuns = interseccao(eu.interesses || [], outro.interesses || []);
  if (intComuns.length > 0) {
    score += intComuns.length * 4; razoes.push(`${intComuns.length} interesse(s) em comum`);
  }
  const idiomasComuns = interseccao(eu.idiomas || [], outro.idiomas || []);
  if (idiomasComuns.length > 0) score += idiomasComuns.length * 2;

  const grausEu    = (eu.formacoes    || []).map(f => f.grau).filter(Boolean);
  const grausOutro = (outro.formacoes || []).map(f => f.grau).filter(Boolean);
  if (interseccao(grausEu, grausOutro).length > 0) score += 5;

  return { score, razoes };
}

function calcularScoreVaga(perfil, vaga) {
  let score = 0;
  const razoes = [];

  if (perfil.area && vaga.area && perfil.area === vaga.area) {
    score += 50; razoes.push(`Área compatível: ${vaga.area}`);
  }
  if (perfil.provincia && vaga.provincia && perfil.provincia === vaga.provincia) {
    score += 25; razoes.push(`Localização próxima: ${vaga.provincia}`);
  }
  const compMatch = interseccao(perfil.competenciasTecnicas || [], vaga.competenciasExigidas || []);
  if (compMatch.length > 0) {
    score += compMatch.length * 8; razoes.push(`${compMatch.length} competência(s) exigida(s) que tens`);
  }
  const cargosExp = (perfil.experiencias || []).map(e => e.cargo?.toLowerCase()).filter(Boolean);
  if (vaga.cargo && cargosExp.some(c => c.includes(vaga.cargo.toLowerCase()) || vaga.cargo.toLowerCase().includes(c))) {
    score += 20; razoes.push('Cargo relacionado com a tua experiência');
  }
  if (perfil.pretensaoSalarial && vaga.salarioMax) {
    const pretensao = Number(perfil.pretensaoSalarial);
    const max       = Number(vaga.salarioMax);
    if (!isNaN(pretensao) && !isNaN(max) && pretensao <= max) {
      score += 10; razoes.push('Salário dentro da tua pretensão');
    }
  }
  if (perfil.disponibilidade && vaga.tipoContrato) {
    const disp = perfil.disponibilidade.toLowerCase();
    const tipo = vaga.tipoContrato.toLowerCase();
    if (disp.includes('tempo inteiro') && tipo.includes('inteiro')) score += 5;
    if (disp.includes('part') && tipo.includes('part'))             score += 5;
    if (disp.includes('freelance') && tipo.includes('freelance'))   score += 5;
  }

  return { score, razoes };
}

// FUNÇÃO 11 — calcularRecomendacoes
exports.calcularRecomendacoes = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado.');

  const uid    = request.auth.uid;
  const euSnap = await db.collection('users').doc(uid).get();
  if (!euSnap.exists) throw new HttpsError('not-found', 'Perfil não encontrado.');

  const eu = euSnap.data();

  const filtros = [];
  if (eu.area)      filtros.push(db.collection('users').where('area',      '==', eu.area).limit(100));
  if (eu.provincia) filtros.push(db.collection('users').where('provincia', '==', eu.provincia).limit(100));

  if (filtros.length === 0) return { pessoas: [] };

  const snapshots = await Promise.all(filtros.map(q => q.get()));
  const vistos    = new Set([uid]);
  const scores    = [];

  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      if (vistos.has(doc.id)) continue;
      vistos.add(doc.id);
      const outro = doc.data();
      const { score, razoes } = calcularScorePessoa(eu, outro);
      if (score > 0) {
        scores.push({
          uid:       doc.id,
          score,
          razoes,
          nome:      outro.nome      || 'Utilizador',
          fotoURL:   outro.fotoURL   || null,
          cargo:     outro.cargo     || outro.tituloProfissional || '',
          area:      outro.area      || '',
          empresa:   outro.empresa   || '',
          provincia: outro.provincia || '',
          verificado: outro.verificado || outro.isVerified || false,
        });
      }
    }
  }

  const top = scores.sort((a, b) => b.score - a.score).slice(0, 20);
  await db.collection('recomendacoes').doc(uid).set({ pessoas: top, timestamp: new Date() });
  return { pessoas: top };
});

// FUNÇÃO 12 — recomendarVagas
exports.recomendarVagas = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado.');

  const uid        = request.auth.uid;
  const perfilSnap = await db.collection('users').doc(uid).get();
  if (!perfilSnap.exists) throw new HttpsError('not-found', 'Perfil não encontrado.');

  const perfil = perfilSnap.data();
  const limite = new Date();
  limite.setDate(limite.getDate() - 90);

  const vagasSnap = await db.collection('vagas')
    .where('estado', '==', 'aberta')
    .where('timestamp', '>=', limite)
    .limit(200)
    .get();

  const scores = [];

  vagasSnap.forEach(doc => {
    const vaga = doc.data();
    const { score, razoes } = calcularScoreVaga(perfil, vaga);
    if (score > 0) {
      scores.push({
        id:           doc.id,
        score,
        razoes,
        titulo:       vaga.titulo       || vaga.cargo || 'Vaga',
        empresa:      vaga.empresa      || '',
        area:         vaga.area         || '',
        provincia:    vaga.provincia    || '',
        municipio:    vaga.municipio    || '',
        tipoContrato: vaga.tipoContrato || '',
        salarioMin:   vaga.salarioMin   || null,
        salarioMax:   vaga.salarioMax   || null,
        logoEmpresa:  vaga.logoEmpresa  || null,
        timestamp:    vaga.timestamp    || null,
        descricao:    vaga.descricao    || '',
      });
    }
  });

  const top = scores.sort((a, b) => b.score - a.score).slice(0, 20);
  await db.collection('vagasRecomendadas').doc(uid).set({ vagas: top, timestamp: new Date() });
  return { vagas: top };
});

// FUNÇÃO 13 — recalcularAoActualizarPerfil (trigger automático)
exports.recalcularAoActualizarPerfil = onDocumentUpdated(
  { document: 'users/{uid}', region: 'europe-west1' },
  async (event) => {
    const uid    = event.params.uid;
    const antes  = event.data.before.data();
    const depois = event.data.after.data();

    const camposRelevantes = ['area', 'provincia', 'municipio', 'empresa', 'competenciasTecnicas', 'interesses', 'disponibilidade'];
    const mudou = camposRelevantes.some(c => JSON.stringify(antes[c]) !== JSON.stringify(depois[c]));
    if (!mudou) return null;

    const eu      = depois;
    const filtros = [];
    if (eu.area)      filtros.push(db.collection('users').where('area',      '==', eu.area).limit(100));
    if (eu.provincia) filtros.push(db.collection('users').where('provincia', '==', eu.provincia).limit(100));
    if (filtros.length === 0) return null;

    const snapshots = await Promise.all(filtros.map(q => q.get()));
    const vistos    = new Set([uid]);
    const scores    = [];

    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        if (vistos.has(doc.id)) continue;
        vistos.add(doc.id);
        const outro = doc.data();
        const { score, razoes } = calcularScorePessoa(eu, outro);
        if (score > 0) {
          scores.push({
            uid:       doc.id,
            score,
            razoes,
            nome:      outro.nome      || 'Utilizador',
            fotoURL:   outro.fotoURL   || null,
            cargo:     outro.cargo     || outro.tituloProfissional || '',
            area:      outro.area      || '',
            empresa:   outro.empresa   || '',
            provincia: outro.provincia || '',
            verificado: outro.verificado || outro.isVerified || false,
          });
        }
      }
    }

    const top = scores.sort((a, b) => b.score - a.score).slice(0, 20);
    await db.collection('recomendacoes').doc(uid).set({ pessoas: top, timestamp: new Date() });
    console.log(`[recomendacoes] ${uid} → ${top.length} recomendações actualizadas`);
    return null;
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// OTP — Telefone (Africa's Talking) e Email (Gmail/Nodemailer)
// ══════════════════════════════════════════════════════════════════════════════
const otpTelefone = require('./otpTelefone');
exports.enviarCodigoTelefone = otpTelefone.enviarCodigoTelefone;
exports.confirmarCodigoTelefone = otpTelefone.confirmarCodigoTelefone;

const otpEmail = require('./otpEmail');
exports.enviarCodigoEmail = otpEmail.enviarCodigoEmail;
exports.confirmarCodigoEmail = otpEmail.confirmarCodigoEmail;
exports.verificarEmailConfirmado = otpEmail.verificarEmailConfirmado;

// ══════════════════════════════════════════════════════════════════════════════
// LIVE — contagem real de ouvintes
// ══════════════════════════════════════════════════════════════════════════════

// FUNÇÃO 14 — onViewerJoin
// Mantém lives/{liveId}.ouvintesCount sincronizado com o número real de
// documentos em lives/{liveId}/viewers, criados quando alguém entra a
// assistir (ver services/livesService.js → entrarComoOuvinte).
exports.onViewerJoin = onDocumentCreated(
  { document: 'lives/{liveId}/viewers/{uid}', region: 'europe-west1' },
  async (event) => {
    await db.doc(`lives/${event.params.liveId}`).update({
      ouvintesCount: admin.firestore.FieldValue.increment(1),
    });
  }
);

// FUNÇÃO 15 — onViewerLeave
exports.onViewerLeave = onDocumentDeleted(
  { document: 'lives/{liveId}/viewers/{uid}', region: 'europe-west1' },
  async (event) => {
    await db.doc(`lives/${event.params.liveId}`).update({
      ouvintesCount: admin.firestore.FieldValue.increment(-1),
    });
  }
);