import { useEffect, useRef } from 'react';

export type MotionPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

export async function requestMotionPermission(): Promise<MotionPermissionState> {
  if (typeof DeviceMotionEvent === 'undefined') return 'unavailable';

  if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
    try {
      const result = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  return 'granted';
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface UseMotionSensorOptions {
  threshold: number;
  isActive: boolean;
  onMotionDetected: () => void;
  onMotionLevel?: (level: number) => void;
  onCalibratingChange?: (calibrating: boolean) => void;
}

function vecMag(v: Vec3): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vecAvg(samples: Vec3[]): Vec3 {
  const sum = samples.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }),
    { x: 0, y: 0, z: 0 },
  );
  const n = samples.length || 1;
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n };
}

function readSample(event: DeviceMotionEvent): { sample: Vec3; mode: 'linear' | 'gravity' } | null {
  const acc = event.acceleration;
  if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
    const sample = { x: acc.x, y: acc.y, z: acc.z };
    if (vecMag(sample) > 0.02) {
      return { sample, mode: 'linear' };
    }
  }

  const accG = event.accelerationIncludingGravity;
  if (accG && accG.x !== null && accG.y !== null && accG.z !== null) {
    return { sample: { x: accG.x, y: accG.y, z: accG.z }, mode: 'gravity' };
  }

  return null;
}

function motionLevel(sample: Vec3, mode: 'linear' | 'gravity', baseline: Vec3): number {
  if (mode === 'linear') return vecMag(sample);
  return vecMag(vecSub(sample, baseline));
}

export function useMotionSensor({
  threshold,
  isActive,
  onMotionDetected,
  onMotionLevel,
  onCalibratingChange,
}: UseMotionSensorOptions) {
  const triggeredRef = useRef(false);
  const onMotionDetectedRef = useRef(onMotionDetected);
  const onMotionLevelRef = useRef(onMotionLevel);
  const onCalibratingChangeRef = useRef(onCalibratingChange);

  useEffect(() => { onMotionDetectedRef.current = onMotionDetected; }, [onMotionDetected]);
  useEffect(() => { onMotionLevelRef.current = onMotionLevel; }, [onMotionLevel]);
  useEffect(() => { onCalibratingChangeRef.current = onCalibratingChange; }, [onCalibratingChange]);

  useEffect(() => {
    if (!isActive) {
      triggeredRef.current = false;
      return;
    }

    triggeredRef.current = false;
    const calibrationSamples: Vec3[] = [];
    let baseline: Vec3 = { x: 0, y: 0, z: 0 };
    let mode: 'linear' | 'gravity' = 'gravity';
    let smoothed = 0;
    let calibrated = false;
    let armed = false;
    let calmSince = 0;
    const activateAt = Date.now();
    const calibrationMs = 1200;
    const calmRequiredMs = 2500;
    const calmThreshold = threshold * 0.35;

    onCalibratingChangeRef.current?.(true);
    onMotionLevelRef.current?.(0);

    const handleMotion = (event: DeviceMotionEvent) => {
      const reading = readSample(event);
      if (!reading) return;

      mode = reading.mode;
      const elapsed = Date.now() - activateAt;

      if (!calibrated) {
        calibrationSamples.push(reading.sample);
        if (calibrationSamples.length > 30) calibrationSamples.shift();

        if (elapsed >= calibrationMs && calibrationSamples.length >= 10) {
          baseline = mode === 'gravity' ? vecAvg(calibrationSamples) : { x: 0, y: 0, z: 0 };
          calibrated = true;
          smoothed = 0;
          calmSince = 0;
          armed = false;
          onCalibratingChangeRef.current?.(false);
        } else {
          onMotionLevelRef.current?.(0);
          return;
        }
      }

      const level = motionLevel(reading.sample, mode, baseline);
      smoothed = smoothed * 0.55 + level * 0.45;
      onMotionLevelRef.current?.(smoothed);

      if (!armed) {
        if (smoothed <= calmThreshold) {
          if (calmSince === 0) calmSince = Date.now();
          if (Date.now() - calmSince >= calmRequiredMs) armed = true;
        } else {
          calmSince = 0;
        }
        return;
      }

      if (!triggeredRef.current && smoothed > threshold) {
        triggeredRef.current = true;
        onMotionDetectedRef.current();
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      triggeredRef.current = false;
      onCalibratingChangeRef.current?.(false);
    };
  }, [isActive, threshold]);
}
