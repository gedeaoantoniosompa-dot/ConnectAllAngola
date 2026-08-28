// encaminhar-mensagem.jsx — ConnectAll Angola
// Ecrã de "Encaminhar mensagem": mostra as conversas existentes como
// sugestão rápida e permite pesquisar qualquer utilizador pelo nome.
// Ao tocar numa pessoa, a mensagem (texto, imagem, áudio ou ficheiro)
// é encaminhada de imediato para essa conversa, com a flag `encaminhada: true`
// (o conversa.jsx mostra o rótulo "Encaminhada" quando essa flag existe).

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    arrayRemove,
    collection,
    doc,
    getDocs,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

function getChatId(u1, u2) { return [u1, u2].sort().join('_'); }

function resumoMensagem(msg) {
  if (msg.tipo === 'imagem')   return '📷 Imagem';
  if (msg.tipo === 'audio')    return '🎤 Áudio';
  if (msg.tipo === 'ficheiro') return `📎 ${msg.ficheiroNome || 'Ficheiro'}`;
  return msg.texto || '';
}

export default function EncaminharMensagemScreen() {
  const router = useRouter();
  const { mensagem } = useLocalSearchParams();
  const { user, perfil } = useUser();

  const msg = useMemo(() => {
    try { return JSON.parse(mensagem || '{}'); } catch { return {}; }
  }, [mensagem]);

  const [pesquisa,    setPesquisa]    = useState('');
  const [contactos,   setContactos]   = useState([]); // conversas existentes
  const [resultados,  setResultados]  = useState([]); // pesquisa em users
  const [carregando,  setCarregando]  = useState(true);
  const [aPesquisar,  setAPesquisar]  = useState(false);
  const [aEnviarPara, setAEnviarPara] = useState(null);
  const [enviadosPara,setEnviadosPara]= useState([]); // feedback visual temporário (✓ verde), nunca bloqueia reenvio
  const timersRef = useRef({});

  // ── Conversas existentes (sugestão rápida) ──────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'chats'), where('users', 'array-contains', user.uid));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => {
          const data = d.data();
          const outroUid = data.users?.find(uid => uid !== user.uid);
          return {
            uid:  outroUid,
            nome: data.nomes?.[outroUid] || 'Utilizador',
            foto: data.fotos?.[outroUid] || null,
          };
        })
        .filter(c => !!c.uid);
      setContactos(lista);
      setCarregando(false);
    }, () => setCarregando(false));
    return unsub;
  }, [user?.uid]);

  // ── Pesquisa por nome em todos os utilizadores ──────────────────────
  useEffect(() => {
    const termo = pesquisa.trim();
    if (!termo) { setResultados([]); return; }
    let cancelado = false;
    setAPesquisar(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('nome'),
          where('nome', '>=', termo),
          where('nome', '<=', termo + '\uf8ff'),
          limit(20)
        );
        const snap = await getDocs(q);
        if (cancelado) return;
        setResultados(
          snap.docs
            .map(d => ({ uid: d.id, nome: d.data().nome || 'Utilizador', foto: d.data().fotoURL || null }))
            .filter(u => u.uid !== user?.uid)
        );
      } catch (e) {
        console.log('Erro pesquisa utilizadores:', e);
      } finally {
        if (!cancelado) setAPesquisar(false);
      }
    })();
    return () => { cancelado = true; };
  }, [pesquisa, user?.uid]);

  // Junta conversas existentes (filtradas pelo texto) + resultados da pesquisa,
  // sem duplicar a mesma pessoa.
  const lista = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    if (!termo) return contactos;
    const doContactos = contactos.filter(c => c.nome?.toLowerCase().includes(termo));
    const combinados = [...doContactos, ...resultados];
    const vistos = new Set();
    return combinados.filter(u => {
      if (!u.uid || vistos.has(u.uid)) return false;
      vistos.add(u.uid);
      return true;
    });
  }, [pesquisa, contactos, resultados]);

  const encaminharPara = async (destino) => {
    // Só impede um segundo toque NA MESMA pessoa enquanto o pedido anterior
    // ainda está a decorrer — depois disso pode voltar a encaminhar-se
    // para ela, ou para qualquer outra, sem limite nenhum.
    if (!user?.uid || !destino?.uid || aEnviarPara === destino.uid) return;
    setAEnviarPara(destino.uid);
    try {
      const chatIdDestino = getChatId(user.uid, destino.uid);
      const payload = {
        uid: user.uid,
        encaminhada: true,
        timestamp: serverTimestamp(),
        lida: false,
        entregue: false,
      };
      if (msg.tipo === 'imagem') {
        payload.tipo = 'imagem'; payload.imagemURL = msg.imagemURL; payload.texto = '📷 Imagem';
      } else if (msg.tipo === 'audio') {
        payload.tipo = 'audio'; payload.audioURL = msg.audioURL; payload.duracao = msg.duracao || 0; payload.texto = '🎤 Áudio';
      } else if (msg.tipo === 'ficheiro') {
        payload.tipo = 'ficheiro'; payload.ficheiroURL = msg.ficheiroURL; payload.ficheiroNome = msg.ficheiroNome; payload.texto = `📎 ${msg.ficheiroNome || 'Ficheiro'}`;
      } else {
        payload.texto = msg.texto || '';
      }

      await addDoc(collection(db, 'chats', chatIdDestino, 'messages'), payload);
      await setDoc(doc(db, 'chats', chatIdDestino), {
        users: [user.uid, destino.uid],
        ultimaMensagem: resumoMensagem(msg),
        ultimoTimestamp: serverTimestamp(),
        [`nomes.${user.uid}`]: perfil?.nome || 'Utilizador',
        [`nomes.${destino.uid}`]: destino.nome || 'Utilizador',
        [`fotos.${user.uid}`]: perfil?.fotoURL || null,
        [`fotos.${destino.uid}`]: destino.foto || null,
        [`naoLidas.${destino.uid}`]: increment(1),
        ocultoPara: arrayRemove(destino.uid),
      }, { merge: true });

      // Mostra o ✓ verde só como confirmação momentânea; ao fim de 1.5s
      // desaparece sozinho e a pessoa volta a poder ser escolhida.
      setEnviadosPara(prev => prev.includes(destino.uid) ? prev : [...prev, destino.uid]);
      clearTimeout(timersRef.current[destino.uid]);
      timersRef.current[destino.uid] = setTimeout(() => {
        setEnviadosPara(prev => prev.filter(uid => uid !== destino.uid));
        delete timersRef.current[destino.uid];
      }, 1500);
    } catch (e) {
      console.log('Erro ao encaminhar:', e);
      Alert.alert('Erro', 'Não foi possível encaminhar a mensagem.');
    } finally {
      setAEnviarPara(null);
    }
  };

  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="close" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Encaminhar mensagem</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.previewBox}>
        <Ionicons name="arrow-redo-outline" size={14} color="#25D366" />
        <Text style={s.previewTxt} numberOfLines={2}>{resumoMensagem(msg)}</Text>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#ABABAB" style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Pesquisar pessoa..."
          placeholderTextColor="#ABABAB"
          value={pesquisa}
          onChangeText={setPesquisa}
        />
        {aPesquisar ? (
          <ActivityIndicator size="small" color="#ABABAB" />
        ) : pesquisa.length > 0 ? (
          <TouchableOpacity onPress={() => setPesquisa('')}>
            <Ionicons name="close-circle" size={18} color="#ABABAB" />
          </TouchableOpacity>
        ) : null}
      </View>

      {carregando ? (
        <ActivityIndicator color="#25D366" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={u => u.uid}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color="#ABABAB" />
              <Text style={s.emptyTxt}>Nenhum utilizador encontrado.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const jaEnviado = enviadosPara.includes(item.uid); // só feedback visual, não bloqueia
            const aEnviar   = aEnviarPara === item.uid;
            return (
              <TouchableOpacity
                style={s.pessoaItem}
                activeOpacity={0.7}
                disabled={aEnviar}
                onPress={() => encaminharPara(item)}
              >
                {item.foto ? (
                  <Image source={{ uri: item.foto }} style={s.avatarImg} />
                ) : (
                  <View style={s.avatarFallback}><Text style={s.avatarFallbackTxt}>{(item.nome || '?')[0].toUpperCase()}</Text></View>
                )}
                <Text style={s.pessoaNome} numberOfLines={1}>{item.nome}</Text>
                {aEnviar ? (
                  <ActivityIndicator size="small" color="#25D366" />
                ) : jaEnviado ? (
                  <Ionicons name="checkmark-circle" size={22} color="#25D366" />
                ) : (
                  <Ionicons name="arrow-redo-outline" size={20} color="#8696A0" />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  backBtn: { padding: 4 },
  headerTitulo: { fontSize: 16, fontWeight: '800', color: '#111' },
  previewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0F9F1', marginHorizontal: 16, marginTop: 12,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  previewTxt: { flex: 1, fontSize: 13, color: '#333' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F8F8', marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#EAEAEA',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F1F1F' },
  pessoaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  pessoaNome: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyTxt: { fontSize: 13, color: '#ABABAB' },
});