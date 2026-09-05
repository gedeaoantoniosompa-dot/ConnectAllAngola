// utils/mediaPermissoes.js
//
// Pede as permissões de câmara e microfone em runtime. Sem isto, o SDK do
// Agora falha a abrir a câmara/microfone silenciosamente (os métodos do
// AgoraEngine engolem o erro internamente) e o vídeo fica sempre preto.
// Usado tanto por quem inicia uma live (broadcast.jsx) como por um
// espectador que é promovido a convidado no palco (watch/[id].jsx).
//
// ── CORREÇÃO (ficava sempre a "pedir" na web, mesmo já permitido) ──
// Na web, o próprio agora-rtc-sdk-ng (usado no WebAgoraEngine) já pede a
// câmara/microfone directamente ao browser quando cria as tracks
// (createCameraVideoTrack/createMicrophoneAudioTrack), e já trata bem a
// permissão negada (erro apanhado nos handlers do WebAgoraEngine). A
// verificação extra do expo-camera/expo-audio aqui era redundante na web
// e, pior, nem sempre reflectia o estado real da permissão do browser —
// ficava a dizer "falta permitir" mesmo depois de já teres autorizado.
// Por isso, na web, esta função salta a verificação e deixa o Agora
// tratar disso sozinho (é o comportamento correcto e mais fiável no
// browser). No telemóvel (nativo), continua a pedir como antes.

import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';
import { Platform } from 'react-native';

export async function pedirPermissoesMedia() {
  // Web: deixa o agora-rtc-sdk-ng pedir directamente ao browser quando
  // cria as tracks — é isso que já funciona correctamente, sem ficar
  // presa a mostrar "falta permitir" com a permissão já concedida.
  if (Platform.OS === 'web') return true;

  try {
    const cam = await Camera.requestCameraPermissionsAsync();
    const mic = await requestRecordingPermissionsAsync();
    return cam.status === 'granted' && mic.granted;
  } catch (e) {
    console.warn('[mediaPermissoes] Erro ao pedir permissões:', e);
    return false;
  }
}