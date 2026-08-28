import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

// ─── Cores ConnectAll ────────────────────────────────────────
const C = {
  azul: '#1677F2',
  roxo: '#6A11CB',
  magenta: '#EC4C89',
  preto: '#1F1F1F',
  cinza: '#6B6B6B',
  cinzaClaro: '#EAEAEA',
  branco: '#FFFFFF',
};

// ─── Planos de fallback — usados se Firestore ainda não tem dados ──
const PLANOS_FALLBACK = [
  {
    id: 'free',
    nome: 'CONNECTALL FREE',
    emoji: '🆓',
    preco: 0,
    moeda: 'Kz',
    periodo: 'Mês',
    descricao: 'Para utilizadores que desejam conhecer a plataforma.',
    cor: '#6B6B6B',
    destaque: false,
    funcionalidades: [
      'Perfil profissional básico',
      'Até 5 publicações por dia',
      'Chat limitado',
      'Acesso à comunidade limitada',
      'Conexões limitadas',
      'Pesquisa básica de utilizadores',
      'Participação em grupos públicos',
    ],
  },
  {
    id: 'pro',
    nome: 'CONNECTALL PRO',
    emoji: '💼',
    preco: 2500,
    moeda: 'Kz',
    periodo: 'Mês',
    descricao: 'Para profissionais que procuram mais oportunidades.',
    cor: '#1677F2',
    destaque: true,
    funcionalidades: [
      'Tudo do Plano Free',
      'Perfil profissional completo',
      'Até 25 publicações por dia',
      'Chat avançado',
      'Prioridade nas pesquisas',
      'Criação de grupos privados',
      'Acesso a eventos exclusivos',
      'Conexões com perfis premium',
      'Distintivo Pro no perfil',
    ],
  },
  {
    id: 'premium',
    nome: 'CONNECTALL PREMIUM',
    emoji: '👑',
    preco: 5000,
    moeda: 'Kz',
    periodo: 'Mês',
    descricao: 'Para profissionais que desejam máxima visibilidade.',
    cor: '#6A11CB',
    destaque: false,
    funcionalidades: [
      'Tudo do Plano Pro',
      'Publicações ilimitadas',
      'Analytics avançado',
      'Destaque no feed',
      'Destaque nas pesquisas',
      'Suporte prioritário',
      'Currículo ATS Premium',
      'Conta premium',
      'Estatísticas de visualização do perfil',
      'Acesso antecipado a novas funcionalidades',
      'Distintivo Premium no perfil',
    ],
  },
];

function formatarPreco(valor, moeda) {
  if (valor === 0) return `0 ${moeda}`;
  return `${valor.toLocaleString('pt-AO')} ${moeda}`;
}

export default function PlanosScreen() {
  const router = useRouter();
  const { perfil } = useUser();
  const [planos, setPlanos] = useState(PLANOS_FALLBACK);
  const [carregando, setCarregando] = useState(true);

  // ─── Carrega planos do Firestore (geridos no painel admin) ──
  useEffect(() => {
    const q = query(collection(db, 'planos'), orderBy('ordem', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setPlanos(dados);
        }
        setCarregando(false);
      },
      (err) => {
        console.log('Erro ao carregar planos (a usar fallback):', err);
        setCarregando(false);
      }
    );
    return unsub;
  }, []);

  const planoAtual = perfil?.plano || 'free';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header com fundo da identidade ConnectAll ── */}
        <View style={s.header}>
          {/* Fundo gradiente com logo */}
          <View style={s.headerBg}>
            <View style={s.headerOverlay} />
            <Image
              source={require('../../../assets/logo2.png')}
              style={s.headerLogoBg}
              resizeMode="contain"
            />
          </View>

          {/* Botão fechar */}
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Logo + nome */}
          <View style={s.headerConteudo}>
            <View style={s.logoCircle}>
              <Image
                source={require('../../../assets/logo2.png')}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={s.headerTitulo}>ConnectAll{'\n'}Planos</Text>
          </View>

          {/* Ícones de funcionalidades — estilo Tandem Pro */}
          <View style={s.iconesRow}>
            {[
              { icon: 'eye-outline' },
              { icon: 'flash-outline' },
              { icon: 'globe-outline', ativo: true },
              { icon: 'create-outline' },
              { icon: 'language-outline' },
              { icon: 'people-outline' },
            ].map((item, i) => (
              <View
                key={i}
                style={[s.iconeCircle, item.ativo && { backgroundColor: C.azul, borderColor: C.azul }]}
              >
                <Ionicons name={item.icon} size={20} color={item.ativo ? '#fff' : 'rgba(255,255,255,0.85)'} />
              </View>
            ))}
          </View>

          <Text style={s.headerFrase}>Cresce a tua rede profissional</Text>
          <Text style={s.headerSubfrase}>
            Conecta-te com profissionais e empresas em todo o país
          </Text>
        </View>

        {/* ── Loading ── */}
        {carregando && (
          <View style={{ paddingVertical: 30 }}>
            <ActivityIndicator color={C.azul} />
          </View>
        )}

        {/* ── Lista de planos ── */}
        <View style={s.planosWrap}>
          {planos.map((plano) => {
            const ehAtual = planoAtual === plano.id;
            return (
              <View
                key={plano.id}
                style={[
                  s.planoCard,
                  plano.destaque && s.planoCardDestaque,
                  ehAtual && s.planoCardAtual,
                ]}
              >
                {/* Badge "Mais Popular" */}
                {plano.destaque && (
                  <View style={s.badgePopular}>
                    <Text style={s.badgePopularTxt}>MAIS POPULAR</Text>
                  </View>
                )}

                {/* Badge "Plano Atual" */}
                {ehAtual && (
                  <View style={s.badgeAtual}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={s.badgeAtualTxt}>O TEU PLANO</Text>
                  </View>
                )}

                {/* Cabeçalho do plano */}
                <View style={s.planoHeader}>
                  <Text style={s.planoEmoji}>{plano.emoji}</Text>
                  <Text style={[s.planoNome, { color: plano.cor }]}>{plano.nome}</Text>
                </View>

                {/* Preço */}
                <View style={s.precoRow}>
                  <Text style={s.precoValor}>{formatarPreco(plano.preco, plano.moeda)}</Text>
                  <Text style={s.precoPeriodo}>/ {plano.periodo}</Text>
                </View>

                {/* Descrição */}
                <Text style={s.planoDescricao}>{plano.descricao}</Text>

                {/* Divisor */}
                <View style={s.divisor} />

                {/* Lista de funcionalidades */}
                <View style={s.funcionalidadesWrap}>
                  {plano.funcionalidades?.map((func, i) => (
                    <View key={i} style={s.funcionalidadeLinha}>
                      <View style={[s.checkCircle, { backgroundColor: plano.cor + '1A' }]}>
                        <Ionicons name="checkmark" size={13} color={plano.cor} />
                      </View>
                      <Text style={s.funcionalidadeTxt}>{func}</Text>
                    </View>
                  ))}
                </View>

                {/* Botão de ação */}
                {ehAtual ? (
                  <View style={[s.btnPlano, s.btnPlanoAtual]}>
                    <Text style={s.btnPlanoAtualTxt}>Plano Ativo</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.btnPlano, { backgroundColor: plano.cor }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      // TODO: integrar com pagamento (Multicaixa Express / Unitel Money)
                      router.push({ pathname: '/(main)/checkout', params: { planoId: plano.id } });
                    }}
                  >
                    <Text style={s.btnPlanoTxt}>
                      {plano.preco === 0 ? 'Plano Atual Gratuito' : 'Fazer Upgrade'}
                    </Text>
                    {plano.preco > 0 && <Ionicons name="arrow-forward" size={16} color="#fff" />}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Texto legal ── */}
        <View style={s.legalWrap}>
          <Ionicons name="information-circle-outline" size={16} color={C.cinza} />
          <Text style={s.legalTxt}>
            Os planos pagos são renovados automaticamente todos os meses.
            Podes cancelar ou alterar o teu plano em qualquer momento nas
            Definições da conta. Os preços e funcionalidades podem ser
            atualizados pela ConnectAll Angola.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },

  // ── Header ──
  header: {
    backgroundColor: C.azul,
    paddingTop: 50,
    paddingBottom: 28,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.azul,
  },
  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(106,17,203,0.35)', // toque roxo no gradiente
  },
  headerLogoBg: {
    position: 'absolute',
    right: -60, top: -40,
    width: 280, height: 280,
    opacity: 0.08,
    tintColor: '#fff',
  },
  closeBtn: {
    position: 'absolute', top: 50, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  headerConteudo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, marginTop: 8 },
  logoCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 40, height: 40 },
  headerTitulo: { fontSize: 24, fontWeight: '800', color: '#fff', lineHeight: 28 },

  // Ícones funcionalidades
  iconesRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  iconeCircle: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  headerFrase: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  headerSubfrase: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  // ── Planos ──
  planosWrap: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  planoCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: C.cinzaClaro,
    position: 'relative',
  },
  planoCardDestaque: {
    borderColor: C.azul,
    borderWidth: 2,
    shadowColor: C.azul,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  planoCardAtual: {
    borderColor: '#19D400',
    backgroundColor: '#F4FFF4',
  },

  // Badges
  badgePopular: {
    position: 'absolute', top: -12, left: 20,
    backgroundColor: C.azul,
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  badgePopularTxt: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  badgeAtual: {
    position: 'absolute', top: -12, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#19D400',
    borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  badgeAtualTxt: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // Plano header
  planoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 8 },
  planoEmoji: { fontSize: 22 },
  planoNome: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // Preço
  precoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  precoValor: { fontSize: 28, fontWeight: '800', color: C.preto },
  precoPeriodo: { fontSize: 14, color: C.cinza, marginBottom: 4 },

  // Descrição
  planoDescricao: { fontSize: 13, color: C.cinza, lineHeight: 19, marginBottom: 16 },

  divisor: { height: 1, backgroundColor: C.cinzaClaro, marginBottom: 16 },

  // Funcionalidades
  funcionalidadesWrap: { gap: 11, marginBottom: 20 },
  funcionalidadeLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  funcionalidadeTxt: { flex: 1, fontSize: 13.5, color: C.preto, lineHeight: 19 },

  // Botões
  btnPlano: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14,
  },
  btnPlanoTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnPlanoAtual: { backgroundColor: '#E8F9E8', borderWidth: 1, borderColor: '#19D400' },
  btnPlanoAtualTxt: { fontSize: 15, fontWeight: '700', color: '#19D400' },

  // Legal
  legalWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 24, paddingTop: 24,
  },
  legalTxt: { flex: 1, fontSize: 12, color: C.cinza, lineHeight: 18 },
});