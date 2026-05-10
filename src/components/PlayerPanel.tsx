'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Team } from '@/features/game-engine/gameState'
import { MoveComparison } from '@/features/offline/game/localGame'
import { InsightsGate } from './InsightsGate'

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
  blackCapturedPieces: string[]
  accuracy: number
  isActive: boolean
  comparison?: MoveComparison | null
  playerId?: string | null
  player1Id?: string | null
}

export function PlayerPanel({ team, capturedPieces, blackCapturedPieces, accuracy, isActive, comparison, playerId, player1Id }: PlayerPanelProps) {
  const sortedPieces = [...capturedPieces].sort((a, b) => {
    const order = ['q', 'r', 'b', 'n', 'p']
    return order.indexOf(a) - order.indexOf(b)
  })
  const sortedBlackPieces = [...blackCapturedPieces].sort((a, b) => {
    const order = ['q', 'r', 'b', 'n', 'p']
    return order.indexOf(a) - order.indexOf(b)
  })

  const teamLabel = team === Team.WHITE ? 'TEAM WHITE' : 'TEAM BLACK'
  const teamColor = team === Team.WHITE ? 'text-yellow-400' : 'text-gray-300'

  const isPlayer1 = playerId && player1Id ? playerId === player1Id : true
  const isSync = comparison?.isSync ?? false
  const humanWon = isPlayer1
    ? (comparison?.winnerId === 'player1')
    : (comparison?.winnerId === 'player2')

  const yourAccuracy = isPlayer1
    ? (comparison?.player1Accuracy ?? 0)
    : (comparison?.player2Accuracy ?? 0)
  const teammateAccuracy = isPlayer1
    ? (comparison?.player2Accuracy ?? 0)
    : (comparison?.player1Accuracy ?? 0)

  const yourMove = isPlayer1 ? comparison?.player1Move : comparison?.player2Move
  const teammateMove = isPlayer1 ? comparison?.player2Move : comparison?.player1Move

  const yourCategory = isPlayer1
    ? (comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' })
    : (comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' })
  const teammateCategory = isPlayer1
    ? (comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' })
    : (comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' })

  return (
    <aside className="w-72 glass-panel border-r border-gray-700/30 p-4 flex flex-col gap-4 z-10 shrink-0 overflow-y-auto">
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

      <AnimatePresence mode="wait">
        {comparison && (
          <motion.div
            key="turn-result"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            <div className="border-t border-gray-700/50 pt-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Last Turn</h4>

              <div className="text-center mb-2">
                <p className={`text-xs font-bold uppercase ${isSync ? 'text-yellow-400' : humanWon ? 'text-green-400' : 'text-red-400'}`}>
                  {isSync ? 'Synchronized!' : humanWon ? 'You Won This Turn!' : 'Teammate Won!'}
                </p>
              </div>

              <div className={`p-2 rounded-lg mb-1.5 ${humanWon && !isSync ? 'bg-green-900/30 border border-green-500/30' : !humanWon && !isSync ? 'bg-red-900/30 border border-red-500/30' : 'bg-gray-700/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-white">You</span>
                    {humanWon && !isSync && <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">WINNER</span>}
                    {!humanWon && !isSync && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">LOSER</span>}
                  </div>
                  <span className={`text-xs font-bold ${humanWon ? 'text-green-400' : 'text-gray-400'}`}>{yourAccuracy.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-gray-300 font-mono">{yourMove}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${yourCategory.color}20`, color: yourCategory.color }}>
                    {yourCategory.emoji} {yourCategory.label}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1.5">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: yourAccuracy >= 90 ? '#22c55e' : yourAccuracy >= 70 ? '#eab308' : '#ef4444' }}
                    initial={{ width: 0 }} animate={{ width: `${yourAccuracy}%` }} transition={{ delay: 0.2, duration: 0.4 }}
                  />
                </div>
              </div>

              <div className={`p-2 rounded-lg mb-1.5 ${!humanWon && !isSync ? 'bg-green-900/30 border border-green-500/30' : humanWon && !isSync ? 'bg-red-900/30 border border-red-500/30' : 'bg-gray-700/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-gray-300">Teammate</span>
                    {!humanWon && !isSync && <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">WINNER</span>}
                    {humanWon && !isSync && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">LOSER</span>}
                  </div>
                  <span className={`text-xs font-bold ${!humanWon ? 'text-green-400' : 'text-gray-400'}`}>{teammateAccuracy.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-gray-300 font-mono">{teammateMove}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${teammateCategory.color}20`, color: teammateCategory.color }}>
                    {teammateCategory.emoji} {teammateCategory.label}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1.5">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: teammateAccuracy >= 90 ? '#22c55e' : teammateAccuracy >= 70 ? '#eab308' : '#ef4444' }}
                    initial={{ width: 0 }} animate={{ width: `${teammateAccuracy}%` }} transition={{ delay: 0.25, duration: 0.4 }}
                  />
                </div>
              </div>
            </div>

            {isSync && (
              <p className="text-[10px] text-yellow-400 text-center">Both chose the same move!</p>
            )}

            <InsightsGate
              playerId={playerId || ''}
              player1Move={comparison.player1Move}
              player2Move={comparison.player2Move}
              player1Accuracy={comparison.player1Accuracy}
              player2Accuracy={comparison.player2Accuracy}
              player1Loss={comparison.player1Loss}
              player2Loss={comparison.player2Loss}
              isSync={isSync}
              winnerId={comparison.winnerId as 'player1' | 'player2'}
              bestEngineMove={(comparison as any).bestEngineMove}
              bestEngineScore={(comparison as any).bestEngineScore}
            />
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="flex flex-col gap-2">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Captured by Black</h4>
        <div className="flex flex-wrap gap-1 p-2 bg-gray-800/40 rounded-lg border border-gray-700/30 min-h-[60px] content-start">
          {sortedBlackPieces.length === 0 ? (
            <span className="text-gray-600 text-xs">None yet</span>
          ) : (
            sortedBlackPieces.map((piece, index) => (
              <span
                key={`black-${piece}-${index}`}
                className="text-2xl bg-gray-700/50 rounded px-1 text-gray-400 border border-gray-600/50"
              >
                {PIECE_SYMBOLS[piece] || piece}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="glass-panel p-3 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Avg Accuracy</span>
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
    </aside>
  )
}
