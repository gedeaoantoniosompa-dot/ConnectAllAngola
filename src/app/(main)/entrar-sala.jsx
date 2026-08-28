/**
 * entrar-sala.jsx — ConnectAll Angola
 * Candidato entra na sala de entrevista com código
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
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

export default function EntrarSalaScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const [codigo,     setCodigo]     = useState('');
  const [carregando, setCarregando] = useState(false);

  const formatarCodigo = (texto) => {
    // Remove tudo que não seja letra ou número
    const limpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Adiciona hífen após CA
    if (limpo.startsWith('CA') && limpo.length > 2) {
      return 'CA-' + limpo.slice(2, 7);
    }
    return limpo.slice(0, 7);
  };

  const entrar = async () => {
    const codigoLimpo = codigo.replace(/\s/g, '').toUpperCase();
    if (codigoLimpo.length < 7) {
      Alert.alert('Código inválido', 'O código deve ter o formato CA-XXXXX.');
      return;
    }

    setCarregando(true);
    try {
      // Procura o código no índice
      const snap = await getDoc(doc(db, 'codigos_sala_index', codigoLimpo));

      if (!snap.exists()) {
        Alert.alert('Código não encontrado', 'Verifica o código e tenta novamente.');
        return;
      }

      const dados = snap.data();

      // Verifica se expirou
      if (dados.expiraEm && new Date(dados.expiraEm) < new Date()) {
        Alert.alert('Código expirado', 'Este código de sala já expirou. Pede um novo ao recrutador.');
        return;
      }

      // Navega para a sala de entrevista
      router.push({
        pathname: '/(main)/sala-entrevista',
        params: {
          salaId:       dados.salaId,
          nomeEmpresa:  dados.nomeEmpresa || 'Entrevista',
          meuNome:      perfil?.nome      || user?.displayName || 'Candidato',
          minhaFoto:    perfil?.fotoURL   || null,
          papel:        'candidato',
        },
      });

    } catch (e) {
      console.warn('[EntrarSala]', e);
      Alert.alert('Erro', 'Não foi possível verificar o código. Tenta novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Entrar na sala</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.corpo}>
          <View style={s.iconeWrap}>
            <Ionicons name="videocam" size={48} color="#1677F2" />
          </View>

          <Text style={s.titulo}>Tens um código de entrevista?</Text>
          <Text style={s.sub}>
            Introduz o código que o recrutador te enviou para entrares directamente na sala.
          </Text>

          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={codigo}
              onChangeText={t => setCodigo(formatarCodigo(t))}
              placeholder="CA-XXXXX"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={entrar}
            />
          </View>

          <Text style={s.dica}>
            Formato: CA-XXXXX · Válido por 24 horas
          </Text>

          <TouchableOpacity
            style={[s.btnEntrar, (codigo.length < 7 || carregando) && s.btnEntrarDesativado]}
            onPress={entrar}
            disabled={codigo.length < 7 || carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={20} color="#fff" />
                <Text style={s.btnEntrarTxt}>Entrar na sala</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#64748B" />
            <Text style={s.infoTxt}>
              Só precisas do código — não precisas de link nem de conta especial para entrar.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0A0F1E' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A2235' },
  btnVoltar:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 16, fontWeight: '700', color: '#fff' },

  corpo: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },

  iconeWrap: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#141929', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1677F2', marginBottom: 8 },

  titulo: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub:    { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 21 },

  inputWrap: { width: '100%', marginTop: 8 },
  input: {
    backgroundColor: '#141929',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1677F2',
    paddingHorizontal: 24,
    paddingVertical: 18,
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },

  dica: { fontSize: 12, color: '#64748B', textAlign: 'center' },

  btnEntrar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1677F2',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  btnEntrarDesativado: { opacity: 0.4 },
  btnEntrarTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#141929', borderRadius: 12, padding: 14, marginTop: 8 },
  infoTxt: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 18 },
});