interface Props {
  onRestart: () => void;
}

export function SuccessScreen({ onRestart }: Props) {
  return (
    <div className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center px-6 animate-bounce-in">
      {/* Success icon */}
      <div className="relative mb-8">
        <div className="w-36 h-36 rounded-full bg-emerald-500/10 border-4 border-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
          <svg className="w-20 h-20 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        {/* Glow */}
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl scale-150 -z-10" />
      </div>

      {/* Success text */}
      <h1 className="text-4xl font-black text-white text-center mb-3 leading-tight">
        すっきり<br />
        <span className="text-emerald-400">起きられましたね！</span>
      </h1>

      <p className="text-[#64748b] text-base text-center mb-2">
        タイマーが終了しました
      </p>

      {/* Celebration details */}
      <div className="bg-[#0d1626] border border-[#1e2d45] rounded-2xl p-5 mb-10 w-full max-w-xs">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎉</span>
          <div>
            <p className="text-white font-bold text-sm">昼寝を防止しました</p>
            <p className="text-[#64748b] text-xs">布団の上で静止を維持しました</p>
          </div>
        </div>
        <div className="border-t border-[#1e2d45] pt-3">
          <p className="text-[#94a3b8] text-xs leading-relaxed text-center">
            この達成感を大切に、<br />
            活動的な午後を過ごしましょう！
          </p>
        </div>
      </div>

      {/* Restart button */}
      <button
        onClick={onRestart}
        className="w-full max-w-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-lg rounded-2xl py-4 shadow-2xl shadow-emerald-500/30 active:scale-95 transition-all duration-200 hover:from-emerald-400 hover:to-teal-400"
      >
        もう一度タイマーを設定する
      </button>
    </div>
  );
}
