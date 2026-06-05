'use client'

import { motion } from 'framer-motion'
import { Trophy, Handshake, RotateCcw, LogOut, X } from 'lucide-react'

interface GameOverModalProps {
  winner: 'WHITE' | 'BLACK' | 'DRAW'
  onPlayAgain: () => void
  onClose?: () => void
  gameResult?: string
  gameOverReason?: string | null
  isOnline?: boolean
  roomId?: string
}

function Particles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            opacity: 1,
            x: '50%',
            y: '45%',
            scale: 0,
          }}
          animate={{
            opacity: 0,
            x: `${50 + (Math.random() - 0.5) * 60}%`,
            y: `${45 + (Math.random() - 0.5) * 40}%`,
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 1.2 + Math.random() * 0.8,
            delay: 0.3 + Math.random() * 0.5,
            ease: 'easeOut',
          }}
          className="absolute w-2 h-2 rounded-full bg-amber-400/60"
        />
      ))}
    </div>
  )
}

export function GameOverModal({
  winner,
  onPlayAgain,
  onClose,
  gameResult,
  gameOverReason,
  isOnline: _isOnline,
  roomId: _roomId,
}: GameOverModalProps) {
  const isAbandoned = gameOverReason === 'abandoned'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 250 }}
        className="bg-game-surface p-6 rounded-2xl text-center border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-sm relative overflow-hidden"
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X size={16} className="text-gray-400" />
          </button>
        )}
        {winner !== 'DRAW' && !isAbandoned && <Particles />}

        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className="relative z-10"
        >
          {isAbandoned && (
            <LogOut size={72} className="mx-auto text-amber-400" strokeWidth={1.5} />
          )}
          {!isAbandoned && winner === 'WHITE' && (
            <Trophy size={72} className="mx-auto text-amber-400" strokeWidth={1.5} />
          )}
          {!isAbandoned && winner === 'BLACK' && (
            <Trophy size={72} className="mx-auto text-gray-400" strokeWidth={1.5} />
          )}
          {!isAbandoned && winner === 'DRAW' && (
            <Handshake size={72} className="mx-auto text-gray-400" strokeWidth={1.5} />
          )}
        </motion.div>

        <h2 className={`text-2xl font-bold mt-4 mb-1 relative z-10 ${
          isAbandoned ? 'text-amber-500 dark:text-amber-400' : winner === 'WHITE' ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'
        } font-game`}>
          {isAbandoned && 'Match Abandoned'}
          {!isAbandoned && winner === 'WHITE' && 'White Team Wins!'}
          {!isAbandoned && winner === 'BLACK' && 'Black Team Wins!'}
          {!isAbandoned && winner === 'DRAW' && "It's a Draw!"}
        </h2>

        <p className="text-gray-500 dark:text-gray-400 mb-2 relative z-10">
          {isAbandoned ? 'Your teammate left the match' : 'Great game!'}
        </p>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onPlayAgain}
          className="relative z-10 bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-900 px-8 py-3.5 rounded-xl font-bold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg shadow-amber-500/20 inline-flex items-center gap-2 min-h-[44px]"
        >
          <RotateCcw size={18} />
          {isAbandoned ? 'Go Home' : 'Play Again'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
