import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVisualizador } from '../../components/VisualizadorFicheiro';
import { db } from '../../config/firebase';
import { C } from '../../constants/colors';
import { useUser } from '../../context/UserContext';

const ESTADOS = [
  { id: 'pendente',   label: 'Pendente',    cor: C.cinza3, corFundo: C.cinza1 },
  { id: 'analise',    label: 'Em análise',  cor: C.laranja, corFundo: C.laranjaClaro },
  { id: 'entrevista', label: 'Entrevista',  cor: C.azul,    corFundo: C.azulClaro },
  { id: 'aprovado',   label: 'Aprovado',    cor: C.verde,   corFundo: C.verdeClaro },
  { id: 'rejeitado',  label: 'Rejeitado',   cor: C.vermelho, corFundo: '#FDEBEB' },
];

function estadoInfo(id) {
  return ESTADOS.find(e => e.id === id) || ESTADOS[0];
}

// Textos das perguntas padrão (as mesmas do vagas.js), usados só para dar um
// rótulo legível a candidaturas antigas que foram guardadas antes da
// correção — sem isto, mostrariam o id em bruto (ex: "excel").
const ROTULOS_PERGUNTAS_ANTIGAS = {
  excel:           'Há quantos anos você já usa Microsoft Excel no trabalho?',
  tecnica:         'Há quantos anos de experiência tem na área técnica desta vaga?',
  disponibilidade: 'Qual é a sua disponibilidade para iniciar (em dias)?',
};

function iniciais(nome) {
  if (!nome) return '?';
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// Mostra a foto de perfil do candidato quando existe (candidatoFoto,
// guardada no momento da candidatura); cai para as iniciais do nome caso
// contrário — antes o avatar mostrava sempre só as iniciais, mesmo com
// foto disponível.
function AvatarCandidato({ foto, nome, size = 42 }) {
  return (
    <View style={[s.candAvatar, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }]}>
      {foto
        ? <Image source={{ uri: foto }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
        : <Text style={[s.candAvatarTxt, { fontSize: size * 0.33 }]}>{iniciais(nome)}</Text>}
    </View>
  );
}

export default function CandidatosScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { vagaId, vagaTitulo, vagaAutorUid } = useLocalSearchParams();

  // ── Download/visualização segura de ficheiros (PDF nunca abre no navegador) ──
  const { abrir, Visualizador, baixando } = useVisualizador();

  const [candidaturas, setCandidaturas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [candidatoSelecionado, setCandidatoSelecionado] = useState(null);

  const semPermissao = !user || (vagaAutorUid && vagaAutorUid !== user.uid);

  // Escuta em tempo real as candidaturas desta vaga.
  useEffect(() => {
    if (!vagaId || semPermissao) { setCarregando(false); return; }
    setCarregando(true);
    const q = query(collection(db, 'candidaturas'), where('vagaId', '==', vagaId), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setCandidaturas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, err => { console.log('Erro candidaturas:', err); setCarregando(false); });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vagaId, semPermissao]);

  const contagens = useMemo(() => {
    const base = { todos: candidaturas.length };
    ESTADOS.forEach(e => { base[e.id] = candidaturas.filter(c => (c.status || 'pendente') === e.id).length; });
    return base;
  }, [candidaturas]);

  const listaFiltrada = filtro === 'todos'
    ? candidaturas
    : candidaturas.filter(c => (c.status || 'pendente') === filtro);

  // ── Ir para o perfil público do candidato ──
  // ⚠️ Ajusta "pathname" e o nome do parâmetro ("uid") para corresponderem
  // à rota real do perfil público na tua app.
  const abrirPerfilPublico = (uid) => {
    if (!uid) return;
    router.push({ pathname: '/(main)/perfil-publico', params: { uid } });
  };

  const mudarEstado = async (candidatura, novoEstado) => {
    try {
      await updateDoc(doc(db, 'candidaturas', candidatura.id), { status: novoEstado });
      setCandidatoSelecionado(prev => (prev && prev.id === candidatura.id ? { ...prev, status: novoEstado } : prev));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar o estado da candidatura.');
    }
  };

  // ── Ver currículo ──
  // Antes usava Linking.openURL(url), que abria o navegador e mostrava o
  // link direto do Firebase Storage. Agora usa o mesmo mecanismo de
  // download seguro do UploadBtnComPreview: descarrega o PDF para o
  // dispositivo (com notificação de progresso) e nunca expõe a URL.
  const abrirCV = (url, nomeCandidato) => {
    if (!url) {
      Alert.alert('Indisponível', 'Este candidato não anexou currículo.');
      return;
    }
    const nomeFicheiro = nomeCandidato ? `curriculo-${nomeCandidato}` : 'curriculo';
    abrir(url, nomeFicheiro);
  };

  const contactarEmail = (candidatura) => {
    if (!candidatura.email) {
      Alert.alert('Indisponível', 'Este candidato não tem e-mail registado.');
      return;
    }
    const mailto = `mailto:${candidatura.email}?subject=${encodeURIComponent('Sobre a tua candidatura — ' + (vagaTitulo || ''))}`;
    Linking.openURL(mailto).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir a aplicação de e-mail.')
    );
  };

  if (semPermissao) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.bloqueioWrap}>
          <Ionicons name="lock-closed-outline" size={32} color={C.cinza3} />
          <Text style={s.bloqueioTitulo}>Sem permissão</Text>
          <Text style={s.bloqueioTxt}>Só quem publicou esta vaga pode ver e gerir os candidatos.</Text>
          <TouchableOpacity style={s.bloqueioBtn} onPress={() => router.back()}>
            <Text style={s.bloqueioBtnTxt}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={C.cinza4} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo} numberOfLines={1}>Candidatos</Text>
          <Text style={s.headerSub} numberOfLines={1}>{vagaTitulo}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosScroll} contentContainerStyle={s.filtrosContent}>
        <TouchableOpacity style={[s.filtroChip, filtro === 'todos' && s.filtroChipAtivo]} onPress={() => setFiltro('todos')}>
          <Text style={[s.filtroTxt, filtro === 'todos' && s.filtroTxtAtivo]}>Todos ({contagens.todos})</Text>
        </TouchableOpacity>
        {ESTADOS.map(e => (
          <TouchableOpacity key={e.id} style={[s.filtroChip, filtro === e.id && s.filtroChipAtivo]} onPress={() => setFiltro(e.id)}>
            <Text style={[s.filtroTxt, filtro === e.id && s.filtroTxtAtivo]}>{e.label} ({contagens[e.id] || 0})</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {carregando && (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={C.azul} />
        </View>
      )}

      {!carregando && listaFiltrada.length === 0 && (
        <View style={{ paddingVertical: 40, alignItems: 'center', paddingHorizontal: 30, gap: 8 }}>
          <Ionicons name="people-outline" size={28} color={C.cinza3} />
          <Text style={{ fontSize: 13, color: C.cinza3, textAlign: 'center' }}>
            {filtro === 'todos' ? 'Ainda não há candidaturas para esta vaga.' : 'Nenhum candidato neste estado.'}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {listaFiltrada.map(c => {
          const est = estadoInfo(c.status || 'pendente');
          return (
            <TouchableOpacity key={c.id} style={s.candCard} activeOpacity={0.7} onPress={() => setCandidatoSelecionado(c)}>
              <TouchableOpacity onPress={() => abrirPerfilPublico(c.candidatoUid)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <AvatarCandidato foto={c.candidatoFoto} nome={c.candidatoNome} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TouchableOpacity onPress={() => abrirPerfilPublico(c.candidatoUid)} hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                  <Text style={s.candNome}>{c.candidatoNome || 'Candidato'}</Text>
                </TouchableOpacity>
                <Text style={s.candMeta}>{c.email}</Text>
                <View style={[s.estadoBadge, { backgroundColor: est.corFundo }]}>
                  <Text style={[s.estadoBadgeTxt, { color: est.cor }]}>{est.label}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.cinza3} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Modal de detalhe / avaliação do candidato */}
      <Modal visible={!!candidatoSelecionado} animationType="slide" onRequestClose={() => setCandidatoSelecionado(null)}>
        <SafeAreaView style={s.safe}>
          {candidatoSelecionado && (
            <>
              <View style={s.header}>
                <TouchableOpacity onPress={() => setCandidatoSelecionado(null)} style={s.headerBtn}>
                  <Ionicons name="close" size={24} color={C.cinza4} />
                </TouchableOpacity>
                <Text style={s.headerTitulo}>Perfil da candidatura</Text>
                <View style={{ width: 32 }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <TouchableOpacity onPress={() => abrirPerfilPublico(candidatoSelecionado.candidatoUid)}>
                    <AvatarCandidato foto={candidatoSelecionado.candidatoFoto} nome={candidatoSelecionado.candidatoNome} size={56} />
                  </TouchableOpacity>
                  <View>
                    <TouchableOpacity onPress={() => abrirPerfilPublico(candidatoSelecionado.candidatoUid)}>
                      <Text style={s.detNome}>{candidatoSelecionado.candidatoNome || 'Candidato'}</Text>
                    </TouchableOpacity>
                    <Text style={s.detMeta}>{candidatoSelecionado.email}</Text>
                    <Text style={s.detMeta}>{candidatoSelecionado.telefone}</Text>
                  </View>
                </View>

                <View style={s.divider} />

                <Text style={s.secTitulo}>Estado da candidatura</Text>
                <View style={s.pillsRow}>
                  {ESTADOS.map(e => {
                    const ativo = (candidatoSelecionado.status || 'pendente') === e.id;
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[s.estadoPill, { borderColor: e.cor }, ativo && { backgroundColor: e.cor }]}
                        onPress={() => mudarEstado(candidatoSelecionado, e.id)}
                      >
                        <Text style={[s.estadoPillTxt, { color: ativo ? C.branco : e.cor }]}>{e.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={s.divider} />

                {candidatoSelecionado.cvUrl ? (
                  <TouchableOpacity
                    style={s.cvBtn}
                    onPress={() => abrirCV(candidatoSelecionado.cvUrl, candidatoSelecionado.candidatoNome)}
                    disabled={baixando}
                  >
                    {baixando ? (
                      <ActivityIndicator size="small" color={C.azul} />
                    ) : (
                      <>
                        <Ionicons name="document-text-outline" size={18} color={C.azul} />
                        <Text style={s.cvBtnTxt}>Ver currículo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={s.detMeta}>Sem currículo anexado.</Text>
                )}

                <TouchableOpacity style={s.cvBtn} onPress={() => contactarEmail(candidatoSelecionado)}>
                  <Ionicons name="mail-outline" size={18} color={C.azul} />
                  <Text style={s.cvBtnTxt}>Contactar por e-mail</Text>
                </TouchableOpacity>

                {(() => {
                  // Candidaturas novas trazem "perguntasRespondidas" já com o
                  // texto da pergunta guardado. Candidaturas antigas só têm
                  // "perguntas" (id → valor) — nesse caso mostramos pelo
                  // menos um rótulo legível em vez do id em bruto.
                  const respondidas = Array.isArray(candidatoSelecionado.perguntasRespondidas)
                    ? candidatoSelecionado.perguntasRespondidas
                    : candidatoSelecionado.perguntas
                      ? Object.entries(candidatoSelecionado.perguntas).map(([id, resposta]) => ({
                          id,
                          pergunta: ROTULOS_PERGUNTAS_ANTIGAS[id] || id,
                          resposta,
                        }))
                      : [];

                  if (respondidas.length === 0) return null;

                  return (
                    <>
                      <View style={s.divider} />
                      <Text style={s.secTitulo}>Respostas de triagem</Text>
                      {respondidas.map(p => (
                        <View key={p.id} style={{ marginTop: 12 }}>
                          <Text style={s.perguntaLabel}>{p.pergunta}</Text>
                          <Text style={s.perguntaValor}>{p.resposta !== '' && p.resposta != null ? String(p.resposta) : '—'}</Text>
                        </View>
                      ))}
                    </>
                  );
                })()}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Necessário para o download de PDF / preview de imagens funcionar */}
      {Visualizador}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.branco },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.cinza1 },
  headerBtn: { width: 32, alignItems: 'flex-start' },
  headerTitulo: { fontSize: 16, fontWeight: '800', color: C.preto },
  headerSub: { fontSize: 12, color: C.cinza3, marginTop: 1 },

  filtrosScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.cinza1 },
  filtrosContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filtroChip: { borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  filtroChipAtivo: { backgroundColor: C.azul, borderColor: C.azul },
  filtroTxt: { fontSize: 12, fontWeight: '600', color: C.cinza4 },
  filtroTxtAtivo: { color: C.branco },

  candCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.cinza1 },
  candAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center' },
  candAvatarTxt: { color: C.azul, fontWeight: '700', fontSize: 14 },
  candNome: { fontSize: 14, fontWeight: '700', color: C.preto },
  candMeta: { fontSize: 12, color: C.cinza3, marginTop: 2 },
  estadoBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  estadoBadgeTxt: { fontSize: 11, fontWeight: '700' },

  detNome: { fontSize: 17, fontWeight: '800', color: C.preto },
  detMeta: { fontSize: 13, color: C.cinza3, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.cinza1, marginVertical: 20 },
  secTitulo: { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 10 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  estadoPill: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  estadoPillTxt: { fontSize: 12, fontWeight: '700' },

  cvBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.3, borderColor: C.cinza2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  cvBtnTxt: { fontSize: 13, fontWeight: '700', color: C.azul },
  perguntaLabel: { fontSize: 12, color: C.cinza3 },
  perguntaValor: { fontSize: 14, color: C.preto, marginTop: 2, fontWeight: '600' },

  bloqueioWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  bloqueioTitulo: { fontSize: 17, fontWeight: '800', color: C.preto, marginTop: 6 },
  bloqueioTxt: { fontSize: 13, color: C.cinza3, textAlign: 'center', lineHeight: 19 },
  bloqueioBtn: { marginTop: 16, backgroundColor: C.azul, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11 },
  bloqueioBtnTxt: { color: C.branco, fontWeight: '700', fontSize: 14 },
});