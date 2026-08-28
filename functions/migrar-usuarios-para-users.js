/**
 * migrar-usuarios-para-users.js — ConnectAll Angola
 *
 * Migra todos os documentos da colecção 'usuarios' para 'users',
 * resolvendo o bug em que o registo por email gravava na colecção
 * errada e a app nunca encontrava o perfil (ficava sempre a pedir
 * para "escolher tipo de conta").
 *
 * LÓGICA:
 * Para cada documento em usuarios/{uid}:
 *   1. Se já existe users/{uid} → faz merge, sem sobrescrever campos
 *      que já tenham valor em 'users' (ex: nome, tipoPerfil, etc. que
 *      a pessoa já tenha preenchido correctamente nessa colecção).
 *   2. Se NÃO existe users/{uid} → copia o documento inteiro,
 *      renomeando 'perfilPreenchido' para 'perfilCompleto'.
 *
 * Depois da migração, os documentos em 'usuarios' NÃO são apagados
 * automaticamente (por segurança) — ficam lá como backup. Podes
 * apagá-los manualmente mais tarde quando confirmares que tudo
 * está bem.
 *
 * COMO USAR:
 * 1. Garante que tens o serviceAccountKey.json na pasta functions/
 *    (o mesmo que usaste no promover-admin.js)
 * 2. Corre dentro da pasta functions/: node migrar-usuarios-para-users.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(CAMINHO_CHAVE)) {
  console.error('❌ Ficheiro serviceAccountKey.json não encontrado em:', CAMINHO_CHAVE);
  console.error('   Usa o mesmo ficheiro que já geraste para o promover-admin.js');
  process.exit(1);
}

const serviceAccount = require(CAMINHO_CHAVE);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Mapeamento de nomes de campos antigos → novos
function normalizarCampos(dados) {
  const normalizado = { ...dados };

  if ('perfilPreenchido' in normalizado && !('perfilCompleto' in normalizado)) {
    normalizado.perfilCompleto = normalizado.perfilPreenchido;
    delete normalizado.perfilPreenchido;
  }

  // createdAt como Date nativo → mantemos como está, mas adicionamos
  // dataCriacao também, porque é o nome que o _layout.tsx e o painel
  // admin procuram primeiro (ver CAMPOS_DATA no painel admin).
  if ('createdAt' in normalizado && !('dataCriacao' in normalizado)) {
    normalizado.dataCriacao = normalizado.createdAt;
  }

  return normalizado;
}

async function migrar() {
  console.log('🔍 A procurar documentos em "usuarios"...\n');

  const snapUsuarios = await db.collection('usuarios').get();

  if (snapUsuarios.empty) {
    console.log('✅ Nenhum documento encontrado em "usuarios". Nada a migrar.');
    process.exit(0);
  }

  console.log(`📋 Encontrados ${snapUsuarios.size} documentos em "usuarios".\n`);

  let migrados = 0;
  let mesclados = 0;
  let erros = 0;

  for (const docUsuario of snapUsuarios.docs) {
    const uid = docUsuario.id;
    const dadosUsuario = normalizarCampos(docUsuario.data());

    try {
      const refUsers = db.collection('users').doc(uid);
      const snapUsers = await refUsers.get();

      if (snapUsers.exists) {
        // Já existe em 'users' — faz merge SEM sobrescrever campos existentes
        const dadosExistentes = snapUsers.data();
        const dadosParaEscrever = {};

        for (const [chave, valor] of Object.entries(dadosUsuario)) {
          // Só escreve o campo se não existir já em 'users', ou se o
          // valor existente for "vazio" (string vazia, null, undefined)
          const valorExistente = dadosExistentes[chave];
          const existenteVazio =
            valorExistente === undefined ||
            valorExistente === null ||
            valorExistente === '';

          if (existenteVazio) {
            dadosParaEscrever[chave] = valor;
          }
        }

        if (Object.keys(dadosParaEscrever).length > 0) {
          await refUsers.set(dadosParaEscrever, { merge: true });
          console.log(`🔀 Mesclado: ${uid} (${dadosUsuario.email || 'sem email'}) — ${Object.keys(dadosParaEscrever).length} campo(s) adicionado(s)`);
          mesclados++;
        } else {
          console.log(`⏭️  Ignorado: ${uid} (${dadosUsuario.email || 'sem email'}) — já tinha todos os campos preenchidos em 'users'`);
        }

      } else {
        // Não existe em 'users' — copia o documento inteiro
        await refUsers.set(dadosUsuario, { merge: true });
        console.log(`✅ Migrado: ${uid} (${dadosUsuario.email || 'sem email'})`);
        migrados++;
      }

    } catch (erro) {
      console.error(`❌ Erro ao migrar ${uid}:`, erro.message);
      erros++;
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log('🎉 Migração concluída!');
  console.log(`   Migrados (novos em 'users'):     ${migrados}`);
  console.log(`   Mesclados (já existiam):         ${mesclados}`);
  console.log(`   Erros:                           ${erros}`);
  console.log(`   Total processado:                ${snapUsuarios.size}`);
  console.log('─'.repeat(50));
  console.log('\n⚠️  Os documentos originais em "usuarios" NÃO foram apagados.');
  console.log('   Confirma que tudo está correcto no painel admin antes de os eliminares manualmente.');

  process.exit(0);
}

migrar().catch((erro) => {
  console.error('❌ Erro fatal na migração:', erro);
  process.exit(1);
});