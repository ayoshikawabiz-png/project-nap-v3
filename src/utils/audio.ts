// src/utils/audio.ts

let audioCtx: AudioContext | null = null;
let alarmTimerHandle: number | null = null;
let alarmGeneration = 0;
let activeOscillators: OscillatorNode[] = []; 

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function scheduleBeepBurst(ctx: AudioContext, startAt: number) {
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

    activeOscillators.push(osc);
    
    osc.onended = () => {
      activeOscillators = activeOscillators.filter(o => o !== osc);
    };
  });
}

function playBurst(generation: number) {
  if (generation !== alarmGeneration) return;
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
  scheduleBeepBurst(ctx, ctx.currentTime + 0.05);
  alarmTimerHandle = window.setTimeout(() => playBurst(generation), 900);
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

  activeOscillators.forEach(osc => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) {
      // 既に停止済みの場合は無視
    }
  });
  activeOscillators = [];
}

export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}
