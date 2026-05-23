'use client'

import { useEffect, useRef } from 'react'
import { Timeline } from 'animejs'
import { Team } from '@/features/game-engine/gameState'
import { Crown, Copy, Loader2, CheckCircle2, XCircle, AlertTriangle, Link } from 'lucide-react'

interface GameLoadingProps {
  message?: string
  showChessIcon?: boolean
  roomCode?: string
  inviteUrl?: string
}

export function GameLoading({
  message = 'Loading game...',
  showChessIcon = true,
  roomCode,
  inviteUrl,
}: GameLoadingProps) {
  const iconRef = useRef<HTMLDivElement>(null)
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
          <div ref={iconRef} className="inline-block">
            <Crown size={80} className="text-amber-400 drop-shadow-lg" strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-amber-500 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.4)]" />
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div ref={dot1Ref} className="w-3 h-3 bg-amber-500 rounded-full" />
        <div ref={dot2Ref} className="w-3 h-3 bg-amber-500 rounded-full" />
        <div ref={dot3Ref} className="w-3 h-3 bg-amber-500 rounded-full" />
      </div>
      <p className="text-gray-400 text-lg">{message}</p>
      {roomCode && (
        <div className="mt-6 px-5 py-3 bg-game-surface/60 rounded-xl border border-white/10 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Room code</p>
          <p className="text-xl font-mono font-bold text-amber-400 tracking-widest select-all">{roomCode}</p>
          <button
            onClick={() => navigator.clipboard.writeText(roomCode)}
            className="mt-2 text-xs text-gray-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1 min-h-[44px]"
          >
            <Copy size={12} /> Copy code
          </button>
        </div>
      )}
      {inviteUrl && (
        <div className="mt-3 px-5 py-3 bg-game-surface/60 rounded-xl border border-white/10 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Invite link</p>
          <p className="text-xs font-mono text-gray-300 break-all select-all mb-2">{inviteUrl}</p>
          <button
            onClick={() => navigator.clipboard.writeText(inviteUrl)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1 min-h-[44px]"
          >
            <Link size={12} /> Copy invite link
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
    connecting: { color: 'text-amber-400', bg: 'bg-amber-500/15', Icon: Loader2, iconAnim: 'animate-spin', message: 'Connecting...' },
    connected: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', Icon: CheckCircle2, iconAnim: '', message: 'Connected' },
    disconnected: { color: 'text-rose-400', bg: 'bg-rose-500/15', Icon: XCircle, iconAnim: '', message: 'Disconnected' },
    error: { color: 'text-rose-400', bg: 'bg-rose-500/15', Icon: AlertTriangle, iconAnim: '', message: 'Connection Error' },
  }

  const config = statusConfig[status]

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} border border-white/10`}>
      <config.Icon size={14} className={`${config.color} ${config.iconAnim}`} />
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
      <div className={`w-3 h-3 rounded-full border-2 border-white/20 shadow-[0_0_6px_rgba(255,255,255,0.3)] ${currentTurn === Team.WHITE ? 'bg-white' : 'bg-gray-800'}`} />
      <span className="text-sm font-medium text-gray-300 font-game">
        {currentTurn === Team.WHITE ? "White's Turn" : "Black's Turn"}
      </span>
    </div>
  )
}
