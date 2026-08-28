import { Feather, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

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

// ── Detecta tipo pelo URI ─────────────────────────────────────────────────────
function tipoFicheiro(uri) {
  if (!uri) return 'desconhecido';
  const u = uri.toLowerCase().split('?')[0];
  if (u.endsWith('.pdf')) return 'pdf';
  if (u.match(/\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/)) return 'imagem';
  if (u.startsWith('file://') || u.startsWith('content://') || u.startsWith('ph://')) return 'imagem';
  return 'pdf';
}

/**
 * HTML com PDF.js — CORRIGIDO para não trazer o PDF para a memória JS
 * do React Native. Em vez de converter para base64 manualmente (o que
 * causava OutOfMemoryError em PDFs grandes, por criar várias cópias do
 * ficheiro em memória), passamos apenas a URL/caminho do PDF, e o
 * PDF.js dentro do WebView faz o download/leitura e parsing internamente,
 * página a página, sem nunca carregar tudo de uma vez no heap do JS.
 *
 * `fonte` pode ser:
 *  - um URL remoto (https://...)   → PDF.js faz fetch directamente
 *  - um URI local (file://...)     → PDF.js lê via fetch local
 */
function htmlPDFjs(fonte) {
  // Escapa aspas simples para não quebrar a string JS dentro do HTML
  const fonteEscapada = fonte.replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=yes">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; background:#2b2b2b; }
  #loading { position:fixed; top:0; left:0; right:0; bottom:0;
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; color:#aaa; font-family:sans-serif;
    font-size:14px; gap:12px; }
  .spinner { width:36px; height:36px; border:3px solid #444;
    border-top-color:#0A66C2; border-radius:50%;
    animation:spin 0.8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  canvas { display:block; margin:0 auto; max-width:100%; }
  #erro { color:#f66; font-family:sans-serif; font-size:13px;
    text-align:center; padding:32px; }
</style>
</head>
<body>
<div id="loading"><div class="spinner"></div><span>A carregar PDF…</span></div>
<div id="container"></div>
<div id="erro" style="display:none">Não foi possível renderizar o PDF.</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
(function() {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const fonte = '${fonteEscapada}';

  const container = document.getElementById('container');
  const loading   = document.getElementById('loading');
  const erroDiv   = document.getElementById('erro');

  // Passamos a URL/URI directamente — o PDF.js faz o fetch e o parsing
  // internamente em chunks, sem precisarmos de trazer os bytes para o
  // contexto JS do React Native primeiro.
  pdfjsLib.getDocument(fonte).promise.then(function(pdf) {
    loading.style.display = 'none';
    const total = pdf.numPages;

    // Renderiza página a página, libertando cada canvas de uma vez,
    // para manter o uso de memória do WebView controlado mesmo em
    // documentos com muitas páginas.
    const renderPagina = function(num) {
      pdf.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: window.devicePixelRatio || 1.5 });
        const canvas   = document.createElement('canvas');
        canvas.style.marginBottom = '8px';
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width  = '100%';
        container.appendChild(canvas);
        page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise.then(function() {
          if (num < total) renderPagina(num + 1);
        });
      });
    };
    renderPagina(1);
  }).catch(function(err) {
    console.log('PDF.js erro:', err);
    loading.style.display = 'none';
    erroDiv.style.display = 'block';
  });
})();
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook useVisualizador
// ═══════════════════════════════════════════════════════════════════════════════
export function useVisualizador() {
  const [visivel, setVisivel]         = useState(false);
  const [uri, setUri]                 = useState(null);
  const [titulo, setTitulo]           = useState('');
  const [tipo, setTipo]               = useState('imagem');
  const [pdfFonte, setPdfFonte]       = useState(null); // URL/URI a passar ao PDF.js
  const [carregando, setCarregando]   = useState(false);
  const [erroLeitura, setErroLeitura] = useState(false);

  const abrir = async (uriParam, tituloParam = '') => {
    if (!uriParam) return;
    const t = tipoFicheiro(uriParam);
    setUri(uriParam);
    setTitulo(tituloParam);
    setTipo(t);
    setPdfFonte(null);
    setErroLeitura(false);

    if (t === 'pdf') {
      setCarregando(true);
      setVisivel(true);
      try {
        const ehRemoto = uriParam.startsWith('http://') || uriParam.startsWith('https://');

        if (ehRemoto) {
          // ✅ URL remoto — passamos directamente ao PDF.js, que faz o
          // próprio fetch dentro do WebView. Nada passa pela memória JS
          // do React Native.
          setPdfFonte(uriParam);
        } else {
          // ✅ Ficheiro local (file://, content://) — o WebView normalmente
          // não consegue aceder directamente a estes URIs por sandboxing.
          // Copiamos para a pasta de cache da app com um nome previsível,
          // que o WebView (com allowFileAccess) consegue ler como
          // file:// normal, sem qualquer conversão para base64.
          const destino = `${FileSystem.cacheDirectory}preview_${Date.now()}.pdf`;
          await FileSystem.copyAsync({ from: uriParam, to: destino });
          setPdfFonte(destino);
        }
      } catch (e) {
        console.log('Erro ao preparar PDF:', e);
        setErroLeitura(true);
      } finally {
        setCarregando(false);
      }
    } else {
      setVisivel(true);
    }
  };

  const fechar = () => {
    setVisivel(false);
    setPdfFonte(null);
    setUri(null);
    setErroLeitura(false);
  };

  function Visualizador() {
    return (
      <Modal
        visible={visivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fechar}
        statusBarTranslucent
      >
        <View style={vs.container}>
          {/* Header */}
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

          {/* Corpo */}
          <View style={vs.corpo}>
            {carregando ? (
              <View style={vs.centrado}>
                <ActivityIndicator size="large" color={C.azul} />
                <Text style={vs.loadingTxt}>A carregar PDF…</Text>
              </View>

            ) : erroLeitura ? (
              <View style={vs.centrado}>
                <Feather name="alert-circle" size={40} color={C.error} />
                <Text style={vs.erroTxt}>Não foi possível ler o ficheiro.</Text>
                <TouchableOpacity style={vs.erroBtn} onPress={fechar}>
                  <Text style={vs.erroBtnTxt}>Fechar</Text>
                </TouchableOpacity>
              </View>

            ) : tipo === 'pdf' && pdfFonte ? (
              <WebView
                style={vs.webview}
                originWhitelist={['*']}
                source={{ html: htmlPDFjs(pdfFonte) }}
                javaScriptEnabled
                domStorageEnabled
                allowFileAccess
                allowFileAccessFromFileURLs
                allowUniversalAccessFromFileURLs
                mixedContentMode="always"
                scrollEnabled
                showsVerticalScrollIndicator
                startInLoadingState={false}
                onError={(e) => {
                  console.log('WebView erro:', e.nativeEvent);
                  setErroLeitura(true);
                }}
              />

            ) : tipo === 'imagem' && uri ? (
              <Image
                source={{ uri }}
                style={vs.imagem}
                resizeMode="contain"
              />

            ) : (
              <View style={vs.centrado}>
                <ActivityIndicator size="large" color={C.azul} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return { abrir, Visualizador };
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
  const { abrir, Visualizador } = useVisualizador();
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="eye" size={13} color={C.azul} />
              <Text style={ub.verTxt}>Ver</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Visualizador />
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
  webview:      { flex: 1, backgroundColor: '#2b2b2b' },
  imagem:       { width: W, height: H - 100, alignSelf: 'center' },
  centrado:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingTxt:   { fontSize: 14, color: C.cinza3, fontWeight: '500' },
  erroTxt:      { fontSize: 14, color: C.cinza3, textAlign: 'center', paddingHorizontal: 32 },
  erroBtn:      { backgroundColor: C.azul, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  erroBtnTxt:   { fontSize: 14, fontWeight: '700', color: C.branco },
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