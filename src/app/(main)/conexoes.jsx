/**
 * src/app/(main)/conexoes.jsx — ConnectAll Angola
 * Design estilo LinkedIn — cards com foto de capa + perfil
 */

import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import { useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
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

const { width } = Dimensions.get('window');
const CARD_W    = (width - 36) / 2; // 2 colunas com margem

const C = {
  azul:     '#0A66C2',
  azulSub:  '#EEF3FB',
  verde:    '#057642',
  vermelho: '#CC1016',
  cinza1:   '#F3F2EE',
  cinza2:   '#E9E5DF',
  cinza3:   '#666360',
  cinza4:   '#1B1B1B',
  branco:   '#FFFFFF',
  preto:    '#000000',
};

const ABAS = ['Sugestões', 'Pedidos', 'As minhas conexões', 'Contactos'];

function normalizarTel(tel) {
  if (!tel) return '';
  return tel.replace(/[\s\-\(\)\+]/g, '');
}

function corAvatar(nome) {
  const cores = ['#0A66C2', '#057642', '#7C3AED', '#D97706', '#DC2626', '#0891B2'];
  if (!nome) return cores[0];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffffffff;
  return cores[Math.abs(h) % cores.length];
}

function Avatar({ foto, nome, size = 48, style }) {
  const cor = corAvatar(nome);
  const ini = (nome || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  if (foto) return <Image source={{ uri: foto }} style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: cor, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700' }}>{ini}</Text>
    </View>
  );
}

// ── Card de sugestão (estilo LinkedIn com capa) ──────────────────────────────
function CardSugestao({ item, jaEnviou, emAcao, onConectar, onCancelar, onDispensar, onPress }) {
  return (
    <View style={cs.card}>
      {/* X para dispensar */}
      <TouchableOpacity style={cs.cardX} onPress={onDispensar}>
        <View style={cs.cardXCirculo}>
          <Ionicons name="close" size={14} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Toque no card → perfil público */}
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        {/* Foto de capa */}
        <View style={cs.cardCapa}>
          {item.capaURL
            ? <Image source={{ uri: item.capaURL }} style={cs.cardCapaImg} resizeMode="cover" />
            : <View style={[cs.cardCapaImg, { backgroundColor: corAvatar(item.nome) + '55' }]} />
          }
        </View>

        {/* Avatar sobreposto */}
        <View style={cs.cardAvatarWrap}>
          <Avatar foto={item.fotoURL} nome={item.nome} size={64} style={cs.cardAvatar} />
          {item.verificado && (
            <View style={cs.cardVerifBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={cs.cardInfo}>
          <Text style={cs.cardNome} numberOfLines={2}>{item.nome}</Text>
          {(item.cargo || item.empresa) ? (
            <Text style={cs.cardSub} numberOfLines={2}>{[item.cargo, item.empresa].filter(Boolean).join('\n')}</Text>
          ) : null}
          {item.cidade ? (
            <Text style={cs.cardCidade} numberOfLines={1}>{item.cidade}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Botão conectar */}
      <View style={cs.cardBtnWrap}>
        {jaEnviou ? (
          <TouchableOpacity style={cs.btnEnviado} onPress={onCancelar} disabled={emAcao}>
            {emAcao
              ? <ActivityIndicator size="small" color={C.cinza3} />
              : <Text style={cs.btnEnviadoTxt}>Enviado ✓</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={cs.btnConectar} onPress={onConectar} disabled={emAcao}>
            {emAcao
              ? <ActivityIndicator size="small" color={C.azul} />
              : <>
                  <Ionicons name="person-add-outline" size={14} color={C.azul} />
                  <Text style={cs.btnConectarTxt}>Conectar</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Card de pedido recebido ──────────────────────────────────────────────────
function CardPedido({ item, emAcao, onAceitar, onIgnorar, onPress }) {
  return (
    <View style={cs.card}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        <View style={cs.cardCapa}>
          {item.capaURL
            ? <Image source={{ uri: item.capaURL }} style={cs.cardCapaImg} resizeMode="cover" />
            : <View style={[cs.cardCapaImg, { backgroundColor: corAvatar(item.nome) + '55' }]} />
          }
        </View>
        <View style={cs.cardAvatarWrap}>
          <Avatar foto={item.fotoURL} nome={item.nome} size={64} style={cs.cardAvatar} />
        </View>
        <View style={cs.cardInfo}>
          <Text style={cs.cardNome} numberOfLines={2}>{item.nome}</Text>
          {item.cargo ? (
            <Text style={cs.cardSub} numberOfLines={2}>{item.cargo}</Text>
          ) : null}
          <Text style={[cs.cardCidade, { color: C.azul, fontWeight: '600', marginTop: 4 }]}>
            Quer conectar contigo
          </Text>
        </View>
      </TouchableOpacity>

      {/* Botões aceitar/ignorar */}
      <View style={cs.cardBtnDuplo}>
        <TouchableOpacity style={cs.btnIgnorar} onPress={onIgnorar} disabled={emAcao}>
          {emAcao
            ? <ActivityIndicator size="small" color={C.cinza3} />
            : <Text style={cs.btnIgnorarTxt}>Ignorar</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={cs.btnAceitar} onPress={onAceitar} disabled={emAcao}>
          {emAcao
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={cs.btnAceitarTxt}>Aceitar</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
//  ECRÃ PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function ConexoesScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();

  const [aba,           setAba]           = useState('Sugestões');
  const [pesquisa,      setPesquisa]      = useState('');
  const [carregando,    setCarregando]    = useState(true);
  const [sugestoes,     setSugestoes]     = useState([]);
  const [dispensadas,   setDispensadas]   = useState(new Set());
  const [conexoes,      setConexoes]      = useState([]);
  const [enviados,      setEnviados]      = useState(new Set());
  const [recebidos,     setRecebidos]     = useState([]);
  const [pedEnviados,   setPedEnviados]   = useState([]);
  const [todosContacts, setTodosContacts] = useState([]);
  const [permNegada,    setPermNegada]    = useState(false);
  const [carregCont,    setCarregCont]    = useState(false);
  const [acaoPend,      setAcaoPend]      = useState(new Set());

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    if (user?.uid) {
      carregarSugestoes();
      ouvirConexoes();
    }
  }, [user?.uid]);

  useEffect(() => {
    if (aba === 'Contactos' && todosContacts.length === 0 && !permNegada) {
      carregarContactos();
    }
  }, [aba]);

  // ── Listeners tempo real ────────────────────────────────────────────
  const ouvirConexoes = () => {
    if (!user?.uid) return;

    // Conexões confirmadas
    onSnapshot(
      query(collection(db, 'users', user.uid, 'conexoes'), where('estado', '==', 'confirmado')),
      async (snap) => {
        const lista = [];
        for (const d of snap.docs) {
          try {
            const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', d.id)));
            if (!uSnap.empty) {
              const dados = uSnap.docs[0].data();
              lista.push({
                uid: d.id,
                nome:    dados.nome    || 'Utilizador',
                cargo:   dados.cargo   || dados.tituloProfissional || '',
                empresa: dados.empresa || '',
                fotoURL: dados.fotoURL || null,
                capaURL: dados.capaURL || null,
              });
            }
          } catch (_) {}
        }
        setConexoes(lista);
      }, () => {}
    );

    // Pedidos enviados (pendentes)
    onSnapshot(
      query(collection(db, 'users', user.uid, 'conexoes'), where('estado', '==', 'pendente')),
      async (snap) => {
        setEnviados(new Set(snap.docs.map(d => d.id)));
        const lista = [];
        for (const d of snap.docs) {
          try {
            const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', d.id)));
            if (!uSnap.empty) {
              const dados = uSnap.docs[0].data();
              lista.push({
                uid: d.id,
                nome:    dados.nome    || 'Utilizador',
                cargo:   dados.cargo   || dados.tituloProfissional || '',
                empresa: dados.empresa || '',
                fotoURL: dados.fotoURL || null,
                capaURL: dados.capaURL || null,
              });
            }
          } catch (_) {}
        }
        setPedEnviados(lista);
      }, () => {}
    );

    // Pedidos recebidos
    onSnapshot(
      query(collection(db, 'users', user.uid, 'notificacoes_conexao'), where('estado', '==', 'pendente')),
      async (snap) => {
        const lista = [];
        for (const d of snap.docs) {
          const dados = d.data();
          // Tenta carregar dados completos do utilizador
          try {
            const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', d.id)));
            if (!uSnap.empty) {
              const u = uSnap.docs[0].data();
              lista.push({
                uid:     d.id,
                nome:    u.nome    || dados.nome    || 'Utilizador',
                cargo:   u.cargo   || u.tituloProfissional || '',
                empresa: u.empresa || '',
                fotoURL: u.fotoURL || dados.fotoURL || null,
                capaURL: u.capaURL || null,
              });
            } else {
              lista.push({
                uid:     d.id,
                nome:    dados.nome    || 'Utilizador',
                fotoURL: dados.fotoURL || null,
                capaURL: null,
                cargo:   '',
              });
            }
          } catch (_) {
            lista.push({
              uid:     d.id,
              nome:    dados.nome    || 'Utilizador',
              fotoURL: dados.fotoURL || null,
              capaURL: null,
              cargo:   '',
            });
          }
        }
        setRecebidos(lista);
      }, () => {}
    );
  };

  // ── Sugestões ────────────────────────────────────────────────────────
  const carregarSugestoes = async () => {
    setCarregando(true);
    try {
      const area   = perfil?.area   || '';
      const cidade = perfil?.cidade || '';
      const vistos = new Set([user?.uid]);
      const lista  = [];

      const adicionar = (snap) => {
        snap.docs.forEach(d => {
          if (vistos.has(d.id)) return;
          vistos.add(d.id);
          const dados = d.data();
          lista.push({
            id:        d.id,
            uid:       d.id,
            nome:      dados.nome    || 'Utilizador',
            cargo:     dados.cargo   || dados.tituloProfissional || dados.cargoActual || '',
            empresa:   dados.empresa || dados.empresaActual || '',
            cidade:    dados.cidade  || dados.municipio || dados.provincia || '',
            fotoURL:   dados.fotoURL || null,
            capaURL:   dados.capaURL || null,
            verificado: !!(dados.verificado || dados.isVerified || dados.verificacaoFacialAprovada),
          });
        });
      };

      const qs = [query(collection(db, 'users'), limit(40))];
      if (area)   qs.unshift(query(collection(db, 'users'), where('area',   '==', area),   limit(20)));
      if (cidade) qs.unshift(query(collection(db, 'users'), where('cidade', '==', cidade), limit(20)));

      const resultados = await Promise.all(qs.map(q => getDocs(q)));
      resultados.forEach(adicionar);
      setSugestoes(lista.slice(0, 50));
    } catch (e) {
      console.log('[Sugestões]', e.message);
    } finally {
      setCarregando(false);
    }
  };

  // ── Contactos ─────────────────────────────────────────────────────────
  const carregarContactos = async () => {
    setCarregCont(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') { setPermNegada(true); setCarregCont(false); return; }

      let data = [];
      try {
        const res = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
          pageSize: 500, pageOffset: 0,
        });
        data = res.data || [];
      } catch (_) {}

      const mapa = {};
      data.forEach(c => {
        if (!c.name) return;
        c.phoneNumbers?.forEach(p => {
          const num = normalizarTel(p.number);
          if (num.length >= 9 && !mapa[num]) mapa[num] = c;
        });
      });

      const nums  = Object.keys(mapa);
      const lista = nums.map(num => ({
        id: `tel_${num}`, nome: mapa[num].name,
        telefone: num, fotoLocal: mapa[num].image?.uri || null,
        usaApp: false, uid: null,
      }));
      setTodosContacts(lista);

      const lotes = [];
      for (let i = 0; i < nums.length; i += 10) lotes.push(nums.slice(i, i + 10));
      const encontrados = {};
      for (const lote of lotes) {
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('telefone', 'in', lote)));
          snap.docs.forEach(d => {
            if (d.id === user?.uid) return;
            const dados = d.data();
            const num = normalizarTel(dados.telefone || '');
            encontrados[num] = { uid: d.id, fotoURL: dados.fotoURL, capaURL: dados.capaURL, cargo: dados.cargo || '', empresa: dados.empresa || '' };
          });
        } catch (_) {}
      }

      setTodosContacts(prev => prev.map(c => {
        const f = encontrados[c.telefone];
        return f ? { ...c, usaApp: true, uid: f.uid, fotoURL: f.fotoURL, capaURL: f.capaURL, cargo: f.cargo, empresa: f.empresa } : c;
      }));
    } catch (e) {
      console.log('[Contactos]', e.message);
    } finally {
      setCarregCont(false);
    }
  };

  // ── Acções ────────────────────────────────────────────────────────────
  const setPend = (uid, val) => setAcaoPend(prev => {
    const s = new Set(prev);
    val ? s.add(uid) : s.delete(uid);
    return s;
  });

  const conectar = async (uid, nome) => {
    if (!user?.uid || acaoPend.has(uid)) return;
    setPend(uid, true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'conexoes', uid), {
        uid, conectadoEm: new Date().toISOString(), estado: 'pendente',
      });
      await setDoc(doc(db, 'users', uid, 'notificacoes_conexao', user.uid), {
        uid: user.uid, nome: perfil?.nome || 'Utilizador',
        fotoURL: perfil?.fotoURL || null, estado: 'pendente', data: new Date().toISOString(),
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar o pedido.');
    } finally { setPend(uid, false); }
  };

  const cancelarConexao = async (uid) => {
    if (acaoPend.has(uid)) return;
    Alert.alert('Cancelar pedido', 'Tens a certeza?', [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Cancelar pedido', style: 'destructive',
        onPress: async () => {
          setPend(uid, true);
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'conexoes', uid));
            await deleteDoc(doc(db, 'users', uid, 'notificacoes_conexao', user.uid));
          } catch (_) {} finally { setPend(uid, false); }
        },
      },
    ]);
  };

  const aceitarPedido = async (uid) => {
    if (acaoPend.has(uid)) return;
    setPend(uid, true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'conexoes', uid), { uid, conectadoEm: new Date().toISOString(), estado: 'confirmado' });
      await setDoc(doc(db, 'users', uid, 'conexoes', user.uid), { uid: user.uid, conectadoEm: new Date().toISOString(), estado: 'confirmado' });
      await deleteDoc(doc(db, 'users', user.uid, 'notificacoes_conexao', uid));
    } catch (_) {} finally { setPend(uid, false); }
  };

  const ignorarPedido = async (uid) => {
    if (acaoPend.has(uid)) return;
    setPend(uid, true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notificacoes_conexao', uid));
    } catch (_) {} finally { setPend(uid, false); }
  };

  const removerConexao = async (uid, nome) => {
    Alert.alert('Remover conexão', `Remover ${nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'conexoes', uid));
            await deleteDoc(doc(db, 'users', uid, 'conexoes', user.uid));
          } catch (_) {}
        },
      },
    ]);
  };

  const convidar = (telefone, nome) => {
    const link = 'https://connectallangola.com/download';
    const msg  = `Olá ${nome}! Junta-te a mim na ConnectAll Angola, a nova plataforma de networking profissional feita para conectar pessoas, criar oportunidades e fortalecer comunidades em Angola.

**Gostaria de o convidar a fazer parte desta familia. 🇦🇴**

Vivemos numa era em que as melhores oportunidades surgem através das conexões que construímos. A ConnectAll Angola foi criada para aproximar pessoas, facilitar a partilha de conhecimentos, fortalecer comunidades e abrir portas para novas amizades, parcerias e oportunidades.

Ao juntar-se à plataforma, terá acesso a uma comunidade dinâmica onde poderá conhecer pessoas com interesses semelhantes, participar em grupos, networking, linkUp chat de voz  e expandir a sua rede de contactos de forma simples, segura e inteligente.

**O seu próximo amigo, parceiro de negócio, colaborador ou oportunidade pode estar apenas a uma conexão de distância.**

Faça já parte desta comunidade em crescimento e descubra o poder de estar conectado às pessoas certas.

👉 **Registe-se através do meu convite ou baixe o app na play store ConnectAll Angola e comece hoje a criar conexões que podem transformar o seu futuro.**

**ConnectAll Angola**
*Conectando pessoas. Criando oportunidades. Construindo comunidades.* 🇦🇴✨
: ${link}`;
    const numFormatado = telefone?.startsWith('244') ? telefone : `244${telefone}`;

    // Queremos dar ao utilizador a escolha (WhatsApp vs Mensagem/SMS).
    // Para isso, evitamos canOpenURL (que em iOS pode falhar por whitelist)
    // e tentamos abrir primeiro o WhatsApp; se falhar, abrimos SMS.

    const whatsappUrl = `whatsapp://send?phone=${numFormatado}&text=${encodeURIComponent(msg)}`;
    const smsUrl = `sms:${numFormatado}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`;

    Promise.resolve()
      .then(() => Linking.openURL(whatsappUrl))
      .catch(() => Linking.openURL(smsUrl));
  };

  const filtrar = (arr) => {
    if (!pesquisa.trim()) return arr;
    const p = pesquisa.toLowerCase();
    return arr.filter(u => u.nome?.toLowerCase().includes(p) || u.cargo?.toLowerCase().includes(p));
  };

  const badgePedidos = recebidos.length;

  // ── Render sugestão (grid 2 colunas) ─────────────────────────────────
  const renderSugestao = ({ item }) => {
    if (dispensadas.has(item.uid)) return null;
    return (
      <CardSugestao
        item={item}
        jaEnviou={enviados.has(item.uid)}
        emAcao={acaoPend.has(item.uid)}
        onConectar={() => conectar(item.uid, item.nome)}
        onCancelar={() => cancelarConexao(item.uid)}
        onDispensar={() => setDispensadas(prev => new Set([...prev, item.uid]))}
        onPress={() => router.push({ pathname: '/(main)/perfil-publico', params: { uid: item.uid } })}
      />
    );
  };

  // ── Render item de lista (linha) ──────────────────────────────────────
  const renderConexao = ({ item }) => (
    <View style={s.itemLinha}>
      <TouchableOpacity
        style={s.itemLinhaEsq}
        onPress={() => router.push({ pathname: '/(main)/perfil-publico', params: { uid: item.uid } })}
      >
        <Avatar foto={item.fotoURL} nome={item.nome} size={52} />
        <View style={s.itemLinhaInfo}>
          <Text style={s.itemLinhaNome} numberOfLines={1}>{item.nome}</Text>
          {(item.cargo || item.empresa) ? (
            <Text style={s.itemLinhaSub} numberOfLines={1}>{[item.cargo, item.empresa].filter(Boolean).join(' · ')}</Text>
          ) : null}
          <Text style={[s.itemLinhaSub, { color: C.verde }]}>Conectado ✓</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.btnRemover} onPress={() => removerConexao(item.uid, item.nome)}>
        <Text style={s.btnRemoverTxt}>Remover</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContacto = ({ item }) => {
    const jaEnviou = item.uid && enviados.has(item.uid);
    const em       = item.uid && acaoPend.has(item.uid);
    const foto     = item.fotoURL || item.fotoLocal;
    return (
      <View style={s.itemLinha}>
        <TouchableOpacity
          style={s.itemLinhaEsq}
          activeOpacity={item.usaApp ? 0.8 : 1}
          onPress={() => item.usaApp && item.uid && router.push({ pathname: '/(main)/perfil-publico', params: { uid: item.uid } })}
        >
          <View style={{ position: 'relative' }}>
            <Avatar foto={foto} nome={item.nome} size={52} />
            {item.usaApp && (
              <View style={s.badgeApp}>
                <Ionicons name="checkmark" size={8} color="#fff" />
              </View>
            )}
          </View>
          <View style={s.itemLinhaInfo}>
            <Text style={s.itemLinhaNome} numberOfLines={1}>{item.nome}</Text>
            {item.usaApp && (item.cargo || item.empresa) ? (
              <Text style={s.itemLinhaSub} numberOfLines={1}>{[item.cargo, item.empresa].filter(Boolean).join(' · ')}</Text>
            ) : (
              <Text style={s.itemLinhaSub}>{item.telefone}</Text>
            )}
          </View>
        </TouchableOpacity>
        {item.usaApp && item.uid ? (
          jaEnviou ? (
            <TouchableOpacity style={s.btnEnviado} onPress={() => cancelarConexao(item.uid)} disabled={em}>
              {em ? <ActivityIndicator size="small" color={C.cinza3} /> : <Text style={s.btnEnviadoTxt}>Enviado ✓</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.btnConectarLinha} onPress={() => conectar(item.uid, item.nome)} disabled={em}>
              {em ? <ActivityIndicator size="small" color={C.azul} /> : (
                <><Ionicons name="person-add-outline" size={14} color={C.azul} /><Text style={s.btnConectarLinhaTxt}>Conectar</Text></>
              )}
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity style={s.btnConvidar} onPress={() => convidar(item.telefone, item.nome)}>
            <Ionicons name="share-outline" size={14} color={C.azul} />
            <Text style={s.btnConvidarTxt}>Convidar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.branco} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitulo}>Conexões</Text>
        <TouchableOpacity onPress={() => {
          if (aba === 'Sugestões') carregarSugestoes();
          else if (aba === 'Contactos') carregarContactos();
        }}>
          <Ionicons name="refresh-outline" size={22} color={C.cinza4} />
        </TouchableOpacity>
      </View>

      {/* Pesquisa */}
      <View style={s.pesqWrap}>
        <Ionicons name="search-outline" size={17} color={C.cinza3} />
        <TextInput
          style={s.pesqInput}
          placeholder="Pesquisar..."
          placeholderTextColor={C.cinza3}
          value={pesquisa}
          onChangeText={setPesquisa}
        />
        {pesquisa ? (
          <TouchableOpacity onPress={() => setPesquisa('')}>
            <Ionicons name="close-circle" size={17} color={C.cinza3} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Abas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.abasScroll}
        contentContainerStyle={s.abasContent}
      >
        {ABAS.map(a => (
          <TouchableOpacity
            key={a}
            style={[s.abaBtn, aba === a && s.abaBtnActiva]}
            onPress={() => setAba(a)}
          >
            <Text style={[s.abaTxt, aba === a && s.abaTxtActiva]}>{a}</Text>
            {a === 'Pedidos' && badgePedidos > 0 && (
              <View style={s.abaBadge}>
                <Text style={s.abaBadgeTxt}>{badgePedidos}</Text>
              </View>
            )}
            {aba === a && <View style={s.abaIndicador} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ════ SUGESTÕES — grid 2 colunas ════ */}
      {aba === 'Sugestões' && (
        carregando ? (
          <View style={s.centrado}>
            <ActivityIndicator size="large" color={C.azul} />
            <Text style={s.loadingTxt}>A procurar...</Text>
          </View>
        ) : (
          <Animated.FlatList
            style={{ flex: 1, opacity: fadeAnim }}
            data={filtrar(sugestoes).filter(u => !dispensadas.has(u.uid))}
            keyExtractor={item => item.id}
            renderItem={renderSugestao}
            numColumns={2}
            columnWrapperStyle={s.gridRow}
            contentContainerStyle={s.gridCont}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={() => (
              <View style={s.secHeader}>
                <Text style={s.secHeaderTitulo}>Pessoas que talvez conheças</Text>
                <Text style={s.secHeaderSub}>com base no teu perfil</Text>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={s.centrado}>
                <Ionicons name="people-outline" size={48} color={C.cinza2} />
                <Text style={s.vazioTxt}>Nenhuma sugestão</Text>
              </View>
            )}
          />
        )
      )}

      {/* ════ PEDIDOS — grid 2 colunas ════ */}
      {aba === 'Pedidos' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.gridCont}
          showsVerticalScrollIndicator={false}
        >
          {/* Pedidos recebidos */}
          {recebidos.length > 0 && (
            <>
              <View style={s.secHeader}>
                <Text style={s.secHeaderTitulo}>Pedidos de conexão recebidos</Text>
                <Text style={s.secHeaderSub}>{recebidos.length} pedido{recebidos.length !== 1 ? 's' : ''} pendente{recebidos.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={s.gridManual}>
                {recebidos.map((item, idx) => (
                  <CardPedido
                    key={item.uid}
                    item={item}
                    emAcao={acaoPend.has(item.uid)}
                    onAceitar={() => aceitarPedido(item.uid)}
                    onIgnorar={() => ignorarPedido(item.uid)}
                    onPress={() => router.push({ pathname: '/(main)/perfil-publico', params: { uid: item.uid } })}
                  />
                ))}
              </View>
            </>
          )}

          {/* Pedidos enviados */}
          {pedEnviados.length > 0 && (
            <>
              <View style={[s.secHeader, { marginTop: recebidos.length > 0 ? 8 : 0 }]}>
                <Text style={s.secHeaderTitulo}>Pedidos enviados</Text>
                <Text style={s.secHeaderSub}>{pedEnviados.length} a aguardar resposta</Text>
              </View>
              <View style={s.gridManual}>
                {pedEnviados.map(item => (
                  <CardSugestao
                    key={item.uid}
                    item={item}
                    jaEnviou={true}
                    emAcao={acaoPend.has(item.uid)}
                    onConectar={() => {}}
                    onCancelar={() => cancelarConexao(item.uid)}
                    onDispensar={() => {}}
                    onPress={() => router.push({ pathname: '/(main)/perfil-publico', params: { uid: item.uid } })}
                  />
                ))}
              </View>
            </>
          )}

          {recebidos.length === 0 && pedEnviados.length === 0 && (
            <View style={s.centrado}>
              <Ionicons name="mail-outline" size={48} color={C.cinza2} />
              <Text style={s.vazioTxt}>Sem pedidos pendentes</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ════ AS MINHAS CONEXÕES — lista ════ */}
      {aba === 'As minhas conexões' && (
        <FlatList
          data={filtrar(conexoes)}
          keyExtractor={item => item.uid}
          renderItem={renderConexao}
          contentContainerStyle={s.listaCont}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListHeaderComponent={() => (
            <View style={s.secHeader}>
              <Text style={s.secHeaderTitulo}>As minhas conexões</Text>
              <Text style={s.secHeaderSub}>{conexoes.length} conexão{conexoes.length !== 1 ? 'ões' : ''}</Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={s.centrado}>
              <Ionicons name="people-outline" size={48} color={C.cinza2} />
              <Text style={s.vazioTxt}>Ainda não tens conexões</Text>
              <Text style={s.vazioSub}>Explora as sugestões e começa a conectar</Text>
            </View>
          )}
        />
      )}

      {/* ════ CONTACTOS — lista ════ */}
      {aba === 'Contactos' && (
        carregCont ? (
          <View style={s.centrado}>
            <ActivityIndicator size="large" color={C.azul} />
            <Text style={s.loadingTxt}>A carregar contactos...</Text>
          </View>
        ) : permNegada ? (
          <View style={s.centrado}>
            <Ionicons name="lock-closed-outline" size={40} color={C.cinza3} />
            <Text style={s.vazioTxt}>Permissão necessária</Text>
            <TouchableOpacity style={s.btnPermissao} onPress={() => Linking.openSettings()}>
              <Text style={s.btnPermissaoTxt}>Abrir Definições</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtrar(todosContacts)}
            keyExtractor={item => item.id}
            renderItem={renderContacto}
            contentContainerStyle={s.listaCont}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={s.sep} />}
            ListHeaderComponent={() => (
              <View style={s.secHeader}>
                <Text style={s.secHeaderTitulo}>Os teus contactos</Text>
                <Text style={s.secHeaderSub}>
                  {todosContacts.filter(c => c.usaApp).length} usam ConnectAll · {todosContacts.length} total
                </Text>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={s.centrado}>
                <Ionicons name="people-outline" size={48} color={C.cinza2} />
                <Text style={s.vazioTxt}>Nenhum contacto encontrado</Text>
              </View>
            )}
          />
        )
      )}
    </SafeAreaView>
  );
}

// ── ESTILOS ───────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  // Card (sugestão / pedido)
  card: {
    width: CARD_W,
    backgroundColor: C.branco,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.cinza2,
    marginBottom: 12,
  },
  cardX: {
    position: 'absolute',
    top: 8, right: 8,
    zIndex: 10,
  },
  cardXCirculo: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardCapa: {
    width: '100%', height: 72,
    backgroundColor: C.cinza2,
  },
  cardCapaImg: {
    width: '100%', height: '100%',
  },
  cardAvatarWrap: {
    position: 'absolute',
    top: 36, left: 12,
    zIndex: 5,
  },
  cardAvatar: {
    borderWidth: 3,
    borderColor: C.branco,
  },
  cardVerifBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.azul,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.branco,
  },
  cardInfo: {
    paddingHorizontal: 12,
    paddingTop: 40, // espaço para o avatar
    paddingBottom: 8,
    minHeight: 100,
  },
  cardNome: {
    fontSize: 14, fontWeight: '700', color: C.preto, lineHeight: 19,
  },
  cardSub: {
    fontSize: 12, color: C.cinza3, marginTop: 3, lineHeight: 16,
  },
  cardCidade: {
    fontSize: 11, color: C.cinza3, marginTop: 3,
  },
  cardBtnWrap: {
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4,
  },
  cardBtnDuplo: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4,
  },
  btnConectar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1.5, borderColor: C.azul, borderRadius: 20,
    paddingVertical: 8,
  },
  btnConectarTxt: { fontSize: 13, fontWeight: '700', color: C.azul },
  btnEnviado: {
    borderWidth: 1.5, borderColor: C.cinza2, borderRadius: 20,
    paddingVertical: 8, alignItems: 'center',
  },
  btnEnviadoTxt: { fontSize: 13, fontWeight: '600', color: C.cinza3 },
  btnAceitar: {
    flex: 1, backgroundColor: C.azul, borderRadius: 20,
    paddingVertical: 8, alignItems: 'center',
  },
  btnAceitarTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  btnIgnorar: {
    flex: 1, borderWidth: 1.5, borderColor: C.cinza2,
    borderRadius: 20, paddingVertical: 8, alignItems: 'center',
  },
  btnIgnorarTxt: { fontSize: 12, fontWeight: '600', color: C.cinza3 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cinza1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2,
  },
  headerTitulo: { fontSize: 20, fontWeight: '800', color: C.preto },

  pesqWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.branco, borderRadius: 10,
    borderWidth: 1, borderColor: C.cinza2,
  },
  pesqInput: { flex: 1, fontSize: 14, color: C.preto },

  abasScroll:  { flexGrow: 0, backgroundColor: C.branco, borderBottomWidth: 0.5, borderBottomColor: C.cinza2 },
  abasContent: { paddingHorizontal: 12, gap: 4 },
  abaBtn:      { paddingHorizontal: 14, paddingVertical: 12, position: 'relative', alignItems: 'center', flexDirection: 'row', gap: 6 },
  abaBtnActiva:{},
  abaTxt:      { fontSize: 14, fontWeight: '600', color: C.cinza3 },
  abaTxtActiva:{ color: C.preto },
  abaIndicador:{ position: 'absolute', bottom: 0, left: 8, right: 8, height: 2.5, backgroundColor: C.preto, borderRadius: 2 },
  abaBadge:    { backgroundColor: C.azul, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  abaBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Grid 2 colunas
  gridCont: { paddingHorizontal: 12, paddingBottom: 32 },
  gridRow:  { gap: 12, justifyContent: 'space-between' },
  gridManual: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },

  // Cabeçalho de secção
  secHeader: {
    paddingVertical: 16, paddingHorizontal: 4,
  },
  secHeaderTitulo: { fontSize: 17, fontWeight: '800', color: C.preto },
  secHeaderSub:    { fontSize: 13, color: C.cinza3, marginTop: 2 },

  // Lista (linha)
  listaCont: { paddingBottom: 32 },
  sep: { height: 0.5, backgroundColor: C.cinza2, marginLeft: 80 },

  itemLinha:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.branco, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  itemLinhaEsq:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemLinhaInfo: { flex: 1 },
  itemLinhaNome: { fontSize: 15, fontWeight: '700', color: C.preto },
  itemLinhaSub:  { fontSize: 13, color: C.cinza3, marginTop: 2 },

  btnConectarLinha:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: C.azul, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  btnConectarLinhaTxt: { fontSize: 13, fontWeight: '700', color: C.azul },
  btnEnviado:    { borderWidth: 1.5, borderColor: C.cinza2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  btnEnviadoTxt: { fontSize: 13, fontWeight: '600', color: C.cinza3 },
  btnRemover:    { borderWidth: 1.5, borderColor: C.cinza2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  btnRemoverTxt: { fontSize: 13, fontWeight: '600', color: C.cinza3 },
  btnConvidar:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: C.azul, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.azulSub },
  btnConvidarTxt: { fontSize: 13, fontWeight: '700', color: C.azul },
  badgeApp: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: C.verde, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.branco },

  centrado:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  loadingTxt:      { fontSize: 14, color: C.cinza3 },
  vazioTxt:        { fontSize: 16, fontWeight: '700', color: C.cinza4, textAlign: 'center' },
  vazioSub:        { fontSize: 13, color: C.cinza3, textAlign: 'center' },
  btnPermissao:    { backgroundColor: C.azul, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  btnPermissaoTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});