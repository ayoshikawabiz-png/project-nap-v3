import { useState, useCallback, useRef } from 'react';
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
  // Incremented each time a new timer session starts; used as key to force full remount of ActiveScreen
  const sessionRef = useRef(0);
  const [sessionKey, setSessionKey] = useState(0);

  const handleStart = useCallback((duration: number, sens: number) => {
    stopAlarm(); // defensive: ensure any lingering alarm is silenced before new session
    sessionRef.current += 1;
    setSessionKey(sessionRef.current);
    setDurationSeconds(duration);
    setSensitivity(sens);
    setResumeTimeLeft(null);
    setMotionCount(0);
    setAppState('active');
  }, []);

  const handleAlarm = useCallback((timeLeft: number) => {
    setResumeTimeLeft(timeLeft);
    setMotionCount((c) => c + 1);
    startAlarm();
    setAppState('alarm');
  }, []);

  const handleAlarmStop = useCallback(() => {
    stopAlarm();
    setAppState('active');
  }, []);

  const handleSuccess = useCallback(() => {
    setAppState('success');
  }, []);

  const handleStop = useCallback(() => {
    stopAlarm();
    setAppState('setup');
  }, []);

  const handleRestart = useCallback(() => {
    setAppState('setup');
  }, []);

  return (
    <div className="max-w-md mx-auto">
      {appState === 'setup' && (
        <SetupScreen onStart={handleStart} />
      )}
      {appState === 'active' && (
        <ActiveScreen
          key={sessionKey}
          durationSeconds={durationSeconds}
          sensitivity={sensitivity}
          initialTimeLeft={resumeTimeLeft ?? durationSeconds}
          motionCount={motionCount}
          onAlarm={handleAlarm}
          onSuccess={handleSuccess}
          onStop={handleStop}
        />
      )}
      {appState === 'alarm' && (
        <AlarmScreen onStop={handleAlarmStop} />
      )}
      {appState === 'success' && (
        <SuccessScreen onRestart={handleRestart} />
      )}
    </div>
  );
}
