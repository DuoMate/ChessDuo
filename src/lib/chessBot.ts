import { Chess, Move } from 'chess.js'
import { getBookMove } from './openings'
import { ServerMoveEvaluator } from './serverMoveEvaluator'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

export interface BotConfig {
  skillLevel: number
  mockMoveEvaluator?: any
}

const ELO_MAPPING: Record<number, { 
  uciElo: number
  description: string
  topMovesToConsider: number
  bestMoveChance: number
}> = {
  1: { uciElo: 1000, description: 'Beginner ~1000 ELO', topMovesToConsider: 10, bestMoveChance: 0.55 },
  2: { uciElo: 1500, description: 'Novice ~1500 ELO', topMovesToConsider: 7, bestMoveChance: 0.68 },
  3: { uciElo: 1800, description: 'Intermediate ~1800 ELO', topMovesToConsider: 5, bestMoveChance: 0.83 },
  4: { uciElo: 2000, description: 'Advanced ~2000 ELO', topMovesToConsider: 3, bestMoveChance: 0.90 },
  5: { uciElo: 2200, description: 'Expert ~2200 ELO', topMovesToConsider: 2, bestMoveChance: 0.95 },
  6: { uciElo: 2600, description: 'Master ~2600 ELO', topMovesToConsider: 1, bestMoveChance: 1.0 },
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
      if (bookMove && this.config.skillLevel <= 3) {
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
    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[4]
    
    if (moves.length === 1) {
      console.log(`[ChessBot:L${this.config.skillLevel}] Only one move available: ${moves[0].san}`)
      return moves[0]
    }
    
    const evalStart = Date.now()
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[ChessBot:L${this.config.skillLevel}] ${skillConfig.description}`)
    console.log(`[ChessBot] FEN: ${fen}`)
    console.log(`[ChessBot] Evaluating ${moves.length} moves with full-strength Stockfish`)

    try {
      const evaluatedMoves = await this.evaluateMovesWithFallback(moves, fen, 2600)
      const selectedMove = this.applyEloBasedSelection(evaluatedMoves)
      console.log(`${'='.repeat(60)}\n`)
      return selectedMove
    } catch (error) {
      console.log(`[ChessBot] ERROR: ${error}`)
      console.log(`[ChessBot] Falling back to first move`)
      console.log(`${'='.repeat(60)}\n`)
      return moves[0]
    }
  }

  private async evaluateMovesWithFallback(moves: Move[], fen: string, uciElo: number = 2600): Promise<{ move: Move; score: number }[]> {
    const isBlackTurn = new Chess(fen).turn() === 'b'
    const uciMoves = moves.map(m => this.moveToUci(m))
    
    try {
      const results = await this.moveEvaluator.evaluateMoves(uciMoves, fen, 15, uciElo)
      const scoreMap = new Map<string, number>(results.map((r: { move: string; score: number }) => [r.move, r.score]))
      
      return moves.map(move => {
        const uci = this.moveToUci(move)
        const score = scoreMap.get(uci)
        return {
          move,
          score: score !== undefined ? score : (isBlackTurn ? Infinity : -Infinity)
        }
      })
    } catch {
      return moves.map(move => ({
        move,
        score: isBlackTurn ? Infinity : -Infinity
      }))
    }
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
    if (evaluatedMoves.length === 0) {
      throw new Error('No moves to select from')
    }

    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[4]
    const isBlackTurn = evaluatedMoves[0].move.color === 'b'
    
    console.log(`[ChessBot:L${this.config.skillLevel}] ${skillConfig.description}`)
    console.log(`[ChessBot] Parameters: topMoves=${skillConfig.topMovesToConsider}, bestMoveChance=${(skillConfig.bestMoveChance * 100).toFixed(0)}%`)

    if (isBlackTurn) {
      evaluatedMoves.sort((a, b) => a.score - b.score)
    } else {
      evaluatedMoves.sort((a, b) => b.score - a.score)
    }
    
    console.log(`[ChessBot] All moves ranked:`)
    evaluatedMoves.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.move.san}: score=${m.score}`)
    })

    const topMovesToConsider = Math.min(skillConfig.topMovesToConsider, evaluatedMoves.length)
    const topMoves = evaluatedMoves.slice(0, topMovesToConsider)
    
    const roll = Math.random()
    console.log(`[ChessBot] Dice roll: ${(roll * 100).toFixed(1)}% (threshold: ${(skillConfig.bestMoveChance * 100).toFixed(0)}%)`)
    
    let selectedMoveEntry: { move: Move; score: number }
    
    if (roll < skillConfig.bestMoveChance) {
      selectedMoveEntry = topMoves[0]
      console.log(`[ChessBot] → Selected BEST move: ${selectedMoveEntry.move.san} (score=${selectedMoveEntry.score})`)
    } else {
      const randomIndex = Math.floor(Math.random() * topMoves.length)
      selectedMoveEntry = topMoves[randomIndex]
      console.log(`[ChessBot] → Random from top ${topMovesToConsider}: ${selectedMoveEntry.move.san} (score=${selectedMoveEntry.score})`)
    }

    console.log(`[ChessBot] SELECTED: ${selectedMoveEntry.move.san}`)
    return selectedMoveEntry.move
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
