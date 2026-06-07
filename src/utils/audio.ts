let alarmGeneration = 0;
let alarmBeepTimer: number | null = null;
let silentLoopUrl: string | null = null;
let beepUrl: string | null = null;
let tapBufferUrl: string | null = null;

let sessionAudio: HTMLAudioElement | null = null;
let sessionMode: 'idle' | 'silent' | 'alarm' = 'idle';
let vibrateTimerHandle: number | null = null;

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: string };
};

function encodeWav(samples: Float32Array, sampleRate: number): string {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.floor(s * 32767), true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function configureMediaElement(audio: HTMLAudioElement) {
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
}

function ensurePlaybackAudioSession() {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (!session) return;
  try {
    session.type = 'playback';
  } catch {
    // unsupported
  }
}

function getSilentLoopUrl(): string {
  if (!silentLoopUrl) {
    const sampleRate = 44100;
    silentLoopUrl = encodeWav(new Float32Array(Math.floor(sampleRate * 0.25)), sampleRate);
  }
  return silentLoopUrl;
}

function getBeepUrl(): string {
  if (!beepUrl) {
    const sampleRate = 44100;
    const duration = 0.42;
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(numSamples);
    const freq = 880;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, t / 0.01) * Math.exp(-t / 0.14);
      samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.55;
    }

    beepUrl = encodeWav(samples, sampleRate);
  }
  return beepUrl;
}

function createTapWavUrl(): string {
  const sampleRate = 44100;
  const duration = 0.055;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 1100 * Math.exp(Math.log(750 / 1100) * (t / duration));
    const envelope = Math.min(1, t / 0.002) * Math.exp(-t / 0.018);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.35;
  }

  return encodeWav(samples, sampleRate);
}

function getTapBufferUrl(): string {
  if (!tapBufferUrl) tapBufferUrl = createTapWavUrl();
  return tapBufferUrl;
}

function getSessionAudio(): HTMLAudioElement {
  if (!sessionAudio) {
    sessionAudio = new Audio();
    configureMediaElement(sessionAudio);
  }
  return sessionAudio;
}

function startSilentLoop() {
  if (sessionMode === 'silent') {
    const audio = sessionAudio;
    if (audio && !audio.paused) return;
  }

  ensurePlaybackAudioSession();
  sessionMode = 'silent';
  const audio = getSessionAudio();
  audio.pause();
  audio.src = getSilentLoopUrl();
  audio.loop = true;
  audio.volume = 0.001;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function stopSilentLoop() {
  if (!sessionAudio) return;
  sessionAudio.pause();
  sessionAudio.src = '';
  sessionAudio = null;
  sessionMode = 'idle';
}

function scheduleAlarmBeep(gen: number) {
  if (gen !== alarmGeneration) return;

  const audio = getSessionAudio();
  audio.pause();
  audio.src = getBeepUrl();
  audio.loop = false;
  audio.volume = 1;
  audio.currentTime = 0;
  void audio.play().catch(() => {});

  alarmBeepTimer = window.setTimeout(() => scheduleAlarmBeep(gen), 1800);
}

function startAlarmBeeps() {
  ensurePlaybackAudioSession();
  sessionMode = 'alarm';
  if (sessionAudio) sessionAudio.pause();
  scheduleAlarmBeep(alarmGeneration);
}

function stopAlarmBeeps() {
  if (alarmBeepTimer !== null) {
    clearTimeout(alarmBeepTimer);
    alarmBeepTimer = null;
  }
  if (sessionAudio && sessionMode === 'alarm') {
    sessionAudio.pause();
    sessionAudio.currentTime = 0;
    sessionMode = 'idle';
  }
}

function startVibration() {
  if (!navigator.vibrate) return;
  const pattern = [200, 100, 200];
  const pulse = () => navigator.vibrate(pattern);
  pulse();
  if (vibrateTimerHandle !== null) clearInterval(vibrateTimerHandle);
  vibrateTimerHandle = window.setInterval(pulse, 1800);
}

function stopVibration() {
  if (vibrateTimerHandle !== null) {
    clearInterval(vibrateTimerHandle);
    vibrateTimerHandle = null;
  }
  navigator.vibrate?.(0);
}

export function startAlarm() {
  alarmGeneration++;
  stopAlarmBeeps();
  stopVibration();
  startAlarmBeeps();
  startVibration();
}

export function stopAlarm() {
  alarmGeneration++;
  stopAlarmBeeps();
  stopVibration();
  startSilentLoop();
}

export function endSessionAudio() {
  alarmGeneration++;
  stopAlarmBeeps();
  stopVibration();
  stopSilentLoop();
}

/** Call from a user-gesture handler to unlock audio on iOS */
export function unlockAudio() {
  ensurePlaybackAudioSession();
  if (sessionMode !== 'alarm') startSilentLoop();
}

export function playTapSound() {
  const audio = new Audio(getTapBufferUrl());
  configureMediaElement(audio);
  audio.volume = 0.45;
  void audio.play().catch(() => {});
}
