import { Chess, Move } from 'chess.js'
import { ServerMoveEvaluator } from './serverMoveEvaluator'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

export interface BotConfig {
  skillLevel: number
}

const ELO_MAPPING: Record<number, { maxCentipawnLoss: number; description: string; searchDepth: number }> = {
  1: { maxCentipawnLoss: 300, description: '~1500 ELO', searchDepth: 1 },
  2: { maxCentipawnLoss: 200, description: '~1600 ELO', searchDepth: 2 },
  3: { maxCentipawnLoss: 150, description: '~1700 ELO', searchDepth: 3 },
  4: { maxCentipawnLoss: 100, description: '~1800 ELO', searchDepth: 4 },
  5: { maxCentipawnLoss: 50, description: '~1900 ELO', searchDepth: 5 },
  6: { maxCentipawnLoss: 20, description: '~2000+ ELO', searchDepth: 10 },
}

export class EnhancedChessBot {
  private config: BotConfig
  private moveEvaluator: ServerMoveEvaluator | null = null

  constructor(config: BotConfig = { skillLevel: 3 }) {
    this.config = config
    
    if (SERVER_URL) {
      this.moveEvaluator = new ServerMoveEvaluator(SERVER_URL)
    }
  }

  isStockfishReady(): boolean {
    return this.moveEvaluator?.isUsingStockfish() ?? false
  }

  async selectMoveAsync(fen: string): Promise<string | null> {
    try {
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true })

      if (moves.length === 0) {
        return null
      }

      if (moves.length === 1) {
        return this.moveToUci(moves[0])
      }

      if (!this.moveEvaluator) {
        throw new Error('No evaluator configured')
      }

      const selectedMove = await this.pickSmartMoveAsync(moves, fen)
      return this.moveToUci(selectedMove)
    } catch (error) {
      console.warn('Error in selectMoveAsync:', error)
      return null
    }
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

      const selectedMove = this.pickSmartMoveSync(moves, fen)
      return this.moveToUci(selectedMove)
    } catch (error) {
      console.warn('Error in selectMove:', error)
      return null
    }
  }

  private async pickSmartMoveAsync(moves: Move[], fen: string): Promise<Move> {
    if (moves.length === 1) {
      return moves[0]
    }

    const evaluatedMoves: { move: Move; score: number }[] = []

    for (const move of moves) {
      try {
        const uciMove = this.moveToUci(move)
        const evaluation = await this.moveEvaluator!.evaluateMove(uciMove, fen)
        evaluatedMoves.push({
          move,
          score: evaluation.score
        })
      } catch {
        evaluatedMoves.push({
          move,
          score: -Infinity
        })
      }
    }

    evaluatedMoves.sort((a, b) => b.score - a.score)

    return this.applyEloBasedSelection(evaluatedMoves)
  }

  private pickSmartMoveSync(moves: Move[], fen: string): Move {
    if (moves.length === 1) {
      return moves[0]
    }

    const evaluatedMoves = this.evaluateMovesSync(moves, fen)
    evaluatedMoves.sort((a, b) => b.score - a.score)

    return this.applyEloBasedSelection(evaluatedMoves)
  }

  private applyEloBasedSelection(evaluatedMoves: { move: Move; score: number }[]): Move {
    if (evaluatedMoves.length === 0) {
      throw new Error('No moves to select from')
    }

    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[4]
    const maxLoss = skillConfig.maxCentipawnLoss
    const bestScore = evaluatedMoves[0].score

    const acceptable = evaluatedMoves.filter(m => {
      const loss = Math.abs(bestScore - m.score)
      return loss <= maxLoss
    })

    if (acceptable.length > 0) {
      const selected = acceptable[0]
      const loss = Math.abs(bestScore - selected.score)
      console.log(`[EnhancedChessBot:L${this.config.skillLevel}] Selected: ${selected.move.san} (loss: ${loss}cp, floor: ${maxLoss}cp)`)
      return selected.move
    }

    console.log(`[EnhancedChessBot:L${this.config.skillLevel}] No acceptable moves within ${maxLoss}cp, picking best: ${evaluatedMoves[0].move.san}`)
    return evaluatedMoves[0].move
  }

  private evaluateMovesSync(moves: Move[], fen: string): { move: Move; score: number }[] {
    const results: { move: Move; score: number }[] = []
    const turn = new Chess(fen).turn()

    for (const move of moves) {
      try {
        const chess = new Chess(fen)
        chess.move(move)
        const newFen = chess.fen()

        let score = this.fallbackEvaluate(newFen)

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

  private fallbackEvaluate(fen: string): number {
    const chess = new Chess(fen)

    const pieceValues: Record<string, number> = {
      'P': 100,
      'N': 320,
      'B': 330,
      'R': 500,
      'Q': 900,
      'K': 20000,
      'p': -100,
      'n': -320,
      'b': -330,
      'r': -500,
      'q': -900,
      'k': -20000
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

  getSearchDepth(): number {
    const skill = ELO_MAPPING[this.config.skillLevel]
    return skill?.searchDepth || 10
  }
}

export function createEnhancedBot(config?: Partial<BotConfig>): EnhancedChessBot {
  return new EnhancedChessBot({
    skillLevel: config?.skillLevel ?? 3,
  })
}
