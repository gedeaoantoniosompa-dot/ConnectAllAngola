import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Image, View } from 'react-native';
import { useUser } from '../../context/UserContext';

function PerfilTabIcon({ color, size, focused }) {
  const { perfil } = useUser();
  if (perfil.fotoURL) {
    return (
      <View style={{
        width: size + 4, height: size + 4, borderRadius: (size + 4) / 2,
        borderWidth: focused ? 2 : 1.5,
        borderColor: focused ? '#1677F2' : '#ABABAB',
        overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      }}>
        <Image
          source={{ uri: perfil.fotoURL }}
          style={{ width: size + 2, height: size + 2, borderRadius: (size + 2) / 2 }}
        />
      </View>
    );
  }
  return <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />;
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1677F2',
        tabBarInactiveTintColor: '#6B6B6B',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#EAEAEA',
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
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
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saber"
        options={{
          title: 'Comunidade',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'globe' : 'globe-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Eventos',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-profile"
        options={{
          title: 'Perfil',
          tabBarIcon: (props) => <PerfilTabIcon {...props} />,
        }}
      />

      {/* Escondidos da tab bar */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="create-post" options={{ href: null }} />
      <Tabs.Screen name="conversa" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="post-comentarios" options={{ href: null }} />
    </Tabs>
  );
}