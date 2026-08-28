/**
 * components/PerfilBadge.jsx — ConnectAll Angola
 *
 * Selo visual pequeno para identificar com que tipo de perfil alguém está
 * presente num espaço partilhado (ex: Feira do Saber, comentários, listas de
 * participantes). Uso:
 *
 *   <PerfilBadge tipo="empresa" />
 *   <PerfilBadge tipo="recrutador" tamanho="pequeno" />
 *
 * "tipo" aceita: 'utilizador' | 'recrutador' | 'empresa'.
 * Para 'utilizador' o componente não renderiza nada (não precisa de selo).
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

const CONFIG = {
  recrutador: {
    label: 'Recrutador',
    icone: 'briefcase',
    cor: '#7C3AED',
    bg: '#F3EEFF',
  },
  empresa: {
    label: 'Empresa',
    icone: 'business',
    cor: '#EC4C89',
    bg: '#FEE7F0',
  },
};

export default function PerfilBadge({ tipo, tamanho = 'normal' }) {
  const config = CONFIG[tipo];
  if (!config) return null; // 'utilizador' ou tipo desconhecido — sem selo

  const pequeno = tamanho === 'pequeno';

  return (
    <View style={[s.wrap, { backgroundColor: config.bg }, pequeno && s.wrapPequeno]}>
      <Ionicons name={config.icone} size={pequeno ? 10 : 12} color={config.cor} />
      <Text style={[s.txt, { color: config.cor }, pequeno && s.txtPequeno]}>
        {config.label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  wrapPequeno: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 3 },
  txt: { fontSize: 11, fontWeight: '700' },
  txtPequeno: { fontSize: 9.5 },
});