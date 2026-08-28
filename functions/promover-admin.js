const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(CAMINHO_CHAVE)) {
  console.error('❌ Ficheiro serviceAccountKey.json não encontrado em:', CAMINHO_CHAVE);
  process.exit(1);
}

const serviceAccount = require(CAMINHO_CHAVE);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const ADMINS = [
  { email: 'suportemayangue@gmail.com' },
  { email: 'gedeaoantoniosompa@gmail.com', uid: 'xsbWTtfQ6xeLQDtpbNl6jJzxkHv1' },
];

async function promoverAdmin() {
  try {
    const db = admin.firestore();

    for (const conta of ADMINS) {
      try {
        let uid = conta.uid;
        const email = conta.email;

        if (!uid) {
          const userRecord = await admin.auth().getUserByEmail(email);
          uid = userRecord.uid;
        }

        console.log(`✅ A processar — ${email} | UID: ${uid}`);

        await db.collection('users').doc(uid).set(
          { role: 'admin', email, uid },
          { merge: true }
        );
        console.log(`   ✔ /users/${uid} actualizado`);

        await db.collection('usuarios').doc(uid).set(
          { role: 'admin', email, uid },
          { merge: true }
        );
        console.log(`   ✔ /usuarios/${uid} actualizado`);

        console.log(`   🎉 ${email} promovido a admin!\n`);

      } catch (erroInterno) {
        console.error(`   ❌ Erro ao processar ${conta.email}:`, erroInterno.message, '\n');
      }
    }

    console.log('✅ Processo concluído!');
    process.exit(0);

  } catch (erro) {
    console.error('❌ Erro geral:', erro.message);
    process.exit(1);
  }
}

promoverAdmin();