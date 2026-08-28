// components/live/LiveComments.jsx
//
// Comentários em tempo real sobrepostos ao vídeo, no estilo TikTok/Instagram
// Live: lista scrollável semi-transparente que cresce para cima + campo para
// enviar um novo comentário. Usado tanto no ecrã do espectador (watch) como
// no ecrã do host (broadcast).

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { enviarComentario, ouvirComentarios } from '../../services/liveInteracoesService';

export default function LiveComments({ liveId, user, corDestaque = '#1677F2' }) {
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const listaRef = useRef(null);

  useEffect(() => {
    if (!liveId) return;
    const unsub = ouvirComentarios(liveId, setComentarios);
    return unsub;
  }, [liveId]);

  async function enviar() {
    const valor = texto.trim();
    if (!valor || aEnviar || !user?.uid) return;
    setTexto('');
    setAEnviar(true);
    try {
      await enviarComentario(liveId, user, valor);
    } catch (e) {
      console.warn('[LiveComments] Erro ao enviar comentário:', e);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrap}
    >
      <View style={styles.listaWrap} pointerEvents="box-none">
        <FlatList
          ref={listaRef}
          data={comentarios}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.bolha}>
              <Text style={styles.linha}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.texto}>  {item.texto}</Text>
              </Text>
            </View>
          )}
          onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escreve um comentário…"
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={enviar}
          returnKeyType="send"
          maxLength={200}
        />
        <TouchableOpacity
          style={[styles.enviarBtn, { backgroundColor: corDestaque, opacity: texto.trim() ? 1 : 0.5 }]}
          onPress={enviar}
          disabled={!texto.trim() || aEnviar}
        >
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  listaWrap: { maxHeight: 190, marginBottom: 8 },
  bolha: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  linha: { flexShrink: 1 },
  nome: { color: '#8ecdf9', fontSize: 13, fontWeight: '700' },
  texto: { color: '#fff', fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
  },
  enviarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});