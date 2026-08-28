/**
 * functions/otpEmail.js — ConnectAll Angola
 *
 * Verificação de email por código OTP via Gmail/Nodemailer,
 * SEM exigir conta Firebase criada antecipadamente.
 *
 * Fluxo:
 *   1. enviarCodigoEmail({ email }) → gera código, guarda em Firestore, envia por Gmail
 *   2. confirmarCodigoEmail({ email, codigo }) → valida o código (NÃO cria conta)
 *
 * A criação da conta Firebase (createUserWithEmailAndPassword) só acontece
 * no FIM do formulário de perfil, depois do email já estar verificado.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ── Segredos (configurar com: firebase functions:secrets:set GMAIL_USER) ──
const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

const TEMPO_EXPIRACAO_MIN = 10;
const MAX_TENTATIVAS = 5;
const INTERVALO_REENVIO_SEG = 30;

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function criarTransportador(user, pass) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

function templateEmail(codigo) {
  return {
    subject: `${codigo} é o teu código ConnectAll Angola`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #111827; margin-bottom: 8px;">ConnectAll Angola</h2>
        <p style="color: #374151; font-size: 15px; line-height: 22px;">
          Usa o código abaixo para confirmar o teu endereço de email:
        </p>
        <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1677F2;">${codigo}</span>
        </div>
        <p style="color: #6B7280; font-size: 13px; line-height: 19px;">
          Este código é válido durante ${TEMPO_EXPIRACAO_MIN} minutos. Não partilhes este código com ninguém.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
          Se não pediste este código, podes ignorar este email com segurança.
        </p>
      </div>
    `,
  };
}

/**
 * Callable: enviarCodigoEmail
 * Não exige autenticação — usado ANTES da conta Firebase existir.
 */
exports.enviarCodigoEmail = onCall(
  { region: 'europe-west1', secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] },
  async (request) => {
    const emailInput = (request.data?.email || '').trim().toLowerCase();

    if (!emailInput || !validarEmail(emailInput)) {
      throw new HttpsError('invalid-argument', 'Email inválido.');
    }

    const docRef = db.collection('verificacoesEmail').doc(emailInput);
    const docExistente = await docRef.get();

    if (docExistente.exists) {
      const dados = docExistente.data();
      const criadoEm = dados.criadoEm?.toDate ? dados.criadoEm.toDate() : null;
      if (criadoEm && (Date.now() - criadoEm.getTime()) < INTERVALO_REENVIO_SEG * 1000) {
        throw new HttpsError(
          'resource-exhausted',
          `Aguarda ${INTERVALO_REENVIO_SEG} segundos antes de pedir um novo código.`
        );
      }
    }

    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + TEMPO_EXPIRACAO_MIN * 60 * 1000);

    await docRef.set({
      email: emailInput,
      codigo,
      expiraEm: admin.firestore.Timestamp.fromDate(expiraEm),
      tentativas: 0,
      verificado: false,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      const transportador = criarTransportador(GMAIL_USER.value(), GMAIL_APP_PASSWORD.value());
      const { subject, html } = templateEmail(codigo);

      await transportador.sendMail({
        from: `"ConnectAll Angola" <${GMAIL_USER.value()}>`,
        to: emailInput,
        subject,
        html,
      });
    } catch (err) {
      console.error('[enviarCodigoEmail] Erro ao enviar:', err);
      throw new HttpsError('internal', 'Não foi possível enviar o email. Tenta novamente.');
    }

    return { sucesso: true };
  }
);

/**
 * Callable: confirmarCodigoEmail
 * Apenas VALIDA o código — não cria conta Firebase nenhuma.
 * O cliente, ao receber sucesso:true, pode prosseguir para o ecrã seguinte.
 */
exports.confirmarCodigoEmail = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const emailInput = (request.data?.email || '').trim().toLowerCase();
    const codigoInput = (request.data?.codigo || '').trim();

    if (!emailInput || !codigoInput) {
      throw new HttpsError('invalid-argument', 'Email e código são obrigatórios.');
    }

    const docRef = db.collection('verificacoesEmail').doc(emailInput);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Nenhum código pedido para este email. Pede um novo código.');
    }

    const dados = docSnap.data();

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
        `Código incorreto. Restam ${Math.max(0, restantes)} tentativa(s).`
      );
    }

    // Marca como verificado — mas NÃO cria conta Firebase
    await docRef.update({ verificado: true, verificadoEm: admin.firestore.FieldValue.serverTimestamp() });

    return { sucesso: true };
  }
);

/**
 * Callable: verificarEmailConfirmado
 * Usado pelo formulário de perfil, no momento de criar a conta definitiva,
 * para confirmar que o email passou pela verificação OTP antes de chamar
 * createUserWithEmailAndPassword no cliente.
 */
exports.verificarEmailConfirmado = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const emailInput = (request.data?.email || '').trim().toLowerCase();
    if (!emailInput) {
      throw new HttpsError('invalid-argument', 'Email é obrigatório.');
    }

    const docSnap = await db.collection('verificacoesEmail').doc(emailInput).get();
    if (!docSnap.exists || docSnap.data()?.verificado !== true) {
      throw new HttpsError('failed-precondition', 'Este email ainda não foi verificado.');
    }

    return { verificado: true };
  }
);