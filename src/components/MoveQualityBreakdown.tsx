'use client'

import { CategoryBreakdown } from '@/lib/resultsStore'

interface MoveQualityBreakdownProps {
  player1Accuracy: number
  player2Accuracy: number
  categories: {
    player1: CategoryBreakdown
    player2: CategoryBreakdown
  }
}

const BAR_COLORS = {
  great: 'bg-emerald-500',
  good: 'bg-lime-400',
  inaccuracy: 'bg-yellow-400',
  mistake: 'bg-orange-500',
  blunder: 'bg-red-600',
}

export function MoveQualityBreakdown({ player1Accuracy, player2Accuracy, categories }: MoveQualityBreakdownProps) {
  return (
    <div className="glass-panel p-5 rounded-xl">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Move Quality Breakdown</h3>

      <div className="mb-5">
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold text-white">YOU</span>
          <span className="text-base font-bold text-yellow-400">{Math.round(player1Accuracy)}%</span>
        </div>
        <div className="h-3 flex rounded-full overflow-hidden">
          {Object.entries(categories.player1).map(([key, value]) => (
            <div
              key={key}
              className={`h-full ${BAR_COLORS[key as keyof CategoryBreakdown]}`}
              style={{ width: `${value}%` }}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold text-gray-300">TEAMMATE</span>
          <span className="text-base font-bold text-gray-300">{Math.round(player2Accuracy)}%</span>
        </div>
        <div className="h-3 flex rounded-full overflow-hidden">
          {Object.entries(categories.player2).map(([key, value]) => (
            <div
              key={key}
              className={`h-full ${BAR_COLORS[key as keyof CategoryBreakdown]}`}
              style={{ width: `${value}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 justify-center text-[10px] font-bold uppercase">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Great</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-lime-400" /> Good</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Inacc</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Mistake</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> Blunder</div>
      </div>
    </div>
  )
}
