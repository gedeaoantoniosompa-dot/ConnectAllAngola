import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import {
  ativarLembrete,
  desativarLembrete,
  ouvirLivesAgendadas,
  ouvirLivesAtivas,
} from '../../services/livesService';

const CATEGORIAS = ['Todas', 'Tecnologia', 'Negócios', 'Saúde', 'Educação', 'Arte'];
const CORES = ['#1677F2', '#EC4C89', '#6A11CB', '#FF8C00', '#0D9488'];

export default function LiveScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [tabActiva, setTabActiva] = useState('aoVivo');

  const [livesAtivas, setLivesAtivas] = useState([]);
  const [livesAgendadas, setLivesAgendadas] = useState([]);
  const [aCarregar, setACarregar] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaArea, setNovaArea] = useState('Tecnologia');
  const [aIniciar, setAIniciar] = useState(false);

  const [lembretesAtivos, setLembretesAtivos] = useState({});

  useEffect(() => {
    const unsubAtivas = ouvirLivesAtivas((lista) => {
      setLivesAtivas(lista);
      setACarregar(false);
    });
    const unsubAgendadas = ouvirLivesAgendadas(setLivesAgendadas);
    return () => {
      unsubAtivas();
      unsubAgendadas();
    };
  }, []);

  const listaBase = tabActiva === 'aoVivo' ? livesAtivas : livesAgendadas;
  const livesFiltradas = listaBase.filter(
    (l) => categoriaActiva === 'Todas' || l.area === categoriaActiva
  );

  const liveDestaque = livesAtivas[0];

  function abrirCriacao() {
    setNovoTitulo('');
    setNovaArea('Tecnologia');
    setModalAberto(true);
  }

  function irAoVivo() {
    if (!novoTitulo.trim()) return;
    const cor = CORES[Math.floor(Math.random() * CORES.length)];
    setModalAberto(false);
    router.push({
      pathname: '/broadcast',
      params: { titulo: novoTitulo.trim(), area: novaArea, cor },
    });
  }

  function assistir(live) {
    router.push({
      pathname: '/watch/[id]',
      params: {
        id: live.id,
        channelName: live.channelName,
        titulo: live.titulo,
        hostNome: live.hostNome,
        // hostUidNumerico é definido pelo host assim que entra no canal
        // Agora (ver definirHostUidNumerico em liveInteracoesService.js).
        // Pode ainda não existir nos primeiros instantes da live.
        hostUidNumerico: live.hostUidNumerico != null ? String(live.hostUidNumerico) : undefined,
        cor: live.cor,
      },
    });
  }

  async function alternarLembrete(live) {
    const ativo = lembretesAtivos[live.id];
    setLembretesAtivos((prev) => ({ ...prev, [live.id]: !ativo }));
    try {
      if (ativo) {
        await desativarLembrete(live.id, user?.uid);
      } else {
        await ativarLembrete(live.id, user?.uid);
      }
    } catch {
      // reverte em caso de falha
      setLembretesAtivos((prev) => ({ ...prev, [live.id]: ativo }));
    }
  }

  function formatarData(scheduledFor) {
    if (!scheduledFor) return '';
    const data = scheduledFor.toDate ? scheduledFor.toDate() : new Date(scheduledFor);
    return data.toLocaleString('pt-AO', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live</Text>
        <TouchableOpacity style={styles.criarBtn} onPress={abrirCriacao}>
          <Ionicons name="radio" size={16} color="#fff" />
          <Text style={styles.criarBtnText}>Ir ao vivo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tabActiva === 'aoVivo' && styles.tabActiva]}
            onPress={() => setTabActiva('aoVivo')}
          >
            <View style={styles.tabInner}>
              {tabActiva === 'aoVivo' && <View style={styles.liveDot} />}
              <Text style={[styles.tabText, tabActiva === 'aoVivo' && styles.tabTextActiva]}>
                Ao vivo
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tabActiva === 'agendadas' && styles.tabActiva]}
            onPress={() => setTabActiva('agendadas')}
          >
            <Text style={[styles.tabText, tabActiva === 'agendadas' && styles.tabTextActiva]}>
              Agendadas
            </Text>
          </TouchableOpacity>
        </View>

        {aCarregar ? (
          <View style={styles.empty}>
            <ActivityIndicator color="#1677F2" />
          </View>
        ) : (
          <>
            {/* Live destaque */}
            {tabActiva === 'aoVivo' && liveDestaque && (
              <TouchableOpacity
                style={[styles.destaqueCard, { backgroundColor: liveDestaque.cor }]}
                activeOpacity={0.85}
                onPress={() => assistir(liveDestaque)}
              >
                <View style={styles.destaqueTop}>
                  <View style={styles.liveAoVivoBadge}>
                    <View style={styles.liveDotWhite} />
                    <Text style={styles.liveAoVivoText}>AO VIVO</Text>
                  </View>
                  <View style={styles.ouvintesWrap}>
                    <Ionicons name="people" size={14} color="#fff" />
                    <Text style={styles.ouvintesText}>
                      {(liveDestaque.ouvintesCount || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.destaqueTitulo}>{liveDestaque.titulo}</Text>

                <View style={styles.destaqueHost}>
                  <View style={styles.destaqueAvatar}>
                    <Text style={styles.destaqueAvatarText}>{liveDestaque.hostNome?.[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.destaqueHostNome}>{liveDestaque.hostNome}</Text>
                    {!!liveDestaque.hostCargo && (
                      <Text style={styles.destaqueHostCargo}>{liveDestaque.hostCargo}</Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.assistirBtn}
                  onPress={() => assistir(liveDestaque)}
                >
                  <Ionicons name="play-circle" size={18} color={liveDestaque.cor} />
                  <Text style={[styles.assistirBtnText, { color: liveDestaque.cor }]}>
                    Assistir agora
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}

            {/* Categorias */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}
            >
              {CATEGORIAS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, categoriaActiva === cat && styles.catChipActiva]}
                  onPress={() => setCategoriaActiva(cat)}
                >
                  <Text style={[styles.catChipText, categoriaActiva === cat && styles.catChipTextActiva]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Lista de lives */}
            <View style={styles.listaWrap}>
              {livesFiltradas.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="radio-outline" size={48} color="#ABABAB" />
                  <Text style={styles.emptyText}>Nenhuma live encontrada</Text>
                </View>
              ) : (
                livesFiltradas.map((live) => (
                  <TouchableOpacity
                    key={live.id}
                    style={styles.liveCard}
                    activeOpacity={0.85}
                    onPress={() => tabActiva === 'aoVivo' && assistir(live)}
                  >
                    <View style={styles.liveCardTop}>
                      <View style={[styles.liveAvatar, { backgroundColor: live.cor }]}>
                        <Text style={styles.liveAvatarText}>{live.hostNome?.[0]}</Text>
                        {tabActiva === 'aoVivo' && (
                          <View style={styles.liveAvatarBadge}>
                            <Text style={styles.liveAvatarBadgeText}>LIVE</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.liveInfo}>
                        <Text style={styles.liveTitulo} numberOfLines={2}>{live.titulo}</Text>
                        <Text style={styles.liveHostNome}>{live.hostNome}</Text>
                        {!!live.hostCargo && (
                          <Text style={styles.liveHostCargo}>{live.hostCargo}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.liveCardBottom}>
                      <View style={[styles.areaBadge, { backgroundColor: live.cor + '18' }]}>
                        <Text style={[styles.areaBadgeText, { color: live.cor }]}>{live.area}</Text>
                      </View>
                      {tabActiva === 'aoVivo' ? (
                        <View style={styles.ouvintesRow}>
                          <Ionicons name="people-outline" size={13} color="#6B6B6B" />
                          <Text style={styles.ouvintesRowText}>
                            {(live.ouvintesCount || 0).toLocaleString()} a assistir
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.ouvintesRow}>
                          <Ionicons name="time-outline" size={13} color="#6B6B6B" />
                          <Text style={styles.ouvintesRowText}>{formatarData(live.scheduledFor)}</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.liveBtn,
                        { backgroundColor: tabActiva === 'aoVivo' ? live.cor : '#F5F7FA' },
                      ]}
                      onPress={() =>
                        tabActiva === 'aoVivo' ? assistir(live) : alternarLembrete(live)
                      }
                    >
                      {tabActiva === 'aoVivo' ? (
                        <>
                          <Ionicons name="play-circle" size={16} color="#fff" />
                          <Text style={styles.liveBtnTextWhite}>Assistir</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons
                            name={lembretesAtivos[live.id] ? 'notifications' : 'notifications-outline'}
                            size={16}
                            color="#1677F2"
                          />
                          <Text style={styles.liveBtnTextBlue}>
                            {lembretesAtivos[live.id] ? 'Lembrete activo' : 'Lembrar-me'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fabBtn} onPress={abrirCriacao}>
        <Ionicons name="radio" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal de criação de live */}
      <Modal visible={modalAberto} animationType="slide" transparent>
        {/*
          FIX definitivo: KeyboardAvoidingView em vez do cálculo manual
          com Keyboard.addListener + Animated.Value.
          O cálculo manual dava a altura "crua" do teclado, mas em
          Android essa altura muitas vezes não conta a barra de
          navegação/gestos, por isso o marginBottom ficava a curto e o
          botão continuava tapado. O KeyboardAvoidingView trata disso
          nativamente e sobe o conteúdo o suficiente.
        */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -50}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Ir ao vivo</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Sobre o que vais falar?"
                value={novoTitulo}
                onChangeText={setNovoTitulo}
                maxLength={80}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {CATEGORIAS.filter((c) => c !== 'Todas').map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, novaArea === cat && styles.catChipActiva]}
                    onPress={() => setNovaArea(cat)}
                  >
                    <Text style={[styles.catChipText, novaArea === cat && styles.catChipTextActiva]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalBtnsRow}>
                <TouchableOpacity style={styles.modalCancelarBtn} onPress={() => setModalAberto(false)}>
                  <Text style={styles.modalCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalIniciarBtn, !novoTitulo.trim() && { opacity: 0.5 }]}
                  disabled={!novoTitulo.trim() || aIniciar}
                  onPress={irAoVivo}
                >
                  <Text style={styles.modalIniciarText}>Iniciar transmissão</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  title: { fontSize: 22, fontWeight: '800', color: '#1F1F1F' },
  criarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EC4C89', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  criarBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActiva: { borderBottomColor: '#1677F2' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B6B6B' },
  tabTextActiva: { color: '#1677F2' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EC4C89' },
  destaqueCard: {
    margin: 16, borderRadius: 20, padding: 20, gap: 14,
  },
  destaqueTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveAoVivoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDotWhite: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveAoVivoText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  ouvintesWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ouvintesText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  destaqueTitulo: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 28 },
  destaqueHost: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  destaqueAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  destaqueAvatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  destaqueHostNome: { fontSize: 14, fontWeight: '700', color: '#fff' },
  destaqueHostCargo: { fontSize: 12, color: '#fff', opacity: 0.8 },
  assistirBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12,
  },
  assistirBtnText: { fontSize: 14, fontWeight: '800' },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#EAEAEA',
  },
  catChipActiva: { backgroundColor: '#1677F2' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
  catChipTextActiva: { color: '#fff' },
  listaWrap: { paddingHorizontal: 16, gap: 12, paddingBottom: 100 },
  liveCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12,
  },
  liveCardTop: { flexDirection: 'row', gap: 12 },
  liveAvatar: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  liveAvatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  liveAvatarBadge: {
    position: 'absolute', bottom: -4, left: '50%',
    backgroundColor: '#EC4C89', borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1.5, borderColor: '#fff',
  },
  liveAvatarBadgeText: { fontSize: 8, color: '#fff', fontWeight: '800' },
  liveInfo: { flex: 1, gap: 3 },
  liveTitulo: { fontSize: 14, fontWeight: '700', color: '#1F1F1F', lineHeight: 20 },
  liveHostNome: { fontSize: 13, fontWeight: '600', color: '#1F1F1F' },
  liveHostCargo: { fontSize: 12, color: '#6B6B6B' },
  liveCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  areaBadgeText: { fontSize: 11, fontWeight: '700' },
  ouvintesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ouvintesRowText: { fontSize: 12, color: '#6B6B6B' },
  liveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 20, paddingVertical: 10,
  },
  liveBtnTextWhite: { color: '#fff', fontSize: 14, fontWeight: '700' },
  liveBtnTextBlue: { color: '#1677F2', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#ABABAB' },
  fabBtn: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#EC4C89', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#EC4C89', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 20, gap: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1F1F1F' },
  modalInput: {
    backgroundColor: '#F5F7FA', borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: '#1F1F1F',
  },
  modalBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelarBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 20, backgroundColor: '#F5F7FA',
  },
  modalCancelarText: { color: '#6B6B6B', fontWeight: '700' },
  modalIniciarBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 20, backgroundColor: '#EC4C89',
  },
  modalIniciarText: { color: '#fff', fontWeight: '800' },
});