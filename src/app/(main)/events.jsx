import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BloqueioAnonimo from '../../components/BloqueioAnonimo'; // Importação do componente de bloqueio
import { db } from '../../config/firebase';
import { C } from '../../constants/colors';
import { useUser } from '../../context/UserContext';

// Ícone da ConnectAll Angola usado como selo de "candidatura simplificada".
// Substitui o antigo selo do LinkedIn. Coloca o ficheiro do logótipo em
// assets/images/connectall-icon.png (ou ajusta o caminho abaixo).
const LOGO_CONNECTALL = require('../../../assets/images/connectall-icon.png');

// ── Vagas em tempo real ─────────────────────────────────────────────────────
// As vagas vêm das publicações (posts) do tipo "oportunidade". Desde a
// introdução do formulário "Publicar vaga" (ecrã criar-vaga.js), essas
// publicações trazem campos estruturados (salário, requisitos, perguntas de
// triagem, etc.). Publicações antigas, criadas via "Nova publicação" com
// apenas texto livre, continuam a ser suportadas em modo de compatibilidade.
function tempoRelativoVaga(timestamp) {
  if (!timestamp) return 'recentemente';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffDias = Math.floor((agora.getTime() - data.getTime()) / 86400000);
  if (diffDias <= 0) return 'hoje';
  if (diffDias === 1) return 'há 1 dia';
  if (diffDias < 7) return `há ${diffDias} dias`;
  const semanas = Math.floor(diffDias / 7);
  if (semanas < 5) return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`;
  const meses = Math.floor(diffDias / 30);
  return meses <= 1 ? 'há 1 mês' : `há ${meses} meses`;
}

function postParaVaga(id, data) {
  // ── Vaga estruturada, criada via formulário "Publicar vaga" ──
  if (data.titulo) {
    const salario = data.mostrarSalario && data.salarioMin && data.salarioMax
      ? `${data.moeda || 'Kz'} ${data.salarioMin} — ${data.salarioMax}`
      : null;
    return {
      id,
      titulo:             data.titulo,
      empresa:             data.nomeEmpresa || data.autorNome || 'ConnectAll',
      empresaFoto:         data.autorFoto || null,
      local:               data.local || data.autorCidade || 'Angola',
      modalidade:          data.modalidade || 'A combinar',
      tipo:                data.tipoContrato || 'Tempo integral',
      nivelExperiencia:    data.nivelExperiencia || null,
      numFuncionarios:     data.numFuncionarios || null,
      icon:                'briefcase',
      visto:               tempoRelativoVaga(data.timestamp),
      candidaturas:        0,
      simplificada:        !!data.candidaturaSimplificada,
      descricao:           data.descricao || data.texto || 'Sem descrição adicional fornecida pelo autor da publicação.',
      responsabilidades:   data.responsabilidades || '',
      requisitos:          data.requisitos || '',
      beneficios:          data.beneficios || '',
      salario,
      vagasDisponiveis:    data.vagasDisponiveis || 1,
      dataLimite:          data.dataLimite || null,
      exigirCV:            data.exigirCV !== false,
      perguntasTriagem:    Array.isArray(data.perguntasTriagem) && data.perguntasTriagem.length > 0 ? data.perguntasTriagem : null,
      emailRecrutador:     data.emailRecrutador || null,
      statusVaga:          data.statusVaga || 'aberta',
      autorUid:            data.uid || null,
    };
  }

  // ── Publicação antiga (texto livre, tipo "oportunidade") — compatibilidade ──
  const texto = data.texto || '';
  return {
    id,
    titulo:             texto.split('\n')[0].slice(0, 90) || 'Oportunidade',
    empresa:             data.autorNome || 'ConnectAll',
    empresaFoto:         data.autorFoto || null,
    local:               data.autorCidade || 'Angola',
    modalidade:          'A combinar',
    tipo:                'Tempo integral',
    nivelExperiencia:    null,
    numFuncionarios:     null,
    icon:                'briefcase',
    visto:               tempoRelativoVaga(data.timestamp),
    candidaturas:        0,
    simplificada:        false, // candidatura sempre gerida pela ConnectAll
    descricao:           texto || 'Sem descrição adicional fornecida pelo autor da publicação.',
    responsabilidades:   '',
    requisitos:          '',
    beneficios:          '',
    salario:             null,
    vagasDisponiveis:    1,
    dataLimite:          null,
    exigirCV:            true,
    perguntasTriagem:    null,
    emailRecrutador:     null,
    statusVaga:          'aberta',
    autorUid:            data.uid || null,
  };
}

function iniciais(nome) {
  if (!nome) return '?';
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// Perguntas de triagem padrão, usadas apenas em vagas antigas sem perguntas
// personalizadas configuradas no formulário "Publicar vaga".
const PERGUNTAS_PADRAO = [
  { id: 'excel',          label: 'Há quantos anos você já usa Microsoft Excel no trabalho?', tipo: 'numero', obrigatoria: true },
  { id: 'tecnica',        label: 'Há quantos anos de experiência tem na área técnica desta vaga?', tipo: 'numero', obrigatoria: true },
  { id: 'disponibilidade',label: 'Qual é a sua disponibilidade para iniciar (em dias)?', tipo: 'numero', obrigatoria: true },
];

// ── Avatar da empresa/recrutador ──
// Antes mostrava sempre um ícone de pasta genérico. Agora mostra a foto de
// perfil de quem publicou a vaga (recrutador ou empresa); se não houver foto,
// cai para as iniciais do nome, tal como o resto da app.
function LogoEmpresa({ foto, nome, size = 44 }) {
  return (
    <View style={[le.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {foto
        ? <Image source={{ uri: foto }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
        : <Text style={[le.iniciaisTxt, { fontSize: size * 0.36 }]}>{iniciais(nome)}</Text>}
    </View>
  );
}
const le = StyleSheet.create({
  wrap: { backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iniciaisTxt: { color: C.azul, fontWeight: '800' },
});

// ── Selo "Candidatura simplificada" ──
// Mostra o ícone da ConnectAll Angola em vez do antigo logótipo do LinkedIn.
function SeloConnectAll({ size = 16 }) {
  return (
    <Image
      source={LOGO_CONNECTALL}
      style={{ width: size, height: size, borderRadius: size / 4 }}
      contentFit="contain"
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function VagasScreen() {
  const { user, perfil } = useUser();
  const router = useRouter();
  const { postId } = useLocalSearchParams();

  // ── Navegação interna (substitui ecrãs separados) ──
  // 'lista' | 'detalhes' | 'contacto' | 'curriculo' | 'perguntas' | 'revisao' | 'confirmacao'
  const [tela, setTela] = useState('lista');
  const [vagaAtual, setVagaAtual] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [vagas, setVagas] = useState([]);
  const [carregandoVagas, setCarregandoVagas] = useState(true);
  const [postIdAberto, setPostIdAberto] = useState(postId || null);
  const [numCandidaturas, setNumCandidaturas] = useState(0);

  // Escuta em tempo real todas as publicações do tipo "Oportunidade"
  useEffect(() => {
    const q = query(collection(db, 'posts'), where('tipo', '==', 'oportunidade'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setVagas(snap.docs.map(d => postParaVaga(d.id, d.data())));
      setCarregandoVagas(false);
    }, err => { console.log('Erro vagas:', err); setCarregandoVagas(false); });
    return unsub;
  }, []);

  // Se veio do feed com uma oportunidade específica (postId), abre-a assim que carregar
  useEffect(() => {
    if (!postIdAberto || vagas.length === 0) return;
    const vaga = vagas.find(v => v.id === postIdAberto);
    if (vaga) { setVagaAtual(vaga); setTela('detalhes'); setPostIdAberto(null); }
  }, [postIdAberto, vagas]);

  // Se o utilizador é o dono da vaga em detalhes, escuta o nº de candidaturas
  useEffect(() => {
    if (tela !== 'detalhes' || !vagaAtual || !user || vagaAtual.autorUid !== user.uid) {
      setNumCandidaturas(0);
      return;
    }
    const q = query(collection(db, 'candidaturas'), where('vagaId', '==', vagaAtual.id));
    const unsub = onSnapshot(q, snap => setNumCandidaturas(snap.size), () => {});
    return unsub;
  }, [tela, vagaAtual, user]);

  // ── Dados da candidatura em progresso ──
  const [email, setEmail] = useState(perfil?.emailContacto || perfil?.email || '');
  const [codigoPais, setCodigoPais] = useState('Angola (+244)');
  const [telefone, setTelefone] = useState(perfil?.telefone || '');
  const [perguntas, setPerguntas] = useState({});
  const [seguirEmpresa, setSeguirEmpresa] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [candidaturasFeitas, setCandidaturasFeitas] = useState({});

  // Estado para controlar o modal de bloqueio
  const [bloqueioVisivel, setBloqueioVisivel] = useState(false);

  // Perguntas de triagem ativas para a vaga atual: as personalizadas pelo
  // recrutador (formulário "Publicar vaga"), ou as padrão em vagas antigas.
  const perguntasAtivas = vagaAtual?.perguntasTriagem || PERGUNTAS_PADRAO;

  const ehRecrutadorOuEmpresa = perfil?.tipoPerfil === 'recrutador' || perfil?.tipoPerfil === 'empresa';
  const ehAnonimo = !user || user.isAnonymous;
  const ehDonoDaVaga = !!(user && vagaAtual && vagaAtual.autorUid === user.uid);

  const vagasFiltradas = pesquisa.trim()
    ? vagas.filter(v =>
        v.titulo.toLowerCase().includes(pesquisa.toLowerCase()) ||
        v.empresa.toLowerCase().includes(pesquisa.toLowerCase()))
    : vagas;

  // ── Abrir detalhes ──
  const abrirVaga = (vaga) => {
    setVagaAtual(vaga);
    setTela('detalhes');
  };

  // ── Função para verificar acesso ──
  const verificarAcesso = (callback) => {
    if (ehAnonimo) {
      setBloqueioVisivel(true);
    } else {
      callback();
    }
  };

  // ── Candidatura simplificada (não gerida pela ConnectAll) → abre Gmail ──
  const candidatarSimplificada = async () => {
    if (!vagaAtual?.emailRecrutador) {
      Alert.alert('Indisponível', 'Esta vaga não tem um contacto direto configurado.');
      return;
    }
    const nome = perfil?.nome || 'Candidato';
    const assunto = encodeURIComponent(`Candidatura: ${vagaAtual.titulo} — ${nome}`);
    const corpo = encodeURIComponent(
      `Boa tarde,\n\nVenho por este meio candidatar-me à vaga de "${vagaAtual.titulo}" em ${vagaAtual.empresa}.\n\n` +
      `Nome completo: ${nome}\n` +
      `Telefone: ${perfil?.telefone || telefone || '—'}\n` +
      `E-mail: ${email || perfil?.emailContacto || '—'}\n` +
      (perfil?.cargo ? `Cargo atual: ${perfil.cargo}\n` : '') +
      (perfil?.bio ? `\nResumo profissional:\n${perfil.bio}\n` : '') +
      `\nAnexo o meu currículo para análise.\n\nCom os melhores cumprimentos,\n${nome}`
    );
    const mailto = `mailto:${vagaAtual.emailRecrutador}?subject=${assunto}&body=${corpo}`;

    try {
      const suportado = await Linking.canOpenURL(mailto);
      if (suportado) {
        await Linking.openURL(mailto);
        setCandidaturasFeitas(prev => ({ ...prev, [vagaAtual.id]: true }));
      } else {
        Alert.alert('Erro', 'Não foi encontrada nenhuma aplicação de e-mail no dispositivo.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir a aplicação de e-mail.');
    }
  };

  // ── Submeter candidatura (gerida pela ConnectAll) ──
  const submeterCandidatura = async () => {
    if (!vagaAtual || !user) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, 'candidaturas'), {
        vagaId: vagaAtual.id,
        vagaTitulo: vagaAtual.titulo,
        empresa: vagaAtual.empresa,
        vagaAutorUid: vagaAtual.autorUid || null,
        candidatoUid: user.uid,
        candidatoNome: perfil?.nome || 'Utilizador',
        candidatoFoto: perfil?.fotoURL || null,
        cvUrl: perfil?.uriCV || perfil?.cvUrl || null,
        email: email.trim(),
        telefone: `${codigoPais} ${telefone}`.trim(),
        perguntas,
        seguirEmpresa,
        status: 'pendente',
        timestamp: serverTimestamp(),
      });
      setCandidaturasFeitas(prev => ({ ...prev, [vagaAtual.id]: true }));
      setTela('confirmacao');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar a candidatura. Tenta novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const reiniciarFluxo = () => {
    setTela('lista');
    setVagaAtual(null);
    setPerguntas({});
    setSeguirEmpresa(true);
  };

  const irParaCandidatos = () => {
    if (!vagaAtual) return;
    router.push({
      pathname: '/(main)/candidatos',
      params: { vagaId: vagaAtual.id, vagaTitulo: vagaAtual.titulo, vagaAutorUid: vagaAtual.autorUid || '' },
    });
  };

  // ═══════════════════════════════════════════════════════════
  // TELA: LISTA DE VAGAS (estilo LinkedIn feed)
  // ═══════════════════════════════════════════════════════════
  if (tela === 'lista') {
    return (
      <SafeAreaView style={s.safe}>
        {/* Modal de Bloqueio */}
        <BloqueioAnonimo
          visivel={bloqueioVisivel}
          tipo="acao"
          onFechar={() => setBloqueioVisivel(false)}
        />

        {/* Header com pesquisa */}
        <View style={s.headerTop}>
          {perfil?.fotoURL ? (
            <Image source={{ uri: perfil.fotoURL }} style={s.avatarHeader} contentFit="cover" />
          ) : (
            <View style={[s.avatarHeader, { backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: C.branco, fontWeight: '700', fontSize: 13 }}>{iniciais(perfil?.nome)}</Text>
            </View>
          )}
          <View style={s.searchBar}>
            <Feather name="search" size={16} color={C.cinza3} />
            <TextInput
              style={s.searchInput}
              placeholder="Descreva a vaga..."
              placeholderTextColor={C.cinza3}
              value={pesquisa}
              onChangeText={setPesquisa}
            />
            <View style={s.novidadeBadge}>
              <Text style={s.novidadeTxt}>Novidade</Text>
            </View>
          </View>
        </View>

        {/* Chips de filtro */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chipsContent}>
          {['Preferências', 'Rastreador de vagas', 'Anúncios', 'Empresas'].map((c, i) => (
            <TouchableOpacity key={i} style={s.chipPill} onPress={() => verificarAcesso(() => {})}>
              <Text style={s.chipPillTxt}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.sectionDivider} />

          <View style={s.sectionHeaderWrap}>
            <Text style={s.sectionTitulo}>Vagas que combinam com o seu perfil</Text>
            <Text style={s.sectionSub}>Com base nos critérios da vaga e no seu perfil</Text>
          </View>

          {carregandoVagas && (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator color={C.azul} />
            </View>
          )}

          {!carregandoVagas && vagasFiltradas.length === 0 && (
            <View style={{ paddingVertical: 30, paddingHorizontal: 20, alignItems: 'center', gap: 6 }}>
              <Ionicons name="briefcase-outline" size={28} color={C.cinza3} />
              <Text style={{ fontSize: 13, color: C.cinza3, textAlign: 'center' }}>Ainda não há vagas publicadas.</Text>
            </View>
          )}

          {vagasFiltradas.map((vaga, idx) => (
            <View key={vaga.id}>
              <TouchableOpacity style={s.vagaCard} activeOpacity={0.7} onPress={() => abrirVaga(vaga)}>
                <LogoEmpresa foto={vaga.empresaFoto} nome={vaga.empresa} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.vagaTitulo}>{vaga.titulo}</Text>
                  <Text style={s.vagaEmpresa}>{vaga.empresa}</Text>
                  <Text style={s.vagaLocal}>{vaga.local} ({vaga.modalidade})</Text>
                  {vaga.salario && <Text style={s.vagaSalario}>{vaga.salario}</Text>}

                  <View style={s.melhorCandidatoBox}>
                    <View style={s.melhorIconeWrap}>
                      <Ionicons name="ribbon" size={13} color={C.laranja} />
                    </View>
                    <Text style={s.melhorCandidatoTxt}>Você seria um dos melhores candidatos</Text>
                  </View>

                  <View style={s.vagaMetaRow}>
                    <Text style={s.vagaMetaTxt}>Visto · {vaga.visto}</Text>
                    {vaga.simplificada && (
                      <>
                        <SeloConnectAll size={14} />
                        <Text style={s.vagaMetaTxt}>Candidatura simplificada</Text>
                      </>
                    )}
                  </View>

                  {candidaturasFeitas[vaga.id] && (
                    <View style={s.jaCandidatadoBadge}>
                      <Ionicons name="checkmark-circle" size={13} color={C.verde} />
                      <Text style={s.jaCandidatadoTxt}>Candidatura enviada</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {idx < vagasFiltradas.length - 1 && <View style={s.cardDivider} />}
            </View>
          ))}

          {ehRecrutadorOuEmpresa && (
            <TouchableOpacity style={s.publicarFab} onPress={() => router.push('/(main)/criar-vaga')}>
              <Ionicons name="add" size={16} color={C.branco} />
              <Text style={s.publicarFabTxt}>Publicar vaga</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TELA: DETALHES DA VAGA
  // ═══════════════════════════════════════════════════════════
  if (tela === 'detalhes' && vagaAtual) {
    const jaCandidatado = !!candidaturasFeitas[vagaAtual.id];
    return (
      <SafeAreaView style={s.safe}>
        <BloqueioAnonimo
          visivel={bloqueioVisivel}
          tipo="acao"
          onFechar={() => setBloqueioVisivel(false)}
        />
        <View style={s.modalHeaderRow}>
          <TouchableOpacity onPress={() => setTela('lista')} style={s.modalCloseBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cinza4} />
          </TouchableOpacity>
          <View style={s.dragHandle} />
          <TouchableOpacity style={s.modalCloseBtn} onPress={() => verificarAcesso(() => {})}>
            <Feather name="more-vertical" size={20} color={C.cinza4} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={s.detalhesHeaderRow}>
              <LogoEmpresa foto={vagaAtual.empresaFoto} nome={vagaAtual.empresa} size={54} />
              <Text style={s.detalhesEmpresa}>{vagaAtual.empresa}</Text>
            </View>

            <Text style={s.detalhesTitulo}>{vagaAtual.titulo}</Text>
            <Text style={s.detalhesInfo}>
              {vagaAtual.local} · {vagaAtual.visto} · <Text style={{ color: C.verde, fontWeight: '700' }}>{vagaAtual.candidaturas} candidaturas</Text>
            </Text>

            <View style={s.tipoRow}>
              <View style={s.tipoPill}>
                <Text style={s.tipoPillTxt}>{vagaAtual.tipo}</Text>
              </View>
              <View style={s.tipoPill}>
                <Text style={s.tipoPillTxt}>{vagaAtual.modalidade}</Text>
              </View>
              {vagaAtual.nivelExperiencia && (
                <View style={s.tipoPill}>
                  <Text style={s.tipoPillTxt}>{vagaAtual.nivelExperiencia}</Text>
                </View>
              )}
              {vagaAtual.numFuncionarios && (
                <View style={s.tipoPill}>
                  <Text style={s.tipoPillTxt}>{vagaAtual.numFuncionarios} funcionários</Text>
                </View>
              )}
            </View>

            {(vagaAtual.salario || vagaAtual.vagasDisponiveis || vagaAtual.dataLimite) && (
              <View style={s.resumoBox}>
                {vagaAtual.salario && (
                  <View style={s.resumoLinha}>
                    <Ionicons name="cash-outline" size={15} color={C.cinza3} />
                    <Text style={s.resumoTxt}>{vagaAtual.salario}</Text>
                  </View>
                )}
                <View style={s.resumoLinha}>
                  <Ionicons name="people-outline" size={15} color={C.cinza3} />
                  <Text style={s.resumoTxt}>{vagaAtual.vagasDisponiveis} vaga(s) disponível(is)</Text>
                </View>
                {vagaAtual.dataLimite && (
                  <View style={s.resumoLinha}>
                    <Ionicons name="calendar-outline" size={15} color={C.cinza3} />
                    <Text style={s.resumoTxt}>Candidaturas até {vagaAtual.dataLimite}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={s.detalhesBtnRow}>
              <TouchableOpacity
                style={[s.btnCandidatarPrimario, jaCandidatado && s.btnCandidatadoCheio]}
                onPress={() => {
                  if (jaCandidatado) return;
                  verificarAcesso(() => {
                    if (vagaAtual.simplificada) {
                      candidatarSimplificada();
                    } else {
                      setTela('contacto');
                    }
                  });
                }}
              >
                {vagaAtual.simplificada && !jaCandidatado && (
                  <SeloConnectAll size={18} />
                )}
                <Text style={s.btnCandidatarPrimarioTxt}>
                  {jaCandidatado ? 'Candidatura enviada' : (vagaAtual.simplificada ? 'Candidatura simplificada' : 'Candidatar-se')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.btnSalvar} onPress={() => verificarAcesso(() => {})}>
                <Text style={s.btnSalvarTxt}>Guardar</Text>
              </TouchableOpacity>
            </View>

            {ehDonoDaVaga && (
              <TouchableOpacity style={s.btnVerCandidatos} onPress={irParaCandidatos}>
                <Ionicons name="people" size={16} color={C.azul} />
                <Text style={s.btnVerCandidatosTxt}>Ver candidatos ({numCandidaturas})</Text>
              </TouchableOpacity>
            )}

            <View style={s.infoBox}>
              <Text style={s.infoBoxTitulo}>O seu perfil combina com esta vaga</Text>
              <Text style={s.infoBoxTxt}>Possui as competências ideais para esta função de acordo com o seu currículo.</Text>
            </View>

            <View style={s.descBox}>
              <Text style={s.sectionTitulo}>Sobre a vaga</Text>
              <Text style={s.descTxt}>{vagaAtual.descricao}</Text>
            </View>

            {!!vagaAtual.responsabilidades && (
              <View style={s.descBox}>
                <Text style={s.sectionTitulo}>Responsabilidades</Text>
                <Text style={s.descTxt}>{vagaAtual.responsabilidades}</Text>
              </View>
            )}

            {!!vagaAtual.requisitos && (
              <View style={s.descBox}>
                <Text style={s.sectionTitulo}>Requisitos</Text>
                <Text style={s.descTxt}>{vagaAtual.requisitos}</Text>
              </View>
            )}

            {!!vagaAtual.beneficios && (
              <View style={s.descBox}>
                <Text style={s.sectionTitulo}>Benefícios</Text>
                <Text style={s.descTxt}>{vagaAtual.beneficios}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Os passos abaixo já possuem a proteção pois só são acessados via 'detalhes' ──

  // ═══════════════════════════════════════════════════════════
  // TELA: PASSO 1 — CONTACTO
  // ═══════════════════════════════════════════════════════════
  if (tela === 'contacto') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.candHeader}>
          <TouchableOpacity onPress={() => setTela('detalhes')} style={s.candCloseBtn}>
            <Ionicons name="close" size={24} color={C.cinza4} />
          </TouchableOpacity>
          <Text style={s.candHeaderTitulo} numberOfLines={2}>Candidate-se a {vagaAtual?.empresa}</Text>
        </View>

        <View style={s.progressoFundo}>
          <View style={[s.progressoBarra, { width: '33%' }]} />
        </View>
        <Text style={s.paginaTxt}>Página 1 de 3</Text>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={s.candTitulo}>Informações de contacto</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {perfil?.fotoURL ? (
              <Image source={{ uri: perfil.fotoURL }} style={[s.avatarHeader, { width: 48, height: 48, borderRadius: 24 }]} contentFit="cover" />
            ) : (
              <View style={[s.avatarHeader, { width: 48, height: 48, borderRadius: 24, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: C.branco, fontWeight: '700', fontSize: 16 }}>{iniciais(perfil?.nome)}</Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.preto }}>{perfil?.nome || 'Utilizador'}</Text>
              <Text style={{ fontSize: 13, color: C.cinza3 }}>{perfil?.cargo || 'Candidato na ConnectAll'}</Text>
              <Text style={{ fontSize: 13, color: C.cinza3 }}>{perfil?.localizacao || 'Angola'}</Text>
            </View>
          </View>

          <Text style={s.candLabel}>E-mail*</Text>
          <TextInput
            style={s.candInput}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={s.candLabel}>Código do país*</Text>
          <TouchableOpacity style={s.candSelector}>
            <Text style={s.candSelectorTxt}>{codigoPais}</Text>
            <Ionicons name="chevron-down" size={18} color={C.cinza3} />
          </TouchableOpacity>

          <Text style={s.candLabel}>Número de celular*</Text>
          <TextInput
            style={s.candInput}
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            placeholder="9xx xxx xxx"
          />

          <Text style={s.candLegal}>
            O envio desta candidatura não alterará o teu perfil na ConnectAll Angola.
          </Text>
        </ScrollView>

        <View style={s.candFooter}>
          <View />
          <TouchableOpacity
            style={[s.btnAvancar, (!email || !telefone) && s.btnAvancarDesativado]}
            onPress={() => (email && telefone) && setTela('curriculo')}
          >
            <Text style={s.btnAvancarTxt}>Avançar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TELA: PASSO 2 — CURRÍCULO
  // ═══════════════════════════════════════════════════════════
  if (tela === 'curriculo') {
    const temCv = !!(perfil?.uriCV || perfil?.cvUrl);
    const cvNecessario = vagaAtual?.exigirCV !== false;
    const podeAvancar = !cvNecessario || temCv;
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.candHeader}>
          <TouchableOpacity onPress={() => setTela('contacto')} style={s.candCloseBtn}>
            <Ionicons name="close" size={24} color={C.cinza4} />
          </TouchableOpacity>
          <Text style={s.candHeaderTitulo} numberOfLines={2}>Candidate-se a {vagaAtual?.empresa}</Text>
        </View>

        <View style={s.progressoFundo}>
          <View style={[s.progressoBarra, { width: '66%' }]} />
        </View>
        <Text style={s.paginaTxt}>Página 2 de 3</Text>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={s.candTitulo}>Currículo</Text>
          <Text style={s.candDescricao}>
            {cvNecessario ? 'Certifica-te de ter um currículo atualizado no teu perfil*' : 'Currículo opcional para esta vaga.'}
          </Text>

          {temCv ? (
            <View style={s.cvCard}>
              <View style={s.cvIconeWrap}>
                <Ionicons name="document-text" size={22} color={C.vermelho} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cvNome} numberOfLines={1}>{perfil?.cvNome || 'Currículo.pdf'}</Text>
                <Text style={s.cvMeta}>Carregado no teu perfil</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={C.verde} />
            </View>
          ) : (
            <View style={s.fotoPlaceholder}>
              <Feather name="file-text" size={36} color={C.cinza2} />
              <Text style={s.fotoPlaceholderTxt}>
                {cvNecessario ? 'Sem currículo carregado no perfil' : 'Sem currículo carregado (opcional)'}
              </Text>
              <Text style={s.fotoPlaceholderSub}>
                {cvNecessario
                  ? 'Adiciona um currículo na secção Documentos do teu perfil para continuar.'
                  : 'Podes avançar sem currículo, mas recomendamos carregar um na secção Documentos do teu perfil.'}
              </Text>
            </View>
          )}

          <Text style={s.candLegal}>
            O envio desta candidatura não alterará o teu perfil na ConnectAll Angola.
          </Text>
        </ScrollView>

        <View style={s.candFooter}>
          <TouchableOpacity onPress={() => setTela('contacto')}>
            <Text style={s.btnVoltarTxt}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnAvancar, !podeAvancar && s.btnAvancarDesativado]}
            onPress={() => podeAvancar && setTela('perguntas')}
          >
            <Text style={s.btnAvancarTxt}>Avançar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TELA: PASSO 3 — PERGUNTAS ADICIONAIS (de triagem)
  // ═══════════════════════════════════════════════════════════
  if (tela === 'perguntas') {
    const todasRespondidas = perguntasAtivas.every(p => !p.obrigatoria || `${perguntas[p.id] ?? ''}`.trim());
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.candHeader}>
          <TouchableOpacity onPress={() => setTela('curriculo')} style={s.candCloseBtn}>
            <Ionicons name="close" size={24} color={C.cinza4} />
          </TouchableOpacity>
          <Text style={s.candHeaderTitulo} numberOfLines={2}>Candidate-se a {vagaAtual?.empresa}</Text>
        </View>

        <View style={s.progressoFundo}>
          <View style={[s.progressoBarra, { width: '100%' }]} />
        </View>
        <Text style={s.paginaTxt}>Página 3 de 3</Text>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={s.candTitulo}>Perguntas adicionais</Text>
          <Text style={s.candDescricao}>Estas perguntas ajudam o recrutador a avaliar a tua candidatura.</Text>

          {perguntasAtivas.map(p => (
            <View key={p.id}>
              <Text style={s.candLabel}>{p.label}{p.obrigatoria ? '*' : ''}</Text>

              {p.tipo === 'sim_nao' ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  {['Sim', 'Não'].map(op => (
                    <TouchableOpacity
                      key={op}
                      style={[s.simNaoBtn, perguntas[p.id] === op && s.simNaoBtnAtivo]}
                      onPress={() => setPerguntas(prev => ({ ...prev, [p.id]: op }))}
                    >
                      <Text style={[s.simNaoTxt, perguntas[p.id] === op && s.simNaoTxtAtivo]}>{op}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput
                  style={s.candInput}
                  value={perguntas[p.id] || ''}
                  onChangeText={v => setPerguntas(prev => ({ ...prev, [p.id]: v }))}
                  keyboardType={p.tipo === 'numero' ? 'numeric' : 'default'}
                  placeholder={p.tipo === 'numero' ? '0' : 'A tua resposta'}
                />
              )}
            </View>
          ))}

          <Text style={s.candLegal}>
            O envio desta candidatura não alterará o teu perfil na ConnectAll Angola.
          </Text>
        </ScrollView>

        <View style={s.candFooter}>
          <TouchableOpacity onPress={() => setTela('curriculo')}>
            <Text style={s.btnVoltarTxt}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnAvancar, !todasRespondidas && s.btnAvancarDesativado]}
            onPress={() => todasRespondidas && setTela('revisao')}
          >
            <Text style={s.btnAvancarTxt}>Revisar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TELA: REVISÃO
  // ═══════════════════════════════════════════════════════════
  if (tela === 'revisao') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.candHeader}>
          <TouchableOpacity onPress={() => setTela('perguntas')} style={s.candCloseBtn}>
            <Ionicons name="close" size={24} color={C.cinza4} />
          </TouchableOpacity>
          <Text style={s.candHeaderTitulo} numberOfLines={2}>Candidate-se a {vagaAtual?.empresa}</Text>
        </View>

        <View style={s.progressoFundo}>
          <View style={[s.progressoBarra, { width: '100%' }]} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Text style={s.candTitulo}>Revê a tua candidatura</Text>
            <Text style={s.candDescricao}>A empresa também receberá uma cópia do teu perfil.</Text>
          </View>

          <View style={s.revisaoDivider} />

          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={s.revisaoSecHeader}>
              <Text style={s.revisaoSecTitulo}>Informações de contacto</Text>
              <TouchableOpacity onPress={() => setTela('contacto')}><Text style={s.revisaoEditar}>Editar</Text></TouchableOpacity>
            </View>
            <Text style={s.revisaoLabel}>E-mail*</Text>
            <Text style={s.revisaoValor}>{email}</Text>
            <Text style={s.revisaoLabel}>Código do país*</Text>
            <Text style={s.revisaoValor}>{codigoPais}</Text>
            <Text style={s.revisaoLabel}>Número de celular*</Text>
            <Text style={s.revisaoValor}>{telefone}</Text>
          </View>

          <View style={s.revisaoDivider} />

          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={s.revisaoSecHeader}>
              <Text style={s.revisaoSecTitulo}>Currículo</Text>
              <TouchableOpacity onPress={() => setTela('curriculo')}><Text style={s.revisaoEditar}>Editar</Text></TouchableOpacity>
            </View>
            {(perfil?.uriCV || perfil?.cvUrl) ? (
              <View style={s.cvCard}>
                <View style={s.cvIconeWrap}>
                  <Ionicons name="document-text" size={22} color={C.vermelho} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cvNome} numberOfLines={1}>{perfil?.cvNome || 'Currículo.pdf'}</Text>
                </View>
                <Text style={s.cvVisualizar}>Visualizar</Text>
              </View>
            ) : (
              <Text style={s.revisaoValor}>Sem currículo anexado</Text>
            )}
          </View>

          <View style={s.revisaoDivider} />

          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={s.revisaoSecHeader}>
              <Text style={s.revisaoSecTitulo}>Perguntas adicionais</Text>
              <TouchableOpacity onPress={() => setTela('perguntas')}><Text style={s.revisaoEditar}>Editar</Text></TouchableOpacity>
            </View>
            {perguntasAtivas.map(p => (
              <View key={p.id}>
                <Text style={s.revisaoLabel}>{p.label}{p.obrigatoria ? '*' : ''}</Text>
                <Text style={s.revisaoValor}>{perguntas[p.id] || '—'}</Text>
              </View>
            ))}
          </View>

          <View style={s.revisaoDivider} />

          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={s.seguirRow}>
              <View style={s.seguirCheckbox}>
                <Ionicons name="checkmark" size={14} color={C.branco} />
              </View>
              <Text style={s.seguirTxt}>Seguir {vagaAtual?.empresa} para conhecer as novidades</Text>
            </View>
            <Text style={s.candLegal}>
              Guardamos as tuas respostas e currículo automaticamente para facilitar futuras candidaturas e personalizar a tua experiência. Podes desativar isto nas configurações de candidatura quando quiseres.
            </Text>
          </View>
        </ScrollView>

        <View style={s.candFooter}>
          <View />
          <TouchableOpacity style={s.btnAvancar} onPress={submeterCandidatura} disabled={enviando}>
            {enviando
              ? <ActivityIndicator color={C.branco} size="small" />
              : <Text style={s.btnAvancarTxt}>Enviar</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TELA: CONFIRMAÇÃO
  // ═══════════════════════════════════════════════════════════
  if (tela === 'confirmacao') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.candHeader}>
          <TouchableOpacity onPress={reiniciarFluxo} style={s.candCloseBtn}>
            <Ionicons name="close" size={24} color={C.cinza4} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
          <View style={s.sucessoIconeWrap}>
            <Ionicons name="checkmark" size={40} color={C.verde} />
          </View>
          <Text style={s.sucessoTitulo}>
            A tua candidatura foi enviada para {vagaAtual?.empresa}.
          </Text>
          <Text style={s.sucessoSub}>
            Podes acompanhar a tua candidatura na aba "Candidaturas enviadas" em Minhas Vagas.
          </Text>

          <View style={s.ajudeCard}>
            <Text style={s.ajudeTitulo}>Ajuda mais recrutadores a descobrir o teu perfil</Text>
            <Text style={s.ajudeTxt}>
              Os recrutadores podem ver competências e experiências nos currículos que optares por partilhar quando pesquisam e avaliam perfis na ConnectAll Angola.
            </Text>
            <View style={s.ajudeSwitchRow}>
              <Text style={s.ajudeSwitchTxt}>Partilhar dados do currículo com todos os recrutadores</Text>
              <Switch
                value={seguirEmpresa}
                onValueChange={setSeguirEmpresa}
                trackColor={{ false: C.cinza2, true: C.verde }}
                thumbColor={C.branco}
              />
            </View>
          </View>

          <TouchableOpacity style={s.btnConcluido} onPress={reiniciarFluxo}>
            <Text style={s.btnConcluidoTxt}>Concluído</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.branco },

  // ── Lista de vagas ──
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  avatarHeader: { width: 38, height: 38, borderRadius: 19 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cinza1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.cinza2 },
  searchInput: { flex: 1, fontSize: 14, color: C.cinza4 },
  novidadeBadge: { backgroundColor: C.cinza2, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  novidadeTxt: { fontSize: 10, fontWeight: '700', color: C.cinza4 },
  chipsScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.cinza1 },
  chipsContent: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  chipPill: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  chipPillTxt: { fontSize: 13, fontWeight: '600', color: C.cinza4 },
  sectionDivider: { height: 8, backgroundColor: C.cinza1 },
  sectionHeaderWrap: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  sectionTitulo: { fontSize: 19, fontWeight: '800', color: C.preto },
  sectionSub: { fontSize: 13, color: C.cinza3, marginTop: 4 },
  vagaCard: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16 },
  vagaTitulo: { fontSize: 15, fontWeight: '700', color: C.preto, lineHeight: 20 },
  vagaEmpresa: { fontSize: 13, color: C.cinza4, marginTop: 2 },
  vagaLocal: { fontSize: 12, color: C.cinza3, marginTop: 1 },
  vagaSalario: { fontSize: 12, color: C.verde, fontWeight: '700', marginTop: 4 },
  melhorCandidatoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  melhorIconeWrap: { width: 18, height: 18, borderRadius: 4, backgroundColor: C.laranjaClaro, alignItems: 'center', justifyContent: 'center' },
  melhorCandidatoTxt: { fontSize: 12, color: C.cinza4, fontWeight: '500' },
  vagaMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  vagaMetaTxt: { fontSize: 11, color: C.cinza3 },
  jaCandidatadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  jaCandidatadoTxt: { fontSize: 12, color: C.verde, fontWeight: '700' },
  cardDivider: { height: 1, backgroundColor: C.cinza1, marginHorizontal: 16 },
  publicarFab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.azul, borderRadius: 24, marginHorizontal: 16, marginTop: 10, paddingVertical: 13 },
  publicarFabTxt: { color: C.branco, fontWeight: '700', fontSize: 14 },

  // ── Detalhes ──
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 },
  modalCloseBtn: { padding: 6 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.cinza2 },
  detalhesHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  detalhesEmpresa: { fontSize: 15, fontWeight: '600', color: C.cinza4 },
  detalhesTitulo: { fontSize: 24, fontWeight: '800', color: C.preto, marginTop: 14, lineHeight: 30 },
  detalhesInfo: { fontSize: 13, color: C.cinza3, marginTop: 10, lineHeight: 19 },
  detalhesInfoSec: { fontSize: 13, color: C.cinza3, marginTop: 4 },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tipoPill: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  tipoPillTxt: { fontSize: 12, fontWeight: '600', color: C.cinza4 },
  resumoBox: { backgroundColor: C.cinza1, borderRadius: 10, padding: 14, marginTop: 16, gap: 8 },
  resumoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resumoTxt: { fontSize: 13, color: C.cinza4, fontWeight: '600' },
  detalhesBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCandidatarPrimario: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.azul, borderRadius: 26, paddingVertical: 14 },
  btnCandidatadoCheio: { backgroundColor: C.verde },
  btnCandidatarPrimarioTxt: { color: C.branco, fontWeight: '700', fontSize: 15 },
  btnSalvar: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.azul, borderRadius: 26 },
  btnSalvarTxt: { color: C.azul, fontWeight: '700', fontSize: 15 },
  btnVerCandidatos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.3, borderColor: C.azul, borderRadius: 22, paddingVertical: 12, marginTop: 12, backgroundColor: C.azulClaro },
  btnVerCandidatosTxt: { color: C.azul, fontWeight: '700', fontSize: 14 },
  infoBox: { backgroundColor: C.cinza1, borderRadius: 10, padding: 14, marginTop: 22 },
  infoBoxTitulo: { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 4 },
  infoBoxTxt: { fontSize: 13, color: C.cinza3, lineHeight: 19 },
  descBox: { marginTop: 24 },
  descTxt: { fontSize: 14, color: C.cinza4, lineHeight: 22, marginTop: 10 },

  // ── Fluxo de candidatura (passos) ──
  candHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  candCloseBtn: { padding: 2 },
  candHeaderTitulo: { flex: 1, fontSize: 17, fontWeight: '700', color: C.preto, lineHeight: 22 },
  progressoFundo: { height: 3, backgroundColor: C.cinza2, marginHorizontal: 16, borderRadius: 2, overflow: 'hidden' },
  progressoBarra: { height: 3, backgroundColor: C.azul },
  paginaTxt: { fontSize: 12, color: C.cinza3, textAlign: 'right', paddingHorizontal: 16, marginTop: 4 },
  candTitulo: { fontSize: 22, fontWeight: '800', color: C.preto, marginBottom: 16 },
  candDescricao: { fontSize: 13, color: C.cinza3, marginBottom: 16, lineHeight: 19 },
  candLabel: { fontSize: 13, fontWeight: '600', color: C.cinza4, marginTop: 18, marginBottom: 6 },
  candInput: { borderBottomWidth: 1.5, borderBottomColor: C.cinza2, paddingVertical: 8, fontSize: 15, color: C.preto },
  candSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: C.cinza2, paddingVertical: 10 },
  candSelectorTxt: { fontSize: 15, color: C.preto },
  candLegal: { fontSize: 11, color: C.cinza3, marginTop: 28, lineHeight: 16 },
  candFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.cinza1 },
  btnVoltarTxt: { fontSize: 15, fontWeight: '700', color: C.azul },
  btnAvancar: { backgroundColor: C.azul, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12 },
  btnAvancarDesativado: { backgroundColor: C.cinza2 },
  btnAvancarTxt: { color: C.branco, fontWeight: '700', fontSize: 15 },
  simNaoBtn: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9 },
  simNaoBtnAtivo: { backgroundColor: C.azul, borderColor: C.azul },
  simNaoTxt: { fontSize: 13, fontWeight: '700', color: C.cinza4 },
  simNaoTxtAtivo: { color: C.branco },

  // ── CV card ──
  cvCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: C.azul, borderRadius: 8, padding: 12 },
  cvIconeWrap: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#FEEAEA', alignItems: 'center', justifyContent: 'center' },
  cvNome: { fontSize: 14, fontWeight: '700', color: C.preto },
  cvMeta: { fontSize: 12, color: C.cinza3, marginTop: 2 },
  cvVisualizar: { fontSize: 13, fontWeight: '700', color: C.azul },
  fotoPlaceholder: { borderWidth: 2, borderColor: C.cinza2, borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 20 },
  fotoPlaceholderTxt: { fontSize: 13, fontWeight: '700', color: C.cinza4, textAlign: 'center' },
  fotoPlaceholderSub: { fontSize: 12, color: C.cinza3, textAlign: 'center' },

  // ── Revisão ──
  revisaoDivider: { height: 8, backgroundColor: C.cinza1 },
  revisaoSecHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  revisaoSecTitulo: { fontSize: 16, fontWeight: '700', color: C.preto },
  revisaoEditar: { fontSize: 13, fontWeight: '700', color: C.azul },
  revisaoLabel: { fontSize: 12, color: C.cinza3, marginTop: 12 },
  revisaoValor: { fontSize: 14, color: C.preto, marginTop: 2 },
  seguirRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  seguirCheckbox: { width: 20, height: 20, borderRadius: 4, backgroundColor: C.verde, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  seguirTxt: { flex: 1, fontSize: 14, color: C.preto, lineHeight: 20 },

  // ── Confirmação ──
  sucessoIconeWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.verdeClaro, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  sucessoTitulo: { fontSize: 20, fontWeight: '800', color: C.preto, textAlign: 'center', lineHeight: 27 },
  sucessoSub: { fontSize: 14, color: C.cinza3, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  ajudeCard: { width: '100%', borderWidth: 1, borderColor: C.cinza2, borderRadius: 12, padding: 18, marginTop: 32 },
  ajudeTitulo: { fontSize: 15, fontWeight: '700', color: C.preto, marginBottom: 8 },
  ajudeTxt: { fontSize: 13, color: C.cinza3, lineHeight: 19, marginBottom: 16 },
  ajudeSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ajudeSwitchTxt: { flex: 1, fontSize: 13, color: C.preto, fontWeight: '500' },
  btnConcluido: { width: '100%', backgroundColor: C.azul, borderRadius: 26, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  btnConcluidoTxt: { color: C.branco, fontWeight: '700', fontSize: 15 },
});