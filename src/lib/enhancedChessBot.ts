import { Chess, Move } from 'chess.js'
import { MoveEvaluator } from './moveEvaluator'

export interface BotConfig {
  skillLevel: number
  useStockfish?: boolean
}

const ELO_MAPPING: Record<number, { bestMoveChance: number; description: string; searchDepth: number }> = {
  1: { bestMoveChance: 0.30, description: '~1500 ELO', searchDepth: 1 },
  2: { bestMoveChance: 0.45, description: '~1600 ELO', searchDepth: 2 },
  3: { bestMoveChance: 0.60, description: '~1700 ELO', searchDepth: 3 },
  4: { bestMoveChance: 0.80, description: '~1800 ELO', searchDepth: 4 },
  5: { bestMoveChance: 0.92, description: '~1900 ELO', searchDepth: 5 },
  6: { bestMoveChance: 0.99, description: '~2000+ ELO', searchDepth: 10 },
}

/**
 * Enhanced Chess Bot with Stockfish Integration
 * 
 * This bot provides:
 * - Async move selection using Stockfish engine
 * - Fallback to basic evaluation if Stockfish unavailable
 * - ELO-based move quality control
 * - Backward compatibility with sync selectMove (fallback to basic eval)
 */
export class EnhancedChessBot {
  private config: BotConfig
  private moveEvaluator: MoveEvaluator
  private stockfishReady: boolean = false

  constructor(config: BotConfig = { skillLevel: 3, useStockfish: true }) {
    this.config = config
    const skillConfig = ELO_MAPPING[config.skillLevel] || ELO_MAPPING[3]
    this.moveEvaluator = new MoveEvaluator(skillConfig.searchDepth)
    
    // Initialize Stockfish if available
    if (config.useStockfish) {
      this.initializeStockfish()
    }
  }

  /**
   * Initialize Stockfish asynchronously
   * This is non-blocking and runs in the background
   */
  private initializeStockfish(): void {
    if (this.moveEvaluator.isReady()) {
      this.stockfishReady = true
    }
  }

  /**
   * Check if Stockfish is ready
   */
  isStockfishReady(): boolean {
    return this.stockfishReady || this.moveEvaluator.isUsingStockfish()
  }

  /**
   * SELECT MOVE - Async version (Recommended)
   * Uses Stockfish for better evaluation if available
   * Falls back to basic evaluation if Stockfish unavailable
   * 
   * @param fen - Current board position
   * @returns Promise resolving to UCI move or null
   */
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

      // Try to use Stockfish for evaluation if available
      const usingStockfish = this.moveEvaluator.isUsingStockfish()
      
      if (usingStockfish) {
        const selectedMove = await this.pickSmartMoveAsync(moves, fen)
        return this.moveToUci(selectedMove)
      } else {
        // Fallback to sync evaluation
        const selectedMove = this.pickSmartMoveSync(moves, fen)
        return this.moveToUci(selectedMove)
      }
    } catch (error) {
      console.warn('Error in selectMoveAsync:', error)
      return null
    }
  }

  /**
   * SELECT MOVE - Sync version (Backward Compatible)
   * Uses basic material evaluation
   * Safe fallback for sync contexts
   * 
   * @param fen - Current board position
   * @returns UCI move or null
   */
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

  /**
   * Pick move using Stockfish evaluation (Async)
   * Evaluates all moves using Stockfish
   * Applies ELO-based move selection
   */
  private async pickSmartMoveAsync(moves: Move[], fen: string): Promise<Move> {
    if (moves.length === 1) {
      return moves[0]
    }

    // Evaluate all moves using Stockfish
    const evaluatedMoves: { move: Move; score: number }[] = []

    for (const move of moves) {
      try {
        const uciMove = this.moveToUci(move)
        const evaluation = await this.moveEvaluator.evaluateMove(uciMove, fen)
        evaluatedMoves.push({
          move,
          score: evaluation.score
        })
      } catch (error) {
        evaluatedMoves.push({
          move,
          score: -Infinity
        })
      }
    }

    // Sort by score (highest first)
    evaluatedMoves.sort((a, b) => b.score - a.score)

    // Apply ELO-based selection
    return this.applyEloBasedSelection(evaluatedMoves)
  }

  /**
   * Pick move using basic evaluation (Sync fallback)
   * This is the existing logic - material only
   */
  private pickSmartMoveSync(moves: Move[], fen: string): Move {
    if (moves.length === 1) {
      return moves[0]
    }

    const evaluatedMoves = this.evaluateMovesSync(moves, fen)
    evaluatedMoves.sort((a, b) => b.score - a.score)

    return this.applyEloBasedSelection(evaluatedMoves)
  }

  /**
   * Apply ELO-based move selection
   * Higher ELO = more likely to play best move
   * Lower ELO = more random moves to simulate weakness
   */
  private applyEloBasedSelection(evaluatedMoves: { move: Move; score: number }[]): Move {
    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[3]
    const bestMoveChance = skillConfig.bestMoveChance

    const roll = Math.random()
    
    // Always play best move at highest skill levels
    if (roll < bestMoveChance || this.config.skillLevel >= 6) {
      return evaluatedMoves[0].move
    }

    // Otherwise pick from top 30% of moves randomly
    const topMovesCount = Math.max(2, Math.floor(evaluatedMoves.length * 0.3))
    const randomIndex = Math.floor(Math.random() * Math.min(topMovesCount, evaluatedMoves.length))
    return evaluatedMoves[randomIndex].move
  }

  /**
   * Basic move evaluation (material only)
   * Used as fallback when Stockfish unavailable
   */
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

  /**
   * Material-only evaluation
   * Provides basic position assessment without Stockfish
   */
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

  /**
   * Get search depth for this skill level
   * Used for Stockfish depth parameter
   */
  getSearchDepth(): number {
    const skill = ELO_MAPPING[this.config.skillLevel]
    return skill?.searchDepth || 10
  }
}

/**
 * Factory function for creating enhanced bots
 * @param config - Bot configuration with optional Stockfish
 * @returns EnhancedChessBot instance
 */
export function createEnhancedBot(config?: Partial<BotConfig>): EnhancedChessBot {
  return new EnhancedChessBot({
    skillLevel: config?.skillLevel ?? 3,
    useStockfish: config?.useStockfish ?? true
  })
}
