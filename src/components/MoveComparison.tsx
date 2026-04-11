'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MoveComparison } from '@/lib/localGame'

interface MoveComparisonProps {
  comparison: MoveComparison | null
  isVisible: boolean
  onAnimationComplete?: () => void
}

export function MoveComparisonPanel({ comparison, isVisible, onAnimationComplete }: MoveComparisonProps) {
  const humanAccuracy = comparison?.player1Accuracy ?? 0
  const teammateAccuracy = comparison?.player2Accuracy ?? 0
  const humanWon = comparison?.winnerId === 'player1'
  const isSync = comparison?.isSync ?? false

  const humanCategory = comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' }
  const teammateCategory = comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' }

  return (
    <AnimatePresence>
      {isVisible && comparison && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full"
        >
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-gray-600 w-full">
            <div className="text-center mb-3">
              <h3 className="text-yellow-400 font-semibold text-sm uppercase tracking-wide">
                {isSync ? 'Synchronized!' : humanWon ? 'You Won This Turn!' : 'Teammate Won!'}
              </h3>
            </div>

            <div className="space-y-2">
              <div className={`flex items-center justify-between p-2 rounded-lg ${humanWon && !isSync ? 'bg-green-900/30 border border-green-500/50' : !humanWon && !isSync ? 'bg-red-900/30 border border-red-500/50' : 'bg-gray-700/50'}`}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">You</span>
                    {!humanWon && !isSync && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded"
                      >
                        LOSER
                      </motion.span>
                    )}
                    {humanWon && !isSync && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded"
                      >
                        WINNER
                      </motion.span>
                    )}
                  </div>
                  <span 
                    className="text-xs px-1.5 py-0.5 rounded font-medium w-fit"
                    style={{ backgroundColor: `${humanCategory.color}30`, color: humanCategory.color }}
                  >
                    {humanCategory.emoji} {humanCategory.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white text-sm font-bold">{comparison.player1Move}</span>
                  <motion.span 
                    className={`font-bold text-lg ${humanWon ? 'text-green-400' : 'text-gray-400'}`}
                    key={humanAccuracy}
                    initial={{ scale: 1.2, color: humanWon ? '#22c55e' : '#9ca3af' }}
                    animate={{ scale: 1, color: humanWon ? '#22c55e' : '#9ca3af' }}
                  >
                    {humanAccuracy.toFixed(0)}%
                  </motion.span>
                </div>
              </div>

              <div className={`flex items-center justify-between p-2 rounded-lg ${!humanWon && !isSync ? 'bg-green-900/30 border border-green-500/50' : humanWon && !isSync ? 'bg-red-900/30 border border-red-500/50' : 'bg-gray-700/50'}`}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-medium text-sm">Teammate</span>
                    {humanWon && !isSync && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded"
                      >
                        LOSER
                      </motion.span>
                    )}
                    {!humanWon && !isSync && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded"
                      >
                        WINNER
                      </motion.span>
                    )}
                  </div>
                  <span 
                    className="text-xs px-1.5 py-0.5 rounded font-medium w-fit"
                    style={{ backgroundColor: `${teammateCategory.color}30`, color: teammateCategory.color }}
                  >
                    {teammateCategory.emoji} {teammateCategory.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm font-bold">{comparison.player2Move}</span>
                  <motion.span 
                    className={`font-bold text-lg ${!humanWon ? 'text-green-400' : 'text-gray-400'}`}
                    key={teammateAccuracy}
                    initial={{ scale: 1.2, color: !humanWon ? '#22c55e' : '#9ca3af' }}
                    animate={{ scale: 1, color: !humanWon ? '#22c55e' : '#9ca3af' }}
                  >
                    {teammateAccuracy.toFixed(0)}%
                  </motion.span>
                </div>
              </div>
            </div>

            {isSync && (
              <div className="mt-3 text-center">
                <span className="text-yellow-400 text-sm font-medium">
                  Both chose the same move!
                </span>
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-gray-600">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Centipawn Loss</span>
                <span>You: {comparison.player1Loss}cp | Bot: {comparison.player2Loss}cp</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}