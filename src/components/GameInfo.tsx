'use client'

import { Team } from '@/features/game-engine/gameState'
import { GameStatus } from '@/features/shared/gameTypes'
import { ConnectionStatus } from './GameLoading'

interface GameInfoProps {
  roomCode?: string
  status: GameStatus
  currentTurn: Team
  isOnline?: boolean
  connectionStatus?: 'connecting' | 'connected' | 'disconnected' | 'error'
  onRetryConnection?: () => void
}

export function GameInfo({ 
  roomCode, 
  status, 
  currentTurn, 
  isOnline, 
  connectionStatus,
  onRetryConnection 
}: GameInfoProps) {
  const isGameOver = status === GameStatus.GAME_OVER
  const isPlaying = status === GameStatus.PLAYING

  return (
    <div className="space-y-3">
      {/* Room code sharing */}
      {roomCode && (
        <div className="rounded-[22px] border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80">
          <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Share room code with teammate</p>
          <p className="text-center font-mono text-2xl font-bold tracking-[0.25em] text-amber-600 dark:text-amber-400">
            {roomCode}
          </p>
        </div>
      )}

      {/* Connection status for online mode */}
      {isOnline && connectionStatus && (
        <div className="flex justify-center">
          <ConnectionStatus 
            status={connectionStatus} 
            onRetry={onRetryConnection}
          />
        </div>
      )}

      {/* Game status */}
      {isPlaying && (
        <div className="flex items-center justify-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 shadow-sm">
            <div className={`h-3 w-3 rounded-full border-2 ${currentTurn === Team.WHITE ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900 dark:border-slate-700 dark:bg-slate-100'}`} />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {currentTurn === Team.WHITE ? "White's Turn" : "Black's Turn"}
            </span>
          </div>
        </div>
      )}

      {/* Game over message */}
      {isGameOver && (
        <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">Game Over!</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Refresh or create a new game to play again
          </p>
        </div>
      )}
    </div>
  )
}