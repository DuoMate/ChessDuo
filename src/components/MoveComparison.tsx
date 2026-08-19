'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Crown, XCircle, Swords } from 'lucide-react'
import { MoveComparison } from '@/features/shared/gameTypes'
import { InsightsGate } from './InsightsGate'

interface MoveComparisonProps {
  comparison: MoveComparison | null
  isVisible: boolean
  onAnimationComplete?: () => void
  playerId?: string | null
}

export function MoveComparisonPanel({ comparison, isVisible, onAnimationComplete, playerId }: MoveComparisonProps) {
  const humanAccuracy = comparison?.player1Accuracy ?? 0
  const teammateAccuracy = comparison?.player2Accuracy ?? 0
  const humanWon = comparison?.winnerId === 'player1'
  const isSync = comparison?.isSync ?? false

  const humanCategory = comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' }
  const teammateCategory = comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' }

  return (
    <AnimatePresence onExitComplete={onAnimationComplete}>
      {isVisible && comparison && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="w-full"
        >
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-slate-700/50 w-full">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, delay: 0.1 }}
              className="text-center mb-3"
            >
              {isSync ? (
                <div className="flex items-center justify-center gap-2">
                  <Swords size={18} className="text-amber-600 dark:text-amber-400" />
                  <h3 className="text-amber-600 dark:text-amber-400 font-semibold text-sm uppercase tracking-wider">
                    Synchronized!
                  </h3>
                </div>
              ) : humanWon ? (
                <div className="flex items-center justify-center gap-2">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -5, 0] }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                  >
                    <Crown size={20} className="text-amber-600 dark:text-amber-400" />
                  </motion.div>
                  <h3 className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">
                    You Won This Turn!
                  </h3>
                </div>
              ) : (
                <h3 className="text-blue-400 font-semibold text-sm uppercase tracking-wider">
                  Teammate Won This Turn!
                </h3>
              )}
            </motion.div>

            <div className="space-y-2.5">
              <motion.div
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  humanWon && !isSync
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : !humanWon && !isSync
                    ? 'bg-rose-500/10 border-rose-500/40'
                    : 'bg-slate-800/40 border-slate-700/40'
                }`}
              >
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-100 font-bold text-sm">You</span>
                    {isSync ? null : humanWon ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="inline-flex items-center gap-1 text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold"
                      >
                        <Crown size={10} /> WINNER
                      </motion.span>
                    ) : (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="inline-flex items-center gap-1 text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold"
                      >
                        <XCircle size={10} /> LOSER
                      </motion.span>
                    )}
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-md font-medium w-fit"
                    style={{ backgroundColor: `${humanCategory.color}25`, color: humanCategory.color }}
                  >
                    {humanCategory.emoji} {humanCategory.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-slate-100 text-base font-bold font-mono">{comparison.player1Move}</span>
                  <motion.span
                    className={`font-bold text-xl font-game ${humanWon ? 'text-emerald-400' : 'text-slate-500'}`}
                    key={humanAccuracy}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                  >
                    {humanAccuracy.toFixed(0)}
                  </motion.span>
                </div>
              </motion.div>

              <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  !humanWon && !isSync
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : humanWon && !isSync
                    ? 'bg-rose-500/10 border-rose-500/40'
                    : 'bg-slate-800/40 border-slate-700/40'
                }`}
              >
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-300 font-bold text-sm">Teammate</span>
                    {isSync ? null : !humanWon ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="inline-flex items-center gap-1 text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold"
                      >
                        <Crown size={10} /> WINNER
                      </motion.span>
                    ) : (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="inline-flex items-center gap-1 text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold"
                      >
                        <XCircle size={10} /> LOSER
                      </motion.span>
                    )}
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-md font-medium w-fit"
                    style={{ backgroundColor: `${teammateCategory.color}25`, color: teammateCategory.color }}
                  >
                    {teammateCategory.emoji} {teammateCategory.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-slate-300 text-base font-bold font-mono">{comparison.player2Move}</span>
                  <motion.span
                    className={`font-bold text-xl font-game ${!humanWon ? 'text-emerald-400' : 'text-slate-500'}`}
                    key={teammateAccuracy}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                  >
                    {teammateAccuracy.toFixed(0)}
                  </motion.span>
                </div>
              </motion.div>
            </div>

            {isSync && (
              <div className="mt-3 text-center">
                <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                  Both chose the same move!
                </span>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-center gap-2">
              <span className="text-xs text-slate-500">Centipawn Loss</span>
              <span className="text-xs text-slate-400">
                You: <span className="text-slate-100 font-medium">{comparison.player1Loss}cp</span>
                {' \u00B7 '}
                Teammate: <span className="text-slate-100 font-medium">{comparison.player2Loss}cp</span>
              </span>
            </div>

            {playerId && (
              <InsightsGate
                playerId={playerId}
                player1Move={comparison.player1Move}
                player2Move={comparison.player2Move}
                player1Accuracy={comparison.player1Accuracy}
                player2Accuracy={comparison.player2Accuracy}
                player1Loss={comparison.player1Loss}
                player2Loss={comparison.player2Loss}
                isSync={comparison.isSync}
                winnerId={comparison.winnerId as 'player1' | 'player2'}
                bestEngineMove={(comparison as any).bestEngineMove}
                bestEngineScore={(comparison as any).bestEngineScore}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
