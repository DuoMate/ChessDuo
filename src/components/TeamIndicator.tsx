'use client'

import { motion } from 'framer-motion'
import { Crown, Bot, Swords, User } from 'lucide-react'

interface TeamIndicatorProps {
  whiteLabel: string
  blackLabel: string
  activeTeam: 'WHITE' | 'BLACK'
  isGameOver: boolean
  whiteIsBot?: boolean
  blackIsBot?: boolean
}

export function TeamIndicator({
  whiteLabel,
  blackLabel,
  activeTeam,
  isGameOver,
  whiteIsBot = false,
  blackIsBot = false,
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
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border min-w-0 max-w-[40%] ${
          whiteActive
            ? 'bg-gradient-to-r from-gray-200 dark:from-white/15 to-gray-100 dark:to-white/5 border-amber-400/60'
            : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
        }`}
      >
        <Crown size={20} className={whiteActive ? 'text-amber-600 dark:text-amber-400 shrink-0' : 'text-gray-500 shrink-0'} />
        <span className="text-gray-900 dark:text-white font-semibold text-xs sm:text-sm break-words">{whiteLabel}</span>
      </motion.div>

      <div className="flex flex-col items-center">
        <Swords size={16} className="text-amber-600/60 dark:text-amber-400/60" />
        <span className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider mt-0.5">VS</span>
      </div>

      <motion.div
        animate={{
          boxShadow: blackActive
            ? '0 0 12px rgba(156,163,175,0.5), 0 0 24px rgba(156,163,175,0.2)'
            : '0 0 0px rgba(156,163,175,0)',
          scale: blackActive ? 1.02 : 1,
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border min-w-0 max-w-[40%] ${
          blackActive
            ? 'bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600/50 border-gray-400 dark:border-gray-400/40'
            : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
        }`}
      >
        {blackIsBot ? (
          <Bot size={20} className={blackActive ? 'text-gray-700 dark:text-gray-300 shrink-0' : 'text-gray-500 shrink-0'} />
        ) : (
          <User size={20} className={blackActive ? 'text-gray-700 dark:text-gray-300 shrink-0' : 'text-gray-500 shrink-0'} />
        )}
        <span className="text-gray-700 dark:text-gray-300 font-semibold text-xs sm:text-sm break-words">{blackLabel}</span>
      </motion.div>
    </div>
  )
}
