/**
 * completar-perfil-empresa.jsx — ConnectAll Angola
 * Acessível a qualquer momento a partir do perfil da empresa, depois do
 * registo curto (profile-empresa.jsx). Cobre o que ficou por preencher:
 * logótipo, localização/contactos extra, redes sociais, documentos legais
 * e a verificação de identidade do responsável.
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app, auth, db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const COLECAO_UTILIZADORES = 'users'; // ajusta se a tua coleção tiver outro nome

const SETORES_EMPRESA = [
  'Petróleo e Gás', 'Banca e Finanças', 'Telecomunicações', 'Saúde e Farmácia',
  'Educação e Formação', 'Construção Civil e Imobiliária', 'Tecnologia e Software',
  'Comércio e Retalho', 'Logística e Transporte', 'Agricultura e Agronegócio',
  'Energia e Recursos Naturais', 'Consultoria e Serviços', 'Indústria e Manufatura',
  'Media e Comunicação', 'Turismo e Hotelaria', 'Administração Pública',
  'ONG e Setor Social', 'Outro',
].sort((a, b) => a.localeCompare(b));
const DIMENSOES = ['1–10 colaboradores', '11–50 colaboradores', '51–200 colaboradores', '201–500 colaboradores', '501–1000 colaboradores', 'Mais de 1000 colaboradores'];
const PAISES = ['Angola', 'Portugal', 'Brasil', 'Moçambique', 'Cabo Verde', 'São Tomé e Príncipe', 'Outro'];
const PROVINCIAS_ANGOLA = ['Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cunene', 'Huambo', 'Huíla', 'Kuando Kubango', 'Kwanza Norte', 'Kwanza Sul', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Namibe', 'Uíge', 'Zaire'];
const TIPOS_DOC_ID = [{ id: 'bi', label: 'Bilhete de Identidade' }, { id: 'passaporte', label: 'Passaporte' }];

function Campo({ label, obrigatorio, dica, children }) {
  return (
    <View style={s.campo}>
      <Text style={s.campoLabel}>{label}{obrigatorio ? ' *' : ''}</Text>
      {children}
      {dica ? <Text style={s.campoDica}>{dica}</Text> : null}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline, numberOfLines, maxLength }) {
  return (
    <TextInput
      style={[s.input, multiline && { height: numberOfLines ? numberOfLines * 22 + 20 : 80, textAlignVertical: 'top', paddingTop: 10 }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#999"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize || 'sentences'}
      multiline={multiline}
      maxLength={maxLength}
    />
  );
}

function SelectorModal({ visivel, onFechar, titulo, dados, selecionado, onSelecionar, pesquisavel }) {
  const [pesq, setPesq] = useState('');
  const filtrados = pesquisavel ? dados.filter(d => d.toLowerCase().includes(pesq.toLowerCase())) : dados;
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>{titulo}</Text>
            <TouchableOpacity onPress={onFechar} style={s.modalFechar}>
              <Ionicons name="close" size={20} color="#333" />
            </TouchableOpacity>
          </View>
          {pesquisavel && (
            <View style={s.modalSearch}>
              <Feather name="search" size={14} color="#999" />
              <TextInput style={s.modalSearchInput} placeholder="Pesquisar..." value={pesq} onChangeText={setPesq} />
            </View>
          )}
          <FlatList
            data={filtrados}
            keyExtractor={i => i}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.modalItem} onPress={() => { onSelecionar(item); onFechar(); setPesq(''); }}>
                <Text style={[s.modalItemTxt, selecionado === item && s.modalItemTxtActivo]}>{item}</Text>
                {selecionado === item && <Ionicons name="checkmark" size={16} color="#0A66C2" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function UploadDoc({ valor, onSelecionar, titulo, descricao, obrigatorio }) {
  const escolher = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
    if (!r.canceled) onSelecionar(r.assets[0]);
  };
  const tirarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (!r.canceled) onSelecionar(r.assets[0]);
  };
  return (
    <View style={s.uploadWrap}>
      <View style={s.uploadHeader}>
        <Text style={s.uploadTitulo}>{titulo}{obrigatorio ? ' *' : ''}</Text>
        {valor && <TouchableOpacity onPress={() => onSelecionar(null)}><Text style={s.uploadRemover}>Remover</Text></TouchableOpacity>}
      </View>
      {descricao ? <Text style={s.uploadDesc}>{descricao}</Text> : null}
      {valor ? (
        <View style={s.uploadPreview}>
          <Image source={{ uri: valor.uri }} style={s.uploadImg} />
          <View style={s.uploadOk}>
            <Ionicons name="checkmark-circle" size={18} color="#057642" />
            <Text style={s.uploadOkTxt}>Documento anexado</Text>
          </View>
        </View>
      ) : (
        <View style={s.uploadBotoes}>
          <TouchableOpacity style={s.uploadBtn} onPress={escolher}>
            <Ionicons name="images-outline" size={16} color="#0A66C2" />
            <Text style={s.uploadBtnTxt}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.uploadBtn} onPress={tirarFoto}>
            <Ionicons name="camera-outline" size={16} color="#0A66C2" />
            <Text style={s.uploadBtnTxt}>Câmara</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function CompletarPerfilEmpresaScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();

  // 'intro' | 'empresa' | 'documentos' | 'responsavel' | 'revisao' | 'enviado'
  const [passo, setPasso] = useState('intro');
  const [enviando, setEnviando] = useState(false);

  const documentosJaEnviados = perfil?.documentosEnviados === true;
  const responsavelJaVerificado = perfil?.identidadeResponsavelVerificada === true;

  // ── Empresa (dados adicionais) ──
  const [logoLocal, setLogoLocal] = useState(null);
  const [registoComercial, setRegistoComercial] = useState('');
  const [dimensao, setDimensao] = useState('');
  const [anoFundacao, setAnoFundacao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [missao, setMissao] = useState('');
  const [pais, setPais] = useState('Angola');
  const [provincia, setProvincia] = useState('');
  const [endereco, setEndereco] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [emailCorporativo, setEmailCorporativo] = useState('');
  const [website, setWebsite] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [youtube, setYoutube] = useState('');
  const [modalSetorExtra, setModalSetorExtra] = useState(false); // não usado, setor já vem do registo
  const [modalDimensao, setModalDimensao] = useState(false);
  const [modalPais, setModalPais] = useState(false);
  const [modalProvincia, setModalProvincia] = useState(false);

  // ── Documentos ──
  const [docLogo, setDocLogo] = useState(null);
  const [docRegisto, setDocRegisto] = useState(null);
  const [certidaoComercial, setCertidaoComercial] = useState(null);
  const [alvara, setAlvara] = useState(null);
  const [licencaAtividade, setLicencaAtividade] = useState(null);
  const [declaracaoInicio, setDeclaracaoInicio] = useState(null);
  const [estatutos, setEstatutos] = useState(null);

  // ── Responsável / identidade ──
  const [tipoDocId, setTipoDocId] = useState('bi');
  const [docIdFrente, setDocIdFrente] = useState(null);
  const [docIdVerso, setDocIdVerso] = useState(null);
  const [passeEmpresa, setPasseEmpresa] = useState(null);
  const [selfieResponsavel, setSelfieResponsavel] = useState(null);
  const [verificacaoFacialEmCurso, setVerificacaoFacialEmCurso] = useState(false);
  const [identidadeConfirmada, setIdentidadeConfirmada] = useState(false);
  const [similaridadeFacial, setSimilaridadeFacial] = useState(null);

  const iniciarVerificacaoResponsavel = async () => {
    if (!docIdFrente) { Alert.alert('Documento necessário', 'Faz upload da frente do documento primeiro.'); return; }
    const currentUser = auth.currentUser;
    if (!currentUser) { Alert.alert('Sessão expirada', 'Faz login novamente.'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara.'); return; }
    const r = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    if (r.canceled) return;

    setSelfieResponsavel(r.assets[0]);
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
      const [selfieB64, docB64] = await Promise.all([toBase64(r.assets[0].uri), toBase64(docIdFrente.uri)]);
      const functions = getFunctions(app, 'europe-west1');
      const verificarDocumentoEmpresaFn = httpsCallable(functions, 'verificarDocumentoEmpresa');
      const resposta = await verificarDocumentoEmpresaFn({ selfie: selfieB64, docFrente: docB64, uid: currentUser.uid });
      const { aprovado, similaridade, mensagem } = resposta.data;
      setSimilaridadeFacial(similaridade);
      if (aprovado) setIdentidadeConfirmada(true);
      else Alert.alert('Verificação falhou', mensagem, [{ text: 'Tentar novamente', onPress: () => setSelfieResponsavel(null) }]);
    } catch (err) {
      console.error('Erro verificação:', err);
      Alert.alert('Erro', 'Não foi possível completar a verificação. Tenta novamente.');
      setSelfieResponsavel(null);
    } finally {
      setVerificacaoFacialEmCurso(false);
    }
  };

  const validarDocumentos = () => {
    if (!docRegisto)        { Alert.alert('Documento obrigatório', 'Anexa o Registo Comercial.'); return false; }
    if (!certidaoComercial) { Alert.alert('Documento obrigatório', 'Anexa a Certidão Comercial.'); return false; }
    if (!licencaAtividade)  { Alert.alert('Documento obrigatório', 'Anexa a Licença de Atividade.'); return false; }
    return true;
  };

  const validarResponsavel = () => {
    if (!docIdFrente)          { Alert.alert('Documento necessário', 'Faz upload da frente do documento do responsável.'); return false; }
    if (!identidadeConfirmada) { Alert.alert('Verificação facial pendente', 'Conclui a verificação facial (selfie) antes de avançar.'); return false; }
    return true;
  };

  const submeterVerificacao = async () => {
    if (!user) return;
    if (!validarDocumentos()) { setPasso('documentos'); return; }
    if (!validarResponsavel()) { setPasso('responsavel'); return; }
    setEnviando(true);
    try {
      await updateDoc(doc(db, COLECAO_UTILIZADORES, user.uid), {
        dadosEmpresaExtra: {
          registoComercial, dimensao, anoFundacao, descricao, missao,
          pais, provincia, endereco, whatsapp, emailCorporativo, website,
          redesSociais: { facebook, instagram, linkedin, twitter, youtube },
        },
        documentos: {
          docLogoUri: docLogo?.uri || null,
          docRegistoUri: docRegisto?.uri || null,
          certidaoComercialUri: certidaoComercial?.uri || null,
          alvaraUri: alvara?.uri || null,
          licencaAtividadeUri: licencaAtividade?.uri || null,
          declaracaoInicioUri: declaracaoInicio?.uri || null,
          estatutosUri: estatutos?.uri || null,
        },
        documentosEnviados: true,
        responsavelIdentidade: {
          tipoDocId,
          docIdFrenteUri: docIdFrente?.uri || null,
          docIdVersoUri: docIdVerso?.uri || null,
          passeEmpresaUri: passeEmpresa?.uri || null,
          selfieUri: selfieResponsavel?.uri || null,
          similaridadeFacial: similaridadeFacial ?? null,
        },
        identidadeResponsavelVerificada: true,
        statusVerificacaoEmpresa: 'em_analise',
        verificacaoEnviadaEm: serverTimestamp(),
      });
      setPasso('enviado');
    } catch (e) {
      console.log('Erro ao submeter verificação da empresa:', e);
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
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerVoltar}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Completar perfil</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={s.passoWrap}>
          <Text style={s.passoTitulo}>Aprimora o perfil da empresa</Text>
          <Text style={s.passoSub}>
            A conta já está ativa. Completa estes passos para desbloqueares todas as funcionalidades, como publicar vagas.
          </Text>

          <View style={s.statusCard}>
            <Ionicons name="checkmark-circle" size={22} color="#057642" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.statusTitulo}>Dados básicos</Text>
              <Text style={s.statusTxt}>Concluído no registo</Text>
            </View>
          </View>

          <TouchableOpacity style={s.statusCard} onPress={() => !documentosJaEnviados && setPasso('empresa')} disabled={documentosJaEnviados}>
            <Ionicons name={documentosJaEnviados ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={documentosJaEnviados ? '#057642' : '#999'} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.statusTitulo}>Perfil e documentos legais</Text>
              <Text style={s.statusTxt}>{documentosJaEnviados ? 'Enviado' : 'Logótipo, redes sociais e documentos da empresa'}</Text>
            </View>
            {!documentosJaEnviados && <Ionicons name="chevron-forward" size={18} color="#999" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.statusCard}
            onPress={() => !responsavelJaVerificado && setPasso(documentosJaEnviados ? 'responsavel' : 'empresa')}
            disabled={responsavelJaVerificado}
          >
            <Ionicons name={responsavelJaVerificado ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={responsavelJaVerificado ? '#057642' : '#999'} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.statusTitulo}>Identidade do responsável</Text>
              <Text style={s.statusTxt}>{responsavelJaVerificado ? 'Verificado' : 'Documento de identificação + selfie'}</Text>
            </View>
            {!responsavelJaVerificado && <Ionicons name="chevron-forward" size={18} color="#999" />}
          </TouchableOpacity>

          {!documentosJaEnviados && !responsavelJaVerificado && (
            <TouchableOpacity style={[s.btnPrimario, { marginTop: 24 }]} onPress={() => setPasso('empresa')}>
              <Text style={s.btnPrimarioTxt}>Começar</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {documentosJaEnviados && responsavelJaVerificado && (
            <View style={s.avisoCard}>
              <Ionicons name="time-outline" size={16} color="#92400E" />
              <Text style={s.avisoTxt}>A verificação está em análise pela equipa ConnectAll. Prazo estimado: 48 horas úteis.</Text>
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
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={s.sucessoContainer}>
          <View style={[s.sucessoIconeWrap, { backgroundColor: '#EEF3FB' }]}>
            <Ionicons name="checkmark-circle" size={56} color="#0A66C2" />
          </View>
          <Text style={s.sucessoTitulo}>Verificação enviada!</Text>
          <Text style={s.sucessoSub}>A equipa ConnectAll irá analisar os documentos em até 48 horas úteis.</Text>
          <View style={s.sucessoAviso}>
            <Ionicons name="information-circle-outline" size={16} color="#0A66C2" />
            <Text style={s.sucessoAvisoTxt}>Receberás uma notificação assim que a verificação da empresa for concluída.</Text>
          </View>
          <TouchableOpacity style={[s.btnPrimario, { marginTop: 24, width: '100%' }]} onPress={() => router.replace('/(main)/feed')}>
            <Ionicons name="home-outline" size={18} color="#fff" />
            <Text style={s.btnPrimarioTxt}>Ir ao início</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const titulosPasso = { empresa: 'Perfil da Empresa', documentos: 'Documentos Legais', responsavel: 'Verificação do Responsável', revisao: 'Revisão e Envio' };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => setPasso(passo === 'empresa' ? 'intro' : passo === 'documentos' ? 'empresa' : passo === 'responsavel' ? 'documentos' : 'responsavel')}
          style={s.headerVoltar}
        >
          <Feather name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>{titulosPasso[passo]}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* ════ EMPRESA (logo, extra, contactos, redes sociais) ════ */}
          {passo === 'empresa' && (
            <View style={s.passoWrap}>
              <View style={s.logoSection}>
                <TouchableOpacity style={s.logoWrap} onPress={async () => {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') return;
                  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
                  if (!r.canceled) setLogoLocal(r.assets[0]);
                }}>
                  {logoLocal?.uri || perfil?.fotoURL ? (
                    <Image source={{ uri: logoLocal?.uri || perfil?.fotoURL }} style={s.logoImg} />
                  ) : (
                    <View style={s.logoPlaceholder}><Ionicons name="business-outline" size={28} color="#999" /></View>
                  )}
                  <View style={s.logoEditar}><Feather name="camera" size={11} color="#fff" /></View>
                </TouchableOpacity>
                <Text style={s.logoDica}>Logótipo da empresa</Text>
              </View>

              <Campo label="Nº Registo Comercial" dica="Número do registo na Conservatória">
                <Input value={registoComercial} onChangeText={setRegistoComercial} placeholder="Ex: RC-LDA-2023-00001" />
              </Campo>
              <Campo label="Dimensão">
                <TouchableOpacity style={s.selectorBtn} onPress={() => setModalDimensao(true)}>
                  <Text style={[s.selectorTxt, !dimensao && { color: '#999' }]}>{dimensao || 'Número de colaboradores'}</Text>
                  <Feather name="chevron-down" size={16} color="#999" />
                </TouchableOpacity>
              </Campo>
              <Campo label="Ano de fundação">
                <Input value={anoFundacao} onChangeText={setAnoFundacao} placeholder="Ex: 2010" keyboardType="numeric" />
              </Campo>
              <Campo label="Descrição da empresa">
                <Input value={descricao} onChangeText={setDescricao} placeholder="Produtos, serviços, cultura..." multiline numberOfLines={4} maxLength={500} />
                <Text style={s.contador}>{descricao.length}/500</Text>
              </Campo>
              <Campo label="Missão e valores">
                <Input value={missao} onChangeText={setMissao} placeholder="Missão e valores da empresa..." multiline numberOfLines={3} maxLength={300} />
              </Campo>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Localização e Contactos Extra</Text>
              <Campo label="País">
                <TouchableOpacity style={s.selectorBtn} onPress={() => setModalPais(true)}>
                  <Text style={[s.selectorTxt, !pais && { color: '#999' }]}>{pais || 'Selecionar país'}</Text>
                  <Feather name="chevron-down" size={16} color="#999" />
                </TouchableOpacity>
              </Campo>
              {pais === 'Angola' && (
                <Campo label="Província">
                  <TouchableOpacity style={s.selectorBtn} onPress={() => setModalProvincia(true)}>
                    <Text style={[s.selectorTxt, !provincia && { color: '#999' }]}>{provincia || 'Selecionar província'}</Text>
                    <Feather name="chevron-down" size={16} color="#999" />
                  </TouchableOpacity>
                </Campo>
              )}
              <Campo label="Endereço da sede">
                <Input value={endereco} onChangeText={setEndereco} placeholder="Rua, número, bairro..." multiline numberOfLines={2} />
              </Campo>
              <Campo label="WhatsApp empresarial">
                <Input value={whatsapp} onChangeText={setWhatsapp} placeholder="+244 9XX XXX XXX" keyboardType="phone-pad" />
              </Campo>
              <Campo label="E-mail corporativo" dica="Opcional — ex: info@empresa.ao">
                <Input value={emailCorporativo} onChangeText={setEmailCorporativo} placeholder="info@empresa.com" keyboardType="email-address" autoCapitalize="none" />
              </Campo>
              <Campo label="Website">
                <Input value={website} onChangeText={setWebsite} placeholder="https://www.empresa.com" autoCapitalize="none" />
              </Campo>

              <View style={s.seccaoDivisor} />
              <Text style={s.seccaoTitulo}>Redes Sociais</Text>
              {[
                { label: 'Facebook', valor: facebook, setter: setFacebook, placeholder: 'facebook.com/empresa' },
                { label: 'Instagram', valor: instagram, setter: setInstagram, placeholder: 'instagram.com/empresa' },
                { label: 'LinkedIn', valor: linkedin, setter: setLinkedin, placeholder: 'linkedin.com/company/empresa' },
                { label: 'X (Twitter)', valor: twitter, setter: setTwitter, placeholder: 'x.com/empresa' },
                { label: 'YouTube', valor: youtube, setter: setYoutube, placeholder: 'youtube.com/@empresa' },
              ].map(r => (
                <Campo key={r.label} label={r.label}>
                  <Input value={r.valor} onChangeText={r.setter} placeholder={r.placeholder} autoCapitalize="none" />
                </Campo>
              ))}

              <TouchableOpacity style={[s.btnPrimario, { marginTop: 8 }]} onPress={() => setPasso('documentos')}>
                <Text style={s.btnPrimarioTxt}>Continuar</Text>
                <Feather name="arrow-right" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ════ DOCUMENTOS LEGAIS ════ */}
          {passo === 'documentos' && (
            <View style={s.passoWrap}>
              <Text style={s.passoSub}>Documentos que comprovam a existência e funcionamento legal da empresa.</Text>
              <View style={s.avisoSeguranca}>
                <Ionicons name="lock-closed-outline" size={14} color="#0A66C2" />
                <Text style={s.avisoSegurancaTxt}>Encriptados e usados exclusivamente para verificação.</Text>
              </View>
              <UploadDoc valor={docLogo} onSelecionar={setDocLogo} titulo="Logótipo oficial" descricao="Ficheiro oficial do logótipo (PNG, JPG)" />
              <UploadDoc valor={docRegisto} onSelecionar={setDocRegisto} titulo="Registo Comercial" descricao="Documento do registo na Conservatória" obrigatorio />
              <UploadDoc valor={certidaoComercial} onSelecionar={setCertidaoComercial} titulo="Certidão Comercial atualizada" descricao="Emitida há menos de 6 meses" obrigatorio />
              <UploadDoc valor={licencaAtividade} onSelecionar={setLicencaAtividade} titulo="Licença de atividade" descricao="Emitida pela entidade reguladora" obrigatorio />
              <UploadDoc valor={alvara} onSelecionar={setAlvara} titulo="Alvará de funcionamento" descricao="Quando aplicável" />
              <UploadDoc valor={declaracaoInicio} onSelecionar={setDeclaracaoInicio} titulo="Declaração de início de atividade" descricao="Opcional" />
              <UploadDoc valor={estatutos} onSelecionar={setEstatutos} titulo="Estatutos da empresa" descricao="Opcional" />

              <TouchableOpacity style={[s.btnPrimario, { marginTop: 8 }]} onPress={() => validarDocumentos() && setPasso('responsavel')}>
                <Text style={s.btnPrimarioTxt}>Continuar</Text>
                <Feather name="arrow-right" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ════ RESPONSÁVEL / IDENTIDADE ════ */}
          {passo === 'responsavel' && (
            <View style={s.passoWrap}>
              <Text style={s.passoSub}>A pessoa responsável por esta conta deve confirmar a sua identidade.</Text>

              <Text style={s.campoLabel}>Tipo de documento *</Text>
              <View style={s.tiposDocRow}>
                {TIPOS_DOC_ID.map(t => (
                  <TouchableOpacity key={t.id} style={[s.tipoDocBtn, tipoDocId === t.id && s.tipoDocBtnActivo]} onPress={() => setTipoDocId(t.id)}>
                    <Text style={[s.tipoDocTxt, tipoDocId === t.id && { color: '#0A66C2', fontWeight: '700' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <UploadDoc valor={docIdFrente} onSelecionar={setDocIdFrente} titulo={tipoDocId === 'bi' ? 'Frente do Bilhete de Identidade' : 'Frente do Passaporte'} descricao="Foto clara e legível" obrigatorio />
              <UploadDoc valor={docIdVerso} onSelecionar={setDocIdVerso} titulo="Verso do documento" descricao="Opcional para Passaporte" />
              <UploadDoc valor={passeEmpresa} onSelecionar={setPasseEmpresa} titulo="Passe / Credencial da empresa" descricao="Opcional" />

              <Text style={s.uploadTitulo}>Selfie de verificação *</Text>
              <Text style={s.uploadDesc}>Obrigatório para concluir a validação — segura o documento junto ao rosto</Text>

              <View style={s.selfieArea}>
                {selfieResponsavel ? (
                  <View style={s.selfiePreviewWrap}>
                    <Image source={{ uri: selfieResponsavel.uri }} style={s.selfiePreview} />
                  </View>
                ) : (
                  <View style={s.selfieVazioBg}>
                    <Ionicons name="person-circle-outline" size={56} color="#999" />
                    <Text style={s.selfieVazioTxt}>Nenhuma selfie capturada</Text>
                  </View>
                )}

                {identidadeConfirmada && similaridadeFacial !== null && (
                  <View style={s.badgeConfirmado}>
                    <Ionicons name="checkmark-circle" size={18} color="#057642" />
                    <Text style={s.badgeConfirmadoTxt}>✓ Responsável Verificado — {similaridadeFacial.toFixed(1)}%</Text>
                  </View>
                )}

                {!identidadeConfirmada && (
                  <TouchableOpacity
                    style={[s.btnCapturarSelfie, (verificacaoFacialEmCurso || !docIdFrente) && { opacity: 0.5 }]}
                    onPress={iniciarVerificacaoResponsavel}
                    disabled={verificacaoFacialEmCurso || !docIdFrente}
                  >
                    {verificacaoFacialEmCurso ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={20} color="#fff" />
                        <Text style={s.btnCapturarSelfieTxt}>{selfieResponsavel ? 'Repetir verificação facial' : 'Iniciar verificação facial'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={[s.btnPrimario, { marginTop: 8 }]} onPress={() => validarResponsavel() && setPasso('revisao')}>
                <Text style={s.btnPrimarioTxt}>Rever e enviar</Text>
                <Feather name="arrow-right" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ════ REVISÃO ════ */}
          {passo === 'revisao' && (
            <View style={s.passoWrap}>
              <Text style={s.passoSub}>Revê os dados antes de submeter para análise.</Text>

              {[
                { titulo: 'Empresa', linhas: [['Registo Comercial', registoComercial || '—'], ['Dimensão', dimensao || '—'], ['Ano', anoFundacao || '—']] },
                { titulo: 'Sede', linhas: [['País', pais], ['Província', provincia || '—'], ['Endereço', endereco || '—']] },
                { titulo: 'Documentos', linhas: [['Registo Comercial', docRegisto ? '✓ Enviado' : '✗ Em falta'], ['Certidão Comercial', certidaoComercial ? '✓ Enviado' : '✗ Em falta'], ['Licença de Atividade', licencaAtividade ? '✓ Enviado' : '✗ Em falta']] },
                { titulo: 'Responsável', linhas: [['Documento', docIdFrente ? '✓ Enviado' : '✗ Em falta'], ['Verificação Facial', identidadeConfirmada ? `✓ Confirmada (${similaridadeFacial?.toFixed(1)}%)` : '✗ Pendente']] },
              ].map(sec => (
                <View key={sec.titulo} style={s.revisaoSec}>
                  <Text style={s.revisaoSecTitulo}>{sec.titulo}</Text>
                  {sec.linhas.map(([k, v]) => (
                    <View key={k} style={s.revisaoLinha}>
                      <Text style={s.revisaoKey}>{k}</Text>
                      <Text style={[s.revisaoVal, v?.includes?.('✓') && { color: '#057642' }, v?.includes?.('✗') && { color: '#CC1016' }]}>{v}</Text>
                    </View>
                  ))}
                </View>
              ))}

              <View style={s.avisoSeguranca}>
                <Ionicons name="time-outline" size={14} color="#0A66C2" />
                <Text style={s.avisoSegurancaTxt}>Análise em até 48 horas úteis.</Text>
              </View>

              <TouchableOpacity style={[s.btnPrimario, { marginTop: 16 }, enviando && { opacity: 0.6 }]} onPress={submeterVerificacao} disabled={enviando}>
                {enviando ? <ActivityIndicator color="#fff" size="small" /> : (
                  <><Text style={s.btnPrimarioTxt}>Submeter para Verificação</Text><Feather name="send" size={17} color="#fff" /></>
                )}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <SelectorModal visivel={modalDimensao} onFechar={() => setModalDimensao(false)} titulo="Dimensão" dados={DIMENSOES} selecionado={dimensao} onSelecionar={setDimensao} />
      <SelectorModal visivel={modalPais} onFechar={() => setModalPais(false)} titulo="País" dados={PAISES} selecionado={pais} onSelecionar={setPais} />
      <SelectorModal visivel={modalProvincia} onFechar={() => setModalProvincia(false)} titulo="Província" dados={PROVINCIAS_ANGOLA} selecionado={provincia} onSelecionar={setProvincia} pesquisavel />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  headerVoltar: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitulo: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  passoWrap: { paddingHorizontal: 20, paddingTop: 20 },
  passoTitulo: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  passoSub: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20 },

  statusCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.3, borderColor: '#E8E8E8', borderRadius: 12, padding: 14, marginBottom: 12 },
  statusTitulo: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  statusTxt: { fontSize: 12, color: '#666', marginTop: 2 },
  avisoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FCD34D', marginTop: 12 },
  avisoTxt: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },

  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoWrap: { position: 'relative' },
  logoImg: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8' },
  logoPlaceholder: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#F3F6F8', borderWidth: 1, borderColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center' },
  logoEditar: { position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#0A66C2', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  logoDica: { fontSize: 12, color: '#999', marginTop: 8 },

  campo: { marginBottom: 20 },
  campoLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  campoDica: { fontSize: 12, color: '#999', marginTop: 4 },
  contador: { fontSize: 11, color: '#999', textAlign: 'right', marginTop: 3 },
  input: { borderBottomWidth: 1.5, borderBottomColor: '#E8E8E8', fontSize: 15, color: '#1A1A1A', paddingVertical: 8 },
  selectorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: '#E8E8E8', paddingVertical: 10 },
  selectorTxt: { flex: 1, fontSize: 15, color: '#1A1A1A' },

  seccaoTitulo: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  seccaoDivisor: { height: 1, backgroundColor: '#E8E8E8', marginVertical: 20 },

  uploadWrap: { marginBottom: 20 },
  uploadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  uploadTitulo: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  uploadRemover: { fontSize: 12, color: '#CC1016' },
  uploadDesc: { fontSize: 12, color: '#999', marginBottom: 8 },
  uploadPreview: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E8E8E8' },
  uploadImg: { width: '100%', height: 120, borderRadius: 8 },
  uploadOk: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#E8F5EE' },
  uploadOkTxt: { fontSize: 12, color: '#057642', fontWeight: '600' },
  uploadBotoes: { flexDirection: 'row', gap: 10 },
  uploadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#0A66C2', borderRadius: 4, paddingVertical: 10, backgroundColor: '#EEF3FB' },
  uploadBtnTxt: { fontSize: 13, color: '#0A66C2', fontWeight: '600' },

  avisoSeguranca: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF3FB', padding: 12, borderRadius: 4, marginBottom: 20 },
  avisoSegurancaTxt: { flex: 1, fontSize: 12, color: '#0A66C2', lineHeight: 17 },

  tiposDocRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: 8 },
  tipoDocBtn: { flex: 1, paddingVertical: 10, borderRadius: 4, borderWidth: 1.5, borderColor: '#E8E8E8', alignItems: 'center', backgroundColor: '#F3F6F8' },
  tipoDocBtnActivo: { borderColor: '#0A66C2', backgroundColor: '#EEF3FB' },
  tipoDocTxt: { fontSize: 13, color: '#666' },

  selfieArea: { marginBottom: 16, marginTop: 10 },
  selfiePreviewWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  selfiePreview: { width: 100, height: 100, borderRadius: 10, borderWidth: 1, borderColor: '#E8E8E8' },
  selfieVazioBg: { height: 120, backgroundColor: '#F3F6F8', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  selfieVazioTxt: { fontSize: 12, color: '#999', textAlign: 'center' },
  btnCapturarSelfie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0A66C2', borderRadius: 8, paddingVertical: 12 },
  btnCapturarSelfieTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  badgeConfirmado: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5EE', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
  badgeConfirmadoTxt: { fontSize: 13, fontWeight: '700', color: '#057642' },

  revisaoSec: { borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  revisaoSecTitulo: { fontSize: 11, fontWeight: '700', color: '#0A66C2', letterSpacing: 0.5, textTransform: 'uppercase', padding: 10, backgroundColor: '#EEF3FB' },
  revisaoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  revisaoKey: { fontSize: 13, color: '#666' },
  revisaoVal: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', flex: 1, textAlign: 'right' },

  btnPrimario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0A66C2', borderRadius: 24, paddingVertical: 14 },
  btnPrimarioTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  sucessoContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  sucessoIconeWrap: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  sucessoTitulo: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', textAlign: 'center', marginBottom: 12 },
  sucessoSub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  sucessoAviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, padding: 14, width: '100%', backgroundColor: '#EEF3FB' },
  sucessoAvisoTxt: { flex: 1, fontSize: 13, color: '#0A66C2', lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E8E8E8', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitulo: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  modalFechar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F6F8', justifyContent: 'center', alignItems: 'center' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F6F8', marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 12, borderRadius: 4, height: 40, borderWidth: 1, borderColor: '#E8E8E8' },
  modalSearchInput: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalItemTxt: { fontSize: 14, color: '#444' },
  modalItemTxtActivo: { color: '#0A66C2', fontWeight: '700' },
});