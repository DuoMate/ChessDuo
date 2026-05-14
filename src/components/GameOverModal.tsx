'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MatchSummary, MatchStats } from './MatchSummary'

interface GameOverModalProps {
  winner: 'WHITE' | 'BLACK' | 'DRAW'
  onPlayAgain: () => void
  gameResult?: string
  gameOverReason?: string | null
  stats?: MatchStats
  isOnline?: boolean
  roomId?: string
}

export function GameOverModal({
  winner,
  onPlayAgain,
  gameResult,
  gameOverReason,
  stats,
  isOnline: _isOnline,
  roomId: _roomId,
}: GameOverModalProps) {
  const [showStats, setShowStats] = useState(true)

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <motion.div 
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="bg-gray-800 p-6 rounded-2xl text-center border-2 border-yellow-400 shadow-2xl w-full max-w-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="text-6xl mb-4"
        >
          {winner === 'WHITE' && '🏆'}
          {winner === 'BLACK' && '🏆'}
          {winner === 'DRAW' && '🤝'}
        </motion.div>
        
        <h2 className="text-3xl font-bold mb-2">
          {winner === 'WHITE' && <span className="text-white">White Team Wins!</span>}
          {winner === 'BLACK' && <span className="text-gray-300">Black Team Wins!</span>}
          {winner === 'DRAW' && <span className="text-gray-400">It's a Draw!</span>}
        </h2>
        
        <p className="text-gray-400 mb-2">Great game!</p>

        {stats && gameResult && showStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 mt-4"
          >
            <MatchSummary
              winner={winner}
              gameResult={gameResult}
              gameOverReason={gameOverReason || null}
              stats={stats}
              isOnline={false}
            />
            <button
              onClick={() => setShowStats(false)}
              className="text-gray-500 hover:text-gray-400 text-xs mt-2"
            >
              Hide stats
            </button>
          </motion.div>
        )}

        {stats && gameResult && !showStats && (
          <button
            onClick={() => setShowStats(true)}
            className="text-yellow-400 hover:text-yellow-300 text-sm mb-3 block w-full"
          >
            Show stats
          </button>
        )}
        
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPlayAgain}
          className="bg-yellow-400 text-gray-900 px-8 py-3 rounded-lg font-bold hover:bg-yellow-300 transition-colors"
        >
          Play Again
        </motion.button>
      </motion.div>
    </motion.div>
  )
}