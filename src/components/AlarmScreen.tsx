import { useEffect, useRef, useState } from 'react';

interface Props {
  onStop: () => void;
}

export function AlarmScreen({ onStop }: Props) {
  const [flash, setFlash] = useState(true);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setFlash((f) => !f), 500);
    return () => clearInterval(interval);
  }, []);

  const handleStop = () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    onStop();
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 transition-colors duration-300"
      style={{ backgroundColor: flash ? '#1a0000' : '#0a0000' }}
    >
      <div className="relative mb-6">
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center border-4"
          style={{
            borderColor: flash ? '#ef4444' : '#7f1d1d',
            backgroundColor: flash ? '#ef4444' + '22' : 'transparent',
            boxShadow: flash ? '0 0 40px #ef444488' : 'none',
            transition: 'all 0.3s',
          }}
        >
          <span className="text-6xl animate-bounce">⚠️</span>
        </div>
        <div
          className="absolute inset-0 rounded-full border-2 border-red-500 opacity-50"
          style={{
            animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
          }}
        />
      </div>

      <h1
        className="text-5xl font-black text-center mb-3 leading-tight"
        style={{
          color: flash ? '#fca5a5' : '#ef4444',
          textShadow: flash ? '0 0 20px #ef4444' : 'none',
          transition: 'all 0.3s',
        }}
      >
        起きてください！
      </h1>

      <p className="text-red-400 text-lg font-bold text-center mb-2">
        動きを検知しました
      </p>

      <div className="bg-red-950/50 border border-red-900/50 rounded-2xl px-6 py-4 mb-10 text-center">
        <p className="text-red-300 text-sm leading-relaxed">
          布団が動きました。<br />
          昼寝は気づかないうちに始まります。<br />
          <span className="text-red-200 font-bold">今すぐ起き上がってください！</span>
        </p>
      </div>

      <button
        type="button"
        onClick={handleStop}
        className="w-full max-w-xs bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-xl rounded-2xl py-5 shadow-2xl shadow-red-500/40 active:scale-95 transition-all duration-200 hover:from-red-400 hover:to-orange-400"
        style={{ boxShadow: flash ? '0 0 30px #ef444460' : '0 8px 20px #ef444430', touchAction: 'manipulation' }}
      >
        アラームを止める
      </button>

      <p className="text-red-900 text-xs mt-4 text-center leading-relaxed">
        ボタンを押すまでアラームは鳴り続けます<br />
        止めると残り時間からタイマーに戻ります
      </p>
    </div>
  );
}
