/**
 * Shared accuracy calculation utilities
 * Used by both LocalGame and OnlineGame for move evaluation
 */

// Accuracy categories based on centipawn loss
export interface AccuracyCategory {
  label: string
  color: string
  emoji: string
}

export function calculateAccuracy(cpLoss: number, isSacrifice: boolean = false): number {
  // Base accuracy from centipawn loss
  let accuracy = 100 - (cpLoss / 4)

  // Apply diminishing returns curve
  if (cpLoss > 100) {
    accuracy = Math.max(0, 100 - (cpLoss - 100) / 10)
  }

  // Bonus for intentional sacrifices
  if (isSacrifice) {
    accuracy = Math.min(100, accuracy + 15)
  }

  return Math.max(0, Math.min(100, accuracy))
}

export function getAccuracyCategory(cpLoss: number): AccuracyCategory {
  if (cpLoss <= 10) {
    return { label: 'Brilliant', color: '#22c55e', emoji: '🌟' }
  }
  if (cpLoss <= 30) {
    return { label: 'Great', color: '#22c55e', emoji: '✓' }
  }
  if (cpLoss <= 50) {
    return { label: 'Good', color: '#84cc16', emoji: '?' }
  }
  if (cpLoss <= 80) {
    return { label: 'Inaccuracy', color: '#eab308', emoji: '??' }
  }
  if (cpLoss <= 150) {
    return { label: 'Mistake', color: '#f97316', emoji: '???' }
  }
  return { label: 'Blunder', color: '#ef4444', emoji: '⁉' }
}

/**
 * Calculate sync rate between two moves
 * @returns percentage of how often teammates chose the same move
 */
export function calculateSyncRate(sameMoveCount: number, totalMoves: number): number {
  if (totalMoves === 0) return 100
  return (sameMoveCount / totalMoves) * 100
}

/**
 * Calculate disagreement rate 
 * @returns percentage of how often teammates disagreed
 */
export function calculateDisagreementRate(sameMoveCount: number, totalMoves: number): number {
  return 100 - calculateSyncRate(sameMoveCount, totalMoves)
}