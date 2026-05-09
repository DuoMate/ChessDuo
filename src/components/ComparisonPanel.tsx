'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MoveComparison } from '@/lib/localGame'

interface ComparisonPanelProps {
  comparison: MoveComparison | null
  isVisible: boolean
  onAnimationComplete?: () => void
}

export function ComparisonPanel({ comparison, isVisible, onAnimationComplete }: ComparisonPanelProps) {
  const humanAccuracy = comparison?.player1Accuracy ?? 0
  const teammateAccuracy = comparison?.player2Accuracy ?? 0
  const humanWon = comparison?.winnerId === 'player1'
  const isSync = comparison?.isSync ?? false

  const humanCategory = comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' }
  const teammateCategory = comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' }

  return (
    <AnimatePresence onExitComplete={onAnimationComplete}>
      {isVisible && comparison && (
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-72 glass-panel border-l border-gray-700/30 flex flex-col shrink-0"
        >
          <div className="p-4 border-b border-gray-700/30 bg-yellow-500/5">
            <h2 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">analytics</span>
              MOVE COMPARISON
            </h2>
            <p className={`text-xs font-bold uppercase mt-1 tracking-wider ${isSync ? 'text-yellow-400' : humanWon ? 'text-green-400' : 'text-red-400'}`}>
              {isSync ? 'Synchronized!' : humanWon ? 'You Won This Turn!' : 'Teammate Won!'}
            </p>
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4">
            {/* Player 1 Move Card */}
            <div className={`relative p-3 rounded-xl border ${humanWon && !isSync ? 'bg-green-500/5 border-green-500/30' : !humanWon && !isSync ? 'bg-red-500/5 border-red-500/30 opacity-75' : 'bg-gray-700/30 border-gray-600/30'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">You</p>
                  <h5 className="text-sm font-bold text-white">{comparison.player1Move}</h5>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${humanWon ? 'text-green-400' : 'text-gray-400'}`}>{humanAccuracy.toFixed(0)}%</span>
                  <p className="text-[10px] font-bold text-gray-500">{humanCategory.label}</p>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${humanWon && !isSync ? 'bg-green-500' : 'bg-gray-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${humanAccuracy}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={humanWon && !isSync ? { filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.3))' } : {}}
                />
              </div>
              <div className={`absolute -right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center border-2 border-gray-900 ${humanWon && !isSync ? 'bg-green-600' : 'bg-red-600'}`}>
                <span className="material-symbols-outlined text-xs text-white">{humanWon && !isSync ? 'check' : 'close'}</span>
              </div>
            </div>

            {/* Player 2 Move Card */}
            <div className={`relative p-3 rounded-xl border ${!humanWon && !isSync ? 'bg-green-500/5 border-green-500/30' : humanWon && !isSync ? 'bg-red-500/5 border-red-500/30 opacity-75' : 'bg-gray-700/30 border-gray-600/30'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Teammate</p>
                  <h5 className="text-sm font-bold text-gray-300">{comparison.player2Move}</h5>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${!humanWon ? 'text-green-400' : 'text-gray-400'}`}>{teammateAccuracy.toFixed(0)}%</span>
                  <p className="text-[10px] font-bold text-gray-500">{teammateCategory.label}</p>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${!humanWon && !isSync ? 'bg-green-500' : 'bg-gray-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${teammateAccuracy}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={!humanWon && !isSync ? { filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.3))' } : {}}
                />
              </div>
              <div className={`absolute -right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center border-2 border-gray-900 ${!humanWon && !isSync ? 'bg-green-600' : 'bg-red-600'}`}>
                <span className="material-symbols-outlined text-xs text-white">{!humanWon && !isSync ? 'check' : 'close'}</span>
              </div>
            </div>

            {isSync && (
              <div className="text-center p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <span className="text-yellow-400 text-xs font-medium">Both chose the same move!</span>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-700/30">
            <div className="glass-panel p-3 rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400 text-base">verified_user</span>
              <div>
                <p className="text-[10px] font-bold text-yellow-400 uppercase">Conflict Resolved</p>
                <p className="text-[10px] text-gray-400">Highest accuracy move played.</p>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
