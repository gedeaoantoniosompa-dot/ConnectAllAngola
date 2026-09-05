/**
 * app/(auth)/configuracoes.jsx — ConnectAll Angola
 *
 * Ecrã de "Configurações e privacidade", acedido a partir do menu
 * (menu.jsx → "Configurações e privacidade").
 *
 * TUDO o que aqui aparece lê e grava mesmo no Firestore, através de
 * guardarPerfil() do UserContext — nada aqui é uma simulação visual.
 *
 * ── ALTERAÇÃO (idioma da app) ──
 * O selector de idioma já não guarda um nome fixo ('Português' etc.) —
 * grava um CÓDIGO ('pt'|'en'|'fr'|'es') no campo idiomaPerfil. Esse
 * mesmo campo é lido pelo UserContext (ver idioma/t() em
 * UserContext.tsx) para escolher o dicionário de traduções certo — por
 * isso, mudar o idioma aqui muda IMEDIATAMENTE todos os textos deste
 * ecrã e do menu.jsx (que já usa t() também), sem reiniciar a app: o
 * UserContext propaga perfil.idiomaPerfil em tempo real para todos os
 * ecrãs que usam useUser().
 *
 * Estrutura de dados gravada em users/{uid}:
 *   privacidade: { verPerfil, receberMensagensDe }
 *   onlineActivo: boolean
 *   notificacoes: { push, mensagens, reacoesComentarios, novasConexoes, vagas, emailInformativo }
 *   idiomaPerfil: 'pt' | 'en' | 'fr' | 'es'
 *   contaEstado: { estado: 'eliminada', motivo, dataInicio }
 *
 * ── NOTA IMPORTANTE (transparência, continua válida) ──
 * "Quem pode ver o meu perfil" / "Quem me pode enviar mensagens": a
 * gravação é 100% real. Para isto BLOQUEAR alguém de facto, os ecrãs de
 * perfil público e o início de conversa também têm de verificar este
 * valor — ainda não feito (precisa desses ficheiros).
 * "Mostrar quando estou online" grava em onlineActivo — o nome que
 * pareceu ser usado por usePrivacidade()/usePresenca() em conversa.jsx;
 * a confirmar com esse ficheiro.
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { IDIOMAS_DISPONIVEIS } from '../../i18n/translations';

const C = {
  azul:      '#0A66C2',
  azulClaro: '#EEF3FB',
  branco:    '#FFFFFF',
  preto:     '#000000',
  cinza1:    '#F3F2EE',
  cinza2:    '#E9E5DF',
  cinza3:    '#666360',
  cinza4:    '#1B1B1B',
  vermelho:  '#E00000',
  verde:     '#057642',
};

function Seccao({ titulo, children }) {
  return (
    <View style={s.seccao}>
      <Text style={s.seccaoTitulo}>{titulo}</Text>
      <View style={s.seccaoCard}>{children}</View>
    </View>
  );
}

function LinhaNavegacao({ icone, label, valor, onPress, corIcone = C.cinza4, perigo = false }) {
  return (
    <TouchableOpacity style={s.linha} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.linhaIconeWrap, perigo && { backgroundColor: '#FFF0F0' }]}>
        <Feather name={icone} size={17} color={perigo ? C.vermelho : corIcone} />
      </View>
      <Text style={[s.linhaLabel, perigo && { color: C.vermelho }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {valor ? <Text style={s.linhaValor} numberOfLines={1}>{valor}</Text> : null}
      <Feather name="chevron-right" size={16} color={C.cinza3} />
    </TouchableOpacity>
  );
}

function LinhaSwitch({ icone, label, desc, valor, onValueChange }) {
  return (
    <View style={s.linha}>
      <View style={s.linhaIconeWrap}>
        <Feather name={icone} size={17} color={C.cinza4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.linhaLabel}>{label}</Text>
        {!!desc && <Text style={s.linhaDesc}>{desc}</Text>}
      </View>
      <Switch
        value={!!valor}
        onValueChange={onValueChange}
        trackColor={{ false: C.cinza2, true: C.azul }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Separador() {
  return <View style={s.separador} />;
}

// Modal de escolha genérico — usado para "quem vê o perfil", "quem pode
// enviar mensagens" e idioma. `opcoes` é sempre uma lista de
// { valor, label, desc? }.
function ModalEscolha({ visivel, titulo, opcoes, valorActual, onEscolher, onFechar, textoFechar }) {
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onFechar}>
        <View style={s.modalSheet} onStartShouldSetResponder={() => true}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitulo}>{titulo}</Text>
          {opcoes.map((op) => {
            const seleccionado = op.valor === valorActual;
            return (
              <TouchableOpacity
                key={op.valor}
                style={s.modalOpcao}
                onPress={() => { onEscolher(op.valor); onFechar(); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.modalOpcaoLabel, seleccionado && { color: C.azul, fontWeight: '700' }]}>
                    {op.label}
                  </Text>
                  {!!op.desc && <Text style={s.modalOpcaoDesc}>{op.desc}</Text>}
                </View>
                {seleccionado && <Ionicons name="checkmark-circle" size={20} color={C.azul} />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={s.modalFecharBtn} onPress={onFechar}>
            <Text style={s.modalFecharTxt}>{textoFechar}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function ConfiguracoesScreen() {
  const router = useRouter();
  const { user, perfil, guardarPerfil, t, idioma } = useUser();

  const [modalVerPerfil, setModalVerPerfil]   = useState(false);
  const [modalMensagens, setModalMensagens]   = useState(false);
  const [modalIdioma, setModalIdioma]         = useState(false);
  const [aGuardar, setAGuardar]               = useState(false);
  const [aEnviarReset, setAEnviarReset]       = useState(false);

  // Valores actuais, com defaults sensatos quando ainda não foram definidos.
  const privacidade   = perfil?.privacidade || {};
  const verPerfil      = privacidade.verPerfil || 'todos';
  const receberMsgsDe  = privacidade.receberMensagensDe || 'todos';
  const onlineActivo   = perfil?.onlineActivo !== false; // por defeito, visível
  const notificacoes   = perfil?.notificacoes || {};

  // Estas listas de opções são construídas AQUI dentro (não como
  // constantes fixas fora do componente) precisamente porque dependem
  // de t() — assim mudam de idioma em tempo real, tal como o resto do
  // ecrã, sem precisar de reabrir nada.
  const OPCOES_VER_PERFIL = [
    { valor: 'todos',        label: t('conf_optVerTodos'),        desc: t('conf_optVerTodosDesc') },
    { valor: 'recrutadores', label: t('conf_optVerRecrutadores'), desc: t('conf_optVerRecrutadoresDesc') },
    { valor: 'conexoes',     label: t('conf_optVerConexoes'),     desc: t('conf_optVerConexoesDesc') },
  ];

  const OPCOES_MENSAGENS = [
    { valor: 'todos',    label: t('conf_optMsgTodos'),    desc: t('conf_optMsgTodosDesc') },
    { valor: 'conexoes', label: t('conf_optMsgConexoes'), desc: t('conf_optMsgConexoesDesc') },
    { valor: 'ninguem',  label: t('conf_optMsgNinguem'),  desc: t('conf_optMsgNinguemDesc') },
  ];

  // IDIOMAS_DISPONIVEIS vem de i18n/translations.js: [{codigo, nome}].
  // Cada nome já está no idioma respectivo (ex: "English", "Français"),
  // não traduzido para o idioma actual — é assim que a maioria das apps
  // mostra o selector de idioma, para conseguires reconhecer a tua
  // língua mesmo que a app esteja presa noutra.
  const OPCOES_IDIOMA = IDIOMAS_DISPONIVEIS.map((i) => ({ valor: i.codigo, label: i.nome }));

  // Grava um pedaço de dados via guardarPerfil (Firestore real, com
  // merge — nunca apaga o resto do perfil).
  const atualizar = async (dados) => {
    setAGuardar(true);
    try {
      await guardarPerfil(dados);
    } catch (e) {
      Alert.alert(t('erro'), t('conf_erroGuardar'));
    } finally {
      setAGuardar(false);
    }
  };

  const definirVerPerfil = (valor) => atualizar({ privacidade: { ...privacidade, verPerfil: valor } });
  const definirReceberMsgs = (valor) => atualizar({ privacidade: { ...privacidade, receberMensagensDe: valor } });
  const definirOnlineActivo = (valor) => atualizar({ onlineActivo: valor });
  const definirNotificacao = (campo, valor) => atualizar({ notificacoes: { ...notificacoes, [campo]: valor } });
  // Muda o idioma de toda a app: grava o CÓDIGO em idiomaPerfil — o
  // UserContext lê este mesmo campo (perfil.idiomaPerfil) para calcular
  // t(), por isso este único guardarPerfil já é suficiente para traduzir
  // tudo o que usa t() em qualquer ecrã, em tempo real.
  const definirIdioma = (codigo) => atualizar({ idiomaPerfil: codigo });

  const irParaEditarPerfil = () => {
    if (perfil?.tipoPerfil === 'recrutador') {
      router.push({ pathname: '/(main)/completar-perfil-recrutador', params: { passoInicial: 'dados' } });
    } else {
      router.push({ pathname: '/(auth)/profile', params: { voltarPara: 'my-profile' } });
    }
  };

  const mudarPalavraPasse = async () => {
    const email = perfil?.email || perfil?.emailContacto || user?.email;
    if (!email) {
      Alert.alert(t('conf_emailNaoEncontrado'), t('conf_emailNaoEncontradoDesc'));
      return;
    }
    setAEnviarReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(t('conf_emailEnviado'), t('conf_emailEnviadoDesc', email));
    } catch (e) {
      Alert.alert(t('erro'), e?.message || t('conf_erroReset'));
    } finally {
      setAEnviarReset(false);
    }
  };

  const terminarSessao = () => {
    Alert.alert(t('conf_terminarSessao'), t('menu_confirmarSairTexto') || '', [
      { text: t('cancelar'), style: 'cancel' },
      {
        text: t('menu_sair'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/(auth)/login');
          } catch {
            Alert.alert(t('erro'), t('conf_erroTerminarSessao'));
          }
        },
      },
    ]);
  };

  // Apagar conta: usa o mesmo campo contaEstado que o UserContext já
  // interpreta (interpretarEstadoConta) — é um mecanismo real e já
  // existente na app, não uma marcação inventada só para este ecrã.
  const apagarConta = () => {
    Alert.alert(
      t('conf_apagarContaTitulo'),
      t('conf_apagarContaTexto'),
      [
        { text: t('cancelar'), style: 'cancel' },
        {
          text: t('conf_continuar'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('conf_apagarContaConfirmarTitulo'),
              t('conf_apagarContaConfirmarTexto'),
              [
                { text: t('cancelar'), style: 'cancel' },
                {
                  text: t('conf_apagarContaBotao'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await guardarPerfil({
                        contaEstado: {
                          estado: 'eliminada',
                          motivo: 'Solicitado pelo próprio utilizador',
                          dataInicio: new Date().toISOString(),
                        },
                      });
                      await signOut(auth);
                      router.replace('/(auth)/login');
                    } catch (e) {
                      Alert.alert(t('erro'), t('conf_erroApagarConta'));
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const labelOpcao = (lista, valor) => lista.find((o) => o.valor === valor)?.label || valor;
  const nomeIdiomaActual = IDIOMAS_DISPONIVEIS.find((i) => i.codigo === idioma)?.nome || 'Português';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.branco} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={C.preto} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>{t('conf_titulo')}</Text>
        <View style={{ width: 32 }}>
          {aGuardar && <ActivityIndicator size="small" color={C.azul} />}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── CONTA ── */}
        <Seccao titulo={t('conf_seccaoConta')}>
          <LinhaNavegacao icone="user" label={t('conf_editarPerfil')} onPress={irParaEditarPerfil} />
          <Separador />
          <LinhaNavegacao icone="mail" label={t('conf_email')} valor={perfil?.email || perfil?.emailContacto || '—'} onPress={() => {}} />
          <Separador />
          <LinhaNavegacao icone="phone" label={t('conf_telefone')} valor={perfil?.telPrincipal ? `+244 ${perfil.telPrincipal}` : '—'} onPress={() => {}} />
          <Separador />
          <LinhaNavegacao icone="globe" label={t('conf_idiomaPerfil')} valor={nomeIdiomaActual} onPress={() => setModalIdioma(true)} />
        </Seccao>

        {/* ── PRIVACIDADE ── */}
        <Seccao titulo={t('conf_seccaoPrivacidade')}>
          <LinhaNavegacao
            icone="eye"
            label={t('conf_quemVePerfil')}
            valor={labelOpcao(OPCOES_VER_PERFIL, verPerfil)}
            onPress={() => setModalVerPerfil(true)}
          />
          <Separador />
          <LinhaNavegacao
            icone="message-circle"
            label={t('conf_quemEnviaMsg')}
            valor={labelOpcao(OPCOES_MENSAGENS, receberMsgsDe)}
            onPress={() => setModalMensagens(true)}
          />
          <Separador />
          <LinhaSwitch
            icone="radio"
            label={t('conf_mostrarOnline')}
            desc={t('conf_mostrarOnlineDesc')}
            valor={onlineActivo}
            onValueChange={definirOnlineActivo}
          />
        </Seccao>

        {/* ── NOTIFICAÇÕES ── */}
        <Seccao titulo={t('conf_seccaoNotificacoes')}>
          <LinhaSwitch
            icone="bell"
            label={t('conf_notifPush')}
            desc={t('conf_notifPushDesc')}
            valor={notificacoes.push !== false}
            onValueChange={(v) => definirNotificacao('push', v)}
          />
          <Separador />
          <LinhaSwitch
            icone="message-square"
            label={t('conf_notifMensagens')}
            valor={notificacoes.mensagens !== false}
            onValueChange={(v) => definirNotificacao('mensagens', v)}
          />
          <Separador />
          <LinhaSwitch
            icone="heart"
            label={t('conf_notifReacoes')}
            valor={notificacoes.reacoesComentarios !== false}
            onValueChange={(v) => definirNotificacao('reacoesComentarios', v)}
          />
          <Separador />
          <LinhaSwitch
            icone="user-plus"
            label={t('conf_notifConexoes')}
            valor={notificacoes.novasConexoes !== false}
            onValueChange={(v) => definirNotificacao('novasConexoes', v)}
          />
          <Separador />
          <LinhaSwitch
            icone="briefcase"
            label={t('conf_notifVagas')}
            valor={notificacoes.vagas !== false}
            onValueChange={(v) => definirNotificacao('vagas', v)}
          />
          <Separador />
          <LinhaSwitch
            icone="mail"
            label={t('conf_notifEmail')}
            desc={t('conf_notifEmailDesc')}
            valor={notificacoes.emailInformativo === true}
            onValueChange={(v) => definirNotificacao('emailInformativo', v)}
          />
        </Seccao>

        {/* ── SEGURANÇA ── */}
        <Seccao titulo={t('conf_seccaoSeguranca')}>
          <TouchableOpacity style={s.linha} onPress={mudarPalavraPasse} disabled={aEnviarReset} activeOpacity={0.7}>
            <View style={s.linhaIconeWrap}>
              <Feather name="lock" size={17} color={C.cinza4} />
            </View>
            <Text style={s.linhaLabel}>{t('conf_mudarPalavraPasse')}</Text>
            <View style={{ flex: 1 }} />
            {aEnviarReset ? <ActivityIndicator size="small" color={C.azul} /> : <Feather name="chevron-right" size={16} color={C.cinza3} />}
          </TouchableOpacity>
        </Seccao>

        {/* ── SOBRE E SUPORTE ── */}
        <Seccao titulo={t('conf_seccaoSobre')}>
          <LinhaNavegacao
            icone="help-circle"
            label={t('conf_ajudaSuporte')}
            onPress={() => router.push('/(auth)/contactar-suporte')}
          />
          <Separador />
          <LinhaNavegacao
            icone="file-text"
            label={t('conf_termosPrivacidade')}
            onPress={() => router.push({ pathname: '/(auth)/politicas', params: { tipo: 'privacidade' } })}
          />
          <Separador />
          <LinhaNavegacao icone="info" label={t('conf_versaoApp')} valor="1.0.0" onPress={() => {}} />
        </Seccao>

        {/* ── ZONA DE RISCO ── */}
        <Seccao titulo={t('conf_seccaoContaSessao')}>
          <LinhaNavegacao icone="log-out" label={t('conf_terminarSessao')} onPress={terminarSessao} corIcone={C.vermelho} />
          <Separador />
          <LinhaNavegacao icone="trash-2" label={t('conf_apagarConta')} onPress={apagarConta} perigo />
        </Seccao>

      </ScrollView>

      <ModalEscolha
        visivel={modalVerPerfil}
        titulo={t('conf_quemVePerfil')}
        opcoes={OPCOES_VER_PERFIL}
        valorActual={verPerfil}
        onEscolher={definirVerPerfil}
        onFechar={() => setModalVerPerfil(false)}
        textoFechar={t('fechar')}
      />
      <ModalEscolha
        visivel={modalMensagens}
        titulo={t('conf_quemEnviaMsg')}
        opcoes={OPCOES_MENSAGENS}
        valorActual={receberMsgsDe}
        onEscolher={definirReceberMsgs}
        onFechar={() => setModalMensagens(false)}
        textoFechar={t('fechar')}
      />
      <ModalEscolha
        visivel={modalIdioma}
        titulo={t('conf_idiomaPerfil')}
        opcoes={OPCOES_IDIOMA}
        valorActual={idioma}
        onEscolher={definirIdioma}
        onFechar={() => setModalIdioma(false)}
        textoFechar={t('fechar')}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cinza1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2,
  },
  headerBtn: { padding: 4 },
  headerTitulo: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.preto },

  seccao: { marginTop: 18, paddingHorizontal: 16 },
  seccaoTitulo: {
    fontSize: 12, fontWeight: '700', color: C.cinza3,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4,
  },
  seccaoCard: { backgroundColor: C.branco, borderRadius: 14, overflow: 'hidden' },

  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  linhaIconeWrap: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.cinza1,
    alignItems: 'center', justifyContent: 'center',
  },
  linhaLabel: { fontSize: 14, fontWeight: '600', color: C.cinza4, flexShrink: 1 },
  linhaDesc: { fontSize: 11, color: C.cinza3, marginTop: 2, lineHeight: 15 },
  linhaValor: { fontSize: 13, color: C.cinza3, maxWidth: 140, marginRight: 4 },
  separador: { height: 0.5, backgroundColor: C.cinza2, marginLeft: 60 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.branco, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.cinza2, alignSelf: 'center', marginBottom: 14 },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: C.preto, marginBottom: 12 },
  modalOpcao: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: C.cinza2,
  },
  modalOpcaoLabel: { fontSize: 15, color: C.cinza4, fontWeight: '500' },
  modalOpcaoDesc: { fontSize: 12, color: C.cinza3, marginTop: 2, lineHeight: 16 },
  modalFecharBtn: { marginTop: 16, backgroundColor: C.cinza1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalFecharTxt: { fontSize: 15, fontWeight: '700', color: C.cinza4 },
});