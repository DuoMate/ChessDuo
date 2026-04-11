'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Team } from '@/lib/gameState'

interface TeamTimerProps {
  seconds: number
  isActive: boolean
  currentTeam: Team
  onExpire?: () => void
}

export function TeamTimer({ seconds, isActive, currentTeam }: TeamTimerProps) {
  const isWarning = seconds <= 3
  const isCritical = seconds <= 2

  const circumference = 2 * Math.PI * 18
  const progress = (seconds / 10) * circumference

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
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
              className="text-gray-600"
            />
            <motion.circle
              cx="24"
              cy="24"
              r="18"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className={currentTeam === Team.WHITE ? 'text-yellow-400' : 'text-red-500'}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - progress }}
              transition={{ duration: 0.3 }}
            />
          </svg>
          
          <motion.div
            className={`
              absolute inset-0 flex items-center justify-center
              text-xs font-bold
              ${isWarning ? 'text-red-400' : 'text-yellow-400'}
            `}
            animate={{
              scale: isCritical ? [1, 1.15, 1] : 1,
            }}
            transition={{
              duration: 0.5,
              repeat: isCritical ? Infinity : 0,
              repeatType: "loop"
            }}
          >
            {seconds}s
          </motion.div>

          <motion.div
            className={`
              absolute -inset-1 rounded-full
              ${isWarning ? 'border-2 border-red-500' : 'border border-yellow-600'}
            `}
            animate={{
              opacity: isWarning ? [0.5, 1, 0.5] : 0.5,
            }}
            transition={{
              duration: 0.5,
              repeat: isWarning ? Infinity : 0,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}