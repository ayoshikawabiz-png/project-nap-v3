import { useCallback, useRef } from 'react';
import { formatColon } from '../utils/time';
import { onButtonPointerDown } from '../utils/tapFeedback';

export type DialField = 'hours' | 'minutes' | 'seconds';

interface Props {
  hours: number;
  minutes: number;
  seconds: number;
  activeField: DialField;
  onActiveFieldChange: (field: DialField) => void;
  onHoursChange: (v: number) => void;
  onMinutesChange: (v: number) => void;
  onSecondsChange: (v: number) => void;
}

const FIELD_META: Record<DialField, { label: string; min: number; max: number; labelStep: number }> = {
  hours: { label: '時', min: 0, max: 23, labelStep: 3 },
  minutes: { label: '分', min: 0, max: 59, labelStep: 5 },
  seconds: { label: '秒', min: 0, max: 59, labelStep: 5 },
};

function valueToAngle(value: number, min: number, max: number) {
  const range = max - min;
  if (range <= 0) return -90;
  return ((value - min) / range) * 360 - 90;
}

function angleToValue(angleDeg: number, min: number, max: number) {
  let a = angleDeg;
  if (a < 0) a += 360;
  const ratio = a / 360;
  return Math.min(max, Math.max(min, Math.round(min + ratio * (max - min))));
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function AppleTimerDial({
  hours,
  minutes,
  seconds,
  activeField,
  onActiveFieldChange,
  onHoursChange,
  onMinutesChange,
  onSecondsChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const trackR = 118;
  const labelR = 138;
  const meta = FIELD_META[activeField];
  const value = activeField === 'hours' ? hours : activeField === 'minutes' ? minutes : seconds;
  const onChange =
    activeField === 'hours' ? onHoursChange : activeField === 'minutes' ? onMinutesChange : onSecondsChange;

  const range = meta.max - meta.min;
  const progress = range === 0 ? 0 : (value - meta.min) / range;
  const circ = 2 * Math.PI * trackR;
  const arcLen = circ * progress;
  const handleAngle = valueToAngle(value, meta.min, meta.max);
  const handlePos = polar(cx, cy, trackR, handleAngle);

  const setValueFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scale = size / rect.width;
      const x = (clientX - rect.left) * scale - cx;
      const y = (clientY - rect.top) * scale - cy;
      const dist = Math.hypot(x, y);
      if (dist < trackR - 36 || dist > labelR + 20) return;

      let angle = (Math.atan2(x, -y) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      onChange(angleToValue(angle, meta.min, meta.max));
    },
    [cx, cy, labelR, meta.max, meta.min, onChange, size, trackR],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setValueFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setValueFromPointer(e.clientX, e.clientY);
  };

  const ticks = [];
  for (let v = meta.min; v <= meta.max; v++) {
    const angle = valueToAngle(v, meta.min, meta.max);
    const outer = polar(cx, cy, trackR + (v % meta.labelStep === 0 ? 10 : 5), angle);
    const inner = polar(cx, cy, trackR - (v % meta.labelStep === 0 ? 4 : 2), angle);
    const isMajor = v % meta.labelStep === 0;
    ticks.push(
      <line
        key={v}
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke={isMajor ? '#64748b' : '#2a3a52'}
        strokeWidth={isMajor ? 2 : 1}
        strokeLinecap="round"
      />,
    );
  }

  const labels = [];
  for (let v = meta.min; v <= meta.max; v += meta.labelStep) {
    const angle = valueToAngle(v, meta.min, meta.max);
    const pos = polar(cx, cy, labelR, angle);
    labels.push(
      <text
        key={v}
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        className={`text-[13px] font-semibold select-none cursor-pointer ${
          v === value ? 'fill-white' : 'fill-[#94a3b8]'
        }`}
        onPointerDown={(e) => {
          e.stopPropagation();
          onChange(v);
        }}
      >
        {v}
      </text>,
    );
  }

  const fields: { key: DialField; val: number; label: string }[] = [
    { key: 'hours', val: hours, label: '時' },
    { key: 'minutes', val: minutes, label: '分' },
    { key: 'seconds', val: seconds, label: '秒' },
  ];

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  return (
    <div className="flex flex-col items-center">
      {/* Field selector */}
      <div className="flex rounded-xl bg-[#131f30] p-1 mb-4 w-full max-w-[280px]">
        {fields.map(({ key, val, label }) => (
          <button
            key={key}
            type="button"
            onPointerDown={onButtonPointerDown}
            onClick={() => onActiveFieldChange(key)}
            className={`flex-1 rounded-lg py-2 text-center transition-all duration-200 ${
              activeField === key
                ? 'bg-[#38bdf8] text-[#050a14] shadow-md font-black'
                : 'text-[#94a3b8] font-bold hover:text-white'
            }`}
          >
            <span className="text-lg tabular-nums leading-none">{String(val).padStart(2, '0')}</span>
            <span className="text-[10px] block mt-0.5 opacity-80">{label}</span>
          </button>
        ))}
      </div>

      {/* Dial */}
      <div
        ref={ref}
        className="relative touch-none select-none cursor-grab active:cursor-grabbing w-full max-w-[300px] aspect-square"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full block">
          <circle cx={cx} cy={cy} r={trackR} fill="none" stroke="#1e2d45" strokeWidth={14} />
          <circle
            cx={cx}
            cy={cy}
            r={trackR}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.35))' }}
          />
          {ticks}
          {labels}
        </svg>

        {/* Handle */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${(handlePos.x / size) * 100}%`,
            top: `${(handlePos.y / size) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-7 h-7 rounded-full bg-white border-[3px] border-[#38bdf8] shadow-lg shadow-black/40" />
        </div>

        {/* Center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-black tabular-nums tracking-wider text-white leading-none">
            {formatColon(totalSeconds)}
          </span>
          <span className="text-[#38bdf8] text-xs font-bold mt-2">
            {meta.label}を設定中
          </span>
        </div>
      </div>

      <p className="text-[#475569] text-xs text-center mt-3">
        ダイヤルを回すか、数字をタップして {meta.label} を調整
      </p>
    </div>
  );
}
