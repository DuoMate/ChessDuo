'use client'

import type { ScoredMove } from '@/features/coach'

export type CoachMoveRank = 1 | 2 | 3

export interface CoachRankMeta {
  rank: CoachMoveRank
  /** Human text label — color is never the only differentiator. */
  label: string
  shortLabel: string
}

export const COACH_MOVE_RANKS: CoachRankMeta[] = [
  { rank: 1, label: 'Best', shortLabel: '①' },
  { rank: 2, label: 'Strong alternative', shortLabel: '②' },
  { rank: 3, label: 'Alternative', shortLabel: '③' },
]

export function getCoachRank(index: number): CoachRankMeta {
  return COACH_MOVE_RANKS[Math.min(Math.max(index, 0), 2)]
}

export interface CoachHighlight {
  from: string
  to: string
  rank: CoachMoveRank
}

/** Map suggestion topMoves (UCI) to board from/to + rank. Pure, skips malformed entries. */
export function toCoachHighlights(topMoves: ScoredMove[]): CoachHighlight[] {
  const out: CoachHighlight[] = []
  for (let i = 0; i < Math.min(topMoves.length, 3); i += 1) {
    const uci = topMoves[i]?.uci ?? ''
    if (uci.length < 4) continue
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) continue
    out.push({ from, to, rank: (i + 1) as CoachMoveRank })
  }
  return out
}
