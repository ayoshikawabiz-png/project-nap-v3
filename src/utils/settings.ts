const STORAGE_KEY = 'nemuruban-settings';

export interface SavedSettings {
  hours: number;
  minutes: number;
  seconds: number;
  sensitivity: number;
}

const DEFAULT: SavedSettings = {
  hours: 0,
  minutes: 20,
  seconds: 0,
  sensitivity: 3,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<SavedSettings>;
    return {
      hours: clamp(Number(parsed.hours) || 0, 0, 23),
      minutes: clamp(Number(parsed.minutes) ?? DEFAULT.minutes, 0, 59),
      seconds: clamp(Number(parsed.seconds) || 0, 0, 59),
      sensitivity: clamp(Number(parsed.sensitivity) ?? DEFAULT.sensitivity, 1, 5),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSettings(settings: SavedSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable
  }
}
