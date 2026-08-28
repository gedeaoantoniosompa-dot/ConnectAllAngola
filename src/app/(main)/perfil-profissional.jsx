/**
 * perfil-profissional.jsx — ConnectAll Angola
 * Modo Profissional — design LinkedIn corporativo azul
 * Etapas: beneficios → info → contactos → paypay → dashboard
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const { width: W } = Dimensions.get('window');

// ── Paleta LinkedIn azul corporativo ────────────────────────────────────────
const C = {
  azul:       '#0A66C2',
  azulEsc:    '#004182',
  azulClaro:  '#EEF3FB',
  azulMedio:  '#CBE0F5',
  cinza1:     '#F3F2EE',
  cinza2:     '#E4E2DF',
  cinza3:     '#666360',
  cinza4:     '#1B1B1B',
  branco:     '#FFFFFF',
  preto:      '#000000',
  verde:      '#057642',
  verdeClaro: '#EAF6EF',
  vermelho:   '#CC1016',
  dourado:    '#915907',
  laranjaClaro: '#FDF6EC',
};

const CATEGORIAS = [
  'Tecnologia & TI','Negócios & Empreendedorismo','Educação & Formação',
  'Saúde & Bem-estar','Arte & Design','Música & Entretenimento',
  'Desporto & Fitness','Gastronomia & Culinária','Moda & Estilo',
  'Construção & Imobiliário','Finanças & Investimento','Direito & Advocacia',
  'Marketing & Publicidade','Fotografia & Vídeo','Logística & Transportes',
  'Agricultura & Agronegócio','Beleza & Estética','Viagens & Turismo',
  'Criador de Conteúdo','Influencer Digital','Coaching & Mentoria',
  'Engenharia & Indústria','Petróleo & Gás','Telecomunicações',
  'Administração Pública','ONG & Setor Social','Outro',
];

// Etapas do formulário
const ETAPAS = ['beneficios', 'info', 'contactos', 'paypay', 'dashboard'];

// Indicador de progresso
function BarraProgresso({ etapaActual }) {
  const etapasForm = ['info', 'contactos', 'paypay'];
  const idx = etapasForm.indexOf(etapaActual);
  if (idx < 0) return null;
  const pct = ((idx + 1) / etapasForm.length) * 100;
  return (
    <View style={s.progressoFundo}>
      <Animated.View style={[s.progressoBarra, { width: `${pct}%` }]} />
    </View>
  );
}

function LabelEtapa({ etapaActual }) {
  const mapa = {
    info:      'Passo 1 de 3 — Informações Profissionais',
    contactos: 'Passo 2 de 3 — Contactos',
    paypay:    'Passo 3 de 3 — Método de Pagamento',
  };
  const txt = mapa[etapaActual];
  if (!txt) return null;
  return <Text style={s.labelEtapa}>{txt}</Text>;
}

function Campo({ label, obrig, dica, children, valor, maxLen }) {
  return (
    <View style={s.campoWrap}>
      <Text style={s.campoLabel}>
        {label}{obrig && <Text style={{ color: C.vermelho }}> *</Text>}
      </Text>
      {children}
      {dica && <Text style={s.campoDica}>{dica}</Text>}
      {maxLen && <Text style={s.campoContador}>{(valor || '').length}/{maxLen}</Text>}
    </View>
  );
}

function Input({ style, ...props }) {
  return (
    <TextInput
      style={[s.input, props.multiline && { height: 110, textAlignVertical: 'top', paddingTop: 12 }, style]}
      placeholderTextColor={C.cinza3}
      {...props}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function PerfilProfissionalScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();

  const [tela,            setTela]            = useState('loading');
  const [dadosProf,       setDadosProf]       = useState(null);

  // Etapa 1 — Info
  const [categoria,  setCategoria]  = useState('');
  const [profissao,  setProfissao]  = useState('');
  const [descricao,  setDescricao]  = useState('');
  const [localizacao,setLocalizacao]= useState('');

  // Etapa 2 — Contactos
  const [telefone,  setTelefone]  = useState('');
  const [whatsapp,  setWhatsapp]  = useState('');
  const [emailProf, setEmailProf] = useState('');
  const [website,   setWebsite]   = useState('');

  // Etapa 3 — PayPay
  const [kwik, setKwik] = useState('');
  const [iban, setIban] = useState('');

  // UI
  const [modalCat,  setModalCat]  = useState(false);
  const [pesqCat,   setPesqCat]   = useState('');
  const [guardando, setGuardando] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const irPara = (t) => {
    fadeAnim.setValue(0);
    setTela(t);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!user?.uid) { irPara('beneficios'); return; }

    const unsub = onSnapshot(
      doc(db, 'users', user.uid, 'perfis', 'profissional'),
      (snap) => {
        if (snap.exists() && snap.data()?.ativo === true) {
          const d = snap.data();
          setDadosProf(d);
          setCategoria(d.categoria || '');
          setProfissao(d.profissao || '');
          setDescricao(d.descricao || '');
          setLocalizacao(d.localizacao || '');
          setTelefone(d.telefone || '');
          setWhatsapp(d.whatsapp || '');
          setEmailProf(d.emailProf || '');
          setWebsite(d.website || '');
          setKwik(d.kwik || '');
          setIban(d.iban || '');
          irPara('dashboard');
        } else if (snap.exists() && snap.data()?.ativo === false) {
          // Admin desativou → volta ao início
          setDadosProf(null);
          irPara('beneficios');
          // Limpa campos do profissional
          setCategoria(''); setProfissao(''); setDescricao('');
          setLocalizacao('');
          setTelefone(''); setWhatsapp(''); setEmailProf(''); setWebsite('');
          setKwik(''); setIban('');
        } else {
          // Sem doc ou sem ativo → volta para benefícios com dados base (como antes)
          setDadosProf(null);
          setTelefone(perfil?.telPrincipal || perfil?.telefone || '');
          setWhatsapp(perfil?.telPrincipal || perfil?.telefone || '');
          setEmailProf(perfil?.emailContacto || '');
          setLocalizacao(perfil?.cidade || perfil?.provincia || '');
          irPara('beneficios');
        }
      },
      () => irPara('beneficios')
    );

    return () => unsub();
  }, [user?.uid]);

  const guardarInfo = async () => {
    if (!categoria)        { Alert.alert('Campo obrigatório', 'Seleciona a categoria.'); return; }
    if (!profissao.trim()) { Alert.alert('Campo obrigatório', 'Escreve o teu título profissional.'); return; }
    if (!descricao.trim()) { Alert.alert('Campo obrigatório', 'Adiciona uma descrição dos teus serviços.'); return; }
    if (!localizacao.trim()){ Alert.alert('Campo obrigatório', 'Indica a tua localização.'); return; }
    irPara('contactos');
  };

  const guardarContactos = async () => {
    if (!telefone.trim()) { Alert.alert('Campo obrigatório', 'O telefone é obrigatório.'); return; }
    irPara('paypay');
  };

  const guardarTudo = async (skip = false) => {
    if (!skip && !kwik.trim() && !iban.trim()) {
      Alert.alert('Dados em falta', 'Introduz o Número Kwik ou o IBAN PayPay para receber pagamentos.');
      return;
    }
    setGuardando(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'perfis', 'profissional'), {
        ativo: true,
        categoria, profissao, descricao: descricao.trim(),
        localizacao: localizacao.trim(),
        telefone: telefone.trim(), whatsapp: whatsapp.trim(),
        emailProf: emailProf.trim(), website: website.trim(),
        kwik: kwik.trim(), iban: iban.trim(),
        pagamentoConfigurado: (!skip && (kwik.trim() || iban.trim())) ? true : false,
        uid: user.uid,
        atualizadoEm: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, 'users', user.uid), {
        modoProfissional: true,
        categoriaProfissional: categoria,
      }, { merge: true });


      // onSnapshot já atualiza dadosProf e navega para o dashboard
      // Não precisas de getDoc aqui

    } catch {
      Alert.alert('Erro', 'Não foi possível guardar. Tenta novamente.');
    } finally {
      setGuardando(false);
    }
  };

  const catsFiltradas = pesqCat.trim()
    ? CATEGORIAS.filter(c => c.toLowerCase().includes(pesqCat.toLowerCase()))
    : CATEGORIAS;

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (tela === 'loading') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centrado}><ActivityIndicator size="large" color={C.azul} /></View>
      </SafeAreaView>
    );
  }

  // ─── TELA 1 — BENEFÍCIOS ─────────────────────────────────────────────────
  if (tela === 'beneficios') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cinza4} />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Modo Profissional</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Hero */}
          <View style={s.heroBand}>
            <View style={s.heroIconeWrap}>
              <Ionicons name="briefcase" size={32} color={C.branco} />
            </View>
            <Text style={s.heroTitulo}>ConnectAll Profissional</Text>
            <Text style={s.heroSub}>
              Apresenta os teus serviços, cresce a tua rede e monetiza o teu trabalho em Angola.
            </Text>
          </View>

          {/* Benefícios */}
          <View style={s.card}>
            <Text style={s.cardTitulo}>O que tens acesso</Text>
            {[
              { icone: 'person-circle-outline', label: 'Perfil de prestador de serviços',  sub: 'Contactos, portfólio e área de atuação visíveis' },
              { icone: 'megaphone-outline',     label: 'Divulga os teus serviços',         sub: 'Chega a potenciais clientes na tua área' },
              { icone: 'stats-chart-outline',   label: 'Estatísticas do perfil',           sub: 'Visualizações, alcance e crescimento' },
              { icone: 'ribbon-outline',        label: 'Verificação de conta',             sub: 'Selo de criador verificado ConnectAll' },
              { icone: 'cash-outline',          label: 'Monetização via PayPay',           sub: 'Recebe ganhos diretamente na tua carteira' },
            ].map((b, i) => (
              <View key={i} style={s.beneficioLinha}>
                <View style={s.beneficioIcone}>
                  <Ionicons name={b.icone} size={20} color={C.azul} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.beneficioLabel}>{b.label}</Text>
                  <Text style={s.beneficioSub}>{b.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Requisitos */}
          <View style={s.card}>
            <Text style={s.cardTitulo}>Requisitos para monetização</Text>
            <Text style={s.cardDescricao}>
              Ativa o perfil profissional e preenche os dados. Após atingires 100 a 200 seguidores reais e publicares com regularidade, a tua conta é analisada para verificação e monetização.
            </Text>
            <View style={s.reqRow}>
              <View style={s.reqItem}>
                <Ionicons name="people-outline" size={20} color={C.azul} />
                <Text style={s.reqValor}>100–200</Text>
                <Text style={s.reqLabel}>Seguidores</Text>
              </View>
              <View style={s.reqDivisor} />
              <View style={s.reqItem}>
                <Ionicons name="create-outline" size={20} color={C.azul} />
                <Text style={s.reqValor}>Regular</Text>
                <Text style={s.reqLabel}>Publicações</Text>
              </View>
              <View style={s.reqDivisor} />
              <View style={s.reqItem}>
                <Ionicons name="shield-checkmark-outline" size={20} color={C.azul} />
                <Text style={s.reqValor}>Análise</Text>
                <Text style={s.reqLabel}>pela equipa</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={s.btnPrimario} onPress={() => irPara('info')}>
            <Text style={s.btnPrimarioTxt}>Ativar Perfil Profissional</Text>
            <Ionicons name="arrow-forward" size={18} color={C.branco} />
          </TouchableOpacity>

          <Text style={s.notaLegal}>
            Ao ativar, aceitas os Termos do ConnectAll Angola para Criadores e Prestadores de Serviços.&nbsp;
            <Text
              style={{ color: C.azul, textDecorationLine: 'underline' }}
              onPress={() => router.push('/(main)/termos-criadores-prestadores-servicos')}
            >
              Ver termos
            </Text>
          </Text>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── TELA 2 — INFORMAÇÕES PROFISSIONAIS ──────────────────────────────────
  if (tela === 'info') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => irPara('beneficios')} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cinza4} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitulo}>Perfil Profissional</Text>
            <LabelEtapa etapaActual="info" />
          </View>
        </View>
        <BarraProgresso etapaActual="info" />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

            <View style={s.card}>
              <Text style={s.cardTitulo}>Área profissional</Text>

              <Campo label="Categoria" obrig>
                <TouchableOpacity style={s.selectorBtn} onPress={() => setModalCat(true)}>
                  <Text style={categoria ? s.selectorTxt : s.selectorPlaceholder}>
                    {categoria || 'Seleciona a tua área'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={C.cinza3} />
                </TouchableOpacity>
              </Campo>

              <Campo label="Título profissional" obrig>
                <Input
                  placeholder="Ex: Designer Gráfico, Consultor, Coach..."
                  value={profissao}
                  onChangeText={setProfissao}
                  maxLength={80}
                />
              </Campo>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitulo}>Apresentação</Text>

              <Campo
                label="Descrição dos serviços"
                obrig
                dica="Descreve o que fazes e para quem. Sê concreto."
                valor={descricao}
                maxLen={350}
              >
                <Input
                  placeholder="Ex: Ajudo empresas angolanas a crescer nas redes sociais através de estratégias de conteúdo e campanhas pagas..."
                  value={descricao}
                  onChangeText={setDescricao}
                  multiline
                  maxLength={350}
                />
              </Campo>

              <Campo label="Localização" obrig>
                <Input
                  placeholder="Ex: Luanda, Viana..."
                  value={localizacao}
                  onChangeText={setLocalizacao}
                />
              </Campo>
            </View>

            <TouchableOpacity style={s.btnPrimario} onPress={guardarInfo}>
              <Text style={s.btnPrimarioTxt}>Continuar</Text>
              <Ionicons name="arrow-forward" size={18} color={C.branco} />
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal categorias */}
        <Modal visible={modalCat} transparent animationType="slide" onRequestClose={() => setModalCat(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitulo}>Categoria profissional</Text>
                <TouchableOpacity onPress={() => { setModalCat(false); setPesqCat(''); }}>
                  <Ionicons name="close" size={22} color={C.cinza4} />
                </TouchableOpacity>
              </View>
              <View style={s.searchBox}>
                <Feather name="search" size={14} color={C.cinza3} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Pesquisar..."
                  placeholderTextColor={C.cinza3}
                  value={pesqCat}
                  onChangeText={setPesqCat}
                  autoCapitalize="none"
                />
                {pesqCat.length > 0 && (
                  <TouchableOpacity onPress={() => setPesqCat('')}>
                    <Ionicons name="close-circle" size={15} color={C.cinza3} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {catsFiltradas.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.modalItem, categoria === cat && s.modalItemActivo]}
                    onPress={() => { setCategoria(cat); setModalCat(false); setPesqCat(''); }}
                  >
                    <Text style={[s.modalItemTxt, categoria === cat && { color: C.azul, fontWeight: '700' }]}>{cat}</Text>
                    {categoria === cat && <Ionicons name="checkmark-circle" size={18} color={C.azul} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ─── TELA 3 — CONTACTOS ──────────────────────────────────────────────────
  if (tela === 'contactos') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => irPara('info')} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cinza4} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitulo}>Perfil Profissional</Text>
            <LabelEtapa etapaActual="contactos" />
          </View>
        </View>
        <BarraProgresso etapaActual="contactos" />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

            <View style={s.card}>
              <Text style={s.cardTitulo}>Como os clientes te contactam</Text>
              <Text style={s.cardDescricao}>
                Estes dados ficam visíveis no teu perfil público para potenciais clientes.
              </Text>

              <Campo label="Telefone" obrig>
                <Input
                  placeholder="+244 9XX XXX XXX"
                  value={telefone}
                  onChangeText={setTelefone}
                  keyboardType="phone-pad"
                />
              </Campo>

              <Campo label="WhatsApp" dica="Deixa em branco se for o mesmo número do telefone">
                <Input
                  placeholder="+244 9XX XXX XXX"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                />
              </Campo>

              <Campo label="E-mail profissional">
                <Input
                  placeholder="email@exemplo.com"
                  value={emailProf}
                  onChangeText={setEmailProf}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Campo>

              <Campo label="Website ou portfólio">
                <Input
                  placeholder="https://..."
                  value={website}
                  onChangeText={setWebsite}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </Campo>
            </View>

            <TouchableOpacity style={s.btnPrimario} onPress={guardarContactos}>
              <Text style={s.btnPrimarioTxt}>Continuar</Text>
              <Ionicons name="arrow-forward" size={18} color={C.branco} />
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── TELA 4 — PAYPAY ─────────────────────────────────────────────────────
  if (tela === 'paypay') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => irPara('contactos')} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cinza4} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitulo}>Perfil Profissional</Text>
            <LabelEtapa etapaActual="paypay" />
          </View>
        </View>
        <BarraProgresso etapaActual="paypay" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          <View style={s.card}>
            <Text style={s.cardTitulo}>Conta PayPay para receber ganhos</Text>
            <Text style={s.cardDescricao}>
              Quando a tua conta for verificada e monetizada, os ganhos são transferidos diretamente para a tua carteira PayPay.
            </Text>

            <Campo label="Número Kwik" dica="Encontra-se no menu principal da app PayPay">
              <Input
                placeholder="Ex: 924 000 001"
                value={kwik}
                onChangeText={setKwik}
                keyboardType="phone-pad"
              />
            </Campo>

            <View style={s.ouRow}>
              <View style={s.ouLinha} />
              <Text style={s.ouTxt}>ou</Text>
              <View style={s.ouLinha} />
            </View>

            <Campo label="IBAN PayPay" dica="Começa com AO06...">
              <Input
                placeholder="AO06 0000 0000 0000 0000 0000 0"
                value={iban}
                onChangeText={setIban}
                autoCapitalize="characters"
              />
            </Campo>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitulo}>Ainda não tens conta PayPay?</Text>
            <Text style={s.cardDescricao}>Cria a tua conta gratuitamente e regresa para vincular.</Text>
            <TouchableOpacity
              style={s.btnSecundario}
              onPress={() => Linking.openURL('https://play.google.com/store/search?q=paypay+angola')}
            >
              <Ionicons name="logo-google-playstore" size={16} color={C.azul} />
              <Text style={s.btnSecundarioTxt}>Baixar PayPay na Play Store</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.btnPrimario} onPress={() => guardarTudo(false)} disabled={guardando}>
            {guardando
              ? <ActivityIndicator size="small" color={C.branco} />
              : <><Text style={s.btnPrimarioTxt}>Concluir e Ativar</Text><Ionicons name="checkmark" size={18} color={C.branco} /></>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.btnSkip} onPress={() => guardarTudo(true)} disabled={guardando}>
            <Text style={s.btnSkipTxt}>Configurar pagamentos mais tarde</Text>
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── TELA 5 — DASHBOARD ──────────────────────────────────────────────────
  if (tela === 'dashboard') {
    const verificado  = dadosProf?.verificado === true;
    const monetizado  = dadosProf?.monetizado === true;
    const pagConf     = dadosProf?.pagamentoConfigurado === true;
    const seguidores  = dadosProf?.seguidores || perfil?.seguidores || 0;
    const META_SEG    = 100;

    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={C.cinza4} />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Perfil Profissional</Text>
          <TouchableOpacity onPress={() => irPara('info')} style={s.headerBtn}>
            <Ionicons name="create-outline" size={22} color={C.cinza4} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Card de identidade */}
          <View style={s.identidadeCard}>
            <View style={s.identidadeIcone}>
              <Ionicons name="briefcase" size={28} color={C.azul} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.identidadeNome}>{dadosProf?.profissao || profissao}</Text>
              <Text style={s.identidadeCat}>{dadosProf?.categoria || categoria}</Text>
              <Text style={s.identidadeLocal}>
                <Ionicons name="location-outline" size={12} color={C.cinza3} /> {dadosProf?.localizacao || localizacao}
              </Text>
            </View>
            <View style={s.badgeAtivo}>
              <View style={s.badgeAtivoPonto} />
              <Text style={s.badgeAtivoTxt}>Ativo</Text>
            </View>
          </View>

          {/* Estatísticas */}
          <View style={s.statsRow}>
            {[
              { label: 'Seguidores',    valor: seguidores,                icone: 'people-outline'     },
              { label: 'Visualizações', valor: dadosProf?.visualizacoes || 0, icone: 'eye-outline'    },
              { label: 'Conexões',      valor: dadosProf?.conexoes || 0,  icone: 'person-add-outline' },
            ].map((st, i) => (
              <View key={i} style={s.statBloco}>
                <Ionicons name={st.icone} size={18} color={C.azul} />
                <Text style={s.statValor}>{st.valor.toLocaleString()}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>

          {/* Verificação */}
          {!verificado && (
            <View style={s.card}>
              <Text style={s.cardTitulo}>Progresso para verificação</Text>
              <Text style={s.cardDescricao}>
                Precisas de {Math.max(0, META_SEG - seguidores)} seguidores adicionais para solicitar a verificação.
              </Text>
              <View style={s.progRow}>
                <Text style={s.progTxt}>{seguidores} / {META_SEG} seguidores</Text>
                <Text style={s.progPct}>{Math.min(100, Math.round((seguidores / META_SEG) * 100))}%</Text>
              </View>
              <View style={s.progFundo}>
                <View style={[s.progBarra, { width: `${Math.min(100, (seguidores / META_SEG) * 100)}%` }]} />
              </View>
              {seguidores >= META_SEG && (
                <TouchableOpacity style={[s.btnPrimario, { marginTop: 12 }]}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={C.branco} />
                  <Text style={s.btnPrimarioTxt}>Solicitar verificação</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {verificado && (
            <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={[s.identidadeIcone, { backgroundColor: C.verdeClaro }]}>
                <Ionicons name="shield-checkmark" size={24} color={C.verde} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitulo, { color: C.verde }]}>Conta Verificada</Text>
                <Text style={s.cardDescricao}>O teu perfil tem o selo ConnectAll.</Text>
              </View>
            </View>
          )}

          {/* Monetização */}
          <View style={s.card}>
            <Text style={s.cardTitulo}>Monetização</Text>
            {monetizado ? (
              <View style={s.ganhosWrap}>
                <Text style={s.ganhosLabel}>Ganhos totais</Text>
                <Text style={s.ganhosValor}>{dadosProf?.ganhos || '0,00'} AOA</Text>
              </View>
            ) : (
              <Text style={s.cardDescricao}>
                Disponível após a verificação da conta. Continua a publicar e a crescer.
              </Text>
            )}

            {!pagConf ? (
              <TouchableOpacity style={[s.btnSecundario, { marginTop: 10 }]} onPress={() => irPara('paypay')}>
                <Ionicons name="link-outline" size={16} color={C.azul} />
                <Text style={s.btnSecundarioTxt}>Vincular conta PayPay</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.payConf}>
                <Ionicons name="checkmark-circle" size={16} color={C.verde} />
                <Text style={s.payConfTxt}>Conta PayPay vinculada</Text>
              </View>
            )}
          </View>

          {/* Editar */}
          <TouchableOpacity style={s.btnSecundario} onPress={() => irPara('info')}>
            <Ionicons name="create-outline" size={16} color={C.azul} />
            <Text style={s.btnSecundarioTxt}>Editar perfil profissional</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.cinza1 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  headerBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitulo:{ fontSize: 16, fontWeight: '700', color: C.preto },
  labelEtapa:  { fontSize: 11, color: C.cinza3, marginTop: 1 },

  progressoFundo: { height: 3, backgroundColor: C.cinza2 },
  progressoBarra: { height: 3, backgroundColor: C.azul },

  scroll: { padding: 16, gap: 12 },

  card: { backgroundColor: C.branco, borderRadius: 8, padding: 16, gap: 14, borderWidth: 0.5, borderColor: C.cinza2 },
  cardTitulo:   { fontSize: 15, fontWeight: '700', color: C.preto },
  cardDescricao:{ fontSize: 13, color: C.cinza3, lineHeight: 19 },

  // Hero band
  heroBand:      { backgroundColor: C.azul, borderRadius: 8, padding: 24, alignItems: 'center', gap: 10 },
  heroIconeWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroTitulo:    { fontSize: 20, fontWeight: '800', color: C.branco, textAlign: 'center' },
  heroSub:       { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20 },

  // Benefícios
  beneficioLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  beneficioIcone: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  beneficioLabel: { fontSize: 14, fontWeight: '600', color: C.preto },
  beneficioSub:   { fontSize: 12, color: C.cinza3, marginTop: 2 },

  // Requisitos
  reqRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: C.azulClaro, borderRadius: 8, padding: 14 },
  reqItem:   { alignItems: 'center', gap: 4, flex: 1 },
  reqValor:  { fontSize: 15, fontWeight: '800', color: C.azul },
  reqLabel:  { fontSize: 11, color: C.cinza3, textAlign: 'center' },
  reqDivisor:{ width: 1, height: 40, backgroundColor: C.azulMedio },

  // Campos
  campoWrap:      { gap: 5 },
  campoLabel:     { fontSize: 12, fontWeight: '600', color: C.cinza4 },
  campoDica:      { fontSize: 11, color: C.cinza3, lineHeight: 16 },
  campoContador:  { fontSize: 11, color: C.cinza3, textAlign: 'right' },
  input:          { backgroundColor: C.cinza1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.preto, borderWidth: 1, borderColor: C.cinza2 },
  selectorBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.cinza1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 13, borderWidth: 1, borderColor: C.cinza2 },
  selectorTxt:         { fontSize: 14, color: C.preto, flex: 1 },
  selectorPlaceholder: { fontSize: 14, color: C.cinza3, flex: 1 },

  // PayPay
  ouRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ouLinha:{ flex: 1, height: 1, backgroundColor: C.cinza2 },
  ouTxt:  { fontSize: 12, color: C.cinza3 },

  // Botões
  btnPrimario:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.azul, borderRadius: 24, paddingVertical: 15 },
  btnPrimarioTxt: { color: C.branco, fontSize: 15, fontWeight: '700' },
  btnSecundario:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.azul, borderRadius: 24, paddingVertical: 13 },
  btnSecundarioTxt: { color: C.azul, fontSize: 14, fontWeight: '700' },
  btnSkip:    { alignItems: 'center', paddingVertical: 12 },
  btnSkipTxt: { fontSize: 13, color: C.cinza3, textDecorationLine: 'underline' },
  notaLegal:  { fontSize: 12, color: C.azul, textAlign: 'center', lineHeight: 17, fontWeight: '500' },

  // Dashboard
  identidadeCard:  { backgroundColor: C.branco, borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: C.cinza2 },
  identidadeIcone: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  identidadeNome:  { fontSize: 15, fontWeight: '700', color: C.preto },
  identidadeCat:   { fontSize: 13, color: C.azul, marginTop: 1 },
  identidadeLocal: { fontSize: 12, color: C.cinza3, marginTop: 2 },
  badgeAtivo:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.verdeClaro, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeAtivoPonto: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.verde },
  badgeAtivoTxt:   { fontSize: 11, fontWeight: '700', color: C.verde },

  statsRow:   { flexDirection: 'row', gap: 10 },
  statBloco:  { flex: 1, backgroundColor: C.branco, borderRadius: 8, padding: 14, alignItems: 'center', gap: 4, borderWidth: 0.5, borderColor: C.cinza2 },
  statValor:  { fontSize: 20, fontWeight: '800', color: C.preto },
  statLabel:  { fontSize: 11, color: C.cinza3, textAlign: 'center' },

  progRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  progTxt:   { fontSize: 12, color: C.cinza3 },
  progPct:   { fontSize: 12, fontWeight: '700', color: C.azul },
  progFundo: { height: 6, backgroundColor: C.cinza2, borderRadius: 3, marginTop: 6 },
  progBarra: { height: 6, backgroundColor: C.azul, borderRadius: 3 },

  ganhosWrap:  { alignItems: 'center', paddingVertical: 8 },
  ganhosLabel: { fontSize: 12, color: C.cinza3 },
  ganhosValor: { fontSize: 28, fontWeight: '800', color: C.preto },

  payConf:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  payConfTxt: { fontSize: 13, color: C.verde, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: C.branco, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitulo:  { fontSize: 16, fontWeight: '700', color: C.preto },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cinza1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8, borderWidth: 1, borderColor: C.cinza2 },
  searchInput:  { flex: 1, fontSize: 14, color: C.preto },
  modalItem:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  modalItemActivo: { backgroundColor: C.azulClaro, marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 6 },
  modalItemTxt:  { fontSize: 14, color: C.cinza4 },
});