/**
 * escolher-tipo-perfil.jsx — ConnectAll Angola
 * Ecrã de escolha de tipo de perfil (depois do registo por telefone/email)
 * Ao escolher, vai DIRECTAMENTE para o formulário do perfil — sem modal de método
 *
 * ── ALTERAÇÃO ──
 * O tipo "Empresa" deixou de existir como perfil independente. Agora existem
 * apenas dois tipos de perfil: "Utilizador" e "Recrutador". Dentro do registo
 * de Recrutador, a pessoa escolhe se está a criar uma conta individual ou em
 * nome de uma empresa (ver profile-recrutador.jsx).
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TIPOS = [
  {
    key: 'utilizador',
    icon: 'person-circle-outline',
    cor: '#1677F2',
    bg: '#EEF4FF',
    titulo: 'Utilizador',
    subtitulo: 'Para profissionais e estudantes',
    items: [
      'Publicar conteúdo e partilhar ideias',
      'Conversar com outros membros',
      'Criar currículo e candidatar-se a vagas',
      'Seguir pessoas e empresas',
    ],
  },
  {
    key: 'recrutador',
    icon: 'briefcase-outline',
    cor: '#6A11CB',
    bg: '#F3EEFF',
    titulo: 'Recrutador',
    subtitulo: 'Para RH, recrutadores e empresas',
    items: [
      'Publicar vagas de emprego',
      'Pesquisar e avaliar candidatos',
      'Receber e gerir candidaturas',
      'Criar página de empresa (opcional)',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
export default function EscolherTipoPerfilScreen() {
  const router = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [carregando,      setCarregando]  = useState(false);
  const [tipoSelecionado, setTipoSel]     = useState(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // O registo (telefone ou email) já foi feito no ecrã anterior.
  // Aqui só gravamos o tipoPerfil escolhido e seguimos directo
  // para o formulário do perfil correspondente.
  const escolherTipo = async (tipo) => {
    if (carregando) return;
    setCarregando(true);
    setTipoSel(tipo);

    try {
      const pendenteStr = await AsyncStorage.getItem('_registoPendente');
      const pendente = pendenteStr ? JSON.parse(pendenteStr) : {};

      await AsyncStorage.setItem('_registoPendente', JSON.stringify({
        ...pendente,
        tipoPerfil: tipo,
      }));

      if (tipo === 'utilizador') {
        router.replace('/(auth)/profile');
      } else if (tipo === 'recrutador') {
        router.replace('/(auth)/profile-recrutador');
      }
    } catch (e) {
      console.log('[escolherTipo] erro ao guardar tipoPerfil:', e?.message || e);
      Alert.alert('Erro', 'Não foi possível guardar a escolha. Tenta novamente.');
    } finally {
      setCarregando(false);
      setTipoSel(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/logo2.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <View style={styles.logoTextRow}>
            <Text style={styles.logoConnect}>Connect</Text>
            <Text style={styles.logoAll}>All</Text>
            <Text style={styles.logoAngola}> Angola</Text>
          </View>
          <Text style={styles.titulo}>Como vais usar{'\n'}a plataforma?</Text>
          <Text style={styles.subtitulo}>
            Escolhe o tipo de perfil que melhor te representa. Podes sempre alterar nas definições.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
          {TIPOS.map((tipo) => (
            <TouchableOpacity
              key={tipo.key}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => escolherTipo(tipo.key)}
              disabled={carregando}
            >
              {/* Topo do card */}
              <View style={styles.cardTopo}>
                <View style={[styles.cardIconeWrap, { backgroundColor: tipo.bg }]}>
                  <Ionicons name={tipo.icon} size={26} color={tipo.cor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitulo}>{tipo.titulo}</Text>
                  <Text style={styles.cardSub}>{tipo.subtitulo}</Text>
                </View>
                <View style={[styles.cardSeta, { backgroundColor: tipo.bg }]}>
                  <Ionicons name="chevron-forward" size={16} color={tipo.cor} />
                </View>
              </View>

              <View style={styles.cardDivisor} />

              {/* Funcionalidades */}
              <View style={styles.cardItems}>
                {tipo.items.map((item, j) => (
                  <View key={j} style={styles.cardItem}>
                    <View style={[styles.cardItemPonto, { backgroundColor: tipo.cor }]} />
                    <Text style={styles.cardItemTexto}>{item}</Text>
                  </View>
                ))}
              </View>

              {/* Botão */}
              <TouchableOpacity
                style={[
                  styles.cardBtn,
                  { backgroundColor: tipo.cor },
                  carregando && tipoSelecionado === tipo.key && { opacity: 0.7 },
                ]}
                onPress={() => escolherTipo(tipo.key)}
                activeOpacity={0.85}
                disabled={carregando}
              >
                {carregando && tipoSelecionado === tipo.key ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.cardBtnTxt}>Continuar como {tipo.titulo}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  header:       { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  logoImg:      { width: 44, height: 44, marginBottom: 10 },
  logoTextRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  logoConnect:  { fontSize: 18, fontWeight: '900', color: '#111827' },
  logoAll:      { fontSize: 18, fontWeight: '900', color: '#CC1016' },
  logoAngola:   { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  titulo:       { fontSize: 24, fontWeight: '800', color: '#1F1F1F', textAlign: 'center', lineHeight: 32, marginBottom: 8 },
  subtitulo:    { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 },

  lista: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopo:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIconeWrap: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitulo:    { fontSize: 16, fontWeight: '800', color: '#1F1F1F', marginBottom: 2 },
  cardSub:       { fontSize: 12, color: '#6B6B6B' },
  cardSeta:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardDivisor:   { height: 1, backgroundColor: '#F0F2F5', marginBottom: 14 },
  cardItems:     { gap: 8, marginBottom: 16 },
  cardItem:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardItemPonto: { width: 6, height: 6, borderRadius: 3 },
  cardItemTexto: { fontSize: 13, color: '#4A5568', flex: 1 },
  cardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 13, minHeight: 46,
  },
  cardBtnTxt:        { fontSize: 14, fontWeight: '700', color: '#fff' },
  loginLink:         { alignItems: 'center', paddingVertical: 16 },
  loginLinkTxt:      { fontSize: 14, color: '#6B7280' },
  loginLinkDestaque: { color: '#1677F2', fontWeight: '700' },
});