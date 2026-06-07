let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let alarmTimerHandle: number | null = null;
let alarmGeneration = 0;
const activeOscillators = new Set<OscillatorNode>();

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
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
  gain.connect(masterGain!);

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
  // iPhone Radial-inspired: rapid high beeps with a descending flourish
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
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
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
  stopAllOscillators();

  if (masterGain && audioCtx && audioCtx.state !== 'closed') {
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
  }

  // Closing the context is required on iOS — scheduled oscillators otherwise keep playing
  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close();
  }
  audioCtx = null;
  masterGain = null;
}

/** Must be called from a user-gesture handler to unlock AudioContext on iOS */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

/** Short UI tap feedback — call from button onClick handlers */
export function playTapSound() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const startAt = ctx.currentTime;
  const duration = 0.055;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1100, startAt);
  osc.frequency.exponentialRampToValueAtTime(750, startAt + duration);

  osc.connect(gain);
  gain.connect(masterGain!);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.22, startAt + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.01);
}
