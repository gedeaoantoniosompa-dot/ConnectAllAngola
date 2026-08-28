/**
 * app/(main)/checkout.jsx — ConnectAll Angola
 * Ecrã de checkout para upgrade de plano.
 * Aberto a partir de planos.jsx: router.push({ pathname: '/(main)/checkout', params: { planoId } })
 *
 * Fluxo:
 *  1. Mostra os dados do utilizador extraídos da plataforma (nome, UID, contacto)
 *     — o UID nunca é editável, é a âncora que o admin usa para confirmar o pagamento.
 *  2. Gera uma referência única que o utilizador deve mencionar na transferência.
 *  3. O utilizador escolhe PayPay ou Kwik e vê as instruções de pagamento.
 *  4. Pode anexar o comprovativo (Storage).
 *  5. Ao submeter, grava tudo em `payments` — o painel admin já lê essa colecção.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const C = {
  azul: '#1677F2',
  roxo: '#6A11CB',
  magenta: '#EC4C89',
  verde: '#19D400',
  preto: '#1F1F1F',
  cinza: '#6B6B6B',
  cinzaClaro: '#EAEAEA',
  fundo: '#F8F8F8',
  branco: '#FFFFFF',
};

// Fallback — mesmos valores usados em planos.jsx, caso o Firestore não
// devolva o documento (ex: id não veio de lá, ou ainda não migraste os planos).
const PLANOS_FALLBACK = {
  free:    { id: 'free',    nome: 'CONNECTALL FREE',    emoji: '🆓', preco: 0,    moeda: 'Kz', cor: '#6B6B6B' },
  pro:     { id: 'pro',     nome: 'CONNECTALL PRO',     emoji: '💼', preco: 2500, moeda: 'Kz', cor: '#1677F2' },
  premium: { id: 'premium', nome: 'CONNECTALL PREMIUM', emoji: '👑', preco: 5000, moeda: 'Kz', cor: '#6A11CB' },
};

const PAYPAY_LINK   = 'https://paypayafrica.com/';
const PAYPAY_NUMERO = '949510050';
const KWIK_IBAN      = 'AO06042000000000051847225';
const KWIK_NUMERO    = '949510050';

function gerarReferencia(uid) {
  const sufixoUid = (uid || 'XXXXXX').slice(-6).toUpperCase();
  const sufixoTempo = Date.now().toString().slice(-6);
  return `CA-${sufixoUid}-${sufixoTempo}`;
}

function formatarPreco(valor, moeda) {
  if (!valor) return `0 ${moeda || 'Kz'}`;
  return `${Number(valor).toLocaleString('pt-AO')} ${moeda || 'Kz'}`;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const { planoId } = useLocalSearchParams();

  const [plano, setPlano] = useState(null);
  const [aCarregarPlano, setACarregarPlano] = useState(true);

  const [nomeCompleto, setNomeCompleto] = useState(perfil?.nome || '');
  const [telefone, setTelefone] = useState(perfil?.telefone || '');
  const [email, setEmail] = useState(perfil?.email || user?.email || '');
  const [endereco, setEndereco] = useState(
    [perfil?.municipio, perfil?.provincia].filter(Boolean).join(', ')
  );

  const [referencia] = useState(() => gerarReferencia(user?.uid));
  const [metodo, setMetodo] = useState('paypay'); // 'paypay' | 'kwik'
  const [copiado, setCopiado] = useState(null); // qual campo foi copiado, por breves segundos

  const [comprovativo, setComprovativo] = useState(null); // { nome, uri, mimeType }
  const [aAnexar, setAAnexar] = useState(false);

  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(null);

  // ── Carrega o plano ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!planoId) { setACarregarPlano(false); return; }
      try {
        const snap = await getDoc(doc(db, 'planos', String(planoId)));
        if (!cancelado) {
          if (snap.exists()) {
            setPlano({ id: snap.id, ...snap.data() });
          } else {
            setPlano(PLANOS_FALLBACK[planoId] || null);
          }
        }
      } catch {
        if (!cancelado) setPlano(PLANOS_FALLBACK[planoId] || null);
      } finally {
        if (!cancelado) setACarregarPlano(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, [planoId]);

  // ── Copiar para a área de transferência ─────────────────────────────────
  async function copiar(campo, valor) {
    try {
      await Clipboard.setStringAsync(valor);
      setCopiado(campo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {}
  }

  // ── Anexar comprovativo ──────────────────────────────────────────────────
  async function anexarComprovativo() {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (resultado.canceled) return;
      const ficheiro = resultado.assets[0];
      setComprovativo({ nome: ficheiro.name, uri: ficheiro.uri, mimeType: ficheiro.mimeType });
    } catch {
      Alert.alert('Erro', 'Não foi possível seleccionar o ficheiro.');
    }
  }

  function removerComprovativo() {
    setComprovativo(null);
  }

  // ── Submeter ──────────────────────────────────────────────────────────────
  async function submeter() {
    if (!user?.uid) {
      Alert.alert('Sessão necessária', 'Precisas de ter sessão iniciada para continuar.');
      return;
    }
    if (!nomeCompleto.trim()) {
      Alert.alert('Falta o nome', 'Confirma o teu nome completo antes de continuar.');
      return;
    }
    if (!telefone.trim()) {
      Alert.alert('Falta o contacto', 'Precisamos de um número de telefone para confirmar o pagamento contigo.');
      return;
    }
    if (!plano) {
      Alert.alert('Erro', 'Não foi possível identificar o plano seleccionado.');
      return;
    }

    setAEnviar(true);
    setErro(null);

    try {
      let comprovativoURL = null;

      if (comprovativo) {
        setAAnexar(true);
        const response   = await fetch(comprovativo.uri);
        const blob        = await response.blob();
        const storage     = getStorage();
        const nomeSeguro  = comprovativo.nome.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef  = ref(storage, `comprovativos/${user.uid}/${Date.now()}_${nomeSeguro}`);
        await uploadBytes(storageRef, blob);
        comprovativoURL = await getDownloadURL(storageRef);
        setAAnexar(false);
      }

      await addDoc(collection(db, 'payments'), {
        userId: user.uid,
        utilizadorId: user.uid,
        uidUtilizador: user.uid,
        nomeCompleto: nomeCompleto.trim(),
        telefone: telefone.trim(),
        email: email.trim() || null,
        endereco: endereco.trim() || null,
        planoId: plano.id,
        planoNome: plano.nome,
        valor: plano.preco,
        moeda: plano.moeda || 'Kz',
        metodoPagamento: metodo,
        referencia,
        comprovativoURL,
        estado: 'pendente',
        criadoEm: serverTimestamp(),
      });

      setEnviado(true);
    } catch (e) {
      console.warn('[Checkout] Erro ao submeter:', e);
      setErro('Não foi possível enviar o teu pedido. Verifica a ligação e tenta novamente.');
    } finally {
      setAEnviar(false);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // ECRÃ DE SUCESSO
  // ════════════════════════════════════════════════════════════════════════
  if (enviado) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.sucessoWrap}>
          <View style={s.sucessoIconeWrap}>
            <Ionicons name="checkmark-circle" size={72} color={C.verde} />
          </View>
          <Text style={s.sucessoTitulo}>Pedido enviado</Text>
          <Text style={s.sucessoTexto}>
            A nossa equipa vai confirmar o teu pagamento e activar o plano{' '}
            <Text style={{ fontWeight: '800' }}>{plano?.nome}</Text> assim que possível.
          </Text>

          <View style={s.sucessoRefBox}>
            <Text style={s.sucessoRefLabel}>Guarda a tua referência</Text>
            <Text style={s.sucessoRefValor}>{referencia}</Text>
          </View>

          <TouchableOpacity style={s.btnVoltarSucesso} onPress={() => router.back()}>
            <Text style={s.btnVoltarSucessoTxt}>Voltar aos planos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // ECRÃ PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.voltarBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.preto} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Confirmar pagamento</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Resumo do plano ── */}
        {aCarregarPlano ? (
          <View style={{ paddingVertical: 30 }}>
            <ActivityIndicator color={C.azul} />
          </View>
        ) : !plano ? (
          <View style={s.avisoErro}>
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text style={s.avisoErroTxt}>Não foi possível identificar o plano seleccionado. Volta atrás e tenta novamente.</Text>
          </View>
        ) : (
          <View style={[s.planoResumo, { borderColor: plano.cor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 26 }}>{plano.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.planoResumoNome, { color: plano.cor }]}>{plano.nome}</Text>
                <Text style={s.planoResumoValor}>{formatarPreco(plano.preco, plano.moeda)} / mês</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Dados do utilizador ── */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Os teus dados</Text>
          <Text style={s.secaoSub}>
            Confirma que estão correctos — usamos estes dados para associar o teu pagamento à tua conta.
          </Text>

          <View style={s.campoUidWrap}>
            <Ionicons name="finger-print-outline" size={16} color={C.cinza} />
            <View style={{ flex: 1 }}>
              <Text style={s.campoUidLabel}>ID da conta (UID)</Text>
              <Text style={s.campoUidValor} numberOfLines={1}>{user?.uid || '—'}</Text>
            </View>
            <TouchableOpacity onPress={() => copiar('uid', user?.uid || '')}>
              <Ionicons name={copiado === 'uid' ? 'checkmark' : 'copy-outline'} size={18} color={C.azul} />
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Nome completo</Text>
          <TextInput
            style={s.input}
            value={nomeCompleto}
            onChangeText={setNomeCompleto}
            placeholder="O teu nome completo"
            placeholderTextColor={C.cinza}
          />

          <Text style={s.label}>Telefone de contacto</Text>
          <TextInput
            style={s.input}
            value={telefone}
            onChangeText={setTelefone}
            placeholder="9XX XXX XXX"
            placeholderTextColor={C.cinza}
            keyboardType="phone-pad"
          />

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="opcional"
            placeholderTextColor={C.cinza}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={s.label}>Endereço (província / município)</Text>
          <TextInput
            style={s.input}
            value={endereco}
            onChangeText={setEndereco}
            placeholder="opcional"
            placeholderTextColor={C.cinza}
          />
        </View>

        {/* ── Referência de pagamento ── */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Referência do pagamento</Text>
          <Text style={s.secaoSub}>
            Sempre que possível, indica esta referência na descrição da transferência — ajuda-nos a confirmar mais rápido.
          </Text>
          <View style={s.refBox}>
            <Text style={s.refValor}>{referencia}</Text>
            <TouchableOpacity onPress={() => copiar('referencia', referencia)}>
              <Ionicons name={copiado === 'referencia' ? 'checkmark' : 'copy-outline'} size={18} color={C.azul} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Método de pagamento ── */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Método de pagamento</Text>

          <View style={s.metodoTabs}>
            <TouchableOpacity
              style={[s.metodoTab, metodo === 'paypay' && s.metodoTabActivo]}
              onPress={() => setMetodo('paypay')}
            >
              <Text style={[s.metodoTabTxt, metodo === 'paypay' && s.metodoTabTxtActivo]}>PayPay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.metodoTab, metodo === 'kwik' && s.metodoTabActivo]}
              onPress={() => setMetodo('kwik')}
            >
              <Text style={[s.metodoTabTxt, metodo === 'kwik' && s.metodoTabTxtActivo]}>Kwik (transferência)</Text>
            </TouchableOpacity>
          </View>

          {metodo === 'paypay' ? (
            <View style={s.instrucoesBox}>
              <Text style={s.instrucoesTexto}>
                Envia o valor do plano para o número PayPay abaixo. Usa a referência acima na descrição, se a app permitir.
              </Text>

              <View style={s.dadoLinha}>
                <Text style={s.dadoLabel}>Número PayPay</Text>
                <View style={s.dadoValorWrap}>
                  <Text style={s.dadoValor}>{PAYPAY_NUMERO}</Text>
                  <TouchableOpacity onPress={() => copiar('paypay', PAYPAY_NUMERO)}>
                    <Ionicons name={copiado === 'paypay' ? 'checkmark' : 'copy-outline'} size={16} color={C.azul} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={s.linkInstalarBtn}
                onPress={() => Linking.openURL(PAYPAY_LINK)}
              >
                <Ionicons name="download-outline" size={16} color={C.azul} />
                <Text style={s.linkInstalarTxt}>Não tens a PayPay? Instalar agora</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.instrucoesBox}>
              <Text style={s.instrucoesTexto}>
                Transfere o valor do plano por Kwik para o IBAN abaixo, ou usa o número associado. Usa a referência acima na descrição, se possível.
              </Text>

              <View style={s.dadoLinha}>
                <Text style={s.dadoLabel}>IBAN</Text>
                <View style={s.dadoValorWrap}>
                  <Text style={s.dadoValor} numberOfLines={1}>{KWIK_IBAN}</Text>
                  <TouchableOpacity onPress={() => copiar('iban', KWIK_IBAN)}>
                    <Ionicons name={copiado === 'iban' ? 'checkmark' : 'copy-outline'} size={16} color={C.azul} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.dadoLinha}>
                <Text style={s.dadoLabel}>Número (alternativa)</Text>
                <View style={s.dadoValorWrap}>
                  <Text style={s.dadoValor}>{KWIK_NUMERO}</Text>
                  <TouchableOpacity onPress={() => copiar('kwikNumero', KWIK_NUMERO)}>
                    <Ionicons name={copiado === 'kwikNumero' ? 'checkmark' : 'copy-outline'} size={16} color={C.azul} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Comprovativo ── */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Comprovativo de pagamento</Text>
          <Text style={s.secaoSub}>
            Opcional, mas acelera bastante a confirmação — anexa um print ou PDF do comprovativo assim que pagares.
          </Text>

          {comprovativo ? (
            <View style={s.comprovativoItem}>
              <Ionicons name="document-attach-outline" size={20} color={C.azul} />
              <Text style={s.comprovativoNome} numberOfLines={1}>{comprovativo.nome}</Text>
              <TouchableOpacity onPress={removerComprovativo}>
                <Ionicons name="close-circle" size={20} color={C.cinza} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.anexarBtn} onPress={anexarComprovativo}>
              <Ionicons name="cloud-upload-outline" size={18} color={C.azul} />
              <Text style={s.anexarBtnTxt}>Anexar comprovativo</Text>
            </TouchableOpacity>
          )}
        </View>

        {erro && (
          <View style={s.avisoErro}>
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text style={s.avisoErroTxt}>{erro}</Text>
          </View>
        )}

        {/* ── Legal ── */}
        <View style={s.legalWrap}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.cinza} />
          <Text style={s.legalTxt}>
            A confirmação é feita manualmente pela nossa equipa após verificação do pagamento.
            O teu plano é activado assim que o pagamento for confirmado. Guarda a referência
            acima para qualquer contacto de suporte.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.btnSubmeter, aEnviar && { opacity: 0.6 }]}
          onPress={submeter}
          disabled={aEnviar || aCarregarPlano || !plano}
        >
          {aEnviar ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
              <Text style={s.btnSubmeterTxt}>
                {aAnexar ? 'A enviar comprovativo...' : 'Enviar para confirmação'}
              </Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fundo },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinzaClaro,
  },
  voltarBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 16, fontWeight: '800', color: C.preto },

  planoResumo: {
    margin: 16, marginBottom: 8, backgroundColor: C.branco, borderRadius: 16,
    padding: 16, borderWidth: 1.5,
  },
  planoResumoNome: { fontSize: 15, fontWeight: '800' },
  planoResumoValor: { fontSize: 13, color: C.cinza, marginTop: 2 },

  secao: { marginHorizontal: 16, marginTop: 16, backgroundColor: C.branco, borderRadius: 16, padding: 16 },
  secaoTitulo: { fontSize: 15, fontWeight: '800', color: C.preto, marginBottom: 4 },
  secaoSub: { fontSize: 12.5, color: C.cinza, lineHeight: 18, marginBottom: 14 },

  campoUidWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F5F7FA', borderRadius: 12, padding: 12, marginBottom: 14,
  },
  campoUidLabel: { fontSize: 11, color: C.cinza },
  campoUidValor: { fontSize: 13, fontWeight: '700', color: C.preto, marginTop: 1 },

  label: { fontSize: 12.5, fontWeight: '700', color: C.preto, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F5F7FA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: C.preto, borderWidth: 1, borderColor: C.cinzaClaro,
  },

  refBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1.5, borderColor: C.azul,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  refValor: { fontSize: 16, fontWeight: '800', color: C.azul, letterSpacing: 1 },

  metodoTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metodoTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F5F7FA', borderWidth: 1.5, borderColor: 'transparent',
  },
  metodoTabActivo: { backgroundColor: '#EFF6FF', borderColor: C.azul },
  metodoTabTxt: { fontSize: 13, fontWeight: '700', color: C.cinza },
  metodoTabTxtActivo: { color: C.azul },

  instrucoesBox: { gap: 12 },
  instrucoesTexto: { fontSize: 12.5, color: C.cinza, lineHeight: 18 },
  dadoLinha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F5F7FA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  dadoLabel: { fontSize: 12, color: C.cinza },
  dadoValorWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dadoValor: { fontSize: 13, fontWeight: '700', color: C.preto },
  linkInstalarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  linkInstalarTxt: { fontSize: 12.5, fontWeight: '700', color: C.azul },

  anexarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: C.azul,
    borderStyle: 'dashed', paddingVertical: 14,
  },
  anexarBtnTxt: { fontSize: 13.5, fontWeight: '700', color: C.azul },
  comprovativoItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F5F7FA', borderRadius: 12, padding: 12,
  },
  comprovativoNome: { flex: 1, fontSize: 13, color: C.preto },

  avisoErro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A',
    marginHorizontal: 16, marginTop: 16, padding: 12,
  },
  avisoErroTxt: { flex: 1, fontSize: 12.5, color: '#92400E', lineHeight: 18 },

  legalWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginTop: 18 },
  legalTxt: { flex: 1, fontSize: 11.5, color: C.cinza, lineHeight: 17 },

  btnSubmeter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.azul, borderRadius: 14, paddingVertical: 15,
    marginHorizontal: 16, marginTop: 20,
  },
  btnSubmeterTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Sucesso
  sucessoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 14 },
  sucessoIconeWrap: { marginBottom: 4 },
  sucessoTitulo: { fontSize: 20, fontWeight: '800', color: C.preto },
  sucessoTexto: { fontSize: 14, color: C.cinza, textAlign: 'center', lineHeight: 21 },
  sucessoRefBox: {
    backgroundColor: '#EFF6FF', borderRadius: 14, borderWidth: 1.5, borderColor: C.azul,
    paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', marginTop: 6, width: '100%',
  },
  sucessoRefLabel: { fontSize: 11, color: C.cinza, marginBottom: 4 },
  sucessoRefValor: { fontSize: 18, fontWeight: '800', color: C.azul, letterSpacing: 1 },
  btnVoltarSucesso: {
    marginTop: 10, backgroundColor: C.azul, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14, width: '100%', alignItems: 'center',
  },
  btnVoltarSucessoTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});