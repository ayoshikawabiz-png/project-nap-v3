let alarmCtx: AudioContext | null = null;
let alarmGain: GainNode | null = null;
let alarmTimerHandle: number | null = null;
let alarmGeneration = 0;
const activeOscillators = new Set<OscillatorNode>();

let tapCtx: AudioContext | null = null;
let tapBufferUrl: string | null = null;

function createTapWavUrl(): string {
  const sampleRate = 44100;
  const duration = 0.055;
  const numSamples = Math.floor(sampleRate * duration);
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
    const t = i / sampleRate;
    const freq = 1100 * Math.exp(Math.log(750 / 1100) * (t / duration));
    const envelope = Math.min(1, t / 0.002) * Math.exp(-t / 0.018);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.35;
    view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.floor(sample * 32767))), true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function getTapBufferUrl(): string {
  if (!tapBufferUrl) tapBufferUrl = createTapWavUrl();
  return tapBufferUrl;
}

function playTapHtml() {
  const audio = new Audio(getTapBufferUrl());
  audio.volume = 0.45;
  void audio.play().catch(() => {});
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
  gain.gain.linearRampToValueAtTime(0.58, startAt + 0.004);
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
    const step = pattern[i];
    const frequency = baseFreq - step * 180;
    const t = startAt + i * (beepOn + beepGap);
    scheduleRadialBeep(ctx, t, frequency, beepOn);
  }
}

function playBurst(generation: number) {
  if (generation !== alarmGeneration) return;
  const ctx = getAlarmCtx();
  if (ctx.state === 'suspended') void ctx.resume();
  scheduleRadialBurst(ctx, ctx.currentTime + 0.05);
  alarmTimerHandle = window.setTimeout(() => playBurst(generation), 1200);
}

export function startAlarm() {
  stopAlarm();
  alarmGeneration++;
  const gen = alarmGeneration;
  playBurst(gen);
}

export function stopAlarm() {
  alarmGeneration++;
  if (alarmTimerHandle !== null) {
    clearTimeout(alarmTimerHandle);
    alarmTimerHandle = null;
  }

  // Mute output first — on iOS, osc.stop() alone may not silence immediately
  if (alarmGain && alarmCtx && alarmCtx.state !== 'closed') {
    const now = alarmCtx.currentTime;
    alarmGain.gain.cancelScheduledValues(now);
    alarmGain.gain.setValueAtTime(0, now);
  }

  stopAllOscillators();

  if (alarmCtx && alarmCtx.state !== 'closed') {
    void alarmCtx.close();
  }
  alarmCtx = null;
  alarmGain = null;
}

export function endSessionAudio() {
  stopAlarm();
}

/** Call from a user-gesture handler to unlock audio on iOS */
export function unlockAudio() {
  const tap = getTapCtx();
  if (tap.state === 'suspended') void tap.resume();

  const alarm = alarmCtx;
  if (alarm && alarm.state !== 'closed' && alarm.state === 'suspended') {
    void alarm.resume();
  }

  const prime = new Audio(getTapBufferUrl());
  prime.volume = 0.001;
  void prime.play().catch(() => {});
}

/** Short UI tap feedback — use with onPointerDown for reliable mobile playback */
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
