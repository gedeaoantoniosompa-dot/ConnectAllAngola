import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref } from 'firebase/storage';
import { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import { useUpload } from '../../context/UploadContext';
import { useUser } from '../../context/UserContext';


const TIPOS_BASE = [
  { id: 'conquista',    icon: 'trophy-outline',   label: 'Conquista',    cor: '#FBBC05' },
  { id: 'ideia',        icon: 'bulb-outline',      label: 'Ideia',        cor: '#1677F2' },
  { id: 'oportunidade', icon: 'briefcase-outline', label: 'Oportunidade', cor: '#0D9488' },
  { id: 'artigo',       icon: 'newspaper-outline', label: 'Artigo',       cor: '#7C3AED' },
];

async function uploadFicheiroStorage(uri, caminho) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Utilizador não autenticado');

  const bucket = 'connectallangola.firebasestorage.app';
  const caminhoEncoded = encodeURIComponent(caminho);
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${caminhoEncoded}`;

  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const mimeTypes = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    mkv: 'video/x-matroska', webm: 'video/webm',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  const resultado = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Authorization': `Firebase ${token}`, 'Content-Type': mimeType },
  });

  if (resultado.status < 200 || resultado.status >= 300) {
    throw new Error(`Upload falhou com status ${resultado.status}`);
  }

  const storage = getStorage();
  const storageRef = ref(storage, caminho);
  return await getDownloadURL(storageRef);
}

export default function CreatePostScreen() {
  const router   = useRouter();
  const { tipoInicial } = useLocalSearchParams();
  const { user, perfil } = useUser();
  const upload = useUpload();

  // "Oportunidade" agora é publicada através do formulário estruturado
  // (criar-vaga.js), que gera candidaturas geridas e permite selecionar
  // candidatos. Aqui só fica disponível como atalho para lá, e só para
  // contas de recrutador/empresa — outras contas nem veem a opção.
  const ehRecrutadorOuEmpresa = perfil?.tipoPerfil === 'recrutador' || perfil?.tipoPerfil === 'empresa';
  const TIPOS = TIPOS_BASE.filter(t => t.id !== 'oportunidade' || ehRecrutadorOuEmpresa);

  const tipoValido = TIPOS.some(t => t.id === tipoInicial);

  const [texto,        setTexto]        = useState('');
  const [tipoSelected, setTipoSelected] = useState(tipoValido ? tipoInicial : 'conquista');
  const [mediaList,    setMediaList]    = useState([]);

  // Se chegou aqui já a pedir "oportunidade" (ex: link antigo) e é
  // recrutador/empresa, manda direto para o formulário estruturado.
  if (tipoInicial === 'oportunidade' && ehRecrutadorOuEmpresa) {
    router.replace('/(main)/criar-vaga');
    return null;
  }

  // FIX 3: limpa todos os campos
  const limparFormulario = () => {
    setTexto('');
    setTipoSelected('conquista');
    setMediaList([]);
  };

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(main)');
  };

  const selecionarTipo = (tipo) => {
    if (tipo.id === 'oportunidade') {
      // Fecha esta publicação genérica e abre o formulário estruturado de vaga
      router.replace('/(main)/criar-vaga');
      return;
    }
    setTipoSelected(tipo.id);
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.7,
      videoMaxDuration: 3000,
    });
    if (result.canceled) return;

    const novos = result.assets.map(asset => ({
      uri:  String(asset.uri),
      type: asset.type || (String(asset.uri).match(/\.(mp4|mov|avi|mkv|webm)/i) ? 'video' : 'image'),
    }));
    setMediaList(prev => [...prev, ...novos]);
  };

  const removerMedia = (index) => setMediaList(prev => prev.filter((_, i) => i !== index));

  const handlePublicar = async () => {
    if (!texto.trim() && mediaList.length === 0) {
      Alert.alert('Publicação vazia', 'Escreve algo ou adiciona um ficheiro.');
      return;
    }

    // FIX 3: guarda cópias locais antes de limpar
    const textoFinal    = texto.trim();
    const tipoFinal     = tipoSelected;
    const mediaFinal    = [...mediaList];
    const temMedia      = mediaFinal.length > 0;
    const temVideo      = mediaFinal.some(m => m.type === 'video');

    // Limpa o formulário ANTES de fechar para não mostrar conteúdo antigo
    limparFormulario();

    // Fecha o ecrã
    router.back();

    // FIX 2: só inicia banner se tiver media (imagem ou vídeo)
    if (temMedia) {
      upload.iniciar(temVideo ? 'video' : 'imagem');
    } else {
      upload.iniciarTexto();
    }


    // Faz uploads em background
    const urlsMedia = [];
    for (let i = 0; i < mediaFinal.length; i++) {
      const item    = mediaFinal[i];
      const ext     = item.uri.split('.').pop()?.split('?')[0] || 'jpg';
      const caminho = `posts/${user.uid}/${Date.now()}_${i}.${ext}`;
      try {
        const url = await uploadFicheiroStorage(item.uri, caminho);
        urlsMedia.push({ url: String(url), type: item.type });
      } catch (e) {
        console.log('Erro upload ficheiro:', e.message);
      }
      if (temMedia) {
        upload.atualizar(Math.round(((i + 1) / Math.max(mediaFinal.length, 1)) * 90));
      }
    }

    // Publica no Firestore
    if (temMedia) upload.publicando();
    try {
      await addDoc(collection(db, 'posts'), {
        uid:         user.uid,
        autorNome:   perfil.nome    || 'Utilizador',
        autorFoto:   perfil.fotoURL || null,
        autorCargo:  perfil.area    || perfil.cargo || '',
        autorCidade: perfil.cidade  || '',
        texto:       textoFinal,
        mediaUrls:   urlsMedia,
        tipo:        tipoFinal,
        autorVerificado:
          perfil?.verificado === true ||
          perfil?.isVerified === true ||
          perfil?.emailVerificado === true,
        likes:       0,
        comentarios: 0,
        timestamp:   serverTimestamp(),
      });
      if (temMedia) upload.concluir();
    } catch (err) {
      console.log('Erro publicar:', err);
      if (temMedia) upload.erro();
    }
  };

  const tipoAtual = TIPOS.find(t => t.id === tipoSelected) || TIPOS[0];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        <View style={s.header}>
          <TouchableOpacity onPress={handleGoBack} style={s.cancelBtn}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Nova publicação</Text>
          <TouchableOpacity style={s.publicarBtn} onPress={handlePublicar}>
            <Text style={s.publicarText}>Publicar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView>
          <View style={s.autorWrap}>
            <View style={s.avatar}>
              {perfil.fotoURL
                ? <Image source={{ uri: perfil.fotoURL }} style={s.avatarImage} />
                : <Ionicons name="person" size={22} color="#fff" />}
            </View>
            <View>
              <Text style={s.autorNome}>{perfil.nome || 'O teu nome'}</Text>
              <View style={[s.tipoBadge, { backgroundColor: tipoAtual.cor + '20' }]}>
                <Ionicons name={tipoAtual.icon} size={11} color={tipoAtual.cor} />
                <Text style={[s.tipoBadgeText, { color: tipoAtual.cor }]}>{tipoAtual.label}</Text>
              </View>
            </View>
          </View>

          <TextInput
            style={s.input}
            placeholder="Partilha uma conquista, ideia ou artigo..."
            placeholderTextColor="#ABABAB"
            multiline autoFocus
            value={texto}
            onChangeText={setTexto}
            maxLength={1000}
          />

          <View style={s.mediaContainer}>
            {mediaList.length > 0 && (
              <View style={s.mediaGrid}>
                {mediaList.map((item, index) => (
                  <View key={index} style={s.mediaItem}>
                    <Image source={{ uri: String(item.uri) }} style={s.thumb} />
                    {item.type === 'video' && (
                      <View style={s.videoBadge}>
                        <Ionicons name="play" size={10} color="#fff" />
                        <Text style={s.videoBadgeTxt}>Vídeo</Text>
                      </View>
                    )}
                    <TouchableOpacity style={s.removeBtn} onPress={() => removerMedia(index)}>
                      <Ionicons name="close-circle" size={22} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={s.attachBtn} onPress={pickMedia}>
              <Ionicons name="images-outline" size={24} color="#6B6B6B" />
              <Text style={s.attachText}>
                {mediaList.length > 0
                  ? `Adicionar mais ficheiros (${mediaList.length} seleccionado${mediaList.length !== 1 ? 's' : ''})`
                  : 'Adicionar Ficheiros'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.tiposWrap}>
            <Text style={s.tiposLabel}>Tipo de publicação</Text>
            <View style={s.tiposRow}>
              {TIPOS.map(tipo => (
                <TouchableOpacity
                  key={tipo.id}
                  style={[s.tipoChip, tipoSelected === tipo.id && { backgroundColor: tipo.cor, borderColor: tipo.cor }]}
                  onPress={() => selecionarTipo(tipo)}
                >
                  <Ionicons name={tipo.icon} size={14} color={tipoSelected === tipo.id ? '#fff' : tipo.cor} />
                  <Text style={[s.tipoChipText, tipoSelected === tipo.id && { color: '#fff' }]}>{tipo.label}</Text>
                  {tipo.id === 'oportunidade' && (
                    <Ionicons name="arrow-forward" size={12} color={tipoSelected === tipo.id ? '#fff' : tipo.cor} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {ehRecrutadorOuEmpresa && (
              <Text style={s.tiposHint}>Vagas usam um formulário próprio, com requisitos, salário e seleção de candidatos.</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#fff' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA' },
  cancelBtn:     { padding: 4 },
  cancelText:    { fontSize: 15, color: '#6B6B6B', fontWeight: '500' },
  headerTitle:   { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  publicarBtn:   { backgroundColor: '#1677F2', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  publicarText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  autorWrap:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar:        { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage:   { width: 46, height: 46, borderRadius: 23 },
  autorNome:     { fontSize: 15, fontWeight: '700', color: '#1F1F1F', marginBottom: 4 },
  tipoBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  tipoBadgeText: { fontSize: 11, fontWeight: '600' },
  input:         { fontSize: 16, color: '#1F1F1F', paddingHorizontal: 16, minHeight: 100, textAlignVertical: 'top' },
  mediaContainer:{ paddingHorizontal: 16 },
  mediaGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 10 },
  mediaItem:     { width: '30%', aspectRatio: 1, position: 'relative' },
  thumb:         { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#F0F0F0' },
  removeBtn:     { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 12, zIndex: 2 },
  videoBadge:    { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  videoBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  attachBtn:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  attachText:    { color: '#6B6B6B', fontSize: 14 },
  tiposWrap:     { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: '#EAEAEA' },
  tiposLabel:    { fontSize: 12, fontWeight: '600', color: '#6B6B6B', marginBottom: 10 },
  tiposRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#EAEAEA' },
  tipoChipText:  { fontSize: 13, fontWeight: '600', color: '#6B6B6B' },
  tiposHint:     { fontSize: 11, color: '#9A9A9A', marginTop: 10, lineHeight: 15 },
});