export interface Hms {
  hours: number;
  minutes: number;
  seconds: number;
}

const MAX_TOTAL_SECONDS = 23 * 3600 + 59 * 60 + 59;

export function secondsToHms(totalSeconds: number): Hms {
  const total = Math.min(Math.max(0, totalSeconds), MAX_TOTAL_SECONDS);
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Carry overflow into higher units (e.g. 0:60:0 → 1:00:00) */
export function normalizeHms(hours: number, minutes: number, seconds: number): Hms {
  return secondsToHms(hours * 3600 + minutes * 60 + seconds);
}

export function hmsToSeconds(hours: number, minutes: number, seconds: number) {
  const { hours: h, minutes: m, seconds: s } = normalizeHms(hours, minutes, seconds);
  return h * 3600 + m * 60 + s;
}

export function formatColon(totalSeconds: number) {
  const { hours, minutes, seconds } = secondsToHms(totalSeconds);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
