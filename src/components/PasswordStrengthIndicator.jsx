/**
 * PasswordStrengthIndicator.jsx — ConnectAll Angola
 * Indicador de força de palavra-passe, estilo corporativo (paleta LinkedIn).
 * Regra: mínimo 8 caracteres + pelo menos 3 das 4 categorias
 * (maiúsculas, minúsculas, números, caracteres especiais).
 *
 * Comportamento:
 *  - Enquanto a senha não cumpre os critérios, mostra a lista de regras.
 *  - Assim que a senha se torna forte (score >= 3), colapsa automaticamente
 *    para uma única linha discreta "Palavra-passe forte".
 *
 * Uso:
 *   import PasswordStrengthIndicator, { getPasswordStrength, validarPassword }
 *     from '../components/PasswordStrengthIndicator';
 *
 *   <PasswordStrengthIndicator password={password} visivel={password.length > 0} />
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

// ── Paleta corporativa ──────────────────────────────────────────────────────
const AZUL = '#0A66C2';        // azul corporativo (LinkedIn)
const AZUL_CLARO = '#E8F1FB';  // fundo suave para o estado "forte"
const VERDE_OK = '#0F8A5F';    // confirmação de regra cumprida, sóbrio
const CINZA_TEXTO = '#4B5563';
const CINZA_CLARO = '#9CA3AF';
const BORDA = '#E2E5EA';

const REGRAS = [
  { id: 'tamanho',   label: 'Mínimo de 8 caracteres',          testar: (p) => p.length >= 8 },
  { id: 'maiuscula', label: 'Letras maiúsculas',                testar: (p) => /[A-Z]/.test(p) },
  { id: 'minuscula', label: 'Letras minúsculas',                testar: (p) => /[a-z]/.test(p) },
  { id: 'numero',    label: 'Números',                          testar: (p) => /[0-9]/.test(p) },
  { id: 'especial',  label: 'Caracteres não alfanuméricos',     testar: (p) => /[^A-Za-z0-9]/.test(p) },
];

/**
 * Valida uma palavra-passe segundo a regra:
 * mínimo 8 caracteres + caracter não alfanumérico OBRIGATÓRIO
 * + pelo menos 3 das 4 categorias no total (maiúscula, minúscula, número, especial).
 *
 * Ou seja: sem caracter especial, a senha nunca é considerada forte,
 * mesmo que cumpra as outras 3 categorias.
 *
 * Retorna { valido, resultados, categoriasCumpridas }
 */
export function validarPassword(password = '') {
  const resultados = REGRAS.map(r => ({ ...r, cumprida: r.testar(password) }));
  const tamanhoOk = resultados.find(r => r.id === 'tamanho')?.cumprida || false;
  const especialOk = resultados.find(r => r.id === 'especial')?.cumprida || false;
  const categoriasCumpridas = resultados.filter(r => r.id !== 'tamanho' && r.cumprida).length;
  const valido = tamanhoOk && especialOk && categoriasCumpridas >= 3;
  return { valido, resultados, categoriasCumpridas };
}

/**
 * Variante com interface { score } (0 a 4).
 * score >= 3 equivale exactamente a valido === true em validarPassword
 * (o que agora exige sempre o caracter especial).
 */
export function getPasswordStrength(password = '') {
  const { resultados, categoriasCumpridas, valido } = validarPassword(password);
  const tamanhoOk = resultados.find(r => r.id === 'tamanho')?.cumprida || false;

  let score = 0;
  if (tamanhoOk) {
    // Sem caracter especial, o score nunca chega a 3 — fica preso em 2 no máximo,
    // mesmo que as outras 3 categorias estejam todas cumpridas.
    score = valido ? Math.max(3, categoriasCumpridas) : Math.min(2, Math.max(1, categoriasCumpridas));
  }

  const LABELS = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte'];

  return { score, label: LABELS[score], resultados, categoriasCumpridas };
}

export default function PasswordStrengthIndicator({ password = '', visivel = true }) {
  const { resultados, valido } = useMemo(() => validarPassword(password), [password]);

  // Anima a transição entre o estado "lista de regras" e "forte (colapsado)"
  const progresso = useRef(new Animated.Value(valido ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progresso, {
      toValue: valido ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [valido]);

  if (!visivel) return null;

  // ── Estado: senha forte — linha única discreta ──────────────────────────
  if (valido) {
    return (
      <Animated.View style={[st.containerForte, { opacity: progresso }]}>
        <View style={st.iconeForteWrap}>
          <Ionicons name="shield-checkmark" size={14} color={AZUL} />
        </View>
        <Text style={st.textoForte}>Palavra-passe forte</Text>
      </Animated.View>
    );
  }

  // ── Estado: lista de critérios pendentes ─────────────────────────────────
  return (
    <View style={st.container}>
      <Text style={st.titulo}>
        A palavra-passe deve conter no mínimo 8 caracteres, um caracter especial e pelo menos 2 dos critérios seguintes
      </Text>
      <View style={st.lista}>
        {resultados.map(r => (
          <View key={r.id} style={st.linha}>
            <View style={[st.bullet, r.cumprida && st.bulletOk]}>
              {r.cumprida && <Ionicons name="checkmark" size={11} color="#fff" />}
            </View>
            <Text style={[st.label, r.cumprida && st.labelOk]}>{r.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  // ── Estado expandido ──
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: BORDA,
  },
  titulo: {
    fontSize: 12,
    color: CINZA_TEXTO,
    lineHeight: 17,
    marginBottom: 10,
    fontWeight: '500',
  },
  lista: { gap: 7 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bullet: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: CINZA_CLARO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletOk: {
    backgroundColor: VERDE_OK,
    borderColor: VERDE_OK,
  },
  label: { fontSize: 12.5, color: CINZA_CLARO, fontWeight: '500' },
  labelOk: { color: CINZA_TEXTO },

  // ── Estado colapsado (senha forte) ──
  containerForte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: AZUL_CLARO,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginTop: 6,
    marginBottom: 2,
    alignSelf: 'flex-start',
  },
  iconeForteWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoForte: {
    fontSize: 12.5,
    color: AZUL,
    fontWeight: '600',
  },
});