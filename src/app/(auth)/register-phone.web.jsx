/**
 * register-phone.web.jsx — ConnectAll Angola
 * Versão WEB — o registo por telefone usa @react-native-firebase/auth
 * (SDK nativo, incompatível com web), por isso este ecrã mostra apenas
 * uma mensagem informativa e direciona para o registo por email.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  azul:      '#0A66C2',
  azulFundo: '#F0F6FF',
  cinza1:    '#F5F5F5',
  cinza3:    '#9E9E9E',
  cinza4:    '#424242',
  preto:     '#0D0D0D',
  branco:    '#FFFFFF',
};

export default function RegisterPhoneWebScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.pagina}>
        <TouchableOpacity style={s.voltar} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.cinza4} />
        </TouchableOpacity>

        <View style={s.centro}>
          <View style={s.iconeWrap}>
            <Ionicons name="phone-portrait-outline" size={32} color={C.azul} />
          </View>

          <Text style={s.titulo}>Disponível apenas na app</Text>
          <Text style={s.sub}>
            O registo por número de telefone (verificação por SMS) só está disponível
            na aplicação móvel ConnectAll Angola, para Android e iOS.
          </Text>

          <TouchableOpacity
            style={s.btn}
            onPress={() => router.replace('/(auth)/register-email')}
            activeOpacity={0.85}
          >
            <Text style={s.btnTxt}>Registar com email em vez disso</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.linkLogin} onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.linkLoginTxt}>
              Já tens conta? <Text style={s.linkLoginDest}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.branco },
  pagina: { flex: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 48 },
  voltar: { width: 38, height: 38, borderRadius: 8, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  iconeWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.azulFundo, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  titulo: { fontSize: 22, fontWeight: '800', color: C.preto, textAlign: 'center', marginBottom: 10 },
  sub:    { fontSize: 15, color: C.cinza3, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btn:    { backgroundColor: C.azul, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16, width: '100%' },
  btnTxt: { fontSize: 16, fontWeight: '700', color: C.branco },
  linkLogin:     { alignItems: 'center', paddingVertical: 6 },
  linkLoginTxt:  { fontSize: 14, color: C.cinza3 },
  linkLoginDest: { color: C.azul, fontWeight: '700' },
});