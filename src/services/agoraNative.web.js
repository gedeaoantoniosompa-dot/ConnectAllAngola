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
// sala-entrevista.jsx e watch/[id].jsx (não pelo saber.jsx, que é só áudio).
import { useEffect, useRef } from 'react';
export function RtcSurfaceView({ style, uid, local }) {
  const ref = useRef(null);
  useEffect(() => {
    const engine = createAgoraRtcEngine();
    const track = local ? engine.localVideoTrack : engine.remoteUsers[uid]?.videoTrack;
    if (track && ref.current) track.play(ref.current);
    return () => { try { track?.stop(); } catch (_) {} };
  });
  return <div ref={ref} style={{ width: '100%', height: '100%', ...style }} />;
}