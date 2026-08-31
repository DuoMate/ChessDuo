import type { EngineMove } from './coachEngine'
import { normalizeEngineScore } from './coachEngine'

/**
 * Pure Coach Mode analysis layer — no engine I/O, no React.
 *
 * Consumes engine output (ranked moves + scores) and produces a human-facing
 * verdict + natural-language explanation. All thresholds mirror the existing
 * lichess-style accuracy model (see `features/shared/accuracy.ts`) with an
 * explicit `blunder` tier above `mistake`.
 */

export type MoveVerdict = 'best' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export interface ScoredMove {
  san: string
  uci: string
  /** Human-readable score label, e.g. `+0.3`, `M3`. */
  display: string
}

export interface Suggestion {
  topMoves: ScoredMove[]
  bestMoveSan: string | null
  /** Evaluation label from the player's perspective, e.g. `+0.3`. */
  evaluationDisplay: string
}

export interface CoachFeedback {
  playerMoveSan: string
  bestMoveSan: string | null
  topMoves: ScoredMove[]
  centipawnLoss: number | null
  verdict: MoveVerdict
  isBlunder: boolean
  missedBetterMove: boolean
  explanation: string
  /** Evaluation of the position after the player's move, from the player's side. */
  evaluationDisplay: string
}

export function classifyLoss(lossCp: number): MoveVerdict {
  if (lossCp <= 10) return 'best'
  if (lossCp <= 30) return 'great'
  if (lossCp <= 70) return 'good'
  if (lossCp <= 150) return 'inaccuracy'
  if (lossCp <= 300) return 'mistake'
  return 'blunder'
}

function formatCp(cp: number): string {
  const pawns = (cp / 100).toFixed(1)
  return cp >= 0 ? `+${pawns}` : pawns
}

function displayScore(cp: number | null, mate: number | null, perspective: 1 | -1): string {
  if (mate !== null) {
    const m = mate * perspective
    return m > 0 ? `M${m}` : `-M${-m}`
  }
  if (cp === null) return '—'
  return formatCp(cp * perspective)
}

function toScoredMove(move: EngineMove, perspective: 1 | -1): ScoredMove {
  return {
    san: move.san,
    uci: move.uci,
    display: displayScore(move.cp, move.mate, perspective),
  }
}

/** Build the "recommend + current eval" suggestion shown on the player's turn. */
export function buildSuggestion(topMoves: EngineMove[]): Suggestion {
  const best = topMoves[0] ?? null
  return {
    topMoves: topMoves.slice(0, 3).map((m) => toScoredMove(m, 1)),
    bestMoveSan: best?.san ?? null,
    evaluationDisplay: best ? displayScore(best.cp, best.mate, 1) : '—',
  }
}

export interface FeedbackInput {
  playerMoveSan: string
  playerMoveUci: string
  /** Top moves in the position BEFORE the player moved (side-to-move = player). */
  beforeTop: EngineMove[]
  /** The player's chosen move score (side-to-move = player). */
  chosen: EngineMove | null
  /** Best move + score in the position AFTER the player moved (side-to-move = opponent). */
  afterBest: EngineMove | null
}

/** Build the post-move coaching feedback (verdict, blunder/miss, explanation). */
export function buildFeedback(input: FeedbackInput): CoachFeedback {
  const bestBefore = input.beforeTop[0] ?? null
  const bestBeforeScore = bestBefore ? normalizeEngineScore(bestBefore.cp, bestBefore.mate) : null
  const chosenScore = input.chosen ? normalizeEngineScore(input.chosen.cp, input.chosen.mate) : null

  let centipawnLoss: number | null = null
  if (bestBeforeScore !== null && chosenScore !== null) {
    centipawnLoss = Math.max(0, bestBeforeScore - chosenScore)
  }

  const verdict: MoveVerdict = centipawnLoss !== null ? classifyLoss(centipawnLoss) : 'good'
  const isBlunder = centipawnLoss !== null && centipawnLoss > 300
  const missedBetterMove = centipawnLoss !== null && centipawnLoss > 70

  // After the player moved, side-to-move is the opponent — negate for the player's view.
  const evaluationDisplay = input.afterBest
    ? displayScore(input.afterBest.cp, input.afterBest.mate, -1)
    : '—'

  const bestMoveSan = bestBefore?.san ?? null
  const explanation = explainMove({
    verdict,
    playerMoveSan: input.playerMoveSan,
    bestMoveSan,
    centipawnLoss,
  })

  return {
    playerMoveSan: input.playerMoveSan,
    bestMoveSan,
    topMoves: input.beforeTop.slice(0, 3).map((m) => toScoredMove(m, 1)),
    centipawnLoss,
    verdict,
    isBlunder,
    missedBetterMove,
    explanation,
    evaluationDisplay,
  }
}

export function explainMove(input: {
  verdict: MoveVerdict
  playerMoveSan: string
  bestMoveSan: string | null
  centipawnLoss: number | null
}): string {
  const loss = input.centipawnLoss
  switch (input.verdict) {
    case 'best':
      return `${input.playerMoveSan} is the engine's top choice — excellent!`
    case 'great':
      return `${input.playerMoveSan} is a strong move.`
    case 'good':
      return `${input.playerMoveSan} is solid and holds the position.`
    case 'inaccuracy':
      return `${input.playerMoveSan} is a little inaccurate${input.bestMoveSan ? ` — consider ${input.bestMoveSan} instead` : ''}.`
    case 'mistake':
      return `${input.playerMoveSan} is a mistake${input.bestMoveSan ? ` — ${input.bestMoveSan} keeps your advantage` : ''}${loss !== null ? ` (about ${loss.toFixed(0)} centipawns lost)` : ''}.`
    case 'blunder':
      return `${input.playerMoveSan} is a blunder${input.bestMoveSan ? ` — ${input.bestMoveSan} was much stronger` : ''}${loss !== null ? ` (about ${loss.toFixed(0)} centipawns lost)` : ''}.`
  }
}
