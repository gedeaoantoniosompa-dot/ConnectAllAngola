/**
 * src/app/(main)/notifications.jsx — ConnectAll Angola
 *
 * ── ALTERAÇÃO ──
 * Cada notificação passa a ter um menu de opções (toque longo, ou o
 * botão "⋮" no canto direito):
 *  - Ver perfil (se a notificação tiver um remetente identificável)
 *  - Marcar como lida / não lida
 *  - Silenciar notificações deste tipo — grava directamente em
 *    perfil.notificacoes.{campo} (via guardarPerfil), o MESMO campo que
 *    configuracoes.jsx já usa e mostra como toggles. Silenciar aqui
 *    reflecte-se lá, e vice-versa.
 *  - Eliminar notificação (deleteDoc real, remove o documento)
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { useNotifications } from '../../hooks/useNotifications';

const MAPEAMENTO_TIPOS = {
  conexao:    { icon: 'person-add',      cor: '#1677F2' },
  gosto:      { icon: 'heart',           cor: '#EC4C89' },
  comentario: { icon: 'chatbubble',      cor: '#6A11CB' },
  evento:     { icon: 'calendar',        cor: '#FF8C00' },
  live:       { icon: 'radio',           cor: '#EC4C89' },
  partilha:   { icon: 'share-social',    cor: '#19D400' },
  oportunidade:{ icon: 'briefcase',      cor: '#0D9488' },
  mensagem:   { icon: 'chatbubble-ellipses', cor: '#1677F2' },
  conquesta:  { icon: 'trophy',          cor: '#FBBC05' },
  reacao:     { icon: 'happy-outline',   cor: '#1677F2' },
  // Tipos enviados pelo admin
  info:       { icon: 'information-circle', cor: '#1677F2' },
  sucesso:    { icon: 'checkmark-circle',   cor: '#10B981' },
  alerta:     { icon: 'warning',            cor: '#F59E0B' },
  promocao:   { icon: 'gift',               cor: '#7C3AED' },
};

// Liga cada tipo de notificação ao campo correspondente em
// perfil.notificacoes (ver configuracoes.jsx). Tipos sem entrada aqui
// (ex: notificações administrativas "alerta"/"info") não mostram a
// opção de silenciar — não faz sentido silenciar avisos da equipa.
const CAMPO_SILENCIAR = {
  conexao: 'novasConexoes',
  mensagem: 'mensagens',
  gosto: 'reacoesComentarios',
  reacao: 'reacoesComentarios',
  comentario: 'reacoesComentarios',
  oportunidade: 'vagas',
};

function tempoRelativo(timestamp) {
  if (!timestamp) return '';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((agora - data) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, perfil, guardarPerfil } = useUser();
  const { notifications, unreadCount, loading } = useNotifications();
  const [tabActiva, setTabActiva] = useState('todas');
  const [menuItem, setMenuItem] = useState(null);
  const [aSilenciar, setASilenciar] = useState(false);

  const marcarComoLida = async (item) => {
    if (item.lida) return;
    try {
      if (item._ref) {
        // Usa a ref guardada directamente (funciona para ambas as fontes)
        await updateDoc(item._ref, { lida: true });
      }
    } catch (err) {
      console.log('Erro ao marcar como lida:', err);
    }
  };

  const handleAcaoNotificacao = async (item) => {
    await marcarComoLida(item);

    const idDoPost = item.postId || item.post || item.idPost;

    if (item.tipo === 'mensagem' && item.remetenteId) {
      router.push({
        pathname: '/(main)/conversa',
        params: { outroUid: item.remetenteId },
      });
    } else if (item.tipo === 'oportunidade' && idDoPost) {
      // Vaga publicada — abre o ecrã de detalhe da vaga (mesmo destino usado no feed)
      router.push({
        pathname: '/(main)/events',
        params: { postId: idDoPost },
      });
    } else if (item.tipo === 'conexao' && item.remetenteId) {
      // Pedido/aceitação de conexão — abre o perfil de quem enviou.
      router.push({
        pathname: '/(main)/perfil-publico',
        params: { uid: item.remetenteId },
      });
    } else if (idDoPost) {
      router.push({
        pathname: '/post-comentarios',
        params: { postId: idDoPost, autorId: item.remetenteId || user?.uid }
      });
    } else if (item.tipo === 'alerta' || item.tipo === 'info' || item.tipo === 'sucesso' || item.tipo === 'promocao') {
      // Notificação administrativa — mostra o conteúdo em alerta
      Alert.alert(
        item.titulo || 'Notificação',
        item.mensagem || item.message || '',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Conteúdo indisponível',
        'Não foi possível abrir esta publicação. Ela pode ter sido eliminada.'
      );
    }
  };

  const handleMarcarTodasComoLidas = async () => {
    if (!user) return;
    try {
      const naoLidas = notifications.filter(n => !n.lida && n._ref);
      if (!naoLidas.length) return;
      const batch = writeBatch(db);
      naoLidas.forEach(n => batch.update(n._ref, { lida: true }));
      await batch.commit();
    } catch (err) {
      console.log('Erro ao marcar todas:', err);
    }
  };

  // ── Menu de opções por notificação ──────────────────────────────────

  const alternarLida = async () => {
    const item = menuItem;
    setMenuItem(null);
    if (!item?._ref) return;
    try {
      await updateDoc(item._ref, { lida: !item.lida });
    } catch (err) {
      console.log('Erro ao alternar lida:', err);
    }
  };

  const eliminarNotificacao = () => {
    const item = menuItem;
    setMenuItem(null);
    if (!item?._ref) return;
    Alert.alert('Eliminar notificação', 'Tens a certeza que queres eliminar esta notificação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(item._ref);
          } catch (err) {
            Alert.alert('Erro', 'Não foi possível eliminar a notificação.');
          }
        },
      },
    ]);
  };

  // Silencia este TIPO de notificação — grava em perfil.notificacoes,
  // o mesmo campo lido/escrito por configuracoes.jsx. Reactivável lá.
  const silenciarTipo = async () => {
    const item = menuItem;
    const campo = CAMPO_SILENCIAR[item?.tipo];
    setMenuItem(null);
    if (!campo) return;
    setASilenciar(true);
    try {
      await guardarPerfil({
        notificacoes: { ...(perfil?.notificacoes || {}), [campo]: false },
      });
      Alert.alert(
        'Notificações silenciadas',
        'Deixarás de receber este tipo de notificação. Podes reactivar em Configurações → Notificações.'
      );
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível silenciar agora. Tenta novamente.');
    } finally {
      setASilenciar(false);
    }
  };

  const verPerfilDoRemetente = () => {
    const item = menuItem;
    setMenuItem(null);
    if (!item?.remetenteId) return;
    router.push({ pathname: '/(main)/perfil-publico', params: { uid: item.remetenteId } });
  };

  const notificacoesFiltradas = tabActiva === 'todas'
    ? notifications
    : notifications.filter(n => !n.lida);

  const renderNotificacao = ({ item }) => {
    const estiloTipo = MAPEAMENTO_TIPOS[item.tipo] || { icon: 'notifications', cor: '#6B6B6B' };
    const urlFoto = item.remetenteFoto || item.userFoto || item.fotoUrl || item.avatar;
    const textoNotif = item.titulo || item.title || 'Notificação';
    const subTexto = item.mensagem || item.message || '';

    return (
      <TouchableOpacity
        style={[styles.card, !item.lida && styles.cardNaoLida]}
        activeOpacity={0.85}
        onPress={() => handleAcaoNotificacao(item)}
        onLongPress={() => setMenuItem(item)}
      >
        <View style={styles.avatarContainer}>
          {urlFoto ? (
            <>
              <Image source={{ uri: urlFoto }} style={styles.avatarImage} />
              <View style={[styles.miniBadge, { backgroundColor: estiloTipo.cor }]}>
                <Ionicons name={estiloTipo.icon} size={10} color="#fff" />
              </View>
            </>
          ) : (
            <View style={[styles.iconWrap, { backgroundColor: estiloTipo.cor + '20' }]}>
              <Ionicons name={estiloTipo.icon} size={22} color={estiloTipo.cor} />
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitulo, !item.lida && styles.cardTituloNaoLido]}>
            {textoNotif}
          </Text>
          {!!subTexto && (
            <Text style={styles.cardSub} numberOfLines={2}>{subTexto}</Text>
          )}
          <Text style={styles.cardTempo}>
            {tempoRelativo(item.createdAt || item.enviadoEm)}
          </Text>
        </View>

        <View style={styles.cardDireita}>
          {!item.lida && <View style={styles.dotNaoLida} />}
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={(e) => { e.stopPropagation?.(); setMenuItem(item); }}
          >
            <Ionicons name="ellipsis-vertical" size={16} color="#ABABAB" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const podeSilenciar = !!menuItem && !!CAMPO_SILENCIAR[menuItem.tipo];

  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F1F1F" />
        </TouchableOpacity>
        <Text style={styles.title}>Notificações</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarcarTodasComoLidas}>
            <Text style={styles.marcarBtn}>Marcar todas</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'todas' && styles.tabActiva]}
          onPress={() => setTabActiva('todas')}
        >
          <Text style={[styles.tabText, tabActiva === 'todas' && styles.tabTextActiva]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tabActiva === 'naoLidas' && styles.tabActiva]}
          onPress={() => setTabActiva('naoLidas')}
        >
          <Text style={[styles.tabText, tabActiva === 'naoLidas' && styles.tabTextActiva]}>
            Não lidas {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#1677F2" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notificacoesFiltradas}
          keyExtractor={item => item.id}
          renderItem={renderNotificacao}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color="#ABABAB" />
              <Text style={styles.emptyText}>Nenhuma notificação por aqui</Text>
            </View>
          )}
        />
      )}

      {/* Menu de opções por notificação */}
      <Modal visible={!!menuItem} transparent animationType="fade" onRequestClose={() => setMenuItem(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuItem(null)}>
          <View style={styles.menuSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHandle} />

            {!!menuItem?.remetenteId && (
              <TouchableOpacity style={styles.menuOpcao} onPress={verPerfilDoRemetente}>
                <Ionicons name="person-outline" size={20} color="#1F1F1F" />
                <Text style={styles.menuOpcaoTxt}>Ver perfil</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuOpcao} onPress={alternarLida}>
              <Ionicons name={menuItem?.lida ? 'mail-unread-outline' : 'mail-open-outline'} size={20} color="#1F1F1F" />
              <Text style={styles.menuOpcaoTxt}>
                {menuItem?.lida ? 'Marcar como não lida' : 'Marcar como lida'}
              </Text>
            </TouchableOpacity>

            {podeSilenciar && (
              <TouchableOpacity style={styles.menuOpcao} onPress={silenciarTipo} disabled={aSilenciar}>
                <Ionicons name="notifications-off-outline" size={20} color="#1F1F1F" />
                <Text style={styles.menuOpcaoTxt}>Silenciar notificações deste tipo</Text>
                {aSilenciar && <ActivityIndicator size="small" color="#1677F2" style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuOpcao} onPress={eliminarNotificacao}>
              <Ionicons name="trash-outline" size={20} color="#E00000" />
              <Text style={[styles.menuOpcaoTxt, { color: '#E00000' }]}>Eliminar notificação</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancelar} onPress={() => setMenuItem(null)}>
              <Text style={styles.menuCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1F1F1F' },
  marcarBtn: { fontSize: 13, fontWeight: '600', color: '#1677F2' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActiva: { borderBottomColor: '#1677F2' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B6B6B' },
  tabTextActiva: { color: '#1677F2' },
  card: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', gap: 12 },
  cardNaoLida: { backgroundColor: '#EEF4FF' },
  avatarContainer: { width: 46, height: 46, position: 'relative', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImage: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EAEAEA' },
  miniBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardTitulo: { fontSize: 14, color: '#6B6B6B', lineHeight: 20 },
  cardTituloNaoLido: { color: '#1F1F1F', fontWeight: '600' },
  cardSub: { fontSize: 12.5, color: '#4A5568', lineHeight: 18 },
  cardTempo: { fontSize: 12, color: '#ABABAB' },
  cardDireita: { alignItems: 'center', gap: 8, flexShrink: 0 },
  dotNaoLida: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1677F2' },
  menuBtn: { padding: 4 },
  separator: { height: 0.5, backgroundColor: '#EAEAEA' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: '#ABABAB' },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30,
  },
  menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 8 },
  menuOpcao: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  menuOpcaoTxt: { fontSize: 15, color: '#1F1F1F', fontWeight: '500' },
  menuCancelar: { marginTop: 10, backgroundColor: '#F3F2EE', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  menuCancelarTxt: { fontSize: 15, fontWeight: '700', color: '#1B1B1B' },
});