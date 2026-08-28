/**
 * src/services/AgoraEngine.js — ConnectAll Angola
 * Singleton global do Agora RTC
 * Partilhado entre Feira do Saber, Sala de Entrevista e Lives
 *
 * NOTA: já não faz require('react-native-agora') diretamente. Importa de
 * './agoraNative', que tem uma versão .js (nativa, usa o SDK real) e uma
 * versão .web.js (stub vazio) — assim o Metro nunca tenta empacotar o
 * módulo nativo do Agora na build web, o que antes fazia a build falhar.
 */

import { ChannelProfileType, ClientRoleType, createAgoraRtcEngine } from './agoraNative';

const AGORA_APP_ID = '4e413d4d82d14eeeb5f36a3853c846a3';

class AgoraEngineSingleton {
  constructor() {
    this.engine       = null;
    this.canalActual  = null;
    this.utilizador   = null; // 'feira' | 'entrevista' | 'live'
  }

  init() {
    if (this.engine || !createAgoraRtcEngine) return this.engine;
    try {
      this.engine = createAgoraRtcEngine();
      this.engine.initialize({ appId: AGORA_APP_ID });
      if (ChannelProfileType) {
        this.engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting ?? 1);
      }
      console.log('[AgoraEngine] ✅ Engine inicializado');
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao inicializar:', e);
      this.engine = null;
    }
    return this.engine;
  }

  registarHandlers(handlers) {
    if (!this.engine) return;
    try { this.engine.removeAllListeners?.(); } catch (_) {}
    try {
      // Usa registerEventHandler se disponível, senão addListener
      if (this.engine.registerEventHandler) {
        this.engine.registerEventHandler(handlers);
      } else {
        Object.entries(handlers).forEach(([evento, fn]) => {
          try { this.engine.addListener(evento, fn); } catch (_) {}
        });
      }
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao registar handlers:', e);
    }
  }

  async entrarCanal({ canal, token, uid, role, utilizador }) {
    if (!this.engine) this.init();
    if (!this.engine) return false;

    // Se já está noutro canal diferente, sai primeiro
    if (this.canalActual && this.canalActual !== canal) {
      console.log(`[AgoraEngine] A mudar de canal: "${this.canalActual}" → "${canal}"`);
      try { this.engine.leaveChannel(); } catch (_) {}
      await new Promise(r => setTimeout(r, 600));
    }

    this.canalActual = canal;
    this.utilizador  = utilizador;

    try {
      const isHost = role === 'broadcaster' || role === 'host' || role === 'orador';
      const roleType = isHost
        ? (ClientRoleType?.ClientRoleBroadcaster ?? 1)
        : (ClientRoleType?.ClientRoleAudience ?? 2);

      this.engine.setClientRole(roleType);
      this.engine.joinChannel(token || '', canal, uid || 0, {});
      console.log(`[AgoraEngine] A entrar no canal "${canal}" como ${isHost ? 'broadcaster' : 'audience'}`);
      return true;
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao entrar no canal:', e);
      return false;
    }
  }

  sairCanal(utilizador) {
    if (this.utilizador && this.utilizador !== utilizador) {
      console.log(`[AgoraEngine] Ignorado: "${utilizador}" tentou sair mas canal pertence a "${this.utilizador}"`);
      return;
    }
    try { this.engine?.leaveChannel(); } catch (_) {}
    this.canalActual = null;
    this.utilizador  = null;
    console.log(`[AgoraEngine] "${utilizador}" saiu do canal`);
  }

  enableAudio() {
    try {
      this.engine?.enableAudio();
      this.engine?.enableLocalAudio(true);
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao ativar áudio (verifica permissão RECORD_AUDIO):', e);
    }
  }

  enableVideo() {
    try {
      this.engine?.enableVideo();
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao ativar vídeo (verifica permissão CAMERA):', e);
    }
  }

  disableVideo() {
    try {
      this.engine?.disableVideo();
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao desativar vídeo:', e);
    }
  }

  setSpeakerphone(activo) {
    try {
      this.engine?.setEnableSpeakerphone(activo);
      this.engine?.setDefaultAudioRouteToSpeakerphone(activo);
    } catch (_) {}
  }

  enableVolumeIndication() {
    try { this.engine?.enableAudioVolumeIndication(200, 3, true); } catch (_) {}
  }

  mutarMic(mudo) {
    try { this.engine?.muteLocalAudioStream(mudo); } catch (_) {}
  }

  setClientRole(role) {
    try {
      const isHost = role === 'broadcaster' || role === 'host' || role === 'orador';
      const roleType = isHost
        ? (ClientRoleType?.ClientRoleBroadcaster ?? 1)
        : (ClientRoleType?.ClientRoleAudience ?? 2);
      this.engine?.setClientRole(roleType);
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao mudar de role:', e);
    }
  }

  // Renova o token ativo sem sair do canal — útil quando um espectador é
  // promovido a convidado e o backend emite um novo token com privilégios
  // de publicação (se o teu servidor de tokens gerar tokens específicos por
  // role; se gerar tokens genéricos, esta chamada é inofensiva).
  renovarToken(token) {
    if (!token) return;
    try { this.engine?.renewToken(token); } catch (e) {
      console.warn('[AgoraEngine] Erro ao renovar token:', e);
    }
  }

  // Promove o utilizador local (que entrou como audience) a co-apresentador:
  // passa a publicar câmara e microfone no canal onde já está.
  tornarBroadcaster() {
    try {
      this.setClientRole('broadcaster');
      this.enableAudio();
      this.enableVideo();
      this.startPreview();
      console.log('[AgoraEngine] 🎤 Promovido a co-apresentador');
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao tornar broadcaster:', e);
    }
  }

  // Reverte um convidado de volta a espectador simples: para de publicar
  // vídeo/áudio mas mantém-se no canal a assistir.
  voltarAudiencia() {
    try {
      this.mutarMic(true);
      this.disableVideo();
      this.setClientRole('audience');
      console.log('[AgoraEngine] 👤 De volta à audiência');
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao voltar a audiência:', e);
    }
  }

  switchCamera() {
    try { this.engine?.switchCamera(); } catch (_) {}
  }

  startPreview() {
    try {
      this.engine?.startPreview();
    } catch (e) {
      console.warn('[AgoraEngine] Erro ao iniciar preview (verifica permissão CAMERA):', e);
    }
  }

  getEngine()       { return this.engine; }
  getCanalActual()  { return this.canalActual; }
  getUtilizador()   { return this.utilizador; }
  disponivel()      { return !!createAgoraRtcEngine; }
}

export const AgoraEngine = new AgoraEngineSingleton();