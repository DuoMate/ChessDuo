'use client'

import { useEffect, useRef } from 'react'
import { Timeline } from 'animejs'
import { Team } from '@/features/game-engine/gameState'
import { Crown, Copy, Loader2, CheckCircle2, XCircle, AlertTriangle, Share2 } from 'lucide-react'
import { shareLink } from '@/lib/share'

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
    <div className="flex min-h-[min(600px,85vh)] flex-col items-center justify-center rounded-[32px] border border-white/70 bg-white/80 p-6 sm:p-8 shadow-[0_24px_90px_rgba(2,6,23,0.14)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/80">
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
      <p className="text-lg text-slate-600 dark:text-slate-300">{message}</p>
      {roomCode && (
        <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-5 py-3 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Room code</p>
          <p className="select-all font-mono text-xl font-bold tracking-[0.25em] text-amber-600 dark:text-amber-400">{roomCode}</p>
          <button
            onClick={() => navigator.clipboard.writeText(roomCode)}
            className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-xs text-slate-500 transition-colors hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
          >
            <Copy size={12} /> Copy code
          </button>
        </div>
      )}
      {inviteUrl && (
        <div className="mt-3 rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-5 py-3 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Invite your friend</p>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => {
                if (!inviteUrl || !roomCode) return
                shareLink({
                  title: 'ChessDuo — Join my game!',
                  text: `Join my ChessDuo game! Room code: ${roomCode}`,
                  url: inviteUrl,
                })
              }}
              className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-amber-500/10 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
            >
              <Share2 size={14} /> Share link
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white"
              title="Copy link to clipboard"
            >
              <Copy size={14} />
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">Room code: <span className="font-mono text-amber-700 dark:text-amber-400">{roomCode}</span></p>
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
