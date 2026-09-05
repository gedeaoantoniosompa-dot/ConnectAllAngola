/**
 * app/(main)/live.jsx — ConnectAll Angola
 *
 * ── ALTERAÇÕES ──
 * 1) Design revisto para ficar mais profissional e consistente com o
 *    resto da app: deixou de haver uma cor saturada aleatória (do array
 *    CORES antigo) a preencher o cartão em destaque por completo — isso
 *    é que dava o aspecto amador ("cada live com uma cor diferente a
 *    gritar"). Agora o cartão em destaque usa sempre o azul da marca
 *    (igual ao resto da app), e a cor de cada live só é usada, com
 *    muita moderação, no avatar/badge da área — nunca como fundo
 *    inteiro. O vermelho fica reservado só para o indicador "AO VIVO"
 *    (convenção universal de transmissão), como deve ser.
 * 2) A secção "Agendadas" foi removida — só existe "Ao vivo" agora,
 *    por isso as tabs desapareceram e ficou um cabeçalho simples.
 * 3) A live em destaque deixou de aparecer DUPLICADA na lista abaixo.
 * 4) Adicionado botão de Partilhar (com amigos, via partilha nativa, ou
 *    no Feed da ConnectAll) em cada live, no destaque e na lista.
 *
 * ── NOTA IMPORTANTE ──
 * O problema de lives já fechadas continuarem a aparecer aqui não pode
 * ser corrigido só neste ficheiro — depende de como `ouvirLivesAtivas`
 * (em services/livesService.js) filtra o que conta como "activa" e de
 * como o ecrã do anfitrião marca uma live como terminada ao fechar.
 * Preciso desse ficheiro (e do ecrã de broadcast) para corrigir a causa
 * raiz — ver mensagem de resposta.
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { ouvirLivesAtivas } from '../../services/livesService';

const CATEGORIAS = ['Todas', 'Tecnologia', 'Negócios', 'Saúde', 'Educação', 'Arte'];

// Paleta reduzida e coerente (tons próximos, nunca a gritar) — usada só
// como pequeno acento no avatar/badge de cada live, nunca como fundo
// inteiro de um cartão.
const CORES = ['#0A66C2', '#0F766E', '#334155', '#7C3AED'];

const C = {
  azul:      '#0A66C2',
  azulEscuro:'#004182',
  azulClaro: '#EEF3FB',
  branco:    '#FFFFFF',
  preto:     '#111111',
  cinza1:    '#F5F7FA',
  cinza2:    '#E2E8F0',
  cinza3:    '#6B6B6B',
  cinza4:    '#1F1F1F',
  vermelho:  '#E00000',
};

export default function LiveScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();

  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  const [livesAtivas, setLivesAtivas] = useState([]);
  const [aCarregar, setACarregar] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaArea, setNovaArea] = useState('Tecnologia');
  const [aIniciar, setAIniciar] = useState(false);

  // ── Partilhar ──
  const [liveAPartilhar, setLiveAPartilhar] = useState(null);
  const [comentarioPartilha, setComentarioPartilha] = useState('');
  const [aPartilharNoFeed, setAPartilharNoFeed] = useState(false);

  useEffect(() => {
    const unsubAtivas = ouvirLivesAtivas((lista) => {
      setLivesAtivas(lista);
      setACarregar(false);
    });
    return () => unsubAtivas();
  }, []);

  const livesFiltradas = livesAtivas.filter(
    (l) => categoriaActiva === 'Todas' || l.area === categoriaActiva
  );

  // A live em destaque é a primeira; o resto da lista não a repete, para
  // não mostrar a mesma live duas vezes na mesma tela.
  const liveDestaque = livesFiltradas[0];
  const listaRestante = liveDestaque
    ? livesFiltradas.filter((l) => l.id !== liveDestaque.id)
    : livesFiltradas;

  function corDaLive(live) {
    // Cor estável por live (mesmo hash simples), em vez de aleatória a
    // cada render — evita "saltos" de cor e mantém o acento discreto.
    if (live?.cor && CORES.includes(live.cor)) return live.cor;
    const soma = (live?.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return CORES[soma % CORES.length];
  }

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
        hostUidNumerico: live.hostUidNumerico != null ? String(live.hostUidNumerico) : undefined,
        cor: live.cor,
      },
    });
  }

  // ── Partilhar: com amigos (partilha nativa) ou no Feed da ConnectAll ──
  function abrirPartilha(live) {
    setComentarioPartilha('');
    setLiveAPartilhar(live);
  }

  async function partilharComAmigos(live) {
    const comentario = comentarioPartilha.trim();
    setLiveAPartilhar(null);
    setComentarioPartilha('');
    try {
      await Share.share({
        message: `${comentario ? comentario + '\n\n' : ''}${live.hostNome || 'Alguém'} está ao vivo agora na ConnectAll Angola: "${live.titulo}". Vem assistir!`,
      });
    } catch (e) {
      // utilizador cancelou a partilha — nada a fazer
    }
  }

  async function partilharNoFeed(live) {
    if (!user?.uid) {
      setLiveAPartilhar(null);
      Alert.alert('Sessão necessária', 'Inicia sessão para partilhares no Feed.');
      return;
    }
    const comentario = comentarioPartilha.trim();
    setAPartilharNoFeed(true);
    try {
      await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        autorNome: perfil?.nome || 'Utilizador',
        autorFoto: perfil?.fotoURL || null,
        autorCargo: perfil?.area || perfil?.cargo || '',
        // O comentário escrito pelo utilizador acompanha sempre a live,
        // antes da frase automática — só a frase automática é omitida se
        // o utilizador já tiver escrito algo suficientemente descritivo.
        texto: comentario
          ? `${comentario}\n\n🔴 A assistir agora: "${live.titulo}", com ${live.hostNome || 'um convidado'}.`
          : `🔴 A assistir agora: "${live.titulo}", com ${live.hostNome || 'um convidado'}. Vem juntar-te!`,
        tipo: 'artigo',
        mediaUrls: [],
        // Campos extra que o Feed usa para saber que este post é uma live:
        // enquanto liveId estiver na lista de lives activas (ouvirLivesAtivas),
        // o Feed mostra um preview "AO VIVO" em vez de um post normal, e o
        // toque abre directamente /watch/[id] com estes mesmos dados. Quando
        // a live terminar, o post volta a comportar-se como uma publicação
        // normal (o texto continua lá, só deixa de ter o preview/atalho).
        liveId: live.id,
        liveChannelName: live.channelName || null,
        liveHostUidNumerico: live.hostUidNumerico ?? null,
        liveCor: live.cor || null,
        likes: 0,
        comentarios: 0,
        timestamp: serverTimestamp(),
      });
      setLiveAPartilhar(null);
      setComentarioPartilha('');
      Alert.alert('Partilhado', 'A live foi partilhada no teu Feed.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível partilhar no Feed. Tenta novamente.');
    } finally {
      setAPartilharNoFeed(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live</Text>
        <TouchableOpacity style={styles.criarBtn} onPress={abrirCriacao}>
          <Ionicons name="radio" size={15} color="#fff" />
          <Text style={styles.criarBtnText}>Ir ao vivo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Indicador simples — já não há tabs, só existe "Ao vivo" */}
        <View style={styles.statusRow}>
          <View style={styles.liveDot} />
          <Text style={styles.statusText}>
            {aCarregar ? 'A verificar transmissões...' : `${livesFiltradas.length} ao vivo agora`}
          </Text>
        </View>

        {aCarregar ? (
          <View style={styles.empty}>
            <ActivityIndicator color={C.azul} />
          </View>
        ) : (
          <>
            {/* Live destaque */}
            {liveDestaque && (
              <View style={styles.destaqueCard}>
                <View style={styles.destaqueTop}>
                  <View style={styles.liveAoVivoBadge}>
                    <View style={styles.liveDotWhite} />
                    <Text style={styles.liveAoVivoText}>AO VIVO</Text>
                  </View>
                  <View style={styles.ouvintesWrap}>
                    <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.ouvintesText}>
                      {(liveDestaque.ouvintesCount || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.destaqueTitulo} numberOfLines={2}>{liveDestaque.titulo}</Text>

                <View style={styles.destaqueHost}>
                  <View style={styles.destaqueAvatar}>
                    <Text style={styles.destaqueAvatarText}>{liveDestaque.hostNome?.[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.destaqueHostNome}>{liveDestaque.hostNome}</Text>
                    {!!liveDestaque.hostCargo && (
                      <Text style={styles.destaqueHostCargo}>{liveDestaque.hostCargo}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.destaqueBtnsRow}>
                  <TouchableOpacity
                    style={styles.assistirBtn}
                    onPress={() => assistir(liveDestaque)}
                  >
                    <Ionicons name="play-circle" size={17} color={C.azul} />
                    <Text style={styles.assistirBtnText}>Assistir agora</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.partilharBtnDestaque}
                    onPress={() => abrirPartilha(liveDestaque)}
                  >
                    <Feather name="share-2" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
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

            {/* Lista de lives — nunca inclui a live já mostrada em destaque,
                e SÓ mostra lives realmente activas (ouvirLivesAtivas). Se
                não houver nenhuma, mostra apenas o estado vazio abaixo. */}
            <View style={styles.listaWrap}>
              {livesFiltradas.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="radio-outline" size={40} color="#C4CDD6" />
                  <Text style={styles.emptyText}>Nenhuma live ao vivo neste momento</Text>
                </View>
              ) : (
                listaRestante.map((live) => (
                  <TouchableOpacity
                    key={live.id}
                    style={styles.liveCard}
                    activeOpacity={0.85}
                    onPress={() => assistir(live)}
                  >
                    <View style={styles.liveCardTop}>
                      <View style={[styles.liveAvatar, { backgroundColor: corDaLive(live) }]}>
                        <Text style={styles.liveAvatarText}>{live.hostNome?.[0]}</Text>
                        <View style={styles.liveAvatarBadge}>
                          <View style={styles.liveAvatarBadgeDot} />
                        </View>
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
                      <View style={styles.areaBadge}>
                        <Text style={styles.areaBadgeText}>{live.area}</Text>
                      </View>
                      <View style={styles.ouvintesRow}>
                        <Ionicons name="people-outline" size={13} color={C.cinza3} />
                        <Text style={styles.ouvintesRowText}>
                          {(live.ouvintesCount || 0).toLocaleString()} a assistir
                        </Text>
                      </View>
                    </View>

                    <View style={styles.liveBtnsRow}>
                      <TouchableOpacity
                        style={styles.liveBtn}
                        onPress={() => assistir(live)}
                      >
                        <Ionicons name="play-circle" size={16} color="#fff" />
                        <Text style={styles.liveBtnText}>Assistir</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.liveBtnPartilhar}
                        onPress={() => abrirPartilha(live)}
                      >
                        <Feather name="share-2" size={15} color={C.azul} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fabBtn} onPress={abrirCriacao}>
        <Ionicons name="radio" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Modal de criação de live */}
      <Modal visible={modalAberto} animationType="slide" transparent>
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

      {/* Modal de partilha — com amigos ou no Feed */}
      <Modal
        visible={!!liveAPartilhar}
        transparent
        animationType="fade"
        onRequestClose={() => setLiveAPartilhar(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -50}
        >
          <TouchableOpacity
            style={styles.shareOverlay}
            activeOpacity={1}
            onPress={() => setLiveAPartilhar(null)}
          >
            <View style={styles.shareSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.shareHandle} />
              <Text style={styles.shareTitle}>Partilhar live</Text>
              {!!liveAPartilhar && (
                <Text style={styles.shareSubtitle} numberOfLines={1}>{liveAPartilhar.titulo}</Text>
              )}

              <TextInput
                style={styles.shareComentarioInput}
                placeholder="Escreve um comentário (opcional)..."
                placeholderTextColor={C.cinza3}
                value={comentarioPartilha}
                onChangeText={setComentarioPartilha}
                multiline
                maxLength={200}
              />

              <TouchableOpacity
                style={styles.shareRow}
                onPress={() => partilharComAmigos(liveAPartilhar)}
              >
                <View style={styles.shareIconWrap}>
                  <Feather name="send" size={18} color={C.azul} />
                </View>
                <Text style={styles.shareRowText}>Partilhar com amigos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareRow}
                onPress={() => partilharNoFeed(liveAPartilhar)}
                disabled={aPartilharNoFeed}
              >
                <View style={styles.shareIconWrap}>
                  {aPartilharNoFeed
                    ? <ActivityIndicator size="small" color={C.azul} />
                    : <Ionicons name="albums-outline" size={18} color={C.azul} />}
                </View>
                <Text style={styles.shareRowText}>Partilhar no Feed</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareCancelar} onPress={() => setLiveAPartilhar(null)}>
                <Text style={styles.shareCancelarText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cinza1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: C.cinza2,
  },
  title: { fontSize: 20, fontWeight: '800', color: C.cinza4 },
  criarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.azul, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  criarBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.vermelho },
  statusText: { fontSize: 13, fontWeight: '600', color: C.cinza3 },

  destaqueCard: {
    marginHorizontal: 16, marginBottom: 4, borderRadius: 18, padding: 18, gap: 14,
    backgroundColor: C.azulEscuro,
  },
  destaqueTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveAoVivoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.vermelho, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  liveDotWhite: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveAoVivoText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  ouvintesWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ouvintesText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  destaqueTitulo: { fontSize: 19, fontWeight: '800', color: '#fff', lineHeight: 26 },
  destaqueHost: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  destaqueAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  destaqueAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  destaqueHostNome: { fontSize: 13, fontWeight: '700', color: '#fff' },
  destaqueHostCargo: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  destaqueBtnsRow: { flexDirection: 'row', gap: 10 },
  assistirBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12,
  },
  assistirBtnText: { fontSize: 14, fontWeight: '800', color: C.azul },
  partilharBtnDestaque: {
    width: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)',
  },

  catChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: C.cinza2,
  },
  catChipActiva: { backgroundColor: C.azul, borderColor: C.azul },
  catChipText: { fontSize: 12, fontWeight: '600', color: C.cinza3 },
  catChipTextActiva: { color: '#fff' },

  listaWrap: { paddingHorizontal: 16, gap: 12, paddingBottom: 100 },
  liveCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.cinza2, gap: 12,
  },
  liveCardTop: { flexDirection: 'row', gap: 12 },
  liveAvatar: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  liveAvatarText: { color: '#fff', fontSize: 19, fontWeight: '800' },
  liveAvatarBadge: {
    position: 'absolute', bottom: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  liveAvatarBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.vermelho },
  liveInfo: { flex: 1, gap: 2 },
  liveTitulo: { fontSize: 14, fontWeight: '700', color: C.cinza4, lineHeight: 19 },
  liveHostNome: { fontSize: 12, fontWeight: '600', color: C.cinza4 },
  liveHostCargo: { fontSize: 11, color: C.cinza3 },
  liveCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaBadge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: C.cinza1, borderWidth: 1, borderColor: C.cinza2 },
  areaBadgeText: { fontSize: 11, fontWeight: '600', color: C.cinza3 },
  ouvintesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ouvintesRowText: { fontSize: 12, color: C.cinza3 },
  liveBtnsRow: { flexDirection: 'row', gap: 8 },
  liveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 18, paddingVertical: 9, backgroundColor: C.azul,
  },
  liveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  liveBtnPartilhar: {
    width: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, borderWidth: 1, borderColor: C.cinza2,
  },

  empty: { alignItems: 'center', paddingTop: 50, paddingBottom: 10, gap: 10 },
  emptyText: { fontSize: 14, color: C.cinza3 },

  fabBtn: {
    position: 'absolute', bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.azul, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 20, gap: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: C.cinza4 },
  modalInput: {
    backgroundColor: C.cinza1, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: C.cinza4,
  },
  modalBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelarBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 20, backgroundColor: C.cinza1,
  },
  modalCancelarText: { color: C.cinza3, fontWeight: '700' },
  modalIniciarBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 20, backgroundColor: C.azul,
  },
  modalIniciarText: { color: '#fff', fontWeight: '800' },

  shareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  shareSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30,
  },
  shareHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.cinza2, alignSelf: 'center', marginBottom: 14 },
  shareTitle: { fontSize: 16, fontWeight: '800', color: C.cinza4 },
  shareSubtitle: { fontSize: 12, color: C.cinza3, marginTop: 2, marginBottom: 12 },
  shareComentarioInput: {
    backgroundColor: C.cinza1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: C.cinza4, minHeight: 44, maxHeight: 90, marginBottom: 14,
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  shareIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center' },
  shareRowText: { fontSize: 14, fontWeight: '600', color: C.cinza4 },
  shareCancelar: { marginTop: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: C.cinza1, alignItems: 'center' },
  shareCancelarText: { fontSize: 14, fontWeight: '700', color: C.cinza4 },
});