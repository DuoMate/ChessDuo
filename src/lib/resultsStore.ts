import { GameStats } from '@/features/offline/game/localGame'

export interface TurnEntry {
  turnNumber: number
  player1Move: string
  player1Accuracy: number
  player2Move: string
  player2Accuracy: number
  isSync: boolean
  winnerId: string
}

export interface CategoryBreakdown {
  great: number
  good: number
  inaccuracy: number
  mistake: number
  blunder: number
}

export interface GameSummary {
  result: 'win' | 'lose' | 'draw'
  resultText: string
  team: 'WHITE' | 'BLACK'
  difficulty: number
  stats: GameStats
  bestMove?: { move: string; accuracy: number; player: string }
  worstMove?: { move: string; accuracy: number; player: string }
  categoryBreakdown: {
    player1: CategoryBreakdown
    player2: CategoryBreakdown
  }
  turnHistory: TurnEntry[]
}

let currentResult: GameSummary | null = null

export function setGameResult(result: GameSummary) {
  currentResult = result
}

export function getGameResult(): GameSummary | null {
  return currentResult
}

export function clearGameResult() {
  currentResult = null
}
