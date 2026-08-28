/**
 * register-phone.jsx — ConnectAll Angola
 * Phone Auth via @react-native-firebase/auth (Sintaxe Modular V22+)
 * SMS reais, sem reCAPTCHA, Play Integrity automático
 * Requer: build EAS + SHA-1/SHA-256 no Firebase Console
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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

// Importa os métodos individuais conforme o padrão V22+
import { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';
import { db } from '../../config/firebase';

// Inicializa a instância do Auth
const auth = getAuth();

// SOLUÇÃO DO RECAPTCHA: Força o desvio do reCAPTCHA em ambiente de desenvolvimento para números de teste
if (__DEV__) {
  auth.settings.setAutoRetrievedSmsCodeForPhoneNumberSetting = true;
}

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  azul:      '#0A66C2',
  azulFundo: '#F0F6FF',
  cinza1:    '#F5F5F5',
  cinza2:    '#E0E0E0',
  cinza3:    '#9E9E9E',
  cinza4:    '#424242',
  preto:     '#0D0D0D',
  branco:    '#FFFFFF',
  verde:     '#057642',
};

// ─── Tradução de erros ─────────────────────────────────────────────────────
function traduzErro(code) {
  const mapa = {
    'auth/invalid-phone-number':   'Número de telefone inválido.',
    'auth/too-many-requests':      'Demasiadas tentativas. Aguarda alguns minutos.',
    'auth/quota-exceeded':         'Limite de SMS atingido. Tenta mais tarde.',
    'auth/missing-phone-number':   'Número em falta.',
    'auth/network-request-failed': 'Sem ligação. Verifica a internet.',
    'auth/captcha-check-failed':   'Verificação falhou. Garante que o SHA-1 e SHA-256 estão no Firebase Console.',
    'auth/missing-app-credential': 'SHA-1/SHA-256 em falta no Firebase Console.',
    'auth/app-not-authorized':     'App não autorizada. Verifica a configuração do Firebase.',
    'auth/invalid-verification-code': 'Código incorreto. Verifica o SMS.',
    'auth/code-expired':              'Código expirado. Pede um novo.',
    'auth/session-expired':           'Sessão expirada. Pede um novo código.',
    'auth/invalid-verification-id':   'Sessão inválida. Recomeça o processo.',
  };
  return mapa[code] || `Erro: ${code || 'desconhecido'}`;
}

// ─── Caixa de dígito OTP ───────────────────────────────────────────────────
function DigitoBox({ valor, activo, preenchido }) {
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activo) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(blink, { toValue: 0, duration: 480, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 480, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    blink.setValue(1);
  }, [activo]);

  return (
    <View style={[dg.box, preenchido && dg.boxFilled, activo && dg.boxActive]}>
      {valor
        ? <Text style={dg.digit}>{valor}</Text>
        : activo
          ? <Animated.View style={[dg.cursor, { opacity: blink }]} />
          : null}
    </View>
  );
}

const dg = StyleSheet.create({
  box:       { width: 46, height: 56, borderRadius: 8, borderWidth: 1.5, borderColor: C.cinza2, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: C.azul, backgroundColor: C.azulFundo },
  boxFilled: { borderColor: C.azul, backgroundColor: C.azulFundo },
  digit:     { fontSize: 22, fontWeight: '700', color: C.preto },
  cursor:    { width: 2, height: 22, backgroundColor: C.azul, borderRadius: 1 },
});

// ═══════════════════════════════════════════════════════════════════════════
export default function RegisterPhoneScreen() {
  const router = useRouter();
  const { tipoPerfil: tipoParam } = useLocalSearchParams();
  const tipoPerfil = tipoParam || 'utilizador';

  const [etapa,       setEtapa]       = useState('telefone');
  const [telefone,    setTelefone]    = useState('');
  const [codigo,      setCodigo]      = useState('');
  const [confirmacao, setConfirmacao] = useState(null); 
  const [loading,     setLoading]     = useState(false);
  const [countdown,   setCountdown]   = useState(0);

  const inputRef = useRef(null);
  const fade     = useRef(new Animated.Value(1)).current;

  const transitar = (novaEtapa) => {
    Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setEtapa(novaEtapa);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (etapa === 'codigo') setTimeout(() => inputRef.current?.focus(), 350);
  }, [etapa]);

  const numLimpo = telefone.replace(/\D/g, '');

  const formatar = (t) => {
    const n = t.replace(/\D/g, '').slice(0, 9);
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0,3)} ${n.slice(3)}`;
    return `${n.slice(0,3)} ${n.slice(3,6)} ${n.slice(6)}`;
  };

  // ── ENVIO DO SMS ──────────────────────────────────────────────────────────
  const enviarSms = async () => {
    if (numLimpo.length < 9) {
      Alert.alert('Número incompleto', 'Introduz os 9 dígitos do teu número.');
      return;
    }
    setLoading(true);
    try {
      const resultado = await signInWithPhoneNumber(auth, `+244${numLimpo}`);
      setConfirmacao(resultado);
      setCodigo('');
      setCountdown(60);
      transitar('codigo');
    } catch (e) {
      console.log('[enviarSms]', e.code, e.message);
      Alert.alert('Erro ao enviar SMS', traduzErro(e.code));
    } finally {
      setLoading(false);
    }
  };

  // ── CONFIRMAÇÃO OTP ───────────────────────────────────────────────────────
  const confirmar = async () => {
    if (codigo.length !== 6) return;
    if (!confirmacao) {
      Alert.alert('Sessão expirada', 'Solicita um novo código.');
      backToPhone();
      return;
    }
    setLoading(true);
    try {
      const resultado = await confirmacao.confirm(codigo);
      const uid    = resultado.user.uid;
      const isNovo = resultado.additionalUserInfo?.isNewUser ?? false;

      if (isNovo) {
        await setDoc(doc(db, 'users', uid), {
          uid,
          telefone:       `+244${numLimpo}`,
          tipoPerfil,
          perfilActivo:   tipoPerfil,
          perfilCompleto: false,
          dataCriacao:    serverTimestamp(),
        }, { merge: true });

        if (tipoPerfil === 'recrutador')   router.replace('/(auth)/profile-recrutador');
        else if (tipoPerfil === 'empresa') router.replace('/(auth)/profile-empresa');
        else                               router.replace('/(auth)/profile');
      } else {
        router.replace('/(main)/feed');
      }
    } catch (e) {
      console.log('[confirmar]', e.code, e.message);
      Alert.alert('Código inválido', traduzErro(e.code));

      if (['auth/code-expired','auth/session-expired','auth/invalid-verification-id'].includes(e.code)) {
        setCodigo('');
        backToPhone();
      }
    } finally {
      setLoading(false);
    }
  };

  const backToPhone = () => {
    setCodigo('');
    setConfirmacao(null);
    setCountdown(0);
    transitar('telefone');
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ETAPA 1 — NÚMERO DE TELEFONE
  // ═══════════════════════════════════════════════════════════════════════
  if (etapa === 'telefone') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View style={[s.pagina, { opacity: fade }]}>

              <TouchableOpacity style={s.voltar} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={20} color={C.cinza4} />
              </TouchableOpacity>

              <View style={s.marca}>
                <Text style={s.marcaNome}>ConnectAll</Text>
              </View>

              <View style={s.cabecalho}>
                <Text style={s.titulo}>Entra com o teu número</Text>
                <Text style={s.sub}>
                  Vamos enviar um código de 6 dígitos por SMS para confirmar a tua identidade.
                </Text>
              </View>

              <View style={s.campoWrap}>
                <View style={[s.campo, numLimpo.length === 9 && s.campoOk]}>
                  <View style={s.prefixoWrap}>
                    <Text style={s.bandeira}>🇦🇴</Text>
                    <Text style={s.prefixo}>+244</Text>
                  </View>
                  <View style={s.divisor} />
                  <TextInput
                    style={s.campoInput}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor={C.cinza3}
                    keyboardType="phone-pad"
                    maxLength={11}
                    value={formatar(telefone)}
                    onChangeText={t => setTelefone(t.replace(/\D/g, ''))}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={enviarSms}
                  />
                  {numLimpo.length === 9 && (
                    <Ionicons name="checkmark-circle" size={20} color={C.verde} style={s.campoIcone} />
                  )}
                </View>
                <Text style={s.dica}>Unitel · Movicel · AFRICELL</Text>
              </View>

              <View style={s.aviso}>
                <Ionicons name="lock-closed-outline" size={13} color={C.cinza3} />
                <Text style={s.avisoTxt}>
                  O teu número é usado apenas para verificação. Nunca é partilhado com terceiros.
                </Text>
              </View>

              <TouchableOpacity
                style={[s.btn, (numLimpo.length < 9 || loading) && s.btnOff]}
                onPress={enviarSms}
                disabled={numLimpo.length < 9 || loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={C.branco} size="small" />
                  : <Text style={s.btnTxt}>Receber código por SMS</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.linkLogin} onPress={() => router.replace('/(auth)/login')}>
                <Text style={s.linkLoginTxt}>
                  Já tens conta? <Text style={s.linkLoginDest}>Entrar com email</Text>
                </Text>
              </TouchableOpacity>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ETAPA 2 — CÓDIGO OTP
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.branco} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[s.pagina, { opacity: fade }]}>

            <TouchableOpacity style={s.voltar} onPress={backToPhone}>
              <Ionicons name="arrow-back" size={20} color={C.cinza4} />
            </TouchableOpacity>

            <View style={s.marca}>
              <Text style={s.marcaNome}>ConnectAll</Text>
            </View>

            <View style={s.cabecalho}>
              <Text style={s.titulo}>Verifica o teu número</Text>
              <Text style={s.sub}>
                Código enviado para{' '}
                <Text style={{ fontWeight: '700', color: C.preto }}>+244 {formatar(telefone)}</Text>
              </Text>
              <TouchableOpacity onPress={backToPhone} style={{ marginTop: 4 }}>
                <Text style={s.alterarNum}>Alterar número</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.otpRow} activeOpacity={1} onPress={() => inputRef.current?.focus()}>
              {[0,1,2,3,4,5].map(i => (
                <DigitoBox
                  key={i}
                  valor={codigo[i] || ''}
                  activo={codigo.length === i && !loading}
                  preenchido={codigo.length > i}
                />
              ))}
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={s.inputOculto}
              value={codigo}
              onChangeText={c => {
                const v = c.replace(/\D/g, '').slice(0, 6);
                setCodigo(v);
                if (v.length === 6) setTimeout(confirmar, 120);
              }}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
            />

            <View style={s.barra}>
              <View style={[s.barraFill, { width: `${(codigo.length / 6) * 100}%` }]} />
            </View>
            <Text style={s.barraTxt}>{codigo.length} / 6 dígitos</Text>

            <TouchableOpacity
              style={[s.btn, (codigo.length !== 6 || loading) && s.btnOff, { marginTop: 8 }]}
              onPress={confirmar}
              disabled={codigo.length !== 6 || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={C.branco} size="small" />
                : <Text style={s.btnTxt}>Confirmar e entrar</Text>}
            </TouchableOpacity>

            <View style={s.reenvioWrap}>
              {countdown > 0 ? (
                <Text style={s.reenvioEspera}>
                  Reenviar em <Text style={{ color: C.azul, fontWeight: '700' }}>{countdown}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={enviarSms} style={s.reenvioBtn}>
                  <Ionicons name="refresh-outline" size={14} color={C.azul} />
                  <Text style={s.reenvioTxt}>Não recebi o código — Reenviar</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.nota}>
              <Ionicons name="information-circle-outline" size={14} color={C.cinza3} />
              <Text style={s.notaTxt}>
                O código é válido durante 5 minutos. Verifica a pasta de spam se não receberes o SMS.
              </Text>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.branco },
  pagina: { flex: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 48 },
  voltar: { width: 38, height: 38, borderRadius: 8, backgroundColor: C.cinza1, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  marca:      { marginBottom: 32 },
  marcaNome: { fontSize: 22, fontWeight: '800', color: C.preto, letterSpacing: -0.5 },
  cabecalho:  { marginBottom: 36 },
  titulo:     { fontSize: 26, fontWeight: '800', color: C.preto, letterSpacing: -0.5, lineHeight: 32, marginBottom: 10 },
  sub:        { fontSize: 15, color: C.cinza3, lineHeight: 22 },
  alterarNum: { fontSize: 13, color: C.azul, fontWeight: '600', marginTop: 6 },
  campoWrap: { marginBottom: 14 },
  campo:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.cinza2, borderRadius: 10, backgroundColor: C.branco, overflow: 'hidden' },
  campoOk:   { borderColor: C.azul },
  prefixoWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 16, backgroundColor: C.cinza1 },
  bandeira:  { fontSize: 18 },
  prefixo:    { fontSize: 15, fontWeight: '700', color: C.cinza4 },
  divisor:   { width: 1, height: 26, backgroundColor: C.cinza2 },
  campoInput:{ flex: 1, fontSize: 17, fontWeight: '600', color: C.preto, paddingHorizontal: 14, paddingVertical: 16, letterSpacing: 1 },
  campoIcone:{ marginRight: 14 },
  dica:      { fontSize: 12, color: C.cinza3, marginTop: 6 },
  aviso:    { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 28 },
  avisoTxt: { flex: 1, fontSize: 12, color: C.cinza3, lineHeight: 17 },
  btn:    { backgroundColor: C.azul, borderRadius: 10, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  btnOff: { backgroundColor: C.cinza2 },
  btnTxt: { fontSize: 16, fontWeight: '700', color: C.branco },
  linkLogin:     { alignItems: 'center', paddingVertical: 6, marginBottom: 16 },
  linkLoginTxt:  { fontSize: 14, color: C.cinza3 },
  linkLoginDest: { color: C.azul, fontWeight: '700' },
  otpRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  inputOculto: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  barra:    { height: 2, backgroundColor: C.cinza2, borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  barraFill:{ height: 2, backgroundColor: C.azul, borderRadius: 2 },
  barraTxt: { fontSize: 12, color: C.cinza3, textAlign: 'right', marginBottom: 28 },
  reenvioWrap:  { alignItems: 'center', marginBottom: 20 },
  reenvioEspera:{ fontSize: 13, color: C.cinza3 },
  reenvioBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reenvioTxt:   { fontSize: 13, color: C.azul, fontWeight: '600' },
  nota:    { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: C.cinza1, borderRadius: 8, padding: 12 },
  notaTxt: { flex: 1, fontSize: 12, color: C.cinza3, lineHeight: 18 },
});