import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import {
    ActivityIndicator,
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
import { auth } from '../../config/firebase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const handleEnviar = async () => {
    if (!email.trim()) {
      setErro('Introduz o teu endereço de e-mail.');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setEnviado(true);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        setErro('Não existe conta com este e-mail.');
      } else if (error.code === 'auth/invalid-email') {
        setErro('E-mail inválido.');
      } else {
        setErro('Erro ao enviar. Tenta novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>

            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>

            {!enviado ? (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>Esqueceu a{'\n'}palavra-passe?</Text>
                  <Text style={styles.subtitle}>
                    Introduz o teu e-mail e enviamos um link para redefinires a tua palavra-passe.
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-mail</Text>
                  <View style={[styles.inputWrap, erro ? styles.inputErro : {}]}>
                    <TextInput
                      style={styles.input}
                      placeholder="o_teu_email@gmail.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={(text) => { setEmail(text); setErro(''); }}
                    />
                  </View>
                  {erro ? <Text style={styles.erroText}>{erro}</Text> : null}
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, (loading || !email.trim()) && styles.btnDesactivado]}
                  activeOpacity={0.85}
                  onPress={handleEnviar}
                  disabled={loading || !email.trim()}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnPrimaryText}>Enviar link</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={styles.voltarBtn} onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.voltarText}>
                    Lembrei-me! <Text style={styles.voltarLink}>Entrar</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.sucessoWrap}>
                  <View style={styles.sucessoIcone}>
                    <Text style={styles.sucessoEmoji}>✉️</Text>
                  </View>
                  <Text style={styles.sucessoTitulo}>E-mail enviado!</Text>
                  <Text style={styles.sucessoSubtitulo}>
                    Enviámos um link de recuperação para{'\n'}
                    <Text style={styles.sucessoEmail}>{email.trim().toLowerCase()}</Text>
                    {'\n\n'}Verifica a caixa de entrada e segue as instruções.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  activeOpacity={0.85}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.btnPrimaryText}>Voltar ao login</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.voltarBtn} onPress={() => { setEnviado(false); setEmail(''); }}>
                  <Text style={styles.voltarText}>
                    Não recebeu? <Text style={styles.voltarLink}>Reenviar</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  backIcon: { fontSize: 24, color: '#1F1F1F' },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F1F1F', lineHeight: 36, marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#6B6B6B', lineHeight: 22 },
  inputGroup: { marginBottom: 32 },
  label: { fontSize: 11, fontWeight: '700', color: '#4A5568', letterSpacing: 0.5, marginBottom: 8 },
  inputWrap: {
    borderBottomWidth: 1.5, borderColor: '#E2E8F0',
    paddingVertical: 4,
  },
  inputErro: { borderColor: '#EF4444' },
  input: { fontSize: 15, color: '#1F1F1F', paddingVertical: 10 },
  erroText: { fontSize: 13, color: '#EF4444', marginTop: 6 },
  btnPrimary: {
    backgroundColor: '#1F1F1F', borderRadius: 8,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  btnDesactivado: { backgroundColor: '#E2E8F0' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  voltarBtn: { alignItems: 'center', paddingVertical: 8 },
  voltarText: { fontSize: 14, color: '#6B6B6B' },
  voltarLink: { color: '#1F1F1F', fontWeight: '700', textDecorationLine: 'underline' },
  sucessoWrap: { alignItems: 'center', paddingVertical: 40, marginBottom: 32 },
  sucessoIcone: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F0F7FF', alignItems: 'center',
    justifyContent: 'center', marginBottom: 24,
  },
  sucessoEmoji: { fontSize: 36 },
  sucessoTitulo: { fontSize: 24, fontWeight: '700', color: '#1F1F1F', marginBottom: 16 },
  sucessoSubtitulo: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', lineHeight: 24 },
  sucessoEmail: { fontWeight: '700', color: '#1F1F1F' },
});