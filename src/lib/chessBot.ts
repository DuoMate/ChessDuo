import { Chess, Move } from 'chess.js'

export interface BotConfig {
  skillLevel: number
  useStockfish?: boolean
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
  private stockfishReady: boolean = false

  constructor(config: BotConfig = { skillLevel: 3 }) {
    this.config = config
    
    // Use mock MoveEvaluator if provided (for testing)
    if (config.mockMoveEvaluator) {
      this.moveEvaluator = config.mockMoveEvaluator
      this.stockfishReady = true
      return
    }
    
    // Lazy load MoveEvaluator for Stockfish support
    if (config.useStockfish) {
      this.initializeMoveEvaluator()
    }
  }

  /**
   * Initialize MoveEvaluator for Stockfish integration
   * Non-blocking initialization
   */
  private initializeMoveEvaluator(): void {
    if (typeof window !== 'undefined') {
      import('./moveEvaluator').then(({ MoveEvaluator }) => {
        const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[3]
        this.moveEvaluator = new MoveEvaluator(skillConfig.searchDepth)
        // Check if Stockfish becomes ready
        setTimeout(() => {
          this.stockfishReady = this.moveEvaluator?.isUsingStockfish() || false
        }, 100)
      }).catch(() => {
        console.warn('MoveEvaluator not available, using basic evaluation')
      })
    }
  }

  /**
   * Check if Stockfish is ready for evaluation
   */
  isStockfishReady(): boolean {
    return this.stockfishReady || (this.moveEvaluator?.isUsingStockfish() || false)
  }

  /**
   * ASYNC: Select move using Stockfish only (no fallback)
   * Throws error if Stockfish is unavailable
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

      // ALWAYS use Stockfish - wait until ready
      if (!this.moveEvaluator) {
        throw new Error('MoveEvaluator not initialized')
      }

      // Wait indefinitely for Stockfish to be ready
      console.log('[ChessBot] Waiting for Stockfish...')
      await this.waitForStockfish(30000) // Wait up to 30s
      
      if (!this.moveEvaluator.isUsingStockfish()) {
        throw new Error('Stockfish failed to initialize after 30s')
      }

      console.log('[ChessBot] Stockfish ready, evaluating move...')
      const selectedMove = await this.pickSmartMoveAsync(moves, fen)
      return this.moveToUci(selectedMove)
    } catch (error) {
      // Re-throw Stockfish-related errors
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg.includes('Stockfish') || errorMsg.includes('MoveEvaluator')) {
        console.error('[ChessBot] Fatal error - Stockfish unavailable:', error)
        throw error
      }
      // For other errors (like invalid FEN), return null
      console.warn('[ChessBot] Move selection failed:', error)
      return null
    }
  }

  private waitForStockfish(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const checkReady = () => {
        if (this.moveEvaluator && this.moveEvaluator.isUsingStockfish()) {
          console.log('[ChessBot] Stockfish is ready!')
          resolve(true)
          return
        }
        
        if (Date.now() - startTime >= timeoutMs) {
          console.warn(`[ChessBot] Stockfish not ready after ${timeoutMs}ms`)
          resolve(false)
          return
        }
        
        setTimeout(checkReady, 500)
      }
      
      checkReady()
    })
  }

  /**
   * SYNC: Select move using basic evaluation
   * Maintains backward compatibility
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

      const selectedMove = this.pickSmartMoveSync(moves, chess.fen())
      return this.moveToUci(selectedMove)
    } catch {
      return null
    }
  }

  /**
   * ASYNC: Pick move using Stockfish evaluation
   */
  private async pickSmartMoveAsync(moves: Move[], fen: string): Promise<Move> {
    if (moves.length === 1) {
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

  /**
   * Apply ELO-based selection logic
   * Higher ELO = more likely to play best move
   * Lower ELO = more randomness to simulate weakness
   */
  private applyEloBasedSelection(evaluatedMoves: { move: Move; score: number }[]): Move {
    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[3]
    const bestMoveChance = skillConfig.bestMoveChance

    const roll = Math.random()
    if (roll < bestMoveChance) {
      return evaluatedMoves[0].move
    }

    const topMovesCount = Math.min(3, evaluatedMoves.length)
    const randomIndex = Math.floor(Math.random() * topMovesCount)
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
    skillLevel: config?.skillLevel ?? 3,
    useStockfish: config?.useStockfish ?? true // Default to using Stockfish
  })
}
