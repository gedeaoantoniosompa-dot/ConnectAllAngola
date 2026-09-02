import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Image, ImageBackground, Modal,
    ScrollView, StatusBar, StyleSheet, Text,
    TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BloqueioAnonimo from '../../components/BloqueioAnonimo';
import { useVisualizador } from '../../components/VisualizadorFicheiro';
import { auth, db } from '../../config/firebase';
import { uploadFotoCapa, uploadFotoPerfil } from '../../config/utils/uploadFoto';
import { useUser } from '../../context/UserContext';

const C = {
  azul:       '#0A66C2',
  azulEscuro: '#004182',
  azulClaro:  '#EEF3FB',
  branco:     '#FFFFFF',
  preto:      '#000000',
  cinza1:     '#F3F2EE',
  cinza2:     '#E9E5DF',
  cinza3:     '#666360',
  cinza4:     '#1B1B1B',
  verde:      '#057642',
  vermelho:   '#E00000',
  error:      '#CC1016',
  borda:      '#D6CECE',
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

function Divisor() {
  return <View style={s.divisorLinha} />;
}

function SeccaoCard({ children }) {
  return <View style={s.seccaoCard}>{children}</View>;
}

function SeccaoHeader({ titulo, onAdd, onEdit }) {
  return (
    <View style={s.seccaoHeaderRow}>
      <Text style={s.seccaoTitulo}>{titulo}</Text>
      <View style={s.seccaoAcoes}>
        {onAdd && (
          <TouchableOpacity onPress={onAdd} style={s.seccaoIconBtn}>
            <Feather name="plus" size={20} color={C.cinza4} />
          </TouchableOpacity>
        )}
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={s.seccaoIconBtn}>
            <Feather name="edit-2" size={18} color={C.cinza4} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Chip({ label, destaque }) {
  return (
    <View style={[s.chip, destaque && s.chipDestaque]}>
      <Text style={[s.chipTxt, destaque && s.chipTxtDestaque]}>{label}</Text>
    </View>
  );
}

export default function MyProfileScreen() {
  const router = useRouter();
  const { user, perfil, carregando, guardarPerfil, pararListenerPerfil } = useUser();
  const { abrir, Visualizador } = useVisualizador();

  const [atualizandoFoto, setAtualizandoFoto]   = useState(false);
  const [atualizandoCapa, setAtualizandoCapa]   = useState(false);
  const [modalImagem, setModalImagem]           = useState(false);
  const [imagemExpandida, setImagemExpandida]   = useState('');
  const [modalBloqueio, setModalBloqueio]       = useState(false);
  const [tabAtividades, setTabAtividades]       = useState('publicacoes');
  const [banners, setBanners] = useState([]);
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracoes', 'banners'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const lista = [d.banner1, d.banner2, d.banner3, d.utilizador]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i); // remove duplicados
        setBanners(lista);
        setBannerIdx(0);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const iv = setInterval(() => {
      setBannerIdx(prev => (prev + 1) % banners.length);
    }, 4000); // troca a cada 4 segundos
    return () => clearInterval(iv);
  }, [banners]);


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
        <Text style={s.erroSub}>Não foi possível encontrar os dados do utilizador.</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.loginBtnTxt}>Voltar ao Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const nome         = perfil?.nome || 'Utilizador';
  const titulo       = perfil?.tituloProfissional || perfil?.cargo || 'Profissional';
  const localizacao  = [perfil?.municipio, perfil?.provincia].filter(Boolean).join(', ') || perfil?.cidade || '';
  const telefone     = perfil?.telPrincipal || perfil?.telefone || '';
  const emailPerfil  = perfil?.email || perfil?.emailContacto || perfil?.emailCorporativo || '';
  const resumoPerfil = perfil?.resumo || perfil?.bio || '';

  const formacoes     = Array.isArray(perfil?.formacoes)            ? perfil.formacoes            : [];
  const experiencias  = Array.isArray(perfil?.experiencias)         ? perfil.experiencias         : [];
  const certificacoes = Array.isArray(perfil?.certificacoes)        ? perfil.certificacoes        : [];
  const compTecnicas  = Array.isArray(perfil?.competenciasTecnicas) ? perfil.competenciasTecnicas : [];
  const compPessoais  = Array.isArray(perfil?.competenciasPessoais) ? perfil.competenciasPessoais : [];
  const idiomas       = Array.isArray(perfil?.idiomas)              ? perfil.idiomas              : [];
  const certUrls      = Array.isArray(perfil?.certUrls)             ? perfil.certUrls             : [];
  const visualizacoesPerfil   = perfil?.analytics?.perfilVisualizacoes?.count   || 0;
  const impressoesPublicacoes = perfil?.analytics?.publicacoesImpressoes?.count || 0;

  const camposTotal = [
    perfil?.fotoURL, perfil?.nome, titulo, resumoPerfil, perfil?.situacaoProf,
    formacoes.length > 0, experiencias.length > 0,
    (compTecnicas.length + compPessoais.length) > 0,
    idiomas.length > 0, perfil?.uriCV || perfil?.cvUrl,
    perfil?.emailVerificado, perfil?.telVerificado,
  ];
  const percentagem = Math.round((camposTotal.filter(Boolean).length / camposTotal.length) * 100);

  const abrirImagem = (url) => {
    if (url) { setImagemExpandida(url); setModalImagem(true); }
  };

  // Abre documentos usando o Visualizador interno (PDF.js) ou WebBrowser
  const abrirDocumento = async (uri, nomeDoc) => {
    if (!uri) return;
    try {
      await abrir(uri, nomeDoc || 'Documento');
    } catch {
      try {
        await WebBrowser.openBrowserAsync(uri);
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir o ficheiro.');
      }
    }
  };

  const alterarFotoPerfil = async () => {
    if (!verificarAcesso()) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso às tuas fotos.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
      if (!result.canceled && result.assets[0].uri && user) {
        setAtualizandoFoto(true);
        try {
          const url = await uploadFotoPerfil(user.uid, result.assets[0].uri);
          await guardarPerfil({ fotoURL: url });
        } catch { await guardarPerfil({ fotoURL: result.assets[0].uri }); }
      }
    } catch { Alert.alert('Erro', 'Não foi possível atualizar a foto de perfil.'); }
    finally { setAtualizandoFoto(false); }
  };

  const alterarFotoCapa = async () => {
    if (!verificarAcesso()) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso às tuas fotos.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
      if (!result.canceled && result.assets[0].uri && user) {
        setAtualizandoCapa(true);
        try {
          // Antes: uploadFotoPerfil(`${user.uid}_capa`, ...) — usava um ID
          // inventado, o que fazia o setDoc interno criar um documento
          // novo e vazio em users/<uid>_capa (visível em "Conexões"), em
          // vez de actualizar o perfil real do utilizador. Corrigido para
          // usar a função certa (uploadFotoCapa, que já grava no campo
          // capaURL) com o UID real do utilizador.
          const url = await uploadFotoCapa(user.uid, result.assets[0].uri);
          await guardarPerfil({ capaURL: url });
        } catch { await guardarPerfil({ capaURL: result.assets[0].uri }); }
      }
    } catch { Alert.alert('Erro', 'Não foi possível atualizar a foto de capa.'); }
    finally { setAtualizandoCapa(false); }
  };

  const terminarSessao = async () => {
    Alert.alert(
      'Terminar sessão',
      'Tens a certeza que queres sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              // Para os listeners do contexto ANTES de fazer logout
              pararListenerPerfil();

              if (user?.uid) await AsyncStorage.removeItem(`perfil_${user.uid}`);
              await signOut(auth);
              // onAuthStateChanged no _layout trata da navegação
            } catch {
              Alert.alert('Erro', 'Não foi possível terminar a sessão.');
            }
          },
        },
      ]
    );
  };

  const irParaEditar = () => verificarAcesso() && router.push({ pathname: '/(auth)/profile', params: { voltarPara: 'my-profile' } });
  const irParaPlanos = () => verificarAcesso() && router.push('/(main)/planos');

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cinza1} />

      {/* Topbar */}
      <View style={s.topbar}>
        <View style={s.logoRow}>
          <Text style={s.logoConnect}>Connect</Text>
          <Text style={s.logoAll}>All</Text>
        </View>
        <View style={s.topbarRight}>
          <TouchableOpacity style={s.topbarIconBtn} onPress={irParaPlanos}>
            <Ionicons name="diamond-outline" size={20} color={C.azul} />
          </TouchableOpacity>
          <TouchableOpacity style={s.topbarIconBtn} onPress={irParaEditar}>
            <Feather name="edit-3" size={20} color={C.cinza4} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* CARD 1 — Capa + Avatar + Info */}
        <View style={s.cardPrincipal}>
          <TouchableOpacity activeOpacity={0.9}
            onPress={() => perfil?.capaURL ? abrirImagem(perfil.capaURL) : alterarFotoCapa()}>
            {perfil?.capaURL ? (
              <ImageBackground source={{ uri: perfil.capaURL }} style={s.capa}>
                {atualizandoCapa && <ActivityIndicator color={C.branco} />}
              </ImageBackground>
            ) : (
              <View style={s.capaVazia}>
                {atualizandoCapa
                  ? <ActivityIndicator color={C.azul} />
                  : <Feather name="image" size={22} color={C.cinza3} />}
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.camaraCapaBtn} onPress={alterarFotoCapa}>
            <Feather name="camera" size={16} color={C.cinza4} />
          </TouchableOpacity>

          <View style={s.avatarRow}>
            <TouchableOpacity style={s.avatarCirculo}
              onPress={() => perfil?.fotoURL ? abrirImagem(perfil.fotoURL) : alterarFotoPerfil()}>
              {atualizandoFoto ? (
                <View style={s.avatarFallback}><ActivityIndicator color={C.branco} /></View>
              ) : perfil?.fotoURL ? (
                <Image source={{ uri: perfil.fotoURL }} style={s.avatarImagem} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarLetra}>{nome?.charAt(0)?.toUpperCase() || 'U'}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.editLapis} onPress={irParaEditar}>
              <Feather name="edit-2" size={18} color={C.cinza4} />
            </TouchableOpacity>
          </View>

          <View style={s.infoPrincipalWrap}>
            <View style={s.nomeEmpresaRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.nome}>{nome}</Text>
                <Text style={s.tituloProfissional}>{titulo}{experiencias[0]?.empresa ? ` na ${experiencias[0].empresa}` : ''}</Text>
              </View>
              {experiencias[0]?.logoEmpresa ? (
                <Image source={{ uri: experiencias[0].logoEmpresa }} style={s.logoEmpresa} />
              ) : null}
            </View>

            {localizacao ? (
              <View style={s.localizacaoRow}>
                <Text style={s.localizacaoTxt}>{localizacao}</Text>
                <Text style={s.separadorDot}>·</Text>
                <TouchableOpacity><Text style={s.linkAzul}>Informações de contacto</Text></TouchableOpacity>
              </View>
            ) : null}

            {(perfil?.emailVerificado || perfil?.telVerificado) && (
              <View style={s.badgesRow}>
                {perfil?.emailVerificado && (
                  <View style={s.badgeVerde}>
                    <Ionicons name="checkmark-circle" size={12} color={C.verde} />
                    <Text style={s.badgeVerdeTxt}>E-mail verificado</Text>
                  </View>
                )}
                {perfil?.telVerificado && (
                  <View style={s.badgeVerde}>
                    <Ionicons name="checkmark-circle" size={12} color={C.verde} />
                    <Text style={s.badgeVerdeTxt}>Telefone verificado</Text>
                  </View>
                )}
              </View>
            )}

            <View style={s.botoesAcaoRow}>
              <TouchableOpacity style={s.btnPrimario} onPress={() => {}}>
                <Text style={s.btnPrimarioTxt}>Tenho interesse em...</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecundario} onPress={irParaEditar}>
                <Text style={s.btnSecundarioTxt}>Adicionar secção ao perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnRecursos} onPress={() => {}}>
                <Text style={s.btnRecursosTxt}>Recursos</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.btnAprimorar} onPress={irParaEditar}>
              <Text style={s.btnAprimorarTxt}>Aprimorar perfil</Text>
            </TouchableOpacity>
          </View>

          {(perfil?.situacaoProf || perfil?.disponibilidade) && (
            <View style={s.situacaoCard}>
              <View style={s.situacaoLeft}>
                <Text style={s.situacaoTitulo}>{perfil?.situacaoProf || 'Disponível'}</Text>
                {localizacao ? <Text style={s.situacaoSub}>{localizacao}</Text> : null}
                {perfil?.disponibilidade ? <Text style={s.situacaoLink}>{perfil.disponibilidade}</Text> : null}
              </View>
              <TouchableOpacity style={s.situacaoEditBtn} onPress={irParaEditar}>
                <Feather name="edit-2" size={15} color={C.cinza3} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CARD 2 — Sugestões */}
        {percentagem < 100 && (
          <SeccaoCard>
            <Text style={s.sugestoesTitulo}>Sugestões para você</Text>
            <View style={s.sugestoesVisivel}>
              <Ionicons name="eye-outline" size={14} color={C.cinza3} />
              <Text style={s.sugestoesVisivelTxt}>Exibido apenas a você</Text>
            </View>

            {!resumoPerfil && (
              <View style={s.sugestaoItem}>
                <View style={s.sugestaoIcone}><Feather name="align-left" size={18} color={C.cinza3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sugestaoTitulo}>Escreva um resumo para destacar a sua personalidade ou experiência profissional</Text>
                  <Text style={s.sugestaoDesc}>Perfis que incluem um resumo recebem até 3,9 vezes mais visualizações.</Text>
                  <TouchableOpacity style={s.btnSugestao} onPress={irParaEditar}>
                    <Text style={s.btnSugestaoTxt}>Adicionar resumo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {formacoes.length === 0 && (
              <View style={s.sugestaoItem}>
                <View style={s.sugestaoIcone}><Feather name="book-open" size={18} color={C.cinza3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sugestaoTitulo}>Adicionar formação académica</Text>
                  <Text style={s.sugestaoDesc}>Exiba as suas qualificações e aumente as suas chances de receber mensagens de recrutadores.</Text>
                  <TouchableOpacity style={s.btnSugestao} onPress={irParaEditar}>
                    <Text style={s.btnSugestaoTxt}>Adicionar formação académica</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(compTecnicas.length + compPessoais.length) === 0 && (
              <View style={s.sugestaoItem}>
                <View style={s.sugestaoIcone}><Feather name="star" size={18} color={C.cinza3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sugestaoTitulo}>Competências</Text>
                  <Text style={s.sugestaoDesc}>Comunique a sua adequação a novas oportunidades; 50% dos recrutadores usam dados de competências para preencher vagas.</Text>
                  <TouchableOpacity style={s.btnSugestao} onPress={irParaEditar}>
                    <Text style={s.btnSugestaoTxt}>Adicionar competências</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </SeccaoCard>
        )}

        {/* CARD 3 — Análise */}
        <SeccaoCard>
          <Text style={s.analiseTitulo}>Análise</Text>
          <View style={s.sugestoesVisivel}>
            <Ionicons name="eye-outline" size={14} color={C.cinza3} />
            <Text style={s.sugestoesVisivelTxt}>Exibido apenas a você</Text>
          </View>
          <View style={s.analiseItem}>
            <Ionicons name="people-outline" size={22} color={C.cinza4} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.analiseNum}>{visualizacoesPerfil} visualizações do perfil</Text>
              <Text style={s.analiseDesc}>Atualize o seu perfil para atrair visitantes.</Text>
              <Text style={s.analiseDescSub}>Ciclo atual (repõe a cada 30 dias)</Text>
            </View>
          </View>
          <View style={s.analiseItem}>
            <Ionicons name="bar-chart-outline" size={22} color={C.cinza4} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.analiseNum}>{impressoesPublicacoes} impressões das publicações</Text>
              <Text style={s.analiseDesc}>Comece uma publicação para aumentar o engagement.</Text>
              <Text style={s.analiseDescSub}>Ciclo atual (repõe a cada 30 dias)</Text>
            </View>
          </View>
          <TouchableOpacity style={s.exibirAnalisesBtn}>
            <Text style={s.exibirAnalisesLink}>Exibir todas as análises →</Text>
          </TouchableOpacity>
        </SeccaoCard>

        {/* CARD 4 — Atividades */}
        <SeccaoCard>
          <View style={s.seccaoHeaderRow}>
            <View>
              <Text style={s.seccaoTitulo}>Atividades</Text>
              <Text style={s.seguidoresTxt}>0 seguidores</Text>
            </View>
            <TouchableOpacity style={s.seccaoIconBtn} onPress={irParaEditar}>
              <Feather name="edit-2" size={18} color={C.cinza4} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.btnCriarPublicacao} onPress={() => router.push('/(main)/create-post')}>
            <Text style={s.btnCriarPublicacaoTxt}>Criar publicação</Text>
          </TouchableOpacity>
          <View style={s.tabsRow}>
            <TouchableOpacity
              style={[s.tabBtn, tabAtividades === 'publicacoes' && s.tabBtnAtivo]}
              onPress={() => setTabAtividades('publicacoes')}>
              <Text style={[s.tabBtnTxt, tabAtividades === 'publicacoes' && s.tabBtnTxtAtivo]}>Publicações</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, tabAtividades === 'videos' && s.tabBtnAtivo]}
              onPress={() => setTabAtividades('videos')}>
              <Text style={[s.tabBtnTxt, tabAtividades === 'videos' && s.tabBtnTxtAtivo]}>Vídeos</Text>
            </TouchableOpacity>
          </View>
          <View style={s.atividadesVazio}>
            <Text style={s.vazioTxt}>Nenhuma atividade recente. Partilhe uma publicação.</Text>
          </View>
        </SeccaoCard>

        {/* CARD 5 — Experiência */}
        <SeccaoCard>
          <SeccaoHeader titulo="Experiência" onAdd={irParaEditar} onEdit={irParaEditar} />
          {experiencias.length === 0 ? (
            <View style={s.secVaziaWrap}>
              <View style={s.secVaziaIcone}><Feather name="briefcase" size={22} color={C.cinza3} /></View>
              <Text style={s.secVaziaTitulo}>Adicionar experiência profissional</Text>
              <Text style={s.secVaziaDesc}>Recrutadores valorizam experiências detalhadas. Adicione a sua.</Text>
            </View>
          ) : experiencias.map((e, i) => (
            <View key={i} style={s.expItem}>
              <View style={s.expLogoBg}>
                {e.logoEmpresa
                  ? <Image source={{ uri: e.logoEmpresa }} style={s.expLogo} />
                  : <Feather name="briefcase" size={20} color={C.cinza3} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.expCargo}>{e.cargo}</Text>
                <Text style={s.expEmpresa}>{e.empresa}{e.setor ? ` · ${e.setor}` : ''}</Text>
                <Text style={s.expData}>{e.dataInicio}{e.atual ? ' · Atual' : e.dataFim ? ` → ${e.dataFim}` : ''}</Text>
                {e.descricao ? <Text style={s.expDesc}>{e.descricao}</Text> : null}
                {e.resultados ? (
                  <View style={s.resultadosBox}>
                    <Text style={s.resultadosTitulo}>Principais resultados</Text>
                    <Text style={s.resultadosTxt}>{e.resultados}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </SeccaoCard>

        {/* CARD 6 — Formação */}
        <SeccaoCard>
          <SeccaoHeader titulo="Formação académica" onAdd={irParaEditar} onEdit={irParaEditar} />
          {formacoes.length === 0 ? (
            <View style={s.secVaziaWrap}>
              <View style={s.secVaziaIcone}><Feather name="book-open" size={22} color={C.cinza3} /></View>
              <Text style={s.secVaziaTitulo}>Instituição de ensino</Text>
              <Text style={s.secVaziaDesc}>Diploma, Área de estudo{'\n'}2019 - 2023</Text>
              <TouchableOpacity style={s.btnSugestao} onPress={irParaEditar}>
                <Text style={s.btnSugestaoTxt}>Adicionar formação académica</Text>
              </TouchableOpacity>
            </View>
          ) : formacoes.map((f, i) => (
            <View key={i} style={s.expItem}>
              <View style={s.expLogoBg}><Feather name="book-open" size={20} color={C.cinza3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.expCargo}>{f.curso}</Text>
                <Text style={s.expEmpresa}>{f.instituicao}{f.grau ? ` · ${f.grau}` : ''}</Text>
                {f.area ? <Text style={s.expData}>{f.area}</Text> : null}
                <Text style={s.expData}>{f.anoInicio}{f.emCurso ? ' · Em curso' : f.anoConclusao ? ` → ${f.anoConclusao}` : ''}</Text>
              </View>
            </View>
          ))}
        </SeccaoCard>

        {/* CARD 7 — Competências */}
        {(compTecnicas.length + compPessoais.length) > 0 ? (
          <SeccaoCard>
            <SeccaoHeader titulo="Competências" onAdd={irParaEditar} onEdit={irParaEditar} />
            {compTecnicas.length > 0 && (
              <>
                <Text style={s.subSecTitulo}>Técnicas</Text>
                <View style={s.chipGrupo}>
                  {compTecnicas.map(c => <Chip key={c} label={c} destaque />)}
                </View>
              </>
            )}
            {compPessoais.length > 0 && (
              <>
                <Text style={[s.subSecTitulo, { marginTop: 12 }]}>Interpessoais</Text>
                <View style={s.chipGrupo}>
                  {compPessoais.map(c => <Chip key={c} label={c} />)}
                </View>
              </>
            )}
          </SeccaoCard>
        ) : (
          <SeccaoCard>
            <SeccaoHeader titulo="Competências" onAdd={irParaEditar} />
            <View style={s.secVaziaWrap}>
              <Text style={s.secVaziaDesc}>
                Comunique a sua adequação a novas oportunidades; 50% dos recrutadores usam dados de competências para preencher vagas.
              </Text>
              <Text style={[s.secVaziaDesc, { color: C.cinza3, marginTop: 8 }]}>Competências interpessoais</Text>
              <Divisor />
              <Text style={[s.secVaziaDesc, { color: C.cinza3 }]}>Competências técnicas</Text>
              <TouchableOpacity style={s.btnSugestao} onPress={irParaEditar}>
                <Text style={s.btnSugestaoTxt}>Adicionar competências</Text>
              </TouchableOpacity>
            </View>
          </SeccaoCard>
        )}

        {/* CARD 8 — Certificações */}
        {(certificacoes.length > 0 || certUrls.length > 0) && (
          <SeccaoCard>
            <SeccaoHeader titulo="Certificações e Formações" onAdd={irParaEditar} onEdit={irParaEditar} />
            {certificacoes.map((c, i) => (
              <View key={i} style={s.expItem}>
                <View style={s.expLogoBg}><Feather name="award" size={20} color={C.cinza3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.expCargo}>{c.nome}</Text>
                  {c.instituicao ? <Text style={s.expEmpresa}>{c.instituicao}</Text> : null}
                  {c.data ? <Text style={s.expData}>{c.data}</Text> : null}
                  {c.certificadoUri ? (
                    <TouchableOpacity onPress={() => abrirDocumento(c.certificadoUri, 'Certificado')} style={s.linkBtn}>
                      <Feather name="external-link" size={13} color={C.azul} />
                      <Text style={s.linkBtnTxt}>Ver certificado</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
            {certUrls.map((url, i) => (
              <TouchableOpacity key={`url-${i}`} style={s.expItem} onPress={() => abrirDocumento(url, `Certificado ${i + 1}`)}>
                <View style={s.expLogoBg}><Feather name="award" size={20} color={C.cinza3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.expCargo}>{`Certificado ${i + 1}`}</Text>
                  <Text style={s.expData}>Toque para visualizar</Text>
                </View>
                <Feather name="external-link" size={14} color={C.cinza3} />
              </TouchableOpacity>
            ))}
          </SeccaoCard>
        )}

        {/* CARD 9 — Idiomas */}
        {idiomas.length > 0 && (
          <SeccaoCard>
            <SeccaoHeader titulo="Idiomas" onAdd={irParaEditar} onEdit={irParaEditar} />
            {idiomas.map((id, i) => (
              <View key={i} style={s.idiomaItem}>
                <Text style={s.idiomaNome}>{id.idioma}</Text>
                <View style={s.idiomaGrid}>
                  <View style={s.idiomaCol}><Text style={s.idiomaLabel}>Leitura</Text><Text style={s.idiomaValor}>{id.leitura}</Text></View>
                  <View style={s.idiomaDivisor} />
                  <View style={s.idiomaCol}><Text style={s.idiomaLabel}>Escrita</Text><Text style={s.idiomaValor}>{id.escrita}</Text></View>
                  <View style={s.idiomaDivisor} />
                  <View style={s.idiomaCol}><Text style={s.idiomaLabel}>Conversação</Text><Text style={s.idiomaValor}>{id.conversacao}</Text></View>
                </View>
              </View>
            ))}
          </SeccaoCard>
        )}

        {/* CARD 10 — Dados Pessoais */}
        <SeccaoCard>
          <SeccaoHeader titulo="Dados Pessoais" onEdit={irParaEditar} />
          <InfoLinha icone="calendar"    label="Data de Nascimento"   valor={perfil?.dataNasc} />
          <InfoLinha icone="users"       label="Género"               valor={perfil?.genero} />
          <InfoLinha icone="flag"        label="Nacionalidade"        valor={perfil?.nacionalidade} />
          <InfoLinha icone="heart"       label="Estado Civil"         valor={perfil?.estadoCivil} />
          <InfoLinha icone="phone"       label="Telefone Principal"   valor={telefone ? `+244 ${telefone}` : null} />
          <InfoLinha icone="phone"       label="Telefone Alternativo" valor={perfil?.telAlternativo ? `+244 ${perfil.telAlternativo}` : null} />
          <InfoLinha icone="mail"        label="E-mail"               valor={emailPerfil} />
          <InfoLinha icone="map-pin"     label="Província"            valor={perfil?.provincia} />
          <InfoLinha icone="map-pin"     label="Município"            valor={perfil?.municipio} />
          <InfoLinha icone="home"        label="Endereço"             valor={perfil?.endereco} />
        </SeccaoCard>

        {/* CARD 11 — Perfil Profissional */}
        <SeccaoCard>
          <SeccaoHeader titulo="Perfil Profissional" onEdit={irParaEditar} />
          <InfoLinha icone="award"       label="Título Profissional"   valor={titulo} />
          <InfoLinha icone="activity"    label="Situação Profissional" valor={perfil?.situacaoProf} />
          <InfoLinha icone="clock"       label="Disponibilidade"       valor={perfil?.disponibilidade} />
          <InfoLinha icone="dollar-sign" label="Pretensão Salarial"    valor={perfil?.pretensaoSalarial ? `${perfil.pretensaoSalarial} Kz` : null} />
          {resumoPerfil ? (
            <View style={s.resumoBox}>
              <Text style={s.resumoLabel}>Resumo</Text>
              <Text style={s.resumoTxt}>{resumoPerfil}</Text>
            </View>
          ) : null}
        </SeccaoCard>

        {/* CARD 12 — Documentos */}
        {(perfil?.uriCV || perfil?.cvUrl || perfil?.uriBilhete || perfil?.uriCertificados || perfil?.uriCartaConducao || perfil?.uriPortefolio || perfil?.uriDiploma) && (
          <SeccaoCard>
            <SeccaoHeader titulo="Documentos" onEdit={irParaEditar} />
            {(perfil?.uriCV || perfil?.cvUrl) && (
              <TouchableOpacity style={s.docCard} onPress={() => abrirDocumento(perfil.uriCV || perfil.cvUrl, 'Curriculum Vitae')}>
                <View style={s.docIcone}><Feather name="file-text" size={18} color={C.azul} /></View>
                <View style={{ flex: 1 }}><Text style={s.docNome}>Curriculum Vitae</Text><Text style={s.docSub}>Toque para visualizar</Text></View>
                <Feather name="eye" size={15} color={C.verde} />
              </TouchableOpacity>
            )}
            {perfil?.uriBilhete && (
              <TouchableOpacity style={s.docCard} onPress={() => abrirDocumento(perfil.uriBilhete, 'Bilhete de Identidade')}>
                <View style={s.docIcone}><Feather name="credit-card" size={18} color={C.azul} /></View>
                <View style={{ flex: 1 }}><Text style={s.docNome}>Bilhete de Identidade</Text><Text style={s.docSub}>Toque para visualizar</Text></View>
                <Feather name="eye" size={15} color={C.verde} />
              </TouchableOpacity>
            )}
            {perfil?.uriCertificados && (
              <TouchableOpacity style={s.docCard} onPress={() => abrirDocumento(perfil.uriCertificados, 'Certificados')}>
                <View style={s.docIcone}><Feather name="award" size={18} color={C.azul} /></View>
                <View style={{ flex: 1 }}><Text style={s.docNome}>Certificados</Text><Text style={s.docSub}>Toque para visualizar</Text></View>
                <Feather name="eye" size={15} color={C.verde} />
              </TouchableOpacity>
            )}
            {perfil?.uriCartaConducao && (
              <TouchableOpacity style={s.docCard} onPress={() => abrirDocumento(perfil.uriCartaConducao, 'Carta de Condução')}>
                <View style={s.docIcone}><Feather name="truck" size={18} color={C.azul} /></View>
                <View style={{ flex: 1 }}><Text style={s.docNome}>Carta de Condução</Text><Text style={s.docSub}>Toque para visualizar</Text></View>
                <Feather name="eye" size={15} color={C.verde} />
              </TouchableOpacity>
            )}
            {perfil?.uriPortefolio && (
              <TouchableOpacity style={s.docCard} onPress={() => abrirDocumento(perfil.uriPortefolio, 'Portefólio')}>
                <View style={s.docIcone}><Feather name="folder" size={18} color={C.azul} /></View>
                <View style={{ flex: 1 }}><Text style={s.docNome}>Portefólio</Text><Text style={s.docSub}>Toque para visualizar</Text></View>
                <Feather name="eye" size={15} color={C.verde} />
              </TouchableOpacity>
            )}
            {perfil?.uriDiploma && (
              <TouchableOpacity style={s.docCard} onPress={() => abrirDocumento(perfil.uriDiploma, 'Diploma')}>
                <View style={s.docIcone}><Feather name="book-open" size={18} color={C.azul} /></View>
                <View style={{ flex: 1 }}><Text style={s.docNome}>Diploma</Text><Text style={s.docSub}>Toque para visualizar</Text></View>
                <Feather name="eye" size={15} color={C.verde} />
              </TouchableOpacity>
            )}
          </SeccaoCard>
        )}

        {/* CARD 13 — Redes Profissionais */}
        {(perfil?.linkedin || perfil?.github || perfil?.behance || perfil?.website) && (
          <SeccaoCard>
            <SeccaoHeader titulo="Redes Profissionais" onEdit={irParaEditar} />
            {perfil?.linkedin && (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.linkedin)}>
                <View style={[s.redeIcone, { backgroundColor: '#EEF4FF' }]}><Feather name="linkedin" size={15} color="#0A66C2" /></View>
                <Text style={s.redeTxt}>LinkedIn</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            )}
            {perfil?.github && (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.github)}>
                <View style={[s.redeIcone, { backgroundColor: C.cinza1 }]}><Feather name="github" size={15} color={C.cinza4} /></View>
                <Text style={s.redeTxt}>GitHub</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            )}
            {perfil?.behance && (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.behance)}>
                <View style={[s.redeIcone, { backgroundColor: '#EEF4FF' }]}><Feather name="grid" size={15} color={C.azul} /></View>
                <Text style={s.redeTxt}>Behance</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            )}
            {perfil?.website && (
              <TouchableOpacity style={s.redeLinha} onPress={() => Linking.openURL(perfil.website)}>
                <View style={[s.redeIcone, { backgroundColor: C.cinza1 }]}><Feather name="globe" size={15} color={C.cinza4} /></View>
                <Text style={s.redeTxt}>Website Pessoal</Text>
                <Feather name="external-link" size={13} color={C.cinza3} />
              </TouchableOpacity>
            )}
          </SeccaoCard>
        )}

        {/* CARD 14 — Interesses */}
        <SeccaoCard>
          <Text style={s.seccaoTitulo}>Interesses</Text>
          {perfil?.interesses && perfil.interesses.length > 0 ? (
            perfil.interesses.map((int, i) => (
              <View key={i} style={s.interesseItem}>
                <View style={s.interesseLogoBg}><Feather name="star" size={18} color={C.cinza3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.interesseNome}>{int.nome || int}</Text>
                  {int.seguidores ? <Text style={s.interesseSeg}>{int.seguidores} seguidores</Text> : null}
                </View>
                <TouchableOpacity style={s.btnSeguindo}>
                  <Ionicons name="checkmark" size={13} color={C.cinza4} />
                  <Text style={s.btnSeguindoTxt}>Seguindo</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={s.vazioTxt}>Nenhum interesse adicionado.</Text>
          )}

          <Divisor />

          <View style={s.metaDadosRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.metaDadosTitulo}>Idioma do perfil</Text>
              <Text style={s.metaDadosVal}>{perfil?.idiomaPerfil || 'Português'}</Text>
            </View>
            <TouchableOpacity onPress={irParaEditar}><Feather name="edit-2" size={16} color={C.cinza4} /></TouchableOpacity>
          </View>

          <Divisor />

          <View style={s.metaDadosRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.metaDadosTitulo}>Perfil público e URL</Text>
              <Text style={s.metaDadosVal}>
                {perfil?.urlPublica || `connectall.ao/in/${(nome || 'utilizador').toLowerCase().replace(/\s/g, '-')}`}
              </Text>
            </View>
            <TouchableOpacity onPress={irParaEditar}><Feather name="edit-2" size={16} color={C.cinza4} /></TouchableOpacity>
          </View>
        </SeccaoCard>

        {/* CARD 15 — Verificação e Segurança */}
        <SeccaoCard>
          <SeccaoHeader titulo="Verificação e Segurança" onEdit={irParaEditar} />
          <View style={s.verificacaoLista}>
            {[
              { label: 'E-mail verificado',       ok: !!perfil?.emailVerificado },
              { label: 'Telefone verificado',      ok: !!perfil?.telVerificado },
              { label: 'Bilhete de Identidade',    ok: !!perfil?.uriBilhete },
              { label: 'Curriculum Vitae',         ok: !!(perfil?.uriCV || perfil?.cvUrl) },
              { label: 'Formação académica',       ok: formacoes.length > 0 },
              { label: 'Experiência profissional', ok: experiencias.length > 0 },
              { label: 'Competências definidas',   ok: (compTecnicas.length + compPessoais.length) > 0 },
              { label: 'Idiomas definidos',        ok: idiomas.length > 0 },
            ].map(({ label, ok }) => (
              <View key={label} style={s.verificacaoLinha}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ok ? C.verde : C.cinza3} />
                <Text style={[s.verificacaoTxt, ok && { color: C.verde }]}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={s.progressoWrap}>
            <View style={s.progressoTopo}>
              <Text style={s.progressoLabel}>Perfil completo</Text>
              <Text style={s.progressoPerc}>{percentagem}%</Text>
            </View>
            <View style={s.progressoFundo}>
              <View style={[s.progressoBarra, { width: `${percentagem}%` }]} />
            </View>
          </View>
        </SeccaoCard>

        {/* Banner publicitário */}
        {banners.length > 0 && (
          <View style={s.pubBloco}>
            <Image
              source={{ uri: banners[bannerIdx] }}
              style={s.pubBannerImg}
              resizeMode="cover"
            />
            {banners.length > 1 && (
              <View style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
                position: 'absolute',
                bottom: 8,
                width: '100%',
              }}>
                {banners.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === bannerIdx ? 18 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i === bannerIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}



        {/* Rodapé */}
        <View style={s.rodape}>
          <View style={s.rodapeLinksRow}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'privacidade' } })}>
              <Text style={s.rodapeLink}>Sobre</Text>
            </TouchableOpacity>
            <TouchableOpacity><Text style={s.rodapeLink}>Acessibilidade</Text></TouchableOpacity>
            <TouchableOpacity>
              <View style={s.duvidasBtn}>
                <Ionicons name="help-circle-outline" size={14} color={C.cinza3} />
                <Text style={s.rodapeLink}>Dúvidas?</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity>
              <View style={s.duvidasBtn}>
                <Ionicons name="settings-outline" size={14} color={C.cinza3} />
                <Text style={s.rodapeLink}>Gerir conta e privacidade</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={s.rodapeLinksRow}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'contrato' } })}>
              <Text style={s.rodapeLink}>Termos e Privacidade</Text>
            </TouchableOpacity>
            <TouchableOpacity><Text style={s.rodapeLink}>Preferências de anúncios</Text></TouchableOpacity>
            <TouchableOpacity><Text style={s.rodapeLink}>Soluções de Marketing</Text></TouchableOpacity>
          </View>
          <Text style={s.rodapeCopyright}>ConnectAll Angola © {new Date().getFullYear()}</Text>
        </View>

        {/* Terminar sessão */}
        <View style={s.logoutWrap}>
          <TouchableOpacity style={s.logoutBtn} onPress={terminarSessao}>
            <Feather name="log-out" size={18} color={C.error} />
            <Text style={s.logoutTxt}>Terminar Sessão</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal imagem */}
      <Modal visible={modalImagem} transparent animationType="fade" onRequestClose={() => setModalImagem(false)}>
        <View style={s.modalFundo}>
          <TouchableOpacity style={s.modalFechar} onPress={() => setModalImagem(false)}>
            <Feather name="x" size={28} color={C.branco} />
          </TouchableOpacity>
          {imagemExpandida
            ? <Image source={{ uri: imagemExpandida }} style={s.modalImagem} resizeMode="contain" />
            : null}
        </View>
      </Modal>

      <BloqueioAnonimo visivel={modalBloqueio} tipo="acao" onFechar={() => setModalBloqueio(false)} />

      {/* Visualizador de documentos (PDF + imagens) */}
      {Visualizador}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.cinza1 },
  centro:  { justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingTxt:  { marginTop: 12, fontSize: 14, color: C.cinza3, fontWeight: '500' },
  erroTitulo:  { fontSize: 18, fontWeight: '700', color: C.preto, marginTop: 16 },
  erroSub:     { fontSize: 14, color: C.cinza3, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  loginBtn:    { backgroundColor: C.azul, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24 },
  loginBtnTxt: { color: C.branco, fontWeight: '700', fontSize: 14 },
  topbar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  logoRow:      { flexDirection: 'row', alignItems: 'center' },
  logoConnect:  { fontSize: 20, fontWeight: '900', color: C.preto },
  logoAll:      { fontSize: 20, fontWeight: '900', color: C.vermelho },
  topbarRight:  { flexDirection: 'row', gap: 8 },
  topbarIconBtn:{ padding: 6 },
  scrollContent: { paddingBottom: 16 },
  cardPrincipal: { backgroundColor: C.branco, marginBottom: 8 },
  capa:           { width: '100%', height: 160, backgroundColor: C.cinza2, justifyContent: 'center', alignItems: 'center' },
  capaVazia:      { width: '100%', height: 160, backgroundColor: C.cinza2, justifyContent: 'center', alignItems: 'center' },
  camaraCapaBtn:  { position: 'absolute', top: 12, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },
  avatarRow:      { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -48 },
  avatarCirculo:  { width: 96, height: 96, borderRadius: 48, backgroundColor: C.branco, borderWidth: 3, borderColor: C.branco, overflow: 'hidden', zIndex: 5 },
  avatarImagem:   { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' },
  avatarLetra:    { color: C.branco, fontSize: 36, fontWeight: '800' },
  editLapis:      { padding: 8, marginBottom: 4 },
  infoPrincipalWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  nomeEmpresaRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  nome:              { fontSize: 22, fontWeight: '800', color: C.preto, flex: 1 },
  tituloProfissional:{ fontSize: 14, color: C.cinza4, lineHeight: 20, marginBottom: 4 },
  logoEmpresa:       { width: 44, height: 44, borderRadius: 4, borderWidth: 1, borderColor: C.cinza2 },
  localizacaoRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  localizacaoTxt:    { fontSize: 13, color: C.cinza3 },
  separadorDot:      { fontSize: 13, color: C.cinza3 },
  linkAzul:          { fontSize: 13, color: C.azul, fontWeight: '600' },
  badgesRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  badgeVerde:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EAF6EF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeVerdeTxt:     { fontSize: 11, fontWeight: '600', color: C.verde },
  botoesAcaoRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  btnPrimario:       { backgroundColor: C.azul, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  btnPrimarioTxt:    { color: C.branco, fontWeight: '700', fontSize: 13 },
  btnSecundario:     { borderWidth: 1.5, borderColor: C.cinza3, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  btnSecundarioTxt:  { color: C.cinza4, fontWeight: '600', fontSize: 13 },
  btnRecursos:       { borderWidth: 1.5, borderColor: C.cinza3, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  btnRecursosTxt:    { color: C.cinza4, fontWeight: '600', fontSize: 13 },
  btnAprimorar:      { width: '100%', borderWidth: 1.5, borderColor: C.azul, paddingVertical: 11, borderRadius: 24, alignItems: 'center' },
  btnAprimorarTxt:   { color: C.azul, fontWeight: '700', fontSize: 14 },
  situacaoCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, marginBottom: 14, padding: 14, backgroundColor: C.cinza1, borderRadius: 8, borderWidth: 1, borderColor: C.cinza2, borderStyle: 'dashed' },
  situacaoLeft:      { flex: 1 },
  situacaoTitulo:    { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 2 },
  situacaoSub:       { fontSize: 13, color: C.cinza4 },
  situacaoLink:      { fontSize: 13, color: C.azul, fontWeight: '600', marginTop: 4 },
  situacaoEditBtn:   { padding: 4 },
  seccaoCard:        { backgroundColor: C.branco, marginBottom: 8, padding: 16 },
  seccaoHeaderRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  seccaoTitulo:      { fontSize: 18, fontWeight: '700', color: C.preto },
  seccaoAcoes:       { flexDirection: 'row', gap: 4 },
  seccaoIconBtn:     { padding: 4 },
  seguidoresTxt:     { fontSize: 13, color: C.azul, fontWeight: '600', marginTop: 2 },
  sugestoesTitulo:   { fontSize: 18, fontWeight: '700', color: C.preto, marginBottom: 4 },
  sugestoesVisivel:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  sugestoesVisivelTxt: { fontSize: 12, color: C.cinza3 },
  sugestaoItem:      { flexDirection: 'row', gap: 12, marginBottom: 20, paddingBottom: 20, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  sugestaoIcone:     { width: 48, height: 48, borderRadius: 4, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },
  sugestaoTitulo:    { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 4, lineHeight: 20 },
  sugestaoDesc:      { fontSize: 13, color: C.cinza3, lineHeight: 18, marginBottom: 10 },
  btnSugestao:       { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: C.cinza4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 24 },
  btnSugestaoTxt:    { fontSize: 13, fontWeight: '600', color: C.cinza4 },
  analiseTitulo:     { fontSize: 18, fontWeight: '700', color: C.preto, marginBottom: 4 },
  analiseItem:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  analiseNum:        { fontSize: 15, fontWeight: '700', color: C.preto, marginBottom: 2 },
  analiseDesc:       { fontSize: 13, color: C.cinza3 },
  analiseDescSub:    { fontSize: 12, color: C.cinza3, marginTop: 2 },
  exibirAnalisesBtn: { paddingTop: 8, alignItems: 'center' },
  exibirAnalisesLink:{ fontSize: 14, fontWeight: '600', color: C.cinza4 },
  btnCriarPublicacao:    { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: C.azul, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, marginBottom: 14 },
  btnCriarPublicacaoTxt: { fontSize: 13, fontWeight: '700', color: C.azul },
  tabsRow:       { flexDirection: 'row', gap: 0, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: C.cinza2 },
  tabBtn:        { paddingVertical: 10, paddingHorizontal: 14, marginBottom: -1 },
  tabBtnAtivo:   { borderBottomWidth: 2, borderBottomColor: C.preto },
  tabBtnTxt:     { fontSize: 14, fontWeight: '500', color: C.cinza3 },
  tabBtnTxtAtivo:{ color: C.preto, fontWeight: '700' },
  atividadesVazio:{ paddingVertical: 16, alignItems: 'center' },
  expItem:       { flexDirection: 'row', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  expLogoBg:     { width: 48, height: 48, borderRadius: 4, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },
  expLogo:       { width: 48, height: 48, borderRadius: 4 },
  expCargo:      { fontSize: 15, fontWeight: '700', color: C.preto, marginBottom: 2 },
  expEmpresa:    { fontSize: 13, color: C.cinza4, marginBottom: 2 },
  expData:       { fontSize: 12, color: C.cinza3 },
  expDesc:       { fontSize: 13, color: C.cinza4, lineHeight: 19, marginTop: 6 },
  resultadosBox:    { backgroundColor: C.cinza1, borderRadius: 8, padding: 10, marginTop: 8 },
  resultadosTitulo: { fontSize: 11, fontWeight: '700', color: C.cinza3, textTransform: 'uppercase', marginBottom: 4 },
  resultadosTxt:    { fontSize: 13, color: C.cinza4, lineHeight: 18 },
  secVaziaWrap:   { paddingVertical: 8, alignItems: 'flex-start' },
  secVaziaIcone:  { width: 48, height: 48, borderRadius: 4, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2, marginBottom: 10 },
  secVaziaTitulo: { fontSize: 14, fontWeight: '600', color: C.cinza4, marginBottom: 4 },
  secVaziaDesc:   { fontSize: 13, color: C.cinza3, lineHeight: 19, marginBottom: 10 },
  subSecTitulo:  { fontSize: 12, fontWeight: '700', color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  chipGrupo:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.cinza2, backgroundColor: C.cinza1 },
  chipDestaque:  { borderColor: C.azul, backgroundColor: C.azulClaro },
  chipTxt:       { fontSize: 12, color: C.cinza3, fontWeight: '500' },
  chipTxtDestaque: { color: C.azul, fontWeight: '700' },
  idiomaItem:    { borderWidth: 1, borderColor: C.cinza2, borderRadius: 8, padding: 14, marginBottom: 12 },
  idiomaNome:    { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 10 },
  idiomaGrid:    { flexDirection: 'row', alignItems: 'center' },
  idiomaCol:     { flex: 1, alignItems: 'center' },
  idiomaDivisor: { width: 1, height: 30, backgroundColor: C.cinza2 },
  idiomaLabel:   { fontSize: 10, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  idiomaValor:   { fontSize: 12, fontWeight: '700', color: C.azul },
  infoLinha:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoIconBox:   { width: 32, height: 32, borderRadius: 8, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  infoMeta:      { flex: 1 },
  infoLabel:     { fontSize: 11, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  infoValor:     { fontSize: 14, fontWeight: '600', color: C.cinza4 },
  resumoBox:     { backgroundColor: C.cinza1, borderRadius: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: C.azul, marginTop: 8 },
  resumoLabel:   { fontSize: 11, color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, fontWeight: '700' },
  resumoTxt:     { fontSize: 13, color: C.cinza4, lineHeight: 20, fontStyle: 'italic' },
  docCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: C.cinza2, borderRadius: 8, marginBottom: 10, backgroundColor: C.cinza1 },
  docIcone:      { width: 36, height: 36, borderRadius: 8, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center' },
  docNome:       { fontSize: 13, fontWeight: '700', color: C.preto },
  docSub:        { fontSize: 11, color: C.cinza3, marginTop: 1 },
  redeLinha:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  redeIcone:     { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  redeTxt:       { flex: 1, fontSize: 14, fontWeight: '600', color: C.cinza4 },
  linkBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  linkBtnTxt:    { fontSize: 12, color: C.azul, fontWeight: '600' },
  interesseItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  interesseLogoBg: { width: 48, height: 48, borderRadius: 4, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },
  interesseNome:   { fontSize: 14, fontWeight: '700', color: C.preto },
  interesseSeg:    { fontSize: 12, color: C.cinza3, marginTop: 2 },
  btnSeguindo:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: C.cinza3, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  btnSeguindoTxt:  { fontSize: 12, fontWeight: '600', color: C.cinza4 },
  metaDadosRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  metaDadosTitulo: { fontSize: 15, fontWeight: '700', color: C.preto, marginBottom: 2 },
  metaDadosVal:    { fontSize: 13, color: C.cinza3 },
  divisorLinha:    { height: 0.5, backgroundColor: C.cinza2, marginVertical: 4 },
  verificacaoLista:{ gap: 12, marginBottom: 16 },
  verificacaoLinha:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  verificacaoTxt:  { fontSize: 13, color: C.cinza3, fontWeight: '500' },
  progressoWrap:   { marginTop: 8 },
  progressoTopo:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressoLabel:  { fontSize: 12, color: C.cinza3, fontWeight: '500' },
  progressoPerc:   { fontSize: 12, color: C.azul, fontWeight: '700' },
  progressoFundo:  { height: 6, backgroundColor: C.cinza2, borderRadius: 3 },
  progressoBarra:  { height: 6, backgroundColor: C.azul, borderRadius: 3 },
  pubBloco:        { marginBottom: 8 },
  pubBannerImg:    { width: '100%', height: 180 },
  rodape:          { backgroundColor: C.cinza1, paddingHorizontal: 16, paddingVertical: 20, marginBottom: 8 },
  rodapeLinksRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  rodapeLink:      { fontSize: 12, color: C.cinza3 },
  duvidasBtn:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rodapeCopyright: { fontSize: 11, color: C.cinza3, marginTop: 8 },
  logoutWrap:      { paddingHorizontal: 16, marginBottom: 8 },
  logoutBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF5F5', paddingVertical: 14, borderRadius: 28, borderWidth: 1.5, borderColor: '#FECACA' },
  logoutTxt:       { color: C.error, fontSize: 14, fontWeight: '700' },
  modalFundo:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalFechar:     { position: 'absolute', top: 40, right: 24, zIndex: 20, padding: 10 },
  modalImagem:     { width: '92%', height: '75%' },
  vazioTxt:        { fontSize: 13, color: C.cinza3, fontStyle: 'italic' },
});