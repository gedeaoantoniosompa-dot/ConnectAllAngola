/**
 * src/app/(main)/menu.jsx — ConnectAll Angola
 *
 * Menu com suporte a:
 * - Utilizador / Recrutador / Página da Empresa
 * - troca de contexto sem logout
 * - quando o contexto activo é "empresa", o cartão do perfil abre
 *   directamente o Feed da Empresa (/pagina-empresa)
 * - ao seleccionar Página da Empresa em "Trocar de conta", troca o
 *   contexto e abre directamente o Feed da Empresa
 *
 * ── ALTERAÇÕES ──
 * 1) A Página da Empresa deixou de depender de existir uma conta de
 *    Recrutador. Aparece sempre em "Trocar de conta" — criar (se ainda
 *    não existir) ou trocar para ela (se já existir) — para QUALQUER
 *    tipo de conta.
 * 2) Deixou de haver qualquer Alert a dizer "ainda não existe página".
 *    Tanto o cartão do perfil (quando o contexto é "empresa") como o
 *    item "Página da Empresa" no modal abrem sempre directamente
 *    /(main)/pagina-empresa — é esse ecrã que decide, sozinho, se
 *    mostra o feed (já existe) ou o formulário de criação (ainda não
 *    existe).
 * 3) CORREÇÃO: a opção de voltar ao perfil PESSOAL (Utilizador ou
 *    Recrutador, o que a conta já for) deixou de depender de existir
 *    uma conta de Recrutador — antes disso, uma conta simples de
 *    Utilizador que trocasse para a Página da Empresa ficava sem
 *    forma de voltar ao seu próprio perfil. Agora essa opção aparece
 *    SEMPRE em "Trocar de conta", seja qual for o tipo de conta.
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

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
  roxo:      '#7C3AED',
  rosa:      '#EC4C89',
};

const ACCOES = [
  { id: 'planos',       chaveLabel: 'menu_planosPremium',   icone: 'diamond-outline',              rota: '/(main)/planos' },
  { id: 'mensagens',    chaveLabel: 'menu_mensagens',       icone: 'chatbubble-ellipses-outline', rota: '/(main)/chat' },
  { id: 'conexoes',     chaveLabel: 'menu_conexoes',        icone: 'people-outline',               rota: '/(main)/conexoes' },
  { id: 'live',         chaveLabel: 'menu_live',            icone: 'radio-outline',                rota: '/(main)/live' },
  { id: 'saber',        chaveLabel: 'menu_feiraDoSaber',    icone: 'mic-outline',                  rota: '/(main)/saber' },
  { id: 'notificacoes', chaveLabel: 'menu_notificacoes',    icone: 'notifications-outline',        rota: '/(main)/notifications' },
  { id: 'vagas',        chaveLabel: 'menu_vagas',           icone: 'briefcase-outline',             rota: '/(main)/events' },
  { id: 'entrevista',   chaveLabel: 'menu_salaEntrevista',  icone: 'videocam-outline',              rota: null },
  { id: 'suporte',      chaveLabel: 'menu_suporte',         icone: 'headset-outline',               rota: '/(auth)/contactar-suporte' },
  { id: 'criador',      chaveLabel: 'menu_perfilProfissional', icone: 'star-outline',               rota: '/(main)/perfil-profissional' },
];

function Avatar({ uri, nome, size = 52 }) {
  const st = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={st} />;
  }

  return (
    <View
      style={[
        st,
        {
          backgroundColor: C.azul,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text
        style={{
          color: C.branco,
          fontSize: size * 0.4,
          fontWeight: '800',
        }}
      >
        {nome?.charAt(0)?.toUpperCase() || 'U'}
      </Text>
    </View>
  );
}

export default function MenuScreen() {
  const router = useRouter();

  const {
    user,
    perfil,
    perfilEmpresa,
    contextoAtivo,
    perfilExibido,
    trocarContexto,
    t,
  } = useUser();

  const [modalTrocarConta, setModalTrocarConta] = useState(false);

  const abrirTrocarConta = () => setModalTrocarConta(true);

  // Voltar ao perfil pessoal (Utilizador ou Recrutador — o que a conta
  // já for). Esta opção aparece SEMPRE no modal, independentemente do
  // tipo de conta ou de existir Página da Empresa.
  const irParaContextoPessoal = () => {
    setModalTrocarConta(false);
    trocarContexto('pessoal');
  };

  // Página da Empresa — usado tanto para "criar" como para "trocar/entrar".
  // Se já existir, troca primeiro o contexto activo para "empresa"; se não
  // existir, não há nada para trocar — vai-se logo ter com o formulário de
  // criação. Em qualquer dos casos, abre-se sempre /(main)/pagina-empresa,
  // sem nenhum Alert a interromper o caminho.
  const abrirPaginaEmpresa = async () => {
    setModalTrocarConta(false);
    if (perfilEmpresa) {
      await trocarContexto('empresa');
    }
    router.push('/(main)/pagina-empresa');
  };

  const terminarSessao = async () => {
    Alert.alert(
      t('menu_confirmarSairTitulo'),
      t('menu_confirmarSairTexto'),
      [
        {
          text: t('cancelar'),
          style: 'cancel',
        },
        {
          text: t('menu_sair'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/(auth)/login');
            } catch {
              Alert.alert(
                t('erro'),
                t('menu_erroSair')
              );
            }
          },
        },
      ]
    );
  };

  const tipoPerfil = perfil?.tipoPerfil || 'utilizador';
  const subtituloTipo =
    tipoPerfil === 'recrutador' ? t('menu_recrutador') : t('menu_utilizador');

  // O texto mostrado no cartão muda conforme a identidade activa.
  const subtituloExibido =
    contextoAtivo === 'empresa'
      ? t('menu_paginaEmpresa')
      : subtituloTipo;

  // O cartão principal do Menu respeita o contexto.
  // Empresa -> ecrã da Empresa (que trata sozinho de criar ou mostrar)
  // Pessoal -> Perfil pessoal
  const abrirPerfilAtivo = () => {
    if (contextoAtivo === 'empresa') {
      router.push('/(main)/pagina-empresa');
      return;
    }

    router.push('/(main)/my-profile');
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.branco}
      />

      <View style={s.header}>
        <Text style={s.headerTitulo}>{t('menu_titulo')}</Text>

        <TouchableOpacity style={s.headerBtn}>
          <Feather
            name="search"
            size={20}
            color={C.preto}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >

        {/* =========================================================
            CARTÃO DO PERFIL / PÁGINA ACTIVA
            =========================================================
            Se estiver em empresa, este cartão abre pagina-empresa.jsx
            (que mostra o feed se já existir, ou o formulário de criação
            se ainda não existir). Se estiver em pessoal, abre my-profile.
        */}
        <TouchableOpacity
          style={s.cardPerfil}
          onPress={abrirPerfilAtivo}
          activeOpacity={0.8}
        >
          <Avatar
            uri={perfilExibido.fotoURL}
            nome={perfilExibido.nome}
            size={52}
          />

          <View style={{ flex: 1 }}>
            <Text style={s.cardPerfilNome}>
              {perfilExibido.nome}
            </Text>

            <Text style={s.cardPerfilSub}>
              {subtituloExibido} ·{' '}
              {contextoAtivo === 'empresa'
                ? t('menu_abrirFeedEmpresa')
                : t('menu_verPerfil')}
            </Text>
          </View>

          <Feather
            name="chevron-right"
            size={18}
            color={C.cinza3}
          />
        </TouchableOpacity>

        {/* Trocar de conta */}
        <TouchableOpacity
          style={s.cardTrocar}
          onPress={abrirTrocarConta}
          activeOpacity={0.8}
        >
          <View style={s.trocarAvataresWrap}>
            <View
              style={[
                s.trocarAvatarMini,
                { backgroundColor: C.roxo },
              ]}
            >
              <Ionicons
                name="person"
                size={14}
                color={C.branco}
              />
            </View>

            <View
              style={[
                s.trocarAvatarMini,
                {
                  backgroundColor: C.rosa,
                  marginLeft: -10,
                },
              ]}
            >
              <Ionicons
                name="business"
                size={14}
                color={C.branco}
              />
            </View>
          </View>

          <Text style={s.cardTrocarTxt}>
            {t('menu_trocarConta')}
          </Text>

          <Feather
            name="chevron-right"
            size={18}
            color={C.cinza3}
          />
        </TouchableOpacity>

        {/* Convidar */}
        <TouchableOpacity
          style={s.cardConvite}
          onPress={() =>
            router.push('/(main)/conexoes')
          }
          activeOpacity={0.8}
        >
          <View style={s.conviteIconeWrap}>
            <Ionicons
              name="person-add"
              size={18}
              color={C.azul}
            />
          </View>

          <Text style={s.conviteTxt}>
            {t('menu_convidarAmigos')}
          </Text>

          <Feather
            name="chevron-right"
            size={18}
            color={C.cinza3}
          />
        </TouchableOpacity>

        {/* Grelha de acções */}
        <View style={s.secLabel}>
          <Text style={s.secLabelTxt}>
            {t('menu_funcionalidades')}
          </Text>
        </View>

        <View style={s.grelha}>
          {ACCOES.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[
                s.grelhaItem,
                item.id === 'criador' &&
                  s.grelhaItemDestaque,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                if (item.id === 'entrevista') {
                  const tipo =
                    perfil?.tipoPerfil || 'utilizador';

                  if (tipo === 'recrutador') {
                    router.push({
                      pathname:
                        '/(main)/sala-entrevista',
                      params: {
                        salaId:
                          `entrevista-${user?.uid}-${Date.now()}`,
                        nomeEmpresa:
                          perfil?.nome || 'Entrevista',
                        meuNome:
                          perfil?.nome || 'Recrutador',
                        minhaFoto:
                          perfil?.fotoURL || null,
                        papel: 'recrutador',
                      },
                    });
                  } else {
                    router.push(
                      '/(main)/entrar-sala'
                    );
                  }
                } else {
                  router.push(item.rota);
                }
              }}
            >
              <View
                style={[
                  s.grelhaIconeWrap,
                  item.id === 'criador' &&
                    s.grelhaIconeWrapDestaque,
                ]}
              >
                <Ionicons
                  name={item.icone}
                  size={22}
                  color={
                    item.id === 'criador'
                      ? C.roxo
                      : C.azul
                  }
                />
              </View>

              <Text
                style={[
                  s.grelhaLabel,
                  item.id === 'criador' && {
                    color: C.roxo,
                  },
                ]}
              >
                {t(item.chaveLabel)}
              </Text>

              {item.id === 'criador' && (
                <View style={s.grelhaBadge}>
                  <Text style={s.grelhaBadgeTxt}>
                    {t('menu_novo')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Definições */}
        <View style={s.secLabel}>
          <Text style={s.secLabelTxt}>
            {t('menu_definicoes')}
          </Text>
        </View>

        <View style={s.linhasWrap}>
          <TouchableOpacity
            style={s.linhaItem}
            onPress={() =>
              router.push('/(auth)/configuracoes')
            }
          >
            <View style={s.linhaIconeWrap}>
              <Feather
                name="settings"
                size={17}
                color={C.cinza4}
              />
            </View>

            <Text style={s.linhaItemTxt}>
              {t('menu_configuracoesPrivacidade')}
            </Text>

            <Feather
              name="chevron-right"
              size={16}
              color={C.cinza3}
            />
          </TouchableOpacity>

          <View style={s.linhaSep} />

          <TouchableOpacity
            style={s.linhaItem}
            onPress={() =>
              router.push('/(auth)/contactar-suporte')
            }
          >
            <View style={s.linhaIconeWrap}>
              <Feather
                name="help-circle"
                size={17}
                color={C.cinza4}
              />
            </View>

            <Text style={s.linhaItemTxt}>
              {t('menu_ajudaSuporte')}
            </Text>

            <Feather
              name="chevron-right"
              size={16}
              color={C.cinza3}
            />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={terminarSessao}
        >
          <Feather
            name="log-out"
            size={18}
            color={C.vermelho}
          />

          <Text style={s.logoutTxt}>
            {t('menu_terminarSessao')}
          </Text>
        </TouchableOpacity>

        <Text style={s.versaoTxt}>
          {t('menu_versao')}
        </Text>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* =========================================================
          MODAL — TROCAR DE CONTA
          =========================================================
          - Perfil Pessoal (Utilizador ou Recrutador): aparece SEMPRE,
            para qualquer tipo de conta — é a forma de voltar da
            Página da Empresa para o próprio perfil.
          - Página da Empresa: aparece SEMPRE — trocar/entrar (se já
            existir) ou criar (se ainda não existir).
      */}
      <Modal
        visible={modalTrocarConta}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setModalTrocarConta(false)
        }
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() =>
            setModalTrocarConta(false)
          }
        >
          <View
            style={s.modalSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={s.modalHandle} />

            <Text style={s.modalTitulo}>
              {t('menu_trocarContaTitulo')}
            </Text>

            {/* PERFIL PESSOAL — aparece sempre */}
            <TouchableOpacity
              style={s.modalContaItem}
              onPress={irParaContextoPessoal}
            >
              <Avatar
                uri={perfil?.fotoURL}
                nome={perfil?.nome || subtituloTipo}
                size={44}
              />

              <View style={{ flex: 1 }}>
                <Text style={s.modalContaNome}>
                  {perfil?.nome || t('menu_oMeuPerfil')}
                </Text>

                <Text style={s.modalContaTipo}>
                  {subtituloTipo}
                </Text>
              </View>

              {contextoAtivo === 'pessoal' && (
                <View style={s.modalContaActivaBadge}>
                  <Text style={s.modalContaActivaTxt}>
                    {t('activa')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* PÁGINA DA EMPRESA — sempre disponível, para qualquer conta.
                Existe ou não, o toque abre sempre pagina-empresa.jsx. */}
            {perfilEmpresa ? (
              <TouchableOpacity
                style={s.modalContaItem}
                onPress={abrirPaginaEmpresa}
              >
                <Avatar
                  uri={perfilEmpresa.logoURL}
                  nome={
                    perfilEmpresa.nomeEmpresa ||
                    'Empresa'
                  }
                  size={44}
                />

                <View style={{ flex: 1 }}>
                  <Text style={s.modalContaNome}>
                    {perfilEmpresa.nomeEmpresa ||
                      t('menu_paginaEmpresa')}
                  </Text>

                  <Text style={s.modalContaTipo}>
                    {t('menu_paginaEmpresaFeed')}
                  </Text>
                </View>

                {contextoAtivo === 'empresa' && (
                  <View
                    style={
                      s.modalContaActivaBadge
                    }
                  >
                    <Text
                      style={
                        s.modalContaActivaTxt
                      }
                    >
                      {t('activa')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.modalCriarItem}
                onPress={abrirPaginaEmpresa}
              >
                <View
                  style={[
                    s.modalCriarIconeWrap,
                    {
                      backgroundColor:
                        '#FEE7F0',
                    },
                  ]}
                >
                  <Ionicons
                    name="business-outline"
                    size={20}
                    color={C.rosa}
                  />
                </View>

                <Text style={s.modalCriarTxt}>
                  {t('menu_criarPaginaEmpresa')}
                </Text>

                <Feather
                  name="plus"
                  size={18}
                  color={C.cinza3}
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.modalFecharBtn}
              onPress={() =>
                setModalTrocarConta(false)
              }
            >
              <Text style={s.modalFecharTxt}>
                {t('fechar')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.cinza1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.branco,
    borderBottomWidth: 0.5,
    borderBottomColor: C.cinza2,
  },

  headerBtn: {
    padding: 4,
  },

  headerTitulo: {
    fontSize: 20,
    fontWeight: '800',
    color: C.preto,
  },

  scroll: {
    padding: 12,
    gap: 10,
  },

  cardPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.branco,
    borderRadius: 12,
    padding: 14,
  },

  cardPerfilNome: {
    fontSize: 16,
    fontWeight: '700',
    color: C.preto,
  },

  cardPerfilSub: {
    fontSize: 13,
    color: C.cinza3,
    marginTop: 2,
  },

  cardTrocar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.branco,
    borderRadius: 12,
    padding: 14,
  },

  trocarAvataresWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  trocarAvatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.branco,
  },

  cardTrocarTxt: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.preto,
  },

  cardConvite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.branco,
    borderRadius: 12,
    padding: 14,
  },

  conviteIconeWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  conviteTxt: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.preto,
  },

  secLabel: {
    paddingHorizontal: 4,
    paddingTop: 4,
  },

  secLabelTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: C.cinza3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  grelha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  grelhaItem: {
    width: '48%',
    backgroundColor: C.branco,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },

  grelhaItemDestaque: {
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },

  grelhaIconeWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  grelhaIconeWrapDestaque: {
    backgroundColor: '#F3EEFF',
  },

  grelhaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.preto,
    textAlign: 'center',
  },

  grelhaBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: C.roxo,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  grelhaBadgeTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },

  linhasWrap: {
    backgroundColor: C.branco,
    borderRadius: 12,
    overflow: 'hidden',
  },

  linhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },

  linhaIconeWrap: {
    width: 28,
    alignItems: 'center',
  },

  linhaItemTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.cinza4,
  },

  linhaSep: {
    height: 0.5,
    backgroundColor: C.cinza2,
    marginLeft: 54,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
  },

  logoutTxt: {
    color: C.vermelho,
    fontSize: 14,
    fontWeight: '700',
  },

  versaoTxt: {
    textAlign: 'center',
    fontSize: 11,
    color: C.cinza3,
    marginTop: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: C.branco,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },

  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.cinza2,
    alignSelf: 'center',
    marginBottom: 14,
  },

  modalTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: C.preto,
    marginBottom: 14,
  },

  modalContaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.cinza2,
  },

  modalContaNome: {
    fontSize: 15,
    fontWeight: '700',
    color: C.preto,
  },

  modalContaTipo: {
    fontSize: 12,
    color: C.cinza3,
    marginTop: 1,
  },

  modalContaActivaBadge: {
    backgroundColor: C.azulClaro,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  modalContaActivaTxt: {
    fontSize: 11,
    color: C.azul,
    fontWeight: '700',
  },

  modalCriarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.cinza2,
  },

  modalCriarIconeWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalCriarTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.cinza4,
  },

  modalFecharBtn: {
    marginTop: 16,
    backgroundColor: C.cinza1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },

  modalFecharTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: C.cinza4,
  },
});