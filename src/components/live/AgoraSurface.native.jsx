// src/components/live/AgoraSurface.native.jsx
// Versão NATIVA (Android/iOS) — renderiza o vídeo real do Agora.
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';

export { VideoSourceType };

export default function AgoraSurface({ style, uid, sourceType }) {
  return (
    <RtcSurfaceView
      style={style}
      canvas={{ uid, sourceType: sourceType ?? VideoSourceType.VideoSourceRemote }}
    />
  );
}