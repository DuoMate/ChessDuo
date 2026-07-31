'use client'

import { motion } from 'framer-motion'

interface MatchTimerProps {
  seconds: number
  isActive: boolean
  totalSeconds: number
}

export function MatchTimer({ seconds, isActive, totalSeconds }: MatchTimerProps) {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const display = `${minutes}:${secs.toString().padStart(2, '0')}`
  const isWarning = isActive && seconds <= 60
  const isCritical = isActive && seconds <= 10

  const circumference = 2 * Math.PI * 34
  const progress = (seconds / totalSeconds) * circumference

  return (
    <div className="flex items-center justify-center">
      <motion.div
        className="relative w-11 h-11 md:w-[52px] md:h-[52px] lg:w-14 lg:h-14"
        animate={isCritical ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.8, repeat: isCritical ? Infinity : 0 }}
      >
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle
            cx="40" cy="40" r="34"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-slate-200 opacity-40 dark:text-slate-700"
          />
          <motion.circle
            cx="40" cy="40" r="34"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            strokeLinecap="round"
            className={isCritical ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-amber-600'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={`text-[11px] md:text-xs font-bold font-game ${
              !isActive ? 'text-slate-400 dark:text-slate-500' :
              isCritical ? 'text-rose-500' :
              isWarning ? 'text-amber-500' :
              'text-amber-600'
            }`}
            animate={isCritical ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
            transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
          >
            {display}
          </motion.span>
        </div>
      </motion.div>
    </div>
  )
}
