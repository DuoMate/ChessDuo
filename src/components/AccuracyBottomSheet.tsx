'use client'

import { motion } from 'framer-motion'
import { MoveComparison } from '@/features/offline/game/localGame'
import { InsightsGate } from './InsightsGate'

interface AccuracyBottomSheetProps {
  comparison: MoveComparison | null
  isVisible: boolean
  playerId?: string | null  // Current player's ID
  player1Id?: string | null // Which player ID is player1 in the game
}

export function AccuracyBottomSheet({ comparison, isVisible, playerId, player1Id }: AccuracyBottomSheetProps) {
  // FIX: Determine if current player is player1 by comparing IDs
  const isPlayer1 = playerId && player1Id ? playerId === player1Id : true
  
  // FIX: Determine if YOU won by comparing winnerId with your position
  // winnerId tells us which player (player1 or player2) won
  // isPlayer1 tells us if we are player1
  const youWon = (isPlayer1 && comparison?.winnerId === 'player1') || 
                 (!isPlayer1 && comparison?.winnerId === 'player2')
  
  // Accuracy based on your position
  const yourAccuracy = isPlayer1 
    ? (comparison?.player1Accuracy ?? 0) 
    : (comparison?.player2Accuracy ?? 0)
  const teammateAccuracy = isPlayer1 
    ? (comparison?.player2Accuracy ?? 0) 
    : (comparison?.player1Accuracy ?? 0)
  
  // Your move
  const yourMove = isPlayer1 
    ? comparison?.player1Move 
    : comparison?.player2Move
  
  // Teammate's move  
  const teammateMove = isPlayer1 
    ? comparison?.player2Move 
    : comparison?.player1Move
  
  // Your category
  const yourCategory = isPlayer1 
    ? (comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' })
    : (comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' })
  
  // Teammate's category  
  const teammateCategory = isPlayer1 
    ? (comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' })
    : (comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' })
  
  // For header: "You Won" or "Teammate Won"
  const humanWon = youWon
  
  // Use the categories from earlier
  const humanCategory = yourCategory
  // teammateCategory already defined above

  if (!isVisible || !comparison) return null

  // ROBUST FIX: Compute sync from actual moves, don't trust stored isSync
  // This prevents stale isSync from previous turns being shown incorrectly
  const storedIsSync = comparison.isSync ?? false
  const computedIsSync = comparison.player1Move === comparison.player2Move

  // Use computed sync if there's a mismatch (defensive)
  const isSync = storedIsSync !== computedIsSync ? computedIsSync : storedIsSync

  return (
    <motion.div
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 25,
        mass: 0.8
      }}
      className="w-full max-w-[500px] mx-auto"
    >
      {/* Drag Handle */}
      <div className="flex justify-center mb-2">
        <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
      </div>

      <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl border border-gray-600">
        {/* Header */}
        <div className="text-center mb-4">
          <motion.h3 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, delay: 0.1 }}
            className="text-yellow-400 font-bold text-lg uppercase tracking-wide"
          >
            {isSync ? '🎯 Synchronized!' : humanWon ? '🎉 You Won This Turn!' : '💪 Teammate Won!'}
          </motion.h3>
        </div>

        {/* Player Rows */}
        <div className="space-y-3">
          {/* You */}
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`flex items-center justify-between p-3 rounded-xl ${
              humanWon && !isSync 
                ? 'bg-green-900/40 border border-green-500/50' 
                : !humanWon && !isSync 
                  ? 'bg-red-900/40 border border-red-500/50' 
                  : 'bg-gray-700/50'
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">You</span>
                {humanWon && !isSync && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold"
                  >
                    WINNER
                  </motion.span>
                )}
                {!humanWon && !isSync && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold"
                  >
                    LOSER
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-300 text-sm font-mono">{yourMove}</span>
                <span 
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${humanCategory.color}30`, color: humanCategory.color }}
                >
                  {humanCategory.emoji} {humanCategory.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  style={{ 
                    backgroundColor: yourAccuracy >= 90 ? '#22c55e' : yourAccuracy >= 70 ? '#eab308' : '#ef4444'
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${yourAccuracy}%` }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                />
              </div>
              <motion.span 
                className={`font-bold text-xl ${humanWon ? 'text-green-400' : 'text-gray-400'}`}
                key={yourAccuracy}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
              >
                {yourAccuracy.toFixed(0)}%
              </motion.span>
            </div>
          </motion.div>

          {/* Teammate */}
          <motion.div 
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`flex items-center justify-between p-3 rounded-xl ${
              !humanWon && !isSync 
                ? 'bg-green-900/40 border border-green-500/50' 
                : humanWon && !isSync 
                  ? 'bg-red-900/40 border border-red-500/50' 
                  : 'bg-gray-700/50'
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-bold">Teammate</span>
                {!humanWon && !isSync && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.25 }}
                    className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold"
                  >
                    WINNER
                  </motion.span>
                )}
                {humanWon && !isSync && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.25 }}
                    className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold"
                  >
                    LOSER
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-300 text-sm font-mono">{teammateMove}</span>
                <span 
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${teammateCategory.color}30`, color: teammateCategory.color }}
                >
                  {teammateCategory.emoji} {teammateCategory.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  style={{ 
                    backgroundColor: teammateAccuracy >= 90 ? '#22c55e' : teammateAccuracy >= 70 ? '#eab308' : '#ef4444'
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${teammateAccuracy}%` }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                />
              </div>
              <motion.span 
                className={`font-bold text-xl ${!humanWon ? 'text-green-400' : 'text-gray-400'}`}
                key={teammateAccuracy}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
              >
                {teammateAccuracy.toFixed(0)}%
              </motion.span>
            </div>
          </motion.div>
        </div>

        {/* Sync Message */}
        {isSync && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 text-center"
          >
            <span className="text-yellow-400 text-sm font-medium">
              ✨ Both chose the same move!
            </span>
          </motion.div>
        )}

        {/* Centipawn Loss */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 pt-3 border-t border-gray-600"
        >
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Centipawn Loss</span>
            <span className="text-gray-400">
              You: <span className={comparison.player1Loss < comparison.player2Loss ? 'text-green-400' : 'text-gray-300'}>{comparison.player1Loss}cp</span>
              {' | '}
              Mate: <span className={comparison.player2Loss < comparison.player1Loss ? 'text-green-400' : 'text-gray-300'}>{comparison.player2Loss}cp</span>
            </span>
          </div>
        </motion.div>

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
        />*
      </div>
    </motion.div>
  )
}