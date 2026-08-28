/**
 * PessoasRecomendadas.jsx — ConnectAll Angola
 *
 * Componente que mostra pessoas e vagas recomendadas por IA.
 * Usa as Cloud Functions calcularRecomendacoes e recomendarVagas.
 *
 * Uso:
 *   import PessoasRecomendadas from '../../components/PessoasRecomendadas';
 *   <PessoasRecomendadas />
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';

const { width: W } = Dimensions.get('window');

const C = {
  azul:       '#0A66C2',
  azulClaro:  '#EEF3FB',
  verde:      '#057642',
  verdeClaro: '#EAF6EF',
  laranja:    '#D97706',
  laranjaClaro: '#FFFBEB',
  cinza1:     '#F3F2EE',
  cinza2:     '#E9E5DF',
  cinza3:     '#666360',
  cinza4:     '#1B1B1B',
  branco:     '#FFFFFF',
  preto:      '#000000',
};

const functions = getFunctions(undefined, 'europe-west1');

// ─────────────────────────────────────────────────────────────────────────────
// Card de pessoa recomendada
// ─────────────────────────────────────────────────────────────────────────────
function CardPessoa({ pessoa, onConectar, onVer }) {
  const iniciais = (pessoa.nome || 'U').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={s.cardPessoa}>
      <TouchableOpacity onPress={() => onVer(pessoa.uid)} activeOpacity={0.85}>
        <View style={s.cardPessoaAvatar}>
          {pessoa.fotoURL
            ? <Image source={{ uri: pessoa.fotoURL }} style={s.cardPessoaAvatarImg} />
            : <View style={s.cardPessoaAvatarFb}><Text style={s.cardPessoaAvatarTxt}>{iniciais}</Text></View>}
          {pessoa.verificado && (
            <View style={s.badgeVerificado}>
              <Ionicons name="shield-checkmark" size={12} color="#1677F2" />
            </View>
          )}
        </View>
        <Text style={s.cardPessoaNome} numberOfLines={2}>{pessoa.nome}</Text>
        <Text style={s.cardPessoaCargo} numberOfLines={2}>{pessoa.cargo || pessoa.area || '—'}</Text>
        {pessoa.empresa && pessoa.empresa !== 'Desempregado' && (
          <Text style={s.cardPessoaEmpresa} numberOfLines={1}>{pessoa.empresa}</Text>
        )}
      </TouchableOpacity>

      {/* Razões da recomendação */}
      {pessoa.razoes?.length > 0 && (
        <View style={s.razaoRow}>
          <Ionicons name="sparkles" size={11} color={C.laranja} />
          <Text style={s.razaoTxt} numberOfLines={2}>{pessoa.razoes[0]}</Text>
        </View>
      )}

      <TouchableOpacity style={s.btnConectar} onPress={() => onConectar(pessoa)} activeOpacity={0.85}>
        <Feather name="user-plus" size={13} color={C.azul} />
        <Text style={s.btnConectarTxt}>Conectar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de vaga recomendada
// ─────────────────────────────────────────────────────────────────────────────
function CardVaga({ vaga, onVer }) {
  const formatarSalario = (min, max) => {
    if (!min && !max) return null;
    if (min && max) return `${Number(min).toLocaleString()} – ${Number(max).toLocaleString()} Kz`;
    if (max)        return `Até ${Number(max).toLocaleString()} Kz`;
    return `A partir de ${Number(min).toLocaleString()} Kz`;
  };

  const salario = formatarSalario(vaga.salarioMin, vaga.salarioMax);

  return (
    <TouchableOpacity style={s.cardVaga} onPress={() => onVer(vaga.id)} activeOpacity={0.88}>
      <View style={s.cardVagaEsquerda}>
        {vaga.logoEmpresa
          ? <Image source={{ uri: vaga.logoEmpresa }} style={s.cardVagaLogo} />
          : <View style={s.cardVagaLogoFb}><Feather name="briefcase" size={20} color={C.cinza3} /></View>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardVagaTitulo} numberOfLines={2}>{vaga.titulo}</Text>
        <Text style={s.cardVagaEmpresa} numberOfLines={1}>{vaga.empresa}</Text>
        <View style={s.cardVagaMeta}>
          {vaga.provincia && (
            <View style={s.metaChip}>
              <Feather name="map-pin" size={10} color={C.cinza3} />
              <Text style={s.metaChipTxt}>{vaga.provincia}</Text>
            </View>
          )}
          {vaga.tipoContrato && (
            <View style={s.metaChip}>
              <Feather name="clock" size={10} color={C.cinza3} />
              <Text style={s.metaChipTxt}>{vaga.tipoContrato}</Text>
            </View>
          )}
        </View>
        {salario && <Text style={s.cardVagaSalario}>{salario}</Text>}

        {/* Match score */}
        <View style={s.matchRow}>
          <View style={[s.matchBarra, { width: `${Math.min(100, vaga.score)}%` }]} />
          <Text style={s.matchTxt}>{Math.min(100, vaga.score)}% compatível</Text>
        </View>

        {vaga.razoes?.length > 0 && (
          <View style={s.razaoRow}>
            <Ionicons name="sparkles" size={11} color={C.laranja} />
            <Text style={s.razaoTxt} numberOfLines={1}>{vaga.razoes[0]}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function PessoasRecomendadas() {
  const router       = useRouter();
  const { user }     = useUser();
  const [aba, setAba]                   = useState('pessoas');
  const [pessoas, setPessoas]           = useState([]);
  const [vagas, setVagas]               = useState([]);
  const [carregando, setCarregando]     = useState(true);
  const [carregandoVagas, setCarregandoVagas] = useState(false);
  const [erro, setErro]                 = useState(null);
  const [erroVagas, setErroVagas]       = useState(null);

  // Carrega recomendações de pessoas
  useEffect(() => {
    if (!user) return;
    carregarPessoas();
  }, [user]);

  const carregarPessoas = async () => {
    setCarregando(true);
    setErro(null);
    try {
      // 1. Tenta ler cache do Firestore primeiro
      const cacheSnap = await getDoc(doc(db, 'recomendacoes', user.uid));
      if (cacheSnap.exists()) {
        const data = cacheSnap.data();
        // Cache válido se tiver menos de 24h
        const diff = (new Date() - data.timestamp?.toDate?.()) / 1000 / 3600;
        if (diff < 24 && data.pessoas?.length > 0) {
          setPessoas(data.pessoas);
          setCarregando(false);
          return;
        }
      }
      // 2. Cache expirado ou inexistente — chama a função
      const fn = httpsCallable(functions, 'calcularRecomendacoes');
      const { data } = await fn();
      setPessoas(data.pessoas || []);
    } catch (e) {
      console.error('[recomendacoes] erro:', e);
      setErro('Não foi possível carregar recomendações.');
    } finally {
      setCarregando(false);
    }
  };

  const carregarVagas = async () => {
    if (vagas.length > 0) return; // já carregou
    setCarregandoVagas(true);
    setErroVagas(null);
    try {
      const cacheSnap = await getDoc(doc(db, 'vagasRecomendadas', user.uid));
      if (cacheSnap.exists()) {
        const data = cacheSnap.data();
        const diff = (new Date() - data.timestamp?.toDate?.()) / 1000 / 3600;
        if (diff < 12 && data.vagas?.length > 0) {
          setVagas(data.vagas);
          setCarregandoVagas(false);
          return;
        }
      }
      const fn = httpsCallable(functions, 'recomendarVagas');
      const { data } = await fn();
      setVagas(data.vagas || []);
    } catch (e) {
      console.error('[vagas] erro:', e);
      setErroVagas('Não foi possível carregar vagas.');
    } finally {
      setCarregandoVagas(false);
    }
  };

  const mudarAba = (novaAba) => {
    setAba(novaAba);
    if (novaAba === 'vagas') carregarVagas();
  };

  const verPerfil = (uid) => {
    router.push({ pathname: '/(main)/perfil-publico', params: { uid } });
  };

  const verVaga = (id) => {
    router.push({ pathname: '/(main)/vaga-detalhe', params: { vagaId: id } });
  };

  const conectar = async (pessoa) => {
    // Navega para o perfil onde o utilizador pode conectar
    verPerfil(pessoa.uid);
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTexto}>
          <Text style={s.titulo}>Recomendado para ti</Text>
          <Text style={s.subtitulo}>Baseado no teu perfil e interesses</Text>
        </View>
        <View style={s.iaChip}>
          <Ionicons name="sparkles" size={12} color={C.laranja} />
          <Text style={s.iaChipTxt}>IA</Text>
        </View>
      </View>

      {/* Abas */}
      <View style={s.abasRow}>
        <TouchableOpacity
          style={[s.aba, aba === 'pessoas' && s.abaActiva]}
          onPress={() => mudarAba('pessoas')}
        >
          <Feather name="users" size={14} color={aba === 'pessoas' ? C.branco : C.cinza3} />
          <Text style={[s.abaTxt, aba === 'pessoas' && s.abaTxtActivo]}>Pessoas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.aba, aba === 'vagas' && s.abaActiva]}
          onPress={() => mudarAba('vagas')}
        >
          <Feather name="briefcase" size={14} color={aba === 'vagas' ? C.branco : C.cinza3} />
          <Text style={[s.abaTxt, aba === 'vagas' && s.abaTxtActivo]}>Vagas</Text>
        </TouchableOpacity>
      </View>

      {/* ── ABA PESSOAS ── */}
      {aba === 'pessoas' && (
        <>
          {carregando ? (
            <View style={s.loading}>
              <ActivityIndicator color={C.azul} size="large" />
              <Text style={s.loadingTxt}>A analisar o teu perfil…</Text>
            </View>
          ) : erro ? (
            <View style={s.erroBox}>
              <Feather name="alert-circle" size={28} color="#ccc" />
              <Text style={s.erroTxt}>{erro}</Text>
              <TouchableOpacity style={s.btnTentar} onPress={carregarPessoas}>
                <Text style={s.btnTentarTxt}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : pessoas.length === 0 ? (
            <View style={s.erroBox}>
              <Feather name="users" size={28} color="#ccc" />
              <Text style={s.erroTxt}>Completa o teu perfil para receber recomendações.</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.scrollPessoas}
              >
                {pessoas.map(p => (
                  <CardPessoa
                    key={p.uid}
                    pessoa={p}
                    onConectar={conectar}
                    onVer={verPerfil}
                  />
                ))}
              </ScrollView>
              <TouchableOpacity style={s.btnActualizar} onPress={carregarPessoas}>
                <Feather name="refresh-cw" size={13} color={C.cinza3} />
                <Text style={s.btnActualizarTxt}>Actualizar recomendações</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* ── ABA VAGAS ── */}
      {aba === 'vagas' && (
        <>
          {carregandoVagas ? (
            <View style={s.loading}>
              <ActivityIndicator color={C.azul} size="large" />
              <Text style={s.loadingTxt}>A procurar vagas para ti…</Text>
            </View>
          ) : erroVagas ? (
            <View style={s.erroBox}>
              <Feather name="alert-circle" size={28} color="#ccc" />
              <Text style={s.erroTxt}>{erroVagas}</Text>
              <TouchableOpacity style={s.btnTentar} onPress={carregarVagas}>
                <Text style={s.btnTentarTxt}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : vagas.length === 0 ? (
            <View style={s.erroBox}>
              <Feather name="briefcase" size={28} color="#ccc" />
              <Text style={s.erroTxt}>Sem vagas recomendadas agora. Completa o teu perfil para melhorar os resultados.</Text>
            </View>
          ) : (
            <View style={s.listaVagas}>
              {vagas.map(v => (
                <CardVaga key={v.id} vaga={v} onVer={verVaga} />
              ))}
              <TouchableOpacity style={s.btnActualizar} onPress={() => { setVagas([]); carregarVagas(); }}>
                <Feather name="refresh-cw" size={13} color={C.cinza3} />
                <Text style={s.btnActualizarTxt}>Actualizar vagas</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const CARD_W = W * 0.44;

const s = StyleSheet.create({
  container:    { backgroundColor: C.branco, marginBottom: 8 },
  header:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTexto:  { flex: 1 },
  titulo:       { fontSize: 18, fontWeight: '700', color: C.preto },
  subtitulo:    { fontSize: 12, color: C.cinza3, marginTop: 2 },
  iaChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.laranjaClaro, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#F6D28A' },
  iaChipTxt:    { fontSize: 11, fontWeight: '800', color: C.laranja },

  abasRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  aba:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, borderWidth: 1.5, borderColor: C.cinza2, backgroundColor: C.branco },
  abaActiva:    { backgroundColor: C.cinza4, borderColor: C.cinza4 },
  abaTxt:       { fontSize: 13, fontWeight: '600', color: C.cinza3 },
  abaTxtActivo: { color: C.branco },

  loading:      { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingTxt:   { fontSize: 13, color: C.cinza3 },

  erroBox:      { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 10 },
  erroTxt:      { fontSize: 13, color: C.cinza3, textAlign: 'center', lineHeight: 20 },
  btnTentar:    { backgroundColor: C.azulClaro, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginTop: 4 },
  btnTentarTxt: { fontSize: 13, fontWeight: '700', color: C.azul },

  scrollPessoas:  { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },

  // Card pessoa
  cardPessoa:           { width: CARD_W, backgroundColor: C.cinza1, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.cinza2 },
  cardPessoaAvatar:     { width: 64, height: 64, borderRadius: 32, marginBottom: 10, position: 'relative' },
  cardPessoaAvatarImg:  { width: 64, height: 64, borderRadius: 32 },
  cardPessoaAvatarFb:   { width: 64, height: 64, borderRadius: 32, backgroundColor: C.azul, alignItems: 'center', justifyContent: 'center' },
  cardPessoaAvatarTxt:  { color: C.branco, fontSize: 20, fontWeight: '800' },
  badgeVerificado:      { position: 'absolute', bottom: 0, right: 0, backgroundColor: C.branco, borderRadius: 8, padding: 2 },
  cardPessoaNome:       { fontSize: 13, fontWeight: '700', color: C.preto, textAlign: 'center', marginBottom: 2 },
  cardPessoaCargo:      { fontSize: 11, color: C.cinza3, textAlign: 'center', marginBottom: 2, lineHeight: 16 },
  cardPessoaEmpresa:    { fontSize: 11, color: C.azul, textAlign: 'center', marginBottom: 6, fontWeight: '600' },
  btnConectar:          { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: C.azul, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 6 },
  btnConectarTxt:       { fontSize: 12, fontWeight: '700', color: C.azul },

  // Card vaga
  listaVagas:       { paddingHorizontal: 16 },
  cardVaga:         { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: C.cinza1, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: C.cinza2 },
  cardVagaEsquerda: { paddingTop: 2 },
  cardVagaLogo:     { width: 44, height: 44, borderRadius: 8, backgroundColor: C.branco },
  cardVagaLogoFb:   { width: 44, height: 44, borderRadius: 8, backgroundColor: C.branco, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cinza2 },
  cardVagaTitulo:   { fontSize: 14, fontWeight: '700', color: C.preto, marginBottom: 2 },
  cardVagaEmpresa:  { fontSize: 12, color: C.cinza4, marginBottom: 6 },
  cardVagaMeta:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  metaChip:         { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.branco, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: C.cinza2 },
  metaChipTxt:      { fontSize: 10, color: C.cinza3 },
  cardVagaSalario:  { fontSize: 12, fontWeight: '700', color: C.verde, marginBottom: 6 },
  matchRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  matchBarra:       { height: 4, backgroundColor: C.azul, borderRadius: 2, maxWidth: '60%' },
  matchTxt:         { fontSize: 11, color: C.azul, fontWeight: '700' },

  // Razão da recomendação
  razaoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: C.cinza2 },
  razaoTxt:   { flex: 1, fontSize: 10, color: C.laranja, fontWeight: '600', lineHeight: 14 },

  btnActualizar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4, marginBottom: 8 },
  btnActualizarTxt: { fontSize: 12, color: C.cinza3, fontWeight: '600' },
});