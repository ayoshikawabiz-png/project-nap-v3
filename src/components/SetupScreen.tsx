import { useState, useEffect } from 'react';
import { unlockAudio } from '../utils/audio';
import { onButtonPointerDown } from '../utils/tapFeedback';
import { requestMotionPermission } from '../hooks/useMotionSensor';
import { formatHms } from '../utils/time';
import { loadSettings, saveSettings } from '../utils/settings';

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

interface Props {
  onStart: (durationSeconds: number, sensitivity: number) => void;
}

interface CompactSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function CompactSlider({ label, value, min, max, onChange }: CompactSliderProps) {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[#64748b] text-xs font-bold w-3 shrink-0 text-center">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="setup-range flex-1 min-w-0 h-1.5 rounded-full appearance-none cursor-pointer accent-sky-400"
        style={{
          background: `linear-gradient(to right, #38bdf8 ${percent}%, #1e2d45 ${percent}%)`,
        }}
      />
      <span className="text-white font-bold text-sm tabular-nums w-7 text-right shrink-0">
        {String(value).padStart(2, '0')}
      </span>
    </div>
  );
}

export function SetupScreen({ onStart }: Props) {
  const [initial] = useState(loadSettings);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [seconds, setSeconds] = useState(initial.seconds);
  const [sensitivity, setSensitivity] = useState(initial.sensitivity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  useEffect(() => {
    saveSettings({ hours, minutes, seconds, sensitivity });
  }, [hours, minutes, seconds, sensitivity]);

  const handleStart = async () => {
    if (totalSeconds < 1) {
      setError('1秒以上に設定してください。');
      return;
    }

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

    saveSettings({ hours, minutes, seconds, sensitivity });
    setLoading(false);
    onStart(totalSeconds, sensitivity);
  };

  const applyPreset = (min: number) => {
    setHours(0);
    setMinutes(min);
    setSeconds(0);
  };

  const sensitivityLabel = ['', '低', '中低', '中', '中高', '高'][sensitivity];
  const sensitivityPercent = ((sensitivity - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-[#050a14] text-white flex flex-col px-4 py-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl leading-none">🌙</span>
        <div>
          <h1 className="text-lg font-black tracking-tight leading-tight">ねむる番</h1>
          <p className="text-[#64748b] text-xs">動くとアラームが鳴ります</p>
        </div>
      </div>

      {/* Settings card */}
      <div className="bg-[#0d1626] rounded-2xl p-4 mb-3 border border-[#1e2d45]">
        <div className="text-center mb-3">
          <p className="text-[#38bdf8] text-[10px] font-bold uppercase tracking-widest mb-1">タイマー時間</p>
          <p className="text-white font-black text-2xl tabular-nums leading-tight">{formatHms(totalSeconds)}</p>
        </div>

        {/* Presets — horizontal scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1 scrollbar-none">
          {PRESETS.map((min) => (
            <button
              key={min}
              onPointerDown={onButtonPointerDown}
              onClick={() => applyPreset(min)}
              className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-all duration-150 ${
                hours === 0 && minutes === min && seconds === 0
                  ? 'bg-[#38bdf8] text-[#050a14]'
                  : 'bg-[#131f30] text-[#94a3b8] active:scale-95'
              }`}
            >
              {min}分
            </button>
          ))}
        </div>

        <div className="space-y-2.5 mb-4">
          <CompactSlider label="時" value={hours} min={0} max={23} onChange={setHours} />
          <CompactSlider label="分" value={minutes} min={0} max={59} onChange={setMinutes} />
          <CompactSlider label="秒" value={seconds} min={0} max={59} onChange={setSeconds} />
        </div>

        <div className="border-t border-[#1e2d45] pt-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[#38bdf8] text-[10px] font-bold uppercase tracking-widest">センサー感度</span>
            <span className="text-[#94a3b8] text-xs">{sensitivityLabel}</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="setup-range w-full h-1.5 rounded-full appearance-none cursor-pointer accent-sky-400"
            style={{
              background: `linear-gradient(to right, #38bdf8 ${sensitivityPercent}%, #1e2d45 ${sensitivityPercent}%)`,
            }}
          />
          <div className="flex justify-between text-[#475569] text-[10px] mt-0.5">
            <span>低</span>
            <span>高</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 mb-3 text-amber-400 text-xs leading-relaxed">
          {error}
        </div>
      )}

      {/* Start button */}
      <button
        onPointerDown={onButtonPointerDown}
        onClick={handleStart}
        disabled={loading || totalSeconds < 1}
        className="w-full bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] text-[#050a14] font-black text-base rounded-2xl py-4 shadow-xl shadow-sky-500/25 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '準備中...' : 'タイマー開始！布団の上に置く'}
      </button>

      {/* Instructions — collapsible */}
      <details className="mt-3 group">
        <summary className="text-[#475569] text-xs cursor-pointer list-none flex items-center gap-1 select-none">
          <span className="text-[#64748b] group-open:rotate-90 transition-transform inline-block">▶</span>
          使い方
        </summary>
        <ol className="text-[#64748b] text-xs space-y-1 mt-2 pl-1 leading-relaxed">
          <li><span className="text-[#38bdf8] font-bold">1.</span> 時間を設定して開始</li>
          <li><span className="text-[#38bdf8] font-bold">2.</span> スマホを掛け布団の上に置く</li>
          <li><span className="text-[#38bdf8] font-bold">3.</span> 布団が動いたらアラーム</li>
          <li><span className="text-[#38bdf8] font-bold">4.</span> タイマー終了で成功！</li>
        </ol>
      </details>
    </div>
  );
}
