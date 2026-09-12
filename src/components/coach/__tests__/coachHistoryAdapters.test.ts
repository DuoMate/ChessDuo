/**
 * Coach history adapter tests — pure view mappings.
 *
 * Covers: SAN list → sidebar entries (rounds, labels, colors, eval deltas),
 * SAN replay → fen timeline (correctness, invalid-SAN truncation, purity).
 */
import { Chess } from 'chess.js'
import {
  buildFenSequence,
  COACH_INITIAL_FEN,
  moveHistoryToRoundEntries,
} from '../coachHistoryAdapters'
import type { CoachInsight } from '@/features/coach'

function insight(playerMoveSan: string, centipawnLoss: number | null): CoachInsight {
  return {
    moveNumber: 1,
    feedback: {
      playerMoveSan,
      bestMoveSan: 'e4',
      topMoves: [],
      centipawnLoss,
      verdict: 'best',
      isBlunder: false,
      missedBetterMove: false,
      explanation: `${playerMoveSan} played.`,
      evaluationDisplay: '+0.3',
    },
  }
}

describe('moveHistoryToRoundEntries', () => {
  it('maps plies to rounds with You/Bot labels and colors', () => {
    const entries = moveHistoryToRoundEntries(['e4', 'e5', 'Nf3'], 'w')
    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({ round: 1, playerLabel: 'You', moveSan: 'e4', pieceColor: 'white' })
    expect(entries[1]).toMatchObject({ round: 1, playerLabel: 'Bot', moveSan: 'e5', pieceColor: 'black' })
    expect(entries[2]).toMatchObject({ round: 2, playerLabel: 'You', moveSan: 'Nf3', pieceColor: 'white' })
  })

  it('labels correctly when the player is black', () => {
    const entries = moveHistoryToRoundEntries(['e4', 'c5'], 'b')
    expect(entries[0].playerLabel).toBe('Bot')
    expect(entries[1].playerLabel).toBe('You')
  })

  it('attaches negative eval deltas from coaching history to player moves only', () => {
    const entries = moveHistoryToRoundEntries(['e4', 'e5'], 'w', [insight('e4', 140)])
    expect(entries[0].evalDelta).toBe(-140)
    expect(entries[1].evalDelta).toBe(0)
  })

  it('reports 0 when no coaching history exists', () => {
    const entries = moveHistoryToRoundEntries(['e4'], 'w')
    expect(entries[0].evalDelta).toBe(0)
  })
})

describe('buildFenSequence', () => {
  it('starts with the initial fen and ends at the live position', () => {
    const moves = ['e4', 'e5', 'Nf3']
    const positions = buildFenSequence(moves)
    expect(positions).toHaveLength(moves.length + 1)
    expect(positions[0]).toBe(COACH_INITIAL_FEN)

    const chess = new Chess()
    moves.forEach((san) => chess.move(san))
    expect(positions[positions.length - 1]).toBe(chess.fen())
  })

  it('returns only the initial fen for an empty game', () => {
    expect(buildFenSequence([])).toEqual([COACH_INITIAL_FEN])
  })

  it('truncates at the first illegal SAN instead of throwing', () => {
    const positions = buildFenSequence(['e4', 'bogus', 'Nf3'])
    expect(positions).toHaveLength(2)
  })

  it('never mutates the input array', () => {
    const moves = ['e4', 'e5']
    buildFenSequence(moves)
    expect(moves).toEqual(['e4', 'e5'])
  })
})
