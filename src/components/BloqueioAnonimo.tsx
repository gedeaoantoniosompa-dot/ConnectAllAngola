import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../config/firebase';

interface Props {
  visivel: boolean;
  tipo?: 'acao' | 'tempo';
  onFechar?: () => void;
}

export default function BloqueioAnonimo({ visivel, tipo = 'tempo', onFechar }: Props) {
  const router = useRouter();

  const irParaLogin = async () => {
    onFechar?.();
    if (tipo === 'tempo') await signOut(auth);
    router.replace('/(auth)/login');
  };

  const irParaRegisto = async () => {
    onFechar?.();
    if (tipo === 'tempo') await signOut(auth);
    router.replace('/(auth)/register');
  };

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={tipo === 'acao' ? onFechar : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Botão fechar — só no modo ação */}
          {tipo === 'acao' && (
            <TouchableOpacity style={styles.fecharBtn} onPress={onFechar}>
              <Ionicons name="close" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}

          {/* Ícone cadeado */}
          <View style={styles.iconOuter}>
            <View style={styles.iconInner}>
              <Ionicons name="lock-closed" size={28} color="#C4B5FD" />
            </View>
          </View>

          {/* Título */}
          <Text style={styles.titulo}>
            {tipo === 'tempo' ? 'Sessão bloqueada' : 'Acesso restrito'}
          </Text>

          {/* Subtítulo */}
          <Text style={styles.subtitulo}>
            {tipo === 'tempo'
              ? 'O teu período de exploração de 10 minutos terminou. Cria uma conta para continuar.'
              : 'Esta funcionalidade está disponível apenas para membros da plataforma.'}
          </Text>

          {/* Divisor */}
          <View style={styles.divider} />

          {/* Benefícios */}
          {[
            'Publica conquistas, ideias e oportunidades',
            'Reage e comenta publicações',
            'Conecta com profissionais de Angola',
            'Recebe notificações em tempo real',
          ].map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemDot} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}

          {/* Botão principal */}
          <TouchableOpacity style={styles.btnPrimario} onPress={irParaRegisto} activeOpacity={0.85}>
            <Text style={styles.btnPrimarioTexto}>Criar conta</Text>
          </TouchableOpacity>

          {/* Botão secundário */}
          <TouchableOpacity style={styles.btnSecundario} onPress={irParaLogin} activeOpacity={0.7}>
            <Text style={styles.btnSecundarioTexto}>Já tenho conta</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#12131A',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 36,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2030',
    position: 'relative',
  },
  fecharBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#2D2A5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#1E2030',
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 13,
    alignSelf: 'flex-start',
  },
  itemDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
  },
  itemText: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },
  btnPrimario: {
    width: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  btnPrimarioTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  btnSecundario: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnSecundarioTexto: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
});
