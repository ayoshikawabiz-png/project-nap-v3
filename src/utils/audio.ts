let alarmGeneration = 0;
let alarmBeepTimer: number | null = null;
let silentLoopUrl: string | null = null;
let beepUrl: string | null = null;
let tapBufferUrl: string | null = null;

let silentAudio: HTMLAudioElement | null = null;
let alarmAudio: HTMLAudioElement | null = null;
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
    const duration = 0.4;
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(numSamples);
    const freq = 880;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, t / 0.01) * Math.exp(-t / 0.15);
      samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
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

function pauseSilentLoop() {
  silentAudio?.pause();
}

function startSilentLoop() {
  if (!silentAudio) {
    silentAudio = new Audio(getSilentLoopUrl());
    configureMediaElement(silentAudio);
    silentAudio.loop = true;
    silentAudio.volume = 0.001;
  }
  if (!silentAudio.paused) return;

  ensurePlaybackAudioSession();
  void silentAudio.play().catch(() => {});
}

function stopSilentLoop() {
  if (!silentAudio) return;
  silentAudio.pause();
  silentAudio.src = '';
  silentAudio = null;
}

function getAlarmAudio(): HTMLAudioElement {
  if (!alarmAudio) {
    alarmAudio = new Audio();
    configureMediaElement(alarmAudio);
    alarmAudio.loop = false;
  }
  return alarmAudio;
}

function scheduleAlarmBeep(gen: number) {
  if (gen !== alarmGeneration) return;

  pauseSilentLoop();

  const audio = getAlarmAudio();
  audio.onended = null;
  if (alarmBeepTimer !== null) {
    clearTimeout(alarmBeepTimer);
    alarmBeepTimer = null;
  }

  audio.src = getBeepUrl();
  audio.volume = 1;
  audio.currentTime = 0;

  const scheduleNext = () => {
    if (gen !== alarmGeneration) return;
    alarmBeepTimer = window.setTimeout(() => scheduleAlarmBeep(gen), 1400);
  };

  audio.onended = scheduleNext;
  void audio.play().catch(scheduleNext);
}

function startAlarmBeeps() {
  ensurePlaybackAudioSession();
  pauseSilentLoop();
  scheduleAlarmBeep(alarmGeneration);
}

function stopAlarmBeeps() {
  if (alarmBeepTimer !== null) {
    clearTimeout(alarmBeepTimer);
    alarmBeepTimer = null;
  }
  if (alarmAudio) {
    alarmAudio.onended = null;
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
  }
}

function startVibration() {
  if (!navigator.vibrate) return;
  const pattern = [200, 100, 200];
  const pulse = () => navigator.vibrate(pattern);
  pulse();
  if (vibrateTimerHandle !== null) clearInterval(vibrateTimerHandle);
  vibrateTimerHandle = window.setInterval(pulse, 2000);
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
  if (!alarmAudio || alarmAudio.paused) startSilentLoop();
}

let tapAudio: HTMLAudioElement | null = null;

export function playTapSound() {
  if (!tapAudio) {
    tapAudio = new Audio(getTapBufferUrl());
    configureMediaElement(tapAudio);
    tapAudio.volume = 0.45;
  }
  tapAudio.currentTime = 0;
  void tapAudio.play().catch(() => {});
}
