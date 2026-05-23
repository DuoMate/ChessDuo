'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Handshake, RotateCcw, LogOut, UserPlus } from 'lucide-react'
import { MatchSummary, MatchStats } from './MatchSummary'

interface GameOverModalProps {
  winner: 'WHITE' | 'BLACK' | 'DRAW'
  onPlayAgain: () => void
  gameResult?: string
  gameOverReason?: string | null
  stats?: MatchStats
  isOnline?: boolean
  roomId?: string
  showSignupPrompt?: boolean
  onSignup?: () => void
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
  gameResult,
  gameOverReason,
  stats,
  isOnline: _isOnline,
  roomId: _roomId,
  showSignupPrompt,
  onSignup,
}: GameOverModalProps) {
  const [showStats, setShowStats] = useState(true)
  const isAbandoned = gameOverReason === 'abandoned'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 250 }}
        className="bg-game-surface p-6 rounded-2xl text-center border border-white/10 shadow-2xl w-full max-w-sm relative overflow-hidden"
      >
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
          isAbandoned ? 'text-amber-400' : winner === 'WHITE' ? 'text-white' : 'text-gray-300'
        } font-game`}>
          {isAbandoned && 'Match Abandoned'}
          {!isAbandoned && winner === 'WHITE' && 'White Team Wins!'}
          {!isAbandoned && winner === 'BLACK' && 'Black Team Wins!'}
          {!isAbandoned && winner === 'DRAW' && "It's a Draw!"}
        </h2>

        <p className="text-gray-500 mb-2 relative z-10">
          {isAbandoned ? 'Your teammate left the match' : 'Great game!'}
        </p>

        {stats && gameResult && showStats && !isAbandoned && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 mt-4 relative z-10"
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

        {stats && gameResult && !showStats && !isAbandoned && (
          <button
            onClick={() => setShowStats(true)}
            className="text-amber-400 hover:text-amber-300 text-sm mb-3 block w-full relative z-10"
          >
            Show stats
          </button>
        )}

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onPlayAgain}
          className="relative z-10 bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-900 px-8 py-3.5 rounded-xl font-bold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg shadow-amber-500/20 inline-flex items-center gap-2 min-h-[44px]"
        >
          <RotateCcw size={18} />
          {isAbandoned ? 'Go Home' : 'Play Again'}
        </motion.button>

        {showSignupPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="relative z-10 mt-4 pt-4 border-t border-white/10"
          >
            <p className="text-sm text-gray-300 mb-3">Enjoyed the game? Create a profile to save your progress.</p>
            <button
              onClick={onSignup}
              className="w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              Create Profile
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
