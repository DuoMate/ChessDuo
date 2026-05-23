'use client'

import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'

interface TeamIndicatorProps {
  whiteLabel: string
  blackLabel: string
  activeTeam: 'WHITE' | 'BLACK'
  isGameOver: boolean
  isBotThinking: boolean
}

function KnightWhite() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 4.5C7 3 8.5 2 10 1.5C10.5 2 11 3 11 4V5L9 8V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 7H13.5C14.5 7 15 7.5 15 8.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 14L6.5 17C5.5 18.5 6 20 7.5 20.5C9 21 9.5 20 10 19L11 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 14L14 17C15 18.5 14.5 20 13 20.5C11.5 21 11 20 10 19L10 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9" cy="12" r="1" fill="currentColor"/>
    </svg>
  )
}

function KnightBlack() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 4.5C7 3 8.5 2 10 1.5C10.5 2 11 3 11 4V5L9 8V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 7H13.5C14.5 7 15 7.5 15 8.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 14L6.5 17C5.5 18.5 6 20 7.5 20.5C9 21 9.5 20 10 19L11 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 14L14 17C15 18.5 14.5 20 13 20.5C11.5 21 11 20 10 19L10 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9" cy="12" r="1" fill="currentColor"/>
    </svg>
  )
}

export function TeamIndicator({
  whiteLabel,
  blackLabel,
  activeTeam,
  isGameOver,
  isBotThinking,
}: TeamIndicatorProps) {
  const whiteActive = activeTeam === 'WHITE' && !isGameOver

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
        <KnightWhite />
        <span className="text-white font-semibold text-xs sm:text-sm truncate">{whiteLabel}</span>
      </motion.div>

      <div className="flex flex-col items-center">
        <Swords size={16} className="text-amber-400/60" />
        <span className="text-[9px] text-gray-600 font-semibold uppercase tracking-wider mt-0.5">VS</span>
      </div>

      <motion.div
        animate={{
          scale: activeTeam === 'BLACK' && !isGameOver ? 1.02 : 1,
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border min-w-0 ${
          activeTeam === 'BLACK' && !isGameOver
            ? 'bg-gradient-to-r from-gray-700 to-gray-600/50 border-gray-400/40'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <KnightBlack />
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
