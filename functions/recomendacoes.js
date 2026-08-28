/**
 * functions/recomendacoes.js — ConnectAll Angola
 * 
 * Cloud Functions de recomendação de pessoas e vagas.
 * Adiciona ao teu functions/index.js:
 *   const { calcularRecomendacoes, recomendarVagas, recalcularAoActualizarPerfil } = require('./recomendacoes');
 *   exports.calcularRecomendacoes         = calcularRecomendacoes;
 *   exports.recomendarVagas               = recomendarVagas;
 *   exports.recalcularAoActualizarPerfil  = recalcularAoActualizarPerfil;
 */

const { onCall, HttpsError }   = require('firebase-functions/v2/https');
const { onDocumentUpdated }    = require('firebase-functions/v2/firestore');
const { getFirestore }         = require('firebase-admin/firestore');

const REGION  = 'europe-west1';
const db      = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

function interseccao(a = [], b = []) {
  const setB = new Set(b.map(x => (typeof x === 'string' ? x : x?.nome || x?.idioma || JSON.stringify(x)).toLowerCase()));
  return a.filter(x => {
    const v = (typeof x === 'string' ? x : x?.nome || x?.idioma || JSON.stringify(x)).toLowerCase();
    return setB.has(v);
  });
}

// Calcula pontuação de compatibilidade entre dois perfis
function calcularScore(eu, outro) {
  let score = 0;
  const razoes = [];

  // Área profissional (mais relevante)
  if (eu.area && outro.area && eu.area === outro.area) {
    score += 40;
    razoes.push(`Mesma área: ${eu.area}`);
  }

  // Localização
  if (eu.provincia && outro.provincia && eu.provincia === outro.provincia) {
    score += 20;
    razoes.push(`Mesma província: ${eu.provincia}`);
    if (eu.municipio && outro.municipio && eu.municipio === outro.municipio) {
      score += 10;
      razoes.push(`Mesmo município: ${eu.municipio}`);
    }
  }

  // Empresa
  if (eu.empresa && outro.empresa && eu.empresa === outro.empresa && eu.empresa !== 'Desempregado') {
    score += 30;
    razoes.push(`Mesma empresa: ${eu.empresa}`);
  }

  // Competências técnicas em comum
  const compComuns = interseccao(eu.competenciasTecnicas || [], outro.competenciasTecnicas || []);
  if (compComuns.length > 0) {
    score += compComuns.length * 6;
    razoes.push(`${compComuns.length} competência(s) em comum`);
  }

  // Interesses em comum
  const intComuns = interseccao(eu.interesses || [], outro.interesses || []);
  if (intComuns.length > 0) {
    score += intComuns.length * 4;
    razoes.push(`${intComuns.length} interesse(s) em comum`);
  }

  // Idiomas em comum
  const idiomasComuns = interseccao(eu.idiomas || [], outro.idiomas || []);
  if (idiomasComuns.length > 0) {
    score += idiomasComuns.length * 2;
  }

  // Nível de formação semelhante
  const grausEu    = (eu.formacoes    || []).map(f => f.grau).filter(Boolean);
  const grausOutro = (outro.formacoes || []).map(f => f.grau).filter(Boolean);
  if (interseccao(grausEu, grausOutro).length > 0) score += 5;

  return { score, razoes };
}

// Calcula score de vaga para um utilizador
function calcularScoreVaga(perfil, vaga) {
  let score = 0;
  const razoes = [];

  if (perfil.area && vaga.area && perfil.area === vaga.area) {
    score += 50;
    razoes.push(`Área compatível: ${vaga.area}`);
  }

  if (perfil.provincia && vaga.provincia && perfil.provincia === vaga.provincia) {
    score += 25;
    razoes.push(`Localização próxima: ${vaga.provincia}`);
  }

  // Competências exigidas vs perfil
  const compMatch = interseccao(perfil.competenciasTecnicas || [], vaga.competenciasExigidas || []);
  if (compMatch.length > 0) {
    score += compMatch.length * 8;
    razoes.push(`${compMatch.length} competência(s) exigida(s) que tens`);
  }

  // Cargo semelhante à experiência
  const cargosExperiencia = (perfil.experiencias || []).map(e => e.cargo?.toLowerCase()).filter(Boolean);
  if (vaga.cargo && cargosExperiencia.some(c => c.includes(vaga.cargo.toLowerCase()) || vaga.cargo.toLowerCase().includes(c))) {
    score += 20;
    razoes.push('Cargo relacionado com a tua experiência');
  }

  // Pretensão salarial vs salário da vaga
  if (perfil.pretensaoSalarial && vaga.salarioMax) {
    const pretensao = Number(perfil.pretensaoSalarial);
    const max       = Number(vaga.salarioMax);
    if (!isNaN(pretensao) && !isNaN(max) && pretensao <= max) {
      score += 10;
      razoes.push('Salário dentro da tua pretensão');
    }
  }

  // Disponibilidade compatível
  if (perfil.disponibilidade && vaga.tipoContrato) {
    const disp  = perfil.disponibilidade.toLowerCase();
    const tipo  = vaga.tipoContrato.toLowerCase();
    if (disp.includes('tempo inteiro') && tipo.includes('inteiro')) score += 5;
    if (disp.includes('part') && tipo.includes('part'))             score += 5;
    if (disp.includes('freelance') && tipo.includes('freelance'))   score += 5;
  }

  return { score, razoes };
}

// ─────────────────────────────────────────────────────────────────────────────
// calcularRecomendacoes — chamada pelo app
// ─────────────────────────────────────────────────────────────────────────────
exports.calcularRecomendacoes = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado.');

  const uid     = request.auth.uid;
  const euSnap  = await db.collection('users').doc(uid).get();
  if (!euSnap.exists) throw new HttpsError('not-found', 'Perfil não encontrado.');

  const eu = euSnap.data();

  // Busca utilizadores com mesma área ou província (evita varrer toda a colecção)
  const filtros = [];
  if (eu.area)      filtros.push(db.collection('users').where('area',      '==', eu.area).limit(100));
  if (eu.provincia) filtros.push(db.collection('users').where('provincia', '==', eu.provincia).limit(100));

  const snapshots = await Promise.all(filtros.map(q => q.get()));
  const vistos    = new Set([uid]);
  const scores    = [];

  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      if (vistos.has(doc.id)) continue;
      vistos.add(doc.id);

      const outro = doc.data();
      const { score, razoes } = calcularScore(eu, outro);
      if (score > 0) {
        scores.push({
          uid:    doc.id,
          score,
          razoes,
          nome:   outro.nome   || 'Utilizador',
          fotoURL: outro.fotoURL || null,
          cargo:  outro.cargo  || outro.tituloProfissional || '',
          area:   outro.area   || '',
          empresa: outro.empresa || '',
          provincia: outro.provincia || '',
          verificado: outro.verificado || outro.isVerified || false,
        });
      }
    }
  }

  // Top 20 ordenados por score
  const top = scores.sort((a, b) => b.score - a.score).slice(0, 20);

  await db.collection('recomendacoes').doc(uid).set({
    pessoas:   top,
    timestamp: new Date(),
  });

  return { pessoas: top };
});

// ─────────────────────────────────────────────────────────────────────────────
// recomendarVagas — chamada pelo app
// ─────────────────────────────────────────────────────────────────────────────
exports.recomendarVagas = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado.');

  const uid      = request.auth.uid;
  const perfilSnap = await db.collection('users').doc(uid).get();
  if (!perfilSnap.exists) throw new HttpsError('not-found', 'Perfil não encontrado.');

  const perfil = perfilSnap.data();

  // Vagas abertas (últimas 90 dias)
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
        id:     doc.id,
        score,
        razoes,
        titulo: vaga.titulo || vaga.cargo || 'Vaga',
        empresa: vaga.empresa || '',
        area:    vaga.area || '',
        provincia: vaga.provincia || '',
        municipio: vaga.municipio || '',
        tipoContrato: vaga.tipoContrato || '',
        salarioMin: vaga.salarioMin || null,
        salarioMax: vaga.salarioMax || null,
        logoEmpresa: vaga.logoEmpresa || null,
        timestamp: vaga.timestamp || null,
        descricao: vaga.descricao || '',
      });
    }
  });

  const top = scores.sort((a, b) => b.score - a.score).slice(0, 20);

  await db.collection('vagasRecomendadas').doc(uid).set({
    vagas:     top,
    timestamp: new Date(),
  });

  return { vagas: top };
});

// ─────────────────────────────────────────────────────────────────────────────
// recalcularAoActualizarPerfil — trigger automático
// ─────────────────────────────────────────────────────────────────────────────
exports.recalcularAoActualizarPerfil = onDocumentUpdated(
  { document: 'users/{uid}', region: REGION },
  async (event) => {
    const uid    = event.params.uid;
    const antes  = event.data.before.data();
    const depois = event.data.after.data();

    // Só recalcula se campos relevantes mudaram
    const camposRelevantes = ['area', 'provincia', 'municipio', 'empresa', 'competenciasTecnicas', 'interesses', 'disponibilidade'];
    const mudou = camposRelevantes.some(c => JSON.stringify(antes[c]) !== JSON.stringify(depois[c]));
    if (!mudou) return null;

    // Chama as funções de cálculo directamente (sem HTTP)
    const eu = depois;

    const filtros = [];
    if (eu.area)      filtros.push(db.collection('users').where('area',      '==', eu.area).limit(100));
    if (eu.provincia) filtros.push(db.collection('users').where('provincia', '==', eu.provincia).limit(100));

    const snapshots = await Promise.all(filtros.map(q => q.get()));
    const vistos    = new Set([uid]);
    const scores    = [];

    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        if (vistos.has(doc.id)) continue;
        vistos.add(doc.id);
        const outro = doc.data();
        const { score, razoes } = calcularScore(eu, outro);
        if (score > 0) {
          scores.push({
            uid: doc.id, score, razoes,
            nome: outro.nome || 'Utilizador',
            fotoURL: outro.fotoURL || null,
            cargo: outro.cargo || outro.tituloProfissional || '',
            area: outro.area || '',
            empresa: outro.empresa || '',
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