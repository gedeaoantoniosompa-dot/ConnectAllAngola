/**
 * app/(main)/completar-perfil-recrutador.jsx — ConnectAll Angola
 *
 * ── UNIFICAÇÃO (edição de perfil + verificação) ──
 * Este ecrã passou a acumular DUAS funções que antes estavam separadas:
 *
 *  1) EDITAR PERFIL — novo passo 'dados', com os campos pessoais que já
 *     existem em my-profile-recrutador.jsx (nome, data de nascimento,
 *     género, nacionalidade, telefone, e-mail, "Sobre" e redes sociais).
 *     É pré-preenchido com o `perfil` atual (useUser) e grava com
 *     `guardarPerfil(...)`, sem passar pelo fluxo de registo/OTP.
 *
 *  2) COMPLETAR PERFIL — os passos 'identidade' e 'profissional' que já
 *     existiam aqui (verificação de identidade + dados profissionais),
 *     inalterados.
 *
 * O botão "Editar perfil" em my-profile-recrutador.jsx deve agora apontar
 * para esta rota com o parâmetro `passoInicial=dados`:
 *
 *   router.push({
 *     pathname: '/(main)/completar-perfil-recrutador',
 *     params: { passoInicial: 'dados' },
 *   });
 *
 * Se chegares aqui sem esse parâmetro (ex.: a partir do fluxo normal de
 * "completar perfil"), o ecrã continua a abrir no passo 'intro', tal como
 * antes. A partir do 'intro', o cartão "Dados Pessoais" deixou de estar
 * bloqueado — está sempre disponível para editar.
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SeletorDataNascimento from '../../components/SeletorDataNascimento';
import { UploadBtnComPreview, useVisualizador } from '../../components/VisualizadorFicheiro';
import { app, auth, db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const C = {
  azul:       '#0A66C2',
  azulEscuro: '#004182',
  azulClaro:  '#E8F0FB',
  branco:     '#FFFFFF',
  preto:      '#000000',
  cinza1:     '#F3F2EE',
  cinza2:     '#E0DDD8',
  cinza3:     '#666360',
  cinza4:     '#1B1B1B',
  verde:      '#057642',
  vermelho:   '#CC1016',
};

// Ajusta aqui se a tua coleção de utilizadores tiver outro nome
// (ex.: 'usuarios', 'perfis'). O documento é sempre indexado pelo uid.
const COLECAO_UTILIZADORES = 'users';

const GENEROS        = ['Masculino', 'Feminino', 'Prefiro não dizer'];
const NACIONALIDADES = [
  'Angolana', 'Portuguesa', 'Brasileira', 'Sul-Africana', 'Congolesa',
  'Zambiana', 'Namibiana', 'Moçambicana', 'Cabo-Verdiana', 'Outra',
];
const TIPOS_DOC_ID   = ['Bilhete de Identidade', 'Passaporte', 'Cartão de Residência'];
const AREAS_RH = [
  'Talent Acquisition', 'Recrutamento e Seleção', 'Recursos Humanos',
  'Gestão de Pessoas', 'Desenvolvimento Organizacional',
  'Compensação e Benefícios', 'Relações Laborais',
  'Treinamento e Desenvolvimento', 'Outro',
];
const SETORES = [
  'Petróleo e Gás', 'Banca e Finanças', 'Telecomunicações', 'Saúde',
  'Educação', 'Construção Civil', 'Tecnologia', 'Comércio e Retalho',
  'Logística e Transporte', 'Agricultura', 'Energia',
  'Consultoria', 'Indústria', 'Administração Pública', 'Outro',
];
const TIPOS_DOC_PROF = [
  'Cartão de Funcionário', 'Declaração da Empresa',
  'Credencial Profissional', 'Contrato de Trabalho',
  'Documento de Afetação ao RH',
];

function Campo({ label, obrigatorio, children }) {
  return (
    <View style={s.campo}>
      <Text style={s.campoLabel}>
        {label}
        {obrigatorio && <Text style={{ color: C.azul }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function InputLinha({ value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, editable, multiline }) {
  return (
    <View style={[s.inputLinha, multiline && { alignItems: 'flex-start', paddingTop: 8 }]}>
      <TextInput
        style={[s.inputTexto, multiline && { minHeight: 70 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.cinza3}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'sentences'}
        maxLength={maxLength}
        editable={editable !== false}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function Selector({ valor, placeholder, onPress }) {
  return (
    <TouchableOpacity style={s.selector} onPress={onPress}>
      <Text style={[s.selectorTxt, !valor && { color: C.cinza3 }]}>
        {valor || placeholder}
      </Text>
      <Feather name="chevron-down" size={16} color={C.azul} />
    </TouchableOpacity>
  );
}

function ModalLista({ visivel, titulo, lista, valor, onSelect, onFechar }) {
  const [pesquisa, setPesquisa] = useState('');
  const filtrados = lista.filter(i => i.toLowerCase().includes(pesquisa.toLowerCase()));
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>{titulo}</Text>
            <TouchableOpacity onPress={onFechar}>
              <Ionicons name="close" size={22} color={C.cinza4} />
            </TouchableOpacity>
          </View>
          <View style={s.modalBusca}>
            <Feather name="search" size={15} color={C.cinza3} />
            <TextInput
              style={s.modalBuscaInput}
              placeholder="Pesquisar..."
              placeholderTextColor={C.cinza3}
              value={pesquisa}
              onChangeText={setPesquisa}
            />
          </View>
          <ScrollView>
            {filtrados.map(item => (
              <TouchableOpacity
                key={item}
                style={s.modalItem}
                onPress={() => { onSelect(item); setPesquisa(''); onFechar(); }}
              >
                <Text style={[s.modalItemTxt, valor === item && { color: C.azul, fontWeight: '700' }]}>
                  {item}
                </Text>
                {valor === item && <Ionicons name="checkmark" size={16} color={C.azul} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Editar Perfil + Completar Perfil de Recrutador — ecrã único.
// 'dados' edita os dados pessoais (guardarPerfil). 'identidade' e
// 'profissional' tratam da verificação (updateDoc no Firestore).
// ═══════════════════════════════════════════════════════════════════════════
export default function CompletarPerfilRecrutadorScreen() {
  const router = useRouter();
  const { passoInicial } = useLocalSearchParams();
  const { user, perfil, guardarPerfil } = useUser();
  const { Visualizador } = useVisualizador();

  // 'intro' | 'dados' | 'identidade' | 'profissional' | 'revisao' | 'enviado'
  const [passo, setPasso] = useState(passoInicial === 'dados' ? 'dados' : 'intro');
  const [enviando, setEnviando] = useState(false);
  const [guardandoDados, setGuardandoDados] = useState(false);

  const identidadeJaVerificada = perfil?.identidadeVerificada === true;
  const profissionalJaEnviado  = perfil?.verificacaoProfissionalEnviada === true;

  // ── Dados Pessoais (edição) ──
  const [nome, setNome]                 = useState(perfil?.nome || '');
  const [dataNasc, setDataNasc]         = useState(perfil?.dataNasc || '');
  const [genero, setGenero]             = useState(perfil?.genero || '');
  const [nacionalidade, setNacionalidade] = useState(perfil?.nacionalidade || '');
  const [telefone, setTelefone]         = useState(perfil?.telPrincipal || perfil?.telefone || '');
  const [email, setEmail]               = useState(perfil?.email || perfil?.emailContacto || '');
  const [bio, setBio]                   = useState(perfil?.resumo || perfil?.bio || '');
  const [linkedin, setLinkedin]         = useState(perfil?.linkedin || '');
  const [github, setGithub]             = useState(perfil?.github || '');
  const [behance, setBehance]           = useState(perfil?.behance || '');
  const [website, setWebsite]           = useState(perfil?.website || '');
  const [modalGenero, setModalGenero]           = useState(false);
  const [modalNacionalidade, setModalNacionalidade] = useState(false);

  // Sincroniza os campos assim que o perfil carrega/atualiza (ex.: chegada
  // direta a este ecrã antes do useUser ter os dados prontos).
  useEffect(() => {
    if (!perfil) return;
    setNome(perfil.nome || '');
    setDataNasc(perfil.dataNasc || '');
    setGenero(perfil.genero || '');
    setNacionalidade(perfil.nacionalidade || '');
    setTelefone(perfil.telPrincipal || perfil.telefone || '');
    setEmail(perfil.email || perfil.emailContacto || '');
    setBio(perfil.resumo || perfil.bio || '');
    setLinkedin(perfil.linkedin || '');
    setGithub(perfil.github || '');
    setBehance(perfil.behance || '');
    setWebsite(perfil.website || '');
  }, [perfil?.nome, perfil?.dataNasc, perfil?.genero, perfil?.nacionalidade, perfil?.telPrincipal, perfil?.telefone, perfil?.email, perfil?.emailContacto, perfil?.resumo, perfil?.bio, perfil?.linkedin, perfil?.github, perfil?.behance, perfil?.website]);

  // ── Identidade ──
  const [tipoDocId, setTipoDocId] = useState('');
  const [numDocId, setNumDocId] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [dataValidade, setDataValidade] = useState('');
  const [frenteUri, setFrenteUri] = useState(null);
  const [versoUri, setVersoUri] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [identidadeConfirmada, setIdentidadeConfirmada] = useState(false);
  const [verificacaoFacialEmCurso, setVerificacaoFacialEmCurso] = useState(false);
  const [similaridadeFacial, setSimilaridadeFacial] = useState(null);
  const [modalTipoDocId, setModalTipoDocId] = useState(false);

  // ── Profissional ──
  const [empresa, setEmpresa] = useState('');
  const [cargo, setCargo] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [dataEntrada, setDataEntrada] = useState('');
  const [emailCorp, setEmailCorp] = useState('');
  const [codigoEmail, setCodigoEmail] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [codigoGerado, setCodigoGerado] = useState('');
  const [areaRH, setAreaRH] = useState('');
  const [setor, setSetor] = useState('');
  const [anosExp, setAnosExp] = useState('');
  const [tipoDocProf, setTipoDocProf] = useState('');
  const [numDocProf, setNumDocProf] = useState('');
  const [docProfUri, setDocProfUri] = useState(null);
  const [selfieProfUri, setSelfieProfUri] = useState(null);
  const [modalAreaRH, setModalAreaRH] = useState(false);
  const [modalSetor, setModalSetor] = useState(false);
  const [modalTipoDocProf, setModalTipoDocProf] = useState(false);

  const escolherFoto = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const tirarSelfie = async (setter) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, allowsEditing: true, aspect: [3, 4], quality: 0.8 });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const iniciarVerificacaoFacial = async () => {
    if (!frenteUri) {
      Alert.alert('Documento necessário', 'Faz upload da frente do documento primeiro.');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Sessão expirada', 'Faz login novamente.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    if (r.canceled) return;

    setSelfieUri(r.assets[0].uri);
    setVerificacaoFacialEmCurso(true);
    setIdentidadeConfirmada(false);
    setSimilaridadeFacial(null);

    try {
      const toBase64 = async (uri) => {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      };
      const selfieB64 = await toBase64(r.assets[0].uri);
      const documentoB64 = await toBase64(frenteUri);

      const functions = getFunctions(app, 'europe-west1');
      const verificarFacialFn = httpsCallable(functions, 'verificarFacial');
      const resposta = await verificarFacialFn({ selfie: selfieB64, documento: documentoB64, uid: currentUser.uid });
      const { aprovado, similaridade, mensagem } = resposta.data;
      setSimilaridadeFacial(similaridade);

      if (aprovado) {
        setIdentidadeConfirmada(true);
      } else {
        Alert.alert('Verificação falhou', mensagem, [{ text: 'Tentar novamente', onPress: () => setSelfieUri(null) }]);
      }
    } catch (err) {
      console.error('Erro verificação:', err);
      Alert.alert('Erro', 'Não foi possível completar a verificação. Tenta novamente.');
      setSelfieUri(null);
    } finally {
      setVerificacaoFacialEmCurso(false);
    }
  };

  const enviarCodigoEmail = async () => {
    if (!emailCorp.includes('@')) {
      Alert.alert('Email inválido', 'Introduz um email corporativo válido.');
      return;
    }
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    setCodigoGerado(codigo);
    setCodigoEnviado(true);
    Alert.alert('Código enviado', `Código enviado para ${emailCorp}\n\n(Desenvolvimento: ${codigo})`);
  };

  const verificarCodigo = () => {
    if (codigoEmail.trim() === codigoGerado) {
      setEmailVerificado(true);
      Alert.alert('✓ Verificado', 'E-mail corporativo confirmado!');
    } else {
      Alert.alert('Código inválido', 'O código introduzido não corresponde. Tenta novamente.');
    }
  };

  // ── Validação e gravação dos Dados Pessoais ──
  const validarDados = () => {
    if (!nome.trim())                          { Alert.alert('Campo obrigatório', 'Introduz o teu nome completo.'); return false; }
    if (!dataNasc.trim())                      { Alert.alert('Campo obrigatório', 'Introduz a data de nascimento.'); return false; }
    if (!nacionalidade)                        { Alert.alert('Campo obrigatório', 'Seleciona a tua nacionalidade.'); return false; }
    if (!telefone.trim())                      { Alert.alert('Campo obrigatório', 'Introduz o teu número de telefone.'); return false; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Campo obrigatório', 'Introduz um e-mail válido.'); return false; }
    return true;
  };

  const guardarDadosPessoais = async () => {
    if (!validarDados()) return;
    setGuardandoDados(true);
    try {
      await guardarPerfil({
        nome: nome.trim(),
        dataNasc,
        genero,
        nacionalidade,
        telPrincipal: telefone.trim(),
        email: email.trim(),
        resumo: bio.trim(),
        linkedin: linkedin.trim(),
        github: github.trim(),
        behance: behance.trim(),
        website: website.trim(),
      });
      Alert.alert('✓ Guardado', 'Os teus dados pessoais foram atualizados.');
      // Se veio diretamente do botão "Editar perfil" (sem passar pelo
      // 'intro'), volta ao ecrã anterior; caso contrário, regressa ao
      // painel de progresso da verificação.
      if (passoInicial === 'dados') {
        router.back();
      } else {
        setPasso('intro');
      }
    } catch (e) {
      console.log('Erro ao guardar dados pessoais:', e);
      Alert.alert('Erro', 'Não foi possível guardar as alterações. Tenta novamente.');
    } finally {
      setGuardandoDados(false);
    }
  };

  const validarIdentidade = () => {
    if (!tipoDocId)                                { Alert.alert('Campo obrigatório', 'Seleciona o tipo de documento.'); return false; }
    if (!numDocId.trim())                          { Alert.alert('Campo obrigatório', 'Introduz o número do documento.'); return false; }
    if (!dataEmissao.trim())                       { Alert.alert('Campo obrigatório', 'Introduz a data de emissão.'); return false; }
    if (!dataValidade.trim())                      { Alert.alert('Campo obrigatório', 'Introduz a data de validade.'); return false; }
    if (!frenteUri)                                { Alert.alert('Documento necessário', 'Faz upload da frente do documento.'); return false; }
    if (tipoDocId !== 'Passaporte' && !versoUri)   { Alert.alert('Documento necessário', 'Faz upload do verso do documento.'); return false; }
    if (!identidadeConfirmada)                     { Alert.alert('Verificação facial pendente', 'Conclui a verificação facial (selfie) antes de avançar.'); return false; }
    return true;
  };

  const validarProfissional = () => {
    if (!empresa.trim())     { Alert.alert('Campo obrigatório', 'Introduz o nome da empresa.'); return false; }
    if (!cargo.trim())       { Alert.alert('Campo obrigatório', 'Introduz o teu cargo.'); return false; }
    if (!departamento.trim()){ Alert.alert('Campo obrigatório', 'Introduz o departamento.'); return false; }
    if (!dataEntrada.trim()) { Alert.alert('Campo obrigatório', 'Introduz a data de entrada.'); return false; }
    if (!areaRH)              { Alert.alert('Campo obrigatório', 'Seleciona a área de RH.'); return false; }
    if (!setor)                { Alert.alert('Campo obrigatório', 'Seleciona o setor de atuação.'); return false; }
    if (!anosExp.trim())     { Alert.alert('Campo obrigatório', 'Introduz os anos de experiência.'); return false; }
    if (!tipoDocProf)        { Alert.alert('Documento necessário', 'Seleciona o tipo de documento profissional.'); return false; }
    if (!docProfUri)         { Alert.alert('Documento necessário', 'Faz upload do documento profissional.'); return false; }
    if (!selfieProfUri)      { Alert.alert('Selfie necessária', 'Realiza a selfie com o documento.'); return false; }
    return true;
  };

  const submeterVerificacao = async () => {
    if (!user) return;
    if (!validarIdentidade() || !validarProfissional()) { setPasso('identidade'); return; }
    setEnviando(true);
    try {
      await updateDoc(doc(db, COLECAO_UTILIZADORES, user.uid), {
        identidade: {
          tipoDocId, numDocId, dataEmissao, dataValidade,
          frenteUri, versoUri, selfieUri,
          similaridadeFacial: similaridadeFacial ?? null,
        },
        identidadeVerificada: true,
        dadosProfissionais: {
          empresa, cargo, departamento, dataEntrada,
          emailCorp: emailCorp || null,
          emailCorpVerificado: emailVerificado,
          areaRH, setor, anosExp,
          tipoDocProf, numDocProf: numDocProf || null,
          docProfUri, selfieProfUri,
        },
        verificacaoProfissionalEnviada: true,
        statusVerificacaoRecrutador: 'em_analise',
        verificacaoEnviadaEm: serverTimestamp(),
      });
      setPasso('enviado');
    } catch (e) {
      console.log('Erro ao submeter verificação:', e);
      Alert.alert('Erro', 'Não foi possível enviar a tua verificação. Tenta novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ECRÃ: INTRODUÇÃO / ESTADO ATUAL
  // ═══════════════════════════════════════════════════════════
  if (passo === 'intro') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerVoltar}>
            <Ionicons name="close" size={24} color={C.cinza4} />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>O teu perfil</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={s.scrollContent}>
          <Text style={s.passoTitulo}>Perfil de recrutador</Text>
          <Text style={s.passoNumero}>
            Edita os teus dados a qualquer momento e completa a verificação para desbloqueares todas as funcionalidades, como publicar vagas.
          </Text>

          {/* Dados pessoais — sempre disponível para editar */}
          <TouchableOpacity style={s.statusCard} onPress={() => setPasso('dados')}>
            <View style={s.statusIconeWrap}>
              <Ionicons name="person-circle-outline" size={22} color={C.azul} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitulo}>Dados pessoais</Text>
              <Text style={s.statusTxt}>Nome, contactos, sobre e redes sociais</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.cinza3} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.statusCard}
            onPress={() => !identidadeJaVerificada && setPasso('identidade')}
            disabled={identidadeJaVerificada}
          >
            <View style={s.statusIconeWrap}>
              <Ionicons
                name={identidadeJaVerificada ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={identidadeJaVerificada ? C.verde : C.cinza3}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitulo}>Verificação de identidade</Text>
              <Text style={s.statusTxt}>{identidadeJaVerificada ? 'Concluído' : 'Documento de identificação + selfie'}</Text>
            </View>
            {!identidadeJaVerificada && <Ionicons name="chevron-forward" size={18} color={C.cinza3} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.statusCard}
            onPress={() => !profissionalJaEnviado && setPasso(identidadeJaVerificada || identidadeConfirmada ? 'profissional' : 'identidade')}
            disabled={profissionalJaEnviado}
          >
            <View style={s.statusIconeWrap}>
              <Ionicons
                name={profissionalJaEnviado ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={profissionalJaEnviado ? C.verde : C.cinza3}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitulo}>Dados profissionais</Text>
              <Text style={s.statusTxt}>{profissionalJaEnviado ? 'Enviado para análise' : 'Empresa, cargo e documento profissional'}</Text>
            </View>
            {!profissionalJaEnviado && <Ionicons name="chevron-forward" size={18} color={C.cinza3} />}
          </TouchableOpacity>

          {!identidadeJaVerificada && !profissionalJaEnviado && (
            <TouchableOpacity style={[s.btnPrimario, { marginTop: 24 }]} onPress={() => setPasso('identidade')}>
              <Text style={s.btnPrimarioTxt}>Começar verificação</Text>
              <Feather name="arrow-right" size={18} color={C.branco} />
            </TouchableOpacity>
          )}

          {(identidadeJaVerificada && profissionalJaEnviado) && (
            <View style={s.avisoCard}>
              <Ionicons name="time-outline" size={16} color="#92400E" />
              <Text style={s.avisoTxt}>A tua verificação está em análise pela equipa ConnectAll. Prazo estimado: 24 a 48 horas úteis.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ECRÃ: ENVIADO
  // ═══════════════════════════════════════════════════════════
  if (passo === 'enviado') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <View style={s.pendenteWrap}>
          <View style={s.pendenteIconeCirculo}>
            <Ionicons name="time-outline" size={52} color={C.azul} />
          </View>
          <Text style={s.pendenteTitulo}>Verificação enviada!</Text>
          <Text style={s.pendenteSubtitulo}>A tua verificação de identidade e dados profissionais está em análise.</Text>

          <View style={s.pendenteCard}>
            <View style={s.pendenteCardLinha}>
              <Feather name="clock" size={16} color={C.azul} />
              <Text style={s.pendenteCardTxt}>Prazo estimado: 24 a 48 horas úteis</Text>
            </View>
            <View style={s.pendenteDivisor} />
            <View style={s.pendenteCardLinha}>
              <Feather name="mail" size={16} color={C.azul} />
              <Text style={s.pendenteCardTxt}>Receberás uma notificação assim que for analisada</Text>
            </View>
          </View>

          <TouchableOpacity style={s.btnPrimario} onPress={() => router.replace('/(main)/feed')}>
            <Ionicons name="home-outline" size={18} color={C.branco} />
            <Text style={s.btnPrimarioTxt}>Ir ao início</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const titulosPassos = {
    dados: 'Editar Perfil',
    identidade: 'Verificação de Identidade',
    profissional: 'Dados Profissionais',
    revisao: 'Revisão e Envio',
  };

  const voltarDoPasso = () => {
    if (passo === 'dados') {
      // Se chegou diretamente via "Editar perfil", volta ao ecrã anterior;
      // caso contrário, volta ao painel de progresso.
      if (passoInicial === 'dados') router.back();
      else setPasso('intro');
      return;
    }
    if (passo === 'identidade')   { setPasso('intro'); return; }
    if (passo === 'profissional') { setPasso('identidade'); return; }
    if (passo === 'revisao')      { setPasso('profissional'); return; }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
      <View style={s.header}>
        <TouchableOpacity onPress={voltarDoPasso} style={s.headerVoltar}>
          <Ionicons name="chevron-back" size={24} color={C.azul} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>{titulosPassos[passo]}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ════ DADOS PESSOAIS (edição) ════ */}
          {passo === 'dados' && (
            <View>
              <Text style={s.seccaoTitulo}>Informações Pessoais</Text>
              <Campo label="Nome Completo" obrigatorio>
                <InputLinha value={nome} onChangeText={setNome} placeholder="O teu nome completo" />
              </Campo>
              <Campo label="Data de Nascimento" obrigatorio>
                <SeletorDataNascimento value={dataNasc} onChange={setDataNasc} placeholder="Selecionar data" />
              </Campo>
              <Campo label="Género">
                <Selector valor={genero} placeholder="Selecionar (opcional)" onPress={() => setModalGenero(true)} />
              </Campo>
              <Campo label="Nacionalidade" obrigatorio>
                <Selector valor={nacionalidade} placeholder="Selecionar nacionalidade" onPress={() => setModalNacionalidade(true)} />
              </Campo>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Contactos</Text>
              <Campo label="Número de Telefone" obrigatorio>
                <View style={s.inputLinha}>
                  <Text style={s.prefixoTxt}>+244</Text>
                  <TextInput
                    style={[s.inputTexto, { flex: 1 }]}
                    value={telefone}
                    onChangeText={setTelefone}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor={C.cinza3}
                    keyboardType="phone-pad"
                    maxLength={9}
                  />
                </View>
              </Campo>
              <Campo label="E-mail" obrigatorio>
                <InputLinha
                  value={email}
                  onChangeText={setEmail}
                  placeholder="o.teu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Campo>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Sobre</Text>
              <Campo label="Resumo profissional">
                <InputLinha
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Conta um pouco sobre a tua experiência..."
                  multiline
                  maxLength={300}
                />
              </Campo>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Redes Sociais</Text>
              <Campo label="LinkedIn">
                <InputLinha value={linkedin} onChangeText={setLinkedin} placeholder="https://linkedin.com/in/..." autoCapitalize="none" keyboardType="url" />
              </Campo>
              <Campo label="GitHub">
                <InputLinha value={github} onChangeText={setGithub} placeholder="https://github.com/..." autoCapitalize="none" keyboardType="url" />
              </Campo>
              <Campo label="Behance">
                <InputLinha value={behance} onChangeText={setBehance} placeholder="https://behance.net/..." autoCapitalize="none" keyboardType="url" />
              </Campo>
              <Campo label="Website">
                <InputLinha value={website} onChangeText={setWebsite} placeholder="https://..." autoCapitalize="none" keyboardType="url" />
              </Campo>

              <TouchableOpacity
                style={[s.btnPrimario, { marginTop: 8 }, guardandoDados && { opacity: 0.6 }]}
                onPress={guardarDadosPessoais}
                disabled={guardandoDados}
              >
                {guardandoDados ? (
                  <ActivityIndicator color={C.branco} />
                ) : (
                  <>
                    <Text style={s.btnPrimarioTxt}>Guardar alterações</Text>
                    <Feather name="check" size={18} color={C.branco} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ════ IDENTIDADE ════ */}
          {passo === 'identidade' && (
            <View>
              <Text style={s.seccaoTitulo}>Documento de Identificação</Text>
              <Campo label="Tipo de Documento" obrigatorio>
                <Selector valor={tipoDocId} placeholder="Selecionar tipo" onPress={() => setModalTipoDocId(true)} />
              </Campo>
              <Campo label="Número do Documento" obrigatorio>
                <InputLinha value={numDocId} onChangeText={setNumDocId} placeholder="Ex: 004123456LA041" autoCapitalize="characters" />
              </Campo>
              <View style={s.duasColunasWrap}>
                <View style={{ flex: 1 }}>
                  <Campo label="Data de Emissão" obrigatorio>
                    <InputLinha value={dataEmissao} onChangeText={setDataEmissao} placeholder="DD/MM/AAAA" keyboardType="numeric" />
                  </Campo>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Campo label="Data de Validade" obrigatorio>
                    <InputLinha value={dataValidade} onChangeText={setDataValidade} placeholder="DD/MM/AAAA" keyboardType="numeric" />
                  </Campo>
                </View>
              </View>

              <Text style={s.seccaoSubLabel}>Fotografias do Documento</Text>
              <View style={s.duasColunasWrap}>
                <View style={{ flex: 1 }}>
                  <Text style={s.uploadSubLabel}>Frente *</Text>
                  <UploadBtnComPreview uri={frenteUri} onPress={() => escolherFoto(setFrenteUri)} label="Escolher da galeria" titulo="Frente do Documento" />
                  <TouchableOpacity onPress={() => tirarSelfie(setFrenteUri)} style={s.linkGaleria}>
                    <Text style={s.linkGaleriaTxt}>ou tirar foto agora</Text>
                  </TouchableOpacity>
                </View>
                {tipoDocId !== 'Passaporte' && (
                  <>
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.uploadSubLabel}>Verso *</Text>
                      <UploadBtnComPreview uri={versoUri} onPress={() => escolherFoto(setVersoUri)} label="Escolher da galeria" titulo="Verso do Documento" />
                      <TouchableOpacity onPress={() => tirarSelfie(setVersoUri)} style={s.linkGaleria}>
                        <Text style={s.linkGaleriaTxt}>ou tirar foto agora</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Verificação Facial</Text>
              <Text style={s.seccaoDescricao}>Tira uma selfie para confirmarmos que corresponde ao documento enviado.</Text>

              <View style={s.selfieArea}>
                {selfieUri ? (
                  <View style={s.selfiePreviewWrap}>
                    <Image source={{ uri: selfieUri }} style={s.selfiePreview} />
                  </View>
                ) : (
                  <View style={s.selfieVazioBg}>
                    <Ionicons name="person-circle-outline" size={56} color={C.cinza3} />
                    <Text style={s.selfieVazioTxt}>Ainda sem selfie</Text>
                  </View>
                )}

                {identidadeConfirmada && (
                  <View style={s.badgeConfirmado}>
                    <Ionicons name="checkmark-circle" size={16} color={C.verde} />
                    <Text style={s.badgeConfirmadoTxt}>
                      Identidade confirmada{similaridadeFacial != null ? ` (${similaridadeFacial.toFixed(1)}%)` : ''}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.btnCapturarSelfie, verificacaoFacialEmCurso && { opacity: 0.6 }]}
                  onPress={iniciarVerificacaoFacial}
                  disabled={verificacaoFacialEmCurso}
                >
                  {verificacaoFacialEmCurso ? (
                    <ActivityIndicator color={C.branco} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={20} color={C.branco} />
                      <Text style={s.btnCapturarSelfieTxt}>{identidadeConfirmada ? 'Repetir verificação' : 'Iniciar verificação facial'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.btnPrimario, { marginTop: 8 }]}
                onPress={() => validarIdentidade() && setPasso('profissional')}
              >
                <Text style={s.btnPrimarioTxt}>Continuar</Text>
                <Feather name="arrow-right" size={18} color={C.branco} />
              </TouchableOpacity>
            </View>
          )}

          {/* ════ PROFISSIONAL ════ */}
          {passo === 'profissional' && (
            <View>
              <Text style={s.seccaoTitulo}>Dados da Empresa Atual</Text>
              <Campo label="Nome da Empresa" obrigatorio>
                <InputLinha value={empresa} onChangeText={setEmpresa} placeholder="Ex: Unitel" />
              </Campo>
              <Campo label="Cargo" obrigatorio>
                <InputLinha value={cargo} onChangeText={setCargo} placeholder="Ex: Especialista de Recrutamento" />
              </Campo>
              <Campo label="Departamento" obrigatorio>
                <InputLinha value={departamento} onChangeText={setDepartamento} placeholder="Ex: Recursos Humanos" />
              </Campo>
              <Campo label="Data de Entrada" obrigatorio>
                <InputLinha value={dataEntrada} onChangeText={setDataEntrada} placeholder="DD/MM/AAAA" keyboardType="numeric" />
              </Campo>

              <Campo label="E-mail Corporativo">
                <View style={s.emailCorpWrap}>
                  <TextInput
                    style={[s.inputTexto, { flex: 1 }]}
                    value={emailCorp}
                    onChangeText={setEmailCorp}
                    placeholder="rh@empresa.com (opcional)"
                    placeholderTextColor={C.cinza3}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!emailVerificado}
                  />
                  {emailVerificado ? (
                    <View style={s.emailVerificadoBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={C.verde} />
                      <Text style={s.emailVerificadoTxt}>Verificado</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.btnVerificarEmail, !emailCorp && { opacity: 0.4 }]}
                      onPress={enviarCodigoEmail}
                      disabled={!emailCorp}
                    >
                      <Text style={s.btnVerificarEmailTxt}>Verificar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {codigoEnviado && !emailVerificado && (
                  <View style={s.codigoInputWrap}>
                    <TextInput
                      style={s.codigoInput}
                      value={codigoEmail}
                      onChangeText={setCodigoEmail}
                      placeholder="Código de 6 dígitos"
                      placeholderTextColor={C.cinza3}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                    <TouchableOpacity style={s.btnConfirmarCodigo} onPress={verificarCodigo}>
                      <Text style={s.btnConfirmarCodigoTxt}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Campo>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Dados Profissionais</Text>
              <Campo label="Área de RH" obrigatorio>
                <Selector valor={areaRH} placeholder="Selecionar área" onPress={() => setModalAreaRH(true)} />
              </Campo>
              <Campo label="Setor de Atuação" obrigatorio>
                <Selector valor={setor} placeholder="Selecionar setor" onPress={() => setModalSetor(true)} />
              </Campo>
              <Campo label="Anos de Experiência em RH" obrigatorio>
                <InputLinha value={anosExp} onChangeText={setAnosExp} placeholder="Ex: 5" keyboardType="numeric" maxLength={2} />
              </Campo>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Documento Profissional</Text>
              <Text style={s.seccaoDescricao}>Faz upload de pelo menos um documento que comprove o teu vínculo com a área de RH.</Text>
              <Campo label="Tipo de Documento" obrigatorio>
                <Selector valor={tipoDocProf} placeholder="Selecionar tipo" onPress={() => setModalTipoDocProf(true)} />
              </Campo>
              <Campo label="Número do Documento">
                <InputLinha value={numDocProf} onChangeText={setNumDocProf} placeholder="Opcional" />
              </Campo>
              <Text style={s.uploadSubLabel}>Upload do Documento *</Text>
              <UploadBtnComPreview uri={docProfUri} onPress={() => escolherFoto(setDocProfUri)} label="Selecionar documento (imagem)" titulo="Documento Profissional" />

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Selfie de Verificação</Text>
              <Text style={s.seccaoDescricao}>Tira uma selfie segurando o documento profissional enviado.</Text>
              <View style={s.selfieArea}>
                {selfieProfUri ? (
                  <Image source={{ uri: selfieProfUri }} style={[s.selfiePreview, { width: '100%', height: 180 }]} />
                ) : (
                  <View style={s.selfieVazioBg}>
                    <Ionicons name="person-circle-outline" size={56} color={C.cinza3} />
                    <Text style={s.selfieVazioTxt}>Segura o documento junto ao rosto</Text>
                  </View>
                )}
                <TouchableOpacity style={s.btnCapturarSelfie} onPress={() => tirarSelfie(setSelfieProfUri)}>
                  <Ionicons name="camera-outline" size={20} color={C.branco} />
                  <Text style={s.btnCapturarSelfieTxt}>{selfieProfUri ? 'Repetir selfie' : 'Tirar selfie com documento'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.btnPrimario, { marginTop: 8 }]}
                onPress={() => validarProfissional() && setPasso('revisao')}
              >
                <Text style={s.btnPrimarioTxt}>Rever e enviar</Text>
                <Feather name="arrow-right" size={18} color={C.branco} />
              </TouchableOpacity>
            </View>
          )}

          {/* ════ REVISÃO ════ */}
          {passo === 'revisao' && (
            <View>
              <Text style={s.revisaoDescricao}>Revê as informações antes de submeter. Podes editar qualquer secção.</Text>

              <View style={s.revisaoSecao}>
                <View style={s.revisaoSecaoHeader}>
                  <Text style={s.revisaoSecaoTitulo}>Identidade</Text>
                  <TouchableOpacity onPress={() => setPasso('identidade')}><Text style={s.revisaoEditarTxt}>Editar</Text></TouchableOpacity>
                </View>
                {[
                  ['Tipo de Documento', tipoDocId], ['Número', numDocId],
                  ['Emissão', dataEmissao], ['Validade', dataValidade],
                  ['Frente', frenteUri ? '✓ Enviado' : '✗ Em falta'],
                  ['Verso', tipoDocId === 'Passaporte' ? 'N/A' : versoUri ? '✓ Enviado' : '✗ Em falta'],
                  ['Verificação Facial', identidadeConfirmada ? `✓ Confirmada (${similaridadeFacial?.toFixed(1)}%)` : '✗ Pendente'],
                ].map(([k, v]) => (
                  <View key={k} style={s.revisaoLinha}>
                    <Text style={s.revisaoChave}>{k}</Text>
                    <Text style={[s.revisaoValor, v?.includes('✓') && { color: C.verde }, v?.includes('✗') && { color: C.vermelho }]}>{v}</Text>
                  </View>
                ))}
              </View>

              <View style={s.revisaoSecao}>
                <View style={s.revisaoSecaoHeader}>
                  <Text style={s.revisaoSecaoTitulo}>Dados Profissionais</Text>
                  <TouchableOpacity onPress={() => setPasso('profissional')}><Text style={s.revisaoEditarTxt}>Editar</Text></TouchableOpacity>
                </View>
                {[
                  ['Empresa', empresa], ['Cargo', cargo],
                  ['Departamento', departamento], ['Data de Entrada', dataEntrada],
                  ['E-mail Corporativo', emailCorp || '—'],
                  ['Email Verificado', emailVerificado ? '✓ Sim' : '—'],
                  ['Área de RH', areaRH], ['Setor', setor],
                  ['Anos de Experiência', anosExp],
                  ['Doc. Profissional', docProfUri ? '✓ Enviado' : '✗ Em falta'],
                  ['Selfie Profissional', selfieProfUri ? '✓ Enviado' : '✗ Em falta'],
                ].map(([k, v]) => (
                  <View key={k} style={s.revisaoLinha}>
                    <Text style={s.revisaoChave}>{k}</Text>
                    <Text style={[s.revisaoValor, v?.includes('✓') && { color: C.verde }, v?.includes('✗') && { color: C.vermelho }]}>{v}</Text>
                  </View>
                ))}
              </View>

              <View style={s.declaracoesWrap}>
                <Text style={s.declaracoesTitulo}>Confirmação obrigatória</Text>
                <View style={s.checkboxLinha}>
                  <View style={[s.checkbox, { borderColor: C.azul }]}>
                    <Ionicons name="checkmark" size={14} color={C.azul} />
                  </View>
                  <Text style={s.checkboxTxt}>Declaro que todas as informações submetidas são verdadeiras e atualizadas.</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.btnPrimario, enviando && { opacity: 0.6 }]}
                onPress={submeterVerificacao}
                disabled={enviando}
              >
                {enviando ? (
                  <ActivityIndicator color={C.branco} />
                ) : (
                  <>
                    <Text style={s.btnPrimarioTxt}>Submeter para Verificação</Text>
                    <Feather name="send" size={17} color={C.branco} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalLista visivel={modalGenero}        titulo="Género"                         lista={GENEROS}        valor={genero}        onSelect={setGenero}        onFechar={() => setModalGenero(false)} />
      <ModalLista visivel={modalNacionalidade} titulo="Nacionalidade"                  lista={NACIONALIDADES} valor={nacionalidade} onSelect={setNacionalidade} onFechar={() => setModalNacionalidade(false)} />
      <ModalLista visivel={modalTipoDocId}     titulo="Tipo de Documento"              lista={TIPOS_DOC_ID}   valor={tipoDocId}   onSelect={setTipoDocId}   onFechar={() => setModalTipoDocId(false)} />
      <ModalLista visivel={modalAreaRH}        titulo="Área de RH"                     lista={AREAS_RH}       valor={areaRH}       onSelect={setAreaRH}       onFechar={() => setModalAreaRH(false)} />
      <ModalLista visivel={modalSetor}         titulo="Setor de Atuação"               lista={SETORES}        valor={setor}        onSelect={setSetor}        onFechar={() => setModalSetor(false)} />
      <ModalLista visivel={modalTipoDocProf}   titulo="Tipo de Documento Profissional" lista={TIPOS_DOC_PROF} valor={tipoDocProf}  onSelect={setTipoDocProf}  onFechar={() => setModalTipoDocProf(false)} />

      {Visualizador}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.branco },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  headerVoltar: { padding: 4 },
  headerTitulo: { fontSize: 16, fontWeight: '800', color: C.preto },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  passoTitulo:  { fontSize: 24, fontWeight: '900', color: C.preto, lineHeight: 30, marginBottom: 8 },
  passoNumero:  { fontSize: 13, color: C.cinza3, marginBottom: 24, lineHeight: 19 },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 12, padding: 14, marginBottom: 12 },
  statusIconeWrap: { width: 24, alignItems: 'center' },
  statusTitulo: { fontSize: 14, fontWeight: '700', color: C.preto },
  statusTxt: { fontSize: 12, color: C.cinza3, marginTop: 2 },
  avisoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FCD34D', marginTop: 12 },
  avisoTxt: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },

  campo:      { marginBottom: 20 },
  campoLabel: { fontSize: 14, fontWeight: '600', color: C.cinza4, marginBottom: 6 },
  inputLinha: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: C.cinza2, paddingVertical: 6 },
  inputTexto: { flex: 1, fontSize: 15, color: C.preto, paddingVertical: 6 },
  prefixoTxt: { fontSize: 15, color: C.preto, fontWeight: '600', marginRight: 8 },
  selector:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: C.cinza2, paddingVertical: 12 },
  selectorTxt: { flex: 1, fontSize: 15, color: C.preto },
  uploadSubLabel: { fontSize: 13, color: C.cinza4, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  linkGaleria:    { alignItems: 'center', marginTop: 4 },
  linkGaleriaTxt: { fontSize: 11, color: C.azul, textDecorationLine: 'underline' },
  seccaoTitulo:   { fontSize: 17, fontWeight: '800', color: C.preto, marginTop: 8, marginBottom: 4 },
  seccaoSubLabel: { fontSize: 14, fontWeight: '700', color: C.cinza4, marginTop: 12, marginBottom: 8 },
  seccaoDescricao:{ fontSize: 13, color: C.cinza3, lineHeight: 19, marginBottom: 16 },
  seccaoDivisor:  { height: 1, backgroundColor: C.cinza2, marginVertical: 20 },
  selfieArea:        { marginBottom: 16 },
  selfiePreviewWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  selfiePreview:     { width: 120, height: 120, borderRadius: 10, borderWidth: 1, borderColor: C.cinza2 },
  selfieVazioBg:     { height: 120, backgroundColor: C.cinza1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  selfieVazioTxt:    { fontSize: 12, color: C.cinza3, textAlign: 'center' },
  btnCapturarSelfie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.azul, borderRadius: 8, paddingVertical: 12 },
  btnCapturarSelfieTxt: { fontSize: 14, fontWeight: '700', color: C.branco },
  badgeConfirmado:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EAF6EF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
  badgeConfirmadoTxt:{ fontSize: 13, fontWeight: '700', color: C.verde },
  emailCorpWrap:      { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: C.cinza2, paddingVertical: 4 },
  btnVerificarEmail:  { backgroundColor: C.azul, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  btnVerificarEmailTxt: { fontSize: 12, fontWeight: '700', color: C.branco },
  emailVerificadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emailVerificadoTxt: { fontSize: 12, fontWeight: '700', color: C.verde },
  codigoInputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  codigoInput:        { flex: 1, borderWidth: 1.5, borderColor: C.azul, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, letterSpacing: 4, textAlign: 'center', color: C.preto },
  btnConfirmarCodigo: { backgroundColor: C.azulEscuro, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnConfirmarCodigoTxt: { fontSize: 13, fontWeight: '700', color: C.branco },
  duasColunasWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  revisaoDescricao:   { fontSize: 13, color: C.cinza3, marginBottom: 20, lineHeight: 18 },
  revisaoSecao:       { borderWidth: 1, borderColor: C.cinza2, borderRadius: 10, marginBottom: 16, overflow: 'hidden' },
  revisaoSecaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.cinza1, paddingHorizontal: 14, paddingVertical: 12 },
  revisaoSecaoTitulo: { fontSize: 14, fontWeight: '800', color: C.preto },
  revisaoEditarTxt:   { fontSize: 13, color: C.azul, fontWeight: '700' },
  revisaoLinha:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: C.cinza2 },
  revisaoChave:       { fontSize: 13, color: C.cinza3, flex: 1 },
  revisaoValor:       { fontSize: 13, fontWeight: '600', color: C.preto, flex: 1, textAlign: 'right' },
  declaracoesWrap:  { backgroundColor: C.cinza1, borderRadius: 10, padding: 16, marginBottom: 20 },
  declaracoesTitulo:{ fontSize: 13, fontWeight: '700', color: C.cinza4, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  checkboxLinha:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  checkbox:         { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxTxt:      { flex: 1, fontSize: 13, color: C.cinza4, lineHeight: 19 },
  btnPrimario:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.azul, borderRadius: 28, paddingVertical: 16, marginTop: 8 },
  btnPrimarioTxt: { fontSize: 16, fontWeight: '700', color: C.branco },

  pendenteWrap:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  pendenteIconeCirculo:{ width: 100, height: 100, borderRadius: 50, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.azul, marginBottom: 24 },
  pendenteTitulo:      { fontSize: 24, fontWeight: '800', color: C.preto, textAlign: 'center', marginBottom: 8 },
  pendenteSubtitulo:   { fontSize: 15, color: C.cinza3, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  pendenteCard:        { width: '100%', borderWidth: 1, borderColor: C.cinza2, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  pendenteCardLinha:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  pendenteCardTxt:     { fontSize: 13, color: C.cinza4, flex: 1, lineHeight: 19 },
  pendenteDivisor:     { height: 1, backgroundColor: C.cinza2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: C.branco, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 36 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  modalTitulo:  { fontSize: 16, fontWeight: '800', color: C.preto },
  modalBusca:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cinza1, marginHorizontal: 20, marginTop: 12, marginBottom: 6, paddingHorizontal: 12, borderRadius: 8, height: 40, borderWidth: 1, borderColor: C.cinza2 },
  modalBuscaInput: { flex: 1, fontSize: 14, color: C.preto },
  modalItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.cinza1 },
  modalItemTxt: { fontSize: 14, color: C.cinza4, fontWeight: '500' },
});