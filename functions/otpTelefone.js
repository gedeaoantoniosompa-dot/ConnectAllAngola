/**
 * functions/otpTelefone.js — ConnectAll Angola
 *
 * Verificação de telefone por código OTP via SMS (Africa's Talking),
 * SEM usar Firebase PhoneAuthProvider nem expo-firebase-recaptcha.
 *
 * Versão atualizada para Cloud Functions V2.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Garante que o admin SDK já está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ── Configuração Africa's Talking ──────────────────────────────────────
const AT_USERNAME = 'Gedeao Antonio'; 
const AT_API_KEY  = 'atsk_1c4546292f7ee41eb49902fbeedb216579bb1e9acc186fdb959620284617fb184ff277d3';
const SENDER_ID = null;

const TEMPO_EXPIRACAO_MIN = 5;
const MAX_TENTATIVAS = 5;

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizarTelefoneAngola(numero) {
  const limpo = String(numero).replace(/\s|-/g, '');
  if (limpo.startsWith('+244')) return limpo;
  if (limpo.startsWith('244')) return `+${limpo}`;
  if (limpo.startsWith('0')) return `+244${limpo.slice(1)}`;
  return `+244${limpo}`;
}

async function enviarSmsAfricasTalking(telefone, mensagem) {
  if (!AT_USERNAME || !AT_API_KEY) {
    throw new HttpsError(
      'failed-precondition',
      'Serviço de SMS não configurado. As chaves de API estão em falta.'
    );
  }

  const usernameTratado = AT_USERNAME.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const params = new URLSearchParams();
  params.append('username', usernameTratado);
  params.append('to', telefone);
  params.append('message', mensagem);
  if (SENDER_ID) params.append('from', SENDER_ID);

  const resposta = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'apiKey': AT_API_KEY,
    },
    body: params.toString(),
  });

  const resultado = await resposta.json();

  const status = resultado?.SMSMessageData?.Recipients?.[0]?.status;
  if (status && status !== 'Success' && status !== 'UserInSandbox') {
    console.error('[Africas Talking] Falha no envio:', resultado);
    throw new HttpsError('internal', `Falha no envio do SMS: ${status}`);
  }

  return resultado;
}

/**
 * Callable: enviarCodigoTelefone
 */
exports.enviarCodigoTelefone = onCall({ region: 'europe-west1' }, async (request) => {
    // Na V2, os parâmetros enviados pelo app ficam dentro de request.data
    const data = request.data;
    const telefoneInput = (data?.telefone || '').trim();
    
    if (!telefoneInput || telefoneInput.length < 9) {
      throw new HttpsError('invalid-argument', 'Número de telefone inválido.');
    }

    const telefoneCompleto = normalizarTelefoneAngola(telefoneInput);
    const docRef = db.collection('verificacoesTelefone').doc(telefoneCompleto);

    const docExistente = await docRef.get();
    if (docExistente.exists) {
      const dados = docExistente.data();
      const criadoEm = dados.criadoEm?.toDate ? dados.criadoEm.toDate() : null;
      if (criadoEm && (Date.now() - criadoEm.getTime()) < 30 * 1000) {
        throw new HttpsError(
          'resource-exhausted',
          'Aguarda alguns segundos antes de pedir um novo código.'
        );
      }
    }

    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + TEMPO_EXPIRACAO_MIN * 60 * 1000);

    await docRef.set({
      telefone: telefoneCompleto,
      codigo,
      expiraEm: admin.firestore.Timestamp.fromDate(expiraEm),
      tentativas: 0,
      verificado: false,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const mensagem = `O teu código ConnectAll Angola é ${codigo}. Válido por ${TEMPO_EXPIRACAO_MIN} minutos. Não partilhes este código.`;

    await enviarSmsAfricasTalking(telefoneCompleto, mensagem);

    return { sucesso: true };
});

/**
 * Callable: confirmarCodigoTelefone
 */
exports.confirmarCodigoTelefone = onCall({ region: 'europe-west1' }, async (request) => {
    // Na V2, os parâmetros enviados pelo app ficam dentro de request.data
    const data = request.data;
    const telefoneInput = (data?.telefone || '').trim();
    const codigoInput   = (data?.codigo || '').trim();

    if (!telefoneInput || !codigoInput) {
      throw new HttpsError('invalid-argument', 'Telefone e código são obrigatórios.');
    }

    const telefoneCompleto = normalizarTelefoneAngola(telefoneInput);
    const docRef = db.collection('verificacoesTelefone').doc(telefoneCompleto);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Nenhum código pedido para este número. Pede um novo código.');
    }

    const dados = docSnap.data();

    if (dados.verificado) {
      throw new HttpsError('already-exists', 'Este código já foi utilizado. Pede um novo código.');
    }

    if (dados.tentativas >= MAX_TENTATIVAS) {
      throw new HttpsError('resource-exhausted', 'Demasiadas tentativas falhadas. Pede um novo código.');
    }

    const expiraEm = dados.expiraEm?.toDate ? dados.expiraEm.toDate() : new Date(0);
    if (Date.now() > expiraEm.getTime()) {
      throw new HttpsError('deadline-exceeded', 'O código expirou. Pede um novo código.');
    }

    if (dados.codigo !== codigoInput) {
      await docRef.update({ tentativas: admin.firestore.FieldValue.increment(1) });
      const restantes = MAX_TENTATIVAS - (dados.tentativas + 1);
      throw new HttpsError(
        'invalid-argument',
        `Código incorrecto. Restam ${Math.max(0, restantes)} tentativa(s).`
      );
    }

    await docRef.update({ verificado: true });

    let userRecord;
    let isNovoUtilizador = false;

    try {
      userRecord = await admin.auth().getUserByPhoneNumber(telefoneCompleto);
    } catch (erro) {
      if (erro.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({
          phoneNumber: telefoneCompleto,
        });
        isNovoUtilizador = true;
      } else {
        console.error('[confirmarCodigoTelefone] Erro ao obter/criar utilizador:', erro);
        throw new HttpsError('internal', 'Não foi possível processar a conta.');
      }
    }

    if (isNovoUtilizador) {
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        telefone: telefoneCompleto,
        tipoPerfil: 'utilizador',
        perfilActivo: 'utilizador',
        perfilCompleto: false,
        dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return {
      sucesso: true,
      customToken,
      isNovoUtilizador,
    };
});