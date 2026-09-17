'use client'

import { Crown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, memo } from 'react'
import { getAvatarUrl, type HumanAvatar } from '@/features/shared/avatars'
import { Team } from '@/features/game-engine/gameState'
import { InitialsAvatar } from './InitialsAvatar'

export interface BoardTopBarPlayer {
  id: string
  label: string
  type: 'human' | 'bot'
  avatar?: HumanAvatar
  profileImageUrl?: string | null
  isYou?: boolean
  isHost?: boolean
  online?: boolean
  submitted?: boolean
  disconnectedSinceMs?: number
}

interface BoardTopBarProps {
  whitePlayers: BoardTopBarPlayer[]
  blackPlayers: BoardTopBarPlayer[]
  matchTimeRemaining: number
  matchTimerActive: boolean
  totalMatchSeconds: number
  roundLabel?: string
  currentTurn: Team
  capturedWhite?: string[]
  capturedBlack?: string[]
  /** When provided, renders this node instead of the static timer — used for isolated 1 Hz timer that doesn't rerender the parent */
  timerNode?: React.ReactNode
  /**
   * In-flow thinking hint rendered below the turn pill (never over the board).
   * Boolean keeps the memo stable. Callers that omit it see no change.
   */
  isThinking?: boolean
}

const PIECE_VALUES: Record<string, number> = {
  q: 9, r: 5, b: 3, n: 3, p: 1
}

const PIECE_UNICODE: Record<string, string> = {
  q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
  Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙'
}

function computeMaterial(pieces: string[]): number {
  return pieces.reduce((sum, p) => sum + (PIECE_VALUES[p] || 0), 0)
}

function sortPieces(pieces: string[]): string[] {
  const order = ['q', 'r', 'b', 'n', 'p']
  return [...pieces].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

const AvatarTile = memo(function AvatarTile({ player, team }: { player: BoardTopBarPlayer; team: 'WHITE' | 'BLACK' }) {
  const isWhite = team === 'WHITE'
  const ringClass = isWhite
    ? 'ring-[var(--color-team-a)]'
    : 'ring-[var(--color-team-b)]'
  const dotClass = isWhite
    ? 'bg-[var(--color-team-a)]'
    : 'bg-[var(--color-team-b)]'
  const checkClass = 'bg-emerald-500 text-white'

  const GRACE_PERIOD = 5000
  const FORFEIT_TIME = 35000
  const disconnected = (player.disconnectedSinceMs ?? 0) > GRACE_PERIOD ? (player.disconnectedSinceMs ?? 0) : 0

  const [countdown, setCountdown] = useState(0)
  useEffect(() => {
    if (!disconnected) { setCountdown(0); return }
    const tick = () => {
      const elapsed = Date.now() - disconnected
      const remaining = Math.max(0, Math.round((FORFEIT_TIME - elapsed) / 1000))
      setCountdown(remaining)
    }
    tick()
    // Use rAF-friendly 1s interval only when actually disconnected — avoids
    // per-avatar intervals during normal play (perf: no intervals when connected)
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [disconnected])

  const showCountdown = disconnected > 0
  const dimmedClass = showCountdown ? 'opacity-60' : ''
  const countdownText = String(Math.floor(countdown / 60)) + ':' + String(countdown % 60).padStart(2, '0')

  if (player.type === 'bot') {
    const imageSrc = getAvatarUrl(player.type, player.avatar)
    return (
      <div className="flex flex-col items-center gap-0.5 min-w-0">
        <div className={`relative w-10 h-10 rounded-xl overflow-hidden ring-2 ${ringClass} bg-gray-100 dark:bg-slate-800/40`}>
          <img
            src={imageSrc}
            alt={player.label}
            className="w-full h-full object-contain p-0.5"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {player.submitted && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${checkClass} flex items-center justify-center ring-2 ring-white dark:ring-slate-900`}>
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          {player.online !== false && !player.submitted && (
            <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${dotClass} ring-2 ring-white dark:ring-slate-900`} />
          )}
        </div>
        <span className={`text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[100px] ${dimmedClass}`}>
          {showCountdown ? countdownText : player.label}
        </span>
    </div>
  )
  }

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <div className={`relative ${dimmedClass}`}>
        <InitialsAvatar
          username={player.label}
          size="md"
          src={player.profileImageUrl || null}
          online={player.online}
          ringClass={ringClass}
        />
        {player.submitted && (
          <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${checkClass} flex items-center justify-center ring-2 ring-white dark:ring-slate-900`}>
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <span className={`text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[100px] ${dimmedClass}`}>
        {showCountdown ? countdownText : player.label}
      </span>
    </div>
  )
})

function BoardTopBarInner({
  whitePlayers,
  blackPlayers,
  capturedWhite = [],
  capturedBlack = [],
  matchTimeRemaining,
  matchTimerActive,
  totalMatchSeconds,
  roundLabel,
  currentTurn,
  timerNode,
  isThinking = false,
}: BoardTopBarProps) {
  const whiteMaterial = useMemo(() => computeMaterial(capturedWhite), [capturedWhite])
  const blackMaterial = useMemo(() => computeMaterial(capturedBlack), [capturedBlack])
  const advantage = whiteMaterial - blackMaterial
  const sortedWhite = useMemo(() => sortPieces(capturedWhite), [capturedWhite])
  const sortedBlack = useMemo(() => sortPieces(capturedBlack), [capturedBlack])
  const hasCaptures = sortedWhite.length > 0 || sortedBlack.length > 0

  return (
    <>
      <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
        {/* White team */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1">
            <Crown size={11} className="text-slate-700 dark:text-slate-200 shrink-0" />
            <span className="text-xs font-bold tracking-widest text-slate-700 dark:text-slate-200 uppercase">
              White
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {whitePlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="WHITE" />
            ))}
          </div>
        </div>

        {/* Center: timer — isolated when timerNode provided (1 Hz self-tick, parent doesn't rerender) */}
        <div className="flex items-center gap-1 shrink-0">
          {timerNode ?? (
            <div className="flex flex-col items-center justify-center px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 min-w-[60px]">
              <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
                <span className="font-game text-sm font-bold">
                  {Math.floor(matchTimeRemaining / 60)}:{(matchTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Black team */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold tracking-widest text-slate-700 dark:text-slate-200 uppercase">
              Black
            </span>
            <Crown size={11} className="text-slate-700 dark:text-slate-200 shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {blackPlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="BLACK" />
            ))}
          </div>
        </div>
      </div>

      {hasCaptures && (
        <div className="flex items-center justify-between gap-1 max-w-3xl mx-auto mt-1">
          <div className="flex items-center gap-1 min-w-0 flex-1 justify-start">
            <div className="flex min-w-0 items-center gap-0 flex-wrap overflow-hidden">
              {sortedWhite.map((p, i) => (
                <span key={i} className="text-[11px] leading-none text-slate-500 dark:text-slate-400">
                  {PIECE_UNICODE[p] || p}
                </span>
              ))}
            </div>
            {advantage > 0 && (
              <span className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400 ml-0.5">
                +{advantage}
              </span>
            )}
          </div>
          <div className="shrink-0" />
          <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
            {advantage < 0 && (
              <span className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400 mr-0.5">
                +{Math.abs(advantage)}
              </span>
            )}
            <div className="flex min-w-0 items-center gap-0 flex-wrap justify-end overflow-hidden">
              {sortedBlack.map((p, i) => (
                <span key={i} className="text-[11px] leading-none text-slate-500 dark:text-slate-400">
                  {PIECE_UNICODE[p] || p}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {currentTurn && (
          <motion.div
            key={currentTurn}
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex items-center justify-center mt-1 will-change-transform"
            style={{ willChange: 'transform, opacity' }}
          >
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${currentTurn === Team.WHITE ? 'border-[var(--color-team-a-border)] bg-[var(--color-team-a-soft)]' : 'border-[var(--color-team-b-border)] bg-[var(--color-team-b-soft)]'}`}>
              <span className={`text-sm leading-none ${currentTurn === Team.WHITE ? 'text-[var(--color-team-a)]' : 'text-[var(--color-team-b)]'}`}>
                {currentTurn === Team.WHITE ? '♔' : '♚'}
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider ${currentTurn === Team.WHITE ? 'text-[var(--color-team-a)]' : 'text-[var(--color-team-b)]'}`}>
                {currentTurn === Team.WHITE ? 'White' : 'Black'} to move
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-flow thinking hint below the turn pill — never overlaps the board.
          Reserved min-height avoids layout shift when it appears/disappears. */}
      <div className="flex items-center justify-center mt-1.5 min-h-[28px] px-3">
        <AnimatePresence mode="wait">
          {isThinking && (
            <motion.div
              key="thinking"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm bg-[var(--color-surface)] dark:bg-[var(--color-muted-bg)] text-slate-600 dark:text-slate-300 border-[var(--color-border)] will-change-transform"
              style={{ willChange: 'transform, opacity' }}
            >
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse shrink-0" />
              <span className="truncate max-w-[min(90vw,480px)]">Opponent is thinking…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

export const BoardTopBar = memo(BoardTopBarInner, (prev, next) => {
  return (
    prev.matchTimeRemaining === next.matchTimeRemaining &&
    prev.matchTimerActive === next.matchTimerActive &&
    prev.totalMatchSeconds === next.totalMatchSeconds &&
    prev.roundLabel === next.roundLabel &&
    prev.currentTurn === next.currentTurn &&
    prev.capturedWhite === next.capturedWhite &&
    prev.capturedBlack === next.capturedBlack &&
    prev.whitePlayers === next.whitePlayers &&
    prev.blackPlayers === next.blackPlayers &&
    prev.timerNode === next.timerNode &&
    prev.isThinking === next.isThinking
  )
})
