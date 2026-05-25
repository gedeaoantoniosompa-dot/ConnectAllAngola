import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const TITULOS = {
  contrato: 'Contrato do Utilizador',
  privacidade: 'Política de Privacidade',
  cookies: 'Política de Cookies',
};

const HTML_URL = 'https://raw.githubusercontent.com/gedeaoantoniosompa-dot/ConnectAllAngola/master/assets/docs/politicas-legais.html';

export default function PoliticasScreen() {
  const router = useRouter();
  const { tipo } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F1F1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{TITULOS[tipo] || 'Políticas Legais'}</Text>
        <View style={{ width: 32 }} />
      </View>
      <WebView
        source={{ uri: HTML_URL }}
        style={{ flex: 1 }}
        startInLoadingState
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
});