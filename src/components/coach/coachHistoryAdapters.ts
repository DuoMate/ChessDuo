'use client'

import { Chess } from 'chess.js'
import type { RoundHistoryEntry } from '../RoundHistorySidebar'
import type { CoachInsight } from '@/features/coach'

/**
 * Coach-only view adapters. These translate the Coach engine's minimal shapes
 * (`moveHistory: string[]`, `feedbackHistory`) into the prop shapes of the
 * shared read-only components. The shared components themselves are untouched.
 * Nothing here writes to the engine — all functions are pure.
 */

/** Initial position (no moves played). */
export const COACH_INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/**
 * Replay `moveHistory` (SAN, both sides) from the initial position.
 * Returns `[initialFen, fenAfterPly0, fenAfterPly1, ...]`.
 * Stops at the first illegal/unparseable SAN rather than throwing.
 */
export function buildFenSequence(moveHistory: string[]): string[] {
  const positions: string[] = [COACH_INITIAL_FEN]
  const chess = new Chess()
  for (const san of moveHistory) {
    try {
      chess.move(san)
    } catch {
      // Truncated history is safer than a crash — preview what we can.
      break
    }
    positions.push(chess.fen())
  }
  return positions
}

/**
 * Map the SAN move list to `RoundHistorySidebar` entries.
 * `centipawnLoss` per player-move ordinal comes from the coaching history;
 * bot moves and unscored moves report `evalDelta: 0` (honest "no data").
 */
export function moveHistoryToRoundEntries(
  moveHistory: string[],
  playerColor: 'w' | 'b',
  feedbackHistory: CoachInsight[] = [],
): RoundHistoryEntry[] {
  const lossByOrdinal = new Map<number, number>()
  feedbackHistory.forEach((insight, index) => {
    if (insight.feedback.centipawnLoss !== null) {
      lossByOrdinal.set(index + 1, insight.feedback.centipawnLoss)
    }
  })

  let playerOrdinal = 0
  return moveHistory.map((moveSan, ply) => {
    const isWhiteMove = ply % 2 === 0
    const mover: 'w' | 'b' = isWhiteMove ? 'w' : 'b'
    const isPlayerMove = mover === playerColor
    if (isPlayerMove) playerOrdinal++
    const loss = isPlayerMove ? lossByOrdinal.get(playerOrdinal) : undefined
    return {
      round: Math.floor(ply / 2) + 1,
      playerLabel: isPlayerMove ? 'You' : 'Bot',
      moveSan,
      pieceColor: isWhiteMove ? 'white' : 'black',
      pieceChar: moveSan.charAt(0),
      evalDelta: loss !== undefined ? -loss : 0,
    } satisfies RoundHistoryEntry
  })
}
