'use client'

import { useState, useEffect, useRef, memo } from 'react'

interface IsolatedMatchTimerProps {
  getTimeRemaining: () => number
  isActive: boolean
  totalSeconds?: number
}

/**
 * Isolated timer — owns its own `setInterval` and `useState` so the
 * 1 Hz tick does NOT call `setGameState` on the parent `Game.tsx`.
 * Only this component rerenders each second; siblings (ChessBoard,
 * PendingMovesRow, MoveResolvedInline, Chat, Insights) stay memoized.
 *
 * `isActive` gates the interval (game not yet started or already over).
 * `getTimeRemaining` reads the authoritative engine value via ref so we
 * never capture a stale closure. The parent still owns timeout logic
 * (via `onTimeout` or engine's own coordinator interval) — this component
 * only displays the countdown.
 */
function IsolatedMatchTimerInner({ getTimeRemaining, isActive }: IsolatedMatchTimerProps) {
  const [remaining, setRemaining] = useState(() => {
    try {
      return getTimeRemaining()
    } catch {
      return 0
    }
  })
  const getTimeRef = useRef(getTimeRemaining)
  useEffect(() => {
    getTimeRef.current = getTimeRemaining
  }, [getTimeRemaining])

  useEffect(() => {
    // Sync immediately when active toggles or time jumps (resolution, sync)
    try {
      setRemaining(getTimeRef.current())
    } catch {
      // engine not ready yet
    }
    if (!isActive) return
    const id = setInterval(() => {
      try {
        setRemaining(getTimeRef.current())
      } catch {
        // ignore — engine may be mid-reset
      }
    }, 1000)
    return () => clearInterval(id)
  }, [isActive, getTimeRemaining])

  // Also sync on visibility change so a tab-backgrounded timer snaps back
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        try {
          setRemaining(getTimeRef.current())
        } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const mins = Math.floor(remaining / 60)
  const secs = (remaining % 60).toString().padStart(2, '0')

  return (
    <div className="flex flex-col items-center justify-center px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 min-w-[60px]">
      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
        <span className="font-game text-sm font-bold" aria-live="off">
          {mins}:{secs}
        </span>
      </div>
    </div>
  )
}

export const IsolatedMatchTimer = memo(IsolatedMatchTimerInner)
