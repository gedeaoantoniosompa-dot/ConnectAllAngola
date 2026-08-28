/**
 * app/(main)/_layout.jsx — ConnectAll Angola
 *
 * Barra de navegação inferior (5 tabs):
 *   Início | Comunidade | Vagas | Conexões | Notificações | Menu
 *
 * Removidos da barra: Perfil, Live
 * Live passa para dentro do Menu (menu.jsx já tem o acesso)
 * Adicionados: Notificações, Menu
 *
 * NOVO: bolinha vermelha no ícone "Início" quando há mensagens
 * por ler (usa o useUnreadMessages, o mesmo contador do ícone
 * de mensagens dentro do feed).
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

// ── Badge de notificações não lidas ───────────────────────────────────
function NotifIcon({ color, size, focused }) {
  const { user } = useUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'notificacoes', user.uid, 'items'),
      where('lida', '==', false)
    );
    const unsub = onSnapshot(q, snap => {
      // ← Notificações do tipo "mensagem" (ex.: alguém iniciou uma
      //    conversa contigo) não contam aqui — essas já têm o próprio
      //    ícone de mensagens (useUnreadMessages / bolinha do "Início").
      //    Sem este filtro, uma mensagem nova acendia os dois ícones ao
      //    mesmo tempo.
      const naoMensagens = snap.docs.filter(d => d.data()?.tipo !== 'mensagem');
      setCount(naoMensagens.length);
    }, () => {});
    return () => unsub();
  }, [user?.uid]);

  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
      {count > 0 && (
        <View style={{
          position: 'absolute', top: -2, right: -2,
          backgroundColor: '#E00000', borderRadius: 9,
          minWidth: 16, height: 16,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
          borderWidth: 1.5, borderColor: '#fff',
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Ícone "Início" com bolinha de mensagens não lidas ──────────────────
function FeedIcon({ color, size, focused }) {
  const { user } = useUser();
  const { unreadMessagesCount } = useUnreadMessages(user?.uid);

  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
      {unreadMessagesCount > 0 && (
        <View style={{
          position: 'absolute', top: -2, right: -2,
          width: 12, height: 12, borderRadius: 6,
          backgroundColor: '#E00000',
          borderWidth: 1.5, borderColor: '#fff',
        }} />
      )}
    </View>
  );
}

// ── Ícone do Menu (layout-grid 2x2) ─────────────────────────────────
function MenuIcon({ color, size, focused }) {
  const s = focused ? 6 : 5;
  const gap = 3;
  const square = (key) => (
    <View key={key} style={{
      width: s, height: s,
      borderRadius: 1.5,
      backgroundColor: color,
    }} />
  );
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: s * 2 + gap, gap }}>
        {[0, 1, 2, 3].map(i => square(i))}
      </View>
    </View>
  );
}

export default function MainLayout() {
  const { user } = useUser();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const ultimaChamadaRef = useRef(null);

  // ── Listener global de chamadas recebidas ────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'chamadas'),
      where('para', '==', user.uid),
      where('estado', '==', 'a_ligar'),
    );

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) { ultimaChamadaRef.current = null; return; }

      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));

      const chamada = docs[0];
      if (ultimaChamadaRef.current === chamada.id) return;
      ultimaChamadaRef.current = chamada.id;

      router.push({
        pathname: '/(main)/chamada-recebida',
        params: {
          chatId:  chamada.id,
          deUid:   chamada.de,
          deNome:  chamada.deNome  ?? '',
          deFoto:  chamada.deFoto  ?? '',
          tipo:    chamada.tipo,
          channel: chamada.channel ?? chamada.id,
        },
      });
    });

    return () => { unsub(); ultimaChamadaRef.current = null; };
  }, [user?.uid]);

  // Altura base da barra + o espaço extra que o sistema reservar
  // para a barra de navegação/gestos do telemóvel (insets.bottom).
  // Se o aparelho não tiver barra de sistema (insets.bottom === 0),
  // isto mantém-se exactamente como estava antes.
  const alturaBase = 65;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0A66C2',
        tabBarInactiveTintColor: '#6B6B6B',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#EAEAEA',
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          height: alturaBase + insets.bottom,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >

      {/* 1 ── Início ── */}
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Início',
          tabBarIcon: (props) => <FeedIcon {...props} />,
        }}
      />

      {/* 2 ── Comunidade ── */}
      <Tabs.Screen
        name="saber"
        options={{
          title: 'Comunidade',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'globe' : 'globe-outline'} size={size} color={color} />
          ),
        }}
      />

      {/* 3 ── Vagas ── */}
      <Tabs.Screen
        name="events"
        options={{
          title: 'Vagas',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={size} color={color} />
          ),
        }}
      />

      {/* 4 ── Conexões ── */}
      <Tabs.Screen
        name="conexoes"
        options={{
          title: 'Conexões',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />

      {/* 5 ── Notificações ── */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificações',
          tabBarIcon: (props) => <NotifIcon {...props} />,
        }}
      />

      {/* 6 ── Menu ── */}
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: (props) => <MenuIcon {...props} />,
        }}
      />

      {/* ── Ecrãs escondidos da tab bar ── */}
      <Tabs.Screen name="termos-criadores-prestadores-servicos" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="live"                   options={{ href: null }} />
      <Tabs.Screen name="my-profile"             options={{ href: null }} />
      <Tabs.Screen name="planos"                 options={{ href: null }} />
      <Tabs.Screen name="checkout"                options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="my-profile-utilizador"  options={{ href: null }} />
      <Tabs.Screen name="my-profile-recrutador"  options={{ href: null }} />
      <Tabs.Screen name="my-profile-empresa"     options={{ href: null }} />
      <Tabs.Screen name="ReacoesModal"           options={{ href: null }} />
      <Tabs.Screen name="perfil-publico"         options={{ href: null }} />
      <Tabs.Screen name="explore"                options={{ href: null }} />
      <Tabs.Screen name="chat"                   options={{ href: null }} />
      <Tabs.Screen name="create-post"            options={{ href: null }} />
      <Tabs.Screen name="conversa"               options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="encaminhar-mensagem"    options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="post-comentarios"       options={{ href: null }} />
      <Tabs.Screen name="create-story"           options={{ href: null }} />
      <Tabs.Screen name="ver-story"              options={{ href: null }} />
      <Tabs.Screen name="chamada-recebida"       options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="perfil-profissional"    options={{ href: null }} />
      <Tabs.Screen name="sala-entrevista"    options={{ href: null }} />
      <Tabs.Screen name="entrar-sala"    options={{ href: null }} />
       <Tabs.Screen name="criar-vaga"    options={{ href: null }} />
        <Tabs.Screen name="candidatos"    options={{ href: null }} />
        <Tabs.Screen name="completar-perfil-empresa"    options={{ href: null }} />
        <Tabs.Screen name="completar-perfil-recrutador"    options={{ href: null }} />
          <Tabs.Screen name="broadcast"    options={{ href: null }} />
          <Tabs.Screen name="watch/[id]"    options={{ href: null }} />
    </Tabs>
  );
}