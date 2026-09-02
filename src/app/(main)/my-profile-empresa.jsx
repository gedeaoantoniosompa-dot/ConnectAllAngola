import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    Linking,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BloqueioAnonimo from '../../components/BloqueioAnonimo';
import { useVisualizador } from '../../components/VisualizadorFicheiro';
import { auth, db } from '../../config/firebase';
import { uploadFotoPerfil } from '../../config/utils/uploadFoto';
import { useUser } from '../../context/UserContext';

const C = {
  azul:      '#0A66C2',
  azulEscuro:'#004182',
  azulClaro: '#EEF3FB',
  branco:    '#FFFFFF',
  preto:     '#000000',
  cinza1:    '#F3F2EE',
  cinza2:    '#E9E5DF',
  cinza3:    '#666360',
  cinza4:    '#1B1B1B',
  verde:     '#057642',
  vermelho:  '#E00000',
  error:     '#CC1016',
};

function InfoLinha({ icone, label, valor }) {
  if (!valor) return null;
  return (
    <View style={s.infoLinha}>
      <View style={s.infoIconBox}><Feather name={icone} size={15} color={C.azul} /></View>
      <View style={s.infoMeta}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValor}>{String(valor)}</Text>
      </View>
    </View>
  );
}

function SeccaoCard({ children }) {
  return <View style={s.card}>{children}</View>;
}

function SeccaoHeader({ titulo, onEdit }) {
  return (
    <View style={s.seccaoHeaderRow}>
      <Text style={s.seccaoTitulo}>{titulo}</Text>
      {onEdit && (
        <TouchableOpacity onPress={onEdit} style={s.seccaoIconBtn}>
          <Feather name="edit-2" size={18} color={C.cinza4} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function BadgeVerificacao({ nivel }) {
  const configs = {
    0: { cor: '#9CA3AF', bg: '#F3F4F6', texto: 'Não verificada',     icone: 'clock-outline' },
    1: { cor: '#D97706', bg: '#FEF3C7', texto: 'Verificação básica', icone: 'checkmark-circle-outline' },
    2: { cor: '#0A66C2', bg: '#EEF3FB', texto: 'Verificada',         icone: 'shield-checkmark-outline' },
    3: { cor: '#057642', bg: '#D1FAE5', texto: 'Empresa Premium',    icone: 'shield-checkmark' },
  };
  const cfg = configs[nivel] || configs[0];
  return (
    <View style={[s.badgeVerif, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icone} size={14} color={cfg.cor} />
      <Text style={[s.badgeVerifTxt, { color: cfg.cor }]}>{cfg.texto}</Text>
    </View>
  );
}

export default function MyProfileEmpresaScreen() {
  const router = useRouter();
  const { user, perfil, carregando, guardarPerfil } = useUser();
  const { abrir, Visualizador } = useVisualizador();

  const [atualizandoLogo, setAtualizandoLogo] = useState(false);
  const [atualizandoCapa, setAtualizandoCapa] = useState(false);
  const [modalImagem, setModalImagem]         = useState(false);
  const [imagemExpandida, setImagemExpandida] = useState('');
  const [modalBloqueio, setModalBloqueio]     = useState(false);
  const [bannerEmpresa, setBannerEmpresa]     = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracoes', 'banners'), (snap) => {
      if (snap.exists()) setBannerEmpresa(snap.data().empresa || null);
    });
    return unsub;
  }, []);

  const verificarAcesso = () => {
    if (!user || user.isAnonymous) { setModalBloqueio(true); return false; }
    return true;
  };

  if (carregando) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <ActivityIndicator size="large" color={C.azul} />
        <Text style={s.loadingTxt}>A carregar perfil da empresa...</Text>
      </SafeAreaView>
    );
  }
  if (!perfil || !user) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Feather name="alert-circle" size={48} color={C.error} />
        <Text style={s.erroTitulo}>Sessão Expirada</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.loginBtnTxt}>Voltar ao Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Dados da empresa
  const nomeEmpresa   = perfil.nomeEmpresa || perfil.nome || 'Empresa';
  const setor         = perfil.setor || perfil.area || perfil.cargo || '';
  const dimensao      = perfil.dimensao || '';
  const anoFundacao   = perfil.anoFundacao || '';
  const descricao     = perfil.bio || perfil.descricao || '';
  const missao        = perfil.missao || '';
  const provincia     = perfil.provincia || perfil.cidade || '';
  const pais          = perfil.pais || 'Angola';
  const endereco      = perfil.endereco || '';
  const telefone      = perfil.telefone || perfil.telPrincipal || '';
  const whatsapp      = perfil.whatsapp || '';
  const emailEmpresa  = perfil.emailContacto || perfil.emailCorporativo || '';
  const website       = perfil.website || '';
  const nif           = perfil.nif || '';
  const nomeResp      = perfil.nomeResponsavel || '';
  const cargoResp     = perfil.cargoResponsavel || '';
  const nivelVerif    = perfil.nivelVerificacao || 0;
  const statusVerif   = perfil.verificacaoStatus || 'pendente';

  const temRedes = perfil.linkedin || perfil.facebook || perfil.instagram || perfil.twitter || perfil.youtube;
  const temDocs  = perfil.uriCV || perfil.cvUrl || perfil.uriBilhete;

  const irParaEditar = () => verificarAcesso() && router.push('/(auth)/profile-empresa');
  const abrirImagem  = (url) => { if (url) { setImagemExpandida(url); setModalImagem(true); } };

  const alterarLogo = async () => {
    if (!verificarAcesso()) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && user) {
      setAtualizandoLogo(true);
      try {
        const url = await uploadFotoPerfil(user.uid, r.assets[0].uri);
        await guardarPerfil({ fotoURL: url });
      } catch { await guardarPerfil({ fotoURL: r.assets[0].uri }); }
      finally { setAtualizandoLogo(false); }
    }
  };

  const alterarCapa = async () => {
    if (!verificarAcesso()) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (!r.canceled && user) {
      setAtualizandoCapa(true);
      try {
        const url = await uploadFotoPerfil(`${user.uid}_capa`, r.assets[0].uri);
        await guardarPerfil({ capaURL: url });
      } catch { await guardarPerfil({ capaURL: r.assets[0].uri }); }
      finally { setAtualizandoCapa(false); }
    }
  };

  const terminarSessao = async () => {
    try {
      if (user?.uid) await AsyncStorage.removeItem(`perfil_${user.uid}`);
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch { alert('Erro ao terminar sessão.'); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cinza1} />

      {/* Topbar */}
      <View style={s.topbar}>
        <View style={s.logoRow}>
          <Text style={s.logoConnect}>Connect</Text>
          <Text style={s.logoAll}>All</Text>
        </View>
        <TouchableOpacity style={s.topbarIconBtn} onPress={irParaEditar}>
          <Feather name="edit-3" size={20} color={C.cinza4} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── CARD PRINCIPAL ── */}
        <View style={s.cardPrincipal}>

          {/* Capa */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => perfil.capaURL ? abrirImagem(perfil.capaURL) : alterarCapa()}>
            {perfil.capaURL
              ? <ImageBackground source={{ uri: perfil.capaURL }} style={s.capa}>{atualizandoCapa && <ActivityIndicator color={C.branco} />}</ImageBackground>
              : <View style={s.capaVazia}>{atualizandoCapa ? <ActivityIndicator color={C.azul} /> : <Feather name="image" size={22} color={C.cinza3} />}</View>}
          </TouchableOpacity>
          <TouchableOpacity style={s.camaraCapaBtn} onPress={alterarCapa}>
            <Feather name="camera" size={16} color={C.cinza4} />
          </TouchableOpacity>

          {/* Logo + badge verificação */}
          <View style={s.avatarRow}>
            <TouchableOpacity style={s.logoCirculo} onPress={() => perfil.fotoURL ? abrirImagem(perfil.fotoURL) : alterarLogo()}>
              {atualizandoLogo
                ? <View style={s.logoFallback}><ActivityIndicator color={C.branco} /></View>
                : perfil.fotoURL
                  ? <Image source={{ uri: perfil.fotoURL }} style={s.logoImagem} />
                  : <View style={s.logoFallback}><Ionicons name="business" size={32} color={C.branco} /></View>}
            </TouchableOpacity>
            <BadgeVerificacao nivel={nivelVerif} />
          </View>

          {/* Info principal */}
          <View style={s.infoPrincipalWrap}>
            <Text style={s.nome}>{nomeEmpresa}</Text>
            {setor ? <Text style={s.subtitulo}>{setor}{dimensao ? ` · ${dimensao}` : ''}</Text> : null}
            {(provincia || pais) ? <Text style={s.localTxt}>{[provincia, pais].filter(Boolean).join(', ')}</Text> : null}
            {anoFundacao ? <Text style={s.fundacaoTxt}>Fundada em {anoFundacao}</Text> : null}

            {/* Status de verificação */}
            {statusVerif === 'pendente' && (
              <View style={s.pendenteBadge}>
                <Ionicons name="time-outline" size={14} color="#D97706" />
                <Text style={s.pendenteBadgeTxt}>Verificação em análise · até 48h úteis</Text>
              </View>
            )}

            {/* Botões de acção */}
            <View style={s.botoesAcaoRow}>
              <TouchableOpacity style={s.btnPrimario} onPress={irParaEditar}>
                <Text style={s.btnPrimarioTxt}>Editar página</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecundario} onPress={() => router.push('/(main)/create-post')}>
                <Text style={s.btnSecundarioTxt}>Publicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── ANÁLISE ── */}
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Análise</Text>
          <View style={s.sugestoesVisivel}>
            <Ionicons name="eye-outline" size={14} color={C.cinza3} />
            <Text style={s.sugestoesVisivelTxt}>Exibido apenas a você</Text>
          </View>
          <View style={s.analiseItem}>
            <Ionicons name="people-outline" size={22} color={C.cinza4} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.analiseNum}>0 visualizações da página</Text>
              <Text style={s.analiseDesc}>Complete o perfil para atrair mais visitantes.</Text>
            </View>
          </View>
          <View style={s.analiseItem}>
            <Ionicons name="bar-chart-outline" size={22} color={C.cinza4} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.analiseNum}>0 impressões das publicações</Text>
              <Text style={s.analiseDesc}>Últimos 7 dias</Text>
            </View>
          </View>
        </SeccaoCard>

        {/* ── SOBRE ── */}
        {descricao ? (
          <SeccaoCard>
            <SeccaoHeader titulo="Sobre" onEdit={irParaEditar} />
            <Text style={s.sobreTxt}>{descricao}</Text>
            {missao ? (
              <View style={s.missaoBox}>
                <Text style={s.missaoLabel}>Missão e valores</Text>
                <Text style={s.missaoTxt}>{missao}</Text>
              </View>
            ) : null}
          </SeccaoCard>
        ) : null}

        {/* ── INFORMAÇÕES DA EMPRESA ── */}
        <SeccaoCard>
          <SeccaoHeader titulo="Informações da Empresa" onEdit={irParaEditar} />
          <InfoLinha icone="briefcase"   label="Setor de Atividade"   valor={setor} />
          <InfoLinha icone="users"       label="Dimensão"             valor={dimensao} />
          <InfoLinha icone="calendar"    label="Ano de Fundação"      valor={anoFundacao} />
          <InfoLinha icone="hash"        label="NIF"                  valor={nif} />
          <InfoLinha icone="flag"        label="País"                 valor={pais} />
          <InfoLinha icone="map-pin"     label="Província"            valor={provincia} />
          <InfoLinha icone="home"        label="Endereço"             valor={endereco} />
        </SeccaoCard>

        {/* ── CONTACTOS ── */}
        <SeccaoCard>
          <SeccaoHeader titulo="Contactos" onEdit={irParaEditar} />
          <InfoLinha icone="phone"  label="Telefone Principal" valor={telefone ? `+244 ${telefone}` : null} />
          <InfoLinha icone="message-circle" label="WhatsApp"   valor={whatsapp ? `+244 ${whatsapp}` : null} />
          <InfoLinha icone="mail"   label="E-mail"             valor={emailEmpresa} />
          <InfoLinha icone="globe"  label="Website"            valor={website} />
        </SeccaoCard>

        {/* ── REDES SOCIAIS ── */}
        {temRedes ? (
          <SeccaoCard>
            <SeccaoHeader titulo="Redes Sociais" onEdit={irParaEditar} />
            {perfil.linkedin ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.linkedin)}>
                <View style={[s.redeIcone, { backgroundColor: C.azulClaro }]}><Feather name="linkedin" size={15} color={C.azul} /></View>
                <Text style={s.redeTxt}>LinkedIn</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
            {perfil.facebook ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.facebook)}>
                <View style={[s.redeIcone, { backgroundColor: '#EEF2FF' }]}><Feather name="facebook" size={15} color="#3B5998" /></View>
                <Text style={s.redeTxt}>Facebook</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
            {perfil.instagram ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.instagram)}>
                <View style={[s.redeIcone, { backgroundColor: '#FDF2F8' }]}><Feather name="instagram" size={15} color="#E1306C" /></View>
                <Text style={s.redeTxt}>Instagram</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
            {perfil.twitter ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.twitter)}>
                <View style={[s.redeIcone, { backgroundColor: C.cinza1 }]}><Feather name="twitter" size={15} color={C.cinza4} /></View>
                <Text style={s.redeTxt}>X (Twitter)</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
            {perfil.youtube ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.youtube)}>
                <View style={[s.redeIcone, { backgroundColor: '#FEF2F2' }]}><Feather name="youtube" size={15} color="#FF0000" /></View>
                <Text style={s.redeTxt}>YouTube</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
          </SeccaoCard>
        ) : null}

        {/* ── RESPONSÁVEL ── */}
        {(nomeResp || cargoResp) ? (
          <SeccaoCard>
            <SeccaoHeader titulo="Responsável da Conta" onEdit={irParaEditar} />
            <View style={s.responsavelItem}>
              <View style={s.responsavelAvatar}>
                <Ionicons name="person" size={20} color={C.cinza3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.responsavelNome}>{nomeResp}</Text>
                {cargoResp ? <Text style={s.responsavelCargo}>{cargoResp}</Text> : null}
              </View>
            </View>
          </SeccaoCard>
        ) : null}

        {/* ── VERIFICAÇÃO E SEGURANÇA ── */}
        <SeccaoCard>
          <SeccaoHeader titulo="Verificação e Segurança" onEdit={irParaEditar} />
          <View style={s.verificacaoLista}>
            {[
              { label: 'Empresa registada',         ok: !!nif },
              { label: 'E-mail de suporte',          ok: !!emailEmpresa },
              { label: 'Telefone de contacto',       ok: !!telefone },
              { label: 'Endereço da sede',           ok: !!endereco },
              { label: 'Setor de atividade',         ok: !!setor },
              { label: 'Responsável identificado',   ok: !!nomeResp },
              { label: 'Verificação concluída',      ok: nivelVerif >= 2 },
            ].map(({ label, ok }) => (
              <View key={label} style={s.verificacaoLinha}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ok ? C.verde : C.cinza3} />
                <Text style={[s.verificacaoTxt, ok && { color: C.verde }]}>{label}</Text>
              </View>
            ))}
          </View>
        </SeccaoCard>

        {/* ── BANNER CONNECTALL ── */}
          {/* ── BANNER PUBLICITÁRIO — gerido pelo admin ── */}
          {bannerEmpresa ? (
            <View style={s.pubBloco}>
              {typeof bannerEmpresa === 'string' ? (
                <Image source={{ uri: bannerEmpresa }} style={s.pubBannerImg} resizeMode="cover" />
              ) : (
                <Image
                  source={{
                    uri: bannerEmpresa?.imagemURL || bannerEmpresa?.imagemUrl || bannerEmpresa?.url || bannerEmpresa?.image || bannerEmpresa?.uri,
                  }}
                  style={s.pubBannerImg}
                  resizeMode="cover"
                />
              )}
            </View>
          ) : null}

        {/* ── RODAPÉ ── */}
        <View style={s.rodape}>
          <View style={s.rodapeLinksRow}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'privacidade' } })}>
              <Text style={s.rodapeLink}>Sobre</Text>
            </TouchableOpacity>
            <TouchableOpacity><Text style={s.rodapeLink}>Acessibilidade</Text></TouchableOpacity>
            <TouchableOpacity><Text style={s.rodapeLink}>Dúvidas?</Text></TouchableOpacity>
          </View>
          <View style={s.rodapeLinksRow}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'contrato' } })}>
              <Text style={s.rodapeLink}>Termos e Privacidade</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.rodapeCopyright}>ConnectAll Angola © {new Date().getFullYear()}</Text>
        </View>

        {/* ── TERMINAR SESSÃO ── */}
        <View style={s.logoutWrap}>
          <TouchableOpacity style={s.logoutBtn} onPress={terminarSessao}>
            <Feather name="log-out" size={18} color={C.error} />
            <Text style={s.logoutTxt}>Terminar Sessão</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {Visualizador}

      <Modal visible={modalImagem} transparent animationType="fade" onRequestClose={() => setModalImagem(false)}>
        <View style={s.modalFundo}>
          <TouchableOpacity style={s.modalFechar} onPress={() => setModalImagem(false)}>
            <Feather name="x" size={28} color={C.branco} />
          </TouchableOpacity>
          {imagemExpandida ? <Image source={{ uri: imagemExpandida }} style={s.modalImagem} resizeMode="contain" /> : null}
        </View>
      </Modal>

      <BloqueioAnonimo visivel={modalBloqueio} tipo="acao" onFechar={() => setModalBloqueio(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.cinza1 },
  centro:  { justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll:  { paddingBottom: 16 },
  loadingTxt: { marginTop: 12, fontSize: 14, color: C.cinza3 },
  erroTitulo: { fontSize: 18, fontWeight: '700', color: C.preto, marginTop: 16 },
  loginBtn:   { backgroundColor: C.azul, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24 },
  loginBtnTxt:{ color: C.branco, fontWeight: '700', fontSize: 14 },

  topbar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  logoRow:      { flexDirection: 'row', alignItems: 'center' },
  logoConnect:  { fontSize: 20, fontWeight: '900', color: C.preto },
  logoAll:      { fontSize: 20, fontWeight: '900', color: C.vermelho },
  topbarIconBtn:{ padding: 6 },

  cardPrincipal:  { backgroundColor: C.branco, marginBottom: 8 },
  capa:           { width: '100%', height: 160, backgroundColor: C.cinza2, justifyContent: 'center', alignItems: 'center' },
  capaVazia:      { width: '100%', height: 160, backgroundColor: C.cinza2, justifyContent: 'center', alignItems: 'center' },
  camaraCapaBtn:  { position: 'absolute', top: 12, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },

  avatarRow:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -44, marginBottom: 8 },
  logoCirculo:  { width: 88, height: 88, borderRadius: 12, backgroundColor: C.branco, borderWidth: 3, borderColor: C.branco, overflow: 'hidden', zIndex: 5 },
  logoImagem:   { width: '100%', height: '100%' },
  logoFallback: { flex: 1, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' },

  badgeVerif:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 4 },
  badgeVerifTxt: { fontSize: 12, fontWeight: '700' },

  infoPrincipalWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  nome:      { fontSize: 22, fontWeight: '800', color: C.preto, marginBottom: 4 },
  subtitulo: { fontSize: 14, color: C.cinza4, marginBottom: 4 },
  localTxt:  { fontSize: 13, color: C.cinza3, marginBottom: 2 },
  fundacaoTxt:{ fontSize: 13, color: C.cinza3, marginBottom: 8 },

  pendenteBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 12, alignSelf: 'flex-start' },
  pendenteBadgeTxt: { fontSize: 12, fontWeight: '600', color: '#D97706' },

  botoesAcaoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  btnPrimario:   { backgroundColor: C.azul, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  btnPrimarioTxt:{ color: C.branco, fontWeight: '700', fontSize: 13 },
  btnSecundario: { borderWidth: 1.5, borderColor: C.cinza3, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  btnSecundarioTxt: { color: C.cinza4, fontWeight: '600', fontSize: 13 },

  card:          { backgroundColor: C.branco, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 16 },
  seccaoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  seccaoTitulo:  { fontSize: 18, fontWeight: '700', color: C.preto },
  seccaoIconBtn: { padding: 4 },

  sugestoesVisivel:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  sugestoesVisivelTxt:{ fontSize: 12, color: C.cinza3 },
  analiseItem:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  analiseNum:    { fontSize: 15, fontWeight: '700', color: C.preto, marginBottom: 2 },
  analiseDesc:   { fontSize: 13, color: C.cinza3 },

  sobreTxt:    { fontSize: 14, color: C.cinza4, lineHeight: 22 },
  missaoBox:   { backgroundColor: C.cinza1, borderRadius: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: C.azul, marginTop: 12 },
  missaoLabel: { fontSize: 11, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, fontWeight: '700' },
  missaoTxt:   { fontSize: 13, color: C.cinza4, lineHeight: 20, fontStyle: 'italic' },

  infoLinha:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  infoMeta:    { flex: 1 },
  infoLabel:   { fontSize: 11, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  infoValor:   { fontSize: 14, fontWeight: '600', color: C.cinza4 },

  redeLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  redeIcone: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  redeTxt:   { flex: 1, fontSize: 14, fontWeight: '600', color: C.cinza4 },

  responsavelItem:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  responsavelAvatar:{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.cinza1, borderWidth: 1, borderColor: C.cinza2, alignItems: 'center', justifyContent: 'center' },
  responsavelNome:  { fontSize: 15, fontWeight: '700', color: C.cinza4 },
  responsavelCargo: { fontSize: 13, color: C.cinza3, marginTop: 2 },

  verificacaoLista: { gap: 12 },
  verificacaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verificacaoTxt:   { fontSize: 13, color: C.cinza3, fontWeight: '500' },

  pubBloco:      { marginBottom: 8 },
  pubBlocoInner: { backgroundColor: '#0D2137', padding: 24, alignItems: 'center' },
  pubTitulo:     { fontSize: 18, fontWeight: '700', color: C.branco, textAlign: 'center', marginBottom: 16, lineHeight: 26 },
  pubTituloAzul: { color: '#5EB6FF' },
  pubBannerImg:  { width: '100%', height: 180 },
  pubBtn:        { backgroundColor: C.branco, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  pubBtnTxt:     { fontSize: 14, fontWeight: '700', color: '#0D2137' },

  rodape:         { backgroundColor: C.cinza1, paddingHorizontal: 16, paddingVertical: 20, marginBottom: 8 },
  rodapeLinksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  rodapeLink:     { fontSize: 12, color: C.cinza3 },
  rodapeCopyright:{ fontSize: 11, color: '#999', marginTop: 8 },

  logoutWrap: { paddingHorizontal: 16, marginBottom: 8 },
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF5F5', paddingVertical: 14, borderRadius: 28, borderWidth: 1.5, borderColor: '#FECACA' },
  logoutTxt:  { color: C.error, fontSize: 14, fontWeight: '700' },

  modalFundo:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalFechar: { position: 'absolute', top: 40, right: 24, zIndex: 20, padding: 10 },
  modalImagem: { width: '92%', height: '75%' },
});