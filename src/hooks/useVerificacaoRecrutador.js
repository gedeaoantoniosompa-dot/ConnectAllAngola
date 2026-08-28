/**
 * hooks/useVerificacaoRecrutador.js — ConnectAll Angola
 *
 * Hook reutilizável que verifica se a conta do recrutador está verificada.
 * Qualquer ecrã/acção restrita chama `verificarAcesso()` antes de prosseguir.
 * Se a conta não estiver verificada, mostra o modal automaticamente.
 *
 * Uso:
 *   const { verificarAcesso, ModalBloqueio } = useVerificacaoRecrutador();
 *
 *   // No botão de publicar vaga:
 *   onPress={() => { if (!verificarAcesso()) return; /* continua *\/ }}
 *
 *   // No render:
 *   <ModalBloqueio />
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';

const C = {
  azul:      '#1677F2',
  laranja:   '#F59E0B',
  vermelho:  '#EF4444',
  verde:     '#22C55E',
  cinza:     '#6B7280',
  cinzaClaro:'#F3F4F6',
  preto:     '#111827',
  branco:    '#FFFFFF',
  fundo:     'rgba(0,0,0,0.6)',
};

// ── Itens que ficam bloqueados até verificação ───────────────────────────────
const RESTRICOES = [
  { icone: 'briefcase-outline',      txt: 'Publicação de vagas de emprego' },
  { icone: 'people-outline',         txt: 'Partilha de processos de recrutamento' },
  { icone: 'chatbubble-ellipses-outline', txt: 'Contacto directo com utilizadores' },
  { icone: 'document-text-outline',  txt: 'Acesso a currículos e perfis completos' },
  { icone: 'videocam-outline',       txt: 'Realização de entrevistas na plataforma' },
];

export function useVerificacaoRecrutador() {
  const { user } = useUser();
  const router   = useRouter();

  const [verificado,    setVerificado]    = useState(null); // null = a carregar
  const [modalVisivel,  setModalVisivel]  = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  // ── Ouve o estado de verificação em tempo real ───────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const ref  = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) return;
      const dados = snap.data();
      // Conta verificada se o admin marcou verificado=true ou isVerified=true
      const eVerificado = dados?.verificado === true || dados?.isVerified === true || dados?.contaVerificada === true;
      setVerificado(eVerificado);
    }, () => setVerificado(false));
    return unsub;
  }, [user?.uid]);

  // ── Animação do modal ────────────────────────────────────────────────────
  const abrirModal = () => {
    setModalVisivel(true);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  };

  const fecharModal = () => {
    Animated.timing(slideAnim, {
      toValue: 400, duration: 250, useNativeDriver: true,
    }).start(() => setModalVisivel(false));
  };

  // ── Função principal — chama antes de qualquer acção restrita ────────────
  const verificarAcesso = () => {
    if (verificado === true) return true;  // ✅ tem acesso
    abrirModal();
    return false; // 🚫 bloqueado
  };

  // ── Acções do modal ──────────────────────────────────────────────────────
  const irParaSuporte = () => {
    fecharModal();
    setTimeout(() => router.push('/(main)/suporte'), 300);
  };

  const irParaDocumentos = () => {
    fecharModal();
    setTimeout(() => router.push('/(auth)/profile-recrutador'), 300);
  };

  const contactarEmail = () => {
    Linking.openURL('mailto:suporte@connectallangola.ao?subject=Verificação%20de%20conta%20recrutador');
  };

  const contactarWhatsApp = () => {
    Linking.openURL('https://wa.me/244900000000?text=Olá,%20preciso%20de%20verificar%20a%20minha%20conta%20de%20recrutador%20na%20ConnectAll%20Angola.');
  };

  // ── Modal de bloqueio ────────────────────────────────────────────────────
  const ModalBloqueio = () => (
    <Modal
      visible={modalVisivel}
      transparent
      animationType="fade"
      onRequestClose={fecharModal}
      statusBarTranslucent
    >
      <View style={ms.overlay}>
        <TouchableOpacity style={ms.overlayTouch} activeOpacity={1} onPress={fecharModal} />

        <Animated.View style={[ms.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* Handle */}
            <View style={ms.handle} />

            {/* Ícone de aviso */}
            <View style={ms.iconeWrap}>
              <View style={ms.iconeCirculo}>
                <Ionicons name="shield-outline" size={36} color={C.laranja} />
              </View>
              <View style={ms.badge}>
                <Ionicons name="time-outline" size={14} color={C.branco} />
              </View>
            </View>

            {/* Título */}
            <Text style={ms.titulo}>Conta em verificação</Text>
            <Text style={ms.sub}>
              A tua conta de recrutador foi criada com sucesso. Estamos a analisar os teus documentos e verificaremos a tua identidade como recrutador em breve.
            </Text>

            {/* Estado */}
            <View style={ms.estadoCard}>
              <View style={ms.estadoLinha}>
                <Ionicons name="checkmark-circle" size={18} color={C.verde} />
                <Text style={ms.estadoTxt}>Conta criada</Text>
              </View>
              <View style={ms.estadoLinha}>
                <Ionicons name="checkmark-circle" size={18} color={C.verde} />
                <Text style={ms.estadoTxt}>Documentos submetidos</Text>
              </View>
              <View style={ms.estadoLinha}>
                <Ionicons name="time-outline" size={18} color={C.laranja} />
                <Text style={[ms.estadoTxt, { color: C.laranja }]}>A aguardar verificação pela equipa ConnectAll</Text>
              </View>
            </View>

            {/* Restrições activas */}
            <Text style={ms.restricoesTitulo}>Funcionalidades disponíveis após verificação:</Text>
            <View style={ms.restricoesCard}>
              {RESTRICOES.map((r, i) => (
                <View key={i} style={[ms.restricaoLinha, i < RESTRICOES.length - 1 && ms.restricaoSep]}>
                  <View style={ms.restricaoIconeWrap}>
                    <Ionicons name={r.icone} size={16} color={C.cinza} />
                  </View>
                  <Text style={ms.restricaoTxt}>{r.txt}</Text>
                  <Ionicons name="lock-closed" size={13} color={C.cinza} />
                </View>
              ))}
            </View>

            {/* Acções */}
            <Text style={ms.acoesTitulo}>O que podes fazer agora:</Text>

            <TouchableOpacity style={ms.btnPrimario} onPress={irParaDocumentos} activeOpacity={0.85}>
              <Ionicons name="document-attach-outline" size={18} color={C.branco} />
              <Text style={ms.btnPrimarioTxt}>Completar / rever documentos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={ms.btnSecundario} onPress={irParaSuporte} activeOpacity={0.85}>
              <Ionicons name="help-circle-outline" size={18} color={C.azul} />
              <Text style={ms.btnSecundarioTxt}>Contactar suporte</Text>
            </TouchableOpacity>

            <View style={ms.contactosRow}>
              <TouchableOpacity style={ms.btnContacto} onPress={contactarEmail} activeOpacity={0.85}>
                <Ionicons name="mail-outline" size={16} color={C.cinza} />
                <Text style={ms.btnContactoTxt}>Email</Text>
              </TouchableOpacity>
              <View style={ms.contactosDivisor} />
              <TouchableOpacity style={ms.btnContacto} onPress={contactarWhatsApp} activeOpacity={0.85}>
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                <Text style={ms.btnContactoTxt}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={ms.btnFechar} onPress={fecharModal} activeOpacity={0.85}>
              <Text style={ms.btnFecharTxt}>Fechar</Text>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );

  return { verificarAcesso, ModalBloqueio, verificado, abrirModal };
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: C.fundo, justifyContent: 'flex-end' },
  overlayTouch: { flex: 1 },
  sheet:        { backgroundColor: C.branco, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '90%' },
  handle:       { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  // Ícone
  iconeWrap:    { alignItems: 'center', marginBottom: 16 },
  iconeCirculo: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FDE68A' },
  badge:        { position: 'absolute', bottom: 0, right: '30%', width: 24, height: 24, borderRadius: 12, backgroundColor: C.laranja, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.branco },

  // Texto
  titulo:       { fontSize: 22, fontWeight: '800', color: C.preto, textAlign: 'center', marginBottom: 10 },
  sub:          { fontSize: 14, color: C.cinza, textAlign: 'center', lineHeight: 21, marginBottom: 20 },

  // Estado
  estadoCard:   { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, marginBottom: 20, gap: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  estadoLinha:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  estadoTxt:    { fontSize: 13, color: C.preto, flex: 1, fontWeight: '500' },

  // Restrições
  restricoesTitulo: { fontSize: 13, fontWeight: '700', color: C.cinza, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  restricoesCard:   { backgroundColor: C.cinzaClaro, borderRadius: 14, padding: 4, marginBottom: 20 },
  restricaoLinha:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  restricaoSep:     { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  restricaoIconeWrap:{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.branco, alignItems: 'center', justifyContent: 'center' },
  restricaoTxt:     { flex: 1, fontSize: 13, color: C.cinza },

  // Botões
  acoesTitulo:      { fontSize: 13, fontWeight: '700', color: C.cinza, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnPrimario:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.azul, borderRadius: 14, paddingVertical: 15, marginBottom: 10 },
  btnPrimarioTxt:   { fontSize: 15, fontWeight: '700', color: C.branco },
  btnSecundario:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EEF4FF', borderRadius: 14, paddingVertical: 15, marginBottom: 12 },
  btnSecundarioTxt: { fontSize: 15, fontWeight: '700', color: C.azul },

  contactosRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  btnContacto:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.cinzaClaro, borderRadius: 12, paddingVertical: 12 },
  btnContactoTxt:   { fontSize: 13, fontWeight: '600', color: C.cinza },
  contactosDivisor: { width: 1, backgroundColor: '#E5E7EB' },

  btnFechar:    { alignItems: 'center', paddingVertical: 12 },
  btnFecharTxt: { fontSize: 14, color: C.cinza, fontWeight: '600' },
});