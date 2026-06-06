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

function scheduleBeepBurst(ctx: AudioContext, startAt: number) {
  // Soft sine chime — gentle reminder, not an urgent alert
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(masterGain!);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, startAt); // D5

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.22, startAt + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.45);

  trackOscillator(osc);
  osc.start(startAt);
  osc.stop(startAt + 0.5);
}

function playBurst(generation: number) {
  if (generation !== alarmGeneration) return;
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
  scheduleBeepBurst(ctx, ctx.currentTime + 0.05);
  alarmTimerHandle = window.setTimeout(() => playBurst(generation), 1600);
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
