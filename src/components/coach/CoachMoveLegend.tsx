'use client'

import { memo } from 'react'
import { COACH_MOVE_RANKS } from './coachMoveRanks'
import { CoachMoveRankBadge } from './CoachMoveRankBadge'

/** Compact inline legend — visible only while the 3-move visualization is active. */
function CoachMoveLegendInner() {
  return (
    <div
      aria-label="Best move legend"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700/40 dark:bg-slate-800/40"
    >
      {COACH_MOVE_RANKS.map((meta) => (
        <span
          key={meta.rank}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
        >
          <CoachMoveRankBadge rank={meta.rank} size="sm" />
          {meta.rank === 1 ? 'Best' : meta.label}
        </span>
      ))}
    </div>
  )
}

export const CoachMoveLegend = memo(CoachMoveLegendInner)
