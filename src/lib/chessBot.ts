import { Chess, Move } from 'chess.js'

export interface BotConfig {
  skillLevel: number
}

const ELO_MAPPING: Record<number, { bestMoveChance: number; description: string }> = {
  1: { bestMoveChance: 0.30, description: '~1500 ELO' },
  2: { bestMoveChance: 0.45, description: '~1600 ELO' },
  3: { bestMoveChance: 0.60, description: '~1700 ELO' },
  4: { bestMoveChance: 0.75, description: '~1800 ELO' },
  5: { bestMoveChance: 0.85, description: '~1900 ELO' },
  6: { bestMoveChance: 0.95, description: '~2000+ ELO' },
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

      if (moves.length === 1) {
        return this.moveToUci(moves[0])
      }

      const selectedMove = this.pickSmartMoveSync(moves, chess.fen())
      return this.moveToUci(selectedMove)
    } catch {
      return null
    }
  }

  private pickSmartMoveSync(moves: Move[], fen: string): Move {
    if (moves.length === 1) {
      return moves[0]
    }

    const evaluatedMoves = this.evaluateMovesSync(moves, fen)
    
    evaluatedMoves.sort((a, b) => b.score - a.score)
    
    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[3]
    const bestMoveChance = skillConfig.bestMoveChance
    
    const roll = Math.random()
    if (roll < bestMoveChance || this.config.skillLevel >= 6) {
      return evaluatedMoves[0].move
    }
    
    const topMovesCount = Math.max(2, Math.floor(moves.length * 0.3))
    const randomIndex = Math.floor(Math.random() * Math.min(topMovesCount, evaluatedMoves.length))
    return evaluatedMoves[randomIndex].move
  }

  private evaluateMovesSync(moves: Move[], fen: string): { move: Move; score: number }[] {
    const results: { move: Move; score: number }[] = []
    
    const turn = new Chess(fen).turn()
    
    for (const move of moves) {
      try {
        const chess = new Chess(fen)
        chess.move(move)
        const newFen = chess.fen()
        
        let score = this.getScoreSync(newFen)
        
        if (turn === 'b') {
          score = -score
        }
        
        results.push({ move, score })
      } catch {
        results.push({ move, score: -Infinity })
      }
    }
    
    return results
  }

  private getScoreSync(fen: string): number {
    return this.fallbackEvaluate(fen)
  }

  private fallbackEvaluate(fen: string): number {
    const chess = new Chess(fen)
    
    const pieceValues: Record<string, number> = {
      'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000,
      'p': -100, 'n': -320, 'b': -330, 'r': -500, 'q': -900, 'k': -20000
    }

    let score = 0
    const board = chess.board()

    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const piece = board[row][col]
        if (piece) {
          const value = pieceValues[piece.color === 'w' ? piece.type : piece.type.toLowerCase()]
          const multiplier = piece.color === 'w' ? 1 : -1
          score += value * multiplier
        }
      }
    }

    return score
  }

  private moveToUci(move: Move): string {
    return `${move.from}-${move.to}`
  }

  getConfig(): BotConfig {
    return { ...this.config }
  }

  getSkillDescription(): string {
    const skill = ELO_MAPPING[this.config.skillLevel]
    return skill?.description || 'Unknown'
  }
}

export function createBot(config?: Partial<BotConfig>): ChessBot {
  return new ChessBot({
    skillLevel: config?.skillLevel ?? 3
  })
}
