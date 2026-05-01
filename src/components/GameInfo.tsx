'use client'

import { Team } from '@/features/game-engine/gameState'
import { GameStatus } from '@/features/offline/game/localGame'
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
        <div className="p-3 bg-gray-800/80 rounded-lg border border-gray-700">
          <p className="text-gray-400 text-xs text-center mb-1">Share room code with teammate</p>
          <p className="text-2xl font-bold text-yellow-400 tracking-widest font-mono text-center">
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
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${currentTurn === Team.WHITE ? 'bg-white' : 'bg-black'} border-2 border-gray-500`} />
            <span className="text-sm font-medium text-gray-300">
              {currentTurn === Team.WHITE ? "White's Turn" : "Black's Turn"}
            </span>
          </div>
        </div>
      )}

      {/* Game over message */}
      {isGameOver && (
        <div className="text-center p-4 bg-yellow-900/30 rounded-lg border border-yellow-500/50">
          <p className="text-xl font-bold text-yellow-400">Game Over!</p>
          <p className="text-gray-400 text-sm mt-1">
            Refresh or create a new game to play again
          </p>
        </div>
      )}
    </div>
  )
}