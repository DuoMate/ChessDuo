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

  const circumference = 2 * Math.PI * 44
  const progress = isActive ? (seconds / totalSeconds) * circumference : 0

  return (
    <div className="flex items-center justify-center gap-3">
      <motion.div
        className="relative"
        animate={isCritical ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.8, repeat: isCritical ? Infinity : 0 }}
      >
        <svg width="104" height="104" className="transform -rotate-90">
          <circle
            cx="52" cy="52" r="44"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-gray-700 opacity-40"
          />
          <circle
            cx="52" cy="52" r="44"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className={isCritical ? 'text-red-500' : isWarning ? 'text-yellow-400' : 'text-yellow-500'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={`text-xl font-bold font-mono ${
              !isActive ? 'text-gray-500' :
              isCritical ? 'text-red-400' :
              isWarning ? 'text-yellow-400' :
              'text-yellow-300'
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
