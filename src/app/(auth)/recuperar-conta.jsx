/**
 * src/app/(auth)/recuperar-conta.jsx
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  azul:         '#0A66C2',
  azulClaro:    '#EEF3FB',
  verde:        '#057642',
  verdeClaro:   '#EAF6EF',
  vermelho:     '#E00000',
  roxo:         '#6A11CB',
  roxoClaro:    '#F3EEFF',
  cinza1:       '#F3F2EE',
  cinza2:       '#E9E5DF',
  cinza3:       '#666360',
  cinza4:       '#1B1B1B',
  branco:       '#FFFFFF',
  preto:        '#000000',
  laranja:      '#D97706',
  laranjaClaro: '#FFFBEB',
};

const PASSOS = [
  {
    id: 'selfie',
    titulo: 'Tira uma selfie',
    descricao: 'Olha diretamente para a câmara frontal, com boa iluminação e o rosto bem visível.',
    icone: 'camera',
    cor: C.azul,
    corClaro: C.azulClaro,
    camera: 'front',
  },
  {
    id: 'bi',
    titulo: 'Fotografa o teu BI',
    descricao: 'Coloca o Bilhete de Identidade numa superfície plana e fotografa a frente do documento.',
    icone: 'credit-card',
    cor: C.roxo,
    corClaro: C.roxoClaro,
    camera: 'back',
  },
  {
    id: 'selfie_bi',
    titulo: 'Selfie a segurar o BI',
    descricao: 'Segura o teu BI ao lado do rosto de forma que ambos estejam visíveis e legíveis.',
    icone: 'user-check',
    cor: C.verde,
    corClaro: C.verdeClaro,
    camera: 'front',
  },
];

function normalizarUri(uri) {
  if (!uri) return uri;
  const limpo = uri.replace(/^file:\/\//, '');
  return `file://${limpo}`;
}

async function converterParaBase64(uri) {
  const base64 = await FileSystem.readAsStringAsync(normalizarUri(uri), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

async function copiarParaCacheEstavel(uriOriginal, passoId) {
  const destino = `${FileSystem.cacheDirectory}foto_${passoId}_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uriOriginal, to: destino });
  const info = await FileSystem.getInfoAsync(destino);
  if (!info.exists || info.size === 0) {
    throw new Error('Ficheiro copiado está vazio ou não existe.');
  }
  return destino;
}

export default function RecuperarContaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email  = params.email || '';

  const [passoActual, setPassoActual]   = useState(0);
  const [fotos, setFotos]               = useState({ selfie: null, bi: null, selfie_bi: null });
  const [carregando, setCarregando]     = useState(false);
  const [resultado, setResultado]       = useState(null);
  const [mensagemErro, setMensagemErro] = useState('');
  const progressAnim                    = useRef(new Animated.Value(0)).current;
  const aProcessarFotoRef               = useRef(false);

  const passo = PASSOS[passoActual];

  const animarProgresso = (index) => {
    Animated.timing(progressAnim, {
      toValue: (index + 1) / PASSOS.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const tirarFoto = async () => {
    if (aProcessarFotoRef.current) return;
    aProcessarFotoRef.current = true;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara para verificar a tua identidade.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        cameraType: passo.camera === 'front'
          ? ImagePicker.CameraType.front
          : ImagePicker.CameraType.back,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        try {
          const destino = await copiarParaCacheEstavel(result.assets[0].uri, passo.id);
          setFotos(prev => ({ ...prev, [passo.id]: destino }));
        } catch (copyErr) {
          Alert.alert('Erro', 'A foto não foi guardada correctamente. Tenta novamente.');
        }
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível aceder à câmara.');
    } finally {
      aProcessarFotoRef.current = false;
    }
  };

  const escolherDaGaleria = async () => {
    if (aProcessarFotoRef.current) return;
    aProcessarFotoRef.current = true;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        try {
          const destino = await copiarParaCacheEstavel(result.assets[0].uri, passo.id);
          setFotos(prev => ({ ...prev, [passo.id]: destino }));
        } catch (copyErr) {
          Alert.alert('Erro', 'A foto não foi carregada correctamente. Tenta novamente.');
        }
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir a galeria.');
    } finally {
      aProcessarFotoRef.current = false;
    }
  };

  const avancar = () => {
    if (!fotos[passo.id]) {
      Alert.alert('Foto necessária', `Por favor, tira a ${passo.titulo.toLowerCase()} antes de continuar.`);
      return;
    }
    if (passoActual < PASSOS.length - 1) {
      const proximo = passoActual + 1;
      setPassoActual(proximo);
      animarProgresso(proximo);
    } else {
      submeter();
    }
  };

  // ── SUBMETER — email de reset feito no servidor, não no cliente ──
  const submeter = async () => {
    if (!fotos.selfie || !fotos.bi || !fotos.selfie_bi) {
      Alert.alert('Fotos em falta', 'Por favor, completa todos os passos.');
      return;
    }
    setCarregando(true);
    setMensagemErro('');
    try {
      const [selfieB64, biB64, selfieBiB64] = await Promise.all([
        converterParaBase64(fotos.selfie),
        converterParaBase64(fotos.bi),
        converterParaBase64(fotos.selfie_bi),
      ]);

      const functions = getFunctions(undefined, 'europe-west1');
      const recuperar = httpsCallable(functions, 'recuperarContaBloqueada', {
        timeout: 120000, // 2 minutos — Rekognition pode demorar
      });

      const resposta = await recuperar({
        email,
        selfie:   selfieB64,
        bi:       biB64,
        selfieBi: selfieBiB64,
      });

      if (resposta.data?.aprovado) {
        // ✅ Email de reset enviado pelo servidor — não precisamos fazer nada aqui
        setResultado('sucesso');
      } else {
        setResultado('erro');
        setMensagemErro(resposta.data?.mensagem || 'Não foi possível verificar a tua identidade.');
      }
    } catch (err) {
      console.error('[Recuperação] Erro:', err);
      setResultado('erro');
      setMensagemErro('Erro ao processar. Verifica a tua ligação e tenta novamente.');
    } finally {
      setCarregando(false);
    }
  };

  // ── Ecrã de sucesso ──
  if (resultado === 'sucesso') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cinza1} />
        <View style={s.resultadoContainer}>
          <View style={[s.resultadoIcone, { backgroundColor: C.verdeClaro }]}>
            <Ionicons name="checkmark-circle" size={64} color={C.verde} />
          </View>
          <Text style={s.resultadoTitulo}>Identidade Verificada!</Text>
          <Text style={s.resultadoDesc}>
            Enviámos um link de redefinição de senha para{'\n'}
            <Text style={{ fontWeight: '700', color: C.azul }}>{email}</Text>
            {'\n\n'}
            Verifica a tua caixa de entrada (incluindo spam). A tua conta será desbloqueada automaticamente após alterares a senha.
          </Text>
          <TouchableOpacity style={s.btnVoltar} onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.btnVoltarTxt}>Voltar ao Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Ecrã de erro ──
  if (resultado === 'erro') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cinza1} />
        <View style={s.resultadoContainer}>
          <View style={[s.resultadoIcone, { backgroundColor: '#FFF5F5' }]}>
            <Ionicons name="close-circle" size={64} color={C.vermelho} />
          </View>
          <Text style={[s.resultadoTitulo, { color: C.vermelho }]}>Verificação Falhada</Text>
          <Text style={s.resultadoDesc}>{mensagemErro}</Text>
          <TouchableOpacity
            style={[s.btnVoltar, { backgroundColor: C.vermelho }]}
            onPress={() => {
              setResultado(null);
              setPassoActual(0);
              setFotos({ selfie: null, bi: null, selfie_bi: null });
              progressAnim.setValue(0);
            }}
          >
            <Text style={s.btnVoltarTxt}>Tentar Novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnVoltarSec} onPress={() => router.back()}>
            <Text style={s.btnVoltarSecTxt}>Voltar ao Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const uriPreview = fotos[passo.id] ? normalizarUri(fotos[passo.id]) : null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cinza1} />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => passoActual > 0 ? setPassoActual(p => p - 1) : router.back()}
          style={s.backBtn}
        >
          <Feather name="arrow-left" size={22} color={C.cinza4} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Recuperar Conta</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.progressoFundo}>
        <Animated.View style={[s.progressoBarra, {
          width: progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['33%', '100%'],
          }),
        }]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
      >
        <View style={s.passosRow}>
          {PASSOS.map((p, i) => (
            <View key={p.id} style={s.passoIndicadorItem}>
              <View style={[
                s.passoCirculo,
                i < passoActual   && { backgroundColor: C.verde,    borderColor: C.verde },
                i === passoActual && { backgroundColor: passo.cor,   borderColor: passo.cor },
                i > passoActual   && { backgroundColor: C.cinza1,   borderColor: C.cinza2 },
              ]}>
                {i < passoActual
                  ? <Ionicons name="checkmark" size={16} color={C.branco} />
                  : <Text style={[s.passoNum, { color: i === passoActual ? C.branco : C.cinza3 }]}>{i + 1}</Text>
                }
              </View>
              {i < PASSOS.length - 1 && (
                <View style={[s.passoLinha, { backgroundColor: i < passoActual ? C.verde : C.cinza2 }]} />
              )}
            </View>
          ))}
        </View>

        <View style={s.cardPasso}>
          <View style={[s.passoIconeGrande, { backgroundColor: passo.corClaro }]}>
            <Feather name={passo.icone} size={36} color={passo.cor} />
          </View>
          <Text style={s.passoTitulo}>{passo.titulo}</Text>
          <Text style={s.passoDescricao}>{passo.descricao}</Text>
        </View>

        <View style={s.areaFoto}>
          {uriPreview ? (
            <View style={s.fotoContainer}>
              <Image
                key={uriPreview}
                source={{ uri: uriPreview }}
                style={s.fotoPreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={s.refazerBtn}
                onPress={() => setFotos(prev => ({ ...prev, [passo.id]: null }))}
              >
                <Feather name="refresh-ccw" size={14} color={C.cinza4} />
                <Text style={s.refazerTxt}>Refazer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.fotoPlaceholder}>
              <Feather name="image" size={48} color={C.cinza2} />
              <Text style={s.fotoPlaceholderTxt}>Nenhuma foto tirada</Text>
            </View>
          )}
        </View>

        <View style={s.botoesCaptura}>
          <TouchableOpacity
            style={[s.btnCaptura, { backgroundColor: passo.cor }]}
            onPress={tirarFoto}
            disabled={carregando}
          >
            <Feather name="camera" size={18} color={C.branco} />
            <Text style={s.btnCapturaTxt}>Usar Câmara</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.btnGaleria}
            onPress={escolherDaGaleria}
            disabled={carregando}
          >
            <Feather name="image" size={18} color={C.cinza4} />
            <Text style={s.btnGaleriaTxt}>Da Galeria</Text>
          </TouchableOpacity>
        </View>

        <View style={s.dicasCard}>
          <View style={s.dicaRow}>
            <Ionicons name="bulb-outline" size={16} color={C.laranja} />
            <Text style={s.dicaTxt}>
              {passo.id === 'selfie'    && 'Certifica-te de ter boa iluminação e o rosto totalmente visível, sem óculos de sol ou chapéu.'}
              {passo.id === 'bi'        && 'Coloca o BI numa superfície plana, sem reflexos. Todos os dados devem estar legíveis.'}
              {passo.id === 'selfie_bi' && 'Segura o BI ao lado do rosto. Ambos devem estar completamente visíveis na mesma foto.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.rodape}>
        <TouchableOpacity
          style={[s.btnAvancar, !fotos[passo.id] && s.btnAvancarDesativado]}
          onPress={avancar}
          disabled={carregando || !fotos[passo.id]}
        >
          {carregando
            ? <ActivityIndicator color={C.branco} />
            : <>
                <Text style={s.btnAvancarTxt}>
                  {passoActual < PASSOS.length - 1 ? 'Continuar' : 'Verificar Identidade'}
                </Text>
                <Feather
                  name={passoActual < PASSOS.length - 1 ? 'arrow-right' : 'shield'}
                  size={18}
                  color={C.branco}
                />
              </>
          }
        </TouchableOpacity>
        <Text style={s.rodapeInfo}>Passo {passoActual + 1} de {PASSOS.length}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: C.cinza1 },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  backBtn:            { padding: 6 },
  headerTitulo:       { fontSize: 17, fontWeight: '700', color: C.preto },
  progressoFundo:     { height: 3, backgroundColor: C.cinza2 },
  progressoBarra:     { height: 3, backgroundColor: C.azul },
  passosRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  passoIndicadorItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  passoCirculo:       { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  passoNum:           { fontSize: 14, fontWeight: '700' },
  passoLinha:         { flex: 1, height: 2, marginHorizontal: 4 },
  cardPasso:          { backgroundColor: C.branco, marginHorizontal: 16, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  passoIconeGrande:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  passoTitulo:        { fontSize: 20, fontWeight: '800', color: C.preto, marginBottom: 8, textAlign: 'center' },
  passoDescricao:     { fontSize: 14, color: C.cinza3, lineHeight: 21, textAlign: 'center' },
  areaFoto:           { marginHorizontal: 16, marginBottom: 16 },
  fotoContainer:      { borderRadius: 12, backgroundColor: C.branco, width: '100%' },
  fotoPreview:        { width: '100%', aspectRatio: 3 / 4, backgroundColor: C.cinza2, borderRadius: 12 },
  refazerBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: C.cinza1, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginTop: 4 },
  refazerTxt:         { fontSize: 13, fontWeight: '600', color: C.cinza4 },
  fotoPlaceholder:    { height: 180, borderRadius: 12, backgroundColor: C.branco, borderWidth: 2, borderColor: C.cinza2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fotoPlaceholderTxt: { fontSize: 13, color: C.cinza3 },
  botoesCaptura:      { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  btnCaptura:         { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 28, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  btnCapturaTxt:      { color: C.branco, fontWeight: '700', fontSize: 14 },
  btnGaleria:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 28, borderWidth: 1.5, borderColor: C.cinza3, backgroundColor: C.branco },
  btnGaleriaTxt:      { color: C.cinza4, fontWeight: '600', fontSize: 14 },
  dicasCard:          { marginHorizontal: 16, backgroundColor: C.laranjaClaro, borderRadius: 12, padding: 14, marginBottom: 16 },
  dicaRow:            { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dicaTxt:            { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },
  rodape:             { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12, backgroundColor: C.branco, borderTopWidth: 0.5, borderTopColor: C.cinza2, gap: 8 },
  btnAvancar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.azul, paddingVertical: 16, borderRadius: 28 },
  btnAvancarDesativado: { backgroundColor: C.cinza2 },
  btnAvancarTxt:      { color: C.branco, fontSize: 16, fontWeight: '700' },
  rodapeInfo:         { textAlign: 'center', fontSize: 12, color: C.cinza3 },
  resultadoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  resultadoIcone:     { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resultadoTitulo:    { fontSize: 24, fontWeight: '800', color: C.verde, textAlign: 'center' },
  resultadoDesc:      { fontSize: 15, color: C.cinza3, lineHeight: 24, textAlign: 'center' },
  btnVoltar:          { backgroundColor: C.azul, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28, marginTop: 8 },
  btnVoltarTxt:       { color: C.branco, fontWeight: '700', fontSize: 15 },
  btnVoltarSec:       { paddingVertical: 12 },
  btnVoltarSecTxt:    { color: C.cinza3, fontSize: 14, fontWeight: '600' },
});