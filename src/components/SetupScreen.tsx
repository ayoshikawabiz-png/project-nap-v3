import { useState } from 'react';
import { unlockAudio, playTapSound } from '../utils/audio';
import { requestMotionPermission } from '../hooks/useMotionSensor';
import { formatHms } from '../utils/time';

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

interface Props {
  onStart: (durationSeconds: number, sensitivity: number) => void;
}

interface TimeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function TimeField({ label, value, min, max, onChange }: TimeFieldProps) {
  const step = (delta: number) => {
    playTapSound();
    onChange(Math.min(max, Math.max(min, value + delta)));
  };

  return (
    <div className="flex flex-col items-center flex-1">
      <span className="text-[#64748b] text-xs font-bold mb-3">{label}</span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={value >= max}
        className="w-12 h-10 rounded-xl bg-[#131f30] text-[#94a3b8] text-xl font-bold transition-all duration-200 hover:bg-[#1a2d45] hover:text-white active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        +
      </button>
      <span className="text-4xl font-black tabular-nums text-white my-3 w-14 text-center">
        {String(value).padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={value <= min}
        className="w-12 h-10 rounded-xl bg-[#131f30] text-[#94a3b8] text-xl font-bold transition-all duration-200 hover:bg-[#1a2d45] hover:text-white active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        −
      </button>
    </div>
  );
}

export function SetupScreen({ onStart }: Props) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(20);
  const [seconds, setSeconds] = useState(0);
  const [sensitivity, setSensitivity] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  const handleStart = async () => {
    if (totalSeconds < 1) {
      setError('1秒以上に設定してください。');
      return;
    }

    playTapSound();
    setLoading(true);
    setError('');
    unlockAudio();

    const perm = await requestMotionPermission();
    if (perm === 'denied') {
      setError('センサーへのアクセスが拒否されました。設定から許可してください。');
      setLoading(false);
      return;
    }
    if (perm === 'unavailable') {
      setError('このデバイスはモーションセンサーに対応していません。タイマーのみで動作します。');
    }

    setLoading(false);
    onStart(totalSeconds, sensitivity);
  };

  const applyPreset = (min: number) => {
    playTapSound();
    setHours(0);
    setMinutes(min);
    setSeconds(0);
  };

  const sensitivityLabel = ['', '低（大きな動きのみ）', '中低', '中（おすすめ）', '中高', '高（微妙な動きも検知）'][sensitivity];

  return (
    <div className="min-h-screen bg-[#050a14] text-white flex flex-col px-5 py-10 animate-fade-up">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-3">🌙</div>
        <h1 className="text-2xl font-black tracking-tight text-white">ねむる番</h1>
        <p className="text-[#64748b] text-sm mt-1">タイマー中に動くとアラームが鳴ります</p>
      </div>

      {/* Duration section */}
      <div className="bg-[#0d1626] rounded-2xl p-5 mb-4 border border-[#1e2d45]">
        <h2 className="text-[#38bdf8] text-xs font-bold uppercase tracking-widest mb-4">タイマー時間</h2>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PRESETS.map((min) => (
            <button
              key={min}
              onClick={() => applyPreset(min)}
              className={`rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
                hours === 0 && minutes === min && seconds === 0
                  ? 'bg-[#38bdf8] text-[#050a14] shadow-lg shadow-sky-500/30 scale-105'
                  : 'bg-[#131f30] text-[#94a3b8] hover:bg-[#1a2d45] hover:text-white active:scale-95'
              }`}
            >
              {min}分
            </button>
          ))}
        </div>

        {/* Hour / minute / second pickers */}
        <div className="mb-4">
          <div className="text-center mb-4">
            <span className="text-[#64748b] text-xs">設定時間</span>
            <div className="text-white font-black text-3xl tabular-nums mt-1">
              {formatHms(totalSeconds)}
            </div>
          </div>
          <div className="flex gap-2">
            <TimeField label="時" value={hours} min={0} max={23} onChange={setHours} />
            <TimeField label="分" value={minutes} min={0} max={59} onChange={setMinutes} />
            <TimeField label="秒" value={seconds} min={0} max={59} onChange={setSeconds} />
          </div>
        </div>
      </div>

      {/* Sensitivity section */}
      <div className="bg-[#0d1626] rounded-2xl p-5 mb-6 border border-[#1e2d45]">
        <h2 className="text-[#38bdf8] text-xs font-bold uppercase tracking-widest mb-4">センサー感度</h2>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#64748b] text-xs">感度</span>
          <span className="text-[#94a3b8] text-xs">{sensitivityLabel}</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-400"
          style={{
            background: `linear-gradient(to right, #38bdf8 ${((sensitivity - 1) / 4) * 100}%, #1e2d45 ${((sensitivity - 1) / 4) * 100}%)`,
          }}
        />
        <div className="flex justify-between text-[#475569] text-xs mt-1">
          <span>低</span>
          <span>高</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 text-amber-400 text-sm">
          {error}
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={loading || totalSeconds < 1}
        className="w-full bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] text-[#050a14] font-black text-xl rounded-2xl py-5 shadow-2xl shadow-sky-500/30 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sky-400/40 hover:from-[#7dd3fc] hover:to-[#38bdf8]"
      >
        {loading ? '準備中...' : 'タイマー開始！布団の上に置く'}
      </button>

      {/* Instructions */}
      <div className="mt-6 bg-[#0d1626] rounded-2xl p-4 border border-[#1e2d45]">
        <h3 className="text-[#38bdf8] text-xs font-bold uppercase tracking-widest mb-2">使い方</h3>
        <ol className="text-[#64748b] text-sm space-y-1.5">
          <li><span className="text-[#38bdf8] font-bold">1.</span> 時間を設定してタイマーを開始</li>
          <li><span className="text-[#38bdf8] font-bold">2.</span> スマホを掛け布団の上に置く</li>
          <li><span className="text-[#38bdf8] font-bold">3.</span> 布団が動いたらアラームが鳴ります</li>
          <li><span className="text-[#38bdf8] font-bold">4.</span> タイマーが終わったら成功！</li>
        </ol>
      </div>
    </div>
  );
}
