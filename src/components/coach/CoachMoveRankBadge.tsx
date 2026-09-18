'use client'

import { memo } from 'react'
import { getCoachRank, type CoachMoveRank } from './coachMoveRanks'

const RANK_BADGE_CLASSES: Record<CoachMoveRank, string> = {
  1: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  2: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  3: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
}

interface CoachMoveRankBadgeProps {
  rank: CoachMoveRank
  size?: 'sm' | 'md'
}

/** Numbered rank badge — number + color + text label via aria, never color-only. */
function CoachMoveRankBadgeInner({ rank, size = 'md' }: CoachMoveRankBadgeProps) {
  const meta = getCoachRank(rank - 1)
  const dims = size === 'sm' ? 'h-4 w-4 text-[11px]' : 'h-5 w-5 text-[11px]'
  return (
    <span
      aria-hidden="true"
      className={`flex ${dims} shrink-0 items-center justify-center rounded-md border font-bold ${RANK_BADGE_CLASSES[rank]}`}
      title={`Move ${meta.rank}: ${meta.label}`}
    >
      {meta.rank}
    </span>
  )
}

export const CoachMoveRankBadge = memo(CoachMoveRankBadgeInner)
