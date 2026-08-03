export enum GameStatus {
  WAITING = 'WAITING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface MoveComparison {
  player1Move: string
  player2Move: string
  player1Score: number
  player2Score: number
  player1Accuracy: number
  player2Accuracy: number
  player1Loss: number
  player2Loss: number
  player1Category: { label: string; color: string; emoji: string }
  player2Category: { label: string; color: string; emoji: string }
  winningMove: string
  winningScore: number
  isSync: boolean
  bestEngineMove: string
  bestEngineScore: number
  turnStartFen: string
  winnerId: 'player1' | 'player2'
  loserId: 'player1' | 'player2' | null
  loserFrom: string
  loserTo: string
  alternatives: { move: string; score: number }[]
  youMatchedEngine: boolean
  teammateMatchedEngine: boolean
}

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'
