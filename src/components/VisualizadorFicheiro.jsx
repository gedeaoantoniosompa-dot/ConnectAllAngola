import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  azul:   '#0A66C2',
  verde:  '#057642',
  cinza1: '#F3F2EE',
  cinza2: '#E0DDD8',
  cinza3: '#666360',
  cinza4: '#1B1B1B',
  branco: '#FFFFFF',
  preto:  '#000000',
  error:  '#CC1016',
};

// Chave onde guardamos a pasta que o utilizador escolheu da primeira vez
// que descarregou um documento, para não voltar a perguntar em downloads
// seguintes (só no Android — é o StorageAccessFramework que exige esta
// permissão de pasta).
const CHAVE_PASTA_DOWNLOADS = '_pastaDownloadsEscolhida';
const CANAL_NOTIFICACOES_DOWNLOAD = 'downloads';

// ── Notificações do sistema ────────────────────────────────────────────────
// CORRIGIDO: expo-notifications não suporta notificações agendadas/locais
// na web (scheduleNotificationAsync, dismissNotificationAsync,
// getPermissionsAsync/requestPermissionsAsync e o listener de resposta
// rebentam ou não fazem sentido no browser). Esta flag protege todas essas
// chamadas — na web, o download continua a funcionar normalmente, só sem
// a notificação "A transferir.../Download concluído".
const NOTIFICACOES_SUPORTADAS = Platform.OS !== 'web';

// Mostra sempre a notificação mesmo com a app aberta (por omissão o
// expo-notifications esconde-a nesse caso).
if (NOTIFICACOES_SUPORTADAS) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function garantirPermissaoNotificacoes() {
  if (!NOTIFICACOES_SUPORTADAS) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

async function garantirCanalAndroid() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_NOTIFICACOES_DOWNLOAD, {
    name: 'Downloads',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Wrappers seguros — nunca chamam a API real na web, para nunca lançar
// "is not available on web" independentemente de onde forem chamados.
async function agendarNotificacaoSegura(config) {
  if (!NOTIFICACOES_SUPORTADAS) return;
  try {
    await Notifications.scheduleNotificationAsync(config);
  } catch (e) {
    // silencioso — a notificação é só um extra, nunca deve rebentar o download
  }
}

async function descartarNotificacaoSegura(id) {
  if (!NOTIFICACOES_SUPORTADAS) return;
  await Notifications.dismissNotificationAsync(id).catch(() => {});
}

// Abre o PDF já descarregado. No Android usa o URI content:// devolvido
// pela SAF (funciona directamente com ACTION_VIEW, sem precisar de
// FileProvider). No iOS não há "abrir com" nativo para um ficheiro solto
// — reabre-se o ecrã de partilha, que é como se abre/gere ficheiros lá.
async function abrirPdfDescarregado(dados) {
  if (!dados?.ficheiroUri) return;
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: dados.ficheiroUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/pdf',
      });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir o ficheiro. Podes encontrá-lo na pasta onde foi guardado.');
    }
  } else {
    try {
      const disponivel = await Sharing.isAvailableAsync();
      if (disponivel) await Sharing.shareAsync(dados.ficheiroUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (e) {}
  }
}

// Regista o listener de "toque na notificação" uma única vez para toda a
// app (não por cada componente que usa este ficheiro), para nunca abrir o
// ficheiro em duplicado.
let listenerNotificacaoRegistado = false;
function registarListenerNotificacaoDownload() {
  if (!NOTIFICACOES_SUPORTADAS) return;
  if (listenerNotificacaoRegistado) return;
  listenerNotificacaoRegistado = true;
  Notifications.addNotificationResponseReceivedListener((resposta) => {
    const dados = resposta.notification.request.content.data;
    if (dados?.tipo === 'download-pdf') abrirPdfDescarregado(dados);
  });
}

// ── Detecta tipo pelo URI (rápido, síncrono — usado só para a miniatura) ──────
function tipoFicheiro(uri) {
  if (!uri) return 'desconhecido';
  const u = uri.toLowerCase().split('?')[0];
  if (u.endsWith('.pdf')) return 'pdf';
  if (u.match(/\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/)) return 'imagem';
  if (u.startsWith('file://') || u.startsWith('content://') || u.startsWith('ph://')) return 'imagem';
  return 'pdf';
}

// ── Detecta o tipo REAL do ficheiro (Content-Type do servidor) ────────────────
// A extensão no URI nem sempre é fiável (ex: content:// no Android sem
// extensão nenhuma), por isso confirmamos com um HEAD ao servidor antes de
// decidir se mostramos a pré-visualização de imagem ou disparamos o
// download do PDF.
async function detetarTipoReal(uri) {
  const ehRemoto = uri.startsWith('http://') || uri.startsWith('https://');
  if (!ehRemoto) return tipoFicheiro(uri);
  try {
    const resposta = await fetch(uri, { method: 'HEAD' });
    const contentType = (resposta.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('image/')) return 'imagem';
    if (contentType === 'application/pdf') return 'pdf';
  } catch (e) {
    // Pedido falhou — cai para a extensão como último recurso.
  }
  return tipoFicheiro(uri);
}

// ── Obtém (ou pede) a pasta de destino no Android via SAF ─────────────────────
// Da primeira vez, mostra o seletor de pastas nativo do Android (o
// utilizador deve escolher "Transferências"/"Downloads"). A permissão fica
// persistida (AsyncStorage) e é reutilizada nos downloads seguintes, sem
// voltar a perguntar — a não ser que o utilizador revogue a permissão nas
// definições do telefone, caso em que pedimos de novo automaticamente.
async function obterPastaDestinoAndroid() {
  const guardada = await AsyncStorage.getItem(CHAVE_PASTA_DOWNLOADS);
  if (guardada) {
    try {
      await FileSystem.StorageAccessFramework.readDirectoryAsync(guardada);
      return guardada;
    } catch (e) {
      // Permissão revogada ou pasta removida — pede de novo abaixo.
    }
  }
  const permissao = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissao.granted) return null;
  await AsyncStorage.setItem(CHAVE_PASTA_DOWNLOADS, permissao.directoryUri);
  return permissao.directoryUri;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook useVisualizador
// ═══════════════════════════════════════════════════════════════════════════════
// PDFs já não são mostrados dentro da app — em vez disso, "Baixar" mostra
// uma notificação "A transferir...", descarrega o ficheiro directamente
// para a pasta escolhida pelo utilizador (Android) e abre também o menu
// de partilha; quando termina, a notificação passa a "Download concluído"
// e fica na barra de notificações — tocar nela abre o PDF. Imagens
// continuam a abrir no modal interno. Na web (sem notificações — ver
// NOTIFICACOES_SUPORTADAS), o download acontece na mesma, só sem esse aviso.
export function useVisualizador() {
  const [visivel, setVisivel]         = useState(false);
  const [uri, setUri]                 = useState(null);
  const [titulo, setTitulo]           = useState('');
  const [baixando, setBaixando]       = useState(false);
  // CORRIGIDO (web): tipo do conteúdo actualmente aberto no modal —
  // 'imagem' usa <Image>, 'pdf' usa <iframe> (só existe/faz sentido na
  // web; no telemóvel os PDFs nunca abrem aqui, seguem para baixarPdf).
  const [tipoConteudo, setTipoConteudo] = useState('imagem');

  // Trinco síncrono. O state "baixando" só é reflectido no próximo render,
  // por isso não chega para bloquear cliques repetidos que aconteçam antes
  // desse render — um ref actualiza-se de imediato, sem esperar por
  // nenhum render, e por isso bloqueia mesmo a chamada seguinte que chegue
  // ainda no mesmo ciclo de eventos.
  const aBaixarRef = useRef(false);

  // CORRIGIDO: mesmo princípio do aBaixarRef, mas para abrir() — evita que
  // um duplo toque (comum sobretudo no browser: mousedown+click a disparar
  // dois onPress muito próximos) chame abrir() duas vezes antes do primeiro
  // detetarTipoReal() terminar, o que fazia o modal parecer abrir várias
  // vezes seguidas.
  const aAbrirRef = useRef(false);

  useEffect(() => {
    registarListenerNotificacaoDownload();
  }, []);

  const baixarPdf = async (uriParam, tituloParam = 'documento') => {
    if (aBaixarRef.current) return; // já há um download em curso — ignora
    aBaixarRef.current = true;
    setBaixando(true);

    const nomeLimpo = (tituloParam || 'documento').replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'documento';
    const nomeFicheiro = `${nomeLimpo}.pdf`;
    const idNotificacao = `download-${nomeLimpo}`;

    try {
      await garantirPermissaoNotificacoes();
      await garantirCanalAndroid();

      // ── Notificação de início ──
      await agendarNotificacaoSegura({
        identifier: idNotificacao,
        content: {
          title: 'A transferir…',
          body: nomeFicheiro,
          data: { tipo: 'download-pdf' },
        },
        trigger: null,
      });

      const ehRemoto = uriParam.startsWith('http://') || uriParam.startsWith('https://');
      const cacheDestino = `${FileSystem.cacheDirectory}${nomeFicheiro}`;

      // 1) Garante sempre uma cópia local do ficheiro (remoto → download
      //    nativo; local → cópia com extensão .pdf garantida).
      if (ehRemoto) {
        await FileSystem.downloadAsync(uriParam, cacheDestino);
      } else {
        await FileSystem.copyAsync({ from: uriParam, to: cacheDestino });
      }

      let uriParaAbrirNaNotificacao = cacheDestino;

      if (Platform.OS === 'android') {
        // 2a) Android — grava directamente na pasta escolhida pelo
        //     utilizador (download real) E abre também o menu de
        //     partilha para o mesmo ficheiro.
        const pastaUri = await obterPastaDestinoAndroid();
        if (!pastaUri) {
          await descartarNotificacaoSegura(idNotificacao);
          Alert.alert('Permissão necessária', 'É preciso autorizar o acesso a uma pasta para poder guardar o ficheiro.');
          return;
        }
        const conteudoBase64 = await FileSystem.readAsStringAsync(cacheDestino, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const ficheiroUri = await FileSystem.StorageAccessFramework.createFileAsync(
          pastaUri,
          nomeLimpo,
          'application/pdf'
        );
        await FileSystem.writeAsStringAsync(ficheiroUri, conteudoBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uriParaAbrirNaNotificacao = ficheiroUri; // content:// — o que a notificação vai abrir

        const disponivel = await Sharing.isAvailableAsync();
        if (disponivel) {
          await Sharing.shareAsync(cacheDestino, {
            mimeType: 'application/pdf',
            dialogTitle: tituloParam,
          });
        }
      } else if (Platform.OS === 'web') {
        // 2c) Web — não há SAF nem Sharing nativo; a forma equivalente de
        //     "baixar" no browser é abrir o ficheiro numa nova aba, o que
        //     dispara o download nativo do browser (ou mostra o PDF).
        try {
          if (typeof window !== 'undefined') {
            window.open(cacheDestino, '_blank');
          }
        } catch (e) {}
      } else {
        // 2b) iOS — não existe pasta de downloads pública; o ecrã nativo
        //     de partilha (Guardar em Ficheiros, etc.) é o equivalente.
        const disponivel = await Sharing.isAvailableAsync();
        if (disponivel) {
          await Sharing.shareAsync(cacheDestino, {
            mimeType: 'application/pdf',
            dialogTitle: tituloParam,
            UTI: 'com.adobe.pdf',
          });
        }
      }

      // ── Notificação de conclusão (substitui a de início, mesmo id) ──
      await agendarNotificacaoSegura({
        identifier: idNotificacao,
        content: {
          title: 'Download concluído',
          body: `${nomeFicheiro} — toca para abrir`,
          data: { tipo: 'download-pdf', ficheiroUri: uriParaAbrirNaNotificacao },
        },
        trigger: null,
      });
    } catch (e) {
      console.log('Erro ao baixar PDF:', e?.message || e);
      await descartarNotificacaoSegura(idNotificacao);
      Alert.alert('Erro', 'Não foi possível baixar o ficheiro. Verifica a tua ligação à internet.');
    } finally {
      aBaixarRef.current = false;
      setBaixando(false);
    }
  };

  const abrir = async (uriParam, tituloParam = '') => {
    if (!uriParam) return;
    // CORRIGIDO: bloqueia toques repetidos enquanto ainda estamos a
    // detectar o tipo do ficheiro (ver aAbrirRef acima).
    if (aAbrirRef.current) return;
    aAbrirRef.current = true;

    try {
      const t = await detetarTipoReal(uriParam);

      if (t === 'pdf') {
        // CORRIGIDO: na web não há download real (nem FileSystem.cacheDirectory
        // nem Sharing funcionam como no nativo) — em vez de tentar "baixar",
        // mostra o PDF directamente dentro do modal, num <iframe>, usando o
        // URL original (sem passar por cache/Notifications). No telemóvel
        // mantém-se o fluxo de sempre (download + partilha + notificação).
        if (Platform.OS === 'web') {
          setUri(uriParam);
          setTitulo(tituloParam);
          setTipoConteudo('pdf');
          setVisivel(true);
        } else {
          baixarPdf(uriParam, tituloParam);
        }
        return;
      }

      // Imagem — continua a abrir no modal interno.
      setUri(uriParam);
      setTitulo(tituloParam);
      setTipoConteudo('imagem');
      setVisivel(true);
    } finally {
      aAbrirRef.current = false;
    }
  };

  const fechar = () => {
    setVisivel(false);
    setUri(null);
  };

  // CORRIGIDO: antes disto era `function Visualizador() { return <Modal>...</Modal> }`,
  // devolvido no return abaixo e usado como `<Visualizador />`. Como
  // useVisualizador() corre de novo a cada render, essa função era recriada
  // com uma identidade nova de cada vez — o React interpretava-a como um
  // COMPONENTE DIFERENTE a cada render e desmontava/remontava o Modal
  // inteiro, o que fazia o modal parecer abrir várias vezes com um só
  // toque (um remount por cada setState: setUri, setTitulo, setTipoConteudo,
  // setVisivel). Agora construímos directamente o elemento <Modal>, cujo
  // tipo (importado de 'react-native') É sempre o mesmo entre renders — o
  // React já não desmonta nada, só actualiza as props normalmente.
  const visualizadorNode = (
    <Modal
      visible={visivel}
      transparent={false}
      animationType="slide"
      onRequestClose={fechar}
      statusBarTranslucent
    >
      <View style={vs.container}>
        <View style={vs.header}>
          <TouchableOpacity
            style={vs.fecharBtn}
            onPress={fechar}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={C.branco} />
          </TouchableOpacity>
          <Text style={vs.headerTitulo} numberOfLines={1}>
            {titulo || 'Visualizar'}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={vs.corpo}>
          {uri && tipoConteudo === 'pdf' ? (
            // Só acontece na web (ver `abrir`) — <iframe> é um elemento
            // HTML nativo do browser; o react-native-web deixa-o passar
            // directamente porque a aplicação corre sobre o react-dom.
            <iframe
              src={uri}
              title={titulo || 'Documento PDF'}
              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#525659' }}
            />
          ) : uri ? (
            <Image source={{ uri }} style={vs.imagem} resizeMode="contain" />
          ) : (
            <View style={vs.centrado}>
              <ActivityIndicator size="large" color={C.azul} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return { abrir, Visualizador: visualizadorNode, baixando };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UploadBtnComPreview
// ═══════════════════════════════════════════════════════════════════════════════
export function UploadBtnComPreview({
  uri,
  onPress,
  label  = 'Selecionar ficheiro',
  titulo = 'Documento',
  icone  = 'upload',
  altura = 110,
}) {
  const { abrir, Visualizador, baixando } = useVisualizador();
  const ehPDF = tipoFicheiro(uri) === 'pdf';
  const nomeExibido = uri
    ? uri.split('/').pop().split('?')[0].slice(0, 30) || 'Ficheiro'
    : '';

  return (
    <>
      <View style={{ width: '100%' }}>
        <TouchableOpacity
          style={[ub.btn, uri && ub.btnFeito, { height: altura }]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          {uri ? (
            ehPDF ? (
              <View style={ub.pdfPreview}>
                <View style={ub.pdfIconeBox}>
                  <Feather name="file-text" size={30} color={C.error} />
                </View>
                <Text style={ub.pdfNome} numberOfLines={2}>{nomeExibido}</Text>
                <View style={ub.pdfBadge}>
                  <Text style={ub.pdfBadgeTxt}>PDF</Text>
                </View>
                <View style={ub.overlayIcone}>
                  <Feather name="edit-2" size={12} color={C.branco} />
                </View>
              </View>
            ) : (
              <>
                <Image source={{ uri }} style={ub.preview} resizeMode="cover" />
                <View style={ub.overlayIcone}>
                  <Feather name="edit-2" size={12} color={C.branco} />
                </View>
              </>
            )
          ) : (
            <View style={ub.vazio}>
              <Feather name={icone} size={24} color={C.azul} />
              <Text style={ub.label}>{label}</Text>
            </View>
          )}
        </TouchableOpacity>

        {uri && (
          <View style={ub.badgeRow}>
            <View style={ub.badgeOk}>
              <Ionicons name="checkmark-circle" size={14} color={C.verde} />
              <Text style={ub.badgeOkTxt}>
                {ehPDF ? 'PDF carregado' : 'Imagem carregada'}
              </Text>
            </View>
            <TouchableOpacity
              style={ub.verBtn}
              onPress={() => abrir(uri, titulo)}
              disabled={baixando}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {baixando ? (
                <ActivityIndicator size="small" color={C.azul} />
              ) : (
                <>
                  {/* CORRIGIDO: na web um PDF é visualizado (não descarregado) */}
                  <Feather name={ehPDF && Platform.OS !== 'web' ? 'download' : 'eye'} size={13} color={C.azul} />
                  <Text style={ub.verTxt}>{ehPDF && Platform.OS !== 'web' ? 'Baixar' : 'Ver'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {Visualizador}
    </>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const vs = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1a1a1a' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  fecharBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { flex: 1, fontSize: 15, fontWeight: '700', color: C.branco, textAlign: 'center', marginHorizontal: 8 },
  corpo:        { flex: 1 },
  imagem:       { width: W, height: H - 100, alignSelf: 'center' },
  centrado:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
});

const ub = StyleSheet.create({
  btn:          { width: '100%', borderWidth: 1.5, borderColor: C.cinza2, borderStyle: 'dashed', borderRadius: 10, backgroundColor: C.cinza1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  btnFeito:     { borderStyle: 'solid', borderColor: C.azul },
  preview:      { width: '100%', height: '100%', borderRadius: 9 },
  pdfPreview:   { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, backgroundColor: '#FFF5F5' },
  pdfIconeBox:  { width: 48, height: 48, borderRadius: 10, backgroundColor: '#FFE4E4', alignItems: 'center', justifyContent: 'center' },
  pdfNome:      { fontSize: 11, color: C.cinza4, fontWeight: '600', textAlign: 'center', maxWidth: '90%' },
  pdfBadge:     { backgroundColor: C.error, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  pdfBadgeTxt:  { fontSize: 10, fontWeight: '800', color: C.branco, letterSpacing: 0.5 },
  overlayIcone: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(10,102,194,0.85)', borderRadius: 6, padding: 5 },
  vazio:        { alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  label:        { fontSize: 12, color: C.azul, fontWeight: '600', textAlign: 'center' },
  badgeRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
  badgeOk:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeOkTxt:   { fontSize: 12, color: C.verde, fontWeight: '600' },
  verBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF4FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  verTxt:       { fontSize: 12, color: C.azul, fontWeight: '700' },
});