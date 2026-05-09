'use client'

import { motion } from 'framer-motion'
import { Team } from '@/lib/gameState'

const PIECE_SYMBOLS: Record<string, string> = {
  'p': '♟',
  'n': '♞',
  'b': '♝',
  'r': '♜',
  'q': '♛',
  'k': '♚'
}

interface PlayerPanelProps {
  team: Team
  capturedPieces: string[]
  accuracy: number
  isActive: boolean
}

export function PlayerPanel({ team, capturedPieces, accuracy, isActive }: PlayerPanelProps) {
  const sortedPieces = [...capturedPieces].sort((a, b) => {
    const order = ['q', 'r', 'b', 'n', 'p']
    return order.indexOf(a) - order.indexOf(b)
  })

  const teamLabel = team === Team.WHITE ? 'TEAM WHITE' : 'TEAM BLACK'
  const teamColor = team === Team.WHITE ? 'text-yellow-400' : 'text-gray-300'

  return (
    <aside className="w-64 glass-panel border-r border-gray-700/30 p-4 flex flex-col gap-5 z-10 shrink-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20">
            <span className="material-symbols-outlined text-yellow-400 text-xl">shield</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{team === Team.WHITE ? 'You' : 'Opponent'}</h3>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${teamColor}`}>{teamLabel}</p>
          </div>
        </div>

        <div className="py-1 px-3 bg-gray-700/30 rounded-full inline-flex items-center gap-2 w-fit">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-[10px] font-bold text-gray-400 uppercase">{teamLabel.split(' ')[1]}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Captured Pieces</h4>
        <div className="flex flex-wrap gap-1 p-2 bg-gray-800/40 rounded-lg border border-gray-700/30 min-h-[80px] content-start">
          {sortedPieces.length === 0 ? (
            <span className="text-gray-600 text-xs">None yet</span>
          ) : (
            sortedPieces.map((piece, index) => (
              <span
                key={`${piece}-${index}`}
                className="text-2xl bg-gray-700/50 rounded px-1 text-white border border-gray-600/50"
              >
                {PIECE_SYMBOLS[piece] || piece}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="glass-panel p-3 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Accuracy</span>
            <span className="text-sm font-bold text-yellow-400">{accuracy.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-yellow-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(accuracy, 100)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ filter: 'drop-shadow(0 0 4px rgba(234,179,8,0.4))' }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
