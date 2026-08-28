import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SeletorDataNascimento from '../../components/SeletorDataNascimento';
import { UploadBtnComPreview, useVisualizador } from '../../components/VisualizadorFicheiro';
import { app, auth, db } from '../../config/firebase';
import { uploadFotoPerfil } from '../../config/utils/uploadFoto';
import { useUser } from '../../context/UserContext';

const C = {
  azul:'#0A66C2', azulEscuro:'#004182', azulClaro:'#E8F0FB',
  branco:'#FFFFFF', preto:'#000000', vermelho:'#FF0000',
  cinza1:'#F3F2EE', cinza2:'#E0DDD8', cinza3:'#666360', cinza4:'#1B1B1B',
  verde:'#057642', error:'#CC1016',
};

const GENEROS         = ['Masculino','Feminino','Prefiro não dizer'];
const ESTADOS_CIVIS   = ['Solteiro(a)','Casado(a)','Divorciado(a)','Viúvo(a)','União de Facto'];
const NACIONALIDADES  = ['Angolana','Portuguesa','Brasileira','Sul-Africana','Congolesa','Zambiana','Namibiana','Moçambicana','Cabo-Verdiana','Outra'];
const PROVINCIAS      = ['Bengo','Benguela','Bié','Cabinda','Cuando Cubango','Cuanza Norte','Cuanza Sul','Cunene','Huambo','Huíla','Luanda','Lunda Norte','Lunda Sul','Malanje','Moxico','Namibe','Uíge','Zaire'];
const SITUACOES_PROF  = ['Empregado','Desempregado','Freelancer','Estudante','Disponível para trabalhar imediatamente'];
const DISPONIBILIDADES= ['Imediata','15 dias','30 dias','Mais de 30 dias'];
const GRAUS_ACADEMICOS= ['Ensino Médio','Técnico Médio','Licenciatura','Pós-Graduação','Mestrado','Doutoramento'];
const SETORES         = ['Petróleo e Gás','Banca e Finanças','Telecomunicações','Saúde','Educação','Construção Civil','Tecnologia','Comércio e Retalho','Logística e Transporte','Agricultura','Energia','Consultoria','Indústria','Administração Pública','Outro'];
const IDIOMAS_LISTA   = ['Português','Inglês','Francês','Espanhol','Mandarim','Árabe','Alemão','Outro'];
const NIVEIS_IDIOMA   = ['Básico','Intermédio','Bom','Muito Bom','Excelente','Nativo'];
const COMP_TECNICAS   = ['Excel','Word','PowerPoint','SAP','Primavera','AutoCAD','Programação','Redes','Contabilidade','HSE','Logística','RH'];
const COMP_PESSOAIS   = ['Liderança','Trabalho em Equipa','Comunicação','Resolução de Problemas','Organização','Gestão de Tempo'];

function Campo({ label, obrigatorio, children }) {
  return (
    <View style={s.campo}>
      <Text style={s.campoLabel}>{label}{obrigatorio && <Text style={{color:C.azul}}> *</Text>}</Text>
      {children}
    </View>
  );
}
function InputLinha({ value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, multiline, numberOfLines }) {
  return (
    <View style={[s.inputLinha, multiline && {alignItems:'flex-start',paddingTop:8}]}>
      <TextInput
        style={[s.inputTexto, multiline && {height: numberOfLines ? numberOfLines*22 : 80, textAlignVertical:'top'}]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={C.cinza3} keyboardType={keyboardType}
        autoCapitalize={autoCapitalize||'sentences'} maxLength={maxLength}
        multiline={multiline} numberOfLines={numberOfLines}
      />
    </View>
  );
}
function Selector({ valor, placeholder, onPress }) {
  return (
    <TouchableOpacity style={s.selector} onPress={onPress}>
      <Text style={[s.selectorTxt, !valor && {color:C.cinza3}]}>{valor||placeholder}</Text>
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
            <TouchableOpacity onPress={onFechar}><Ionicons name="close" size={22} color={C.cinza4}/></TouchableOpacity>
          </View>
          <View style={s.modalBusca}>
            <Feather name="search" size={15} color={C.cinza3}/>
            <TextInput style={s.modalBuscaInput} placeholder="Pesquisar..." placeholderTextColor={C.cinza3} value={pesquisa} onChangeText={setPesquisa}/>
          </View>
          <ScrollView>
            {filtrados.map(item => (
              <TouchableOpacity key={item} style={s.modalItem} onPress={() => { onSelect(item); setPesquisa(''); onFechar(); }}>
                <Text style={[s.modalItemTxt, valor===item && {color:C.azul,fontWeight:'700'}]}>{item}</Text>
                {valor===item && <Ionicons name="checkmark" size={16} color={C.azul}/>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user, perfil, guardarPerfil } = useUser();
  const { abrir, Visualizador } = useVisualizador();
  const [enviando, setEnviando] = useState(false);
  const [passoRecuperado, setPassoRecuperado] = useState(false);

  const modoEdicao = params?.voltarPara === 'my-profile' || params?.modoEdicao === 'true';
  const [passo, setPasso] = useState(modoEdicao ? 1 : 0);

  const [fotoLocal, setFotoLocal]           = useState(null);
  const [nome, setNome]                     = useState('');
  const [dataNasc, setDataNasc]             = useState('');
  const [genero, setGenero]                 = useState('');
  const [nacionalidade, setNacionalidade]   = useState('');
  const [estadoCivil, setEstadoCivil]       = useState('');
  const [telPrincipal, setTelPrincipal]     = useState('');
  const [telAlternativo, setTelAlternativo] = useState('');
  const [email, setEmail]                   = useState('');
  const [provincia, setProvincia]           = useState('');
  const [municipio, setMunicipio]           = useState('');
  const [endereco, setEndereco]             = useState('');
  const [tituloProfissional, setTituloProfissional] = useState('');
  const [resumo, setResumo]               = useState('');
  const [situacaoProf, setSituacaoProf]   = useState('');
  const [pretensaoSalarial, setPretensaoSalarial] = useState('');
  const [disponibilidade, setDisponibilidade]     = useState('');
  const [formacoes, setFormacoes]           = useState([]);
  const [formacaoEditando, setFormacaoEditando] = useState(null);
  const [experiencias, setExperiencias]     = useState([]);
  const [expEditando, setExpEditando]       = useState(null);
  const [certificacoes, setCertificacoes]   = useState([]);
  const [certEditando, setCertEditando]     = useState(null);
  const [compTecnicas, setCompTecnicas]     = useState([]);
  const [compPessoais, setCompPessoais]     = useState([]);
  const [idiomas, setIdiomas]               = useState([]);
  const [idiomaEditando, setIdiomaEditando] = useState(null);
  const [uriBilhete, setUriBilhete]         = useState(null);
  const [uriCV, setUriCV]                   = useState(null);
  const [uriCertificados, setUriCertificados] = useState(null);
  const [uriCartaConducao, setUriCartaConducao] = useState(null);
  const [uriPortefolio, setUriPortefolio]   = useState(null);
  const [uriDiploma, setUriDiploma]         = useState(null);
  const [linkedin, setLinkedin]             = useState('');
  const [github, setGithub]                 = useState('');
  const [behance, setBehance]               = useState('');
  const [website, setWebsite]               = useState('');
  const [codigoEmail, setCodigoEmail]           = useState('');
  const [codigoEmailGerado, setCodigoEmailGerado] = useState('');
  const [emailEnviado, setEmailEnviado]         = useState(false);
  const [emailVerificado, setEmailVerificado]   = useState(false);
  const [codigoTel, setCodigoTel]               = useState('');
  const [codigoTelGerado, setCodigoTelGerado]   = useState('');
  const [telEnviado, setTelEnviado]             = useState(false);
  const [telVerificado, setTelVerificado]       = useState(false);

  const [modalGenero, setModalGenero]                 = useState(false);
  const [modalNacionalidade, setModalNacionalidade]   = useState(false);
  const [modalEstadoCivil, setModalEstadoCivil]       = useState(false);
  const [modalProvincia, setModalProvincia]           = useState(false);
  const [modalSituacao, setModalSituacao]             = useState(false);
  const [modalDisponibilidade, setModalDisponibilidade] = useState(false);
  const [modalFormacao, setModalFormacao]             = useState(false);
  const [modalExp, setModalExp]                       = useState(false);
  const [modalCert, setModalCert]                     = useState(false);
  const [modalIdioma, setModalIdioma]                 = useState(false);
  const [modalGrau, setModalGrau]                     = useState(false);
  const [modalSetor, setModalSetor]                   = useState(false);
  const [modalIdiomaItem, setModalIdiomaItem]         = useState(false);
  const [modalNivelLeitura, setModalNivelLeitura]     = useState(false);
  const [modalNivelEscrita, setModalNivelEscrita]     = useState(false);
  const [modalNivelConv, setModalNivelConv]           = useState(false);

  const [tmpFormacao, setTmpFormacao] = useState({ instituicao:'', curso:'', area:'', grau:'', anoInicio:'', anoConclusao:'', emCurso:false });
  const [tmpExp, setTmpExp]           = useState({ empresa:'', cargo:'', setor:'', dataInicio:'', dataFim:'', atual:false, descricao:'', resultados:'' });
  const [tmpCert, setTmpCert]         = useState({ nome:'', instituicao:'', data:'', certificadoUri:null });
  const [tmpIdioma, setTmpIdioma]     = useState({ idioma:'', leitura:'', escrita:'', conversacao:'' });

  useEffect(() => {
    if (!user?.uid) return;
    if (perfil?.perfilCompleto && !modoEdicao) {
      router.replace('/(main)/feed');
      return;
    }
    const chave      = `perfil_rascunho_${user.uid}`;
    const chavePasso = `perfil_passo_${user.uid}`;
    AsyncStorage.multiGet([chave, chavePasso]).then(([[, dadosStr], [, passoStr]]) => {
      const dadosParaCarregar = modoEdicao ? null : dadosStr;
      if (dadosParaCarregar) {
        try {
          const d = JSON.parse(dadosParaCarregar);
          if (d.nome)               setNome(d.nome);
          if (d.dataNasc)           setDataNasc(d.dataNasc);
          if (d.genero)             setGenero(d.genero);
          if (d.nacionalidade)      setNacionalidade(d.nacionalidade);
          if (d.estadoCivil)        setEstadoCivil(d.estadoCivil);
          if (d.telPrincipal)       setTelPrincipal(d.telPrincipal);
          if (d.telAlternativo)     setTelAlternativo(d.telAlternativo);
          if (d.email)              setEmail(d.email);
          if (d.provincia)          setProvincia(d.provincia);
          if (d.municipio)          setMunicipio(d.municipio);
          if (d.endereco)           setEndereco(d.endereco);
          if (d.tituloProfissional) setTituloProfissional(d.tituloProfissional);
          if (d.resumo)             setResumo(d.resumo);
          if (d.situacaoProf)       setSituacaoProf(d.situacaoProf);
          if (d.pretensaoSalarial)  setPretensaoSalarial(d.pretensaoSalarial);
          if (d.disponibilidade)    setDisponibilidade(d.disponibilidade);
          if (d.formacoes?.length)      setFormacoes(d.formacoes);
          if (d.experiencias?.length)   setExperiencias(d.experiencias);
          if (d.certificacoes?.length)  setCertificacoes(d.certificacoes);
          if (d.compTecnicas?.length)   setCompTecnicas(d.compTecnicas);
          if (d.compPessoais?.length)   setCompPessoais(d.compPessoais);
          if (d.idiomas?.length)        setIdiomas(d.idiomas);
          if (d.linkedin)           setLinkedin(d.linkedin);
          if (d.github)             setGithub(d.github);
          if (d.behance)            setBehance(d.behance);
          if (d.website)            setWebsite(d.website);
          if (d.emailVerificado)    setEmailVerificado(d.emailVerificado);
          if (d.telVerificado)      setTelVerificado(d.telVerificado);
        } catch (_) {}
      } else {
        if (perfil?.nome)               setNome(perfil.nome);
        if (perfil?.dataNasc)           setDataNasc(perfil.dataNasc);
        if (perfil?.genero)             setGenero(perfil.genero);
        if (perfil?.nacionalidade)      setNacionalidade(perfil.nacionalidade);
        if (perfil?.estadoCivil)        setEstadoCivil(perfil.estadoCivil);
        if (perfil?.telPrincipal || perfil?.telefone) setTelPrincipal(perfil.telPrincipal || perfil.telefone || '');
        if (perfil?.telAlternativo)     setTelAlternativo(perfil.telAlternativo);
        if (perfil?.emailContacto || perfil?.email) setEmail(perfil.emailContacto || perfil.email || '');
        if (perfil?.provincia)          setProvincia(perfil.provincia);
        if (perfil?.municipio)          setMunicipio(perfil.municipio);
        if (perfil?.endereco)           setEndereco(perfil.endereco);
        if (perfil?.tituloProfissional || perfil?.cargo) setTituloProfissional(perfil.tituloProfissional || perfil.cargo || '');
        if (perfil?.resumo || perfil?.bio) setResumo(perfil.resumo || perfil.bio || '');
        if (perfil?.situacaoProf)       setSituacaoProf(perfil.situacaoProf);
        if (perfil?.pretensaoSalarial)  setPretensaoSalarial(perfil.pretensaoSalarial);
        if (perfil?.disponibilidade)    setDisponibilidade(perfil.disponibilidade);
        if (perfil?.formacoes?.length)      setFormacoes(perfil.formacoes);
        if (perfil?.experiencias?.length)   setExperiencias(perfil.experiencias);
        if (perfil?.certificacoes?.length)  setCertificacoes(perfil.certificacoes);
        if (perfil?.competenciasTecnicas?.length) setCompTecnicas(perfil.competenciasTecnicas);
        if (perfil?.competenciasPessoais?.length) setCompPessoais(perfil.competenciasPessoais);
        if (perfil?.idiomas?.length)        setIdiomas(perfil.idiomas);
        if (perfil?.linkedin)           setLinkedin(perfil.linkedin);
        if (perfil?.github)             setGithub(perfil.github);
        if (perfil?.behance)            setBehance(perfil.behance);
        if (perfil?.website)            setWebsite(perfil.website);
        if (perfil?.emailVerificado)    setEmailVerificado(perfil.emailVerificado);
        if (perfil?.telVerificado)      setTelVerificado(perfil.telVerificado);
        if (perfil?.uriBilhete)         setUriBilhete(perfil.uriBilhete);
        if (perfil?.uriCV || perfil?.cvUrl) setUriCV(perfil.uriCV || perfil.cvUrl);
        if (perfil?.uriCertificados)    setUriCertificados(perfil.uriCertificados);
        if (perfil?.uriCartaConducao)   setUriCartaConducao(perfil.uriCartaConducao);
        if (perfil?.uriPortefolio)      setUriPortefolio(perfil.uriPortefolio);
        if (perfil?.uriDiploma)         setUriDiploma(perfil.uriDiploma);
      }
      if (!modoEdicao && passoStr) {
        const p = parseInt(passoStr);
        if (!isNaN(p) && p >= 1 && p <= 10) setPasso(p);
      }
      setPassoRecuperado(true);
    }).catch(() => { setPassoRecuperado(true); });
  }, [user?.uid, modoEdicao]);

  useEffect(() => {
    if (!user?.uid || passo === 0 || passo === 11 || modoEdicao) return;
    AsyncStorage.setItem(`perfil_passo_${user.uid}`, String(passo)).catch(() => {});
  }, [passo, user?.uid, modoEdicao]);

  const guardarRascunho = () => {
    if (!user?.uid || passo === 0 || passo === 11 || modoEdicao) return;
    const rascunho = {
      nome, dataNasc, genero, nacionalidade, estadoCivil,
      telPrincipal, telAlternativo, email, provincia, municipio, endereco,
      tituloProfissional, resumo, situacaoProf, pretensaoSalarial, disponibilidade,
      formacoes, experiencias, certificacoes,
      compTecnicas, compPessoais, idiomas,
      linkedin, github, behance, website,
      emailVerificado, telVerificado,
    };
    AsyncStorage.setItem(`perfil_rascunho_${user.uid}`, JSON.stringify(rascunho)).catch(() => {});
  };

  const escolherImagem = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status!=='granted') { Alert.alert('Permissão necessária','Precisamos de acesso à galeria.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], allowsEditing:true, aspect:[1,1], quality:0.7 });
    if (!r.canceled) setter(r.assets[0].uri);
  };
  const escolherDocumento = async (setter) => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type:['application/pdf','image/*'], copyToCacheDirectory:true });
      if (!r.canceled && r.assets?.[0]) setter(r.assets[0].uri);
    } catch { Alert.alert('Erro','Não foi possível selecionar o ficheiro.'); }
  };
  const toggleComp = (lista, setLista, item) =>
    setLista(prev => prev.includes(item) ? prev.filter(i=>i!==item) : [...prev, item]);

  const enviarCodigoEmailLocal = () => {
    const cod = Math.floor(100000+Math.random()*900000).toString();
    setCodigoEmailGerado(cod); setEmailEnviado(true);
    Alert.alert('Código enviado', `Código enviado para ${email}\n\n(Dev: ${cod})`);
  };
  const confirmarCodigoEmail = () => {
    if (codigoEmail.trim()===codigoEmailGerado) { setEmailVerificado(true); Alert.alert('✓ Verificado','E-mail confirmado!'); }
    else Alert.alert('Código inválido','Tenta novamente.');
  };
  const enviarCodigoTel = () => {
    const cod = Math.floor(100000+Math.random()*900000).toString();
    setCodigoTelGerado(cod); setTelEnviado(true);
    Alert.alert('SMS enviado', `Código enviado para +244 ${telPrincipal}\n\n(Dev: ${cod})`);
  };
  const confirmarCodigoTel = () => {
    if (codigoTel.trim()===codigoTelGerado) { setTelVerificado(true); Alert.alert('✓ Verificado','Telefone confirmado!'); }
    else Alert.alert('Código inválido','Tenta novamente.');
  };

  const avancar = () => {
    if (!validarPasso(passo)) return;
    // ── Modo criação: só os Dados Pessoais (passo 1) são obrigatórios agora.
    //    Ao concluir o passo 1, vai directo criar a conta (envia OTP → verificar-codigo → feed).
    //    O resto do perfil (profissional, formação, experiência, documentos, etc.)
    //    fica disponível para o utilizador completar mais tarde, já autenticado.
    //
    //    ── Excepção: registo por telefone ──
    //    Se auth.currentUser já existe, a conta Firebase já foi criada
    //    (autenticação por telefone), não há OTP de email a fazer aqui —
    //    finaliza-se o perfil directamente.
    if (!modoEdicao && passo === 1) {
      if (auth.currentUser?.uid) {
        finalizarContaTelefone();
      } else {
        guardarParaSenha();
      }
      return;
    }
    guardarRascunho();
    setPasso(p=>p+1);
  };

  const voltarParaOrigem = () => {
    if (modoEdicao) { router.back(); return; }
    router.replace('/(main)/feed');
  };

  const validarPasso = (p) => {
    if (p===1) {
      if (!fotoLocal && !perfil?.fotoURL) { Alert.alert('Foto obrigatória','Adiciona uma foto de perfil para continuar.'); return false; }
      if (!nome.trim())                        { Alert.alert('Campo obrigatório','Introduz o nome completo.'); return false; }
      if (!dataNasc.trim())                    { Alert.alert('Campo obrigatório','Introduz a data de nascimento.'); return false; }
      if (!genero)                             { Alert.alert('Campo obrigatório','Seleciona o género.'); return false; }
      if (!nacionalidade)                      { Alert.alert('Campo obrigatório','Seleciona a nacionalidade.'); return false; }
      if (!estadoCivil)                        { Alert.alert('Campo obrigatório','Seleciona o estado civil.'); return false; }
      if (!telPrincipal.trim())                { Alert.alert('Campo obrigatório','Introduz o telefone principal.'); return false; }
      if (!email.trim()||!email.includes('@')) { Alert.alert('Campo obrigatório','Introduz um e-mail válido.'); return false; }
      if (!provincia)                          { Alert.alert('Campo obrigatório','Seleciona a província.'); return false; }
      if (!municipio.trim())                   { Alert.alert('Campo obrigatório','Introduz o município.'); return false; }
    }
    if (p===2) {
      if (!tituloProfissional.trim()) { Alert.alert('Campo obrigatório','Introduz o título profissional.'); return false; }
      if (!situacaoProf)              { Alert.alert('Campo obrigatório','Seleciona a situação profissional.'); return false; }
      if (!disponibilidade)           { Alert.alert('Campo obrigatório','Seleciona a disponibilidade.'); return false; }
    }
    if (p===8 && !modoEdicao) {
      if (!uriBilhete) { Alert.alert('Documento necessário','Faz upload do Bilhete de Identidade.'); return false; }
      if (!uriCV)      { Alert.alert('Documento necessário','Faz upload do Curriculum Vitae.'); return false; }
    }
    return true;
  };

  // ════════════════════════════════════════════════════════════════
  // GUARDAR PARA VERIFICAÇÃO — FLUXO CORRECTO
  // ════════════════════════════════════════════════════════════════
  // Chamado no passo 10 em modo criação.
  // 1. Guarda dados do perfil em AsyncStorage
  // 2. Envia o OTP por email (só aqui, não no register-email)
  // 3. Navega para verificar-codigo
  // A conta Firebase só é criada em verificar-codigo.jsx
  const guardarParaSenha = async () => {
    setEnviando(true);
    try {
      const pendenteStr = await AsyncStorage.getItem('_registoPendente');
      const pendente = pendenteStr ? JSON.parse(pendenteStr) : {};

      // ── Verifica se tem email e senha guardados ──
      if (!pendente?.email || !pendente?.password) {
        Alert.alert('Dados em falta', 'Volta ao início do registo e tenta novamente.');
        router.replace('/(auth)/register-email');
        return;
      }

      const emailParaVerificar = pendente.email;

      // ── Guarda todos os dados do perfil ──
      const dadosPerfil = {
        nome: nome.trim(), dataNasc, genero, nacionalidade, estadoCivil,
        telPrincipal, telAlternativo,
        email: emailParaVerificar, // usa sempre o email do registo
        provincia, municipio, endereco,
        tituloProfissional, resumo, situacaoProf, pretensaoSalarial, disponibilidade,
        formacoes, experiencias, certificacoes,
        competenciasTecnicas: compTecnicas, competenciasPessoais: compPessoais,
        idiomas, linkedin, github, behance, website,
        emailVerificado, telVerificado,
        uriBilhete, uriCV, uriCertificados, uriCartaConducao, uriPortefolio, uriDiploma,
      };

      await AsyncStorage.setItem('_registoPendente', JSON.stringify({
        ...pendente,
        tipoPerfil: pendente.tipoPerfil || 'utilizador',
        dadosPerfil,
      }));

      // ── Envia o OTP agora — primeiro e único envio ──
      try {
        const functions = getFunctions(app, 'europe-west1');
        const enviarCodigo = httpsCallable(functions, 'enviarCodigoEmail');
        await enviarCodigo({ email: emailParaVerificar });
      } catch (otpErr) {
        console.warn('[Profile OTP]', otpErr?.message);
        // Se o envio do OTP falhar, avisa mas deixa continuar
        // (o utilizador pode pedir reenvio em verificar-codigo)
        Alert.alert(
          'Aviso',
          'Não foi possível enviar o código automaticamente. Poderás pedi-lo novamente no ecrã seguinte.',
          [{ text: 'OK' }]
        );
      }

      // ── Vai para verificar o código → que criará a conta ──
      router.replace({
        pathname: '/(auth)/verificar-codigo',
        params: { email: emailParaVerificar },
      });

    } catch (err) {
      console.log('[Profile guardarParaSenha]', err?.message || err);
      Alert.alert('Erro', 'Não foi possível continuar. Tenta novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // ════════════════════════════════════════════════════════════════
  // FINALIZAR CONTA — REGISTO POR TELEFONE
  // ════════════════════════════════════════════════════════════════
  // Chamado no passo 1 em modo criação, quando a conta já existe
  // (auth.currentUser já tem uid — autenticação por telefone já
  // aconteceu em register-phone.jsx). Não há OTP de email a fazer:
  // grava-se o perfil directamente e segue para o feed.
  const finalizarContaTelefone = async () => {
    setEnviando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert('Sessão expirada', 'Volta a verificar o teu número.');
        router.replace('/(auth)/register-phone');
        return;
      }

      const pendenteStr = await AsyncStorage.getItem('_registoPendente');
      const pendente = pendenteStr ? JSON.parse(pendenteStr) : {};

      const dadosPerfil = {
        nome: nome.trim(), dataNasc, genero, nacionalidade, estadoCivil,
        telPrincipal: telPrincipal || pendente.telefone || '', telAlternativo,
        email, provincia, municipio, endereco,
        tituloProfissional, cargo: tituloProfissional, resumo, bio: resumo,
        situacaoProf, pretensaoSalarial, disponibilidade,
        formacoes, experiencias, certificacoes,
        competenciasTecnicas: compTecnicas, competenciasPessoais: compPessoais,
        idiomas, uriBilhete, uriCV, cvUrl: uriCV,
        uriCertificados, uriCartaConducao, uriPortefolio, uriDiploma,
        linkedin, github, behance, website, emailVerificado,
        telVerificado: true,
        uid,
        telefone: pendente.telefone || telPrincipal,
        tipoPerfil: pendente.tipoPerfil || 'utilizador',
        perfilCompleto: true,
        dataCriacao: serverTimestamp(),
        dataAtualizacao: serverTimestamp(),
      };

      await guardarPerfil(dadosPerfil);
      await setDoc(doc(db, 'users', uid), dadosPerfil, { merge: true });

      await AsyncStorage.multiRemove([
        `perfil_rascunho_${uid}`,
        `perfil_passo_${uid}`,
        '_registoPendente',
      ]).catch(() => {});

      setPasso(11);
    } catch (err) {
      console.log('[Profile finalizarContaTelefone] erro:', err?.code, err?.message);
      Alert.alert('Erro', 'Não foi possível concluir o perfil. Tenta novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Submissão (modo edição — utilizador já tem conta) ────────────────────
  const submeter = async () => {
    setEnviando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert('Erro', 'Sessão expirada. Faz login novamente.');
        router.replace('/(auth)/login');
        return;
      }

      let urlFoto = perfil?.fotoURL || null;
      if (fotoLocal) {
        try {
          const u = await uploadFotoPerfil(uid, fotoLocal);
          if (u) urlFoto = u;
        } catch {}
      }

      const dadosPerfil = {
        nome: nome.trim(), dataNasc, genero, nacionalidade, estadoCivil,
        telPrincipal, telAlternativo, email, provincia, municipio, endereco,
        tituloProfissional, cargo: tituloProfissional, resumo, bio: resumo,
        situacaoProf, pretensaoSalarial, disponibilidade,
        formacoes, experiencias, certificacoes,
        competenciasTecnicas: compTecnicas, competenciasPessoais: compPessoais,
        idiomas, uriBilhete, uriCV, cvUrl: uriCV,
        uriCertificados, uriCartaConducao, uriPortefolio, uriDiploma,
        linkedin, github, behance, website, emailVerificado, telVerificado,
        fotoURL: urlFoto, tipoPerfil: 'utilizador', perfilCompleto: true,
        dataAtualizacao: serverTimestamp(),
      };
      await guardarPerfil(dadosPerfil);
      await setDoc(doc(db,'users',uid), {
        perfilCompleto: true, tipoPerfil:'utilizador',
        nome: nome.trim(), fotoURL: urlFoto,
      }, { merge:true });

      if (!modoEdicao) {
        await AsyncStorage.multiRemove([
          `perfil_rascunho_${uid}`,
          `perfil_passo_${uid}`,
          '_registoPendente',
        ]).catch(() => {});
      }

      setPasso(11);
    } catch (err) {
      console.log('[Profile submeter] erro:', err.code, err.message);
      let msg = 'Não foi possível guardar o perfil. Tenta novamente.';
      if (err.code === 'auth/email-already-in-use') msg = 'Este email já está em uso.';
      if (err.code === 'auth/weak-password') msg = 'Palavra-passe muito fraca.';
      Alert.alert('Erro', msg);
    } finally {
      setEnviando(false);
    }
  };

  // ── PASSO 0 — só aparece em modo criação ────────────────────────────────
  if (passo===0 && !modoEdicao) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco}/>
        <ScrollView contentContainerStyle={s.termosWrap}>
          <View style={s.logoRow}>
            <Text style={s.logoConnect}>Connect</Text>
            <Text style={s.logoAll}>All</Text>
          </View>
          <View style={s.progressoWrap}><View style={[s.progressoBarra,{width:'0%'}]}/></View>
          <View style={s.progressoInfoRow}>
            <Text style={s.progressoLabel}>Criar Perfil</Text>
            <Text style={s.progressoPerc}>0%</Text>
          </View>
          <Text style={s.passoTitulo}>{'Cria a tua\nConta'}</Text>
          <Text style={s.termosSubtitulo}>Preenche apenas os teus dados pessoais para criares a conta. O resto do perfil (experiência, formação, documentos...) podes completar depois, quando quiseres.</Text>
          {[
            {icone:'user',titulo:'Rápido e Simples',texto:'Só precisas de preencher os teus dados pessoais para começares a usar a plataforma.'},
            {icone:'shield',titulo:'Dados Seguros',texto:'Os teus dados pessoais são tratados com confidencialidade e apenas partilhados com recrutadores verificados.'},
            {icone:'briefcase',titulo:'Completa Depois',texto:'Já dentro da app, podes completar o teu perfil profissional para aumentares as tuas oportunidades.'},
            {icone:'check-circle',titulo:'Verificação',texto:'Perfis completos e verificados têm prioridade nas pesquisas e transmitem maior confiança aos recrutadores.'},
          ].map((b,i) => (
            <View key={i} style={s.termosBloco}>
              <View style={s.termosBlocoIcone}><Feather name={b.icone} size={18} color={C.azul}/></View>
              <View style={{flex:1}}>
                <Text style={s.termosBlocoTitulo}>{b.titulo}</Text>
                <Text style={s.termosBlocoTxt}>{b.texto}</Text>
              </View>
            </View>
          ))}
          <View style={s.legalSection}>
            <Text style={s.legalTxt}>
              Ao continuar, concordas com os{' '}
              <Text style={s.legalLink} onPress={()=>router.push({pathname:'/(auth)/politicas',params:{tipo:'contrato'}})}>Termos de Utilização</Text>
              {' e a '}
              <Text style={s.legalLink} onPress={()=>router.push({pathname:'/(auth)/politicas',params:{tipo:'privacidade'}})}>Política de Privacidade</Text>
              {' da ConnectAll Angola.'}
            </Text>
          </View>
          <TouchableOpacity style={s.btnPrimario} onPress={()=>setPasso(1)}>
            <Text style={s.btnPrimarioTxt}>Começar a criar perfil</Text>
            <Feather name="arrow-right" size={18} color={C.branco}/>
          </TouchableOpacity>
          <View style={s.separador}><View style={s.separadorLinha}/><Text style={s.separadorTxt}>ou</Text><View style={s.separadorLinha}/></View>
          <TouchableOpacity style={s.btnSecundarioPill} onPress={()=>router.replace('/(auth)/escolher-tipo-perfil')}>
            <Ionicons name="arrow-back" size={18} color={C.cinza4}/>
            <Text style={s.btnSecundarioPillTxt}>Voltar</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── PASSO 11 — Concluído ─────────────────────────────────────────────────
  if (passo===11) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco}/>
        <View style={s.pendenteWrap}>
          <View style={s.pendenteIconeWrap}>
            <View style={s.pendenteIconeCirculo}>
              <Ionicons name="checkmark-circle-outline" size={52} color={C.azul}/>
            </View>
          </View>
          <Text style={s.pendenteTitulo}>{modoEdicao ? 'Perfil Atualizado!' : 'Perfil Criado!'}</Text>
          <Text style={s.pendenteSubtitulo}>{modoEdicao ? 'As tuas alterações foram guardadas.' : 'O teu perfil profissional está pronto.'}</Text>
          <View style={s.pendenteCard}>
            <View style={s.pendenteCardLinha}>
              <Ionicons name="checkmark-circle" size={18} color={C.verde}/>
              <Text style={s.pendenteCardTxt}>Perfil visível para recrutadores verificados</Text>
            </View>
            <View style={s.pendenteDivisor}/>
            <View style={s.pendenteCardLinha}>
              <Feather name="bell" size={16} color={C.azul}/>
              <Text style={s.pendenteCardTxt}>Receberás notificações de vagas compatíveis</Text>
            </View>
            <View style={s.pendenteDivisor}/>
            <View style={s.pendenteCardLinha}>
              <Feather name="trending-up" size={16} color={C.azul}/>
              <Text style={s.pendenteCardTxt}>Podes editar o teu perfil a qualquer momento</Text>
            </View>
          </View>
          <TouchableOpacity style={s.btnPrimario} onPress={voltarParaOrigem}>
            <Feather name={modoEdicao ? 'user' : 'home'} size={18} color={C.branco}/>
            <Text style={s.btnPrimarioTxt}>{modoEdicao ? 'Ver o meu perfil' : 'Ir para o início'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const titulosPassos = ['','Dados Pessoais','Perfil Profissional','Formação Académica','Experiência Profissional','Certificações','Competências','Idiomas','Documentos','Redes Profissionais','Verificação e Segurança'];
  // Em modo criação só existe o passo 1 (Dados Pessoais) — o resto completa-se depois, já com conta criada.
  const percentagem = modoEdicao ? Math.round(((passo-1)/10)*100) : 100;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.branco}/>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            if (passo === 1 && modoEdicao) { voltarParaOrigem(); return; }
            setPasso(p=>p>1?p-1:modoEdicao?1:0);
          }}
          style={s.headerVoltar}
        >
          <Ionicons name="chevron-back" size={24} color={C.azul}/>
        </TouchableOpacity>
        <View style={{flex:1,alignItems:'center'}}>
          <View style={s.logoRow}>
            <Text style={[s.logoConnect,{fontSize:16}]}>Connect</Text>
            <Text style={[s.logoAll,{fontSize:16}]}>All</Text>
          </View>
        </View>
        {modoEdicao
          ? <TouchableOpacity onPress={voltarParaOrigem} style={{padding:4}}>
              <Ionicons name="close" size={22} color={C.cinza4}/>
            </TouchableOpacity>
          : <View style={{width:32}}/>}
      </View>
      <View style={s.progressoWrap}><View style={[s.progressoBarra,{width:`${percentagem}%`}]}/></View>
      <View style={s.progressoInfoRow}>
        <Text style={s.progressoLabel}>{modoEdicao ? `Editar — ${titulosPassos[passo]}` : titulosPassos[passo]}</Text>
        <Text style={s.progressoPerc}>{percentagem}%</Text>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.passoTitulo}>{titulosPassos[passo]}</Text>
          <Text style={s.passoNumero}>
            {modoEdicao ? `Passo ${passo} de 10` : 'Último passo antes de criares a tua conta'}
          </Text>

          {passo===1 && (
            <View>
              <View style={s.fotoPerfilWrap}>
                <TouchableOpacity style={s.fotoPerfilCirculo} onPress={()=>escolherImagem(setFotoLocal)}>
                  {fotoLocal||perfil?.fotoURL
                    ? <Image source={{uri:fotoLocal||perfil.fotoURL}} style={s.fotoPerfilImagem}/>
                    : <Ionicons name="person-circle-outline" size={64} color={C.cinza3}/>
                  }
                  <View style={s.fotoPerfilBadge}><Feather name="camera" size={13} color={C.branco}/></View>
                </TouchableOpacity>
                <Text style={s.fotoPerfilLabel}>Foto de Perfil *</Text>
              </View>
              <Campo label="Nome Completo" obrigatorio><InputLinha value={nome} onChangeText={setNome} placeholder="O teu nome completo"/></Campo>
              <Campo label="Data de Nascimento" obrigatorio><SeletorDataNascimento value={dataNasc} onChange={setDataNasc} placeholder="Selecionar data"/></Campo>
              <Campo label="Género" obrigatorio><Selector valor={genero} placeholder="Selecionar género" onPress={()=>setModalGenero(true)}/></Campo>
              <Campo label="Nacionalidade" obrigatorio><Selector valor={nacionalidade} placeholder="Selecionar nacionalidade" onPress={()=>setModalNacionalidade(true)}/></Campo>
              <Campo label="Estado Civil" obrigatorio><Selector valor={estadoCivil} placeholder="Selecionar estado civil" onPress={()=>setModalEstadoCivil(true)}/></Campo>
              <Campo label="Telefone Principal" obrigatorio>
                <View style={s.inputLinha}>
                  <Text style={s.prefixoTxt}>+244</Text>
                  <TextInput style={[s.inputTexto,{flex:1}]} value={telPrincipal} onChangeText={setTelPrincipal} placeholder="9XX XXX XXX" placeholderTextColor={C.cinza3} keyboardType="phone-pad" maxLength={9}/>
                </View>
              </Campo>
              <Campo label="Telefone Alternativo">
                <View style={s.inputLinha}>
                  <Text style={s.prefixoTxt}>+244</Text>
                  <TextInput style={[s.inputTexto,{flex:1}]} value={telAlternativo} onChangeText={setTelAlternativo} placeholder="9XX XXX XXX (opcional)" placeholderTextColor={C.cinza3} keyboardType="phone-pad" maxLength={9}/>
                </View>
              </Campo>
              <Campo label="E-mail" obrigatorio><InputLinha value={email} onChangeText={setEmail} placeholder="o.teu@email.com" keyboardType="email-address" autoCapitalize="none"/></Campo>
              <Campo label="Província" obrigatorio><Selector valor={provincia} placeholder="Selecionar província" onPress={()=>setModalProvincia(true)}/></Campo>
              <Campo label="Município" obrigatorio><InputLinha value={municipio} onChangeText={setMunicipio} placeholder="Ex: Talatona"/></Campo>
              <Campo label="Endereço"><InputLinha value={endereco} onChangeText={setEndereco} placeholder="Rua, nº, bairro (opcional)"/></Campo>
            </View>
          )}

          {passo===2 && (
            <View>
              <Campo label="Título Profissional" obrigatorio><InputLinha value={tituloProfissional} onChangeText={setTituloProfissional} placeholder="Ex: Engenheiro Informático"/></Campo>
              <Campo label="Resumo Profissional">
                <InputLinha value={resumo} onChangeText={setResumo} placeholder="Fale sobre a sua experiência, competências e objetivos..." multiline numberOfLines={4} maxLength={500}/>
                <Text style={s.contadorTxt}>{resumo.length}/500</Text>
              </Campo>
              <Campo label="Situação Profissional" obrigatorio>
                <View style={s.chipGrupo}>
                  {SITUACOES_PROF.map(item=>(
                    <TouchableOpacity key={item} style={[s.chip, situacaoProf===item && s.chipAtivo]} onPress={()=>setSituacaoProf(item)}>
                      <Text style={[s.chipTxt, situacaoProf===item && s.chipTxtAtivo]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Campo>
              <Campo label="Pretensão Salarial (Kz)"><InputLinha value={pretensaoSalarial} onChangeText={setPretensaoSalarial} placeholder="Ex: 250.000 (opcional)" keyboardType="numeric"/></Campo>
              <Campo label="Disponibilidade" obrigatorio>
                <View style={s.chipGrupo}>
                  {DISPONIBILIDADES.map(item=>(
                    <TouchableOpacity key={item} style={[s.chip, disponibilidade===item && s.chipAtivo]} onPress={()=>setDisponibilidade(item)}>
                      <Text style={[s.chipTxt, disponibilidade===item && s.chipTxtAtivo]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Campo>
            </View>
          )}

          {passo===3 && (
            <View>
              <Text style={s.seccaoDescricao}>Adiciona as tuas habilitações académicas.</Text>
              {formacoes.map((f,i)=>(
                <View key={i} style={s.itemCard}>
                  <View style={{flex:1}}>
                    <Text style={s.itemCardTitulo}>{f.curso||'—'}</Text>
                    <Text style={s.itemCardSub}>{f.instituicao}{f.grau?` · ${f.grau}`:''}</Text>
                    <Text style={s.itemCardData}>{f.anoInicio}{f.emCurso?' · Em curso':f.anoConclusao?` → ${f.anoConclusao}`:''}</Text>
                  </View>
                  <View style={s.itemCardAcoes}>
                    <TouchableOpacity onPress={()=>{setTmpFormacao(f);setFormacaoEditando(i);setModalFormacao(true);}}>
                      <Feather name="edit-2" size={16} color={C.azul}/>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>setFormacoes(prev=>prev.filter((_,j)=>j!==i))}>
                      <Feather name="trash-2" size={16} color={C.error}/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.btnAdicionar} onPress={()=>{setTmpFormacao({instituicao:'',curso:'',area:'',grau:'',anoInicio:'',anoConclusao:'',emCurso:false});setFormacaoEditando('novo');setModalFormacao(true);}}>
                <Feather name="plus-circle" size={18} color={C.azul}/><Text style={s.btnAdicionarTxt}>+ Adicionar Formação</Text>
              </TouchableOpacity>
            </View>
          )}

          {passo===4 && (
            <View>
              <Text style={s.seccaoDescricao}>Adiciona as tuas experiências profissionais.</Text>
              {experiencias.map((e,i)=>(
                <View key={i} style={s.itemCard}>
                  <View style={{flex:1}}>
                    <Text style={s.itemCardTitulo}>{e.cargo||'—'}</Text>
                    <Text style={s.itemCardSub}>{e.empresa}{e.setor?` · ${e.setor}`:''}</Text>
                    <Text style={s.itemCardData}>{e.dataInicio}{e.atual?' · Atual':e.dataFim?` → ${e.dataFim}`:''}</Text>
                  </View>
                  <View style={s.itemCardAcoes}>
                    <TouchableOpacity onPress={()=>{setTmpExp(e);setExpEditando(i);setModalExp(true);}}>
                      <Feather name="edit-2" size={16} color={C.azul}/>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>setExperiencias(prev=>prev.filter((_,j)=>j!==i))}>
                      <Feather name="trash-2" size={16} color={C.error}/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.btnAdicionar} onPress={()=>{setTmpExp({empresa:'',cargo:'',setor:'',dataInicio:'',dataFim:'',atual:false,descricao:'',resultados:''});setExpEditando('novo');setModalExp(true);}}>
                <Feather name="plus-circle" size={18} color={C.azul}/><Text style={s.btnAdicionarTxt}>+ Adicionar Experiência</Text>
              </TouchableOpacity>
            </View>
          )}

          {passo===5 && (
            <View>
              <Text style={s.seccaoDescricao}>Adiciona cursos, formações e certificações.</Text>
              {certificacoes.map((c,i)=>(
                <View key={i} style={s.itemCard}>
                  <View style={{flex:1}}>
                    <Text style={s.itemCardTitulo}>{c.nome||'—'}</Text>
                    <Text style={s.itemCardSub}>{c.instituicao}</Text>
                    <Text style={s.itemCardData}>{c.data}</Text>
                  </View>
                  <View style={s.itemCardAcoes}>
                    <TouchableOpacity onPress={()=>{setTmpCert(c);setCertEditando(i);setModalCert(true);}}>
                      <Feather name="edit-2" size={16} color={C.azul}/>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>setCertificacoes(prev=>prev.filter((_,j)=>j!==i))}>
                      <Feather name="trash-2" size={16} color={C.error}/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.btnAdicionar} onPress={()=>{setTmpCert({nome:'',instituicao:'',data:'',certificadoUri:null});setCertEditando('novo');setModalCert(true);}}>
                <Feather name="plus-circle" size={18} color={C.azul}/><Text style={s.btnAdicionarTxt}>+ Adicionar Certificação</Text>
              </TouchableOpacity>
              <View style={s.infoBox}>
                <Feather name="info" size={14} color={C.azul}/>
                <Text style={s.infoBoxTxt}>Exemplos: HSE Level 1 e 2, Primeiros Socorros, Combate a Incêndios, Excel Avançado, Gestão de Projetos.</Text>
              </View>
            </View>
          )}

          {passo===6 && (
            <View>
              <Text style={s.seccaoTitulo}>Competências Técnicas</Text>
              <View style={s.chipGrupo}>
                {COMP_TECNICAS.map(item=>(
                  <TouchableOpacity key={item} style={[s.chip,compTecnicas.includes(item)&&s.chipAtivo]} onPress={()=>toggleComp(compTecnicas,setCompTecnicas,item)}>
                    <Text style={[s.chipTxt,compTecnicas.includes(item)&&s.chipTxtAtivo]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.seccaoDivisor}/>
              <Text style={s.seccaoTitulo}>Competências Pessoais</Text>
              <View style={s.chipGrupo}>
                {COMP_PESSOAIS.map(item=>(
                  <TouchableOpacity key={item} style={[s.chip,compPessoais.includes(item)&&s.chipAtivo]} onPress={()=>toggleComp(compPessoais,setCompPessoais,item)}>
                    <Text style={[s.chipTxt,compPessoais.includes(item)&&s.chipTxtAtivo]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {passo===7 && (
            <View>
              <Text style={s.seccaoDescricao}>Indica os idiomas que dominas e os respetivos níveis.</Text>
              {idiomas.map((id,i)=>(
                <View key={i} style={s.itemCard}>
                  <View style={{flex:1}}>
                    <Text style={s.itemCardTitulo}>{id.idioma}</Text>
                    <Text style={s.itemCardSub}>Leitura: {id.leitura} · Escrita: {id.escrita}</Text>
                    <Text style={s.itemCardData}>Conversação: {id.conversacao}</Text>
                  </View>
                  <View style={s.itemCardAcoes}>
                    <TouchableOpacity onPress={()=>{setTmpIdioma(id);setIdiomaEditando(i);setModalIdioma(true);}}>
                      <Feather name="edit-2" size={16} color={C.azul}/>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>setIdiomas(prev=>prev.filter((_,j)=>j!==i))}>
                      <Feather name="trash-2" size={16} color={C.error}/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.btnAdicionar} onPress={()=>{setTmpIdioma({idioma:'',leitura:'',escrita:'',conversacao:''});setIdiomaEditando('novo');setModalIdioma(true);}}>
                <Feather name="plus-circle" size={18} color={C.azul}/><Text style={s.btnAdicionarTxt}>+ Adicionar Idioma</Text>
              </TouchableOpacity>
            </View>
          )}

          {passo===8 && (
            <View>
              <Text style={s.seccaoTitulo}>Documentos Obrigatórios</Text>
              <Campo label="Bilhete de Identidade" obrigatorio={!modoEdicao}>
                <UploadBtnComPreview uri={uriBilhete} onPress={()=>escolherDocumento(setUriBilhete)} label="Selecionar BI (imagem ou PDF)" titulo="Bilhete de Identidade"/>
              </Campo>
              <Campo label="Curriculum Vitae (PDF)" obrigatorio={!modoEdicao}>
                <UploadBtnComPreview uri={uriCV} onPress={()=>escolherDocumento(setUriCV)} label="Selecionar CV em PDF" titulo="Curriculum Vitae"/>
              </Campo>
              <View style={s.seccaoDivisor}/>
              <Text style={s.seccaoTitulo}>Documentos Opcionais</Text>
              <Campo label="Certificados"><UploadBtnComPreview uri={uriCertificados} onPress={()=>escolherDocumento(setUriCertificados)} label="Selecionar certificados" titulo="Certificados"/></Campo>
              <Campo label="Carta de Condução"><UploadBtnComPreview uri={uriCartaConducao} onPress={()=>escolherDocumento(setUriCartaConducao)} label="Selecionar carta de condução" titulo="Carta de Condução"/></Campo>
              <Campo label="Portefólio"><UploadBtnComPreview uri={uriPortefolio} onPress={()=>escolherDocumento(setUriPortefolio)} label="Selecionar portefólio" titulo="Portefólio"/></Campo>
              <Campo label="Diploma"><UploadBtnComPreview uri={uriDiploma} onPress={()=>escolherDocumento(setUriDiploma)} label="Selecionar diploma" titulo="Diploma"/></Campo>
            </View>
          )}

          {passo===9 && (
            <View>
              <Text style={s.seccaoDescricao}>Partilha os teus perfis profissionais online (todos opcionais).</Text>
              <Campo label="LinkedIn"><InputLinha value={linkedin} onChangeText={setLinkedin} placeholder="linkedin.com/in/o-teu-perfil" autoCapitalize="none"/></Campo>
              <Campo label="GitHub"><InputLinha value={github} onChangeText={setGithub} placeholder="github.com/o-teu-user" autoCapitalize="none"/></Campo>
              <Campo label="Behance"><InputLinha value={behance} onChangeText={setBehance} placeholder="behance.net/o-teu-perfil" autoCapitalize="none"/></Campo>
              <Campo label="Website Pessoal"><InputLinha value={website} onChangeText={setWebsite} placeholder="https://o-teu-site.com" autoCapitalize="none"/></Campo>
            </View>
          )}

          {passo===10 && (
            <View>
              <Text style={s.seccaoDescricao}>Verifica o teu e-mail e telefone para aumentar a credibilidade do teu perfil.</Text>
              <Text style={s.seccaoTitulo}>Verificação de E-mail</Text>
              <View style={s.verificacaoBox}>
                <Text style={s.verificacaoEmail}>{email}</Text>
                {emailVerificado ? (
                  <View style={s.badgeVerificado}><Ionicons name="checkmark-circle" size={18} color={C.verde}/><Text style={s.badgeVerificadoTxt}>E-mail verificado</Text></View>
                ) : (
                  <>
                    <TouchableOpacity style={s.btnVerificar} onPress={enviarCodigoEmailLocal}>
                      <Text style={s.btnVerificarTxt}>{emailEnviado?'Reenviar código':'Enviar código'}</Text>
                    </TouchableOpacity>
                    {emailEnviado && (
                      <View style={s.codigoRow}>
                        <TextInput style={s.codigoInput} value={codigoEmail} onChangeText={setCodigoEmail} placeholder="Código de 6 dígitos" placeholderTextColor={C.cinza3} keyboardType="numeric" maxLength={6}/>
                        <TouchableOpacity style={s.btnConfirmar} onPress={confirmarCodigoEmail}><Text style={s.btnConfirmarTxt}>Confirmar</Text></TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
              <View style={s.seccaoDivisor}/>
              <Text style={s.seccaoTitulo}>Verificação de Telefone</Text>
              <View style={s.verificacaoBox}>
                <Text style={s.verificacaoEmail}>+244 {telPrincipal}</Text>
                {telVerificado ? (
                  <View style={s.badgeVerificado}><Ionicons name="checkmark-circle" size={18} color={C.verde}/><Text style={s.badgeVerificadoTxt}>Telefone verificado</Text></View>
                ) : (
                  <>
                    <TouchableOpacity style={s.btnVerificar} onPress={enviarCodigoTel}>
                      <Text style={s.btnVerificarTxt}>{telEnviado?'Reenviar SMS':'Enviar SMS'}</Text>
                    </TouchableOpacity>
                    {telEnviado && (
                      <View style={s.codigoRow}>
                        <TextInput style={s.codigoInput} value={codigoTel} onChangeText={setCodigoTel} placeholder="Código de 6 dígitos" placeholderTextColor={C.cinza3} keyboardType="numeric" maxLength={6}/>
                        <TouchableOpacity style={s.btnConfirmar} onPress={confirmarCodigoTel}><Text style={s.btnConfirmarTxt}>Confirmar</Text></TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
              <View style={s.seccaoDivisor}/>
              <Text style={s.seccaoTitulo}>Estado do Perfil</Text>
              <View style={s.estadoLista}>
                {[
                  {label:'E-mail Confirmado', ok:emailVerificado},
                  {label:'Telefone Confirmado', ok:telVerificado},
                  {label:'Bilhete de Identidade', ok:!!uriBilhete},
                  {label:'Curriculum Vitae', ok:!!uriCV},
                ].map(({label,ok})=>(
                  <View key={label} style={s.estadoLinha}>
                    <Ionicons name={ok?'checkmark-circle':'ellipse-outline'} size={20} color={ok?C.verde:C.cinza3}/>
                    <Text style={[s.estadoTxt,ok&&{color:C.verde}]}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* ── Botão final — modo criação vai para verificar-codigo ── */}
              <TouchableOpacity
                style={[s.btnPrimario,{marginTop:24},enviando&&{opacity:0.6}]}
                onPress={modoEdicao ? submeter : guardarParaSenha}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color={C.branco}/>
                  : <><Text style={s.btnPrimarioTxt}>{modoEdicao ? 'Guardar Alterações' : 'Concluir e Verificar Email'}</Text><Feather name="check" size={18} color={C.branco}/></>
                }
              </TouchableOpacity>
              <View style={{height:40}}/>
            </View>
          )}

          {passo<10 && (
            <TouchableOpacity
              style={[s.btnPrimario,{marginTop:24}, enviando && {opacity:0.6}]}
              onPress={avancar}
              disabled={enviando}
            >
              {(!modoEdicao && passo===1 && enviando) ? (
                <ActivityIndicator color={C.branco}/>
              ) : (
                <>
                  <Text style={s.btnPrimarioTxt}>
                    {(!modoEdicao && passo===1) ? 'Concluir e Criar Conta' : 'Continuar'}
                  </Text>
                  <Feather name={(!modoEdicao && passo===1) ? 'check' : 'arrow-right'} size={18} color={C.branco}/>
                </>
              )}
            </TouchableOpacity>
          )}
          {modoEdicao && passo < 10 && (
            <TouchableOpacity style={[s.btnSecundarioPill,{marginTop:10}]} onPress={submeter} disabled={enviando}>
              {enviando
                ? <ActivityIndicator color={C.cinza4} size="small"/>
                : <Text style={s.btnSecundarioPillTxt}>Guardar e sair</Text>}
            </TouchableOpacity>
          )}
          {!modoEdicao && passo>=3&&passo<=9&&passo!==8 && (
            <TouchableOpacity style={[s.btnSecundarioPill,{marginTop:10}]} onPress={()=>{guardarRascunho();setPasso(p=>p+1);}}>
              <Text style={s.btnSecundarioPillTxt}>Saltar por agora</Text>
            </TouchableOpacity>
          )}
          <View style={{height:40}}/>
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalLista visivel={modalGenero}          titulo="Género"             lista={GENEROS}          valor={genero}        onSelect={setGenero}        onFechar={()=>setModalGenero(false)}/>
      <ModalLista visivel={modalNacionalidade}   titulo="Nacionalidade"      lista={NACIONALIDADES}   valor={nacionalidade} onSelect={setNacionalidade} onFechar={()=>setModalNacionalidade(false)}/>
      <ModalLista visivel={modalEstadoCivil}     titulo="Estado Civil"       lista={ESTADOS_CIVIS}    valor={estadoCivil}   onSelect={setEstadoCivil}   onFechar={()=>setModalEstadoCivil(false)}/>
      <ModalLista visivel={modalProvincia}       titulo="Província"          lista={PROVINCIAS}       valor={provincia}     onSelect={setProvincia}     onFechar={()=>setModalProvincia(false)}/>
      <ModalLista visivel={modalSituacao}        titulo="Situação"           lista={SITUACOES_PROF}   valor={situacaoProf}  onSelect={setSituacaoProf}  onFechar={()=>setModalSituacao(false)}/>
      <ModalLista visivel={modalDisponibilidade} titulo="Disponibilidade"    lista={DISPONIBILIDADES} valor={disponibilidade} onSelect={setDisponibilidade} onFechar={()=>setModalDisponibilidade(false)}/>
      <ModalLista visivel={modalGrau}            titulo="Grau Académico"     lista={GRAUS_ACADEMICOS} valor={tmpFormacao.grau} onSelect={v=>setTmpFormacao(f=>({...f,grau:v}))} onFechar={()=>setModalGrau(false)}/>
      <ModalLista visivel={modalSetor}           titulo="Setor"              lista={SETORES}          valor={tmpExp.setor}  onSelect={v=>setTmpExp(e=>({...e,setor:v}))}     onFechar={()=>setModalSetor(false)}/>
      <ModalLista visivel={modalIdiomaItem}      titulo="Idioma"             lista={IDIOMAS_LISTA}    valor={tmpIdioma.idioma} onSelect={v=>setTmpIdioma(i=>({...i,idioma:v}))} onFechar={()=>setModalIdiomaItem(false)}/>
      <ModalLista visivel={modalNivelLeitura}    titulo="Nível de Leitura"   lista={NIVEIS_IDIOMA}    valor={tmpIdioma.leitura} onSelect={v=>setTmpIdioma(i=>({...i,leitura:v}))} onFechar={()=>setModalNivelLeitura(false)}/>
      <ModalLista visivel={modalNivelEscrita}    titulo="Nível de Escrita"   lista={NIVEIS_IDIOMA}    valor={tmpIdioma.escrita} onSelect={v=>setTmpIdioma(i=>({...i,escrita:v}))} onFechar={()=>setModalNivelEscrita(false)}/>
      <ModalLista visivel={modalNivelConv}       titulo="Nível de Conversação" lista={NIVEIS_IDIOMA}  valor={tmpIdioma.conversacao} onSelect={v=>setTmpIdioma(i=>({...i,conversacao:v}))} onFechar={()=>setModalNivelConv(false)}/>

      <Modal visible={modalFormacao} transparent animationType="slide" onRequestClose={()=>setModalFormacao(false)}>
        <View style={s.modalOverlay}><View style={[s.modalSheet,{maxHeight:'90%'}]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Formação Académica</Text>
            <TouchableOpacity onPress={()=>setModalFormacao(false)}><Ionicons name="close" size={22} color={C.cinza4}/></TouchableOpacity>
          </View>
          <ScrollView style={{paddingHorizontal:20}}>
            <Campo label="Instituição" obrigatorio><InputLinha value={tmpFormacao.instituicao} onChangeText={v=>setTmpFormacao(f=>({...f,instituicao:v}))} placeholder="Ex: ISPTEC"/></Campo>
            <Campo label="Curso" obrigatorio><InputLinha value={tmpFormacao.curso} onChangeText={v=>setTmpFormacao(f=>({...f,curso:v}))} placeholder="Ex: Engenharia Informática"/></Campo>
            <Campo label="Área de Formação"><InputLinha value={tmpFormacao.area} onChangeText={v=>setTmpFormacao(f=>({...f,area:v}))} placeholder="Ex: Tecnologia"/></Campo>
            <Campo label="Grau Académico" obrigatorio><Selector valor={tmpFormacao.grau} placeholder="Selecionar grau" onPress={()=>setModalGrau(true)}/></Campo>
            <View style={s.duasColunasWrap}>
              <View style={{flex:1}}><Campo label="Ano de Início"><InputLinha value={tmpFormacao.anoInicio} onChangeText={v=>setTmpFormacao(f=>({...f,anoInicio:v}))} placeholder="AAAA" keyboardType="numeric" maxLength={4}/></Campo></View>
              <View style={{width:12}}/>
              <View style={{flex:1}}><Campo label="Ano de Conclusão"><InputLinha value={tmpFormacao.anoConclusao} onChangeText={v=>setTmpFormacao(f=>({...f,anoConclusao:v}))} placeholder="AAAA" keyboardType="numeric" maxLength={4}/></Campo></View>
            </View>
            <TouchableOpacity style={s.checkboxLinha} onPress={()=>setTmpFormacao(f=>({...f,emCurso:!f.emCurso}))}>
              <View style={[s.checkbox,tmpFormacao.emCurso&&{backgroundColor:C.azul,borderColor:C.azul}]}>
                {tmpFormacao.emCurso&&<Ionicons name="checkmark" size={14} color={C.branco}/>}
              </View>
              <Text style={s.checkboxTxt}>Em curso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimario,{marginVertical:20}]} onPress={()=>{
              if(!tmpFormacao.instituicao.trim()||!tmpFormacao.curso.trim()||!tmpFormacao.grau){Alert.alert('Campos obrigatórios','Preenche instituição, curso e grau.');return;}
              if(formacaoEditando==='novo') setFormacoes(prev=>[...prev,tmpFormacao]);
              else setFormacoes(prev=>prev.map((f,i)=>i===formacaoEditando?tmpFormacao:f));
              setModalFormacao(false);
            }}><Text style={s.btnPrimarioTxt}>{formacaoEditando==='novo'?'Adicionar':'Guardar'}</Text></TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={modalExp} transparent animationType="slide" onRequestClose={()=>setModalExp(false)}>
        <View style={s.modalOverlay}><View style={[s.modalSheet,{maxHeight:'92%'}]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Experiência Profissional</Text>
            <TouchableOpacity onPress={()=>setModalExp(false)}><Ionicons name="close" size={22} color={C.cinza4}/></TouchableOpacity>
          </View>
          <ScrollView style={{paddingHorizontal:20}}>
            <Campo label="Empresa" obrigatorio><InputLinha value={tmpExp.empresa} onChangeText={v=>setTmpExp(e=>({...e,empresa:v}))} placeholder="Ex: Sonangol"/></Campo>
            <Campo label="Cargo" obrigatorio><InputLinha value={tmpExp.cargo} onChangeText={v=>setTmpExp(e=>({...e,cargo:v}))} placeholder="Ex: Técnico de HSE"/></Campo>
            <Campo label="Setor"><Selector valor={tmpExp.setor} placeholder="Selecionar setor" onPress={()=>setModalSetor(true)}/></Campo>
            <View style={s.duasColunasWrap}>
              <View style={{flex:1}}><Campo label="Data de Início" obrigatorio><InputLinha value={tmpExp.dataInicio} onChangeText={v=>setTmpExp(e=>({...e,dataInicio:v}))} placeholder="MM/AAAA" keyboardType="numeric"/></Campo></View>
              <View style={{width:12}}/>
              <View style={{flex:1}}><Campo label="Data de Fim"><InputLinha value={tmpExp.dataFim} onChangeText={v=>setTmpExp(e=>({...e,dataFim:v}))} placeholder="MM/AAAA" keyboardType="numeric"/></Campo></View>
            </View>
            <TouchableOpacity style={s.checkboxLinha} onPress={()=>setTmpExp(e=>({...e,atual:!e.atual}))}>
              <View style={[s.checkbox,tmpExp.atual&&{backgroundColor:C.azul,borderColor:C.azul}]}>
                {tmpExp.atual&&<Ionicons name="checkmark" size={14} color={C.branco}/>}
              </View>
              <Text style={s.checkboxTxt}>Trabalho atual</Text>
            </TouchableOpacity>
            <Campo label="Descrição das Funções"><InputLinha value={tmpExp.descricao} onChangeText={v=>setTmpExp(e=>({...e,descricao:v}))} placeholder="Descreve as tuas responsabilidades..." multiline numberOfLines={3} maxLength={400}/></Campo>
            <Campo label="Principais Resultados Obtidos"><InputLinha value={tmpExp.resultados} onChangeText={v=>setTmpExp(e=>({...e,resultados:v}))} placeholder="Ex: Reduzi custos em 15%..." multiline numberOfLines={3} maxLength={400}/></Campo>
            <TouchableOpacity style={[s.btnPrimario,{marginVertical:20}]} onPress={()=>{
              if(!tmpExp.empresa.trim()||!tmpExp.cargo.trim()||!tmpExp.dataInicio.trim()){Alert.alert('Campos obrigatórios','Preenche empresa, cargo e data de início.');return;}
              if(expEditando==='novo') setExperiencias(prev=>[...prev,tmpExp]);
              else setExperiencias(prev=>prev.map((e,i)=>i===expEditando?tmpExp:e));
              setModalExp(false);
            }}><Text style={s.btnPrimarioTxt}>{expEditando==='novo'?'Adicionar':'Guardar'}</Text></TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={modalCert} transparent animationType="slide" onRequestClose={()=>setModalCert(false)}>
        <View style={s.modalOverlay}><View style={[s.modalSheet,{maxHeight:'80%'}]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Certificação</Text>
            <TouchableOpacity onPress={()=>setModalCert(false)}><Ionicons name="close" size={22} color={C.cinza4}/></TouchableOpacity>
          </View>
          <ScrollView style={{paddingHorizontal:20}}>
            <Campo label="Nome da Formação" obrigatorio><InputLinha value={tmpCert.nome} onChangeText={v=>setTmpCert(c=>({...c,nome:v}))} placeholder="Ex: HSE Level 1"/></Campo>
            <Campo label="Instituição"><InputLinha value={tmpCert.instituicao} onChangeText={v=>setTmpCert(c=>({...c,instituicao:v}))} placeholder="Ex: Total Energies"/></Campo>
            <Campo label="Data"><InputLinha value={tmpCert.data} onChangeText={v=>setTmpCert(c=>({...c,data:v}))} placeholder="MM/AAAA" keyboardType="numeric"/></Campo>
            <Campo label="Certificado"><UploadBtnComPreview uri={tmpCert.certificadoUri} onPress={()=>escolherDocumento(u=>setTmpCert(c=>({...c,certificadoUri:u})))} label="Anexar certificado (opcional)" titulo={tmpCert.nome}/></Campo>
            <TouchableOpacity style={[s.btnPrimario,{marginVertical:20}]} onPress={()=>{
              if(!tmpCert.nome.trim()){Alert.alert('Campo obrigatório','Introduz o nome da formação.');return;}
              if(certEditando==='novo') setCertificacoes(prev=>[...prev,tmpCert]);
              else setCertificacoes(prev=>prev.map((c,i)=>i===certEditando?tmpCert:c));
              setModalCert(false);
            }}><Text style={s.btnPrimarioTxt}>{certEditando==='novo'?'Adicionar':'Guardar'}</Text></TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={modalIdioma} transparent animationType="slide" onRequestClose={()=>setModalIdioma(false)}>
        <View style={s.modalOverlay}><View style={[s.modalSheet,{maxHeight:'80%'}]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Idioma</Text>
            <TouchableOpacity onPress={()=>setModalIdioma(false)}><Ionicons name="close" size={22} color={C.cinza4}/></TouchableOpacity>
          </View>
          <ScrollView style={{paddingHorizontal:20}}>
            <Campo label="Idioma" obrigatorio><Selector valor={tmpIdioma.idioma} placeholder="Selecionar idioma" onPress={()=>setModalIdiomaItem(true)}/></Campo>
            <Campo label="Nível de Leitura" obrigatorio><Selector valor={tmpIdioma.leitura} placeholder="Selecionar nível" onPress={()=>setModalNivelLeitura(true)}/></Campo>
            <Campo label="Nível de Escrita" obrigatorio><Selector valor={tmpIdioma.escrita} placeholder="Selecionar nível" onPress={()=>setModalNivelEscrita(true)}/></Campo>
            <Campo label="Nível de Conversação" obrigatorio><Selector valor={tmpIdioma.conversacao} placeholder="Selecionar nível" onPress={()=>setModalNivelConv(true)}/></Campo>
            <TouchableOpacity style={[s.btnPrimario,{marginVertical:20}]} onPress={()=>{
              if(!tmpIdioma.idioma||!tmpIdioma.leitura||!tmpIdioma.escrita||!tmpIdioma.conversacao){Alert.alert('Campos obrigatórios','Preenche todos os campos do idioma.');return;}
              if(idiomaEditando==='novo') setIdiomas(prev=>[...prev,tmpIdioma]);
              else setIdiomas(prev=>prev.map((id,i)=>i===idiomaEditando?tmpIdioma:id));
              setModalIdioma(false);
            }}><Text style={s.btnPrimarioTxt}>{idiomaEditando==='novo'?'Adicionar':'Guardar'}</Text></TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>

      <Visualizador />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.branco},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:12,backgroundColor:C.branco,borderBottomWidth:0.5,borderBottomColor:C.cinza2},
  headerVoltar:{padding:4},
  logoRow:{flexDirection:'row',alignItems:'center'},
  logoConnect:{fontSize:22,fontWeight:'800',color:C.preto},
  logoAll:{fontSize:22,fontWeight:'800',color:C.vermelho},
  progressoWrap:{height:4,backgroundColor:C.cinza2},
  progressoBarra:{height:4,backgroundColor:C.azul},
  progressoInfoRow:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:6},
  progressoLabel:{fontSize:12,color:C.cinza3,fontWeight:'500'},
  progressoPerc:{fontSize:12,color:C.azul,fontWeight:'700'},
  scrollContent:{paddingHorizontal:20,paddingTop:20,paddingBottom:40},
  passoTitulo:{fontSize:28,fontWeight:'900',color:C.preto,lineHeight:34,marginBottom:4},
  passoNumero:{fontSize:13,color:C.cinza3,marginBottom:24},
  campo:{marginBottom:20},
  campoLabel:{fontSize:14,fontWeight:'600',color:C.cinza4,marginBottom:6},
  inputLinha:{flexDirection:'row',alignItems:'center',borderBottomWidth:1.5,borderBottomColor:C.cinza2,paddingVertical:6},
  inputTexto:{flex:1,fontSize:15,color:C.preto,paddingVertical:6},
  prefixoTxt:{fontSize:15,color:C.preto,fontWeight:'600',marginRight:8},
  selector:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1.5,borderBottomColor:C.cinza2,paddingVertical:12},
  selectorTxt:{flex:1,fontSize:15,color:C.preto},
  seccaoTitulo:{fontSize:17,fontWeight:'800',color:C.preto,marginTop:8,marginBottom:8},
  seccaoDescricao:{fontSize:13,color:C.cinza3,lineHeight:19,marginBottom:16},
  seccaoDivisor:{height:1,backgroundColor:C.cinza2,marginVertical:20},
  chipGrupo:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4},
  chip:{paddingHorizontal:14,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:C.cinza2,backgroundColor:C.cinza1},
  chipAtivo:{borderColor:C.azul,backgroundColor:C.azulClaro},
  chipTxt:{fontSize:13,color:C.cinza3,fontWeight:'500'},
  chipTxtAtivo:{color:C.azul,fontWeight:'700'},
  contadorTxt:{fontSize:11,color:C.cinza3,textAlign:'right',marginTop:4},
  itemCard:{flexDirection:'row',alignItems:'flex-start',borderWidth:1,borderColor:C.cinza2,borderRadius:10,padding:14,marginBottom:12,backgroundColor:C.cinza1},
  itemCardTitulo:{fontSize:14,fontWeight:'700',color:C.preto,marginBottom:2},
  itemCardSub:{fontSize:13,color:C.cinza4,marginBottom:2},
  itemCardData:{fontSize:12,color:C.cinza3},
  itemCardAcoes:{flexDirection:'row',gap:14,marginLeft:8},
  btnAdicionar:{flexDirection:'row',alignItems:'center',gap:8,borderWidth:1.5,borderColor:C.azul,borderStyle:'dashed',borderRadius:10,padding:14,justifyContent:'center',marginTop:4},
  btnAdicionarTxt:{fontSize:14,fontWeight:'700',color:C.azul},
  infoBox:{flexDirection:'row',alignItems:'flex-start',gap:8,backgroundColor:C.azulClaro,borderRadius:8,padding:12,marginTop:12},
  infoBoxTxt:{flex:1,fontSize:12,color:C.azulEscuro,lineHeight:17},
  duasColunasWrap:{flexDirection:'row',alignItems:'flex-start'},
  verificacaoBox:{backgroundColor:C.cinza1,borderRadius:10,padding:16,marginBottom:8},
  verificacaoEmail:{fontSize:14,color:C.cinza4,fontWeight:'600',marginBottom:12},
  badgeVerificado:{flexDirection:'row',alignItems:'center',gap:6},
  badgeVerificadoTxt:{fontSize:13,fontWeight:'700',color:C.verde},
  btnVerificar:{backgroundColor:C.azul,borderRadius:8,paddingVertical:10,paddingHorizontal:20,alignSelf:'flex-start'},
  btnVerificarTxt:{fontSize:13,fontWeight:'700',color:C.branco},
  codigoRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:12},
  codigoInput:{flex:1,borderWidth:1.5,borderColor:C.azul,borderRadius:8,paddingHorizontal:12,paddingVertical:10,fontSize:16,letterSpacing:4,textAlign:'center',color:C.preto},
  btnConfirmar:{backgroundColor:C.azulEscuro,borderRadius:8,paddingHorizontal:14,paddingVertical:10},
  btnConfirmarTxt:{fontSize:13,fontWeight:'700',color:C.branco},
  estadoLista:{gap:10},
  estadoLinha:{flexDirection:'row',alignItems:'center',gap:10},
  estadoTxt:{fontSize:14,color:C.cinza3,fontWeight:'500'},
  checkboxLinha:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:16},
  checkbox:{width:20,height:20,borderRadius:4,borderWidth:2,borderColor:C.cinza2,alignItems:'center',justifyContent:'center'},
  checkboxTxt:{fontSize:14,color:C.cinza4},
  btnPrimario:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.azul,borderRadius:28,paddingVertical:16,marginTop:8},
  btnPrimarioTxt:{fontSize:16,fontWeight:'700',color:C.branco},
  separador:{flexDirection:'row',alignItems:'center',marginVertical:16},
  separadorLinha:{flex:1,height:1,backgroundColor:C.cinza2},
  separadorTxt:{paddingHorizontal:14,fontSize:14,color:C.cinza3,fontWeight:'500'},
  btnSecundarioPill:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:28,paddingVertical:15,borderWidth:1.5,borderColor:C.cinza2,backgroundColor:C.branco,marginBottom:8},
  btnSecundarioPillTxt:{fontSize:15,color:C.cinza4,fontWeight:'600'},
  termosWrap:{paddingHorizontal:22,paddingTop:28,paddingBottom:40},
  termosSubtitulo:{fontSize:14,color:C.cinza3,lineHeight:21,marginBottom:28},
  termosBloco:{flexDirection:'row',gap:14,marginBottom:20,padding:14,backgroundColor:C.cinza1,borderRadius:10,borderLeftWidth:3,borderLeftColor:C.azul},
  termosBlocoIcone:{marginTop:2},
  termosBlocoTitulo:{fontSize:14,fontWeight:'700',color:C.preto,marginBottom:4},
  termosBlocoTxt:{fontSize:13,color:C.cinza3,lineHeight:19},
  legalSection:{marginBottom:20},
  legalTxt:{fontSize:13,color:C.cinza3,lineHeight:20},
  legalLink:{color:C.azul,fontWeight:'600'},
  pendenteWrap:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  pendenteIconeWrap:{marginBottom:24},
  pendenteIconeCirculo:{width:100,height:100,borderRadius:50,backgroundColor:C.azulClaro,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.azul},
  pendenteTitulo:{fontSize:24,fontWeight:'800',color:C.preto,textAlign:'center',marginBottom:8},
  pendenteSubtitulo:{fontSize:15,color:C.cinza3,textAlign:'center',marginBottom:24,lineHeight:22},
  pendenteCard:{width:'100%',borderWidth:1,borderColor:C.cinza2,borderRadius:12,overflow:'hidden',marginBottom:24},
  pendenteCardLinha:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:14},
  pendenteCardTxt:{fontSize:13,color:C.cinza4,flex:1,lineHeight:19},
  pendenteDivisor:{height:1,backgroundColor:C.cinza2},
  fotoPerfilWrap:{alignItems:'center',marginBottom:24},
  fotoPerfilCirculo:{width:100,height:100,borderRadius:50,backgroundColor:C.cinza1,alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:C.cinza2,overflow:'hidden',position:'relative'},
  fotoPerfilImagem:{width:100,height:100,borderRadius:50},
  fotoPerfilBadge:{position:'absolute',bottom:4,right:4,width:26,height:26,borderRadius:13,backgroundColor:C.azul,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.branco},
  fotoPerfilLabel:{fontSize:13,color:C.cinza3,marginTop:8,fontWeight:'500'},
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.35)',justifyContent:'flex-end'},
  modalSheet:{backgroundColor:C.branco,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'75%',paddingBottom:36},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:18,borderBottomWidth:0.5,borderBottomColor:C.cinza2},
  modalTitulo:{fontSize:16,fontWeight:'800',color:C.preto},
  modalBusca:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:C.cinza1,marginHorizontal:20,marginTop:12,marginBottom:6,paddingHorizontal:12,borderRadius:8,height:40,borderWidth:1,borderColor:C.cinza2},
  modalBuscaInput:{flex:1,fontSize:14,color:C.preto},
  modalItem:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:0.5,borderBottomColor:C.cinza1},
  modalItemTxt:{fontSize:14,color:C.cinza4,fontWeight:'500'},
});