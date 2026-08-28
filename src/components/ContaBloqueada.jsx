import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { auth, db } from '../config/firebase';

// ── FIX: adicionado estado 'eliminada' ──
const CONFIG = {
  eliminada: {
    cor: '#1A1A1A', corFundo: '#FFFFFF', corIcone: '#F0F0F0',
    icone: 'trash-outline',
    titulo: 'A tua conta foi eliminada',
    subtitulo: 'A tua conta foi removida permanentemente da ConnectAll Angola.',
    badge: 'Conta eliminada',
    acaoPrincipal: 'Criar nova conta',
    mostrarSair: false, mostrarContacto: true, mostrarContestar: false,
    mostrarVerificacao: false, mostrarReportar: false,
  },
  banida: {
    cor: '#EF4444', corFundo: '#FEF2F2', corIcone: '#FEE2E2',
    icone: 'ban-outline',
    titulo: 'A tua conta foi banida permanentemente',
    subtitulo: 'Detectámos violações repetidas dos nossos Termos de Serviço. O acesso foi revogado.',
    badge: 'Conta banida', acaoPrincipal: 'Contestar esta decisão',
    mostrarSair: true, mostrarContacto: true, mostrarContestar: true,
    mostrarVerificacao: false, mostrarReportar: true,
  },
  suspensa: {
    cor: '#0095F6', corFundo: '#FFFFFF', corIcone: '#F0F0F0',
    icone: 'time-outline',
    titulo: 'A tua conta foi suspensa',
    subtitulo: 'Tens os próximos dias para fazer uma apelação antes da tua conta ser desabilitada permanentemente.',
    badge: 'Conta suspensa', acaoPrincipal: 'Contestar suspensão',
    mostrarSair: true, mostrarContacto: true, mostrarContestar: true,
    mostrarVerificacao: false, mostrarReportar: true,
  },
  aviso: {
    cor: '#0095F6', corFundo: '#FFFFFF', corIcone: '#F0F0F0',
    icone: 'notifications-outline',
    titulo: 'Aviso Importante',
    subtitulo: 'Tens um aviso ou notificação importante da nossa equipa.',
    badge: 'Notificação', acaoPrincipal: 'Li e compreendi',
    mostrarSair: false, mostrarContacto: false, mostrarContestar: false,
    mostrarVerificacao: false, mostrarReportar: false,
  },
  verificacao: {
    cor: '#0095F6', corFundo: '#FFFFFF', corIcone: '#F0F0F0',
    icone: 'shield-checkmark-outline',
    titulo: 'Verificação de identidade necessária',
    subtitulo: 'A tua conta requer verificação de identidade antes de poderes continuar.',
    badge: 'Verificação pendente', acaoPrincipal: 'Iniciar verificação',
    mostrarSair: false, mostrarContacto: true, mostrarContestar: false,
    mostrarVerificacao: true, mostrarReportar: false,
  },
  revisao: {
    cor: '#0095F6', corFundo: '#FFFFFF', corIcone: '#F0F0F0',
    icone: 'search-outline',
    titulo: 'Conta em revisão',
    subtitulo: 'A tua conta está a ser analisada pela nossa equipa. Podes continuar em modo limitado.',
    badge: 'Em revisão', acaoPrincipal: 'Continuar em modo limitado',
    mostrarSair: false, mostrarContacto: true, mostrarContestar: false,
    mostrarVerificacao: false, mostrarReportar: false,
  },
};

function formatarData(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-PT', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function diasRestantes(iso) {
  if (!iso) return null;
  try {
    const diff = new Date(iso).getTime() - Date.now();
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return dias > 0 ? dias : 0;
  } catch { return null; }
}

function Logo() {
  return (
    <View style={logo.wrap}>
      <Text style={logo.text}>
        <Text style={logo.connect}>Connect</Text>
        <Text style={logo.all}>All</Text>
      </Text>
    </View>
  );
}
const logo = StyleSheet.create({
  wrap:    { alignItems: 'center', marginBottom: 28 },
  text:    { fontSize: 32, letterSpacing: -0.5 },
  connect: { color: '#000000', fontWeight: '800' },
  all:     { color: '#E00000', fontWeight: '800' },
});

function ModalSuporte({ visivel, onFechar, uid, email, nome, estado, referencia, tipo }) {
  const [passo, setPasso]       = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({
    assunto: '', mensagem: '', telefone: '',
    nomeCompleto: nome || '', docTipo: 'BI', docNumero: '', dataNascimento: '',
  });
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visivel) {
      setPasso(1);
      setForm(f => ({
        ...f, nomeCompleto: nome || '', assunto: '', mensagem: '',
        telefone: '', docNumero: '', dataNascimento: '',
      }));
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 280, useNativeDriver: true }).start();
    }
  }, [visivel]);

  const assuntoPadrao = () => {
    if (tipo === 'contestar') return `Contestação de ${estado === 'banida' ? 'banimento' : 'suspensão'} — ${referencia || uid}`;
    if (tipo === 'verificacao') return `Verificação de identidade — ${uid}`;
    if (tipo === 'eliminada') return `Pedido de suporte — conta eliminada — ${uid}`;
    return `Pedido de suporte — ${uid}`;
  };

  const enviar = async () => {
    if (!form.mensagem.trim()) {
      Alert.alert('Mensagem vazia', 'Por favor escreve uma mensagem antes de enviar.');
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, 'suporte'), {
        uid, email: email || '', nome: nome || '',
        tipo, estadoConta: estado, referencia: referencia || '',
        assunto: form.assunto || assuntoPadrao(),
        mensagem: form.mensagem, telefone: form.telefone,
        estado: 'pendente', timestamp: serverTimestamp(),
      });
      setPasso(2);
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar. Tenta novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const titulos = {
    suporte:   'Contactar Suporte',
    contestar: estado === 'banida' ? 'Contestar Banimento' : 'Contestar Suspensão',
    verificacao: 'Verificação de Identidade',
    eliminada: 'Contactar Suporte',
  };

  return (
    <Modal visible={visivel} transparent animationType="none" onRequestClose={onFechar}>
      <View style={ms.fundo}>
        <TouchableOpacity style={ms.overlay} onPress={onFechar} activeOpacity={1} />
        <Animated.View style={[ms.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={ms.handle} />
          {passo === 1 ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={ms.headerRow}>
                  <Text style={ms.titulo}>{titulos[tipo] || 'Suporte'}</Text>
                  <TouchableOpacity onPress={onFechar} style={ms.fecharBtn}>
                    <Ionicons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                <Text style={ms.label}>Assunto</Text>
                <TextInput style={ms.input} value={form.assunto} onChangeText={v => setForm(f => ({ ...f, assunto: v }))} placeholder={assuntoPadrao()} placeholderTextColor="#aaa" />
                <Text style={ms.label}>Mensagem *</Text>
                <TextInput
                  style={[ms.input, ms.inputArea]} value={form.mensagem}
                  onChangeText={v => setForm(f => ({ ...f, mensagem: v }))}
                  placeholder="Descreve o teu problema ou questão..."
                  placeholderTextColor="#aaa" multiline numberOfLines={5}
                />
                <Text style={ms.label}>Telefone de contacto (opcional)</Text>
                <TextInput style={ms.input} value={form.telefone} onChangeText={v => setForm(f => ({ ...f, telefone: v }))} placeholder="+244 9XX XXX XXX" placeholderTextColor="#aaa" keyboardType="phone-pad" />
                <Text style={ms.aviso}>A nossa equipa responderá em até 72 horas para {email || 'o teu email'}.</Text>
                <TouchableOpacity style={[ms.btnEnviar, enviando && { opacity: 0.6 }]} onPress={enviar} disabled={enviando} activeOpacity={0.85}>
                  {enviando
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Ionicons name="send" size={16} color="#fff" /><Text style={ms.btnEnviarText}>Enviar</Text></>
                  }
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <View style={ms.sucessoWrap}>
              <View style={ms.sucessoIcone}><Ionicons name="checkmark-circle" size={56} color="#06D6A0" /></View>
              <Text style={ms.sucessoTitulo}>Pedido enviado!</Text>
              <Text style={ms.sucessoSub}>
                Recebemos o teu pedido e responderemos em breve para {email || 'o teu email'}.
              </Text>
              <TouchableOpacity style={ms.btnFechar} onPress={onFechar} activeOpacity={0.85}>
                <Text style={ms.btnFecharText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  fundo:            { flex: 1, justifyContent: 'flex-end' },
  overlay:          { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, maxHeight: '92%' },
  handle:           { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20 },
  headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  titulo:           { fontSize: 18, fontWeight: '700', color: '#111', flex: 1 },
  fecharBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  label:            { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input:            { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111', backgroundColor: '#FAFAFA' },
  inputArea:        { height: 110, textAlignVertical: 'top', paddingTop: 11 },
  aviso:            { fontSize: 12, color: '#9CA3AF', marginTop: 16, marginBottom: 20, lineHeight: 18, textAlign: 'center' },
  btnEnviar:        { backgroundColor: '#0095F6', borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnEnviarText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  sucessoWrap:      { alignItems: 'center', paddingVertical: 32, paddingBottom: 48 },
  sucessoIcone:     { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F0FDF9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  sucessoTitulo:    { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 10 },
  sucessoSub:       { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 12 },
  btnFechar:        { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48 },
  btnFecharText:    { fontWeight: '600', fontSize: 15, color: '#374151' },
});

const TIPOS_DOC = [
  { id: 'bi',            label: 'Bilhete de Identidade', icone: 'card-outline' },
  { id: 'passaporte',    label: 'Passaporte',            icone: 'book-outline' },
  { id: 'passe_escolar', label: 'Passe Escolar',         icone: 'school-outline' },
  { id: 'passe_servico', label: 'Passe de Serviço',      icone: 'briefcase-outline' },
];

const MOTIVOS = [
  'Nunca violei os Termos de Utilização',
  'A minha conta foi comprometida/hackeada',
  'Fui denunciado(a) injustamente',
  'Não reconheço esta decisão',
  'Outro motivo',
];

function ModalRecuperarConta({ visivel, onFechar, uid, email, nome, estado }) {
  const [passo, setPasso]       = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({
    nomeCompleto: nome || '', emailContacto: email || '',
    telefone: '', motivoSelecionado: '', descricao: '',
    tipoDoc: '', frenteDoc: null, versoDoc: null, selfie: null,
  });

  useEffect(() => {
    if (visivel) {
      setPasso(1);
      setForm({
        nomeCompleto: nome || '', emailContacto: email || '',
        telefone: '', motivoSelecionado: '', descricao: '',
        tipoDoc: '', frenteDoc: null, versoDoc: null, selfie: null,
      });
    }
  }, [visivel]);

  const actualizarForm = (campo, valor) =>
    setForm(prev => ({ ...prev, [campo]: valor }));

  const escolherImagem = async (campo) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.'); return; }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true,
    });
    if (!resultado.canceled) actualizarForm(campo, resultado.assets[0]);
  };

  const tirarFoto = async (campo) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara.'); return; }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (!resultado.canceled) actualizarForm(campo, resultado.assets[0]);
  };

  const uploadImagem = async (imagemAsset, caminho) => {
    const storage  = getStorage();
    const sRef     = ref(storage, caminho);
    const resposta = await fetch(imagemAsset.uri);
    const blob     = await resposta.blob();
    await uploadBytes(sRef, blob);
    return getDownloadURL(sRef);
  };

  const validarPasso = () => {
    if (passo === 1) {
      if (!form.nomeCompleto.trim() || !form.emailContacto.trim() || !form.telefone.trim()) {
        Alert.alert('Campos obrigatórios', 'Preenche todos os campos de contacto.'); return false;
      }
    }
    if (passo === 2) {
      if (!form.motivoSelecionado || !form.descricao.trim()) {
        Alert.alert('Campos obrigatórios', 'Selecciona um motivo e descreve a situação.'); return false;
      }
    }
    if (passo === 3) {
      if (!form.tipoDoc)   { Alert.alert('Documento obrigatório', 'Selecciona o tipo de documento.'); return false; }
      if (!form.frenteDoc) { Alert.alert('Documento obrigatório', 'Anexa a frente do documento.'); return false; }
    }
    return true;
  };

  const avancar = () => { if (validarPasso()) setPasso(p => p + 1); };

  const submeter = async () => {
    if (!validarPasso()) return;
    setEnviando(true);
    try {
      const ts        = Date.now();
      const urlFrente = form.frenteDoc ? await uploadImagem(form.frenteDoc, `recuperacao/${uid}/${ts}_frente`) : null;
      const urlVerso  = form.versoDoc  ? await uploadImagem(form.versoDoc,  `recuperacao/${uid}/${ts}_verso`)  : null;
      const urlSelfie = form.selfie    ? await uploadImagem(form.selfie,    `recuperacao/${uid}/${ts}_selfie`) : null;
      await addDoc(collection(db, 'pedidosRecuperacao'), {
        uid, emailContacto: form.emailContacto, nomeCompleto: form.nomeCompleto,
        telefone: form.telefone, motivo: form.motivoSelecionado, descricao: form.descricao,
        tipoDocumento: form.tipoDoc, urlFrenteDoc: urlFrente, urlVersoDoc: urlVerso, urlSelfie,
        estadoConta: estado, status: 'pendente', timestamp: serverTimestamp(),
      });
      setPasso(5);
    } catch (erro) {
      Alert.alert('Erro', 'Não foi possível enviar o pedido. Tenta novamente.');
      console.error(erro);
    } finally {
      setEnviando(false);
    }
  };

  const UploadImagem = ({ campo, titulo, descricao }) => (
    <View style={rec.uploadContainer}>
      <Text style={rec.uploadTitulo}>{titulo}</Text>
      <Text style={rec.uploadDesc}>{descricao}</Text>
      {form[campo] ? (
        <View style={rec.imagemPreview}>
          <Image source={{ uri: form[campo].uri }} style={rec.imagemPreviewImg} />
          <TouchableOpacity style={rec.imagemRemover} onPress={() => actualizarForm(campo, null)}>
            <Ionicons name="close-circle" size={22} color="#E53E3E" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={rec.uploadBotoes}>
          <TouchableOpacity style={rec.uploadBotao} onPress={() => escolherImagem(campo)}>
            <Ionicons name="images-outline" size={20} color="#0095F6" />
            <Text style={rec.uploadBotaoTexto}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={rec.uploadBotao} onPress={() => tirarFoto(campo)}>
            <Ionicons name="camera-outline" size={20} color="#0095F6" />
            <Text style={rec.uploadBotaoTexto}>Câmara</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={rec.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={rec.header}>
            <TouchableOpacity
              onPress={() => passo > 1 && passo < 5 ? setPasso(p => p - 1) : onFechar()}
              style={rec.voltarBotao}
            >
              <Ionicons name="arrow-back" size={20} color="#1A202C" />
            </TouchableOpacity>
            <Text style={rec.headerTitulo}>Recuperação de Conta</Text>
            <View style={{ width: 36 }} />
          </View>

          {passo < 5 && (
            <View style={rec.progressoContainer}>
              {[1, 2, 3, 4].map(n => (
                <View key={n} style={[rec.progressoSegmento, { backgroundColor: n <= passo ? '#0095F6' : '#E2E8F0' }]} />
              ))}
            </View>
          )}
          {passo < 5 && <Text style={rec.progressoLabel}>Passo {passo} de 4</Text>}

          {passo === 1 && (
            <View style={rec.seccao}>
              <View style={rec.seccaoHeader}>
                <View style={[rec.seccaoIcone, { backgroundColor: '#EBF8FF' }]}>
                  <Ionicons name="person-outline" size={22} color="#0095F6" />
                </View>
                <Text style={rec.seccaoTitulo}>Dados de Contacto</Text>
                <Text style={rec.seccaoDesc}>Precisamos de confirmar quem és para processar o teu pedido.</Text>
              </View>
              <Text style={rec.inputLabel}>Nome completo *</Text>
              <TextInput style={rec.input} value={form.nomeCompleto} onChangeText={v => actualizarForm('nomeCompleto', v)} placeholder="Ex: João Manuel Silva" placeholderTextColor="#A0AEC0" />
              <Text style={rec.inputLabel}>E-mail de contacto *</Text>
              <TextInput style={rec.input} value={form.emailContacto} onChangeText={v => actualizarForm('emailContacto', v)} placeholder="Ex: joao@email.com" placeholderTextColor="#A0AEC0" keyboardType="email-address" autoCapitalize="none" />
              <Text style={rec.inputLabel}>Número de telefone *</Text>
              <TextInput style={rec.input} value={form.telefone} onChangeText={v => actualizarForm('telefone', v)} placeholder="Ex: +244 9XX XXX XXX" placeholderTextColor="#A0AEC0" keyboardType="phone-pad" />
            </View>
          )}

          {passo === 2 && (
            <View style={rec.seccao}>
              <View style={rec.seccaoHeader}>
                <View style={[rec.seccaoIcone, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="help-circle-outline" size={22} color="#D97706" />
                </View>
                <Text style={rec.seccaoTitulo}>Motivo do Pedido</Text>
                <Text style={rec.seccaoDesc}>Explica porque acreditas que esta decisão foi um erro.</Text>
              </View>
              <Text style={rec.inputLabel}>Selecciona o motivo *</Text>
              {MOTIVOS.map(motivo => (
                <TouchableOpacity key={motivo} style={[rec.motivoItem, form.motivoSelecionado === motivo && rec.motivoItemActivo]} onPress={() => actualizarForm('motivoSelecionado', motivo)}>
                  <View style={[rec.motivoRadio, form.motivoSelecionado === motivo && rec.motivoRadioActivo]}>
                    {form.motivoSelecionado === motivo && <View style={rec.motivoRadioPonto} />}
                  </View>
                  <Text style={[rec.motivoTexto, form.motivoSelecionado === motivo && { color: '#0095F6', fontWeight: '600' }]}>{motivo}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[rec.inputLabel, { marginTop: 16 }]}>Descreve a situação *</Text>
              <TextInput style={[rec.input, { height: 120, textAlignVertical: 'top' }]} value={form.descricao} onChangeText={v => actualizarForm('descricao', v)} placeholder="Descreve com detalhe o que aconteceu..." placeholderTextColor="#A0AEC0" multiline numberOfLines={5} />
            </View>
          )}

          {passo === 3 && (
            <View style={rec.seccao}>
              <View style={rec.seccaoHeader}>
                <View style={[rec.seccaoIcone, { backgroundColor: '#F0FFF4' }]}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#38A169" />
                </View>
                <Text style={rec.seccaoTitulo}>Verificação de Identidade</Text>
                <Text style={rec.seccaoDesc}>Anexa um documento válido para confirmar a tua identidade.</Text>
              </View>
              <Text style={rec.inputLabel}>Tipo de documento *</Text>
              <View style={rec.tiposDocGrid}>
                {TIPOS_DOC.map(tipo => (
                  <TouchableOpacity key={tipo.id} style={[rec.tipoDocItem, form.tipoDoc === tipo.id && rec.tipoDocItemActivo]} onPress={() => actualizarForm('tipoDoc', tipo.id)}>
                    <Ionicons name={tipo.icone} size={22} color={form.tipoDoc === tipo.id ? '#0095F6' : '#A0AEC0'} />
                    <Text style={[rec.tipoDocTexto, form.tipoDoc === tipo.id && { color: '#0095F6', fontWeight: '600' }]}>{tipo.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <UploadImagem campo="frenteDoc" titulo="Frente do documento *" descricao="Fotografia clara da parte da frente" />
              <UploadImagem campo="versoDoc"  titulo="Verso do documento (opcional)" descricao="Fotografia da parte de trás" />
            </View>
          )}

          {passo === 4 && (
            <View style={rec.seccao}>
              <View style={rec.seccaoHeader}>
                <View style={[rec.seccaoIcone, { backgroundColor: '#FAF5FF' }]}>
                  <Ionicons name="camera-outline" size={22} color="#805AD5" />
                </View>
                <Text style={rec.seccaoTitulo}>Selfie de Confirmação</Text>
                <Text style={rec.seccaoDesc}>Tira uma selfie segurando o documento junto ao rosto.</Text>
              </View>
              <View style={rec.selfieInstrucoes}>
                {['Iluminação adequada no rosto', 'Documento visível e legível', 'Expressão neutra, sem óculos de sol', 'Fundo limpo e sem distrações'].map((inst, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#38A169" />
                    <Text style={{ fontSize: 13, color: '#4A5568' }}>{inst}</Text>
                  </View>
                ))}
              </View>
              <UploadImagem campo="selfie" titulo="Selfie com documento (opcional)" descricao="Recomendado para agilizar a verificação" />
              <View style={rec.avisoPrivacidade}>
                <Ionicons name="lock-closed-outline" size={14} color="#718096" />
                <Text style={rec.avisoPrivacidadeTexto}>Os teus documentos são encriptados e utilizados exclusivamente para verificação de identidade. São eliminados automaticamente após 30 dias.</Text>
              </View>
            </View>
          )}

          {passo === 5 && (
            <View style={rec.sucessoContainer}>
              <View style={[rec.iconeCirculo, { backgroundColor: '#F0FFF4' }]}>
                <Ionicons name="checkmark-circle" size={56} color="#38A169" />
              </View>
              <Text style={rec.sucessoTitulo}>Pedido enviado com sucesso</Text>
              <Text style={rec.sucessoTexto}>O teu pedido será analisado pela nossa equipa em até 5 dias úteis.</Text>
              <Text style={rec.sucessoTexto}>Receberás uma resposta no e-mail: <Text style={{ fontWeight: '700', color: '#1A202C' }}>{form.emailContacto}</Text></Text>
              <View style={rec.sucessoInfo}>
                <Ionicons name="time-outline" size={16} color="#D97706" />
                <Text style={{ fontSize: 13, color: '#D97706', fontWeight: '600', marginLeft: 6 }}>Tempo estimado: 3 a 5 dias úteis</Text>
              </View>
              <TouchableOpacity style={[rec.botaoPrincipal, { marginTop: 32 }]} onPress={onFechar}>
                <Text style={rec.botaoPrincipalTexto}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}

          {passo < 5 && (
            <View style={rec.navegacao}>
              {passo < 4 ? (
                <TouchableOpacity style={rec.botaoAvancar} onPress={avancar}>
                  <Text style={rec.botaoAvancarTexto}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[rec.botaoAvancar, enviando && { opacity: 0.7 }]} onPress={submeter} disabled={enviando}>
                  {enviando
                    ? <ActivityIndicator color="#FFF" />
                    : <><Text style={rec.botaoAvancarTexto}>Submeter pedido</Text><Ionicons name="send" size={16} color="#FFF" /></>
                  }
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rec = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#FFFFFF' },
  header:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F7FAFC' },
  voltarBotao:            { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7FAFC', justifyContent: 'center', alignItems: 'center' },
  headerTitulo:           { fontSize: 15, fontWeight: '700', color: '#1A202C' },
  progressoContainer:     { flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginTop: 16 },
  progressoSegmento:      { flex: 1, height: 4, borderRadius: 2 },
  progressoLabel:         { fontSize: 12, color: '#A0AEC0', textAlign: 'center', marginTop: 8, marginBottom: 8 },
  seccao:                 { paddingHorizontal: 20, paddingTop: 8 },
  seccaoHeader:           { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  seccaoIcone:            { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  seccaoTitulo:           { fontSize: 18, fontWeight: '700', color: '#1A202C', marginBottom: 8, textAlign: 'center' },
  seccaoDesc:             { fontSize: 14, color: '#718096', textAlign: 'center', lineHeight: 21 },
  inputLabel:             { fontSize: 13, fontWeight: '600', color: '#2D3748', marginBottom: 6 },
  input:                  { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14, fontSize: 15, color: '#1A202C', marginBottom: 16 },
  motivoItem:             { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F7FAFC', marginBottom: 8 },
  motivoItemActivo:       { borderColor: '#0095F6', backgroundColor: '#EBF8FF' },
  motivoRadio:            { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E0', justifyContent: 'center', alignItems: 'center' },
  motivoRadioActivo:      { borderColor: '#0095F6' },
  motivoRadioPonto:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0095F6' },
  motivoTexto:            { flex: 1, fontSize: 14, color: '#4A5568' },
  tiposDocGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tipoDocItem:            { width: '47%', alignItems: 'center', gap: 6, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F7FAFC' },
  tipoDocItemActivo:      { borderColor: '#0095F6', backgroundColor: '#EBF8FF' },
  tipoDocTexto:           { fontSize: 12, color: '#718096', textAlign: 'center' },
  uploadContainer:        { marginBottom: 20 },
  uploadTitulo:           { fontSize: 13, fontWeight: '600', color: '#2D3748', marginBottom: 4 },
  uploadDesc:             { fontSize: 12, color: '#A0AEC0', marginBottom: 10 },
  uploadBotoes:           { flexDirection: 'row', gap: 10 },
  uploadBotao:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#0095F6', borderStyle: 'dashed', backgroundColor: '#EBF8FF' },
  uploadBotaoTexto:       { fontSize: 14, color: '#0095F6', fontWeight: '600' },
  imagemPreview:          { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  imagemPreviewImg:       { width: '100%', height: 160, borderRadius: 10 },
  imagemRemover:          { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFF', borderRadius: 11 },
  selfieInstrucoes:       { backgroundColor: '#F0FFF4', borderRadius: 10, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#C6F6D5' },
  avisoPrivacidade:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F7FAFC', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  avisoPrivacidadeTexto:  { flex: 1, fontSize: 12, color: '#718096', lineHeight: 18 },
  navegacao:              { paddingHorizontal: 20, paddingTop: 16 },
  botaoAvancar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0095F6', paddingVertical: 16, borderRadius: 12 },
  botaoAvancarTexto:      { color: '#FFF', fontSize: 16, fontWeight: '700' },
  sucessoContainer:       { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48 },
  iconeCirculo:           { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  sucessoTitulo:          { fontSize: 22, fontWeight: '700', color: '#1A202C', textAlign: 'center', marginBottom: 16 },
  sucessoTexto:           { fontSize: 15, color: '#4A5568', textAlign: 'center', lineHeight: 24, marginBottom: 12 },
  sucessoInfo:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#FEF3C7' },
  botaoPrincipal:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: '#0095F6' },
  botaoPrincipalTexto:    { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

/* ── Ecrã Principal ContaBloqueada ── */
export default function ContaBloqueada({ dados, uid, email, nome, onNavegar, onTerminarSessao }) {
  const router = useRouter();
  const cfg    = CONFIG[dados?.estado] || CONFIG.banida;
  const dias   = diasRestantes(dados?.dataFim);

  const [modalTipo, setModalTipo]           = useState(null);
  const [modalRecuperar, setModalRecuperar] = useState(false);
  const [acaoCarregando, setAcaoCarregando] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleAcaoPrincipal = async () => {
    if (dados.estado === 'eliminada') {
      // Redireciona para criar conta
      if (onNavegar) onNavegar('/(auth)/register');
      else router.replace('/(auth)/register');
    } else if (dados.estado === 'banida' || dados.estado === 'suspensa') {
      setModalTipo('contestar');
    } else if (dados.estado === 'verificacao') {
      setModalTipo('verificacao');
    } else if (dados.estado === 'aviso' && dados.politicaUrl) {
      Linking.openURL(dados.politicaUrl);
    }
  };

  const handleSair = async () => {
    setAcaoCarregando(true);
    try { await signOut(auth); } catch (_) {}
    setAcaoCarregando(false);
  };

  const AvatarPlaceholder = () => (
    <View style={ig.avatarWrap}>
      <View style={ig.avatarCircle}>
        <Ionicons name="person" size={40} color="#C7C7C7" />
      </View>
    </View>
  );

  const renderSeccoes = () => {
    // ── FIX: tela de conta eliminada ──
    if (dados.estado === 'eliminada') return (
      <>
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que isso significa</Text>
          <Text style={ig.seccaoTexto}>
            A tua conta foi removida permanentemente da ConnectAll Angola. Todos os teus dados, publicações e ligações foram eliminados.
          </Text>
        </View>
        <View style={ig.divisor} />
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que podes fazer</Text>
          <Text style={ig.seccaoTexto}>
            Podes criar uma nova conta com outro endereço de e-mail. Se acreditas que esta eliminação foi um erro, contacta o nosso suporte.
          </Text>
        </View>
      </>
    );

    if (dados.estado === 'suspensa') return (
      <>
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que isso significa</Text>
          <Text style={ig.seccaoTexto}>
            A tua conta não está visível para outras pessoas na ConnectAll Angola no momento e não podes utilizá-la.
          </Text>
        </View>
        <View style={ig.divisor} />
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que podes fazer</Text>
          <Text style={ig.seccaoTexto}>
            {`Tens ${dias !== null ? `mais ${dias} ${dias === 1 ? 'dia' : 'dias'}` : 'tempo'} para fazer uma apelação da nossa decisão.`}
          </Text>
        </View>
        {dados.motivo ? (
          <>
            <View style={ig.divisor} />
            <View style={ig.seccaoWrap}>
              <Text style={ig.seccaoTitulo}>Por que isso aconteceu</Text>
              <Text style={ig.seccaoTexto}>{dados.motivo}</Text>
            </View>
          </>
        ) : null}
      </>
    );

    if (dados.estado === 'banida') return (
      <>
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que isso significa</Text>
          <Text style={ig.seccaoTexto}>
            A tua conta foi removida permanentemente da ConnectAll Angola. Não é possível recuperá-la nem criar uma nova conta com os mesmos dados.
          </Text>
        </View>
        <View style={ig.divisor} />
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que podes fazer</Text>
          <Text style={ig.seccaoTexto}>
            Se acreditas que esta decisão foi um erro, podes submeter uma contestação. A nossa equipa irá analisar o teu caso e responder no prazo de 5 dias úteis.
          </Text>
        </View>
        {dados.motivo ? (
          <>
            <View style={ig.divisor} />
            <View style={ig.seccaoWrap}>
              <Text style={ig.seccaoTitulo}>Por que isso aconteceu</Text>
              <Text style={ig.seccaoTexto}>{dados.motivo}</Text>
            </View>
          </>
        ) : null}
        {dados.referencia ? (
          <>
            <View style={ig.divisor} />
            <View style={ig.seccaoWrap}>
              <Text style={ig.seccaoTitulo}>Referência do caso</Text>
              <Text style={[ig.seccaoTexto, { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: '#EF4444' }]}>
                {dados.referencia}
              </Text>
            </View>
          </>
        ) : null}
      </>
    );

    if (dados.estado === 'verificacao') return (
      <>
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que isso significa</Text>
          <Text style={ig.seccaoTexto}>
            A tua conta requer verificação de identidade. Este processo é necessário para garantir a segurança da tua conta e dos outros utilizadores.
          </Text>
        </View>
        <View style={ig.divisor} />
        <View style={ig.seccaoWrap}>
          <Text style={ig.seccaoTitulo}>O que podes fazer</Text>
          <Text style={ig.seccaoTexto}>
            Clica em "Iniciar verificação" abaixo para submeter os teus documentos de identidade.
          </Text>
        </View>
      </>
    );

    return (
      <View style={ig.seccaoWrap}>
        <Text style={ig.seccaoTitulo}>Mensagem da equipa</Text>
        <Text style={ig.seccaoTexto}>{dados.motivo || cfg.subtitulo}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={ig.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={ig.topbar}>
        <Logo />
        <View style={{ width: 36 }} />
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={ig.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>

          <AvatarPlaceholder />

          <Text style={ig.tituloPrincipal}>
            {dados.estado === 'eliminada'
              ? 'A tua conta foi eliminada'
              : dados.estado === 'suspensa'
                ? `A tua conta foi suspensa${nome ? `, ${nome.split(' ')[0]}` : ''}`
                : dados.descricaoAdmin
                  ? dados.descricaoAdmin.split('\n')[0]
                  : cfg.titulo}
          </Text>

          <Text style={ig.subtituloPrincipal}>{cfg.subtitulo}</Text>

          {dados.estado === 'suspensa' && dados.dataInicio && (
            <Text style={ig.dataTexto}>Suspensa em {formatarData(dados.dataInicio)}</Text>
          )}
          {dados.estado === 'suspensa' && dias !== null && (
            <View style={ig.diasWrap}>
              <Ionicons name="hourglass-outline" size={14} color="#8E8E8E" />
              <Text style={ig.diasTexto}>
                {dias === 0 ? 'Termina hoje' : `${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}`}
              </Text>
            </View>
          )}

          <View style={ig.divisorGrosso} />
          {renderSeccoes()}
          <View style={ig.divisorGrosso} />

          <View style={ig.botoesWrap}>
            <TouchableOpacity
              style={[ig.btnPrincipal, acaoCarregando && { opacity: 0.6 }]}
              onPress={handleAcaoPrincipal}
              disabled={acaoCarregando}
              activeOpacity={0.85}
            >
              {acaoCarregando
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={ig.btnPrincipalTexto}>{cfg.acaoPrincipal}</Text>
              }
            </TouchableOpacity>

            {(cfg.mostrarContacto || cfg.mostrarContestar) && (
              <View style={ig.botoesSecRow}>
                {cfg.mostrarContacto && (
                  <TouchableOpacity style={ig.btnSec} onPress={() => setModalTipo('suporte')} activeOpacity={0.8}>
                    <Ionicons name="headset-outline" size={15} color="#0095F6" />
                    <Text style={ig.btnSecTexto}>Suporte</Text>
                  </TouchableOpacity>
                )}
                {cfg.mostrarContestar && (
                  <TouchableOpacity style={ig.btnSec} onPress={() => setModalTipo('contestar')} activeOpacity={0.8}>
                    <Ionicons name="shield-outline" size={15} color="#0095F6" />
                    <Text style={ig.btnSecTexto}>Contestar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {cfg.mostrarSair && (
              <TouchableOpacity style={ig.btnSair} onPress={handleSair} disabled={acaoCarregando} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={15} color="#8E8E8E" />
                <Text style={ig.btnSairTexto}>Terminar sessão</Text>
              </TouchableOpacity>
            )}

            {cfg.mostrarReportar && (
              <TouchableOpacity style={ig.btnReportar} onPress={() => setModalRecuperar(true)} activeOpacity={0.8}>
                <Ionicons name="document-text-outline" size={14} color="#8E8E8E" />
                <Text style={ig.btnReportarTexto}>Reportar um problema · Verificação de identidade</Text>
                <Ionicons name="chevron-forward" size={13} color="#C7C7C7" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={ig.rodape}>ConnectAll Angola · v2.1</Text>
        </Animated.View>
      </Animated.ScrollView>

      <ModalSuporte
        visivel={modalTipo !== null}
        onFechar={() => setModalTipo(null)}
        uid={uid} email={email} nome={nome}
        estado={dados?.estado} referencia={dados?.referencia}
        tipo={modalTipo || 'suporte'}
      />
      <ModalRecuperarConta
        visivel={modalRecuperar}
        onFechar={() => setModalRecuperar(false)}
        uid={uid} email={email} nome={nome}
        estado={dados?.estado}
      />
    </SafeAreaView>
  );
}

const ig = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#FFFFFF' },
  scroll:             { paddingBottom: 48 },
  topbar:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#DBDBDB' },
  avatarWrap:         { alignItems: 'center', marginTop: 32, marginBottom: 20 },
  avatarCircle:       { width: 96, height: 96, borderRadius: 48, backgroundColor: '#EFEFEF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBDBDB' },
  tituloPrincipal:    { fontSize: 22, fontWeight: '700', color: '#1A1A1A', textAlign: 'center', paddingHorizontal: 32, marginBottom: 12, lineHeight: 30 },
  subtituloPrincipal: { fontSize: 14, color: '#8E8E8E', textAlign: 'center', paddingHorizontal: 32, lineHeight: 20, marginBottom: 8 },
  dataTexto:          { fontSize: 13, color: '#8E8E8E', textAlign: 'center', marginBottom: 12 },
  diasWrap:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 },
  diasTexto:          { fontSize: 13, color: '#8E8E8E', fontWeight: '500' },
  divisorGrosso:      { height: 6, backgroundColor: '#F0F0F0', marginVertical: 16 },
  divisor:            { height: 1, backgroundColor: '#DBDBDB', marginVertical: 16, marginHorizontal: 16 },
  seccaoWrap:         { paddingHorizontal: 16, paddingVertical: 4 },
  seccaoTitulo:       { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  seccaoTexto:        { fontSize: 14, color: '#4A4A4A', lineHeight: 22 },
  link:               { color: '#0095F6', fontWeight: '500' },
  botoesWrap:         { paddingHorizontal: 16, paddingTop: 4 },
  btnPrincipal:       { backgroundColor: '#0095F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnPrincipalTexto:  { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  botoesSecRow:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btnSec:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#DBDBDB', borderRadius: 12, paddingVertical: 12 },
  btnSecTexto:        { fontSize: 13, fontWeight: '600', color: '#0095F6' },
  btnSair:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EFEFEF', backgroundColor: '#FAFAFA', marginBottom: 10 },
  btnSairTexto:       { fontSize: 13, color: '#8E8E8E', fontWeight: '500' },
  btnReportar:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#EFEFEF', marginBottom: 10 },
  btnReportarTexto:   { flex: 1, fontSize: 13, color: '#8E8E8E', fontWeight: '500' },
  rodape:             { fontSize: 11, color: '#C7C7C7', textAlign: 'center', marginTop: 24 },
});