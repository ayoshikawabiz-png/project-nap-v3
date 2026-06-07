import { useState, useCallback, useRef, useEffect } from 'react';
import { unlockAudio, endSessionAudio } from './utils/audio';
import { SetupScreen } from './components/SetupScreen';
import { ActiveScreen } from './components/ActiveScreen';
import { AlarmScreen } from './components/AlarmScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { startAlarm, stopAlarm } from './utils/audio';

type AppState = 'setup' | 'active' | 'alarm' | 'success';

export default function App() {
  const [appState, setAppState] = useState<AppState>('setup');
  const [durationSeconds, setDurationSeconds] = useState(20 * 60);
  const [sensitivity, setSensitivity] = useState(3);
  const [resumeTimeLeft, setResumeTimeLeft] = useState<number | null>(null);
  const [motionCount, setMotionCount] = useState(0);
  const [alarmCooldownUntil, setAlarmCooldownUntil] = useState(0);
  const sessionRef = useRef(0);
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    const warm = () => unlockAudio();
    document.addEventListener('pointerdown', warm, { once: true, passive: true });
    return () => document.removeEventListener('pointerdown', warm);
  }, []);

  const handleStart = useCallback((duration: number, sens: number) => {
    stopAlarm();
    sessionRef.current += 1;
    setSessionKey(sessionRef.current);
    setDurationSeconds(duration);
    setSensitivity(sens);
    setResumeTimeLeft(null);
    setMotionCount(0);
    setAlarmCooldownUntil(0);
    setAppState('active');
  }, []);

  const handleAlarm = useCallback((timeLeft: number) => {
    if (Date.now() < alarmCooldownUntil) return;
    setResumeTimeLeft(timeLeft);
    setMotionCount((c) => c + 1);
    startAlarm();
    setAppState('alarm');
  }, [alarmCooldownUntil]);

  const handleAlarmStop = useCallback(() => {
    stopAlarm();
    unlockAudio();
    setAlarmCooldownUntil(Date.now() + 12000);
    setAppState('active');
  }, []);

  const handleSuccess = useCallback(() => {
    endSessionAudio();
    setAppState('success');
  }, []);

  const handleStop = useCallback(() => {
    endSessionAudio();
    setAppState('setup');
  }, []);

  const handleRestart = useCallback(() => {
    endSessionAudio();
    setAppState('setup');
  }, []);

  const timerActive = appState === 'active' || appState === 'alarm';

  return (
    <div className="max-w-md mx-auto">
      {appState === 'setup' && (
        <SetupScreen onStart={handleStart} />
      )}
      {timerActive && (
        <ActiveScreen
          key={sessionKey}
          durationSeconds={durationSeconds}
          sensitivity={sensitivity}
          initialTimeLeft={resumeTimeLeft ?? durationSeconds}
          motionCount={motionCount}
          isPaused={appState === 'alarm'}
          alarmCooldownUntil={alarmCooldownUntil}
          onAlarm={handleAlarm}
          onSuccess={handleSuccess}
          onStop={handleStop}
        />
      )}
      {appState === 'alarm' && (
        <div className="fixed inset-0 z-50">
          <AlarmScreen onStop={handleAlarmStop} />
        </div>
      )}
      {appState === 'success' && (
        <SuccessScreen onRestart={handleRestart} />
      )}
    </div>
  );
}
