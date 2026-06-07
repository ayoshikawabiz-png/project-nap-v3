import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeHms, hmsToSeconds, formatColon } from '../utils/time';
import { unlockAudio } from '../utils/audio';
import { onButtonPointerDown } from '../utils/tapFeedback';
import { requestMotionPermission } from '../hooks/useMotionSensor';
import { loadSettings, saveSettings } from '../utils/settings';
import { AppleTimerDial, type DialField } from './AppleTimerDial';

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

interface Props {
  onStart: (durationSeconds: number, sensitivity: number) => void;
}

export function SetupScreen({ onStart }: Props) {
  const [initial] = useState(() => {
    const saved = loadSettings();
    return normalizeHms(saved.hours, saved.minutes, saved.seconds);
  });
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [seconds, setSeconds] = useState(initial.seconds);
  const [sensitivity, setSensitivity] = useState(initial.sensitivity);
  const [activeField, setActiveField] = useState<DialField>('minutes');
  const [isDialOpen, setIsDialOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialRef = useRef<HTMLDivElement>(null);

  const totalSeconds = hmsToSeconds(hours, minutes, seconds);

  const applyTime = useCallback((h: number, m: number, s: number) => {
    const n = normalizeHms(h, m, s);
    setHours(n.hours);
    setMinutes(n.minutes);
    setSeconds(n.seconds);
  }, []);

  useEffect(() => {
    saveSettings({ hours, minutes, seconds, sensitivity });
  }, [hours, minutes, seconds, sensitivity]);

  useEffect(() => {
    if (isDialOpen) {
      dialRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isDialOpen]);

  const openDial = (field?: DialField) => {
    if (field) setActiveField(field);
    setIsDialOpen(true);
  };

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
    applyTime(0, min, 0);
    setActiveField(min >= 60 ? 'hours' : 'minutes');
    setIsDialOpen(false);
  };

  const isPresetActive = (min: number) => totalSeconds === min * 60;

  const sensitivityLabel = ['', '低（大きな動きのみ）', '中低', '中（おすすめ）', '中高', '高（微妙な動きも検知）'][sensitivity];
  const sensitivityPercent = ((sensitivity - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-[#050a14] text-white flex flex-col px-5 py-7 animate-fade-up">
      <div className="text-center mb-5">
        <div className="text-4xl mb-2">🌙</div>
        <h1 className="text-xl font-black tracking-tight">ねむる番</h1>
        <p className="text-[#64748b] text-sm mt-0.5">タイマー中に動くとアラームが鳴ります</p>
      </div>

      <div className="bg-[#0d1626] rounded-2xl p-5 mb-4 border border-[#1e2d45]">
        <h2 className="text-[#38bdf8] text-xs font-bold uppercase tracking-widest text-center mb-4">
          タイマー時間
        </h2>

        {!isDialOpen ? (
          <button
            type="button"
            onPointerDown={onButtonPointerDown}
            onClick={() => openDial()}
            className="w-full rounded-xl bg-[#131f30] border border-[#1e2d45] py-4 mb-4 active:scale-[0.99] transition-all duration-150 hover:border-[#38bdf8]/40"
          >
            <p className="text-3xl font-black tabular-nums tracking-wider text-white">
              {formatColon(totalSeconds)}
            </p>
            <p className="text-[#38bdf8] text-xs font-bold mt-1.5">タップしてダイヤルで調整</p>
          </button>
        ) : (
          <p className="text-center text-2xl font-black tabular-nums tracking-wider text-white mb-3">
            {formatColon(totalSeconds)}
          </p>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-none justify-center flex-wrap">
          {PRESETS.map((min) => (
            <button
              key={min}
              onPointerDown={onButtonPointerDown}
              onClick={() => applyPreset(min)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-bold transition-all duration-150 ${
                isPresetActive(min)
                  ? 'bg-[#38bdf8] text-[#050a14] shadow-lg shadow-sky-500/25'
                  : 'bg-[#131f30] text-[#94a3b8] hover:bg-[#1a2d45] hover:text-white active:scale-95'
              }`}
            >
              {min}分
            </button>
          ))}
        </div>

        {isDialOpen && (
          <div ref={dialRef} className="border-t border-[#1e2d45] pt-4 mt-2">
            <AppleTimerDial
              hours={hours}
              minutes={minutes}
              seconds={seconds}
              activeField={activeField}
              onActiveFieldChange={setActiveField}
              onHoursChange={(h) => applyTime(h, minutes, seconds)}
              onMinutesChange={(m) => applyTime(hours, m, seconds)}
              onSecondsChange={(s) => applyTime(hours, minutes, s)}
            />
            <button
              type="button"
              onPointerDown={onButtonPointerDown}
              onClick={() => setIsDialOpen(false)}
              className="w-full mt-4 rounded-xl bg-[#131f30] border border-[#1e2d45] py-3 text-[#94a3b8] font-bold text-sm active:scale-[0.98] transition-all hover:border-[#38bdf8]/40 hover:text-white"
            >
              完了
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#0d1626] rounded-2xl p-5 mb-5 border border-[#1e2d45]">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[#38bdf8] text-xs font-bold uppercase tracking-widest">センサー感度</h2>
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
            background: `linear-gradient(to right, #38bdf8 ${sensitivityPercent}%, #1e2d45 ${sensitivityPercent}%)`,
          }}
        />
        <div className="flex justify-between text-[#475569] text-xs mt-1.5">
          <span>低</span>
          <span>高</span>
        </div>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 text-amber-400 text-sm">
          {error}
        </div>
      )}

      <button
        onPointerDown={onButtonPointerDown}
        onClick={handleStart}
        disabled={loading || totalSeconds < 1}
        className="w-full bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] text-[#050a14] font-black text-lg rounded-2xl py-4 shadow-xl shadow-sky-500/30 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '準備中...' : 'タイマー開始！布団の上に置く'}
      </button>

      <details className="mt-5 group">
        <summary className="text-[#475569] text-sm cursor-pointer list-none flex items-center justify-center gap-1.5 select-none">
          <span className="text-[#64748b] group-open:rotate-90 transition-transform inline-block text-xs">▶</span>
          使い方を見る
        </summary>
        <ol className="text-[#64748b] text-sm space-y-1.5 mt-3 leading-relaxed">
          <li><span className="text-[#38bdf8] font-bold">1.</span> 時間を設定してタイマーを開始</li>
          <li><span className="text-[#38bdf8] font-bold">2.</span> スマホを掛け布団の上に置く</li>
          <li><span className="text-[#38bdf8] font-bold">3.</span> 布団が動いたらアラームが鳴ります</li>
          <li><span className="text-[#38bdf8] font-bold">4.</span> タイマーが終わったら成功！</li>
        </ol>
      </details>
    </div>
  );
}
