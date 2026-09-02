const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const db = admin.firestore();

exports.updateAdminProfile = onCall({ enforceAppCheck: false }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão administrativa necessária.');
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists || snap.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Apenas administradores podem alterar o perfil administrativo.');
  const nome = String(request.data?.nome || '').trim();
  if (!nome) throw new HttpsError('invalid-argument', 'Nome obrigatório.');
  await db.collection('users').doc(uid).set({ nome, name: nome, displayName: nome, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await db.collection('admin_audit_logs').add({ adminUid: uid, action: 'updateAdminProfile', target: { uid }, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});
