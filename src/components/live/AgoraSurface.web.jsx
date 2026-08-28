// src/components/live/AgoraSurface.web.jsx
// Versão WEB — não existe SDK de vídeo em tempo real do Agora para web,
// por isso mostramos um placeholder. As lives/chamadas continuam a
// funcionar normalmente na app móvel (Android/iOS).
import { StyleSheet, Text, View } from 'react-native';

export const VideoSourceType = { VideoSourceCamera: 0, VideoSourceRemote: 1 };

export default function AgoraSurface({ style }) {
  return (
    <View style={[style, styles.placeholder]}>
      <Text style={styles.texto}>Vídeo disponível apenas na app móvel</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  texto: { color: '#fff', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 },
});