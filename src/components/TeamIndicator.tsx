'use client'

import { motion } from 'framer-motion'
import { Crown, Bot, Swords } from 'lucide-react'

interface TeamIndicatorProps {
  whiteLabel: string
  blackLabel: string
  activeTeam: 'WHITE' | 'BLACK'
  isGameOver: boolean
  isBotThinking: boolean
}

export function TeamIndicator({
  whiteLabel,
  blackLabel,
  activeTeam,
  isGameOver,
  isBotThinking,
}: TeamIndicatorProps) {
  const whiteActive = activeTeam === 'WHITE' && !isGameOver
  const blackActive = activeTeam === 'BLACK' && !isGameOver

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3">
      <motion.div
        animate={{
          boxShadow: whiteActive
            ? '0 0 12px rgba(251,191,36,0.5), 0 0 24px rgba(251,191,36,0.2)'
            : '0 0 0px rgba(251,191,36,0)',
          scale: whiteActive ? 1.02 : 1,
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border min-w-0 ${
          whiteActive
            ? 'bg-gradient-to-r from-white/15 to-white/5 border-amber-400/60'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <Crown size={20} className={whiteActive ? 'text-amber-400' : 'text-gray-500'} />
        <span className="text-white font-semibold text-xs sm:text-sm truncate">{whiteLabel}</span>
      </motion.div>

      <div className="flex flex-col items-center">
        <Swords size={16} className="text-amber-400/60" />
        <span className="text-[9px] text-gray-600 font-semibold uppercase tracking-wider mt-0.5">VS</span>
      </div>

      <motion.div
        animate={{
          boxShadow: blackActive
            ? '0 0 12px rgba(156,163,175,0.5), 0 0 24px rgba(156,163,175,0.2)'
            : '0 0 0px rgba(156,163,175,0)',
          scale: blackActive ? 1.02 : 1,
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border min-w-0 ${
          blackActive
            ? 'bg-gradient-to-r from-gray-700 to-gray-600/50 border-gray-400/40'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <Bot size={20} className={blackActive ? 'text-gray-300' : 'text-gray-500'} />
        <span className="text-gray-300 font-semibold text-xs sm:text-sm truncate">{blackLabel}</span>
      </motion.div>

      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
        {isGameOver ? (
          <span className="text-amber-400 font-semibold text-xs uppercase tracking-wider">
            Game Over
          </span>
        ) : isBotThinking ? (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-blue-400 font-medium text-xs"
          >
            Your turn to move
          </motion.span>
        ) : (
          <span className="text-gray-500 text-xs">
            {activeTeam === 'WHITE' ? 'White to move' : 'Black to move'}
          </span>
        )}
      </div>
    </div>
  )
}
