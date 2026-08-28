import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, rtdb } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { usePresenca } from '../../hooks/usePresenca';
import { usePrivacidade } from '../../hooks/usePrivacidade';

const CORES = ['#1677F2', '#6A11CB', '#EC4C89', '#19D400', '#FF8C00', '#00B4D8', '#EF233C', '#8338EC'];

function formatarNomeExibicao(nome) {
  if (!nome || nome === 'Utilizador') return nome;
  const partes = nome.trim().split(/\s+/);
  if (partes.length > 1) return `${partes[0]} ${partes[partes.length - 1]}`;
  return partes[0];
}

function tempoRelativo(timestamp) {
  if (!timestamp) return '';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((agora - data) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Componente de item de conversa com presença em tempo real
function ConversaItem({ item, index, onPress, privacidadeOutro }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!item.outroUid) return;
    const presencaRef = ref(rtdb, `presenca/${item.outroUid}`);
    const unsub = onValue(presencaRef, (snap) => {
      const dados = snap.val();
      // Só mostra online se o outro tiver onlineActivo = true nas suas preferências
      const outroMostraOnline = privacidadeOutro?.onlineActivo !== false;
      setOnline(dados?.online === true && outroMostraOnline);
    });
    return () => unsub();
  }, [item.outroUid, privacidadeOutro]);

  return (
    <TouchableOpacity style={styles.conversaItem} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.avatarWrap}>
        {item.outraFoto ? (
          <Image source={{ uri: item.outraFoto }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: CORES[index % CORES.length] }]}>
            <Text style={styles.avatarText}>{(item.outroNome || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        {online && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.conversaInfo}>
        <View style={styles.conversaTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Text style={styles.conversaNome} numberOfLines={1}>
              {formatarNomeExibicao(item.outroNome)}
            </Text>
            {online && <Text style={styles.onlineText}>● online</Text>}
          </View>
          <Text style={styles.conversaTempo}>{tempoRelativo(item.timestamp)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.conversaMensagem, item.naoLidas > 0 && styles.conversaMensagemNaoLida]} numberOfLines={1}>
            {item.ultimaMensagem}
          </Text>
          {item.naoLidas > 0 && (
            <View style={styles.conversaBadge}>
              <Text style={styles.conversaBadgeText}>{item.naoLidas > 9 ? '9+' : item.naoLidas}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [conversas, setConversas] = useState([]);
  const [pesquisa, setPesquisa] = useState('');
  const [tabActiva, setTabActiva] = useState('todas');
  const [modalFerramentas, setModalFerramentas] = useState(false);
  const [modalPrivacidade, setModalPrivacidade] = useState(false);
  const [privacidadesOutros, setPrivacidadesOutros] = useState({});

  // ─── Privacidade do utilizador atual ───────────────────────────────────────
  const { privacidade, atualizarPrivacidade } = usePrivacidade(user?.uid);

  // ─── Presença — passa onlineActivo para ativar/desativar em tempo real ─────
  usePresenca(user?.uid, privacidade.onlineActivo);

  // Função que chamas ao tocar numa conversa para pré-carregar a cache
  const abrirConversa = async (outroUid, outroNome, outraFoto) => {
    if (!user) return;
    const chatId = [user.uid, outroUid].sort().join('_');
    const chaveCache = `msgs_${chatId}`;

    try {
      const cached = await AsyncStorage.getItem(chaveCache);
      if (cached) {
        // Guarda num local temporário para o ConversaScreen consumir no arranque
        await AsyncStorage.setItem('msgs_preload', cached);
        await AsyncStorage.setItem('msgs_preload_chatId', chatId);
      }
    } catch (_) {}

    router.push({
      pathname: '/(main)/conversa',
      params: { outroUid, outroNome, outraFoto: outraFoto || '' }
    });
  };

  // ─── Carrega conversas ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', user.uid),
      orderBy('ultimoTimestamp', 'desc')
    );
    const unsub = onSnapshot(q, async (snap) => {
      // ← Ignora conversas que este utilizador apagou ("Apagar conversa" em
      //    conversa.jsx). Elas voltam a aparecer sozinhas assim que chegar
      //    uma mensagem nova (o envio remove o uid de ocultoPara).
      const docsVisiveis = snap.docs.filter(d => {
        const oculto = d.data().ocultoPara || [];
        return !oculto.includes(user.uid);
      });

      const dadosPromises = docsVisiveis.map(async (d) => {
        const data = d.data();
        const outroUid = data.users?.find(uid => uid !== user.uid);
        let outroNome = data.nomes?.[outroUid] || null;
        let outraFoto = data.fotos?.[outroUid] || null;

        // Busca perfil + privacidade do outro utilizador
        let privacidadeOutro = null;
        try {
          const perfilSnap = await getDoc(doc(db, 'users', outroUid));
          if (perfilSnap.exists) {
            const perfilData = perfilSnap.data();
            outroNome = outroNome || perfilData.nome || 'Utilizador';
            outraFoto = outraFoto || perfilData.fotoURL || null;
            privacidadeOutro = perfilData.privacidade || null;
          }
        } catch (_) {}

        // Guarda privacidade do outro para usar no ConversaItem
        if (outroUid && privacidadeOutro) {
          setPrivacidadesOutros(prev => ({ ...prev, [outroUid]: privacidadeOutro }));
        }

        return {
          id: d.id,
          outroUid,
          outroNome: outroNome || 'Utilizador',
          outraFoto: outraFoto || null,
          ultimaMensagem: data.ultimaMensagem || '',
          timestamp: data.ultimoTimestamp,
          naoLidas: data.naoLidas?.[user.uid] || 0,
        };
      });

      const dados = await Promise.all(dadosPromises);
      setConversas(dados);
    }, err => console.log('Erro chats:', err));
    return unsub;
  }, [user]);

  const conversasFiltradas = conversas.filter(c =>
    c.outroNome.toLowerCase().includes(pesquisa.toLowerCase())
  );

  // ─── Opções de "Quem pode enviar" ─────────────────────────────────────────
  const opcoesEnvio = [
    { key: 'todos', label: 'Todos', sub: 'Qualquer utilizador pode enviar mensagem', icon: 'people-outline', cor: '#1677F2', bg: '#EEF4FF' },
    { key: 'ligacoes', label: 'Apenas ligações', sub: 'Só quem segues pode enviar mensagem', icon: 'person-outline', cor: '#6A11CB', bg: '#F3EEFF' },
    { key: 'ninguem', label: 'Ninguém', sub: 'Nenhum utilizador pode enviar mensagem', icon: 'ban-outline', cor: '#EC4C89', bg: '#FEE7F0' },
  ];

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Mensagens</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="create-outline" size={22} color="#1F1F1F" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setModalFerramentas(true)}>
            <Ionicons name="settings-outline" size={22} color="#1F1F1F" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Indicador visual quando online está desativado */}
      {!privacidade.onlineActivo && (
        <View style={styles.offlineBanner}>
          <Ionicons name="eye-off-outline" size={14} color="#6B6B6B" />
          <Text style={styles.offlineBannerText}>O teu estado online está oculto</Text>
        </View>
      )}

      {/* ── Pesquisa ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#ABABAB" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar conversas..."
          placeholderTextColor="#ABABAB"
          value={pesquisa}
          onChangeText={setPesquisa}
        />
        {pesquisa.length > 0 && (
          <TouchableOpacity onPress={() => setPesquisa('')}>
            <Ionicons name="close-circle" size={18} color="#ABABAB" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        {[
          { key: 'todas', label: 'Todas' },
          { key: 'naoLidas', label: 'Não lidas' },
          { key: 'grupos', label: 'Grupos' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, tabActiva === tab.key && styles.tabActiva]}
            onPress={() => setTabActiva(tab.key)}
          >
            <Text style={[styles.tabText, tabActiva === tab.key && styles.tabTextActiva]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Lista de conversas ── */}
      <FlatList
        data={conversasFiltradas}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ConversaItem
            item={item}
            index={index}
            privacidadeOutro={privacidadesOutros[item.outroUid]}
            onPress={() => abrirConversa(item.outroUid, item.outroNome, item.outraFoto)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ABABAB" />
            <Text style={styles.emptyText}>Ainda não tens conversas</Text>
            <Text style={styles.emptySubText}>Conecta-te com alguém para começar!</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fabBtn}>
        <Ionicons name="create" size={24} color="#fff" />
      </TouchableOpacity>

      {/* ════════════════════════════════════════════
          Modal Principal — Ferramentas de Chat
      ════════════════════════════════════════════ */}
      <Modal
        visible={modalFerramentas}
        transparent
        animationType="slide"
        onRequestClose={() => setModalFerramentas(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalFerramentas(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitulo}>Ferramentas de Chat</Text>

          {/* ── Toggle: Estado online ── */}
          <View style={styles.ferramentaItem}>
            <View style={styles.ferramentaLeft}>
              <View style={[styles.ferramentaIcone, { backgroundColor: privacidade.onlineActivo ? '#E8F5E9' : '#F1F5F9' }]}>
                <Ionicons
                  name={privacidade.onlineActivo ? 'radio-button-on-outline' : 'radio-button-off-outline'}
                  size={20}
                  color={privacidade.onlineActivo ? '#19D400' : '#ABABAB'}
                />
              </View>
              <View>
                <Text style={styles.ferramentaLabel}>Estado online</Text>
                <Text style={styles.ferramentaSub}>
                  {privacidade.onlineActivo ? 'Visível para outros utilizadores' : 'Oculto para todos'}
                </Text>
              </View>
            </View>
            <Switch
              value={privacidade.onlineActivo}
              onValueChange={(val) => atualizarPrivacidade({ onlineActivo: val })}
              trackColor={{ false: '#E2E8F0', true: '#1677F2' }}
              thumbColor="#fff"
            />
          </View>

          {/* ── Toggle: Notificações ── */}
          <View style={styles.ferramentaItem}>
            <View style={styles.ferramentaLeft}>
              <View style={[styles.ferramentaIcone, { backgroundColor: privacidade.notificacoesActivas ? '#FFF3E0' : '#F1F5F9' }]}>
                <Ionicons
                  name={privacidade.notificacoesActivas ? 'notifications-outline' : 'notifications-off-outline'}
                  size={20}
                  color={privacidade.notificacoesActivas ? '#FF8C00' : '#ABABAB'}
                />
              </View>
              <View>
                <Text style={styles.ferramentaLabel}>Notificações</Text>
                <Text style={styles.ferramentaSub}>
                  {privacidade.notificacoesActivas ? 'Receber alertas de novas mensagens' : 'Notificações desativadas'}
                </Text>
              </View>
            </View>
            <Switch
              value={privacidade.notificacoesActivas}
              onValueChange={(val) => atualizarPrivacidade({ notificacoesActivas: val })}
              trackColor={{ false: '#E2E8F0', true: '#1677F2' }}
              thumbColor="#fff"
            />
          </View>

          {/* ── Privacidade — quem pode enviar ── */}
          <TouchableOpacity
            style={styles.ferramentaItem}
            onPress={() => { setModalFerramentas(false); setTimeout(() => setModalPrivacidade(true), 300); }}
          >
            <View style={styles.ferramentaLeft}>
              <View style={[styles.ferramentaIcone, { backgroundColor: '#EEF4FF' }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#1677F2" />
              </View>
              <View>
                <Text style={styles.ferramentaLabel}>Quem pode enviar mensagens</Text>
                <Text style={styles.ferramentaSub}>
                  {privacidade.quemPodeEnviar === 'todos' && 'Todos os utilizadores'}
                  {privacidade.quemPodeEnviar === 'ligacoes' && 'Apenas as tuas ligações'}
                  {privacidade.quemPodeEnviar === 'ninguem' && 'Ninguém (desativado)'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalFecharBtn} onPress={() => setModalFerramentas(false)}>
            <Text style={styles.modalFecharText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════
          Modal Privacidade — Quem pode enviar mensagens
      ════════════════════════════════════════════ */}
      <Modal
        visible={modalPrivacidade}
        transparent
        animationType="slide"
        onRequestClose={() => setModalPrivacidade(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalPrivacidade(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <TouchableOpacity
            style={styles.voltarBtn}
            onPress={() => { setModalPrivacidade(false); setTimeout(() => setModalFerramentas(true), 300); }}
          >
            <Ionicons name="arrow-back" size={20} color="#1677F2" />
            <Text style={styles.voltarText}>Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitulo}>Quem pode enviar{'\n'}mensagens?</Text>
          <Text style={styles.modalSubtitulo}>
            Controla quem tem permissão para te enviar mensagens diretas na plataforma.
          </Text>

          {opcoesEnvio.map((opcao) => {
            const selecionado = privacidade.quemPodeEnviar === opcao.key;
            return (
              <TouchableOpacity
                key={opcao.key}
                style={[styles.opcaoItem, selecionado && styles.opcaoItemActiva]}
                onPress={() => atualizarPrivacidade({ quemPodeEnviar: opcao.key })}
              >
                <View style={[styles.opcaoIcone, { backgroundColor: selecionado ? opcao.bg : '#F8F8F8' }]}>
                  <Ionicons name={opcao.icon} size={22} color={selecionado ? opcao.cor : '#ABABAB'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opcaoLabel, selecionado && { color: opcao.cor }]}>{opcao.label}</Text>
                  <Text style={styles.opcaoSub}>{opcao.sub}</Text>
                </View>
                <View style={[styles.radio, selecionado && { borderColor: opcao.cor }]}>
                  {selecionado && <View style={[styles.radioPonto, { backgroundColor: opcao.cor }]} />}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#1677F2" />
            <Text style={styles.infoText}>
              As alterações têm efeito imediato. Utilizadores que já têm conversa contigo não são afetados.
            </Text>
          </View>

          <TouchableOpacity style={styles.modalFecharBtn} onPress={() => setModalPrivacidade(false)}>
            <Text style={styles.modalFecharText}>Guardar e fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F1F1F' },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EAEAEA', alignItems: 'center', justifyContent: 'center',
  },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0',
  },
  offlineBannerText: { fontSize: 12, color: '#6B6B6B' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 16, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#EAEAEA',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F1F1F' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EAEAEA' },
  tabActiva: { backgroundColor: '#1677F2' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
  tabTextActiva: { color: '#fff' },
  conversaItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#19D400', borderWidth: 2, borderColor: '#fff',
  },
  onlineText: { fontSize: 11, color: '#19D400', fontWeight: '600' },
  conversaInfo: { flex: 1 },
  conversaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  conversaNome: { fontSize: 15, fontWeight: '700', color: '#1F1F1F', flex: 1 },
  conversaTempo: { fontSize: 12, color: '#ABABAB' },
  conversaMensagem: { fontSize: 13, color: '#6B6B6B' },
  conversaMensagemNaoLida: { color: '#1F1F1F', fontWeight: '700' },
  conversaBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  conversaBadgeText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  separator: { height: 0.5, backgroundColor: '#EAEAEA', marginLeft: 80 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#6B6B6B' },
  emptySubText: { fontSize: 13, color: '#ABABAB' },
  fabBtn: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1677F2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  // Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#E2E8F0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  voltarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  voltarText: { fontSize: 14, color: '#1677F2', fontWeight: '600' },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: '#1F1F1F', marginBottom: 6 },
  modalSubtitulo: { fontSize: 13, color: '#6B6B6B', lineHeight: 20, marginBottom: 20 },
  ferramentaItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9',
  },
  ferramentaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  ferramentaIcone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ferramentaLabel: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  ferramentaSub: { fontSize: 12, color: '#ABABAB', marginTop: 2 },
  // Opções de privacidade
  opcaoItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#EAEAEA',
    backgroundColor: '#FAFAFA',
  },
  opcaoItemActiva: { borderColor: '#1677F2', backgroundColor: '#F0F6FF' },
  opcaoIcone: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  opcaoLabel: { fontSize: 15, fontWeight: '700', color: '#1F1F1F', marginBottom: 2 },
  opcaoSub: { fontSize: 12, color: '#ABABAB' },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#ABABAB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioPonto: { width: 11, height: 11, borderRadius: 6 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EEF4FF', borderRadius: 12,
    padding: 12, marginTop: 8, marginBottom: 4,
  },
  infoText: { flex: 1, fontSize: 12, color: '#1F1F1F', lineHeight: 18 },
  modalFecharBtn: {
    marginTop: 16, backgroundColor: '#F1F5F9', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  modalFecharText: { fontSize: 15, fontWeight: '700', color: '#1677F2' },
});