import { useEffect, useRef, useCallback } from 'react';

export type MotionPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

export async function requestMotionPermission(): Promise<MotionPermissionState> {
  if (typeof DeviceMotionEvent === 'undefined') return 'unavailable';

  // iOS 13+ requires explicit permission
  if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
    try {
      const result = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  // Android / desktop — permission not required
  return 'granted';
}

interface UseMotionSensorOptions {
  threshold: number;
  isActive: boolean;
  onMotionDetected: () => void;
  onMotionLevel?: (level: number) => void;
}

export function useMotionSensor({ threshold, isActive, onMotionDetected, onMotionLevel }: UseMotionSensorOptions) {
  const triggeredRef = useRef(false);
  const onMotionDetectedRef = useRef(onMotionDetected);
  const onMotionLevelRef = useRef(onMotionLevel);

  useEffect(() => { onMotionDetectedRef.current = onMotionDetected; }, [onMotionDetected]);
  useEffect(() => { onMotionLevelRef.current = onMotionLevel; }, [onMotionLevel]);

  useEffect(() => {
    if (!isActive) {
      triggeredRef.current = false;
      return;
    }

    triggeredRef.current = false;

    const handleMotion = (event: DeviceMotionEvent) => {
      // Prefer acceleration without gravity; fall back to including gravity minus ~9.8
      const acc = event.acceleration;
      let magnitude = 0;

      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      } else {
        const accG = event.accelerationIncludingGravity;
        if (accG && accG.x !== null && accG.y !== null && accG.z !== null) {
          // Rough magnitude — will include gravitational component
          magnitude = Math.sqrt(accG.x ** 2 + accG.y ** 2 + accG.z ** 2);
          // Subtract gravity baseline to get approximate movement
          magnitude = Math.abs(magnitude - 9.8);
        }
      }

      onMotionLevelRef.current?.(magnitude);

      if (!triggeredRef.current && magnitude > threshold) {
        triggeredRef.current = true;
        onMotionDetectedRef.current();
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      triggeredRef.current = false;
    };
  }, [isActive, threshold]);
}
