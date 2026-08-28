/**
 * PostMedia.jsx — ConnectAll Angola
 */

import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

function normalizarMedia(mediaUrls) {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls
    .map(m => ({
      url:  typeof m === 'string' ? m : m?.url,
      type: typeof m === 'string'
        ? (m.match(/\.(mp4|mov|avi|mkv|webm)/i) ? 'video' : 'image')
        : (m?.type || 'image'),
    }))
    .filter(m => !!m.url);
}

// ════════════════════════════════════════════════════════════════════════════
// VIDEO
// ════════════════════════════════════════════════════════════════════════════
function VideoPost({ url, post, acoes, onAbrirComentarios }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [mutado,     setMutado]     = useState(false);
  const [pronto,     setPronto]     = useState(false);
  const [thumbnail,  setThumbnail]  = useState(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    let cancelado = false;
    VideoThumbnails.getThumbnailAsync(url, { time: 0, quality: 0.7 })
      .then(({ uri }) => { if (!cancelado && montado.current) setThumbnail(uri); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [url]);

  const player = useVideoPlayer(url, p => {
    if (!p) return;
    p.loop  = true;
    p.muted = false;
  });

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      try { player?.pause(); player?.release?.(); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    if (!player) return;
    try {
      if (fullscreen) {
        player.muted = mutado;
        player.play();
      } else {
        player.pause();
        setPronto(false);
      }
    } catch (_) {}
  }, [fullscreen]);

  useEffect(() => {
    if (!player) return;
    try { player.muted = mutado; } catch (_) {}
  }, [mutado]);

  useEffect(() => {
    if (!player) return;
    let unsub;
    try {
      unsub = player.addListener('statusChange', (status) => {
        if (!montado.current) return;
        if (status?.status === 'readyToPlay' || status?.status === 'playing') {
          setPronto(true);
        }
      });
    } catch (_) {}
    const fallback = setTimeout(() => {
      if (montado.current && fullscreen) setPronto(true);
    }, 2000);
    return () => {
      try { unsub?.remove?.(); } catch (_) {}
      clearTimeout(fallback);
    };
  }, [player, fullscreen]);

  const abrirFullscreen = () => {
    setPronto(false);
    setFullscreen(true);
  };

  return (
    <>
      {/* ── FEED ── */}
      <TouchableOpacity style={vf.container} activeOpacity={0.92} onPress={abrirFullscreen}>
        {/* Thumbnail */}
        {thumbnail
          ? <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a1a' }]} />
        }

        {/* Overlay com play CENTRALIZADO */}
        <View style={vf.overlay}>
          <View style={vf.playBtn}>
            <Ionicons name="play" size={34} color="#fff" />
          </View>
        </View>

        {/* Etiqueta VÍDEO */}
        <View style={vf.etiqueta} pointerEvents="none">
          <Ionicons name="play-circle-outline" size={13} color="#fff" />
          <Text style={vf.etiquetaTxt}>Vídeo</Text>
        </View>
      </TouchableOpacity>

      {/* ── FULLSCREEN ── */}
      <Modal
        visible={fullscreen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
        statusBarTranslucent
      >
        <StatusBar hidden />
        <View style={fsv.container}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />

          {!pronto && (
            <View style={fsv.spinnerOverlay} pointerEvents="none">
              {thumbnail && (
                <Image
                  source={{ uri: thumbnail }}
                  style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
                  resizeMode="contain"
                />
              )}
              <ActivityIndicator color="rgba(255,255,255,0.9)" size="large" />
            </View>
          )}

          <View style={fsv.header}>
            <TouchableOpacity onPress={() => setFullscreen(false)} style={fsv.btnVoltar}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={fsv.headerTitulo}>Reels</Text>
          </View>

          <View style={fsv.iconesDireita}>
            <TouchableOpacity style={fsv.iconeBtn} onPress={acoes?.onLike}>
              <Ionicons name={acoes?.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={30} color="#fff" />
              {(acoes?.likesCount || 0) > 0 && <Text style={fsv.iconeCount}>{acoes.likesCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={fsv.iconeBtn} onPress={() => { setFullscreen(false); setTimeout(() => onAbrirComentarios?.(), 300); }}>
              <Ionicons name="chatbubble-outline" size={28} color="#fff" />
              {(acoes?.commentsCount || 0) > 0 && <Text style={fsv.iconeCount}>{acoes.commentsCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={fsv.iconeBtn} onPress={acoes?.onShare}>
              <Ionicons name="arrow-redo-outline" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={fsv.iconeBtn} onPress={() => setMutado(v => !v)}>
              <Ionicons name={mutado ? 'volume-mute' : 'volume-high'} size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={fsv.rodape}>
            <View style={fsv.autorLinha}>
              {post?.autorFoto
                ? <Image source={{ uri: post.autorFoto }} style={fsv.autorAvatar} />
                : <View style={fsv.autorAvatarFallback}><Text style={fsv.autorAvatarTxt}>{(post?.autorNome || 'U')[0]}</Text></View>}
              <Text style={fsv.autorNome} numberOfLines={1}>{post?.autorNome}</Text>
            </View>
            {post?.texto ? <Text style={fsv.postTexto} numberOfLines={3}>{post.texto}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const vf = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    aspectRatio: 9 / 16,
    maxHeight: 640,
  },
  // ✅ overlay cobre tudo e centraliza o play
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiqueta: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  etiquetaTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

const fsv = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  spinnerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  header:         { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, zIndex: 20 },
  btnVoltar:      { padding: 8, marginRight: 4 },
  headerTitulo:   { color: '#fff', fontSize: 20, fontWeight: '700' },
  iconesDireita:  { position: 'absolute', right: 14, bottom: 140, alignItems: 'center', gap: 24, zIndex: 10 },
  iconeBtn:       { alignItems: 'center' },
  iconeCount:     { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 3 },
  rodape:         { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 60 },
  autorLinha:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  autorAvatar:         { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff', backgroundColor: '#333' },
  autorAvatarFallback: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff', backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center' },
  autorAvatarTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  autorNome:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  postTexto:      { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19 },
});

// ════════════════════════════════════════════════════════════════════════════
// IMAGEM
// ════════════════════════════════════════════════════════════════════════════
function ImagemPost({ url, post, acoes, onAbrirComentarios }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [alturaFeed, setAlturaFeed] = useState(320);

  useEffect(() => {
    Image.getSize(url, (w, h) => {
      setAlturaFeed(Math.min(420, Math.max(180, W * (h / w))));
    }, () => setAlturaFeed(280));
  }, [url]);

  return (
    <>
      <TouchableOpacity activeOpacity={0.95} onPress={() => setFullscreen(true)}>
        <View style={{ width: '100%', height: alturaFeed, backgroundColor: '#f0f0f0' }}>
          <Image source={{ uri: url }} style={img.feedImg} resizeMode="cover" onLoadEnd={() => setCarregando(false)} />
          {carregando && <View style={img.loading}><ActivityIndicator color="#aaa" /></View>}
        </View>
      </TouchableOpacity>

      <Modal visible={fullscreen} transparent={false} animationType="fade" onRequestClose={() => setFullscreen(false)} statusBarTranslucent>
        <StatusBar hidden />
        <View style={img.fsContainer}>
          <TouchableOpacity style={img.fsVoltar} onPress={() => setFullscreen(false)}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: url }} style={{ width: W, height: H }} resizeMode="contain" />
          <View style={img.iconesDireita}>
            <TouchableOpacity style={img.iconeBtn} onPress={acoes?.onLike}>
              <Ionicons name={acoes?.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={28} color="#fff" />
              {(acoes?.likesCount || 0) > 0 && <Text style={img.iconeCount}>{acoes.likesCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={img.iconeBtn} onPress={() => { setFullscreen(false); setTimeout(() => onAbrirComentarios?.(), 300); }}>
              <Ionicons name="chatbubble-outline" size={26} color="#fff" />
              {(acoes?.commentsCount || 0) > 0 && <Text style={img.iconeCount}>{acoes.commentsCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={img.iconeBtn} onPress={acoes?.onShare}>
              <Ionicons name="arrow-redo-outline" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          {post?.autorNome && (
            <View style={img.rodape}>
              <View style={img.autorLinha}>
                {post.autorFoto
                  ? <Image source={{ uri: post.autorFoto }} style={img.autorAvatar} />
                  : <View style={img.autorAvatarFb}><Text style={img.autorAvatarTxt}>{post.autorNome[0]}</Text></View>}
                <Text style={img.autorNome}>{post.autorNome}</Text>
              </View>
              {post.texto ? <Text style={img.postTexto} numberOfLines={2}>{post.texto}</Text> : null}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const img = StyleSheet.create({
  feedImg:        { width: '100%', height: '100%' },
  loading:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  fsContainer:    { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fsVoltar:       { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 16, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  iconesDireita:  { position: 'absolute', right: 14, bottom: 140, alignItems: 'center', gap: 24, zIndex: 10 },
  iconeBtn:       { alignItems: 'center' },
  iconeCount:     { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 3 },
  rodape:         { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 40 },
  autorLinha:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  autorAvatar:    { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff' },
  autorAvatarFb:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  autorAvatarTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  autorNome:      { color: '#fff', fontSize: 14, fontWeight: '700' },
  postTexto:      { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },
});

// ════════════════════════════════════════════════════════════════════════════
// GRID
// ════════════════════════════════════════════════════════════════════════════
function GridImagens({ imagens, post, acoes, onAbrirComentarios }) {
  const [fsVisivel, setFsVisivel] = useState(false);
  const [indice,    setIndice]    = useState(0);
  const n    = imagens.length;
  const lado = (W - 2) / 2;
  const abrir = i => { setIndice(i); setFsVisivel(true); };

  const renderGrid = () => {
    if (n === 2) return (
      <View style={{ flexDirection: 'row', gap: 2, height: 260 }}>
        {imagens.map((im, i) => (
          <TouchableOpacity key={i} style={{ flex: 1 }} activeOpacity={0.95} onPress={() => abrir(i)}>
            <Image source={{ uri: im.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    );
    if (n === 3) return (
      <View style={{ flexDirection: 'row', gap: 2, height: 280 }}>
        <TouchableOpacity style={{ flex: 1.1 }} activeOpacity={0.95} onPress={() => abrir(0)}>
          <Image source={{ uri: imagens[0].url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </TouchableOpacity>
        <View style={{ flex: 0.9, gap: 2 }}>
          {[1, 2].map(i => (
            <TouchableOpacity key={i} style={{ flex: 1 }} activeOpacity={0.95} onPress={() => abrir(i)}>
              <Image source={{ uri: imagens[i].url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
    const visiveis = imagens.slice(0, 4);
    const extras   = n - 4;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {visiveis.map((im, i) => (
          <TouchableOpacity key={i} style={{ width: lado, height: lado }} activeOpacity={0.95} onPress={() => abrir(i)}>
            <Image source={{ uri: im.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            {i === 3 && extras > 0 && <View style={gr.overlay}><Text style={gr.extrasTxt}>+{extras}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <>
      {renderGrid()}
      <Modal visible={fsVisivel} transparent={false} animationType="fade" onRequestClose={() => setFsVisivel(false)} statusBarTranslucent>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity style={img.fsVoltar} onPress={() => setFsVisivel(false)}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            contentOffset={{ x: indice * W, y: 0 }}
            onMomentumScrollEnd={e => setIndice(Math.round(e.nativeEvent.contentOffset.x / W))}>
            {imagens.map((im, i) => (
              <View key={i} style={{ width: W, height: H, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: im.url }} style={{ width: W, height: H }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          {n > 1 && <View style={gr.contador}><Text style={gr.contadorTxt}>{indice + 1} / {n}</Text></View>}
        </View>
      </Modal>
    </>
  );
}

const gr = StyleSheet.create({
  overlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  extrasTxt:   { color: '#fff', fontSize: 26, fontWeight: '800' },
  contador:    { position: 'absolute', bottom: 36, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  contadorTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

// ════════════════════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════════════════════
export default function PostMedia({ mediaUrls, emEcra = false, post, acoes, onAbrirComentarios }) {
  const media   = normalizarMedia(mediaUrls);
  if (media.length === 0) return null;
  const videos  = media.filter(m => m.type === 'video');
  const imagens = media.filter(m => m.type !== 'video');
  return (
    <View style={{ width: '100%', overflow: 'hidden' }}>
      {videos.map((v, i) => (
        <VideoPost key={`v-${i}`} url={v.url} post={post} acoes={acoes} onAbrirComentarios={onAbrirComentarios} />
      ))}
      {imagens.length === 1 && <ImagemPost url={imagens[0].url} post={post} acoes={acoes} onAbrirComentarios={onAbrirComentarios} />}
      {imagens.length > 1  && <GridImagens imagens={imagens} post={post} acoes={acoes} onAbrirComentarios={onAbrirComentarios} />}
    </View>
  );
}