let alarmGeneration = 0;
let silentLoopUrl: string | null = null;
let alarmLoopUrl: string | null = null;
let tapBufferUrl: string | null = null;

/** Single HTML audio element — iOS plays doubled if two elements run at once */
let sessionAudio: HTMLAudioElement | null = null;
let sessionMode: 'idle' | 'silent' | 'alarm' = 'idle';
let vibrateTimerHandle: number | null = null;

let tapCtx: AudioContext | null = null;

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

function synthesizeAlarmSamples(sampleRate: number): Float32Array {
  const burstDuration = 1.14;
  const loopDuration = 2.4;
  const numSamples = Math.floor(sampleRate * loopDuration);
  const samples = new Float32Array(numSamples);
  const beepOn = 0.09;
  const beepGap = 0.1;
  const baseFreq = 1870;
  const pattern = [0, 1, 2, 1, 0, 2];

  for (let i = 0; i < pattern.length; i++) {
    const frequency = baseFreq - pattern[i] * 180;
    const startSample = Math.floor(i * (beepOn + beepGap) * sampleRate);
    const endSample = Math.floor((i * (beepOn + beepGap) + beepOn) * sampleRate);
    for (let s = startSample; s < endSample && s < Math.floor(sampleRate * burstDuration); s++) {
      const t = (s - startSample) / sampleRate;
      const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.06);
      const phase = 2 * Math.PI * frequency * t;
      samples[s] += Math.sign(Math.sin(phase)) * 0.55 * env;
    }
  }

  return samples;
}

function getSilentLoopUrl(): string {
  if (!silentLoopUrl) {
    const sampleRate = 44100;
    const duration = 0.25;
    silentLoopUrl = encodeWav(new Float32Array(Math.floor(sampleRate * duration)), sampleRate);
  }
  return silentLoopUrl;
}

function getAlarmLoopUrl(): string {
  if (!alarmLoopUrl) {
    alarmLoopUrl = encodeWav(synthesizeAlarmSamples(44100), 44100);
  }
  return alarmLoopUrl;
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

function playSessionSrc(url: string, loop: boolean, volume: number) {
  const audio = getSessionAudio();
  audio.pause();
  audio.src = url;
  audio.loop = loop;
  audio.volume = volume;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function startSilentLoop() {
  if (sessionMode === 'silent') {
    const audio = sessionAudio;
    if (audio && !audio.paused) return;
  }
  ensurePlaybackAudioSession();
  sessionMode = 'silent';
  playSessionSrc(getSilentLoopUrl(), true, 0.001);
}

function stopSilentLoop() {
  if (!sessionAudio) return;
  sessionAudio.pause();
  sessionAudio.src = '';
  sessionAudio = null;
  sessionMode = 'idle';
}

function startAlarmHtmlLoop() {
  ensurePlaybackAudioSession();
  sessionMode = 'alarm';
  playSessionSrc(getAlarmLoopUrl(), true, 1);
}

function stopAlarmHtmlLoop() {
  if (sessionMode !== 'alarm') return;
  const audio = sessionAudio;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  sessionMode = 'idle';
  startSilentLoop();
}

function startVibration() {
  if (!navigator.vibrate) return;
  const pattern = [280, 120, 280, 120, 280];
  const pulse = () => navigator.vibrate(pattern);
  pulse();
  if (vibrateTimerHandle !== null) clearInterval(vibrateTimerHandle);
  vibrateTimerHandle = window.setInterval(pulse, 2400);
}

function stopVibration() {
  if (vibrateTimerHandle !== null) {
    clearInterval(vibrateTimerHandle);
    vibrateTimerHandle = null;
  }
  navigator.vibrate?.(0);
}

function getTapCtx(): AudioContext {
  if (!tapCtx || tapCtx.state === 'closed') {
    tapCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return tapCtx;
}

function scheduleTapOscillator(ctx: AudioContext, startAt: number) {
  const duration = 0.055;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1100, startAt);
  osc.frequency.exponentialRampToValueAtTime(750, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.22, startAt + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.01);
}

function playTapHtml() {
  const audio = new Audio(getTapBufferUrl());
  configureMediaElement(audio);
  audio.volume = 0.45;
  void audio.play().catch(() => {});
}

export function startAlarm() {
  stopAlarm();
  alarmGeneration++;
  startAlarmHtmlLoop();
  startVibration();
}

export function stopAlarm() {
  alarmGeneration++;
  stopAlarmHtmlLoop();
  stopVibration();
}

export function endSessionAudio() {
  stopAlarm();
  stopSilentLoop();
}

/** Call from a user-gesture handler to unlock audio on iOS */
export function unlockAudio() {
  ensurePlaybackAudioSession();
  startSilentLoop();

  const tap = getTapCtx();
  if (tap.state === 'suspended') void tap.resume();
}

export function playTapSound() {
  try {
    const ctx = getTapCtx();
    if (ctx.state === 'suspended') void ctx.resume();

    if (ctx.state === 'running') {
      scheduleTapOscillator(ctx, ctx.currentTime + 0.01);
      return;
    }

    playTapHtml();
    void ctx.resume();
  } catch {
    playTapHtml();
  }
}
