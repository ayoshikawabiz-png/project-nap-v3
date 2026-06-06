let audioCtx: AudioContext | null = null;
let alarmTimerHandle: number | null = null;
let alarmGeneration = 0; // incremented each time alarm starts; callbacks check this to self-cancel

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function scheduleBeepBurst(ctx: AudioContext, startAt: number) {
  // Three urgent rising tones
  const tones = [660, 880, 1100];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startAt + i * 0.18);

    const t = startAt + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.start(t);
    osc.stop(t + 0.18);
  });
}

function playBurst(generation: number) {
  if (generation !== alarmGeneration) return; // stale callback — alarm was stopped
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
  scheduleBeepBurst(ctx, ctx.currentTime + 0.05);
  alarmTimerHandle = window.setTimeout(() => playBurst(generation), 900);
}

export function startAlarm() {
  stopAlarm(); // ensure any previous alarm is fully cleared first
  alarmGeneration++;
  const gen = alarmGeneration;
  playBurst(gen);
}

export function stopAlarm() {
  alarmGeneration++; // invalidate any in-flight playBurst callbacks
  if (alarmTimerHandle !== null) {
    clearTimeout(alarmTimerHandle);
    alarmTimerHandle = null;
  }
}

/** Must be called from a user-gesture handler to unlock AudioContext on iOS */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}
