'use client'

import { Team } from '@/features/game-engine/gameState'

interface GameLoadingProps {
  message?: string
  showChessIcon?: boolean
}

export function GameLoading({ 
  message = 'Loading game...', 
  showChessIcon = true 
}: GameLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
      {showChessIcon && (
        <div className="relative mb-8">
          <span className="text-8xl filter drop-shadow-lg animate-pulse">♟️</span>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-yellow-500 rounded-full animate-pulse" />
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="text-gray-400 text-lg">{message}</p>
    </div>
  )
}

interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  onRetry?: () => void
}

export function ConnectionStatus({ status, onRetry }: ConnectionStatusProps) {
  const statusConfig = {
    connecting: { color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: '⏳', message: 'Connecting...' },
    connected: { color: 'text-green-400', bg: 'bg-green-900/30', icon: '✓', message: 'Connected' },
    disconnected: { color: 'text-red-400', bg: 'bg-red-900/30', icon: '✕', message: 'Disconnected' },
    error: { color: 'text-red-400', bg: 'bg-red-900/30', icon: '⚠️', message: 'Connection Error' },
  }

  const config = statusConfig[status]

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} border border-gray-700`}>
      <span className={config.color}>{config.icon}</span>
      <span className={`text-sm ${config.color}`}>{config.message}</span>
      {status === 'disconnected' && onRetry && (
        <button 
          onClick={onRetry}
          className="ml-2 text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function TeamTurnIndicator({ currentTurn }: { currentTurn: Team }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${currentTurn === Team.WHITE ? 'bg-white' : 'bg-black'} border-2 border-gray-500`} />
      <span className="text-sm font-medium text-gray-300">
        {currentTurn === Team.WHITE ? "White's Turn" : "Black's Turn"}
      </span>
    </div>
  )
}