import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { C } from '../../constants/colors';
import { useUser } from '../../context/UserContext';
import { enviarNotificacao } from '../../services/notificationService';

// ── Opções fixas ─────────────────────────────────────────────────────────
const MODALIDADES = ['Presencial', 'Híbrido', 'Remoto'];
const TIPOS_CONTRATO = ['Tempo integral', 'Meio período', 'Estágio', 'Freelance', 'Temporário'];
const NIVEIS = ['Estágio', 'Júnior', 'Pleno', 'Sénior', 'Gestão/Direção'];
const MOEDAS = ['Kz', 'USD', 'EUR'];
const TIPOS_PERGUNTA = [
  { id: 'texto', label: 'Texto livre' },
  { id: 'numero', label: 'Número' },
  { id: 'sim_nao', label: 'Sim / Não' },
];

function novoId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function CriarVagaScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();

  const ehRecrutadorOuEmpresa = perfil?.tipoPerfil === 'recrutador' || perfil?.tipoPerfil === 'empresa';

  // 'basico' | 'detalhes' | 'triagem' | 'revisao'
  const [passo, setPasso] = useState('basico');
  const [publicando, setPublicando] = useState(false);

  // ── Passo 1: básico ──
  const [titulo, setTitulo] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState(perfil?.nomeEmpresa || perfil?.nome || '');
  const [local, setLocal] = useState(perfil?.cidade || '');
  const [modalidade, setModalidade] = useState('Presencial');
  const [tipoContrato, setTipoContrato] = useState('Tempo integral');
  const [nivelExperiencia, setNivelExperiencia] = useState('Pleno');
  const [numFuncionarios, setNumFuncionarios] = useState('11-50');

  // ── Passo 2: detalhes ──
  const [descricao, setDescricao] = useState('');
  const [responsabilidades, setResponsabilidades] = useState('');
  const [requisitos, setRequisitos] = useState('');
  const [beneficios, setBeneficios] = useState('');
  const [vagasDisponiveis, setVagasDisponiveis] = useState('1');
  const [dataLimite, setDataLimite] = useState('');
  const [mostrarSalario, setMostrarSalario] = useState(true);
  const [salarioMin, setSalarioMin] = useState('');
  const [salarioMax, setSalarioMax] = useState('');
  const [moeda, setMoeda] = useState('Kz');

  // ── Passo 3: triagem / candidatura ──
  const [candidaturaSimplificada, setCandidaturaSimplificada] = useState(false);
  const [emailRecrutador, setEmailRecrutador] = useState(perfil?.emailContacto || perfil?.email || '');
  const [exigirCV, setExigirCV] = useState(true);
  const [perguntas, setPerguntas] = useState([
    { id: novoId(), label: 'Há quantos anos de experiência tem nesta área?', tipo: 'numero', obrigatoria: true },
  ]);

  if (!ehRecrutadorOuEmpresa) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.bloqueioWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={C.cinza3} />
          <Text style={s.bloqueioTitulo}>Área reservada</Text>
          <Text style={s.bloqueioTxt}>
            Apenas contas de Recrutador ou Empresa podem publicar vagas na ConnectAll Angola.
          </Text>
          <TouchableOpacity style={s.bloqueioBtn} onPress={() => router.back()}>
            <Text style={s.bloqueioBtnTxt}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const adicionarPergunta = () => {
    if (perguntas.length >= 8) {
      Alert.alert('Limite atingido', 'Podes adicionar até 8 perguntas de triagem.');
      return;
    }
    setPerguntas(prev => [...prev, { id: novoId(), label: '', tipo: 'texto', obrigatoria: true }]);
  };

  const atualizarPergunta = (id, campo, valor) => {
    setPerguntas(prev => prev.map(p => (p.id === id ? { ...p, [campo]: valor } : p)));
  };

  const removerPergunta = (id) => setPerguntas(prev => prev.filter(p => p.id !== id));

  // ── Validações por passo ──
  const basicoValido = titulo.trim() && nomeEmpresa.trim() && local.trim();
  const detalhesValido =
    descricao.trim() &&
    requisitos.trim() &&
    vagasDisponiveis.trim() &&
    (!mostrarSalario || (salarioMin.trim() && salarioMax.trim()));
  const triagemValido =
    (!candidaturaSimplificada || emailRecrutador.trim()) &&
    perguntas.every(p => p.label.trim());

  // ── Notifica todos os candidatos (tipoPerfil === 'utilizador') sobre a nova vaga ──
  // Não inclui recrutadores nem empresas — só quem procura emprego.
  const notificarCandidatos = async (postId) => {
    try {
      const q = query(collection(db, 'users'), where('tipoPerfil', '==', 'utilizador'));
      const snap = await getDocs(q);

      const mensagem = `Nova vaga: ${titulo.trim()} em ${nomeEmpresa.trim()}`;
      const foto = perfil?.fotoURL || null;

      const envios = snap.docs
        .map(d => d.id)
        .filter(uid => uid !== user.uid)
        .map(uid =>
          enviarNotificacao(uid, user.uid, 'oportunidade', mensagem, foto, postId).catch(() => {})
        );

      await Promise.allSettled(envios);
    } catch (e) {
      // Uma falha aqui não deve impedir a publicação da vaga, já concluída.
      console.log('Erro ao notificar candidatos:', e);
    }
  };

  const publicarVaga = async () => {
    if (!user) return;
    setPublicando(true);
    try {
      const resumoTexto =
        `${titulo}\n\n${descricao}` +
        (requisitos.trim() ? `\n\nRequisitos:\n${requisitos}` : '');

      const novaVagaRef = await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        autorNome: perfil?.nome || 'ConnectAll',
        autorFoto: perfil?.fotoURL || null,
        autorCargo: perfil?.area || perfil?.cargo || '',
        autorCidade: perfil?.cidade || '',
        texto: resumoTexto,
        mediaUrls: [],
        tipo: 'oportunidade',
        autorVerificado:
          perfil?.verificado === true ||
          perfil?.isVerified === true ||
          perfil?.emailVerificado === true,
        likes: 0,
        comentarios: 0,
        timestamp: serverTimestamp(),

        // ── Campos estruturados da vaga ──
        titulo: titulo.trim(),
        nomeEmpresa: nomeEmpresa.trim(),
        local: local.trim(),
        modalidade,
        tipoContrato,
        nivelExperiencia,
        numFuncionarios,
        descricao: descricao.trim(),
        responsabilidades: responsabilidades.trim(),
        requisitos: requisitos.trim(),
        beneficios: beneficios.trim(),
        vagasDisponiveis: parseInt(vagasDisponiveis, 10) || 1,
        dataLimite: dataLimite.trim() || null,
        mostrarSalario,
        salarioMin: mostrarSalario ? salarioMin.trim() : null,
        salarioMax: mostrarSalario ? salarioMax.trim() : null,
        moeda: mostrarSalario ? moeda : null,
        candidaturaSimplificada,
        emailRecrutador: candidaturaSimplificada ? emailRecrutador.trim() : null,
        exigirCV,
        perguntasTriagem: perguntas.map(p => ({
          id: p.id,
          label: p.label.trim(),
          tipo: p.tipo,
          obrigatoria: !!p.obrigatoria,
        })),
        statusVaga: 'aberta',
      });

      // ── Notifica todos os candidatos — não bloqueia a mensagem de sucesso ──
      notificarCandidatos(novaVagaRef.id);

      // Voltamos ao ecrã anterior (Vagas) com router.back() em vez de um
      // caminho fixo (router.replace('/(main)/vagas')): chegámos aqui a
      // partir de Vagas via router.push, por isso back() devolve-nos
      // sempre ao sítio certo, sem depender do nome exacto da rota — foi
      // esse caminho fixo que estava a causar o "page not found".
      Alert.alert('Vaga publicada', 'A tua vaga já está visível para candidatos.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.log('Erro ao publicar vaga:', e);
      Alert.alert('Erro', 'Não foi possível publicar a vaga. Tenta novamente.');
    } finally {
      setPublicando(false);
    }
  };

  const PASSOS = ['basico', 'detalhes', 'triagem', 'revisao'];
  const progresso = ((PASSOS.indexOf(passo) + 1) / PASSOS.length) * 100;

  const Cabecalho = ({ titulo: t, onFechar }) => (
    <>
      <View style={s.header}>
        <TouchableOpacity onPress={onFechar} style={s.headerBtn}>
          <Ionicons name="close" size={24} color={C.cinza4} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>{t}</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={s.progressoFundo}>
        <View style={[s.progressoBarra, { width: `${progresso}%` }]} />
      </View>
    </>
  );

  // ═══════════════════════════════════════════════════════
  // PASSO 1 — BÁSICO
  // ═══════════════════════════════════════════════════════
  if (passo === 'basico') {
    return (
      <SafeAreaView style={s.safe}>
        <Cabecalho titulo="Publicar vaga · 1 de 4" onFechar={() => router.back()} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scrollBody}>
            <Text style={s.label}>Título da vaga*</Text>
            <TextInput style={s.input} value={titulo} onChangeText={setTitulo} placeholder="Ex: Contabilista Sénior" placeholderTextColor={C.cinza3} />

            <Text style={s.label}>Empresa*</Text>
            <TextInput style={s.input} value={nomeEmpresa} onChangeText={setNomeEmpresa} placeholder="Nome da empresa" placeholderTextColor={C.cinza3} />

            <Text style={s.label}>Localização*</Text>
            <TextInput style={s.input} value={local} onChangeText={setLocal} placeholder="Ex: Luanda, Angola" placeholderTextColor={C.cinza3} />

            <Text style={s.label}>Modalidade*</Text>
            <View style={s.pillsRow}>
              {MODALIDADES.map(m => (
                <TouchableOpacity key={m} style={[s.pill, modalidade === m && s.pillAtivo]} onPress={() => setModalidade(m)}>
                  <Text style={[s.pillTxt, modalidade === m && s.pillTxtAtivo]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Tipo de contrato*</Text>
            <View style={s.pillsRow}>
              {TIPOS_CONTRATO.map(t => (
                <TouchableOpacity key={t} style={[s.pill, tipoContrato === t && s.pillAtivo]} onPress={() => setTipoContrato(t)}>
                  <Text style={[s.pillTxt, tipoContrato === t && s.pillTxtAtivo]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Nível de experiência*</Text>
            <View style={s.pillsRow}>
              {NIVEIS.map(n => (
                <TouchableOpacity key={n} style={[s.pill, nivelExperiencia === n && s.pillAtivo]} onPress={() => setNivelExperiencia(n)}>
                  <Text style={[s.pillTxt, nivelExperiencia === n && s.pillTxtAtivo]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Nº de funcionários da empresa</Text>
            <TextInput style={s.input} value={numFuncionarios} onChangeText={setNumFuncionarios} placeholder="Ex: 11-50" placeholderTextColor={C.cinza3} />
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={s.footer}>
          <View />
          <TouchableOpacity style={[s.btnAvancar, !basicoValido && s.btnDesativado]} onPress={() => basicoValido && setPasso('detalhes')}>
            <Text style={s.btnAvancarTxt}>Avançar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════
  // PASSO 2 — DETALHES
  // ═══════════════════════════════════════════════════════
  if (passo === 'detalhes') {
    return (
      <SafeAreaView style={s.safe}>
        <Cabecalho titulo="Publicar vaga · 2 de 4" onFechar={() => setPasso('basico')} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scrollBody}>
            <Text style={s.label}>Descrição da vaga*</Text>
            <TextInput style={[s.input, s.inputArea]} value={descricao} onChangeText={setDescricao} multiline placeholder="Resumo geral da função e do contexto" placeholderTextColor={C.cinza3} />

            <Text style={s.label}>Responsabilidades</Text>
            <TextInput style={[s.input, s.inputArea]} value={responsabilidades} onChangeText={setResponsabilidades} multiline placeholder={'Uma por linha, ex:\n• Gerir a equipa\n• Preparar relatórios mensais'} placeholderTextColor={C.cinza3} />

            <Text style={s.label}>Requisitos*</Text>
            <TextInput style={[s.input, s.inputArea]} value={requisitos} onChangeText={setRequisitos} multiline placeholder={'Uma por linha, ex:\n• Licenciatura em Gestão\n• 3+ anos de experiência'} placeholderTextColor={C.cinza3} />

            <Text style={s.label}>Benefícios</Text>
            <TextInput style={[s.input, s.inputArea]} value={beneficios} onChangeText={setBeneficios} multiline placeholder="Ex: Seguro de saúde, transporte, formação" placeholderTextColor={C.cinza3} />

            <View style={s.linhaDupla}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Vagas disponíveis*</Text>
                <TextInput style={s.input} value={vagasDisponiveis} onChangeText={setVagasDisponiveis} keyboardType="numeric" placeholder="1" placeholderTextColor={C.cinza3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Prazo de candidatura</Text>
                <TextInput style={s.input} value={dataLimite} onChangeText={setDataLimite} placeholder="DD/MM/AAAA" placeholderTextColor={C.cinza3} />
              </View>
            </View>

            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Mostrar faixa salarial</Text>
              <Switch value={mostrarSalario} onValueChange={setMostrarSalario} trackColor={{ false: C.cinza2, true: C.verde }} thumbColor={C.branco} />
            </View>

            {mostrarSalario && (
              <>
                <View style={s.linhaDupla}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Salário mínimo*</Text>
                    <TextInput style={s.input} value={salarioMin} onChangeText={setSalarioMin} keyboardType="numeric" placeholder="Ex: 150000" placeholderTextColor={C.cinza3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Salário máximo*</Text>
                    <TextInput style={s.input} value={salarioMax} onChangeText={setSalarioMax} keyboardType="numeric" placeholder="Ex: 250000" placeholderTextColor={C.cinza3} />
                  </View>
                </View>
                <Text style={s.label}>Moeda</Text>
                <View style={s.pillsRow}>
                  {MOEDAS.map(m => (
                    <TouchableOpacity key={m} style={[s.pill, moeda === m && s.pillAtivo]} onPress={() => setMoeda(m)}>
                      <Text style={[s.pillTxt, moeda === m && s.pillTxtAtivo]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={s.footer}>
          <TouchableOpacity onPress={() => setPasso('basico')}><Text style={s.btnVoltarTxt}>Voltar</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btnAvancar, !detalhesValido && s.btnDesativado]} onPress={() => detalhesValido && setPasso('triagem')}>
            <Text style={s.btnAvancarTxt}>Avançar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════
  // PASSO 3 — TRIAGEM / SELEÇÃO DE CANDIDATOS
  // ═══════════════════════════════════════════════════════
  if (passo === 'triagem') {
    return (
      <SafeAreaView style={s.safe}>
        <Cabecalho titulo="Publicar vaga · 3 de 4" onFechar={() => setPasso('detalhes')} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scrollBody}>
            <Text style={s.secTitulo}>Como recebes as candidaturas</Text>

            <View style={s.opcaoCard}>
              <TouchableOpacity style={s.opcaoRow} onPress={() => setCandidaturaSimplificada(false)}>
                <View style={[s.radio, !candidaturaSimplificada && s.radioAtivo]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoTitulo}>Gerida pela ConnectAll (recomendado)</Text>
                  <Text style={s.opcaoTxt}>Recebes as candidaturas dentro da app, com CV, contacto e respostas de triagem, e podes avaliar e mudar o estado de cada uma.</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={s.opcaoCard}>
              <TouchableOpacity style={s.opcaoRow} onPress={() => setCandidaturaSimplificada(true)}>
                <View style={[s.radio, candidaturaSimplificada && s.radioAtivo]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoTitulo}>Candidatura simplificada (e-mail)</Text>
                  <Text style={s.opcaoTxt}>O candidato envia a candidatura por e-mail. A ConnectAll não gere nem regista o processo de seleção.</Text>
                </View>
              </TouchableOpacity>
            </View>

            {candidaturaSimplificada && (
              <>
                <Text style={s.label}>E-mail para receber candidaturas*</Text>
                <TextInput style={s.input} value={emailRecrutador} onChangeText={setEmailRecrutador} keyboardType="email-address" autoCapitalize="none" placeholder="recrutamento@empresa.co" placeholderTextColor={C.cinza3} />
              </>
            )}

            {!candidaturaSimplificada && (
              <>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Exigir currículo do candidato</Text>
                  <Switch value={exigirCV} onValueChange={setExigirCV} trackColor={{ false: C.cinza2, true: C.verde }} thumbColor={C.branco} />
                </View>

                <View style={{ height: 8 }} />
                <View style={s.secHeaderRow}>
                  <Text style={s.secTitulo}>Perguntas de triagem</Text>
                  <TouchableOpacity onPress={adicionarPergunta}>
                    <Text style={s.addTxt}>+ Adicionar</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.secSub}>Usadas para pré-selecionar candidatos automaticamente na revisão das candidaturas.</Text>

                {perguntas.map((p, idx) => (
                  <View key={p.id} style={s.perguntaCard}>
                    <View style={s.perguntaHeader}>
                      <Text style={s.perguntaNum}>Pergunta {idx + 1}</Text>
                      {perguntas.length > 1 && (
                        <TouchableOpacity onPress={() => removerPergunta(p.id)}>
                          <Ionicons name="trash-outline" size={16} color={C.vermelho} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={s.input}
                      value={p.label}
                      onChangeText={v => atualizarPergunta(p.id, 'label', v)}
                      placeholder="Ex: Tens carta de condução?"
                      placeholderTextColor={C.cinza3}
                    />
                    <View style={s.pillsRow}>
                      {TIPOS_PERGUNTA.map(t => (
                        <TouchableOpacity key={t.id} style={[s.pillSm, p.tipo === t.id && s.pillAtivo]} onPress={() => atualizarPergunta(p.id, 'tipo', t.id)}>
                          <Text style={[s.pillTxtSm, p.tipo === t.id && s.pillTxtAtivo]}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={s.footer}>
          <TouchableOpacity onPress={() => setPasso('detalhes')}><Text style={s.btnVoltarTxt}>Voltar</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btnAvancar, !triagemValido && s.btnDesativado]} onPress={() => triagemValido && setPasso('revisao')}>
            <Text style={s.btnAvancarTxt}>Rever</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════
  // PASSO 4 — REVISÃO
  // ═══════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.safe}>
      <Cabecalho titulo="Publicar vaga · 4 de 4" onFechar={() => setPasso('triagem')} />
      <ScrollView contentContainerStyle={s.scrollBody}>
        <Text style={s.revisaoTitulo}>{titulo}</Text>
        <Text style={s.revisaoSub}>{nomeEmpresa} · {local}</Text>

        <View style={s.pillsRow}>
          <View style={s.tagInfo}><Text style={s.tagInfoTxt}>{modalidade}</Text></View>
          <View style={s.tagInfo}><Text style={s.tagInfoTxt}>{tipoContrato}</Text></View>
          <View style={s.tagInfo}><Text style={s.tagInfoTxt}>{nivelExperiencia}</Text></View>
        </View>

        {mostrarSalario && (
          <Text style={s.revisaoLinha}>💰 {moeda} {salarioMin} — {salarioMax}</Text>
        )}
        <Text style={s.revisaoLinha}>👥 {vagasDisponiveis} vaga(s) disponível(is)</Text>
        {dataLimite ? <Text style={s.revisaoLinha}>📅 Candidaturas até {dataLimite}</Text> : null}

        <Text style={s.revisaoSecTitulo}>Descrição</Text>
        <Text style={s.revisaoTxt}>{descricao}</Text>

        {requisitos ? (<><Text style={s.revisaoSecTitulo}>Requisitos</Text><Text style={s.revisaoTxt}>{requisitos}</Text></>) : null}
        {responsabilidades ? (<><Text style={s.revisaoSecTitulo}>Responsabilidades</Text><Text style={s.revisaoTxt}>{responsabilidades}</Text></>) : null}
        {beneficios ? (<><Text style={s.revisaoSecTitulo}>Benefícios</Text><Text style={s.revisaoTxt}>{beneficios}</Text></>) : null}

        <Text style={s.revisaoSecTitulo}>Processo de seleção</Text>
        <Text style={s.revisaoTxt}>
          {candidaturaSimplificada
            ? `Candidatura simplificada por e-mail (${emailRecrutador})`
            : `Gerida pela ConnectAll · CV ${exigirCV ? 'obrigatório' : 'opcional'} · ${perguntas.length} pergunta(s) de triagem`}
        </Text>
      </ScrollView>
      <View style={s.footer}>
        <TouchableOpacity onPress={() => setPasso('triagem')}><Text style={s.btnVoltarTxt}>Voltar</Text></TouchableOpacity>
        <TouchableOpacity style={s.btnAvancar} onPress={publicarVaga} disabled={publicando}>
          <Text style={s.btnAvancarTxt}>{publicando ? 'A publicar...' : 'Publicar vaga'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.branco },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  headerBtn: { width: 32, alignItems: 'flex-start' },
  headerTitulo: { fontSize: 15, fontWeight: '700', color: C.preto },
  progressoFundo: { height: 3, backgroundColor: C.cinza2, marginHorizontal: 16, borderRadius: 2, overflow: 'hidden' },
  progressoBarra: { height: 3, backgroundColor: C.azul },
  scrollBody: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },

  label: { fontSize: 13, fontWeight: '600', color: C.cinza4, marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.preto, backgroundColor: C.branco },
  inputArea: { minHeight: 90, textAlignVertical: 'top' },
  linhaDupla: { flexDirection: 'row', gap: 12 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  pillSm: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  pillAtivo: { backgroundColor: C.azul, borderColor: C.azul },
  pillTxt: { fontSize: 13, fontWeight: '600', color: C.cinza4 },
  pillTxtSm: { fontSize: 11, fontWeight: '600', color: C.cinza4 },
  pillTxtAtivo: { color: C.branco },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: C.preto, flex: 1, marginRight: 10 },

  secTitulo: { fontSize: 17, fontWeight: '800', color: C.preto },
  secSub: { fontSize: 12, color: C.cinza3, marginTop: 4, marginBottom: 14 },
  secHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  addTxt: { fontSize: 13, fontWeight: '700', color: C.azul },

  opcaoCard: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 10, marginTop: 12 },
  opcaoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.cinza2, marginTop: 2 },
  radioAtivo: { borderColor: C.azul, backgroundColor: C.azul },
  opcaoTitulo: { fontSize: 14, fontWeight: '700', color: C.preto },
  opcaoTxt: { fontSize: 12, color: C.cinza3, marginTop: 4, lineHeight: 17 },

  perguntaCard: { borderWidth: 1, borderColor: C.cinza1, backgroundColor: C.cinza1, borderRadius: 10, padding: 12, marginTop: 12 },
  perguntaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  perguntaNum: { fontSize: 12, fontWeight: '700', color: C.cinza3 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.cinza1 },
  btnVoltarTxt: { fontSize: 15, fontWeight: '700', color: C.azul },
  btnAvancar: { backgroundColor: C.azul, borderRadius: 24, paddingHorizontal: 26, paddingVertical: 12 },
  btnDesativado: { backgroundColor: C.cinza2 },
  btnAvancarTxt: { color: C.branco, fontWeight: '700', fontSize: 15 },

  revisaoTitulo: { fontSize: 22, fontWeight: '800', color: C.preto },
  revisaoSub: { fontSize: 14, color: C.cinza3, marginTop: 4, marginBottom: 12 },
  revisaoLinha: { fontSize: 13, color: C.cinza4, marginTop: 8 },
  revisaoSecTitulo: { fontSize: 14, fontWeight: '700', color: C.preto, marginTop: 20, marginBottom: 6 },
  revisaoTxt: { fontSize: 13, color: C.cinza4, lineHeight: 19 },
  tagInfo: { backgroundColor: C.azulClaro, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  tagInfoTxt: { fontSize: 11, fontWeight: '700', color: C.azul },

  bloqueioWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  bloqueioTitulo: { fontSize: 17, fontWeight: '800', color: C.preto, marginTop: 6 },
  bloqueioTxt: { fontSize: 13, color: C.cinza3, textAlign: 'center', lineHeight: 19 },
  bloqueioBtn: { marginTop: 16, backgroundColor: C.azul, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11 },
  bloqueioBtnTxt: { color: C.branco, fontWeight: '700', fontSize: 14 },
});