'use client'

import { motion } from 'framer-motion'
import { Team } from '@/features/game-engine/gameState'
import { GameStatus } from '@/features/offline/game/localGame'

interface TopBarProps {
  currentTurn: Team
  timerSeconds: number
  timerActive: boolean
  isMyTurn: boolean
  phase: string
  status: GameStatus
}

export function TopBar({ currentTurn, timerSeconds, timerActive, isMyTurn, status }: TopBarProps) {
  const isWarning = timerSeconds <= 3
  const isCritical = timerSeconds <= 2
  const circumference = 2 * Math.PI * 24
  const progress = (timerSeconds / 10) * circumference

  const turnLabel = status === GameStatus.GAME_OVER
    ? 'GAME OVER'
    : isMyTurn
      ? 'YOUR TURN'
      : 'WAITING...'

  return (
    <header className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 h-16 flex items-center justify-between px-4 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold italic uppercase tracking-tighter text-yellow-400">ClashMate</span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team White</p>
          <p className={`text-base font-bold ${currentTurn === Team.WHITE && status === GameStatus.PLAYING ? 'text-yellow-400' : 'text-gray-500'}`}>
            {turnLabel}
          </p>
        </div>

        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" fill="transparent" r="24" stroke="rgb(55 65 81)" strokeWidth="4" />
            {timerActive && (
              <motion.circle
                cx="28" cy="28" fill="transparent" r="24"
                stroke={isWarning ? 'rgb(239 68 68)' : 'rgb(234 179 8)'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                style={{ filter: isWarning ? 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' : 'drop-shadow(0 0 6px rgba(234,179,8,0.4))' }}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - progress }}
                transition={{ duration: 0.3 }}
              />
            )}
          </svg>
          <motion.span
            className={`text-base font-bold ${isWarning ? 'text-red-400' : 'text-yellow-400'}`}
            animate={isCritical ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
          >
            {String(timerSeconds).padStart(2, '0')}
          </motion.span>
        </div>

        <div className="text-left">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team Black</p>
          <p className={`text-base font-bold ${currentTurn === Team.BLACK && status === GameStatus.PLAYING ? 'text-white' : 'text-gray-500'}`}>
            {currentTurn === Team.BLACK && status === GameStatus.PLAYING ? 'PLAYING...' : 'WAITING'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-700/50">
          <span className="material-symbols-outlined">leaderboard</span>
        </button>
        <button className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-700/50">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="w-9 h-9 rounded-full border border-yellow-500/30 overflow-hidden bg-gray-700 flex items-center justify-center">
          <span className="material-symbols-outlined text-yellow-400 text-sm">person</span>
        </div>
      </div>
    </header>
  )
}
