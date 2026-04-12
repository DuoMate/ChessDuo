import { Chess, Move } from 'chess.js'
import { getBookMove } from './openings'
import { ServerMoveEvaluator } from './serverMoveEvaluator'
import { DIFFICULTY, DESCRIPTIONS, DifficultyConfig } from './difficulty'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

export interface BotConfig {
  skillLevel: number
  mockMoveEvaluator?: any
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
    const difficulty = DIFFICULTY[this.config.skillLevel] || DIFFICULTY[4]
    const isBlackTurn = new Chess(fen).turn() === 'b'
    
    if (moves.length === 1) {
      console.log(`[ChessBot:L${this.config.skillLevel}] Only one move available: ${moves[0].san}`)
      return moves[0]
    }
    
    const evalStart = Date.now()
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[ChessBot:L${this.config.skillLevel}] ${DESCRIPTIONS[this.config.skillLevel]}`)
    console.log(`[ChessBot] FEN: ${fen}`)
    console.log(`[ChessBot] Evaluating ${moves.length} moves with full-strength Stockfish`)
    console.log(`[ChessBot] Config: noise=${difficulty.noise}, topMoves=${difficulty.topMoves}, blunderChance=${difficulty.blunderChance}, weirdChance=${difficulty.weirdChance}`)

    try {
      const evaluatedMoves = await this.evaluateMovesWithFallback(moves, fen)
      const selectedMove = this.applyHumanizedSelection(evaluatedMoves, fen, isBlackTurn)
      console.log(`${'='.repeat(60)}\n`)
      return selectedMove
    } catch (error) {
      console.log(`[ChessBot] ERROR: ${error}`)
      console.log(`[ChessBot] Falling back to first move`)
      console.log(`${'='.repeat(60)}\n`)
      return moves[0]
    }
  }

  private async evaluateMovesWithFallback(moves: Move[], fen: string): Promise<{ move: Move; score: number }[]> {
    const isBlackTurn = new Chess(fen).turn() === 'b'
    const difficulty = DIFFICULTY[this.config.skillLevel] || DIFFICULTY[4]
    const topMovesLimit = difficulty.topMoves
    
    const uciMoves = moves.map(m => this.moveToUci(m))
    const movesToEvaluate = uciMoves.slice(0, topMovesLimit)
    
    try {
      const results = await this.moveEvaluator.evaluateMoves(movesToEvaluate, fen, 12, 2600)
      const scoreMap = new Map<string, number>(results.map((r: { move: string; score: number }) => [r.move, r.score]))
      
      return moves.map(move => {
        const uci = this.moveToUci(move)
        const score = scoreMap.get(uci)
        if (score === undefined) {
          return {
            move,
            score: -Infinity
          }
        }
        return { move, score }
      })
    } catch (error) {
      console.warn('[ChessBot] Server evaluation failed, using random fallback:', error)
      return moves.map(move => ({
        move,
        score: Math.random() * 10 * (isBlackTurn ? -1 : 1)
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
    
    return this.applyHumanizedSelection(evaluatedMoves, fen, isBlackTurn)
  }

  private applyHumanizedSelection(
    evaluatedMoves: { move: Move; score: number }[],
    fen: string,
    isBlackTurn: boolean
  ): Move {
    if (evaluatedMoves.length === 0) {
      throw new Error('No moves to select from')
    }

    const difficulty = DIFFICULTY[this.config.skillLevel] || DIFFICULTY[4]
    const moveNumber = this.getMoveNumber(fen)
    
    console.log(`[ChessBot:L${this.config.skillLevel}] Move number: ${moveNumber}`)
    
    const sortedMoves = [...evaluatedMoves]
    if (isBlackTurn) {
      sortedMoves.sort((a, b) => a.score - b.score)
    } else {
      sortedMoves.sort((a, b) => b.score - a.score)
    }
    
    console.log(`[ChessBot] All moves ranked:`)
    sortedMoves.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.move.san}: score=${m.score}`)
    })

    const topMoves = sortedMoves.slice(0, Math.min(difficulty.topMoves, sortedMoves.length))
    console.log(`[ChessBot] Top ${topMoves.length} candidates: ${topMoves.map(m => `${m.move.san}(${m.score})`).join(', ')}`)

    const movesWithNoise = this.addNoise(topMoves, difficulty.noise)
    movesWithNoise.sort((a, b) => isBlackTurn ? a.score - b.score : b.score - a.score)
    console.log(`[ChessBot] After noise (sorted): ${movesWithNoise.map(m => `${m.move.san}(${m.score.toFixed(0)})`).join(', ')}`)

    const guardrailMoves = this.applyScoreGuardrail(movesWithNoise, difficulty.maxDrop, isBlackTurn)
    console.log(`[ChessBot] After guardrail (maxDrop=${difficulty.maxDrop}): ${guardrailMoves.map(m => m.move.san).join(', ')}`)

    if (guardrailMoves.length >= 2) {
      const best = guardrailMoves[0]
      const second = guardrailMoves[1]
      const dominanceThreshold = 80
      if (best.score - second.score > dominanceThreshold) {
        console.log(`[ChessBot] DOMINANCE RULE: ${best.move.san} (${best.score})远超 ${second.move.san} (${second.score}), 强制选择`)
        return best.move
      }
    }

    const filteredMoves = this.filterWeirdMoves(guardrailMoves, difficulty.weirdChance, moveNumber)
    console.log(`[ChessBot] After weird filter: ${filteredMoves.map(m => m.move.san).join(', ')}`)

    const blunderMoves = this.maybeInjectBlunder(filteredMoves, difficulty.blunderChance, isBlackTurn)
    if (blunderMoves.length < filteredMoves.length) {
      console.log(`[ChessBot] Blunder injected!`)
    }

    const finalMove = this.softmaxPick(blunderMoves, isBlackTurn)
    console.log(`[ChessBot] SELECTED: ${finalMove.move.san}`)
    return finalMove.move
  }

  private applyScoreGuardrail(
    moves: { move: Move; score: number }[],
    maxDrop: number,
    isBlackTurn: boolean
  ): { move: Move; score: number }[] {
    if (moves.length === 0 || maxDrop >= 1000) {
      return moves
    }

    const bestScore = moves[0].score
    const filtered = moves.filter(m => {
      const drop = isBlackTurn ? m.score - bestScore : bestScore - m.score
      return drop <= maxDrop
    })

    if (filtered.length === 0) {
      return [moves[0]]
    }

    console.log(`[ChessBot] Guardrail filtered ${moves.length - filtered.length} moves (best=${bestScore}, maxDrop=${maxDrop})`)
    return filtered
  }

  private getMoveNumber(fen: string): number {
    try {
      const parts = fen.split(' ')
      return parseInt(parts[5]) || 1
    } catch {
      return 1
    }
  }

  private addNoise(moves: { move: Move; score: number }[], noiseRange: number): { move: Move; score: number }[] {
    if (noiseRange === 0) return moves
    
    return moves.map(m => ({
      ...m,
      score: m.score + (Math.random() * 2 - 1) * noiseRange
    }))
  }

  private filterWeirdMoves(
    moves: { move: Move; score: number }[],
    weirdChance: number,
    moveNumber: number
  ): { move: Move; score: number }[] {
    if (moveNumber > 10) {
      return moves
    }

    return moves.filter(m => {
      if (this.isWeirdMove(m.move.san)) {
        const roll = Math.random()
        if (roll > weirdChance) {
          console.log(`[ChessBot] Filtered weird move: ${m.move.san} (roll=${(roll * 100).toFixed(1)}%, threshold=${(weirdChance * 100).toFixed(1)}%)`)
          return false
        }
        console.log(`[ChessBot] Allowed weird move: ${m.move.san} (roll=${(roll * 100).toFixed(1)}%)`)
      }
      return true
    })
  }

  private isWeirdMove(san: string): boolean {
    const weirdPatterns = [
      'a3', 'h3', 'a4', 'h4',
      'Na3', 'Nh3'
    ]
    
    for (const pattern of weirdPatterns) {
      if (san === pattern || san.startsWith(pattern)) {
        return true
      }
    }
    return false
  }

  private maybeInjectBlunder(
    moves: { move: Move; score: number }[],
    blunderChance: number,
    isBlackTurn: boolean
  ): { move: Move; score: number }[] {
    if (blunderChance <= 0 || moves.length <= 1) {
      return moves
    }

    const roll = Math.random()
    if (roll < blunderChance) {
      const worstCount = Math.min(2, Math.ceil(moves.length / 2))
      const bottomMoves = moves.slice(-worstCount)
      const randomBlunder = bottomMoves[Math.floor(Math.random() * bottomMoves.length)]
      console.log(`[ChessBot] Blunder triggered! Selecting from worst moves: ${bottomMoves.map(m => m.move.san).join(', ')}`)
      return [randomBlunder]
    }
    return moves
  }

  private weightedPick(
    moves: { move: Move; score: number }[],
    weights: number[]
  ): { move: Move; score: number } {
    if (moves.length === 0) {
      throw new Error('No moves to pick from')
    }
    if (moves.length === 1) {
      return moves[0]
    }

    const usableWeights = weights.slice(0, moves.length)
    const total = usableWeights.reduce((a, b) => a + b, 0)
    
    let r = Math.random() * total
    for (let i = 0; i < moves.length; i++) {
      r -= usableWeights[i]
      if (r <= 0) {
        console.log(`[ChessBot] Weighted pick: ${moves[i].move.san} (weight=${usableWeights[i]}, cum=${total - r})`)
        return moves[i]
      }
    }
    
    console.log(`[ChessBot] Weighted pick fallback: ${moves[0].move.san}`)
    return moves[0]
  }

  private softmaxPick(
    moves: { move: Move; score: number }[],
    isBlackTurn: boolean
  ): { move: Move; score: number } {
    if (moves.length === 0) {
      throw new Error('No moves to pick from')
    }
    if (moves.length === 1) {
      return moves[0]
    }

    const temperature = 30
    const maxScore = Math.max(...moves.map(m => m.score))
    const weights = moves.map(m => Math.exp((m.score - maxScore) / temperature))
    const total = weights.reduce((a, b) => a + b, 0)

    let r = Math.random() * total
    for (let i = 0; i < moves.length; i++) {
      r -= weights[i]
      if (r <= 0) {
        console.log(`[ChessBot] Softmax pick: ${moves[i].move.san} (weight=${weights[i].toFixed(2)}, temp=${temperature})`)
        return moves[i]
      }
    }

    console.log(`[ChessBot] Softmax fallback: ${moves[0].move.san}`)
    return moves[0]
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
    let uci = `${move.from}${move.to}`
    if (move.promotion) {
      uci += move.promotion
    }
    return uci
  }

  getConfig(): BotConfig {
    return { ...this.config }
  }

  getSkillDescription(): string {
    return DESCRIPTIONS[this.config.skillLevel] || 'Unknown'
  }
}

export function createBot(config?: Partial<BotConfig>): ChessBot {
  return new ChessBot({
    skillLevel: config?.skillLevel ?? 3,
  })
}
