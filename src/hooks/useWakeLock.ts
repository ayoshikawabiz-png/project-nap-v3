import { useEffect, useRef } from 'react';

export function useWakeLock(isActive: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!isActive) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    if (!('wakeLock' in navigator)) return;

    let released = false;

    async function acquire() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          if (!released) acquire();
        });
      } catch {
        // Wake Lock not available or denied — silent fail
      }
    }

    acquire();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        acquire();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isActive]);
}
