import { Chess, Move } from 'chess.js'
import { getBookMove } from './openings'
import { ServerMoveEvaluator } from './serverMoveEvaluator'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

export interface BotConfig {
  skillLevel: number
  mockMoveEvaluator?: any
}

const ELO_MAPPING: Record<number, { bestMoveChance: number; description: string; searchDepth: number }> = {
  1: { bestMoveChance: 0.30, description: '~1500 ELO', searchDepth: 1 },
  2: { bestMoveChance: 0.45, description: '~1600 ELO', searchDepth: 2 },
  3: { bestMoveChance: 0.60, description: '~1700 ELO', searchDepth: 3 },
  4: { bestMoveChance: 0.80, description: '~1800 ELO', searchDepth: 4 },
  5: { bestMoveChance: 0.92, description: '~1900 ELO', searchDepth: 5 },
  6: { bestMoveChance: 0.99, description: '~2000+ ELO', searchDepth: 10 },
}

export class ChessBot {
  private config: BotConfig
  private moveEvaluator: any = null

  constructor(config: BotConfig = { skillLevel: 3 }) {
    this.config = config
    
    if (config.mockMoveEvaluator) {
      this.moveEvaluator = config.mockMoveEvaluator
      return
    }
    
    if (SERVER_URL) {
      console.log(`[ChessBot] Using server evaluator: ${SERVER_URL}`)
      this.moveEvaluator = new ServerMoveEvaluator(SERVER_URL)
    } else {
      console.warn('[ChessBot] No server URL configured, bot will use fallback evaluation')
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

      const bookMove = getBookMove(fen, this.config.skillLevel)
      if (bookMove) {
        const matchedMove = moves.find(m => m.san === bookMove || m.lan === bookMove || (m.from + m.to) === bookMove)
        if (matchedMove) {
          console.log(`[ChessBot:Opening Book] Move: ${bookMove}`)
          return this.moveToUci(matchedMove)
        }
      }

      if (!this.moveEvaluator) {
        throw new Error('No evaluator configured')
      }

      const selectedMove = await this.pickSmartMoveAsync(moves, fen)
      return this.moveToUci(selectedMove)
    } catch (error) {
      console.error('[ChessBot] Move selection failed:', error)
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

      const selectedMove = this.pickSmartMoveSync(moves, chess.fen())
      return this.moveToUci(selectedMove)
    } catch {
      return null
    }
  }

  private async pickSmartMoveAsync(moves: Move[], fen: string): Promise<Move> {
    const isBlackTurn = new Chess(fen).turn() === 'b'
    
    if (moves.length === 1) {
      console.log(`[ChessBot] Only one move available: ${moves[0].san}`)
      return moves[0]
    }

    const evaluatedMoves: { move: Move; score: number }[] = []

    for (const move of moves) {
      try {
        const uciMove = this.moveToUci(move)
        const evaluation = await this.moveEvaluator.evaluateMove(uciMove, fen)
        evaluatedMoves.push({
          move,
          score: evaluation.score
        })
      } catch {
        evaluatedMoves.push({
          move,
          score: isBlackTurn ? Infinity : -Infinity
        })
      }
    }

    if (isBlackTurn) {
      evaluatedMoves.sort((a, b) => a.score - b.score)
    } else {
      evaluatedMoves.sort((a, b) => b.score - a.score)
    }
    
    const topMovesDisplay = evaluatedMoves.slice(0, Math.min(5, evaluatedMoves.length))
      .map((m, i) => `${i + 1}. ${m.move.san}(${m.score})`)
      .join(' | ')
    console.log(`\n[ChessBot:L${this.config.skillLevel}] Evaluating ${moves.length} moves`)
    console.log(`[ChessBot] Top moves: ${topMovesDisplay}`)

    const selectedMove = this.applyEloBasedSelection(evaluatedMoves)
    console.log(`[ChessBot:L${this.config.skillLevel}] Selected: ${selectedMove.san} (score: ${evaluatedMoves.find(m => m.move.san === selectedMove.san)?.score})`)
    
    return selectedMove
  }

  private pickSmartMoveSync(moves: Move[], fen: string): Move {
    if (moves.length === 1) {
      return moves[0]
    }

    const evaluatedMoves = this.evaluateMovesSync(moves, fen)
    const isBlackTurn = new Chess(fen).turn() === 'b'
    
    if (isBlackTurn) {
      evaluatedMoves.sort((a, b) => a.score - b.score)
    } else {
      evaluatedMoves.sort((a, b) => b.score - a.score)
    }
    
    return this.applyEloBasedSelection(evaluatedMoves)
  }

  private applyEloBasedSelection(evaluatedMoves: { move: Move; score: number }[]): Move {
    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[3]
    const bestMoveChance = skillConfig.bestMoveChance
    const skillLevel = this.config.skillLevel

    const roll = Math.random()
    if (roll < bestMoveChance) {
      console.log(`[ChessBot:Selection] L${skillLevel}: Picked BEST (${(bestMoveChance * 100).toFixed(0)}% chance, rolled ${(roll * 100).toFixed(1)}%)`)
      return evaluatedMoves[0].move
    }

    const maxTopMoves = Math.max(1, Math.ceil((7 - skillLevel) / 1.5))
    const topMovesCount = Math.min(maxTopMoves, evaluatedMoves.length)
    const randomIndex = Math.floor(Math.random() * topMovesCount)
    console.log(`[ChessBot:Selection] L${skillLevel}: Picked from top ${topMovesCount} (rolled ${(roll * 100).toFixed(1)}% < ${(bestMoveChance * 100).toFixed(0)}%), index ${randomIndex}`)
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
    skillLevel: config?.skillLevel ?? 3,
  })
}
