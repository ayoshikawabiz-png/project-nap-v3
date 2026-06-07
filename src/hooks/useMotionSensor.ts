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

interface UseMotionSensorOptions {
  threshold: number;
  isActive: boolean;
  onMotionDetected: () => void;
  onMotionLevel?: (level: number) => void;
  onCalibratingChange?: (calibrating: boolean) => void;
}

function readMagnitude(event: DeviceMotionEvent): number | null {
  const acc = event.acceleration;
  if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
    return Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
  }

  const accG = event.accelerationIncludingGravity;
  if (accG && accG.x !== null && accG.y !== null && accG.z !== null) {
    return Math.sqrt(accG.x ** 2 + accG.y ** 2 + accG.z ** 2);
  }

  return null;
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
    const calibrationSamples: number[] = [];
    let baseline = 0;
    let smoothed = 0;
    let calibrated = false;
    const activateAt = Date.now();
    const calibrationMs = 900;

    onCalibratingChangeRef.current?.(true);
    onMotionLevelRef.current?.(0);

    const handleMotion = (event: DeviceMotionEvent) => {
      const raw = readMagnitude(event);
      if (raw === null) return;

      const elapsed = Date.now() - activateAt;

      if (!calibrated) {
        calibrationSamples.push(raw);
        if (calibrationSamples.length > 24) calibrationSamples.shift();

        if (elapsed >= calibrationMs && calibrationSamples.length >= 8) {
          baseline = calibrationSamples.reduce((sum, v) => sum + v, 0) / calibrationSamples.length;
          calibrated = true;
          smoothed = 0;
          onCalibratingChangeRef.current?.(false);
        } else {
          onMotionLevelRef.current?.(0);
          return;
        }
      }

      const delta = Math.abs(raw - baseline);
      smoothed = smoothed * 0.65 + delta * 0.35;
      onMotionLevelRef.current?.(smoothed);

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
