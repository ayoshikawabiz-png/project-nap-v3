import { useCallback, useRef } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function angleToValue(angleDeg: number, min: number, max: number) {
  const ratio = angleDeg / 360;
  return Math.min(max, Math.max(min, Math.round(min + ratio * (max - min))));
}

export function CircularTimeDial({ label, value, min, max, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const size = 104;
  const stroke = 7;
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const range = max - min;
  const percent = range === 0 ? 0 : (value - min) / range;
  const dash = circ * percent;
  const knobAngle = percent * 360 - 90;
  const knobRad = (knobAngle * Math.PI) / 180;
  const knobX = cx + r * Math.cos(knobRad);
  const knobY = cy + r * Math.sin(knobRad);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left - cx;
      const y = clientY - rect.top - cy;
      let angle = (Math.atan2(x, -y) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      onChange(angleToValue(angle, min, max));
    },
    [cx, cy, min, max, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  return (
    <div className="flex flex-col items-center flex-1 min-w-0 max-w-[112px]">
      <div
        ref={ref}
        className="relative touch-none select-none cursor-pointer"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <svg width={size} height={size} className="block -rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#1e2d45"
            strokeWidth={stroke}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.45))' }}
          />
        </svg>
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-[#38bdf8] border-2 border-[#050a14] shadow-md shadow-sky-500/50 pointer-events-none"
          style={{ left: knobX - 7, top: knobY - 7 }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black tabular-nums text-white leading-none">
            {String(value).padStart(2, '0')}
          </span>
          <span className="text-[#64748b] text-[11px] font-bold mt-0.5">{label}</span>
        </div>
      </div>
    </div>
  );
}
