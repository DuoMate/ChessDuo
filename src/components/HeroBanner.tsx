'use client'

interface HeroBannerProps {
  result: 'win' | 'lose' | 'draw'
  teamName: string
  difficulty?: number
  onPlayAgain: () => void
  onChangeDifficulty: () => void
}

export function HeroBanner({ result, teamName, onPlayAgain, onChangeDifficulty }: HeroBannerProps) {
  const resultLabel = result === 'win' ? 'VICTORY!' : result === 'lose' ? 'DEFEAT' : 'DRAW'
  const resultColor = result === 'win' ? 'text-yellow-400' : result === 'lose' ? 'text-red-400' : 'text-gray-300'
  const resultGlow = result === 'win' ? 'text-shadow-gold' : ''

  return (
    <section className="relative mb-6 overflow-hidden rounded-xl glass-panel p-6 flex flex-col md:flex-row items-center gap-6">
      <div className="flex-1 text-center md:text-left z-10">
        <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full inline-block mb-2">
          {teamName}
        </span>
        <h1 className={`text-5xl font-extrabold ${resultColor} mb-2 tracking-tighter ${resultGlow}`}
          style={result === 'win' ? { textShadow: '0 0 20px rgba(234,179,8,0.4)' } : {}}
        >
          {resultLabel}
        </h1>
        <p className="text-base text-gray-400 max-w-md">
          {result === 'win'
            ? 'Dominant performance. Your team synergy was exceptional.'
            : result === 'lose'
              ? 'A tough battle. Analyze your moves and come back stronger.'
              : 'A hard-fought stalemate. Neither team gave an inch.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 justify-center md:justify-start">
          <button
            onClick={onPlayAgain}
            className="bg-yellow-500 text-gray-900 px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-yellow-400 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            PLAY AGAIN
          </button>
          <button
            onClick={onChangeDifficulty}
            className="border border-yellow-500 text-yellow-400 px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-yellow-500/10 active:scale-95 transition-all"
          >
            CHANGE DIFFICULTY
          </button>
        </div>
      </div>

      <div className="w-full md:w-[280px] shrink-0">
        <div className="glass-panel p-3 rounded-lg border border-yellow-500/20 relative aspect-square flex items-center justify-center">
          <span className="material-symbols-outlined text-7xl text-yellow-500/30">stadia_controller</span>
          <div className="absolute top-3 left-3 bg-yellow-500 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">
            Final
          </div>
        </div>
      </div>

      <div className="absolute -right-20 -top-20 w-96 h-96 bg-yellow-500/5 blur-[120px] rounded-full" />
    </section>
  )
}
