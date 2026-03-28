import { Chess, Move } from 'chess.js'

export interface BotConfig {
  skillLevel: number
}

export class ChessBot {
  private config: BotConfig

  constructor(config: BotConfig = { skillLevel: 3 }) {
    this.config = config
  }

  selectMove(fen: string): string | null {
    try {
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true })
      
      if (moves.length === 0) {
        return null
      }

      const selectedMove = this.pickMove(moves, chess)
      return this.moveToUci(selectedMove)
    } catch {
      return null
    }
  }

  private pickMove(moves: Move[], chess: Chess): Move {
    const randomIndex = Math.floor(Math.random() * moves.length)
    return moves[randomIndex]
  }

  private moveToUci(move: Move): string {
    return `${move.from}-${move.to}`
  }

  getConfig(): BotConfig {
    return { ...this.config }
  }
}

export function createBot(config?: Partial<BotConfig>): ChessBot {
  return new ChessBot({
    skillLevel: config?.skillLevel ?? 3
  })
}
