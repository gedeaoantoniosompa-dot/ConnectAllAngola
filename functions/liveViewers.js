// functions/liveViewers.js
//
// Mantém o campo ouvintesCount do documento da live sincronizado com o
// número real de documentos em lives/{liveId}/viewers.
//
// Regista estas duas funções no teu index.js:
//   exports.onViewerJoin = require('./liveViewers').onViewerJoin;
//   exports.onViewerLeave = require('./liveViewers').onViewerLeave;

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

exports.onViewerJoin = onDocumentCreated(
  { region: 'europe-west1', document: 'lives/{liveId}/viewers/{uid}' },
  async (event) => {
    const db = getFirestore();
    await db.doc(`lives/${event.params.liveId}`).update({
      ouvintesCount: FieldValue.increment(1),
    });
  }
);

exports.onViewerLeave = onDocumentDeleted(
  { region: 'europe-west1', document: 'lives/{liveId}/viewers/{uid}' },
  async (event) => {
    const db = getFirestore();
    await db.doc(`lives/${event.params.liveId}`).update({
      ouvintesCount: FieldValue.increment(-1),
    });
  }
);