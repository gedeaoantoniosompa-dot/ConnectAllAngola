import { Ionicons } from '@expo/vector-icons';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const { width, height } = Dimensions.get('window');
const FOTO_SIZE = (width - 4) / 3;

const CORES_FUNDO = [
  '#0F172A','#1E3A5F','#1a1a2e','#16213e','#0d0d0d','#1B4332',
  '#2D6A4F','#40916C','#6A0572','#9D0208','#C1121F','#E63946',
  '#F77F00','#FCBF49','#EAE2B7','#F4E409','#3A86FF','#8338EC',
  '#FF006E','#FB5607','#06D6A0','#118AB2','#073B4C','#264653',
  '#2A9D8F','#E9C46A','#F4A261','#E76F51','#D62828','#023E8A',
  '#0077B6','#00B4D8','#90E0EF','#ADE8F4','#CAF0F8','#48CAE4',
  '#7B2FBE','#9B5DE5','#F15BB5','#FEE440','#00BBF9','#00F5D4',
  '#FF4800','#FF6B35','#2EC4B6','#E71D36','#011627','#FDFFFC',
];

const ESTILOS_LETRA = [
  { label: 'Regular', style: { fontWeight: '400', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Bold', style: { fontWeight: '800', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Light', style: { fontWeight: '200', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Thin', style: { fontWeight: '100', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Medium', style: { fontWeight: '500', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'SemiBold', style: { fontWeight: '600', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'ExtraBold', style: { fontWeight: '900', fontStyle: 'normal', letterSpacing: 0 } },
  { label: 'Italic', style: { fontWeight: '400', fontStyle: 'italic', letterSpacing: 0 } },
  { label: 'Bold Italic', style: { fontWeight: '800', fontStyle: 'italic', letterSpacing: 0 } },
  { label: 'Light Italic', style: { fontWeight: '200', fontStyle: 'italic', letterSpacing: 0 } },
  { label: 'Spaced', style: { fontWeight: '400', letterSpacing: 8 } },
  { label: 'Spaced Bold', style: { fontWeight: '700', letterSpacing: 8 } },
  { label: 'Spaced Light', style: { fontWeight: '200', letterSpacing: 8 } },
  { label: 'Wide', style: { fontWeight: '400', letterSpacing: 12 } },
  { label: 'Ultra Wide', style: { fontWeight: '700', letterSpacing: 16 } },
  { label: 'Compact', style: { fontWeight: '900', letterSpacing: -1 } },
  { label: 'Ultra Compact', style: { fontWeight: '900', letterSpacing: -2 } },
  { label: 'CAPS', style: { fontWeight: '700', letterSpacing: 4, textTransform: 'uppercase' } },
  { label: 'CAPS Light', style: { fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase' } },
  { label: 'CAPS Wide', style: { fontWeight: '800', letterSpacing: 10, textTransform: 'uppercase' } },
  { label: 'Shadow', style: { fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 4 } },
  { label: 'Glow White', style: { fontWeight: '700', textShadowColor: '#fff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 } },
  { label: 'Glow Blue', style: { fontWeight: '700', textShadowColor: '#3A86FF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Pink', style: { fontWeight: '700', textShadowColor: '#FF006E', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Green', style: { fontWeight: '700', textShadowColor: '#06D6A0', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Gold', style: { fontWeight: '700', textShadowColor: '#FFD700', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Glow Red', style: { fontWeight: '700', textShadowColor: '#E63946', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 } },
  { label: 'Shadow Soft', style: { fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 8 } },
  { label: 'Outline', style: { fontWeight: '700', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 } },
  { label: 'Double Shadow', style: { fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 } },
  { label: 'Xs', style: { fontWeight: '400', fontSize: 10 } },
  { label: 'Sm', style: { fontWeight: '400', fontSize: 16 } },
  { label: 'Md', style: { fontWeight: '500', fontSize: 22 } },
  { label: 'Lg', style: { fontWeight: '600', fontSize: 30 } },
  { label: 'Xl', style: { fontWeight: '700', fontSize: 40 } },
  { label: 'Spaced+Italic', style: { fontWeight: '400', fontStyle: 'italic', letterSpacing: 6 } },
  { label: 'Bold Spaced It', style: { fontWeight: '700', fontStyle: 'italic', letterSpacing: 5 } },
  { label: 'CAPS Italic', style: { fontWeight: '600', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 3 } },
  { label: 'Thin Italic', style: { fontWeight: '100', fontStyle: 'italic', letterSpacing: 1 } },
  { label: 'Compact Bold', style: { fontWeight: '900', letterSpacing: -1, fontStyle: 'normal' } },
  { label: 'Elegant', style: { fontWeight: '300', fontStyle: 'italic', letterSpacing: 5 } },
  { label: 'Elegant Bold', style: { fontWeight: '600', fontStyle: 'italic', letterSpacing: 4 } },
  { label: 'Poster', style: { fontWeight: '900', letterSpacing: -2, textTransform: 'uppercase' } },
  { label: 'Poster Light', style: { fontWeight: '300', letterSpacing: 10, textTransform: 'uppercase' } },
  { label: 'Magazine', style: { fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' } },
  { label: 'Editorial', style: { fontWeight: '300', fontStyle: 'italic', letterSpacing: 8, textTransform: 'uppercase' } },
  { label: 'Street', style: { fontWeight: '900', letterSpacing: 0, textTransform: 'uppercase' } },
  { label: 'Classic', style: { fontWeight: '400', fontStyle: 'italic', letterSpacing: 1 } },
  { label: 'Retro', style: { fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase' } },
  { label: 'Retro Italic', style: { fontWeight: '700', fontStyle: 'italic', letterSpacing: 3 } },
  { label: 'Modern', style: { fontWeight: '500', letterSpacing: 6, textTransform: 'uppercase' } },
  { label: 'Modern Bold', style: { fontWeight: '800', letterSpacing: 4 } },
  { label: 'Luxury', style: { fontWeight: '300', letterSpacing: 10 } },
  { label: 'Luxury Bold', style: { fontWeight: '700', letterSpacing: 6 } },
  { label: 'Grunge', style: { fontWeight: '900', fontStyle: 'italic', letterSpacing: -1, textTransform: 'uppercase' } },
  { label: 'Indie', style: { fontWeight: '300', fontStyle: 'italic', letterSpacing: 2 } },
  { label: 'Hero', style: { fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase' } },
  { label: 'Caption', style: { fontWeight: '400', letterSpacing: 1, fontSize: 13 } },
  { label: 'Caption Bold', style: { fontWeight: '700', letterSpacing: 1, fontSize: 13 } },
  { label: 'Display', style: { fontWeight: '800', letterSpacing: -1, fontSize: 36 } },
  { label: 'Headline', style: { fontWeight: '700', letterSpacing: 0, fontSize: 28 } },
  { label: 'Subhead', style: { fontWeight: '500', letterSpacing: 2, fontSize: 18 } },
  { label: 'Overline', style: { fontWeight: '500', letterSpacing: 6, fontSize: 11, textTransform: 'uppercase' } },
  { label: 'Glow+Caps', style: { fontWeight: '800', textShadowColor: '#fff', textShadowRadius: 10, letterSpacing: 5, textTransform: 'uppercase' } },
  { label: 'Neon Blue', style: { fontWeight: '700', textShadowColor: '#00BBF9', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Neon Pink', style: { fontWeight: '700', textShadowColor: '#F15BB5', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Neon Green', style: { fontWeight: '700', textShadowColor: '#00F5D4', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Neon Orange', style: { fontWeight: '700', textShadowColor: '#FF4800', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Neon Purple', style: { fontWeight: '700', textShadowColor: '#8338EC', textShadowRadius: 16, letterSpacing: 2 } },
  { label: 'Impact', style: { fontWeight: '900', letterSpacing: -1, textTransform: 'uppercase', fontStyle: 'normal' } },
  { label: 'Impact Italic', style: { fontWeight: '900', letterSpacing: -1, textTransform: 'uppercase', fontStyle: 'italic' } },
  { label: 'Stencil', style: { fontWeight: '700', letterSpacing: 8, textTransform: 'uppercase' } },
  { label: 'Brush', style: { fontWeight: '800', fontStyle: 'italic', letterSpacing: 1 } },
  { label: 'Script', style: { fontWeight: '400', fontStyle: 'italic', letterSpacing: 3 } },
  { label: 'Script Bold', style: { fontWeight: '700', fontStyle: 'italic', letterSpacing: 2 } },
  { label: 'Condensed', style: { fontWeight: '600', letterSpacing: -0.5 } },
  { label: 'Condensed Bold', style: { fontWeight: '900', letterSpacing: -0.8 } },
  { label: 'Expanded', style: { fontWeight: '500', letterSpacing: 10 } },
  { label: 'Expanded Bold', style: { fontWeight: '800', letterSpacing: 8 } },
  { label: 'Ultra Light', style: { fontWeight: '100', letterSpacing: 2, fontStyle: 'normal' } },
  { label: 'Ultra Light It', style: { fontWeight: '100', letterSpacing: 4, fontStyle: 'italic' } },
  { label: 'Black', style: { fontWeight: '900', letterSpacing: 0, fontStyle: 'normal' } },
  { label: 'Black Italic', style: { fontWeight: '900', letterSpacing: 0, fontStyle: 'italic' } },
  { label: 'Monospace', style: { fontWeight: '400', letterSpacing: 4, fontFamily: 'monospace' } },
  { label: 'Mono Bold', style: { fontWeight: '700', letterSpacing: 3, fontFamily: 'monospace' } },
  { label: 'Mono Caps', style: { fontWeight: '700', letterSpacing: 5, fontFamily: 'monospace', textTransform: 'uppercase' } },
  { label: 'Funky', style: { fontWeight: '800', fontStyle: 'italic', letterSpacing: 3, textTransform: 'uppercase' } },
  { label: 'Soft', style: { fontWeight: '300', fontStyle: 'normal', letterSpacing: 3 } },
  { label: 'Soft Bold', style: { fontWeight: '600', fontStyle: 'normal', letterSpacing: 2 } },
  { label: 'Cinematic', style: { fontWeight: '200', letterSpacing: 14, textTransform: 'uppercase' } },
  { label: 'Cinematic Bold', style: { fontWeight: '700', letterSpacing: 10, textTransform: 'uppercase' } },
  { label: 'Hype', style: { fontWeight: '900', fontStyle: 'italic', letterSpacing: 5, textTransform: 'uppercase' } },
  { label: 'Vibe', style: { fontWeight: '500', fontStyle: 'italic', letterSpacing: 6 } },
  { label: 'Vintage', style: { fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' } },
  { label: 'Vintage Light', style: { fontWeight: '300', letterSpacing: 4, textTransform: 'uppercase' } },
  { label: 'Futura', style: { fontWeight: '600', letterSpacing: 5, textTransform: 'uppercase' } },
  { label: 'Futura Light', style: { fontWeight: '200', letterSpacing: 7, textTransform: 'uppercase' } },
  { label: 'Logo', style: { fontWeight: '800', letterSpacing: -0.5 } },
  { label: 'Logo Italic', style: { fontWeight: '800', fontStyle: 'italic', letterSpacing: -0.5 } },
  { label: 'Tagline', style: { fontWeight: '400', fontStyle: 'italic', letterSpacing: 5, textTransform: 'uppercase' } },
];

const CORES_TEXTO = [
  '#FFFFFF','#000000','#FFD700','#FF4500','#00FF87','#00CFFF',
  '#FF69B4','#FF6347','#7CFC00','#BA55D3','#FF8C00','#1E90FF',
  '#E0E0E0','#FF1493','#00CED1','#ADFF2F','#FF00FF','#00FF00',
  '#FF7F50','#87CEEB',
];

const STICKER_GROUPS = [
  { key: 'funcoes', label: '⚡', title: 'Funções', isFuncoes: true },
  {
    key: 'engenharia', label: '⚙️', title: 'Engenharia',
    items: ['⚙️','🔧','🔩','🛠️','⛏️','🔨','🪛','🪚','🔬','🔭','📐','📏','🧱','🏗️','🏭','⚡','🔌','💡','🖥️','💻','🖨️','⌨️','🖱️','📱','📡','🛰️','🚀','✈️','🚁','⛽','🔋','🪫','🧲','💾','💿','📟','📠','☎️','🔦','🕯️','🔆','🌡️','⏱️','⏲️','⏰','🧯','🪜','🧰','📦','🗜️','⚖️'],
  },
  {
    key: 'medicina', label: '🏥', title: 'Medicina & Saúde',
    items: ['🏥','🩺','💊','💉','🩹','🩻','🧬','🦠','🩸','🫀','🫁','🧠','🦷','🦴','👁️','🧪','🧫','🔬','⚕️','🩼','🏋️','🧘','🚑','👨‍⚕️','👩‍⚕️','🥼','🧤','😷','🤒','🤕','💪','🫶','❤️','🩷','💛','🩵','💚','🩶','🤍','🩺','📋','📊','📈','📉','🗂️','📁'],
  },
  {
    key: 'mecanica', label: '🔧', title: 'Mecânica & Auto',
    items: ['🔧','🔩','⚙️','🛠️','🔨','🪛','🚗','🚕','🚙','🏎️','🚓','🚑','🚒','🚐','🚌','🚎','🏍️','🛵','🚲','🛺','⛽','🅿️','🛞','🔑','🗝️','🪝','⛓️','🔗','🧲','🔋','🔌','💡','🔦','🕯️','🪤','🧯','🪜','🧰','🗃️','🗄️','🗑️','📦','🛒','🏗️','🏭','🚧','⚠️','🚦','🚥','🛣️'],
  },
  {
    key: 'tecnologia', label: '💻', title: 'Tecnologia & TI',
    items: ['💻','🖥️','🖨️','⌨️','🖱️','📱','⌚','📡','🛰️','🔭','🔬','🧪','🧫','🧬','💾','💿','📀','📟','📠','☎️','📞','🔋','🔌','💡','🔦','📲','🖲️','🕹️','🎮','👾','🤖','🦾','🦿','🧠','🔐','🔒','🔓','🛡️','🔑','🗝️','🔏','📊','📈','📉','📋','📁','📂','🗂️','📄','📃','📑'],
  },
  {
    key: 'construcao', label: '🏗️', title: 'Construção',
    items: ['🏗️','🏛️','🏟️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','🗼','🗽','⛪','🕌','🛕','🕍','🗿','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🧱','🪵','🪨','🪜','🔨','⛏️','⚒️','🛠️','🪚','🔧','🔩','🗜️','⚙️','🔗','⛓️','🪝','🧰'],
  },
  {
    key: 'negocios', label: '💼', title: 'Negócios',
    items: ['💼','📊','📈','📉','💹','💰','💵','💴','💶','💷','💸','💳','🏦','🏧','💱','💲','🪙','🤑','📋','📁','📂','🗂️','📄','📃','📑','📅','📆','🗒️','🗓️','📇','📌','📍','✒️','🖊️','🖋️','✏️','🖌️','🖍️','📝','💡','🔍','🔎','🔏','🔐','🔒','🔓','🛡️','⚖️','🏆'],
  },
  {
    key: 'educacao', label: '📚', title: 'Educação',
    items: ['📚','📖','📝','✏️','🖊️','🖋️','📓','📔','📒','📕','📗','📘','📙','📃','📄','📑','🗒️','🎓','👨‍🎓','👩‍🎓','👨‍🏫','👩‍🏫','🏫','📐','📏','🔬','🔭','🧪','🧫','🧬','⚗️','🧲','💡','🌍','🌎','🌏','🗺️','🧭','🏔️','⭐','🌟','💫','✨','☀️','🌙','🪐','🌌','🔢','🔣','🔤'],
  },
];

// ── Helper ──
const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

// ── Waveform estático gerado uma vez ──
const WAVEFORM_BARS = Array.from({ length: 44 }, (_, i) => {
  const v = Math.sin(i * 0.72) * 0.32 + Math.sin(i * 1.4) * 0.18 + Math.sin(i * 0.38) * 0.14;
  return Math.max(0.12, Math.min(1, 0.5 + v));
});

// ══════════════════════════════════════════
//  COMPONENTE: PlayerVozCentral
//  Card centrado no ecrã — estilo WhatsApp
// ══════════════════════════════════════════
function PlayerVozCentral({ perfil, estado, gravandoSeg, player, playerStatus, onPressPlay, onSeekPct, onApagar, onEnviar }) {
  const pulsoAnim = useRef(new Animated.Value(1)).current;
  const barraWrapWidth = useRef(0);

  // Refs para garantir que o PanResponder use sempre os valores mais recentes (evita o erro "already released")
  const playerRef = useRef(player);
  const duracaoRef = useRef(playerStatus?.duration ?? 0);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { duracaoRef.current = playerStatus?.duration ?? 0; }, [playerStatus?.duration]);

  // Pulso animado durante gravação
  useEffect(() => {
    if (estado === 'gravando') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulsoAnim, { toValue: 1.3, duration: 550, useNativeDriver: true }),
          Animated.timing(pulsoAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulsoAnim.stopAnimation();
      pulsoAnim.setValue(1);
    }
  }, [estado]);

  // Dados do player via useAudioPlayerStatus (tempo real)
  const duracao = playerStatus?.duration ?? 0;
  const posicao = playerStatus?.currentTime ?? 0;
  const progresso = duracao > 0 ? posicao / duracao : 0;
  const aTocar = playerStatus?.playing ?? false;

  // Tempo a mostrar: durante gravação mostra segundos gravados; durante playback mostra posição real
  const timerDisplay = estado === 'gravando'
    ? fmt(gravandoSeg)
    : fmt(Math.round(posicao));

  // PanResponder na barra — seek proporcional à largura da barra
  const seekPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        // seek usando as refs atualizadas
        if (barraWrapWidth.current > 0 && duracaoRef.current > 0) {
          const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barraWrapWidth.current));
          try { playerRef.current?.seekTo(pct * duracaoRef.current); } catch (_) {}
        }
      },
      onPanResponderMove: (e) => {
        if (barraWrapWidth.current > 0 && duracaoRef.current > 0) {
          const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barraWrapWidth.current));
          try { playerRef.current?.seekTo(pct * duracaoRef.current); } catch (_) {}
        }
      },
    })
  ).current;

  const avatarUrl = perfil?.fotoURL || null;
  const iniciais = (perfil?.nome || 'U')[0].toUpperCase();

  return (
    <View style={pvStyles.card}>
      {/* Avatar + badge mic */}
      <View style={pvStyles.avatarWrap}>
        <View style={pvStyles.avatar}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={pvStyles.avatarImg} />
            : <Text style={pvStyles.avatarIniciais}>{iniciais}</Text>
          }
        </View>
        <View style={pvStyles.micBadge}>
          <Ionicons name="mic" size={10} color="#fff" />
        </View>
      </View>

      {/* Área central */}
      <View style={pvStyles.meio}>
        {estado === 'gravando' ? (
          /* ── A GRAVAR ── */
          <View style={pvStyles.gravandoRow}>
            <Animated.View style={[pvStyles.gravandoPonto, { transform: [{ scale: pulsoAnim }] }]} />
            <Text style={pvStyles.gravandoTimer}>{fmt(gravandoSeg)}</Text>
            <Text style={pvStyles.gravandoLabel}>A gravar...</Text>
          </View>
        ) : (
          /* ── GRAVADO: waveform interactiva ── */
          <View style={pvStyles.playerArea}>
            {/* Play / Pause */}
            <TouchableOpacity onPress={onPressPlay} style={pvStyles.playBtn} activeOpacity={0.8}>
              <Ionicons name={aTocar ? 'pause' : 'play'} size={20} color="#fff" />
            </TouchableOpacity>

            {/* Waveform tappable / draggable */}
            <View
              style={pvStyles.waveWrap}
              {...seekPan.panHandlers}
              onLayout={(e) => { barraWrapWidth.current = e.nativeEvent.layout.width; }}
            >
              {WAVEFORM_BARS.map((h, i) => {
                const filled = i / WAVEFORM_BARS.length <= progresso;
                return (
                  <View
                    key={i}
                    style={[
                      pvStyles.waveBar,
                      {
                        height: Math.max(3, h * 30),
                        backgroundColor: filled ? '#fff' : 'rgba(255,255,255,0.3)',
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Timer real */}
            <Text style={pvStyles.timerText}>{timerDisplay}</Text>
          </View>
        )}
      </View>

      {/* Botão lixo */}
      <TouchableOpacity onPress={onApagar} style={pvStyles.lixoBtn} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={21} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Botão enviar — só após gravar */}
      {estado === 'gravado' && (
        <TouchableOpacity onPress={onEnviar} style={pvStyles.enviarBtn} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── ItemMovivel ──
function ItemMovivel({ children, initialX, initialY, onRemove }) {
  const pos = useRef({ x: initialX, y: initialY });
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => setPosition({ x: pos.current.x + gs.dx, y: pos.current.y + gs.dy }),
      onPanResponderRelease: (_, gs) => { pos.current = { x: pos.current.x + gs.dx, y: pos.current.y + gs.dy }; },
    })
  ).current;
  return (
    <View style={[styles.itemMovivel, { left: position.x, top: position.y }]} {...panResponder.panHandlers}>
      {children}
      <TouchableOpacity style={styles.itemMovivelRemove} onPress={onRemove}>
        <Ionicons name="close-circle" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════
export default function CreateStoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, perfil } = useUser();

  const [fase, setFase] = useState('inicio');
  const [fotoSelecionada, setFotoSelecionada] = useState(null);
  const [texto, setTexto] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisibilidade, setModalVisibilidade] = useState(false);
  const [visibilidade, setVisibilidade] = useState('publico');
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [mostrarLink, setMostrarLink] = useState(false);
  const [fotosGaleria, setFotosGaleria] = useState([]);
  const [carregandoGaleria, setCarregandoGaleria] = useState(true);

  const [corFundo, setCorFundo] = useState('#0F172A');
  const corFundoIndex = useRef(0);
  const [estiloLetraIndex, setEstiloLetraIndex] = useState(0);
  const [corTexto, setCorTexto] = useState('#FFFFFF');
  const [tamanhoTexto, setTamanhoTexto] = useState(26);
  const [stickersAdicionados, setStickersAdicionados] = useState([]);
  const pinchRef = useRef({ dist: null, tamanhoInicial: 26 });

  const [mostrarBottomSheet, setMostrarBottomSheet] = useState(false);
  const [abaBottomSheet, setAbaBottomSheet] = useState('funcoes');
  const [localizacao, setLocalizacao] = useState(null);
  const [mostrarVozGravador, setMostrarVozGravador] = useState(false);
  const [mostrarPainelLetras, setMostrarPainelLetras] = useState(false);
  const [mostrarPainelCores, setMostrarPainelCores] = useState(false);

  // ── Estado de voz ──
  // vozEstado: 'idle' | 'gravando' | 'gravado'
  const [vozEstado, setVozEstado] = useState('idle');
  const [vozSegundos, setVozSegundos] = useState(0); // segundos gravados (timer manual)
  const [vozUri, setVozUri] = useState(null);
  const vozTimerRef = useRef(null);

  // Recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Player — só activo quando vozUri existe
  const vozPlayer = useAudioPlayer(vozUri ? { uri: vozUri } : null);
  // Hook oficial para status em tempo real (posição, duração, playing, didJustFinish)
  const vozPlayerStatus = useAudioPlayerStatus(vozPlayer);

  // Detectar fim da reprodução via didJustFinish
  useEffect(() => {
    if (vozPlayerStatus?.didJustFinish) {
      try { vozPlayer.seekTo(0); } catch (_) {}
    }
  }, [vozPlayerStatus?.didJustFinish]);

  // ── Duração real do áudio para tempo de visualização do story ──
  // Usamos vozPlayerStatus.duration (em segundos) quando disponível,
  // caso contrário fallback para vozSegundos gravados.
  const vozDuracaoReal = vozPlayerStatus?.duration > 0
    ? Math.ceil(vozPlayerStatus.duration)
    : vozSegundos;

  const vozIniciarGravacao = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permissão necessária', 'Precisamos de acesso ao microfone.'); return; }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setVozEstado('gravando');
      setVozSegundos(0);
      setVozUri(null);
      vozTimerRef.current = setInterval(() => setVozSegundos(s => s + 1), 1000);
    } catch (e) { Alert.alert('Erro', 'Não foi possível iniciar a gravação.'); }
  };

  const vozPararGravacao = async () => {
    try {
      clearInterval(vozTimerRef.current);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setVozUri(uri);
      setVozEstado('gravado');
    } catch (e) { setVozEstado('idle'); }
  };

  const vozTogglePlay = () => {
    if (!vozUri) return;
    try {
      if (vozPlayerStatus?.playing) { vozPlayer.pause(); }
      else { vozPlayer.play(); }
    } catch (_) {}
  };

  const vozApagar = () => {
    try { vozPlayer.pause(); } catch (_) {}
    clearInterval(vozTimerRef.current);
    setVozEstado('idle');
    setVozSegundos(0);
    setVozUri(null);
    setMostrarVozGravador(false);
  };

  const vozEnviar = () => {
    if (!vozUri) { Alert.alert('Erro', 'Sem gravação para enviar.'); return; }
    // Parar reprodução antes de publicar
    try { vozPlayer.pause(); } catch (_) {}
    publicarStoryComVoz(vozUri, vozDuracaoReal);
  };

  useEffect(() => { carregarGaleria(); }, []);

  const carregarGaleria = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.'); setCarregandoGaleria(false); return; }
      const media = await MediaLibrary.getAssetsAsync({ mediaType: MediaLibrary.MediaType.photo, first: 60, sortBy: MediaLibrary.SortBy.creationTime });
      setFotosGaleria(media.assets);
    } catch (e) { console.log('Erro galeria:', e); }
    finally { setCarregandoGaleria(false); }
  };

  const resetarEditor = () => {
    setLoading(false);
    setFotoSelecionada(null); setTexto(''); setLink('');
    setMostrarTexto(false); setMostrarLink(false);
    setCorFundo('#0F172A'); corFundoIndex.current = 0;
    setEstiloLetraIndex(0); setCorTexto('#FFFFFF'); setTamanhoTexto(26);
    setStickersAdicionados([]); setLocalizacao(null);
    setMostrarBottomSheet(false); setMostrarPainelLetras(false); setMostrarPainelCores(false);
    setMostrarVozGravador(false);
    try { vozPlayer.pause(); } catch (_) {}
    clearInterval(vozTimerRef.current);
    setVozEstado('idle'); setVozSegundos(0); setVozUri(null);
  };

  const voltarParaInicio = () => { resetarEditor(); setFase('inicio'); };

  const tocarFundo = () => {
    if (mostrarBottomSheet || mostrarPainelLetras || mostrarPainelCores) {
      setMostrarBottomSheet(false); setMostrarPainelLetras(false); setMostrarPainelCores(false); return;
    }
    corFundoIndex.current = (corFundoIndex.current + 1) % CORES_FUNDO.length;
    setCorFundo(CORES_FUNDO[corFundoIndex.current]);
  };

  const handleTouchStart = (e) => {
    if (e.nativeEvent.touches.length === 2) {
      const [t1, t2] = e.nativeEvent.touches;
      pinchRef.current = { dist: Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY), tamanhoInicial: tamanhoTexto };
    }
  };
  const handleTouchMove = (e) => {
    if (e.nativeEvent.touches.length === 2) {
      const [t1, t2] = e.nativeEvent.touches;
      const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
      setTamanhoTexto(Math.round(Math.min(72, Math.max(12, pinchRef.current.tamanhoInicial * (dist / (pinchRef.current.dist || dist))))));
    }
  };

  const adicionarSticker = (emoji) => {
    setStickersAdicionados(prev => [...prev, { id: Date.now().toString(), emoji, x: width / 2 - 30, y: height / 2 - 120 }]);
    setMostrarBottomSheet(false);
  };

  const adicionarLocalizacao = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à localização.'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const nome = geo ? `${geo.city || geo.district || ''}, ${geo.country || ''}`.replace(/^,\s*|,\s*$/g, '') : 'Localização atual';
      setLocalizacao(nome);
      setMostrarBottomSheet(false);
    } catch (e) { Alert.alert('Erro', 'Não foi possível obter a localização.'); }
  };

  const selecionarFotoDaGaleria = async (foto) => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(foto);
      const uri = info.localUri || foto.uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => { setFotoSelecionada({ uri, base64: reader.result.split(',')[1] }); setFase('editor'); };
      reader.readAsDataURL(blob);
    } catch (e) { setFotoSelecionada({ uri: foto.uri, base64: null }); setFase('editor'); }
  };

  const abrirGaleriaNativa = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.8, base64: true });
    if (!result.canceled) { setFotoSelecionada({ uri: result.assets[0].uri, base64: result.assets[0].base64 }); setFase('editor'); }
  };

  const abrirCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [9, 16], quality: 0.8, base64: true });
    if (!result.canceled) { setFotoSelecionada({ uri: result.assets[0].uri, base64: result.assets[0].base64 }); setFase('editor'); }
  };

  const abrirEditorVoz = () => {
    resetarEditor();
    setFase('editor');
    setMostrarVozGravador(true);
  };

  const publicarStory = async () => {
    if (!texto.trim() && !fotoSelecionada) {
      Alert.alert('Atenção', 'Adiciona uma foto ou texto ao Destaque.');
      return;
    }
    setLoading(true);
    try {
      const agora = new Date();
      const expiraEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
      await addDoc(collection(db, 'stories'), {
        uid: user?.uid,
        autorNome: perfil?.nome || 'Utilizador',
        autorFoto: perfil?.fotoURL || null,
        autorCargo: perfil?.cargo || '',
        texto: texto.trim(),
        link: link.trim(),
        fotoBase64: fotoSelecionada?.base64 || null,
        fotoUri: fotoSelecionada?.uri || null,
        tipo: fotoSelecionada ? 'foto' : 'texto',
        visibilidade,
        localizacao: localizacao || null,
        audioUri: null,
        audioDuracao: null,
        corFundo,
        estiloLetraIndex,
        corTexto,
        tamanhoTexto,
        stickers: stickersAdicionados.map(s => ({ emoji: s.emoji, x: s.x, y: s.y, isText: s.isText || false })),
        timestamp: serverTimestamp(),
        expiraEm: expiraEm.toISOString(),
        vistoPor: [],
      });
      setLoading(false);
      resetarEditor();
      setFase('inicio');
      router.replace({ pathname: '/(main)/feed', params: { storyPublicado: '1' } });
    } catch (err) {
      console.error(err);
      setLoading(false);
      Alert.alert('Erro', 'Não foi possível publicar o seu Destaque.');
    }
  };

  // audioDuracao: tempo real do áudio em segundos (para o viewer saber quanto mostrar)
  const publicarStoryComVoz = async (audioUri, audioDuracao) => {
    setLoading(true);
    try {
      const agora = new Date();
      // Tempo de visualização = duração do áudio + 2s de margem (mínimo 5s)
      const tempoVis = Math.max(5, audioDuracao + 2);
      const expiraEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
      await addDoc(collection(db, 'stories'), {
        uid: user?.uid,
        autorNome: perfil?.nome || 'Utilizador',
        autorFoto: perfil?.fotoURL || null,
        autorCargo: perfil?.cargo || '',
        texto: '',
        link: '',
        fotoBase64: null,
        fotoUri: null,
        tipo: 'voz',
        visibilidade,
        localizacao: null,
        audioUri,
        audioDuracao: tempoVis, // tempo de visualização em segundos
        corFundo,
        estiloLetraIndex: 0,
        corTexto: '#FFFFFF',
        tamanhoTexto: 26,
        stickers: [],
        timestamp: serverTimestamp(),
        expiraEm: expiraEm.toISOString(),
        vistoPor: [],
      });
      setLoading(false);
      resetarEditor();
      setFase('inicio');
      router.replace({ pathname: '/(main)/feed', params: { storyPublicado: '1' } });
    } catch (err) {
      console.error(err);
      setLoading(false);
      Alert.alert('Erro', 'Não foi possível publicar a história de voz.');
    }
  };

  const visibilidadeLabel = { publico: 'Público', ligacoes: 'Ligações', exceto: 'Ligações, exceto...', personalizar: 'Personalizado' }[visibilidade];

  const renderFotoGaleria = ({ item }) => (
    <TouchableOpacity onPress={() => selecionarFotoDaGaleria(item)} activeOpacity={0.85} style={{ margin: 1 }}>
      <Image source={{ uri: item.uri }} style={{ width: FOTO_SIZE, height: FOTO_SIZE }} resizeMode="cover" />
    </TouchableOpacity>
  );

  const RodapeGaleria = () => (
    <TouchableOpacity style={styles.verMaisBtn} onPress={abrirGaleriaNativa} activeOpacity={0.8}>
      <Ionicons name="images-outline" size={20} color="#2563EB" />
      <Text style={styles.verMaisText}>Abrir galeria completa</Text>
      <Ionicons name="chevron-forward" size={16} color="#2563EB" />
    </TouchableOpacity>
  );

  const renderBottomSheet = () => {
    const grupoAtual = STICKER_GROUPS.find(g => g.key === abaBottomSheet);
    return (
      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />
        {abaBottomSheet === 'funcoes' && (
          <ScrollView style={styles.bottomSheetContent}>
            <View style={styles.funcoesGrid}>
              <TouchableOpacity style={styles.funcaoBtn} onPress={() => {
                const h = new Date();
                const str = `${h.getHours().toString().padStart(2,'0')}:${h.getMinutes().toString().padStart(2,'0')}`;
                setStickersAdicionados(prev => [...prev, { id: Date.now().toString(), emoji: str, x: width/2-40, y: height/2-100, isText: true }]);
                setMostrarBottomSheet(false);
              }}>
                <View style={styles.funcaoBtnIcone}><Text style={styles.funcaoHora}>{new Date().getHours().toString().padStart(2,'0')}:{new Date().getMinutes().toString().padStart(2,'0')}</Text></View>
                <Text style={styles.funcaoBtnLabel}>Hora</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.funcaoBtn} onPress={adicionarLocalizacao}>
                <View style={styles.funcaoBtnIcone}><Ionicons name="location" size={22} color="#2563EB" /></View>
                <Text style={styles.funcaoBtnLabel}>Localização</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.funcaoBtn} onPress={() => { setMostrarLink(!mostrarLink); setMostrarBottomSheet(false); }}>
                <View style={styles.funcaoBtnIcone}><Ionicons name="link" size={22} color="#2563EB" /></View>
                <Text style={styles.funcaoBtnLabel}>Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.funcaoBtn} onPress={() => { setMostrarTexto(true); setMostrarBottomSheet(false); }}>
                <View style={styles.funcaoBtnIcone}><Ionicons name="text" size={22} color="#2563EB" /></View>
                <Text style={styles.funcaoBtnLabel}>Texto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.funcaoBtn} onPress={() => { setMostrarPainelCores(true); setMostrarBottomSheet(false); }}>
                <View style={styles.funcaoBtnIcone}><Ionicons name="color-palette" size={22} color="#2563EB" /></View>
                <Text style={styles.funcaoBtnLabel}>Cor</Text>
              </TouchableOpacity>
            </View>
            {localizacao && (
              <View style={styles.localizacaoPreview}>
                <Ionicons name="location" size={16} color="#2563EB" />
                <Text style={styles.localizacaoText}>{localizacao}</Text>
                <TouchableOpacity onPress={() => setLocalizacao(null)}><Ionicons name="close-circle" size={16} color="#E63946" /></TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
        {abaBottomSheet !== 'funcoes' && (
          <ScrollView style={styles.bottomSheetContent}>
            <View style={styles.emojiGrid}>
              {(grupoAtual?.items || []).map((emoji, i) => (
                <TouchableOpacity key={i} style={styles.emojiItem} onPress={() => adicionarSticker(emoji)}>
                  <Text style={styles.emojiItemText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bottomTabsBar} contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
          <TouchableOpacity style={[styles.bottomTab, abaBottomSheet === 'funcoes' && styles.bottomTabAtivo]} onPress={() => setAbaBottomSheet('funcoes')}>
            <Ionicons name="flash" size={20} color={abaBottomSheet === 'funcoes' ? '#2563EB' : 'rgba(255,255,255,0.5)'} />
          </TouchableOpacity>
          {STICKER_GROUPS.filter(g => !g.isFuncoes).map(g => (
            <TouchableOpacity key={g.key} style={[styles.bottomTab, abaBottomSheet === g.key && styles.bottomTabAtivo]} onPress={() => setAbaBottomSheet(g.key)}>
              <Text style={styles.bottomTabIcon}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ══════════════════════════════════════
  //  TELA INÍCIO
  // ══════════════════════════════════════
  if (fase === 'inicio') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(main)/feed')} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>História nova</Text>
          <TouchableOpacity onPress={() => setModalVisibilidade(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={24} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Opções rápidas — só Texto e Voz (sem Foto/Câmara aqui) */}
        <View style={styles.opcoesRapidasRow}>
          <TouchableOpacity style={styles.opcaoRapida} onPress={() => { setFotoSelecionada(null); setFase('editor'); setMostrarTexto(true); }} activeOpacity={0.7}>
            <View style={styles.opcaoRapidaIcone}><Ionicons name="text" size={26} color="#111" /></View>
            <Text style={styles.opcaoRapidaLabel}>Texto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.opcaoRapida} onPress={abrirEditorVoz} activeOpacity={0.7}>
            <View style={styles.opcaoRapidaIcone}><Ionicons name="mic-outline" size={26} color="#111" /></View>
            <Text style={styles.opcaoRapidaLabel}>Voz</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.galeriaHeader}><Text style={styles.galeriaTitulo}>Galeria</Text></View>

        {carregandoGaleria ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#2563EB" /></View>
        ) : fotosGaleria.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Ionicons name="images-outline" size={40} color="#CBD5E1" />
            <Text style={styles.semFotosText}>Sem fotos disponíveis</Text>
            <TouchableOpacity style={styles.verMaisBtn} onPress={abrirGaleriaNativa}>
              <Ionicons name="images-outline" size={20} color="#2563EB" /><Text style={styles.verMaisText}>Abrir galeria</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList data={fotosGaleria} keyExtractor={item => item.id} numColumns={3} renderItem={renderFotoGaleria} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} ListFooterComponent={RodapeGaleria} />
        )}

        <Modal visible={modalVisibilidade} transparent animationType="slide" onRequestClose={() => setModalVisibilidade(false)}>
          <View style={styles.modalFundo}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <TouchableOpacity onPress={() => setModalVisibilidade(false)}><Ionicons name="arrow-back" size={22} color="#111" /></TouchableOpacity>
              </View>
              <Text style={styles.modalTitulo}>Quem pode ver o teu destaque?</Text>
              <Text style={styles.modalSub}>O seu destaque vai ficar visível no ConnectAll durante 24 horas, ative o plano pago para um limite maior</Text>
              {[
                { key: 'publico', label: 'Público', sub: 'Qualquer pessoa no ConnectAll', icone: 'globe-outline' },
                { key: 'ligacoes', label: 'Ligações', sub: 'Apenas as tuas ligações', icone: 'people-outline' },
                { key: 'exceto', label: 'Ligações, exceto...', sub: 'Selecionar ligações', icone: 'person-remove-outline' },
                { key: 'personalizar', label: 'Personalizado', sub: 'Personalizado', icone: 'create-outline' },
              ].map(op => (
                <TouchableOpacity key={op.key} style={styles.visOpcao} onPress={() => setVisibilidade(op.key)}>
                  <View style={styles.visOpcaoIcone}><Ionicons name={op.icone} size={20} color="#111" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visOpcaoLabel}>{op.label}</Text>
                    <Text style={styles.visOpcaoSub}>{op.sub}</Text>
                  </View>
                  <View style={[styles.radioCirculo, visibilidade === op.key && styles.radioCirculoAtivo]}>
                    {visibilidade === op.key && <View style={styles.radioPonto} />}
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.guardarBtn} onPress={() => setModalVisibilidade(false)}>
                <Text style={styles.guardarBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════
  //  EDITOR — MODO VOZ
  // ══════════════════════════════════════
  if (fase === 'editor' && mostrarVozGravador) {
    return (
      <View style={[styles.editorWrap, { backgroundColor: corFundo }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Fundo tappable para mudar cor — apenas quando não está a gravar */}
        {vozEstado !== 'gravando' && (
          <TouchableWithoutFeedback onPress={tocarFundo}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}

        {/* Topo */}
        <SafeAreaView style={styles.editorTopSafe}>
          <View style={styles.editorHeader}>
            <TouchableOpacity onPress={voltarParaInicio} style={styles.editorCloseBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.editorTitulo}>🎨 Toca no fundo p/ mudar cor</Text>
            <TouchableOpacity onPress={() => setModalVisibilidade(true)} style={styles.editorVisBtn}>
              <Ionicons name="eye-outline" size={16} color="#fff" />
              <Text style={styles.editorVisBtnText}>{visibilidadeLabel}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Centro — player centrado verticalmente */}
        <View style={styles.vozEcraCenter}>
          {vozEstado === 'idle' && (
            <View style={styles.vozIdleWrap}>
              <Ionicons name="mic-outline" size={56} color="rgba(255,255,255,0.28)" />
              <Text style={styles.vozIdleTexto}>
                Mantém pressionado o microfone{'\n'}para começar a gravar
              </Text>
            </View>
          )}

          {/* Card do player — visível quando gravando ou gravado */}
          {(vozEstado === 'gravando' || vozEstado === 'gravado') && (
            <View style={styles.vozPlayerCardWrap}>
              <PlayerVozCentral
                perfil={perfil}
                estado={vozEstado}
                gravandoSeg={vozSegundos}
                player={vozPlayer}
                playerStatus={vozPlayerStatus}
                onPressPlay={vozTogglePlay}
                onApagar={vozApagar}
                onEnviar={vozEnviar}
              />
            </View>
          )}
        </View>

        {/* Rodapé — tabs Texto/Voz + botão mic; esconde após gravar */}
        {vozEstado !== 'gravado' && (
          <View style={styles.vozRodape}>
            <View style={styles.vozTabsRow}>
              <TouchableOpacity
                style={styles.vozTab}
                onPress={() => { resetarEditor(); setFase('editor'); setMostrarTexto(true); }}
              >
                <Text style={styles.vozTabLabel}>Texto</Text>
              </TouchableOpacity>
              <View style={styles.vozTabAtivo}>
                <Text style={styles.vozTabLabelAtivo}>Voz</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.vozMicBtn, vozEstado === 'gravando' && styles.vozMicBtnAtivo]}
              onLongPress={vozIniciarGravacao}
              onPressOut={() => { if (vozEstado === 'gravando') vozPararGravacao(); }}
              delayLongPress={150}
              activeOpacity={0.85}
            >
              <Ionicons
                name={vozEstado === 'gravando' ? 'mic' : 'mic-outline'}
                size={30}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Overlay de publicação — UMA ÚNICA ActivityIndicator */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingOverlayText}>A publicar...</Text>
          </View>
        )}
      </View>
    );
  }

  // ══════════════════════════════════════
  //  EDITOR — MODO NORMAL (foto / texto)
  // ══════════════════════════════════════
  const estiloLetraAtual = ESTILOS_LETRA[estiloLetraIndex].style;

  return (
    <View style={styles.editorWrap}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <TouchableWithoutFeedback onPress={tocarFundo}>
        <View
          style={[styles.editorFundo, { backgroundColor: fotoSelecionada ? 'transparent' : corFundo }]}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          {fotoSelecionada && <Image source={{ uri: fotoSelecionada.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          <View style={styles.editorOverlay} />
        </View>
      </TouchableWithoutFeedback>

      {stickersAdicionados.map(s => (
        <ItemMovivel key={s.id} initialX={s.x} initialY={s.y} onRemove={() => setStickersAdicionados(prev => prev.filter(x => x.id !== s.id))}>
          <Text style={s.isText ? styles.stickerHora : styles.stickerEmoji}>{s.emoji}</Text>
        </ItemMovivel>
      ))}

      {localizacao && (
        <ItemMovivel initialX={width / 2 - 80} initialY={height * 0.15} onRemove={() => setLocalizacao(null)}>
          <View style={styles.localizacaoSticker}>
            <Ionicons name="location" size={14} color="#fff" />
            <Text style={styles.localizacaoStickerText}>{localizacao}</Text>
          </View>
        </ItemMovivel>
      )}

      {mostrarTexto && (
        <ItemMovivel initialX={width / 2 - 140} initialY={height * 0.3} onRemove={() => { setMostrarTexto(false); setTexto(''); }}>
          <TextInput
            style={[styles.textoInput, { fontSize: tamanhoTexto, color: corTexto, ...estiloLetraAtual }]}
            placeholder="Escreve algo..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline value={texto} onChangeText={setTexto} autoFocus
          />
        </ItemMovivel>
      )}

      <SafeAreaView style={styles.editorTopSafe}>
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={voltarParaInicio} style={styles.editorCloseBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.editorTitulo}>{fotoSelecionada ? 'Pré-visualização' : '🎨 Toca no fundo p/ mudar cor'}</Text>
          <TouchableOpacity onPress={() => setModalVisibilidade(true)} style={styles.editorVisBtn}>
            <Ionicons name="eye-outline" size={16} color="#fff" />
            <Text style={styles.editorVisBtnText}>{visibilidadeLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ferramentasRow}>
          <TouchableOpacity style={[styles.ferramentaBtn, mostrarTexto && styles.ferramentaBtnAtivo]} onPress={() => { setMostrarTexto(!mostrarTexto); setMostrarBottomSheet(false); }}>
            <Ionicons name="text" size={15} color="#fff" /><Text style={styles.ferramentaLabel}>Texto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ferramentaBtn, mostrarPainelLetras && styles.ferramentaBtnAtivo]} onPress={() => { setMostrarPainelLetras(!mostrarPainelLetras); setMostrarPainelCores(false); setMostrarBottomSheet(false); }}>
            <Ionicons name="options-outline" size={15} color="#fff" /><Text style={styles.ferramentaLabel}>Estilo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ferramentaBtn, mostrarPainelCores && styles.ferramentaBtnAtivo]} onPress={() => { setMostrarPainelCores(!mostrarPainelCores); setMostrarPainelLetras(false); setMostrarBottomSheet(false); }}>
            <Ionicons name="color-palette-outline" size={15} color="#fff" /><Text style={styles.ferramentaLabel}>Cor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ferramentaBtn, mostrarBottomSheet && styles.ferramentaBtnAtivo]} onPress={() => { setMostrarBottomSheet(!mostrarBottomSheet); setMostrarPainelCores(false); setMostrarPainelLetras(false); setAbaBottomSheet('funcoes'); }}>
            <Ionicons name="apps-outline" size={15} color="#fff" /><Text style={styles.ferramentaLabel}>+</Text>
          </TouchableOpacity>
        </View>

        {mostrarPainelLetras && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.painelScroll} contentContainerStyle={{ paddingHorizontal: 10, gap: 6, paddingVertical: 8 }}>
            {ESTILOS_LETRA.map((el, i) => (
              <TouchableOpacity key={i} style={[styles.estiloLetraBtn, estiloLetraIndex === i && styles.estiloLetraBtnAtivo]} onPress={() => setEstiloLetraIndex(i)}>
                <Text style={[styles.estiloLetraTexto, el.style, estiloLetraIndex === i && { color: '#2563EB' }]}>{el.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {mostrarPainelCores && (
          <View style={styles.painelCores}>
            <Text style={styles.painelCoresTitulo}>Cor do texto</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 4 }}>
              {CORES_TEXTO.map((cor, i) => (
                <TouchableOpacity key={i} style={[styles.bolaCor, { backgroundColor: cor }, corTexto === cor && styles.bolaCorAtiva]} onPress={() => setCorTexto(cor)} />
              ))}
            </ScrollView>
            <Text style={[styles.painelCoresTitulo, { marginTop: 10 }]}>Cor do fundo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 4 }}>
              {CORES_FUNDO.map((cor, i) => (
                <TouchableOpacity key={i} style={[styles.bolaCor, { backgroundColor: cor }, corFundo === cor && styles.bolaCorAtiva]} onPress={() => { setCorFundo(cor); corFundoIndex.current = i; }} />
              ))}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      {mostrarLink && (
        <View style={styles.linkBloco}>
          <Ionicons name="link-outline" size={16} color="rgba(255,255,255,0.6)" />
          <TextInput style={styles.linkInput} placeholder="https://..." placeholderTextColor="rgba(255,255,255,0.4)" autoCapitalize="none" keyboardType="url" value={link} onChangeText={setLink} />
        </View>
      )}

      {mostrarBottomSheet && renderBottomSheet()}

      <View style={styles.editorRodape}>
        <View style={styles.editorAutorRow}>
          <View style={styles.editorAutorAvatar}>
            {perfil?.fotoURL
              ? <Image source={{ uri: perfil.fotoURL }} style={styles.editorAutorAvatarImg} />
              : <Text style={styles.editorAutorIniciais}>{(perfil?.nome || 'U')[0].toUpperCase()}</Text>
            }
          </View>
          <View>
            <Text style={styles.editorAutorNome}>{perfil?.nome || 'Utilizador'}</Text>
            <Text style={styles.editorAutorSub}>Visível por 24 horas · {visibilidadeLabel}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.publicarBtn, loading && { opacity: 0.6 }]} onPress={publicarStory} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Text style={styles.publicarBtnText}>Publicar história</Text><Ionicons name="arrow-forward" size={16} color="#fff" /></>
          }
        </TouchableOpacity>
      </View>

      {/* Overlay de publicação no editor normal */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingOverlayText}>A publicar...</Text>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════
//  ESTILOS — PlayerVozCentral
// ══════════════════════════════════════════
const pvStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    width: '100%',
  },
  avatarWrap: {
    position: 'relative',
    width: 46,
    height: 46,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#444',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarIniciais: { color: '#fff', fontSize: 17, fontWeight: '700' },
  micBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.4)',
  },
  meio: { flex: 1 },
  gravandoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gravandoPonto: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#E63946',
  },
  gravandoTimer: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 1.5 },
  gravandoLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  playerArea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 34,
    // Área de toque generosa
    paddingVertical: 4,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 3,
  },
  timerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    minWidth: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  lixoBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ══════════════════════════════════════════
//  ESTILOS GERAIS
// ══════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  closeBtn: { padding: 4 },
  settingsBtn: { padding: 4 },
  headerTitulo: { fontSize: 17, fontWeight: '700', color: '#111' },
  // Opções rápidas — 2 itens (Texto + Voz)
  opcoesRapidasRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 12, backgroundColor: '#fff' },
  opcaoRapida: { flex: 1, alignItems: 'center', gap: 8 },
  opcaoRapidaIcone: { width: '100%', aspectRatio: 1, backgroundColor: '#F3F3F3', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  opcaoRapidaLabel: { fontSize: 13, fontWeight: '500', color: '#111' },
  galeriaHeader: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  galeriaTitulo: { fontSize: 16, fontWeight: '700', color: '#111' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  semFotosText: { fontSize: 14, color: '#94A3B8' },
  verMaisBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginHorizontal: 16, marginTop: 8, marginBottom: 8, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  verMaisText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 },
  modalSub: { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 20 },
  visOpcao: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F3F3' },
  visOpcaoIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center' },
  visOpcaoLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  visOpcaoSub: { fontSize: 12, color: '#888', marginTop: 2 },
  radioCirculo: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  radioCirculoAtivo: { borderColor: '#2563EB' },
  radioPonto: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563EB' },
  guardarBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  guardarBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Editor geral ──
  editorWrap: { flex: 1, backgroundColor: '#000' },
  editorFundo: { position: 'absolute', width, height },
  editorOverlay: { position: 'absolute', width, height, backgroundColor: 'rgba(0,0,0,0.2)' },
  editorTopSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  editorCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  editorTitulo: { fontSize: 12, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: 6 },
  editorVisBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  editorVisBtnText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  ferramentasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
  ferramentaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  ferramentaBtnAtivo: { backgroundColor: 'rgba(37,99,235,0.75)' },
  ferramentaLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  painelScroll: { backgroundColor: 'rgba(0,0,0,0.7)' },
  estiloLetraBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', minWidth: 68, alignItems: 'center' },
  estiloLetraBtnAtivo: { backgroundColor: 'rgba(255,255,255,0.9)' },
  estiloLetraTexto: { color: '#fff', fontSize: 12 },
  painelCores: { backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 10 },
  painelCoresTitulo: { fontSize: 10, color: 'rgba(255,255,255,0.5)', paddingHorizontal: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  bolaCor: { width: 28, height: 28, borderRadius: 14 },
  bolaCorAtiva: { borderWidth: 3, borderColor: '#fff' },
  textoInput: { minWidth: 180, maxWidth: width - 60, color: '#fff', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8, minHeight: 40, padding: 8 },
  itemMovivel: { position: 'absolute', zIndex: 30 },
  itemMovivelRemove: { position: 'absolute', top: -10, right: -10, zIndex: 31, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10 },
  stickerEmoji: { fontSize: 48 },
  stickerHora: { fontSize: 28, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  localizacaoSticker: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(37,99,235,0.85)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  localizacaoStickerText: { color: '#fff', fontSize: 13, fontWeight: '600', maxWidth: 160 },
  linkBloco: { position: 'absolute', bottom: 180, left: 24, right: 24, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  linkInput: { flex: 1, color: '#fff', fontSize: 14 },
  bottomSheet: { position: 'absolute', bottom: 155, left: 0, right: 0, zIndex: 50, backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: height * 0.52 },
  bottomSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  bottomSheetContent: { maxHeight: height * 0.38, paddingHorizontal: 4 },
  funcoesGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12, justifyContent: 'center' },
  funcaoBtn: { alignItems: 'center', gap: 6, width: (width - 80) / 4 },
  funcaoBtnIcone: { width: 58, height: 58, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  funcaoBtnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  funcaoHora: { fontSize: 14, fontWeight: '700', color: '#fff' },
  localizacaoPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(37,99,235,0.2)', borderRadius: 12, marginHorizontal: 12, marginTop: 6, marginBottom: 4, padding: 12 },
  localizacaoText: { flex: 1, color: '#fff', fontSize: 13 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
  emojiItem: { width: width / 8, height: 46, alignItems: 'center', justifyContent: 'center' },
  emojiItemText: { fontSize: 28 },
  bottomTabsBar: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingVertical: 5, maxHeight: 52 },
  bottomTab: { width: 44, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  bottomTabAtivo: { backgroundColor: 'rgba(37,99,235,0.3)' },
  bottomTabIcon: { fontSize: 22 },
  editorRodape: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.55)', gap: 14 },
  editorAutorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editorAutorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  editorAutorAvatarImg: { width: '100%', height: '100%' },
  editorAutorIniciais: { color: '#fff', fontSize: 14, fontWeight: '700' },
  editorAutorNome: { fontSize: 14, fontWeight: '600', color: '#fff' },
  editorAutorSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  publicarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14 },
  publicarBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Ecrã de voz ──
  // Centro do ecrã — player fica centrado
  vozEcraCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 100, // espaço para o header
    paddingBottom: 180, // espaço para o rodapé
  },
  vozIdleWrap: { alignItems: 'center', gap: 18 },
  vozIdleTexto: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  vozPlayerCardWrap: { width: '100%' },

  vozRodape: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 18,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    gap: 18,
  },
  vozTabsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  vozTab: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20 },
  vozTabLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: '500' },
  vozTabAtivo: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  vozTabLabelAtivo: { color: '#fff', fontSize: 15, fontWeight: '700' },
  vozMicBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  vozMicBtnAtivo: {
    backgroundColor: '#E63946',
    transform: [{ scale: 1.12 }],
  },

  // ── Loading overlay — único, sem duplicado ──
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  loadingOverlayText: {
    color: '#fff',
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
  },
});