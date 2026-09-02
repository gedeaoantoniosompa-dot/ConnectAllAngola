/**
 * app/(main)/my-profile-recrutador.jsx — ConnectAll Angola
 *
 * ── CORREÇÃO ──
 * Este ficheiro estava, por engano, com uma cópia integral do
 * my-profile-empresa.jsx. Foi reescrito para mostrar os dados pessoais do
 * Recrutador e inclui um cartão de acesso rápido à Página da Empresa.
 *
 * ── LIGAÇÃO AO ECRÃ UNIFICADO ──
 * "Editar perfil" abre /(main)/completar-perfil-recrutador com
 * passoInicial='dados' (dados pessoais pré-preenchidos). A secção "Dados
 * Profissionais" abaixo abre o mesmo ecrã com passoInicial='profissional',
 * para editar/completar empresa, cargo, setor, etc. — através do ícone de
 * lápis no cabeçalho da secção, tal como as restantes secções do perfil
 * (Sobre, Informações Pessoais, Contactos, Redes Sociais).
 *
 * ── NORMALIZAÇÃO VISUAL (revisão) ──
 * Anteriormente, o vínculo profissional vivia num cartão isolado, com
 * acento roxo, selo de estado e caixa de apelo à ação (CTA) — o que fazia
 * este ecrã destacar-se do resto do perfil de forma inconsistente. Essa
 * secção foi normalizada: agora é um cartão branco igual aos restantes
 * (Sobre, Informações Pessoais, Contactos), com o mesmo padrão de edição
 * (ícone de lápis no cabeçalho), e a informação de Empresa, Cargo,
 * Departamento, Setor, Área de RH, Experiência e Data de Entrada continua
 * a aparecer normalmente no perfil — só deixou de ter destaque próprio.
 * O selo de estado do vínculo (Verificado / Em análise / Por completar)
 * mantém-se, agora dentro do próprio cartão "Dados Profissionais".
 *
 * ── APRIMORAMENTO INSTITUCIONAL (mantido) ──
 * 1) Selo "Perfil Institucional Verificado" junto ao nome, quando o
 *    vínculo profissional já foi aprovado.
 * 2) O subtítulo mostra "{Cargo} · {Empresa}" em vez de "Recrutador",
 *    assim que os dados profissionais existem.
 * Estes dados vêm de perfil.dadosProfissionais, gravados no passo
 * 'profissional' de completar-perfil-recrutador.jsx.
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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
import { uploadFotoCapa, uploadFotoPerfil } from '../../config/utils/uploadFoto';
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
  verdeClaro:'#D1FAE5',
  vermelho:  '#E00000',
  error:     '#CC1016',
  roxo:      '#7C3AED',
  roxoClaro: '#F3EEFF',
  ambar:     '#D97706',
  ambarClaro:'#FEF3C7',
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

function SeccaoCard({ children, estilo }) {
  return <View style={[s.card, estilo]}>{children}</View>;
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

function BadgeVerificacao({ verificada }) {
  const cfg = verificada
    ? { cor: C.verde, bg: C.verdeClaro, texto: 'Identidade Verificada', icone: 'shield-checkmark' }
    : { cor: '#9CA3AF', bg: '#F3F4F6', texto: 'Não verificada',        icone: 'time-outline' };
  return (
    <View style={[s.badgeVerif, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icone} size={14} color={cfg.cor} />
      <Text style={[s.badgeVerifTxt, { color: cfg.cor }]}>{cfg.texto}</Text>
    </View>
  );
}

// Selo de estado do vínculo profissional (empresa/cargo), independente da
// verificação de identidade — mostra em que ponto está a validação da
// ligação do recrutador à empresa que representa. Agora vive dentro do
// cartão normal "Dados Profissionais", em vez de um cartão próprio.
function EstadoVinculo({ statusVerificacaoRecrutador, verificacaoProfissionalEnviada }) {
  let cfg;
  if (statusVerificacaoRecrutador === 'aprovado') {
    cfg = { cor: C.verde, bg: C.verdeClaro, texto: 'Vínculo Verificado', icone: 'checkmark-circle' };
  } else if (verificacaoProfissionalEnviada) {
    cfg = { cor: C.ambar, bg: C.ambarClaro, texto: 'Vínculo em Análise', icone: 'time-outline' };
  } else {
    cfg = { cor: '#9CA3AF', bg: '#F3F4F6', texto: 'Vínculo por Completar', icone: 'alert-circle-outline' };
  }
  return (
    <View style={[s.badgeVerif, { backgroundColor: cfg.bg, alignSelf: 'flex-start' }]}>
      <Ionicons name={cfg.icone} size={14} color={cfg.cor} />
      <Text style={[s.badgeVerifTxt, { color: cfg.cor }]}>{cfg.texto}</Text>
    </View>
  );
}

export default function MyProfileRecrutadorScreen() {
  const router = useRouter();
  const { user, perfil, carregando, guardarPerfil } = useUser();
  const { Visualizador } = useVisualizador();

  const [atualizandoFoto, setAtualizandoFoto] = useState(false);
  const [atualizandoCapa, setAtualizandoCapa] = useState(false);
  const [modalImagem, setModalImagem]         = useState(false);
  const [imagemExpandida, setImagemExpandida] = useState('');
  const [modalBloqueio, setModalBloqueio]     = useState(false);
  const [bannerRecrutador, setBannerRecrutador] = useState(null);
  const [temPaginaEmpresa, setTemPaginaEmpresa] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracoes', 'banners'), (snap) => {
      if (snap.exists()) setBannerRecrutador(snap.data().recrutador || snap.data().empresa || null);
    });
    return unsub;
  }, []);

  // ── Verifica se já existe Página da Empresa criada por este recrutador ──
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'perfis', 'empresa'));
        setTemPaginaEmpresa(snap.exists());
      } catch (_) {}
    })();
  }, [user?.uid]);

  const verificarAcesso = () => {
    if (!user || user.isAnonymous) { setModalBloqueio(true); return false; }
    return true;
  };

  if (carregando) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <ActivityIndicator size="large" color={C.azul} />
        <Text style={s.loadingTxt}>A carregar perfil...</Text>
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

  // Dados pessoais do recrutador
  const nome          = perfil.nome || 'Recrutador';
  const bio           = perfil.resumo || perfil.bio || '';
  const provincia     = perfil.provincia || perfil.cidade || '';
  const pais          = perfil.pais || 'Angola';
  const dataNasc      = perfil.dataNasc || '';
  const genero        = perfil.genero || '';
  const nacionalidade = perfil.nacionalidade || '';
  const telefone      = perfil.telPrincipal || perfil.telefone || '';
  const email         = perfil.email || perfil.emailContacto || '';
  const identidadeVerificada = !!perfil.identidadeVerificada;

  // Dados profissionais/institucionais — gravados no passo 'profissional'
  // de completar-perfil-recrutador.jsx (updateDoc em dadosProfissionais).
  const dadosProf         = perfil.dadosProfissionais || {};
  const empresaAtual      = dadosProf.empresa || '';
  const cargoAtual        = dadosProf.cargo || perfil.tituloProfissional || perfil.cargo || '';
  const departamentoAtual = dadosProf.departamento || '';
  const setorAtual        = dadosProf.setor || '';
  const areaRHAtual       = dadosProf.areaRH || '';
  const anosExpAtual      = dadosProf.anosExp ? `${dadosProf.anosExp} ano(s)` : '';
  const dataEntradaAtual  = dadosProf.dataEntrada || '';
  const verificacaoProfissionalEnviada = !!perfil.verificacaoProfissionalEnviada;
  const statusVerificacaoRecrutador    = perfil.statusVerificacaoRecrutador || '';
  const vinculoAprovado = statusVerificacaoRecrutador === 'aprovado';
  const perfilInstitucionalCompleto = !!(empresaAtual && cargoAtual);

  const temRedes = perfil.linkedin || perfil.github || perfil.behance || perfil.website;
  const visualizacoesPerfil   = perfil?.analytics?.perfilVisualizacoes?.count   || 0;
  const impressoesPublicacoes = perfil?.analytics?.publicacoesImpressoes?.count || 0;

  // ── "Editar perfil" abre o ecrã unificado já no passo de dados pessoais ──
  const irParaEditar = () =>
    verificarAcesso() &&
    router.push({
      pathname: '/(main)/completar-perfil-recrutador',
      params: { passoInicial: 'dados' },
    });

  // ── O lápis do cartão "Dados Profissionais" abre o mesmo ecrã, no passo
  // profissional — é o único ponto de acesso à edição do vínculo, tal como
  // pedido: a opção deixou de ter um cartão/CTA próprio e vive agora
  // dentro do ícone de edição da secção. ──
  const irParaVinculoProfissional = () =>
    verificarAcesso() &&
    router.push({
      pathname: '/(main)/completar-perfil-recrutador',
      params: { passoInicial: perfilInstitucionalCompleto ? 'profissional' : 'intro' },
    });

  const irParaPaginaEmpresa = () => verificarAcesso() && router.push('/(main)/pagina-empresa');
  const abrirImagem  = (url) => { if (url) { setImagemExpandida(url); setModalImagem(true); } };

  const alterarFoto = async () => {
    if (!verificarAcesso()) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && user) {
      setAtualizandoFoto(true);
      try {
        const url = await uploadFotoPerfil(user.uid, r.assets[0].uri);
        await guardarPerfil({ fotoURL: url });
      } catch { await guardarPerfil({ fotoURL: r.assets[0].uri }); }
      finally { setAtualizandoFoto(false); }
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
        // Antes: uploadFotoPerfil(`${user.uid}_capa`, ...) — usava um ID
        // inventado, o que fazia o setDoc interno criar um documento
        // novo e vazio em users/<uid>_capa (visível em "Conexões"), em
        // vez de actualizar o perfil real do recrutador. Corrigido para
        // usar a função certa (uploadFotoCapa, que já grava no campo
        // capaURL) com o UID real do utilizador.
        const url = await uploadFotoCapa(user.uid, r.assets[0].uri);
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

          {/* Foto + badge verificação */}
          <View style={s.avatarRow}>
            <TouchableOpacity style={s.avatarCirculo} onPress={() => perfil.fotoURL ? abrirImagem(perfil.fotoURL) : alterarFoto()}>
              {atualizandoFoto
                ? <View style={s.avatarFallback}><ActivityIndicator color={C.branco} /></View>
                : perfil.fotoURL
                  ? <Image source={{ uri: perfil.fotoURL }} style={s.avatarImagem} />
                  : <View style={s.avatarFallback}><Ionicons name="person" size={32} color={C.branco} /></View>}
            </TouchableOpacity>
            <BadgeVerificacao verificada={identidadeVerificada} />
          </View>

          {/* Info principal */}
          <View style={s.infoPrincipalWrap}>
            <View style={s.nomeRow}>
              <Text style={s.nome}>{nome}</Text>
              <View style={s.recrutadorTag}>
                <Ionicons name="business" size={12} color={C.roxo} />
                <Text style={s.recrutadorTagTxt}>Recrutador</Text>
              </View>
            </View>

            <Text style={s.subtitulo}>
              {cargoAtual && empresaAtual ? `${cargoAtual} · ${empresaAtual}` : 'Recrutador'}
            </Text>
            {(provincia || pais) ? <Text style={s.localTxt}>{[provincia, pais].filter(Boolean).join(', ')}</Text> : null}

            {vinculoAprovado && (
              <View style={s.institucionalLinhaBadge}>
                <Ionicons name="shield-checkmark" size={13} color={C.roxo} />
                <Text style={s.institucionalLinhaBadgeTxt}>Perfil Institucional Verificado</Text>
              </View>
            )}

            {!identidadeVerificada && (
              <View style={s.pendenteBadge}>
                <Ionicons name="time-outline" size={14} color={C.ambar} />
                <Text style={s.pendenteBadgeTxt}>Verificação de identidade pendente</Text>
              </View>
            )}

            <View style={s.botoesAcaoRow}>
              <TouchableOpacity style={s.btnPrimario} onPress={irParaEditar}>
                <Text style={s.btnPrimarioTxt}>Editar perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecundario} onPress={() => router.push('/(main)/create-post')}>
                <Text style={s.btnSecundarioTxt}>Publicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── PÁGINA DA EMPRESA — acesso rápido ── */}
        <TouchableOpacity style={s.cardEmpresaWrap} onPress={irParaPaginaEmpresa} activeOpacity={0.85}>
          <View style={s.cardEmpresaIcone}>
            <Ionicons name="storefront" size={22} color={C.roxo} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardEmpresaTitulo}>
              {temPaginaEmpresa ? 'Página da Empresa' : 'Criar Página da Empresa'}
            </Text>
            <Text style={s.cardEmpresaTxt}>
              {temPaginaEmpresa
                ? 'Gerir publicações, atividades, conquistas e contratos'
                : 'Cria uma página para representar a tua empresa na plataforma'}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.cinza3} />
        </TouchableOpacity>

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
              <Text style={s.analiseNum}>{visualizacoesPerfil} visualizações do perfil</Text>
              <Text style={s.analiseDesc}>Complete o perfil para atrair mais visitantes.</Text>
              <Text style={s.analiseDesc}>Ciclo atual (repõe a cada 30 dias)</Text>
            </View>
          </View>
          <View style={s.analiseItem}>
            <Ionicons name="bar-chart-outline" size={22} color={C.cinza4} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.analiseNum}>{impressoesPublicacoes} impressões das publicações</Text>
              <Text style={s.analiseDesc}>Ciclo atual (repõe a cada 30 dias)</Text>
            </View>
          </View>
        </SeccaoCard>

        {/* ── SOBRE ── */}
        {bio ? (
          <SeccaoCard>
            <SeccaoHeader titulo="Sobre" onEdit={irParaEditar} />
            <Text style={s.sobreTxt}>{bio}</Text>
          </SeccaoCard>
        ) : null}

        {/* ── DADOS PROFISSIONAIS ──
            Cartão normal (igual às restantes secções do perfil), sem
            destaque próprio — a edição faz-se através do ícone de lápis
            no cabeçalho, exactamente como em "Sobre", "Informações
            Pessoais" e "Contactos". O selo de estado do vínculo aparece
            dentro do próprio cartão. */}
        <SeccaoCard>
          <SeccaoHeader titulo="Dados Profissionais" onEdit={irParaVinculoProfissional} />
          <View style={{ marginBottom: 14 }}>
            <EstadoVinculo
              statusVerificacaoRecrutador={statusVerificacaoRecrutador}
              verificacaoProfissionalEnviada={verificacaoProfissionalEnviada}
            />
          </View>

          {perfilInstitucionalCompleto ? (
            <>
              <InfoLinha icone="briefcase"   label="Empresa"            valor={empresaAtual} />
              <InfoLinha icone="award"       label="Cargo"              valor={cargoAtual} />
              <InfoLinha icone="layers"      label="Departamento"       valor={departamentoAtual} />
              <InfoLinha icone="tag"         label="Setor de Atuação"   valor={setorAtual} />
              <InfoLinha icone="users"       label="Área de RH"         valor={areaRHAtual} />
              <InfoLinha icone="trending-up" label="Experiência em RH"  valor={anosExpAtual} />
              <InfoLinha icone="calendar"    label="Na Empresa Desde"   valor={dataEntradaAtual} />
            </>
          ) : (
            <Text style={s.dadosProfVazioTxt}>
              Ainda não completaste os teus dados profissionais. Toca no ícone de edição para indicar
              empresa, cargo e setor onde atuas.
            </Text>
          )}
        </SeccaoCard>

        {/* ── INFORMAÇÕES PESSOAIS ── */}
        <SeccaoCard>
          <SeccaoHeader titulo="Informações Pessoais" onEdit={irParaEditar} />
          <InfoLinha icone="calendar"  label="Data de Nascimento" valor={dataNasc} />
          <InfoLinha icone="user"      label="Género"             valor={genero} />
          <InfoLinha icone="flag"      label="Nacionalidade"      valor={nacionalidade} />
          <InfoLinha icone="map-pin"   label="Província"          valor={provincia} />
        </SeccaoCard>

        {/* ── CONTACTOS ── */}
        <SeccaoCard>
          <SeccaoHeader titulo="Contactos" onEdit={irParaEditar} />
          <InfoLinha icone="phone" label="Telefone" valor={telefone ? `+244 ${telefone}` : null} />
          <InfoLinha icone="mail"  label="E-mail"   valor={email} />
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
            {perfil.github ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.github)}>
                <View style={[s.redeIcone, { backgroundColor: C.cinza1 }]}><Feather name="github" size={15} color={C.cinza4} /></View>
                <Text style={s.redeTxt}>GitHub</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
            {perfil.behance ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.behance)}>
                <View style={[s.redeIcone, { backgroundColor: '#EEF2FF' }]}><Feather name="dribbble" size={15} color="#1769FF" /></View>
                <Text style={s.redeTxt}>Behance</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
            {perfil.website ? (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.website)}>
                <View style={[s.redeIcone, { backgroundColor: C.cinza1 }]}><Feather name="globe" size={15} color={C.cinza4} /></View>
                <Text style={s.redeTxt}>Website</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            ) : null}
          </SeccaoCard>
        ) : null}

        {/* ── VERIFICAÇÃO E SEGURANÇA ── */}
        <SeccaoCard>
          <SeccaoHeader titulo="Verificação e Segurança" onEdit={irParaEditar} />
          <View style={s.verificacaoLista}>
            {[
              { label: 'Nome completo',                    ok: !!nome },
              { label: 'Telefone de contacto',              ok: !!telefone },
              { label: 'E-mail confirmado',                 ok: !!perfil.emailVerificado },
              { label: 'Nacionalidade',                     ok: !!nacionalidade },
              { label: 'Identidade verificada',              ok: identidadeVerificada },
              { label: 'Vínculo profissional confirmado',    ok: vinculoAprovado },
            ].map(({ label, ok }) => (
              <View key={label} style={s.verificacaoLinha}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ok ? C.verde : C.cinza3} />
                <Text style={[s.verificacaoTxt, ok && { color: C.verde }]}>{label}</Text>
              </View>
            ))}
          </View>
        </SeccaoCard>

        {/* ── BANNER PUBLICITÁRIO — gerido pelo admin ── */}
        {bannerRecrutador ? (
          <View style={s.pubBloco}>
            {typeof bannerRecrutador === 'string' ? (
              <Image source={{ uri: bannerRecrutador }} style={s.pubBannerImg} resizeMode="cover" />
            ) : (
              <Image
                source={{
                  uri: bannerRecrutador?.imagemURL || bannerRecrutador?.imagemUrl || bannerRecrutador?.url || bannerRecrutador?.image || bannerRecrutador?.uri,
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
  avatarCirculo:{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.branco, borderWidth: 3, borderColor: C.branco, overflow: 'hidden', zIndex: 5 },
  avatarImagem: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' },

  badgeVerif:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 4 },
  badgeVerifTxt: { fontSize: 12, fontWeight: '700' },

  infoPrincipalWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  nomeRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  nome:      { fontSize: 22, fontWeight: '800', color: C.preto },
  recrutadorTag:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.roxoClaro, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  recrutadorTagTxt: { fontSize: 11, fontWeight: '700', color: C.roxo },
  subtitulo: { fontSize: 14, color: C.cinza4, marginBottom: 4 },
  localTxt:  { fontSize: 13, color: C.cinza3, marginBottom: 8 },

  institucionalLinhaBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.roxoClaro, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 10, alignSelf: 'flex-start' },
  institucionalLinhaBadgeTxt: { fontSize: 12, fontWeight: '700', color: C.roxo },

  pendenteBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ambarClaro, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 12, alignSelf: 'flex-start' },
  pendenteBadgeTxt: { fontSize: 12, fontWeight: '600', color: C.ambar },

  botoesAcaoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  btnPrimario:   { backgroundColor: C.azul, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  btnPrimarioTxt:{ color: C.branco, fontWeight: '700', fontSize: 13 },
  btnSecundario: { borderWidth: 1.5, borderColor: C.cinza3, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  btnSecundarioTxt: { color: C.cinza4, fontWeight: '600', fontSize: 13 },

  dadosProfVazioTxt: { fontSize: 13, color: C.cinza3, lineHeight: 19 },

  cardEmpresaWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.branco, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 16 },
  cardEmpresaIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.roxoClaro, alignItems: 'center', justifyContent: 'center' },
  cardEmpresaTitulo: { fontSize: 15, fontWeight: '700', color: C.preto },
  cardEmpresaTxt: { fontSize: 12, color: C.cinza3, marginTop: 2 },

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

  infoLinha:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  infoMeta:    { flex: 1 },
  infoLabel:   { fontSize: 11, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  infoValor:   { fontSize: 14, fontWeight: '600', color: C.cinza4 },

  redeLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  redeIcone: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  redeTxt:   { flex: 1, fontSize: 14, fontWeight: '600', color: C.cinza4 },

  verificacaoLista: { gap: 12 },
  verificacaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verificacaoTxt:   { fontSize: 13, color: C.cinza3, fontWeight: '500' },

  pubBloco:      { marginBottom: 8 },
  pubBannerImg:  { width: '100%', height: 180 },

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