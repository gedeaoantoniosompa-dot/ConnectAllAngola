/**
 * profile-empresa.jsx — ConnectAll Angola
 * Versão curta, alinhada com o fluxo do perfil de Utilizador (profile.jsx):
 * a palavra-passe já foi definida em register-email.jsx, por isso aqui só se
 * pedem os dados básicos da empresa. Ao submeter, envia-se o OTP e segue-se
 * direto para verificar-codigo (que cria a conta Firebase) — sem voltar a
 * pedir a palavra-passe.
 *
 * O resto do perfil empresarial (logótipo, redes sociais, documentos legais,
 * identidade do responsável) passa a ser preenchido mais tarde, já dentro da
 * app, no ecrã "completar-perfil-empresa" (ver app/(main)/).
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app, auth, db } from '../../config/firebase';

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

const SETORES_EMPRESA = [
  'Petróleo e Gás', 'Banca e Finanças', 'Telecomunicações', 'Saúde e Farmácia',
  'Educação e Formação', 'Construção Civil e Imobiliária', 'Tecnologia e Software',
  'Comércio e Retalho', 'Logística e Transporte', 'Agricultura e Agronegócio',
  'Energia e Recursos Naturais', 'Consultoria e Serviços', 'Indústria e Manufatura',
  'Media e Comunicação', 'Turismo e Hotelaria', 'Administração Pública',
  'ONG e Setor Social', 'Outro',
].sort((a, b) => a.localeCompare(b));

const ASSUNTOS_SUPORTE = ['Problema técnico', 'Dúvida sobre o registo', 'Outro'];

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

function InputLinha({ value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength }) {
  return (
    <View style={s.inputLinha}>
      <TextInput
        style={s.inputTexto}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.cinza3}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'sentences'}
        maxLength={maxLength}
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
export default function ProfileEmpresaScreen() {
  const router = useRouter();
  const [passo, setPasso] = useState(0); // 0 = termos · 1 = dados básicos
  const [enviando, setEnviando] = useState(false);
  const [modalSuporteVisivel, setModalSuporteVisivel] = useState(false);

  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [setor, setSetor] = useState('');
  const [nif, setNif] = useState('');
  const [telefonePrincipal, setTelefonePrincipal] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [cargoResponsavel, setCargoResponsavel] = useState('');
  const [modalSetor, setModalSetor] = useState(false);

  const [assuntoSuporte, setAssuntoSuporte] = useState('');
  const [mensagemSuporte, setMensagemSuporte] = useState('');
  const [enviadoSuporte, setEnviadoSuporte] = useState(false);
  const [modalAssuntoSuporte, setModalAssuntoSuporte] = useState(false);

  const validarDadosBasicos = () => {
    if (!nomeEmpresa.trim())        { Alert.alert('Campo obrigatório', 'Preenche o nome da empresa.'); return false; }
    if (!setor)                     { Alert.alert('Campo obrigatório', 'Seleciona o setor de atividade.'); return false; }
    if (!nif.trim())                { Alert.alert('Campo obrigatório', 'O NIF da empresa é obrigatório.'); return false; }
    if (!telefonePrincipal.trim())  { Alert.alert('Campo obrigatório', 'Preenche o telefone principal.'); return false; }
    if (!nomeResponsavel.trim())    { Alert.alert('Campo obrigatório', 'Preenche o nome do responsável pela conta.'); return false; }
    if (!cargoResponsavel.trim())   { Alert.alert('Campo obrigatório', 'Preenche o cargo do responsável.'); return false; }
    return true;
  };

  // ════════════════════════════════════════════════════════════════
  // SUBMETER — mesmo fluxo do perfil de Utilizador (profile.jsx):
  // a palavra-passe já foi definida em register-email.jsx. Aqui só se
  // guardam os dados básicos, envia-se o OTP para o email de registo e
  // segue-se direto para verificar-codigo, que cria a conta Firebase.
  // ════════════════════════════════════════════════════════════════
  const submeter = async () => {
    if (!validarDadosBasicos()) return;
    setEnviando(true);
    try {
      const pendenteStr = await AsyncStorage.getItem('_registoPendente');
      const pendente = pendenteStr ? JSON.parse(pendenteStr) : {};

      if (!pendente?.email || !pendente?.password) {
        Alert.alert('Dados em falta', 'Volta ao início do registo e tenta novamente.');
        router.replace('/(auth)/register-email');
        return;
      }

      const emailParaVerificar = pendente.email;

      await AsyncStorage.setItem('_registoPendente', JSON.stringify({
        ...pendente,
        tipoPerfil: 'empresa',
        dadosPerfil: {
          nomeEmpresa: nomeEmpresa.trim(),
          setor,
          nif: nif.trim(),
          telefonePrincipal: telefonePrincipal.trim(),
          emailSuporte: emailParaVerificar, // usa sempre o email do registo
          responsavel: {
            nome: nomeResponsavel.trim(),
            cargo: cargoResponsavel.trim(),
          },
        },
        // O resto do perfil empresarial (logótipo, redes sociais, documentos
        // legais, identidade do responsável) fica por preencher; a empresa
        // completa quando quiser, já na app.
        documentosEnviados: false,
        identidadeResponsavelVerificada: false,
        perfilEmpresaCompleto: false,
      }));

      // ── Envia o OTP agora — primeiro e único envio ──
      try {
        const functions = getFunctions(app, 'europe-west1');
        const enviarCodigo = httpsCallable(functions, 'enviarCodigoEmail');
        await enviarCodigo({ email: emailParaVerificar });
      } catch (otpErr) {
        console.warn('[Empresa OTP]', otpErr?.message);
        Alert.alert(
          'Aviso',
          'Não foi possível enviar o código automaticamente. Poderás pedi-lo novamente no ecrã seguinte.',
          [{ text: 'OK' }]
        );
      }

      router.replace({
        pathname: '/(auth)/verificar-codigo',
        params: { email: emailParaVerificar },
      });
    } catch (e) {
      console.log('ERRO SUBMETER EMPRESA:', e?.code, e?.message);
      Alert.alert('Erro', e?.message || 'Não foi possível continuar.');
    } finally {
      setEnviando(false);
    }
  };

  const enviarSuporte = async () => {
    if (!assuntoSuporte || !mensagemSuporte.trim()) {
      Alert.alert('Campos obrigatórios', 'Seleciona um assunto e escreve uma mensagem.');
      return;
    }
    try {
      const uid = auth.currentUser?.uid;
      await addDoc(collection(db, 'suporte'), {
        uid: uid || 'anonimo',
        assunto: assuntoSuporte,
        mensagem: mensagemSuporte.trim(),
        origem: 'registo-empresa',
        timestamp: serverTimestamp(),
      });
      setEnviadoSuporte(true);
      setTimeout(() => {
        setEnviadoSuporte(false);
        setModalSuporteVisivel(false);
        setAssuntoSuporte('');
        setMensagemSuporte('');
      }, 2500);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // PASSO 0 — TERMOS DE UTILIZAÇÃO
  // ═══════════════════════════════════════════════════════════
  if (passo === 0) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <ScrollView contentContainerStyle={s.termosWrap}>
          <View style={s.logoRow}>
            <Text style={s.logoConnect}>ConnectAll</Text>
            <Text style={s.logoAngola}>Angola</Text>
          </View>

          <View style={s.progressoWrap}>
            <View style={[s.progressoBarra, { width: '0%' }]} />
          </View>
          <View style={s.progressoInfoRow}>
            <Text style={s.progressoLabel}>Registo de Empresa</Text>
            <Text style={s.progressoPerc}>0%</Text>
          </View>

          <Text style={s.passoTitulo}>{'Cria a conta\nda tua Empresa'}</Text>
          <Text style={s.termosSubtitulo}>
            Antes de prosseguir, lê e aceita os Termos e Políticas aplicáveis a empresas na plataforma ConnectAll Angola.
            Depois de criares a conta, poderás completar o logótipo, os documentos legais e a verificação do responsável quando quiseres, diretamente no perfil da empresa.
          </Text>

          {[
            {
              icone: 'shield',
              titulo: 'Responsabilidade de Dados',
              texto: 'Como conta empresarial, terás acesso a candidaturas e dados pessoais de candidatos. Comprometes-te a tratar esses dados com confidencialidade e apenas para fins de recrutamento legítimos.',
            },
            {
              icone: 'business',
              titulo: 'Identidade Verificada',
              texto: 'Todas as informações submetidas devem ser verdadeiras e atualizadas. A submissão de documentos falsos resultará no bloqueio permanente da conta.',
            },
            {
              icone: 'briefcase',
              titulo: 'Uso Profissional',
              texto: 'A plataforma deve ser utilizada exclusivamente para fins de recrutamento, gestão de talentos e apresentação institucional da empresa.',
            },
            {
              icone: 'bell',
              titulo: 'Verificação Progressiva',
              texto: 'Podes começar a explorar a plataforma logo após o registo. Algumas ações — como publicar vagas — só ficam disponíveis depois de completares os documentos legais e a verificação do responsável no perfil da empresa.',
            },
          ].map((bloco, i) => (
            <View key={i} style={s.termosBloco}>
              <View style={s.termosBlocoIcone}>
                <Feather name={bloco.icone} size={18} color={C.azul} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.termosBlocoTitulo}>{bloco.titulo}</Text>
                <Text style={s.termosBlocoTxt}>{bloco.texto}</Text>
              </View>
            </View>
          ))}

          <View style={s.termosLinksWrap}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'termos-empresa' } })}>
              <Text style={s.termosLink}>📄 Termos de Utilização para Empresas</Text>
            </TouchableOpacity>
          </View>

          <View style={s.legalSection}>
            <Text style={s.legalTxt}>
              Ao clicar em aceitar, concordas com os{' '}
              <Text style={s.legalLink} onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'contrato' } })}>
                Termos de Utilização
              </Text>
              {', '}
              <Text style={s.legalLink} onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'privacidade' } })}>
                Política de Privacidade
              </Text>
              {' e a '}
              <Text style={s.legalLink} onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'cookies' } })}>
                Política de Cookies
              </Text>
              {' da ConnectAll Angola.'}
            </Text>
          </View>

          <TouchableOpacity style={s.btnPrimario} onPress={() => setPasso(1)}>
            <Text style={s.btnPrimarioTxt}>Li e aceito os Termos</Text>
            <Feather name="arrow-right" size={18} color={C.branco} />
          </TouchableOpacity>

          <View style={s.separador}>
            <View style={s.separadorLinha} />
            <Text style={s.separadorTxt}>ou</Text>
            <View style={s.separadorLinha} />
          </View>

          <TouchableOpacity style={s.btnSecundarioPill} onPress={() => router.replace('/(auth)/escolher-tipo-perfil')}>
            <Ionicons name="arrow-back" size={18} color={C.cinza4} />
            <Text style={s.btnSecundarioPillTxt}>Voltar</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PASSO 1 — DADOS BÁSICOS (único passo do registo)
  // ═══════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.branco} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => setPasso(0)} style={s.headerVoltar}>
          <Ionicons name="chevron-back" size={24} color={C.azul} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={s.logoRow}>
            <Text style={[s.logoConnect, { fontSize: 16 }]}>ConnectAll</Text>
            <Text style={[s.logoAngola, { fontSize: 16 }]}>Angola</Text>
          </View>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.progressoWrap}>
        <View style={[s.progressoBarra, { width: '100%' }]} />
      </View>
      <View style={s.progressoInfoRow}>
        <Text style={s.progressoLabel}>Dados Básicos</Text>
        <Text style={s.progressoPerc}>Último passo</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.passoTitulo}>Dados da Empresa</Text>
          <Text style={s.passoNumero}>
            Só isto é necessário para criares a conta. Logótipo, documentos legais e a verificação do responsável ficam para depois, no perfil da empresa.
          </Text>

          <Campo label="Nome da Empresa" obrigatorio>
            <InputLinha value={nomeEmpresa} onChangeText={setNomeEmpresa} placeholder="Ex: Unitel S.A." />
          </Campo>
          <Campo label="Setor de Atividade" obrigatorio>
            <Selector valor={setor} placeholder="Selecionar setor" onPress={() => setModalSetor(true)} />
          </Campo>
          <Campo label="NIF" obrigatorio>
            <InputLinha value={nif} onChangeText={setNif} placeholder="Número de Identificação Fiscal" keyboardType="numeric" />
          </Campo>
          <Campo label="Telefone Principal" obrigatorio>
            <View style={s.inputLinha}>
              <Text style={s.prefixoTxt}>+244</Text>
              <TextInput
                style={[s.inputTexto, { flex: 1 }]}
                value={telefonePrincipal}
                onChangeText={setTelefonePrincipal}
                placeholder="9XX XXX XXX"
                placeholderTextColor={C.cinza3}
                keyboardType="phone-pad"
                maxLength={9}
              />
            </View>
          </Campo>

          <View style={s.seccaoDivisor} />
          <Text style={s.seccaoTitulo}>Responsável pela Conta</Text>
          <Campo label="Nome do Responsável" obrigatorio>
            <InputLinha value={nomeResponsavel} onChangeText={setNomeResponsavel} placeholder="Nome de quem gere esta conta" />
          </Campo>
          <Campo label="Cargo do Responsável" obrigatorio>
            <InputLinha value={cargoResponsavel} onChangeText={setCargoResponsavel} placeholder="Ex: Diretor de RH" />
          </Campo>

          <TouchableOpacity
            style={[s.btnPrimario, { marginTop: 24 }, enviando && { opacity: 0.6 }]}
            onPress={submeter}
            disabled={enviando}
          >
            <Text style={s.btnPrimarioTxt}>{enviando ? 'A criar conta...' : 'Criar conta'}</Text>
            {!enviando && <Feather name="arrow-right" size={18} color={C.branco} />}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <TouchableOpacity style={s.suporteBtn} onPress={() => setModalSuporteVisivel(true)}>
        <Ionicons name="help-circle" size={28} color={C.branco} />
      </TouchableOpacity>

      <ModalLista visivel={modalSetor}          titulo="Setor de Atividade" lista={SETORES_EMPRESA} valor={setor} onSelect={setSetor} onFechar={() => setModalSetor(false)} />
      <ModalLista visivel={modalAssuntoSuporte} titulo="Assunto"           lista={ASSUNTOS_SUPORTE} valor={assuntoSuporte} onSelect={setAssuntoSuporte} onFechar={() => setModalAssuntoSuporte(false)} />

      <Modal visible={modalSuporteVisivel} transparent animationType="slide" onRequestClose={() => setModalSuporteVisivel(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Contactar Suporte</Text>
              <TouchableOpacity onPress={() => setModalSuporteVisivel(false)}>
                <Ionicons name="close" size={22} color={C.cinza4} />
              </TouchableOpacity>
            </View>
            {enviadoSuporte ? (
              <View style={s.suporteEnviadoWrap}>
                <Ionicons name="checkmark-circle" size={52} color={C.verde} />
                <Text style={s.suporteEnviadoTitulo}>Mensagem enviada!</Text>
                <Text style={s.suporteEnviadoTxt}>Respondemos em até 24 horas úteis para o teu e-mail.</Text>
              </View>
            ) : (
              <ScrollView style={{ paddingHorizontal: 20 }}>
                <Text style={s.suporteLabel}>Assunto *</Text>
                <Selector valor={assuntoSuporte} placeholder="Selecionar assunto" onPress={() => setModalAssuntoSuporte(true)} />
                <Text style={[s.suporteLabel, { marginTop: 16 }]}>Mensagem *</Text>
                <TextInput
                  style={s.suporteMensagem}
                  value={mensagemSuporte}
                  onChangeText={setMensagemSuporte}
                  placeholder="Descreve o teu problema ou dúvida..."
                  placeholderTextColor={C.cinza3}
                  multiline maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={s.contador}>{mensagemSuporte.length}/500</Text>
                <TouchableOpacity style={[s.btnPrimario, { marginTop: 8, marginBottom: 32 }]} onPress={enviarSuporte}>
                  <Text style={s.btnPrimarioTxt}>Enviar Mensagem</Text>
                  <Feather name="send" size={16} color={C.branco} />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.branco },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  headerVoltar: { padding: 4 },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  logoConnect:{ fontSize: 22, fontWeight: '800', color: C.preto },
  logoAngola: { fontSize: 22, fontWeight: '800', color: C.azul },
  progressoWrap:    { height: 4, backgroundColor: C.cinza2 },
  progressoBarra:   { height: 4, backgroundColor: C.azul },
  progressoInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 6 },
  progressoLabel:   { fontSize: 12, color: C.cinza3, fontWeight: '500' },
  progressoPerc:    { fontSize: 12, color: C.azul, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  passoTitulo:  { fontSize: 28, fontWeight: '900', color: C.preto, lineHeight: 34, marginBottom: 4 },
  passoNumero:  { fontSize: 13, color: C.cinza3, marginBottom: 24, lineHeight: 19 },
  campo:      { marginBottom: 20 },
  campoLabel: { fontSize: 14, fontWeight: '600', color: C.cinza4, marginBottom: 6 },
  inputLinha: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: C.cinza2, paddingVertical: 6 },
  inputTexto: { flex: 1, fontSize: 15, color: C.preto, paddingVertical: 6 },
  prefixoTxt: { fontSize: 15, color: C.preto, fontWeight: '600', marginRight: 8 },
  selector:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: C.cinza2, paddingVertical: 12 },
  selectorTxt: { flex: 1, fontSize: 15, color: C.preto },
  seccaoTitulo:   { fontSize: 17, fontWeight: '800', color: C.preto, marginTop: 8, marginBottom: 4 },
  seccaoDivisor:  { height: 1, backgroundColor: C.cinza2, marginVertical: 20 },
  btnPrimario:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.azul, borderRadius: 28, paddingVertical: 16, marginTop: 8 },
  btnPrimarioTxt: { fontSize: 16, fontWeight: '700', color: C.branco },
  separador:      { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  separadorLinha: { flex: 1, height: 1, backgroundColor: C.cinza2 },
  separadorTxt:   { paddingHorizontal: 14, fontSize: 14, color: C.cinza3, fontWeight: '500' },
  btnSecundarioPill:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 28, paddingVertical: 15, borderWidth: 1.5, borderColor: C.cinza2, backgroundColor: C.branco, marginBottom: 8 },
  btnSecundarioPillTxt: { fontSize: 15, color: C.cinza4, fontWeight: '600' },
  termosWrap:        { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  termosSubtitulo:   { fontSize: 14, color: C.cinza3, lineHeight: 21, marginBottom: 28 },
  termosBloco:       { flexDirection: 'row', gap: 14, marginBottom: 20, padding: 14, backgroundColor: C.cinza1, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: C.azul },
  termosBlocoIcone:  { marginTop: 2 },
  termosBlocoTitulo: { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 4 },
  termosBlocoTxt:    { fontSize: 13, color: C.cinza3, lineHeight: 19 },
  termosLinksWrap:   { gap: 10, marginBottom: 20 },
  termosLink:        { fontSize: 14, color: C.azul, fontWeight: '600', textDecorationLine: 'underline' },
  legalSection: { marginBottom: 20 },
  legalTxt:     { fontSize: 13, color: C.cinza3, lineHeight: 20 },
  legalLink:    { color: C.azul, fontWeight: '600' },
  suporteBtn: { position: 'absolute', bottom: 24, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center', shadowColor: C.azul, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  suporteLabel:   { fontSize: 13, fontWeight: '700', color: C.cinza4, marginTop: 8, marginBottom: 6 },
  suporteMensagem:{ borderWidth: 1.5, borderColor: C.cinza2, borderRadius: 10, padding: 12, fontSize: 14, color: C.preto, height: 120, marginBottom: 4 },
  contador:       { fontSize: 11, color: C.cinza3, textAlign: 'right', marginBottom: 8 },
  suporteEnviadoWrap:  { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 12 },
  suporteEnviadoTitulo:{ fontSize: 20, fontWeight: '800', color: C.preto },
  suporteEnviadoTxt:   { fontSize: 14, color: C.cinza3, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: C.branco, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 36 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  modalTitulo:  { fontSize: 16, fontWeight: '800', color: C.preto },
  modalBusca:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cinza1, marginHorizontal: 20, marginTop: 12, marginBottom: 6, paddingHorizontal: 12, borderRadius: 8, height: 40, borderWidth: 1, borderColor: C.cinza2 },
  modalBuscaInput: { flex: 1, fontSize: 14, color: C.preto },
  modalItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.cinza1 },
  modalItemTxt: { fontSize: 14, color: C.cinza4, fontWeight: '500' },
});