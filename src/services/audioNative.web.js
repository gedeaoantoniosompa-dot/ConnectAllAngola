import { useEffect, useRef, useState } from 'react';

export const RecordingPresets = { HIGH_QUALITY: {}, LOW_QUALITY: {} };

export const AudioModule = {
  requestRecordingPermissionsAsync: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return { granted: true };
    } catch (e) {
      return { granted: false };
    }
  },
};

export async function setAudioModeAsync() { /* não aplicável no browser */ }

export function useAudioRecorder() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const [uri, setUri] = useState(null);

  return {
    uri,
    prepareToRecordAsync: async () => {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    },
    record: () => {
      chunksRef.current = [];
      const mr = new MediaRecorder(streamRef.current);
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
    },
    stop: () => new Promise(resolve => {
      const mr = mediaRecorderRef.current;
      if (!mr) return resolve();
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setUri(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach(t => t.stop());
        resolve();
      };
      mr.stop();
    }),
    _mediaRecorderRef: mediaRecorderRef,
  };
}

export function useAudioRecorderState(recorder, intervaloMs = 200) {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const inicioRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      const mr = recorder._mediaRecorderRef.current;
      const gravando = mr?.state === 'recording';
      setIsRecording(gravando);
      if (gravando) {
        if (!inicioRef.current) inicioRef.current = Date.now();
        setDurationMillis(Date.now() - inicioRef.current);
      } else {
        inicioRef.current = null;
      }
    }, intervaloMs);
    return () => clearInterval(id);
  }, [recorder]);

  return { isRecording, durationMillis };
}

export function useAudioPlayer(uri) {
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = uri ? new Audio(uri) : null;
    return () => { audioRef.current?.pause(); };
  }, [uri]);

  return {
    play: () => audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
    seekTo: (segundos) => { if (audioRef.current) audioRef.current.currentTime = segundos; },
    _audioRef: audioRef,
  };
}

export function useAudioPlayerStatus(player, intervaloMs = 200) {
  const [status, setStatus] = useState({ playing: false, currentTime: 0, duration: 0, didJustFinish: false });

  useEffect(() => {
    const id = setInterval(() => {
      const a = player._audioRef.current;
      if (!a) return;
      setStatus({
        playing: !a.paused && !a.ended,
        currentTime: a.currentTime,
        duration: a.duration || 0,
        didJustFinish: a.ended,
      });
    }, intervaloMs);
    return () => clearInterval(id);
  }, [player]);

  return status;
}