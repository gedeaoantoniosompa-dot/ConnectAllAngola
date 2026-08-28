// components/live/LiveStageStrip.jsx
//
// Faixa horizontal com o vídeo dos convidados atualmente no palco
// (co-apresentadores), ao estilo TikTok LIVE multi-convidado.
// Usada tanto no ecrã do host como no ecrã de cada espectador.

import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';

export default function LiveStageStrip({ convidados, souHost, onRemover }) {
  if (!convidados || convidados.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.wrap}
      contentContainerStyle={styles.conteudo}
      pointerEvents="box-none"
    >
      {convidados.map((c) => (
        <View key={c.uid} style={styles.tile}>
          {c.numUid != null && (
            <RtcSurfaceView
              style={StyleSheet.absoluteFill}
              zOrderMediaOverlay
              canvas={{ uid: c.numUid, sourceType: VideoSourceType.VideoSourceRemote }}
            />
          )}
          <Text style={styles.nome} numberOfLines={1}>{c.nome}</Text>
          {souHost && (
            <TouchableOpacity style={styles.removerBtn} onPress={() => onRemover?.(c)}>
              <Ionicons name="close" size={12} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 72, left: 0, right: 0 },
  conteudo: { gap: 8, paddingHorizontal: 16 },
  tile: {
    width: 64,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1F1F1F',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'flex-end',
  },
  nome: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  removerBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});