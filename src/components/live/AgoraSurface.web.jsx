// src/components/live/AgoraSurface.web.jsx
//
// Versão WEB — antes mostrava sempre um placeholder fixo ("Vídeo
// disponível apenas na app móvel"), porque se assumia que não havia SDK
// de vídeo em tempo real do Agora para a web. Isso não é verdade: o
// agora-rtc-sdk-ng (usado em agoraNative.web.js) já suporta vídeo no
// browser perfeitamente — só faltava este componente ligar-se a ele.
//
// Este componente usa `uid`/`sourceType` directamente como propriedades
// (ver watch/[id].jsx: <AgoraSurface uid={...} sourceType={...} />),
// diferente do RtcSurfaceView (que usa canvas={{uid,sourceType}}, a
// forma nativa do Agora) — por isso a lógica está duplicada aqui em vez
// de reutilizar o RtcSurfaceView directamente, mas o princípio é o
// mesmo: local = sourceType===VideoSourceCamera usa a track local; caso
// contrário, procura a track remota pelo uid em remoteUsers.
//
// ── CORREÇÃO ──
// Tal como no RtcSurfaceView: o useEffect não pode parar e voltar a
// tocar a MESMA track em todos os re-renders (isso acontece com muita
// frequência durante uma live — cada comentário, cada reação). Só
// pára/reinicia a reprodução quando a track realmente muda.
import { useEffect, useRef } from 'react';
import { createAgoraRtcEngine } from '../../services/agoraNative';

export const VideoSourceType = { VideoSourceCamera: 0, VideoSourceRemote: 1 };

export default function AgoraSurface({ style, uid, sourceType }) {
  const containerRef = useRef(null);
  const trackAtualRef = useRef(null);
  const ehLocal = sourceType === VideoSourceType.VideoSourceCamera;

  useEffect(() => {
    const engine = createAgoraRtcEngine();
    const track = ehLocal ? engine.localVideoTrack : engine.remoteUsers[uid]?.videoTrack;

    if (track && containerRef.current && trackAtualRef.current !== track) {
      if (trackAtualRef.current) {
        try { trackAtualRef.current.stop(); } catch (_) {}
      }
      track.play(containerRef.current);
      trackAtualRef.current = track;
    }
  });

  useEffect(() => {
    return () => {
      try { trackAtualRef.current?.stop(); } catch (_) {}
      trackAtualRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#000', ...style }} />;
}