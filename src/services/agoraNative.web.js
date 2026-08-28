// src/services/agoraNative.web.js
// Versão WEB — usada automaticamente pelo Metro na build web. Nunca importa
// react-native-agora (que não tem suporte para web), evitando o erro de
// build "codegenNativeComponent is not supported on web".

export const createAgoraRtcEngine = null;
export const ClientRoleType = null;
export const ChannelProfileType = null;

// Stub do componente de vídeo — nunca é realmente usado no web (as telas de
// live/chamada devem verificar Platform.OS ou usar layout alternativo no
// web), mas precisa existir como export válido para não quebrar o import.
export const RtcSurfaceView = () => null;

// Stub do enum de origem de vídeo, para o código que faz
// VideoSourceType.VideoSourceRemote / VideoSourceCamera não rebentar no web.
export const VideoSourceType = {
  VideoSourceCamera: 0,
  VideoSourceRemote: 1,
};