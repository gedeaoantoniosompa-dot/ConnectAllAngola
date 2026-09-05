// components/live/LiveStageStrip.jsx
//
// Faixa horizontal com o vídeo dos convidados atualmente no palco
// (co-apresentadores), ao estilo TikTok LIVE multi-convidado.
// Usada tanto no ecrã do host como no ecrã de cada espectador.
//
// ── ALTERAÇÕES ──
// 1) Posicionamento adaptável: em vez de um "top: 72" fixo (que ficava mal
//    alinhado em ecrãs com notch/status bar de alturas diferentes), usa
//    useSafeAreaInsets() para se posicionar sempre por baixo da barra "AO
//    VIVO"/topo, de forma consistente em qualquer aparelho.
// 2) Cada tile passou a reflectir o estado real do convidado, gravado em
//    lives/{liveId}/palco/{uid} (ver atualizarEstadoConvidado em
//    liveInteracoesService.js): se o convidado desligou a câmara, mostra a
//    foto dele; se pôs o vídeo em pausa, mostra o logótipo da ConnectAll;
//    se desligou o microfone, mostra um pequeno ícone de microfone cortado.
//    Antes, nada disto era visível para os espectadores — só para o
//    próprio convidado, no seu ecrã.
// 3) Visual revisto: cantos e espaçamento consistentes, sombra subtil,
//    rótulo do nome numa barra inferior a toda a largura do tile, e uma
//    legenda discreta "No palco" acima da faixa, para ficar claramente
//    organizado e não uma fila de caixas soltas.

import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RtcSurfaceView, VideoSourceType } from '../../services/agoraNative';

// Caminho a partir de src/components/live/LiveStageStrip.jsx até ao
// assets/ na raiz do projecto (fora de src/) — ajusta se a estrutura do
// teu projecto for diferente.
const LOGO_CONNECTALL = require('../../../assets/icon-app.png');

function initials(nome = '') {
  return (nome.trim()[0] || 'U').toUpperCase();
}

function Tile({ convidado, souHost, onRemover }) {
  const temVideo = convidado.numUid != null && !convidado.cameraDesligada && !convidado.videoPausado;

  return (
    <View style={styles.tile}>
      {temVideo && (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          zOrderMediaOverlay
          canvas={{ uid: convidado.numUid, sourceType: VideoSourceType.VideoSourceRemote }}
        />
      )}

      {/* Vídeo em pausa — logótipo da ConnectAll, cobre por completo */}
      {convidado.videoPausado && (
        <View style={styles.overlay}>
          <Image source={LOGO_CONNECTALL} style={styles.overlayLogo} resizeMode="contain" />
        </View>
      )}

      {/* Câmara desligada (e não está em pausa) — foto do convidado */}
      {!convidado.videoPausado && convidado.cameraDesligada && (
        <View style={styles.overlay}>
          {convidado.fotoURL ? (
            <Image source={{ uri: convidado.fotoURL }} style={styles.overlayAvatar} />
          ) : (
            <View style={[styles.overlayAvatar, styles.overlayAvatarFallback]}>
              <Text style={styles.overlayAvatarTxt}>{initials(convidado.nome)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Sem sinal de vídeo ainda (a ligar) */}
      {!temVideo && !convidado.cameraDesligada && !convidado.videoPausado && (
        <View style={[styles.overlay, styles.overlayFallback]}>
          <Text style={styles.overlayAvatarTxt}>{initials(convidado.nome)}</Text>
        </View>
      )}

      {convidado.microfoneDesligado && (
        <View style={styles.micBadge}>
          <Ionicons name="mic-off" size={10} color="#fff" />
        </View>
      )}

      <View style={styles.nomeBarra}>
        <Text style={styles.nome} numberOfLines={1}>{convidado.nome}</Text>
      </View>

      {souHost && (
        <TouchableOpacity style={styles.removerBtn} onPress={() => onRemover?.(convidado)}>
          <Ionicons name="close" size={12} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function LiveStageStrip({ convidados, souHost, onRemover }) {
  const insets = useSafeAreaInsets();

  if (!convidados || convidados.length === 0) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 62 }]} pointerEvents="box-none">
      <Text style={styles.legenda}>No palco · {convidados.length}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
        pointerEvents="box-none"
      >
        {convidados.map((c) => (
          <Tile key={c.uid} convidado={c} souHost={souHost} onRemover={onRemover} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0 },
  legenda: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    marginLeft: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  conteudo: { gap: 10, paddingHorizontal: 16 },
  tile: {
    width: 68,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1B1B1B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1B1B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayFallback: { backgroundColor: '#334155' },
  overlayLogo: { width: 26, height: 26 },
  overlayAvatar: { width: 34, height: 34, borderRadius: 17 },
  overlayAvatarFallback: { backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  overlayAvatarTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  micBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: 'rgba(224,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nomeBarra: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  nome: { fontSize: 10, color: '#fff', fontWeight: '700', textAlign: 'center' },
  removerBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});