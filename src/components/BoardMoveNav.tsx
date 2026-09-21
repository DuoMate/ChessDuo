'use client'

import { memo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BoardMoveNavProps {
  /** 1-based current move index for display only. */
  current: number
  total: number
  onBack: () => void
  onForward: () => void
  className?: string
}

/**
 * BOARD FIRST — compact move-history navigation shown immediately below the
 * board, replacing Back/Fwd inside the bottom action pill so secondary
 * navigation never competes with the board. Uses the SAME handlers the bottom
 * nav used; owns no playback/game state (display-only index). Touch targets
 * stay ≥44px.
 */
function BoardMoveNavInner({ current, total, onBack, onForward, className = '' }: BoardMoveNavProps) {
  if (total <= 0) return null
  const atStart = current <= 1
  const atEnd = current >= total
  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={onBack}
        disabled={atStart}
        aria-label="Previous move"
        className="focus-ring flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:text-white"
      >
        <ChevronLeft size={20} strokeWidth={2.5} />
      </button>
      <span className="min-w-[64px] text-center text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
        {current} / {total}
      </span>
      <button
        type="button"
        onClick={onForward}
        disabled={atEnd}
        aria-label="Next move"
        className="focus-ring flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:text-white"
      >
        <ChevronRight size={20} strokeWidth={2.5} />
      </button>
    </div>
  )
}

export const BoardMoveNav = memo(BoardMoveNavInner)
