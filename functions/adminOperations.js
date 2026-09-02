/**
 * Admin Operations Gateway — ConnectAll Angola
 *
 * Todas as operações administrativas mutáveis passam por aqui.
 * O cliente nunca recebe privilégios Firebase Admin SDK.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const ALLOWED = new Set([
  'verifyUser', 'setUserStatus', 'deleteUser',
  'deletePost', 'updatePostModeration', 'deleteStory',
  'resolveReport', 'ignoreReport', 'deleteReportedContent',
  'setPaymentStatus', 'resolveSupport',
  'setProfessionalVerification', 'setProfessionalMonetization', 'disableProfessional',
  'savePlatformConfig', 'saveLimitsConfig', 'saveSecurityConfig', 'setMaintenance',
  'savePlan', 'setPlanActive',
  'sendNotification', 'deleteChat', 'endCall', 'closeRoom',
  'writeSoundConfig', 'writeBannerConfig',
]);

function assertAdmin(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'É necessário iniciar sessão.');
  }
  return request.auth.uid;
}

async function isAdmin(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists && snap.data()?.role === 'admin' && snap.data()?.status !== 'banido';
}

function cleanObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'password' || k === 'senha' || k === 'fcmToken' || k === 'token' || k === 'accessToken' || k === 'secret') continue;
    out[k] = v;
  }
  return out;
}

async function audit(adminUid, action, target = {}, extra = {}) {
  await db.collection('admin_audit_logs').add({
    adminUid,
    action,
    target: cleanObject(target),
    extra: cleanObject(extra),
    createdAt: FV.serverTimestamp(),
  });
}

async function notifyUser(uid, titulo, mensagem, tipo = 'info', adminUid) {
  if (!uid) return;
  await db.collection('notificacoes').doc(uid).collection('items').add({
    titulo, mensagem, tipo, lida: false,
    enviadoEm: FV.serverTimestamp(),
    enviadoPor: adminUid,
    isAdmin: true,
  });
}

exports.adminOperation = onCall({ enforceAppCheck: true }, async (request) => {
  const adminUid = assertAdmin(request);
  if (!(await isAdmin(adminUid))) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem executar esta operação.');
  }

  const { action, payload = {} } = request.data || {};
  if (!ALLOWED.has(action)) {
    throw new HttpsError('permission-denied', 'Operação administrativa não permitida.');
  }

  try {
    switch (action) {
      case 'verifyUser': {
        const { uid } = payload;
        if (!uid) throw new HttpsError('invalid-argument', 'UID obrigatório.');
        await db.collection('users').doc(uid).set({
          verificado: true, isVerified: true, contaVerificada: true,
          verificadoEm: FV.serverTimestamp(), verificadoPor: adminUid,
          verificacaoEstado: 'aprovado', status: 'activo', accountStatus: 'activo',
          contaEstado: { estado: 'ativa' },
        }, { merge: true });
        await audit(adminUid, action, { uid });
        return { ok: true };
      }

      case 'setUserStatus': {
        const { uid, status, motivo, dias, bloquearLogin = false, notificar = true } = payload;
        if (!uid || !['activo', 'suspenso', 'banido'].includes(status)) {
          throw new HttpsError('invalid-argument', 'UID ou status inválido.');
        }
        const banned = status === 'banido';
        const suspended = status === 'suspenso';
        const data = {
          status,
          accountStatus: banned ? 'banned' : suspended ? 'suspended' : 'active',
          userStatus: banned ? 'banned' : suspended ? 'suspended' : 'active',
          suspended, banned,
          blocked: banned || bloquearLogin,
          statusMotivo: motivo || null,
          suspensionReason: suspended ? (motivo || null) : null,
          banReason: banned ? (motivo || null) : null,
          statusActualizadoEm: FV.serverTimestamp(),
          statusActualizadoPor: adminUid,
          contaEstado: { estado: banned ? 'banida' : suspended ? 'suspensa' : 'ativa', motivo: motivo || null },
        };
        if (suspended && Number(dias) > 0) {
          const exp = new Date(); exp.setDate(exp.getDate() + Number(dias)); data.suspensaoExpira = exp;
        } else if (!suspended) data.suspensaoExpira = null;
        await db.collection('users').doc(uid).set(data, { merge: true });
        if (notificar) await notifyUser(uid, banned ? 'Conta banida' : suspended ? 'Conta suspensa' : 'Conta reactivada', motivo || 'O estado da tua conta foi actualizado pelo administrador.', banned || suspended ? 'alerta' : 'sucesso', adminUid);
        await audit(adminUid, action, { uid }, { status, dias: Number(dias) || 0 });
        return { ok: true };
      }

      case 'deleteUser': {
        const { uid } = payload;
        if (!uid || uid === adminUid) throw new HttpsError('failed-precondition', 'Não é permitido eliminar a própria conta administrativa.');
        await db.collection('users').doc(uid).delete();
        try { await admin.auth().deleteUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
        await audit(adminUid, action, { uid });
        return { ok: true };
      }

      case 'deletePost': {
        const { id } = payload; if (!id) throw new HttpsError('invalid-argument', 'ID obrigatório.');
        await db.collection('posts').doc(id).delete();
        await audit(adminUid, action, { postId: id }); return { ok: true };
      }

      case 'updatePostModeration': {
        const { id, oculto, destacado } = payload; if (!id) throw new HttpsError('invalid-argument', 'ID obrigatório.');
        const data = {};
        if (oculto !== undefined) Object.assign(data, { oculto: !!oculto, hidden: !!oculto, visible: !oculto });
        if (destacado !== undefined) Object.assign(data, { destacado: !!destacado, featured: !!destacado });
        await db.collection('posts').doc(id).set({ ...data, moderadoEm: FV.serverTimestamp(), moderadoPor: adminUid }, { merge: true });
        await audit(adminUid, action, { postId: id }, data); return { ok: true };
      }

      case 'deleteStory': {
        const { id } = payload; if (!id) throw new HttpsError('invalid-argument', 'ID obrigatório.');
        await db.collection('stories').doc(id).delete(); await audit(adminUid, action, { storyId: id }); return { ok: true };
      }

      case 'resolveReport':
      case 'ignoreReport': {
        const { id, collection = 'denuncias' } = payload;
        if (!id || !['denuncias', 'reports'].includes(collection)) throw new HttpsError('invalid-argument', 'Denúncia inválida.');
        await db.collection(collection).doc(id).set({
          status: action === 'resolveReport' ? 'resolvido' : 'ignorado',
          resolvidoEm: FV.serverTimestamp(), resolvidoPor: adminUid,
        }, { merge: true });
        await audit(adminUid, action, { collection, id }); return { ok: true };
      }

      case 'deleteReportedContent': {
        const { reportId, reportCollection = 'reports', postId } = payload;
        if (!reportId || !postId) throw new HttpsError('invalid-argument', 'IDs obrigatórios.');
        await db.collection('posts').doc(postId).delete();
        if (['reports', 'denuncias'].includes(reportCollection)) await db.collection(reportCollection).doc(reportId).set({ status: 'resolvido', conteudoEliminado: true, resolvidoEm: FV.serverTimestamp(), resolvidoPor: adminUid }, { merge: true });
        await audit(adminUid, action, { reportId, postId }); return { ok: true };
      }

      case 'setPaymentStatus': {
        const { id, status } = payload;
        if (!id || !['confirmado', 'recusado', 'pendente'].includes(status)) throw new HttpsError('invalid-argument', 'Pagamento inválido.');
        const ref = db.collection('payments').doc(id); const snap = await ref.get();
        if (!snap.exists) throw new HttpsError('not-found', 'Pagamento não encontrado.');
        const p = snap.data();
        await ref.set({ status, ...(status === 'confirmado' ? { confirmadoEm: FV.serverTimestamp(), confirmadoPor: adminUid } : { recusadoEm: FV.serverTimestamp(), recusadoPor: adminUid }) }, { merge: true });
        const uid = p.utilizadorId || p.userId;
        if (status === 'confirmado' && uid) {
          const plano = p.plano || p.plan || 'pro';
          await db.collection('users').doc(uid).set({ plano, plan: plano, subscriptionPlan: plano, subscriptionStatus: 'active', subscriptionStartDate: FV.serverTimestamp() }, { merge: true });
        }
        await audit(adminUid, action, { paymentId: id, uid }, { status }); return { ok: true };
      }

      case 'resolveSupport': {
        const { id, collection = 'suporte' } = payload;
        if (!id) throw new HttpsError('invalid-argument', 'Ticket obrigatório.');
        await db.collection(collection).doc(id).set({ status: 'resolvido', resolvidoEm: FV.serverTimestamp(), resolvidoPor: adminUid }, { merge: true });
        await audit(adminUid, action, { collection, id }); return { ok: true };
      }

      case 'setProfessionalVerification':
      case 'setProfessionalMonetization':
      case 'disableProfessional': {
        const { uid } = payload; if (!uid) throw new HttpsError('invalid-argument', 'UID obrigatório.');
        const data = action === 'setProfessionalVerification'
          ? { verificado: true, verificadoEm: FV.serverTimestamp(), verificadoPor: adminUid }
          : action === 'setProfessionalMonetization'
            ? { monetizado: true, monetizadoEm: FV.serverTimestamp(), monetizadoPor: adminUid }
            : { ativo: false, desativadoEm: FV.serverTimestamp(), desativadoPor: adminUid };
        await db.collection('users').doc(uid).collection('perfis').doc('profissional').set(data, { merge: true });
        if (action === 'setProfessionalVerification') await db.collection('users').doc(uid).set({ contaVerificada: true }, { merge: true });
        if (action === 'disableProfessional') await db.collection('users').doc(uid).set({ modoProfissional: false }, { merge: true });
        await audit(adminUid, action, { uid }); return { ok: true };
      }

      case 'savePlatformConfig':
      case 'saveLimitsConfig':
      case 'saveSecurityConfig': {
        const { data } = payload; if (!data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Configuração inválida.');
        const docId = action === 'savePlatformConfig' ? 'plataforma' : action === 'saveLimitsConfig' ? 'limites' : 'seguranca';
        await db.collection('configuracoes').doc(docId).set({ ...cleanObject(data), atualizadoEm: FV.serverTimestamp(), updatedBy: adminUid }, { merge: true });
        await audit(adminUid, action, { docId }); return { ok: true };
      }

      case 'setMaintenance': {
        const { ativo } = payload;
        await db.collection('configuracoes').doc('plataforma').set({ manutencao: !!ativo, maintenanceMode: !!ativo, atualizadoEm: FV.serverTimestamp(), updatedBy: adminUid }, { merge: true });
        await audit(adminUid, action, {}, { ativo: !!ativo }); return { ok: true };
      }

      case 'savePlan': {
        const { id, data } = payload; if (!id || !data) throw new HttpsError('invalid-argument', 'Plano inválido.');
        await db.collection('planos').doc(id).set({ ...cleanObject(data), atualizadoEm: FV.serverTimestamp(), atualizadoPor: adminUid }, { merge: true });
        await audit(adminUid, action, { planId: id }); return { ok: true };
      }

      case 'setPlanActive': {
        const { id, ativo } = payload; if (!id) throw new HttpsError('invalid-argument', 'Plano inválido.');
        await db.collection('planos').doc(id).set({ ativo: !!ativo, atualizadoEm: FV.serverTimestamp(), atualizadoPor: adminUid }, { merge: true });
        await audit(adminUid, action, { planId: id }, { ativo: !!ativo }); return { ok: true };
      }

      case 'sendNotification': {
        const { uids, titulo, mensagem, tipo = 'info' } = payload;
        if (!Array.isArray(uids) || !uids.length || !titulo || !mensagem) throw new HttpsError('invalid-argument', 'Destinatários, título e mensagem são obrigatórios.');
        if (uids.length > 10000) throw new HttpsError('invalid-argument', 'Demasiados destinatários.');
        for (let i = 0; i < uids.length; i += 450) {
          const batch = db.batch();
          uids.slice(i, i + 450).forEach(uid => batch.set(db.collection('notificacoes').doc(uid).collection('items').doc(), { titulo, mensagem, tipo, lida: false, enviadoEm: FV.serverTimestamp(), enviadoPor: adminUid, isAdmin: true }));
          await batch.commit();
        }
        await audit(adminUid, action, { recipients: uids.length }, { tipo }); return { ok: true, count: uids.length };
      }

      case 'deleteChat': {
        const { id } = payload; if (!id) throw new HttpsError('invalid-argument', 'Chat obrigatório.');
        await db.recursiveDelete(db.collection('chats').doc(id)); await audit(adminUid, action, { chatId: id }); return { ok: true };
      }

      case 'endCall': {
        const { id } = payload; if (!id) throw new HttpsError('invalid-argument', 'Chamada obrigatória.');
        await db.collection('chamadas').doc(id).set({ estado: 'terminada', terminadaPorAdmin: adminUid, terminadaEm: FV.serverTimestamp() }, { merge: true }); await audit(adminUid, action, { callId: id }); return { ok: true };
      }

      case 'closeRoom': {
        const { id } = payload; if (!id) throw new HttpsError('invalid-argument', 'Sala obrigatória.');
        await db.collection('salas').doc(id).set({ ativa: false, fechadaPorAdmin: adminUid, fechadaEm: FV.serverTimestamp() }, { merge: true }); await audit(adminUid, action, { roomId: id }); return { ok: true };
      }

      case 'writeSoundConfig':
      case 'writeBannerConfig': {
        const { data } = payload; if (!data) throw new HttpsError('invalid-argument', 'Dados obrigatórios.');
        await db.collection('configuracoes').doc('sons').set({ ...cleanObject(data), atualizadoEm: FV.serverTimestamp(), atualizadoPor: adminUid }, { merge: true });
        await audit(adminUid, action); return { ok: true };
      }

      default:
        throw new HttpsError('permission-denied', 'Operação não implementada.');
    }
  } catch (err) {
    console.error('[adminOperation]', action, err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Não foi possível concluir a operação administrativa.');
  }
});
