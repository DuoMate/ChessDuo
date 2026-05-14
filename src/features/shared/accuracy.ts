/**
 * Shared accuracy calculation utilities (Lichess hyperbolic model)
 * Single source of truth for move evaluation across LocalGame and OnlineGame
 */

export interface AccuracyCategory {
  label: string
  color: string
  emoji: string
}

export function calculateAccuracy(lossInCentipawns: number): number {
  if (lossInCentipawns <= 10) return 100
  if (lossInCentipawns >= 300) return 0
  return Math.round(100 * (1 - (lossInCentipawns - 10) / 290))
}

export function getAccuracyCategory(lossInCentipawns: number): AccuracyCategory {
  if (lossInCentipawns <= 10) return { label: 'Perfect', color: '#22c55e', emoji: '✓' }
  if (lossInCentipawns <= 30) return { label: 'Great', color: '#22c55e', emoji: '!' }
  if (lossInCentipawns <= 70) return { label: 'Good', color: '#84cc16', emoji: '?' }
  if (lossInCentipawns <= 150) return { label: 'Inaccuracy', color: '#eab308', emoji: '??' }
  return { label: 'Mistake', color: '#ef4444', emoji: '!!!' }
}

export function calculateSyncRate(sameMoveCount: number, totalMoves: number): number {
  if (totalMoves === 0) return 100
  return (sameMoveCount / totalMoves) * 100
}

export function calculateDisagreementRate(sameMoveCount: number, totalMoves: number): number {
  return 100 - calculateSyncRate(sameMoveCount, totalMoves)
}
