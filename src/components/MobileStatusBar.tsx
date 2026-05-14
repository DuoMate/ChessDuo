'use client'

import { Team } from '@/features/game-engine/gameState'
import { motion } from 'framer-motion'

interface MobileStatusBarProps {
  currentTurn: Team
  timerSeconds: number
  timerActive: boolean
  whiteCaptured: string[]
  blackCaptured: string[]
}

export function MobileStatusBar({ 
  currentTurn, 
  timerSeconds, 
  timerActive,
  whiteCaptured,
  blackCaptured 
}: MobileStatusBarProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatCaptured = (pieces: string[]): string => {
    if (!pieces || pieces.length === 0) return 'None'
    // Count pieces and show as icons + count
    const counts: Record<string, number> = {}
    for (const piece of pieces) {
      counts[piece] = (counts[piece] || 0) + 1
    }
    const icons = Object.keys(counts).slice(0, 4) // Max 4 icons
    const total = pieces.length
    return icons.join('') + (total > 4 ? ` +${total - 4}` : '')
  }

  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-40 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700"
    >
      <div className="flex items-center justify-between px-4 py-2">
        {/* White Team */}
        <div className={`flex flex-col items-start ${currentTurn === Team.WHITE ? 'bg-white/20 rounded-lg px-3 py-1' : ''}`}>
          <span className="text-white font-semibold text-sm">White</span>
          <span className="text-gray-400 text-xs">
            {formatCaptured(whiteCaptured)}
          </span>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 ${timerActive ? 'text-yellow-400' : 'text-gray-500'}`}>
          <motion.span
            animate={timerActive ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-lg font-mono font-bold"
          >
            ⏱️ {formatTime(timerSeconds)}
          </motion.span>
        </div>

        {/* Black Team */}
        <div className={`flex flex-col items-end ${currentTurn === Team.BLACK ? 'bg-white/20 rounded-lg px-3 py-1' : ''}`}>
          <span className="text-gray-300 font-semibold text-sm">Black</span>
          <span className="text-gray-400 text-xs">
            {formatCaptured(blackCaptured)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}