/**
 * src/app/(auth)/contactar-suporte.jsx — ConnectAll Angola
 *
 * Ecrã de Suporte: o utilizador escreve a sua situação, escolhe uma
 * categoria e pode anexar um ficheiro (imagem, PDF, documento, etc.).
 * O pedido é gravado na colecção 'suporte' do Firestore, que já é lida
 * em tempo real pelo Painel Admin (secção "Suporte").
 *
 * Estrutura do documento criado em `suporte/{id}`:
 * {
 *   uid, nome, email,                 -> identificação do utilizador
 *   categoria, categoriaLabel,        -> classificação do pedido
 *   mensagem,                         -> texto livre do problema
 *   anexoURL, anexoNome, anexoTipo,   -> ficheiro anexado (opcional)
 *   status: 'pendente',
 *   tipo: 'ticket',
 *   createdAt, timestamp,             -> firestore.FieldValue.serverTimestamp()
 * }
 */

import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { getApp } from 'firebase/app';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
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
  azul:      '#0A66C2',
  azulClaro: '#EEF3FB',
  branco:    '#FFFFFF',
  preto:     '#000000',
  cinza1:    '#F3F2EE',
  cinza2:    '#E9E5DF',
  cinza3:    '#666360',
  cinza4:    '#1B1B1B',
  vermelho:  '#E00000',
  verde:     '#10B981',
};

const CATEGORIAS = [
  { id: 'conta',     label: 'Conta / Login',       icone: 'lock-closed-outline' },
  { id: 'pagamento', label: 'Pagamentos e Planos',  icone: 'card-outline' },
  { id: 'denuncia',  label: 'Denunciar utilizador', icone: 'flag-outline' },
  { id: 'tecnico',   label: 'Problema técnico',     icone: 'bug-outline' },
  { id: 'outro',     label: 'Outro assunto',        icone: 'help-circle-outline' },
];

const TAMANHO_MAX_MB = 10;

export default function ContactarSuporteScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();

  const [categoria, setCategoria] = useState('conta');
  const [mensagem, setMensagem]   = useState('');
  const [anexo, setAnexo]         = useState(null); // { uri, nome, tipo, tamanho }
  const [aEnviar, setAEnviar]     = useState(false);
  const [aAnexar, setAAnexar]     = useState(false);

  const escolherAnexo = async () => {
    try {
      setAAnexar(true);
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/plain', 'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (resultado.canceled) return;

      const ficheiro = resultado.assets?.[0];
      if (!ficheiro) return;

      const tamanhoMB = (ficheiro.size || 0) / (1024 * 1024);
      if (tamanhoMB > TAMANHO_MAX_MB) {
        Alert.alert('Ficheiro demasiado grande', `O anexo não pode exceder ${TAMANHO_MAX_MB}MB.`);
        return;
      }

      setAnexo({
        uri: ficheiro.uri,
        nome: ficheiro.name || 'anexo',
        tipo: ficheiro.mimeType || 'application/octet-stream',
        tamanho: ficheiro.size || 0,
      });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível seleccionar o ficheiro.');
    } finally {
      setAAnexar(false);
    }
  };

  const removerAnexo = () => setAnexo(null);

  const enviarPedido = async () => {
    if (!mensagem.trim()) {
      Alert.alert('Descreve a tua situação', 'Escreve uma mensagem antes de enviar o pedido.');
      return;
    }
    if (!user?.uid) {
      Alert.alert('Sessão expirada', 'Inicia sessão novamente para contactar o suporte.');
      return;
    }

    setAEnviar(true);
    try {
      let anexoURL = null;
      let anexoNome = null;
      let anexoTipo = null;

      if (anexo) {
        const storage = getStorage(getApp());
        const resposta = await fetch(anexo.uri);
        const blob = await resposta.blob();
        const caminho = `suporte/${user.uid}/${Date.now()}_${anexo.nome}`;
        const refFicheiro = ref(storage, caminho);
        await uploadBytes(refFicheiro, blob, { contentType: anexo.tipo });
        anexoURL = await getDownloadURL(refFicheiro);
        anexoNome = anexo.nome;
        anexoTipo = anexo.tipo;
      }

      const categoriaObj = CATEGORIAS.find(c => c.id === categoria);

      await addDoc(collection(db, 'suporte'), {
        uid: user.uid,
        nome: perfil?.nomeEmpresa || perfil?.nome || user?.displayName || 'Utilizador',
        email: user?.email || perfil?.email || '—',
        categoria,
        categoriaLabel: categoriaObj?.label || 'Outro assunto',
        mensagem: mensagem.trim(),
        anexoURL,
        anexoNome,
        anexoTipo,
        status: 'pendente',
        tipo: 'ticket',
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
      });

      Alert.alert(
        'Pedido enviado',
        'Recebemos o teu pedido de suporte. A nossa equipa vai analisar e responder o mais rápido possível.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      console.log('Erro ao enviar suporte:', e);
      Alert.alert('Erro', 'Não foi possível enviar o teu pedido. Tenta novamente.');
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.branco} />

      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={C.preto} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Suporte</Text>
        <View style={s.headerBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.infoBox}>
            <Ionicons name="headset-outline" size={20} color={C.azul} />
            <Text style={s.infoTxt}>
              Descreve a tua situação com o máximo de detalhe possível. A nossa equipa recebe o pedido
              de imediato e responde através das tuas notificações.
            </Text>
          </View>

          <Text style={s.secTitulo}>Categoria</Text>
          <View style={s.categoriasWrap}>
            {CATEGORIAS.map(cat => {
              const activa = cat.id === categoria;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.categoriaChip, activa && s.categoriaChipActiva]}
                  activeOpacity={0.8}
                  onPress={() => setCategoria(cat.id)}
                >
                  <Ionicons name={cat.icone} size={16} color={activa ? C.branco : C.azul} />
                  <Text style={[s.categoriaTxt, activa && s.categoriaTxtActiva]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.secTitulo}>A tua mensagem</Text>
          <TextInput
            style={s.textarea}
            multiline
            numberOfLines={8}
            placeholder="Explica o que aconteceu, quando começou, e qualquer informação que ajude a resolver mais rápido…"
            placeholderTextColor={C.cinza3}
            value={mensagem}
            onChangeText={setMensagem}
            textAlignVertical="top"
          />

          <Text style={s.secTitulo}>Anexo (opcional)</Text>
          {anexo ? (
            <View style={s.anexoCard}>
              <View style={s.anexoIconeWrap}>
                <Feather name="paperclip" size={18} color={C.azul} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.anexoNome} numberOfLines={1}>{anexo.nome}</Text>
                <Text style={s.anexoTamanho}>{(anexo.tamanho / 1024).toFixed(0)} KB</Text>
              </View>
              <TouchableOpacity onPress={removerAnexo} style={s.anexoRemover}>
                <Feather name="x" size={18} color={C.vermelho} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.anexoBtn} onPress={escolherAnexo} disabled={aAnexar} activeOpacity={0.8}>
              {aAnexar ? (
                <ActivityIndicator size="small" color={C.azul} />
              ) : (
                <>
                  <Feather name="paperclip" size={18} color={C.azul} />
                  <Text style={s.anexoBtnTxt}>Anexar imagem, PDF ou documento</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <Text style={s.anexoAjuda}>Tamanho máximo: {TAMANHO_MAX_MB}MB</Text>

          <TouchableOpacity
            style={[s.enviarBtn, (aEnviar || !mensagem.trim()) && s.enviarBtnDesativado]}
            onPress={enviarPedido}
            disabled={aEnviar || !mensagem.trim()}
            activeOpacity={0.85}
          >
            {aEnviar ? (
              <ActivityIndicator size="small" color={C.branco} />
            ) : (
              <>
                <Feather name="send" size={18} color={C.branco} />
                <Text style={s.enviarBtnTxt}>Enviar pedido</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cinza1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  headerBtn: { width: 32, alignItems: 'flex-start' },
  headerTitulo: { fontSize: 18, fontWeight: '800', color: C.preto },

  scroll: { padding: 16, gap: 6 },

  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: C.azulClaro, borderRadius: 12, padding: 14, marginBottom: 10 },
  infoTxt: { flex: 1, fontSize: 12.5, color: C.cinza4, lineHeight: 18 },

  secTitulo: { fontSize: 13, fontWeight: '700', color: C.cinza3, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 14, marginBottom: 8 },

  categoriasWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoriaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.branco, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: C.cinza2 },
  categoriaChipActiva: { backgroundColor: C.azul, borderColor: C.azul },
  categoriaTxt: { fontSize: 12.5, fontWeight: '600', color: C.preto },
  categoriaTxtActiva: { color: C.branco },

  textarea: { backgroundColor: C.branco, borderRadius: 12, padding: 14, fontSize: 14, color: C.preto, minHeight: 150, borderWidth: 1, borderColor: C.cinza2 },

  anexoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.branco, borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.azul },
  anexoBtnTxt: { fontSize: 13.5, fontWeight: '600', color: C.azul },
  anexoAjuda: { fontSize: 11, color: C.cinza3, marginTop: 6 },

  anexoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.branco, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.cinza2 },
  anexoIconeWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.azulClaro, alignItems: 'center', justifyContent: 'center' },
  anexoNome: { fontSize: 13.5, fontWeight: '600', color: C.preto },
  anexoTamanho: { fontSize: 11, color: C.cinza3, marginTop: 2 },
  anexoRemover: { padding: 6 },

  enviarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.azul, borderRadius: 12, paddingVertical: 15, marginTop: 22 },
  enviarBtnDesativado: { backgroundColor: C.cinza3 },
  enviarBtnTxt: { fontSize: 15, fontWeight: '700', color: C.branco },
});