// utils/mediaPermissoes.js
//
// Pede as permissões de câmara e microfone em runtime. Sem isto, o SDK do
// Agora falha a abrir a câmara/microfone silenciosamente (os métodos do
// AgoraEngine engolem o erro internamente) e o vídeo fica sempre preto.
// Usado tanto por quem inicia uma live (broadcast.jsx) como por um
// espectador que é promovido a convidado no palco (watch/[id].jsx).

import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';

export async function pedirPermissoesMedia() {
  try {
    const cam = await Camera.requestCameraPermissionsAsync();
    const mic = await requestRecordingPermissionsAsync();
    return cam.status === 'granted' && mic.granted;
  } catch (e) {
    console.warn('[mediaPermissoes] Erro ao pedir permissões:', e);
    return false;
  }
}