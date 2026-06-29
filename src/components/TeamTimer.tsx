'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Team } from '@/features/game-engine/gameState'

interface TeamTimerProps {
  seconds: number
  isActive: boolean
  currentTeam: Team
  onExpire?: () => void
}

export function TeamTimer({ seconds, isActive, currentTeam }: TeamTimerProps) {
  const isWarning = isActive && seconds <= 3
  const isCritical = isActive && seconds <= 2
  const teamColor = currentTeam === Team.WHITE ? 'yellow' : 'red'
  const activeColorClass = teamColor === 'yellow' ? 'text-amber-500' : 'text-rose-500'
  const inactiveColorClass = teamColor === 'yellow' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-400 dark:text-slate-500'
  const inactiveBorderClass = teamColor === 'yellow' ? 'border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700'

  const circumference = 2 * Math.PI * 18
  const progress = (seconds / 10) * circumference
  const displayProgress = isActive ? progress : 0

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0.9 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative flex items-center justify-center"
    >
      <svg width="48" height="48" className="transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className={isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-200 dark:text-slate-700'}
        />
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - displayProgress}
          strokeLinecap="round"
          className={isActive ? activeColorClass : inactiveColorClass}
        />
      </svg>
      
      <motion.div
        className={`
          absolute inset-0 flex items-center justify-center
          text-xs font-bold
          ${isActive ? (isWarning ? 'text-rose-500' : activeColorClass) : inactiveColorClass}
        `}
        animate={isActive && isCritical ? {
          scale: [1, 1.15, 1],
        } : {}}
        transition={{
          duration: 0.5,
          repeat: isCritical ? Infinity : 0,
          repeatType: "loop"
        }}
      >
        {isActive ? `${seconds}s` : '--'}
      </motion.div>

      {isActive && (
        <motion.div
          className={`
            absolute -inset-1 rounded-full
            ${isWarning ? 'border-2 border-rose-500' : 'border border-amber-500'}
          `}
          animate={{
            opacity: isWarning ? [0.5, 1, 0.5] : 0.5,
          }}
          transition={{
            duration: 0.5,
            repeat: isWarning ? Infinity : 0,
          }}
        />
      )}
      
      {!isActive && (
        <div className={`absolute -inset-1 rounded-full border ${inactiveBorderClass}`} />
      )}
    </motion.div>
  )
}