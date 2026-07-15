'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Handshake, RotateCcw, LogOut, X, Eye } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'
import { MODAL_SPRING } from './modalConstants'

interface GameOverModalProps {
  winner: 'WHITE' | 'BLACK' | 'DRAW'
  onPlayAgain: () => void
  onClose?: () => void
  gameResult?: string
  gameOverReason?: string | null
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
}: GameOverModalProps) {
  const isAbandoned = gameOverReason === 'abandoned'

  useEscapeKey(() => onClose?.(), !!onClose)
  useScrollLock(true)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-xl"
        onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}
      >
        <motion.div
          initial={{ scale: 0.5, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={MODAL_SPRING}
          className="relative w-full max-w-sm overflow-hidden rounded-[30px] border border-white/70 bg-white/90 p-6 text-center shadow-[0_24px_90px_rgba(2,6,23,0.25)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/90"
        >
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X size={16} className="text-slate-400 dark:text-slate-500" />
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
              <LogOut size={72} className="mx-auto text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
            )}
            {!isAbandoned && winner === 'WHITE' && (
              <Trophy size={72} className="mx-auto text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
            )}
            {!isAbandoned && winner === 'BLACK' && (
              <Trophy size={72} className="mx-auto text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
            )}
            {!isAbandoned && winner === 'DRAW' && (
              <Handshake size={72} className="mx-auto text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
            )}
          </motion.div>

          <h2 className={`relative z-10 mt-4 mb-1 text-2xl font-bold ${
            isAbandoned ? 'text-amber-500 dark:text-amber-400' : winner === 'WHITE' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
          } font-game`}>
            {isAbandoned && 'Match Abandoned'}
            {!isAbandoned && winner === 'WHITE' && 'White Team Wins!'}
            {!isAbandoned && winner === 'BLACK' && 'Black Team Wins!'}
            {!isAbandoned && winner === 'DRAW' && "It's a Draw!"}
          </h2>

          <p className="relative z-10 mb-2 text-sm text-slate-500 dark:text-slate-400">
            {isAbandoned ? 'Your teammate left the match' : 'Great game!'}
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onPlayAgain}
            className="relative z-10 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-400"
          >
            <RotateCcw size={18} />
            {isAbandoned ? 'Go Home' : 'Play Again'}
          </motion.button>

          {onClose && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="relative z-10 mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
            >
              <Eye size={18} />
              Review Board
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
