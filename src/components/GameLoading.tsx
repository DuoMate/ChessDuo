'use client'

import { useEffect, useRef } from 'react'
import { Timeline } from 'animejs'
import { Team } from '@/features/game-engine/gameState'

interface GameLoadingProps {
  message?: string
  showChessIcon?: boolean
  roomCode?: string
}

export function GameLoading({ 
  message = 'Loading game...', 
  showChessIcon = true,
  roomCode,
}: GameLoadingProps) {
  const iconRef = useRef<HTMLSpanElement>(null)
  const dot1Ref = useRef<HTMLDivElement>(null)
  const dot2Ref = useRef<HTMLDivElement>(null)
  const dot3Ref = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<Timeline | null>(null)

  useEffect(() => {
    const tl = new Timeline({ loop: true, autoplay: true })
    timelineRef.current = tl

    tl.add(iconRef.current!, { scale: [1, 1.08, 1], duration: 2000, easing: 'spring(1, 80, 10, 0)' }, 0)
    tl.add(dot1Ref.current!, { translateY: [0, -8, 0], opacity: [0.5, 1, 0.5], duration: 600 }, 0)
    tl.add(dot2Ref.current!, { translateY: [0, -8, 0], opacity: [0.5, 1, 0.5], duration: 600 }, 150)
    tl.add(dot3Ref.current!, { translateY: [0, -8, 0], opacity: [0.5, 1, 0.5], duration: 600 }, 300)

    return () => {
      tl.pause()
      tl.seek(0)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
      {showChessIcon && (
        <div className="relative mb-8">
          <span
            ref={iconRef}
            className="text-8xl filter drop-shadow-lg inline-block"
          >
            &#9823;&#65039;
          </span>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-yellow-500 rounded-full" />
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div ref={dot1Ref} className="w-3 h-3 bg-yellow-500 rounded-full" />
        <div ref={dot2Ref} className="w-3 h-3 bg-yellow-500 rounded-full" />
        <div ref={dot3Ref} className="w-3 h-3 bg-yellow-500 rounded-full" />
      </div>
      <p className="text-gray-400 text-lg">{message}</p>
      {roomCode && (
        <div className="mt-6 px-5 py-3 bg-gray-800/60 rounded-xl border border-gray-700/50 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Room code</p>
          <p className="text-xl font-mono font-bold text-yellow-400 tracking-widest select-all">{roomCode}</p>
          <button
            onClick={() => navigator.clipboard.writeText(roomCode)}
            className="mt-2 text-xs text-gray-500 hover:text-yellow-400 transition-colors"
          >
            &#x1F4CB; Copy code
          </button>
        </div>
      )}
    </div>
  )
}

interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  onRetry?: () => void
}

export function ConnectionStatus({ status, onRetry }: ConnectionStatusProps) {
  const statusConfig = {
    connecting: { color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: '\u23F3', message: 'Connecting...' },
    connected: { color: 'text-green-400', bg: 'bg-green-900/30', icon: '\u2713', message: 'Connected' },
    disconnected: { color: 'text-red-400', bg: 'bg-red-900/30', icon: '\u2715', message: 'Disconnected' },
    error: { color: 'text-red-400', bg: 'bg-red-900/30', icon: '\u26A0\uFE0F', message: 'Connection Error' },
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
