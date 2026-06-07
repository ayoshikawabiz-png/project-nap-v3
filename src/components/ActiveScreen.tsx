import { useState, useEffect, useCallback, useRef } from 'react';
import { useWakeLock } from '../hooks/useWakeLock';
import { useMotionSensor } from '../hooks/useMotionSensor';
import { onButtonPointerDown } from '../utils/tapFeedback';
import { formatColon } from '../utils/time';

interface Props {
  durationSeconds: number;
  sensitivity: number;
  initialTimeLeft: number;
  motionCount: number;
  isPaused: boolean;
  alarmCooldownUntil: number;
  onAlarm: (timeLeft: number) => void;
  onSuccess: () => void;
  onStop: () => void;
}

function sensitivityToThreshold(s: number): number {
  const map: Record<number, number> = { 1: 5.0, 2: 3.5, 3: 2.5, 4: 1.5, 5: 0.8 };
  return map[s] ?? 2.5;
}

export function ActiveScreen({
  durationSeconds,
  sensitivity,
  initialTimeLeft,
  motionCount,
  isPaused,
  alarmCooldownUntil,
  onAlarm,
  onSuccess,
  onStop,
}: Props) {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  const [motionLevel, setMotionLevel] = useState(0);
  const [sensorCalibrating, setSensorCalibrating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timeLeftRef = useRef(timeLeft);
  const threshold = sensitivityToThreshold(sensitivity);

  const inAlarmCooldown = now < alarmCooldownUntil;
  const sensorActive = !isPaused && !inAlarmCooldown;

  useWakeLock(true);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    if (!inAlarmCooldown) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [inAlarmCooldown, alarmCooldownUntil]);

  useEffect(() => {
    if (isPaused || inAlarmCooldown) {
      setMotionLevel(0);
      setSensorCalibrating(false);
    }
  }, [isPaused, inAlarmCooldown]);

  const handleMotionDetected = useCallback(() => {
    if (isPaused || Date.now() < alarmCooldownUntil) return;
    onAlarm(timeLeftRef.current);
  }, [onAlarm, isPaused, alarmCooldownUntil]);

  const handleMotionLevel = useCallback((level: number) => {
    if (!sensorActive || sensorCalibrating) {
      setMotionLevel(0);
      return;
    }
    setMotionLevel(level);
  }, [sensorActive, sensorCalibrating]);

  useMotionSensor({
    threshold,
    isActive: sensorActive,
    onMotionDetected: handleMotionDetected,
    onMotionLevel: handleMotionLevel,
    onCalibratingChange: setSensorCalibrating,
  });

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          onSuccess();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onSuccess, isPaused]);

  const handleStop = useCallback(() => {
    onStop();
  }, [onStop]);

  const progress = 1 - timeLeft / durationSeconds;
  const sensorReady = sensorActive && !sensorCalibrating;
  const motionPercent = sensorReady ? Math.min((motionLevel / threshold) * 100, 100) : 0;
  const motionColor = motionPercent > 70 ? '#ef4444' : motionPercent > 40 ? '#fb923c' : '#34d399';

  const sensorLabel = isPaused
    ? 'アラーム中'
    : inAlarmCooldown
      ? '再開準備中...'
      : sensorCalibrating
        ? '校正中...'
        : sensorReady
          ? `${motionLevel.toFixed(2)} m/s²`
          : '待機中...';

  const r = 80;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - progress);

  return (
    <div
      className="min-h-screen bg-[#050a14] text-white flex flex-col items-center px-5 py-8 animate-fade-up"
      aria-hidden={isPaused}
    >
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex items-center gap-2 bg-[#0d1626] rounded-full px-4 py-2 border border-[#1e2d45]">
          <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
          <span className="text-[#34d399] text-sm font-bold">{isPaused ? 'アラーム中' : '監視中'}</span>
        </div>
        {motionCount > 0 && (
          <div className="flex items-center gap-2 bg-[#1a0f0f] rounded-full px-4 py-1.5 border border-[#7f1d1d]/50">
            <span className="text-red-400 text-xs font-bold">動き検知 {motionCount} 回</span>
          </div>
        )}
      </div>

      <div className="relative mb-8">
        <svg width="200" height="200" className="-rotate-90">
          <circle cx="100" cy="100" r={r} fill="none" stroke="#1e2d45" strokeWidth="10" />
          <circle
            cx="100" cy="100" r={r}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.65rem] font-black tabular-nums text-white tracking-widest leading-none">
            {formatColon(timeLeft)}
          </span>
          <span className="text-[#64748b] text-xs mt-1">残り時間</span>
        </div>
      </div>

      <div className="w-full bg-[#0d1626] rounded-2xl p-4 mb-4 border border-[#1e2d45]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#64748b] text-xs font-bold uppercase tracking-wider">センサー</span>
          <span className="text-xs font-bold" style={{ color: sensorReady ? motionColor : '#64748b' }}>
            {sensorLabel}
          </span>
        </div>
        <div className="w-full h-3 bg-[#131f30] rounded-full overflow-hidden">
          <div
            key={sensorReady ? 'live' : 'idle'}
            className="h-full rounded-full"
            style={{
              width: `${motionPercent}%`,
              backgroundColor: sensorReady ? motionColor : '#334155',
              boxShadow: sensorReady && motionPercent > 40 ? `0 0 8px ${motionColor}` : 'none',
              transition: sensorReady ? 'width 150ms linear, background-color 150ms linear' : 'none',
            }}
          />
        </div>
        <div className="flex justify-between text-[#475569] text-xs mt-1">
          <span>静止</span>
          <span>アラームライン</span>
        </div>
      </div>

      <div className="w-full bg-[#0d1626] rounded-2xl p-4 mb-8 border border-[#1e2d45] text-center">
        <div className="text-3xl mb-2">🛏️</div>
        <p className="text-[#94a3b8] text-sm leading-relaxed">
          スマホを<span className="text-white font-bold">掛け布団の上</span>に<br />
          そっと置いてください
        </p>
        <p className="text-[#475569] text-xs mt-2">画面は自動的にスリープしません</p>
      </div>

      <button
        type="button"
        onPointerDown={onButtonPointerDown}
        onClick={handleStop}
        className="w-full bg-[#131f30] border border-[#1e2d45] text-[#64748b] font-bold text-base rounded-2xl py-4 active:scale-95 transition-all duration-200 hover:border-[#334155] hover:text-[#94a3b8]"
      >
        タイマーを終了する
      </button>
    </div>
  );
}
