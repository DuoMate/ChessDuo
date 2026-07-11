import { Chess, Move } from 'chess.js'
import { getBookMove } from './openings'
import { createEvaluator, GameEvaluator } from '../mobile-engine/evaluatorFactory'
import { DIFFICULTY, DESCRIPTIONS, DifficultyConfig } from './difficulty'
import { DEBUG } from '../../lib/debug'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

export interface BotConfig {
  skillLevel: number
  mockMoveEvaluator?: any
}

export class ChessBot {
  private config: BotConfig
  private moveEvaluator: GameEvaluator | null = null

  constructor(config: BotConfig = { skillLevel: 3 }) {
    this.config = config
    
    if (config.mockMoveEvaluator) {
      this.moveEvaluator = config.mockMoveEvaluator
      return
    }
    
    this.moveEvaluator = createEvaluator(SERVER_URL)
    if (!this.moveEvaluator.isUsingStockfish()) {
      console.warn('[ChessBot] No evaluator configured, bot will use fallback evaluation')
    }
  }

  isStockfishReady(): boolean {
    return this.moveEvaluator?.isUsingStockfish() ?? false
  }

  getEvaluator(): GameEvaluator | null {
    return this.moveEvaluator
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
          DEBUG && console.log(`[ChessBot:Opening Book] Move: ${bookMove}`)
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

  async selectBestMove(fen: string): Promise<string | null> {
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
      console.error('[ChessBot:Best] Move selection failed:', error)
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
      DEBUG && console.log(`[ChessBot:L${this.config.skillLevel}] Only one move available: ${moves[0].san}`)
      return moves[0]
    }
    
    const evalStart = Date.now()
    
    DEBUG && console.log(`\n${'='.repeat(60)}`)
    DEBUG && console.log(`[ChessBot:L${this.config.skillLevel}] ${DESCRIPTIONS[this.config.skillLevel]}`)
    DEBUG && console.log(`[ChessBot] FEN: ${fen}`)
    DEBUG && console.log(`[ChessBot] Evaluating ${moves.length} moves with full-strength Stockfish`)
    DEBUG && console.log(`[ChessBot] Config: noise=${difficulty.noise}, topMoves=${difficulty.topMoves}, blunderChance=${difficulty.blunderChance}, weirdChance=${difficulty.weirdChance}`)

    try {
      const evaluatedMoves = await this.evaluateMovesWithFallback(moves, fen)
      const selectedMove = this.applyHumanizedSelection(evaluatedMoves, fen, isBlackTurn)
      DEBUG && console.log(`${'='.repeat(60)}\n`)
      return selectedMove
    } catch (error) {
      DEBUG && console.log(`[ChessBot] ERROR: ${error}`)
      DEBUG && console.log(`[ChessBot] Falling back to first move`)
      DEBUG && console.log(`${'='.repeat(60)}\n`)
      return moves[0]
    }
  }

  private async evaluateMovesWithFallback(moves: Move[], fen: string): Promise<{ move: Move; score: number }[]> {
    const isBlackTurn = new Chess(fen).turn() === 'b'
    const difficulty = DIFFICULTY[this.config.skillLevel] || DIFFICULTY[4]
    const topMovesLimit = difficulty.topMoves
    
    const uciMoves = moves.map(m => this.moveToUci(m))
    const movesToEvaluate = uciMoves
    
    try {
      const results = await this.moveEvaluator.evaluateMoves(movesToEvaluate, fen, difficulty.depth, difficulty.elo)

      // Detect unexamined moves: the server returns score=0 for moves
      // that were not in Stockfish's MultiPV output (default fallback).
      // After normalization, these float above real scores (which went
      // from negative to positive for the disadvantaged side), causing
      // the bot to pick junk. Push them to the bottom via sentinel.
      const hasRealScores = results.some(r => r.score !== 0)
      const effectiveResults = results.map(r => ({
        move: r.move,
        score: hasRealScores && r.score === 0 ? -99999 : r.score
      }))

      const normalizedResults = effectiveResults.map(r => ({
        move: r.move,
        score: isBlackTurn ? -r.score : r.score
      }))
      const scoreMap = new Map<string, number>(normalizedResults.map((r: { move: string; score: number }) => [r.move, r.score]))
      
      const evaluatedMoves: { move: Move; score: number }[] = []
      const unevaluatedMoves: Move[] = []
      
      for (const move of moves) {
        const uci = this.moveToUci(move)
        const score = scoreMap.get(uci)
        if (score !== undefined) {
          evaluatedMoves.push({ move, score })
        } else {
          unevaluatedMoves.push(move)
        }
      }
      
      const fallbackForUnevaluated = unevaluatedMoves.map(move => {
        const chess = new Chess(fen)
        try {
          chess.move(move)
          const score = this.fallbackEvaluate(chess.fen())
          return { move, score }
        } catch {
          return { move, score: isBlackTurn ? Infinity : -Infinity }
        }
      })
      
      return [...evaluatedMoves, ...fallbackForUnevaluated]
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
    
    DEBUG && console.log(`[ChessBot:L${this.config.skillLevel}] Move number: ${moveNumber}`)
    
    const sortedMoves = [...evaluatedMoves]
    if (isBlackTurn) {
      sortedMoves.sort((a, b) => a.score - b.score)
    } else {
      sortedMoves.sort((a, b) => b.score - a.score)
    }
    
    DEBUG && console.log(`[ChessBot] All moves ranked:`)
    sortedMoves.forEach((m, i) => {
      DEBUG && console.log(`  ${i + 1}. ${m.move.san}: score=${m.score}`)
    })

    const validMoves = sortedMoves.filter(m => isFinite(m.score))
    DEBUG && console.log(`[ChessBot] Filtered ${sortedMoves.length - validMoves.length} unevaluated moves (score=±Infinity)`)

    if (validMoves.length === 0) {
      throw new Error('No valid moves to select from')
    }

    const topMoves = validMoves.slice(0, Math.min(difficulty.topMoves, validMoves.length))
    DEBUG && console.log(`[ChessBot] Top ${topMoves.length} candidates: ${topMoves.map(m => `${m.move.san}(${m.score})`).join(', ')}`)

    const movesWithNoise = this.addNoise(topMoves, difficulty.noise)
    movesWithNoise.sort((a, b) => isBlackTurn ? a.score - b.score : b.score - a.score)
    DEBUG && console.log(`[ChessBot] After noise (sorted): ${movesWithNoise.map(m => `${m.move.san}(${m.score.toFixed(0)})`).join(', ')}`)

    const guardrailMoves = this.applyScoreGuardrail(movesWithNoise, difficulty.maxDrop, isBlackTurn)
    DEBUG && console.log(`[ChessBot] After guardrail (maxDrop=${difficulty.maxDrop}): ${guardrailMoves.map(m => m.move.san).join(', ')}`)

    if (guardrailMoves.length >= 2) {
      const best = guardrailMoves[0]
      const second = guardrailMoves[1]
      const dominanceThreshold = 80
      if (Math.abs(best.score - second.score) > dominanceThreshold) {
        DEBUG && console.log(`[ChessBot] DOMINANCE RULE: ${best.move.san} (${best.score})远超 ${second.move.san} (${second.score}), 强制选择`)
        return best.move
      }
    }

    const filteredMoves = this.filterWeirdMoves(guardrailMoves, difficulty.weirdChance, moveNumber)
    DEBUG && console.log(`[ChessBot] After weird filter: ${filteredMoves.map(m => m.move.san).join(', ')}`)

    const blunderMoves = this.maybeInjectBlunder(filteredMoves, difficulty.blunderChance, isBlackTurn)
    if (blunderMoves.length < filteredMoves.length) {
      DEBUG && console.log(`[ChessBot] Blunder injected!`)
    }

    const finalMove = this.softmaxPick(blunderMoves, isBlackTurn)
    DEBUG && console.log(`[ChessBot] SELECTED: ${finalMove.move.san}`)
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

    DEBUG && console.log(`[ChessBot] Guardrail filtered ${moves.length - filtered.length} moves (best=${bestScore}, maxDrop=${maxDrop})`)
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
          DEBUG && console.log(`[ChessBot] Filtered weird move: ${m.move.san} (roll=${(roll * 100).toFixed(1)}%, threshold=${(weirdChance * 100).toFixed(1)}%)`)
          return false
        }
        DEBUG && console.log(`[ChessBot] Allowed weird move: ${m.move.san} (roll=${(roll * 100).toFixed(1)}%)`)
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
      DEBUG && console.log(`[ChessBot] Blunder triggered! Selecting from worst moves: ${bottomMoves.map(m => m.move.san).join(', ')}`)
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
        DEBUG && console.log(`[ChessBot] Weighted pick: ${moves[i].move.san} (weight=${usableWeights[i]}, cum=${total - r})`)
        return moves[i]
      }
    }
    
    DEBUG && console.log(`[ChessBot] Weighted pick fallback: ${moves[0].move.san}`)
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
    const scores = moves.map(m => isBlackTurn ? -m.score : m.score)
    const maxScore = Math.max(...scores)
    const weights = scores.map(s => Math.exp((s - maxScore) / temperature))
    const total = weights.reduce((a, b) => a + b, 0)

    let r = Math.random() * total
    for (let i = 0; i < moves.length; i++) {
      r -= weights[i]
      if (r <= 0) {
        DEBUG && console.log(`[ChessBot] Softmax pick: ${moves[i].move.san} (weight=${weights[i].toFixed(2)}, temp=${temperature})`)
        return moves[i]
      }
    }

    DEBUG && console.log(`[ChessBot] Softmax fallback: ${moves[0].move.san}`)
    return moves[0]
  }

  private evaluateMovesSync(moves: Move[], fen: string): { move: Move; score: number }[] {
    const results: { move: Move; score: number }[] = []
    
    const turn = new Chess(fen).turn()
    
    for (const move of moves) {
      try {
        const chess = new Chess(fen)
        chess.move(move)
        
        const score = this.fallbackEvaluate(chess.fen())
        results.push({ move, score })
      } catch {
        results.push({ move, score: turn === 'b' ? Infinity : -Infinity })
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

  setSkillLevel(level: number): void {
    this.config.skillLevel = Math.max(1, Math.min(6, level))
  }
}

export function createBot(config?: Partial<BotConfig>): ChessBot {
  return new ChessBot({
    skillLevel: config?.skillLevel ?? 3,
    ...(config?.mockMoveEvaluator ? { mockMoveEvaluator: config.mockMoveEvaluator } : {}),
  })
}
