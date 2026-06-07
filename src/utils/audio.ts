let alarmGeneration = 0;
let alarmCycleTimer: number | null = null;
let alarmActive = false;
let silentLoopUrl: string | null = null;
let tapBufferUrl: string | null = null;

let silentAudio: HTMLAudioElement | null = null;
let vibrateTimerHandle: number | null = null;

let alarmCtx: AudioContext | null = null;
let alarmGain: GainNode | null = null;
const activeOscillators = new Set<OscillatorNode>();

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

function startSilentLoop() {
  if (alarmActive) return;

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

function getAlarmCtx(): AudioContext {
  if (!alarmCtx || alarmCtx.state === 'closed') {
    alarmCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    alarmGain = alarmCtx.createGain();
    alarmGain.gain.value = 1;
    alarmGain.connect(alarmCtx.destination);
  }
  return alarmCtx;
}

function trackOscillator(osc: OscillatorNode) {
  activeOscillators.add(osc);
  osc.addEventListener('ended', () => activeOscillators.delete(osc));
}

function stopAllOscillators() {
  for (const osc of activeOscillators) {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      // already stopped
    }
  }
  activeOscillators.clear();
}

function scheduleRadialBeep(
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  duration = 0.09,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.value = 3600;
  filter.Q.value = 0.7;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(alarmGain!);

  osc.type = 'square';
  osc.frequency.setValueAtTime(frequency, startAt);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.88, startAt + duration);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.5, startAt + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  trackOscillator(osc);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function scheduleRadialBurst(ctx: AudioContext, startAt: number) {
  const beepOn = 0.09;
  const beepGap = 0.1;
  const baseFreq = 1870;
  const pattern = [0, 1, 2, 1, 0, 2];

  for (let i = 0; i < pattern.length; i++) {
    const frequency = baseFreq - pattern[i] * 180;
    const t = startAt + i * (beepOn + beepGap);
    scheduleRadialBeep(ctx, t, frequency, beepOn);
  }
}

function playAlarmCycle(gen: number) {
  if (gen !== alarmGeneration || !alarmActive) return;

  const ctx = getAlarmCtx();
  if (ctx.state === 'suspended') void ctx.resume();
  scheduleRadialBurst(ctx, ctx.currentTime + 0.05);

  alarmCycleTimer = window.setTimeout(() => playAlarmCycle(gen), 2200);
}

function startAlarmSound() {
  alarmActive = true;
  stopSilentLoop();
  ensurePlaybackAudioSession();
  playAlarmCycle(alarmGeneration);
}

function stopAlarmSound() {
  alarmActive = false;
  if (alarmCycleTimer !== null) {
    clearTimeout(alarmCycleTimer);
    alarmCycleTimer = null;
  }
  stopAllOscillators();

  if (alarmGain && alarmCtx && alarmCtx.state !== 'closed') {
    const now = alarmCtx.currentTime;
    alarmGain.gain.cancelScheduledValues(now);
    alarmGain.gain.setValueAtTime(0, now);
  }

  if (alarmCtx && alarmCtx.state !== 'closed') {
    void alarmCtx.close();
  }
  alarmCtx = null;
  alarmGain = null;
}

function startVibration() {
  if (!navigator.vibrate) return;
  const pattern = [200, 100, 200];
  const pulse = () => navigator.vibrate(pattern);
  pulse();
  if (vibrateTimerHandle !== null) clearInterval(vibrateTimerHandle);
  vibrateTimerHandle = window.setInterval(pulse, 2200);
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
  stopAlarmSound();
  stopVibration();
  startAlarmSound();
  startVibration();
}

export function stopAlarm() {
  alarmGeneration++;
  stopAlarmSound();
  stopVibration();
  startSilentLoop();
}

export function endSessionAudio() {
  alarmGeneration++;
  stopAlarmSound();
  stopVibration();
  stopSilentLoop();
}

/** Call from a user-gesture handler to unlock audio on iOS */
export function unlockAudio() {
  ensurePlaybackAudioSession();
  if (!alarmActive) startSilentLoop();
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
