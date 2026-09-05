import AgoraRTC from 'agora-rtc-sdk-ng';

AgoraRTC.setLogLevel(4);

export const ClientRoleType = { ClientRoleBroadcaster: 'host', ClientRoleAudience: 'audience' };
export const ChannelProfileType = { ChannelProfileLiveBroadcasting: 1, ChannelProfileCommunication: 0 };
export const VideoSourceType = { VideoSourceCamera: 0, VideoSourceRemote: 1 };

class WebAgoraEngine {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.handlers = {};
    this.appId = null;
    this.remoteUsers = {};
    this.canalActual = null;
    this._roleDesejado = null;
    this._publicados = new Set(); // tracks já publicadas — evita republicar
  }

  initialize({ appId }) {
    this.appId = appId;
    this.client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    this._ligarEventos();
  }

  setChannelProfile() { /* modo 'live' já cobre broadcaster+audience */ }

  _ligarEventos() {
    if (!this.client) return;
    this.client.on('user-published', async (user, mediaType) => {
      try {
        await this.client.subscribe(user, mediaType);
        this.remoteUsers[user.uid] = user;
        if (mediaType === 'audio') user.audioTrack?.play();
        this.handlers.onUserJoined?.({ channelId: this.canalActual }, user.uid);
      } catch (e) {
        this.handlers.onError?.(-1, String(e?.message || e));
      }
    });
    this.client.on('user-unpublished', (user) => this.handlers.onUserOffline?.({ channelId: this.canalActual }, user.uid));
    this.client.on('user-left', (user) => {
      delete this.remoteUsers[user.uid];
      this.handlers.onUserOffline?.({ channelId: this.canalActual }, user.uid);
    });
    this.client.enableAudioVolumeIndicator();
    this.client.on('volume-indicator', (volumes) => {
      this.handlers.onAudioVolumeIndication?.({}, volumes.map(v => ({ uid: v.uid, volume: v.level })));
    });
  }

  registerEventHandler(handlers) { this.handlers = handlers || {}; }
  removeAllListeners() { this.handlers = {}; }

  setClientRole(role) {
    this._roleDesejado = role;
    this.client?.setClientRole(role === ClientRoleType.ClientRoleBroadcaster ? 'host' : 'audience');
  }

  async joinChannel(token, channelId, uid) {
    if (!this.client) return;
    this.canalActual = channelId;
    await this.client.join(this.appId, channelId, token || null, uid || null);
    if (this._roleDesejado === ClientRoleType.ClientRoleBroadcaster) await this._publicarTracksLocais();
    this.handlers.onJoinChannelSuccess?.({ channelId }, uid);
  }

  async leaveChannel() {
    try { await this.client?.leave(); } catch (_) {}
    this._pararTracksLocais();
    this.handlers.onLeaveChannel?.();
  }

  async _publicarTracksLocais() {
    // Só publica tracks que ainda não foram publicadas — republicar uma
    // track já publicada e entretanto desativada (mute) causa
    // TRACK_IS_DISABLED no Agora Web SDK.
    const tracks = [this.localAudioTrack, this.localVideoTrack]
      .filter(Boolean)
      .filter((t) => !this._publicados.has(t));

    if (tracks.length) {
      await this.client?.publish(tracks);
      tracks.forEach((t) => this._publicados.add(t));
    }
  }

  async enableAudio() {
    if (!this.localAudioTrack) {
      try { this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack(); }
      catch (e) { this.handlers.onError?.(-2, 'Sem permissão de microfone'); return; }
    }
    if (this.client?.connectionState === 'CONNECTED') await this._publicarTracksLocais();
  }

  enableLocalAudio(ativo) { this.localAudioTrack?.setEnabled(!!ativo); }

  async enableVideo() {
    if (!this.localVideoTrack) {
      try { this.localVideoTrack = await AgoraRTC.createCameraVideoTrack(); }
      catch (e) { this.handlers.onError?.(-3, 'Sem permissão de câmara'); return; }
    }
    if (this.client?.connectionState === 'CONNECTED') await this._publicarTracksLocais();
  }

  disableVideo() { try { this.localVideoTrack?.setEnabled(false); } catch (_) {} }

  // ── CORREÇÃO ──
  // Simétrico a enableLocalAudio, mas faltava para vídeo. Sem isto,
  // desligar a câmara (disableVideo, acima) e depois tentar voltar a
  // ligá-la nunca reactivava mesmo a track existente — enableVideo() só
  // cria uma track NOVA se ainda não existir nenhuma; se já existir (só
  // desactivada), não fazia nada, e a câmara ficava permanentemente
  // desligada mesmo depois de "ligar" de novo. Este método é chamado
  // pelo AgoraEngine.js sempre que a câmara é (re)ligada.
  enableLocalVideo(ativo) { try { this.localVideoTrack?.setEnabled(!!ativo); } catch (_) {} }

  _pararTracksLocais() {
    try { this.localAudioTrack?.close(); } catch (_) {}
    try { this.localVideoTrack?.close(); } catch (_) {}
    this._publicados.clear();
    this.localAudioTrack = null;
    this.localVideoTrack = null;
  }

  setEnableSpeakerphone() {}
  setDefaultAudioRouteToSpeakerphone() {}
  enableAudioVolumeIndication() {}
  muteLocalAudioStream(mudo) { this.localAudioTrack?.setEnabled(!mudo); }
  switchCamera() { /* pouco relevante em desktop; ignorado no web */ }
  startPreview() { /* ver RtcSurfaceView abaixo para exibir o preview local */ }
  async renewToken(token) { try { await this.client?.renewToken(token); } catch (_) {} }
}

let instanciaEngine = null;
export function createAgoraRtcEngine() {
  if (!instanciaEngine) instanciaEngine = new WebAgoraEngine();
  return instanciaEngine;
}

// Renderiza vídeo local/remoto no web — usado por broadcast.jsx,
// LiveStageStrip.jsx, sala-entrevista.jsx e watch/[id].jsx (não pelo
// saber.jsx, que é só áudio).
//
// ── CORREÇÃO 1 ──
// Este componente esperava receber `uid` e `local` directamente como
// propriedades separadas, mas em todo o resto da app (broadcast.jsx,
// LiveStageStrip.jsx) é sempre chamado com `canvas={{ uid, sourceType }}`
// — o mesmo formato da API nativa do Agora (react-native-agora), para o
// código funcionar sem alterações entre nativo e web. Como nunca recebia
// `uid`/`local` (estavam escondidos dentro de `canvas`), nunca sabia que
// vídeo mostrar, e a câmara ficava sempre em branco na web.
//
// ── CORREÇÃO 2 ──
// O useEffect corria sem array de dependências e, em cada execução,
// parava (`stop()`) e voltava a tocar (`play()`) a track — mesmo que
// fosse exactamente a MESMA track já a tocar. Durante uma live, o ecrã
// do anfitrião re-renderiza com muita frequência (cada comentário, cada
// reação de um espectador), o que fazia isto correr constantemente e
// quebrava o preview LOCAL (parar+voltar a tocar a câmara sem parar). O
// vídeo remoto que o espectador vê não tinha este problema porque é
// outro componente. Agora só pára/reinicia a reprodução quando a track
// realmente muda (ex: ligar a câmara de novo, ou o utilizador remoto
// mudar) — nunca por causa de um re-render que não tem nada a ver com o
// vídeo.
import { useEffect, useRef } from 'react';
export function RtcSurfaceView({ style, canvas }) {
  const containerRef = useRef(null);
  const trackAtualRef = useRef(null);
  const uid = canvas?.uid;
  const ehLocal = canvas?.sourceType === VideoSourceType.VideoSourceCamera;

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
    // Sem array de dependências: continua a verificar em cada render (a
    // track pode só ficar disponível um pouco depois do primeiro mount),
    // mas o "if" acima garante que só age de facto quando a track muda.
  });

  useEffect(() => {
    return () => {
      try { trackAtualRef.current?.stop(); } catch (_) {}
      trackAtualRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}