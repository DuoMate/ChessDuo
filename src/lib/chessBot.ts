import { Chess, Move } from 'chess.js'
import { getBookMove } from './openings'
import { ServerMoveEvaluator } from './serverMoveEvaluator'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

export interface BotConfig {
  skillLevel: number
  mockMoveEvaluator?: any
}

const ELO_MAPPING: Record<number, { bestMoveChance: number; description: string; searchDepth: number; topMovesRandom?: number }> = {
  1: { bestMoveChance: 0.55, description: 'Beginner ~1000 ELO', searchDepth: 1, topMovesRandom: 10 },
  2: { bestMoveChance: 0.68, description: 'Novice ~1500 ELO', searchDepth: 2, topMovesRandom: 7 },
  3: { bestMoveChance: 0.83, description: 'Intermediate ~1800 ELO', searchDepth: 3, topMovesRandom: 5 },
  4: { bestMoveChance: 0.88, description: 'Advanced ~2000 ELO', searchDepth: 4, topMovesRandom: 3 },
  5: { bestMoveChance: 0.93, description: 'Expert ~2200 ELO', searchDepth: 5, topMovesRandom: 2 },
  6: { bestMoveChance: 0.99, description: 'Master ~2600 ELO', searchDepth: 10, topMovesRandom: 1 },
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
    const isBlackTurn = new Chess(fen).turn() === 'b'
    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[4]
    
    if (moves.length === 1) {
      console.log(`[ChessBot:L${this.config.skillLevel}] Only one move available: ${moves[0].san}`)
      return moves[0]
    }

    const evaluatedMoves: { move: Move; score: number }[] = []
    const uciMoves = moves.map(m => this.moveToUci(m))
    const evalStart = Date.now()
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[ChessBot:L${this.config.skillLevel}] ${skillConfig.description}`)
    console.log(`[ChessBot] FEN: ${fen}`)
    console.log(`[ChessBot] isBlackTurn: ${isBlackTurn}, Evaluating ${moves.length} moves`)

    try {
      const results: { move: string; score: number }[] = await this.moveEvaluator.evaluateMoves(uciMoves, fen)
      const serverTime = Date.now() - evalStart
      console.log(`[ChessBot] Server response: ${serverTime}ms for ${moves.length} moves`)
      
      const scoreMap = new Map(results.map((r: { move: string; score: number }) => [r.move, r.score]))
      
      for (const move of moves) {
        const uci = this.moveToUci(move)
        const score = scoreMap.get(uci) ?? (isBlackTurn ? Infinity : -Infinity)
        evaluatedMoves.push({ move, score })
      }
    } catch (error) {
      console.log(`[ChessBot] ERROR: ${error}`)
      for (const move of moves) {
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
    
    const totalEvalTime = Date.now() - evalStart
    console.log(`[ChessBot] All ${evaluatedMoves.length} moves ranked:`)
    evaluatedMoves.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.move.san}: score=${m.score}`)
    })

    const topMovesDisplay = evaluatedMoves.slice(0, Math.min(5, evaluatedMoves.length))
      .map((m, i) => `${i + 1}. ${m.move.san}(${m.score})`)
      .join(' | ')
    console.log(`[ChessBot] Top 5: ${topMovesDisplay}`)

    const selectedMove = this.applyEloBasedSelection(evaluatedMoves)
    const selectedScore = evaluatedMoves.find(m => m.move.san === selectedMove.san)?.score
    console.log(`[ChessBot] SELECTED: ${selectedMove.san} (score=${selectedScore}, totalTime=${totalEvalTime}ms)`)
    console.log(`${'='.repeat(60)}\n`)
    
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
    if (evaluatedMoves.length === 0) {
      throw new Error('No moves to select from')
    }

    const skillConfig = ELO_MAPPING[this.config.skillLevel] || ELO_MAPPING[4]
    const bestMoveChance = skillConfig.bestMoveChance
    const topMovesRandom = skillConfig.topMovesRandom || 3

    console.log(`[ChessBot:L${this.config.skillLevel}] Selection logic: bestMoveChance=${(bestMoveChance * 100).toFixed(0)}%, topMovesRandom=${topMovesRandom}`)

    let filteredMoves = this.filterSuspiciousMoves(evaluatedMoves)
    if (filteredMoves.length < evaluatedMoves.length) {
      console.log(`[ChessBot:L${this.config.skillLevel}] Filtered ${evaluatedMoves.length - filteredMoves.length} suspicious moves`)
    }

    const roll = Math.random()
    console.log(`[ChessBot:L${this.config.skillLevel}] Dice roll: ${(roll * 100).toFixed(1)}% (threshold: ${(bestMoveChance * 100).toFixed(0)}%)`)

    if (roll < bestMoveChance) {
      const best = filteredMoves[0]
      const safetyCheck = this.validateMove(best.move)
      if (safetyCheck.safe) {
        console.log(`[ChessBot:L${this.config.skillLevel}] → Selected BEST move: ${best.move.san} (score=${best.score}) ✓`)
        return best.move
      }
      console.log(`[ChessBot:L${this.config.skillLevel}] Best move UNSAFE: ${best.move.san} - ${safetyCheck.reason}`)
    } else {
      console.log(`[ChessBot:L${this.config.skillLevel}] → Rolling for random move from top ${topMovesRandom}`)
    }

    const topCount = Math.min(topMovesRandom, filteredMoves.length)
    const topMoves = filteredMoves.slice(0, topCount)
    const randomIndex = Math.floor(Math.random() * topMoves.length)
    const selected = topMoves[randomIndex]

    console.log(`[ChessBot:L${this.config.skillLevel}] Random pool: ${topMoves.map(m => `${m.move.san}(${m.score})`).join(', ')}`)
    console.log(`[ChessBot:L${this.config.skillLevel}] Random picked: index ${randomIndex} → ${selected.move.san}`)

    const safetyCheck = this.validateMove(selected.move)
    if (safetyCheck.safe) {
      console.log(`[ChessBot:L${this.config.skillLevel}] → Selected RANDOM move: ${selected.move.san} (score=${selected.score}) ✓`)
      return selected.move
    }

    console.log(`[ChessBot:L${this.config.skillLevel}] Random pick UNSAFE: ${selected.move.san} - ${safetyCheck.reason}`)
    console.log(`[ChessBot:L${this.config.skillLevel}] → Falling back to best: ${filteredMoves[0].move.san}`)
    return filteredMoves[0].move
  }

  private validateMove(move: Move): { safe: boolean; reason: string } {
    if (!move.flags || move.flags.includes('e') || move.promotion) {
      return { safe: true, reason: 'ep/promo' }
    }

    if (move.captured) {
      return this.validateCapture(move)
    }

    const chess = new Chess()
    try {
      chess.load(move.before)
      const isWhite = chess.turn() === 'b'
      const myPieces = isWhite ? 'PNBRQK' : 'pnbrqk'
      const oppPieces = isWhite ? 'pnbrqk' : 'PNBRQK'

      const pieceValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
      const movingPieceValue = pieceValue[move.piece.toLowerCase()]

      for (const possibleCapture of chess.moves({ verbose: true })) {
        if ((possibleCapture.flags.includes('c') || possibleCapture.flags.includes('e')) && possibleCapture.to === move.to) {
          const capturingPiece = possibleCapture.piece
          if (oppPieces.includes(capturingPiece)) {
            const capturerValue = pieceValue[capturingPiece.toLowerCase()]
            if (capturerValue >= movingPieceValue) {
              if (!this.isProtected(chess, move.to, isWhite)) {
                return { safe: false, reason: 'capture loses piece' }
              }
            }
          }
        }
      }

      if (this.createsPin(chess, move, isWhite)) {
        return { safe: false, reason: 'creates pin' }
      }

      return { safe: true, reason: 'safe' }
    } catch {
      return { safe: true, reason: 'safe' }
    }
  }

  private validateCapture(move: Move): { safe: boolean; reason: string } {
    const chess = new Chess()
    try {
      chess.load(move.before)
      const isWhite = chess.turn() === 'b'
      
      chess.move({ from: move.from, to: move.to, promotion: move.promotion })
      
      const captures = chess.moves({ verbose: true })
        .filter(m => m.flags.includes('c') && m.to === move.to && m.piece.toLowerCase() !== 'p')
      
      if (captures.length > 0) {
        const capturer = captures[0].piece
        const pieceValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
        const capturedValue = pieceValue[move.captured!.toLowerCase()]
        const capturerValue = pieceValue[capturer.toLowerCase()]
        
        if (capturerValue > capturedValue) {
          return { safe: true, reason: 'winning capture' }
        }
        
        const recaptures = chess.moves({ verbose: true })
          .filter(m => m.flags.includes('c') && m.to === move.to)
        
        if (recaptures.length > 0) {
          const recapturer = recaptures[0].piece
          const recapturerValue = pieceValue[recapturer.toLowerCase()]
          if (recapturerValue >= capturerValue) {
            return { safe: false, reason: 'capture loses material' }
          }
        }
        
        if (!this.isPositionSafe(chess, isWhite)) {
          return { safe: false, reason: 'capture leads to tactics' }
        }
        
        return { safe: true, reason: 'equal capture' }
      }
      
      return { safe: true, reason: 'safe capture' }
    } catch {
      return { safe: true, reason: 'safe' }
    }
  }

  private isProtected(chess: Chess, square: string, byWhite: boolean): boolean {
    const moves = chess.moves({ verbose: true })
    const protectors = byWhite ? 'PNBRQK' : 'pnbrqk'
    
    for (const move of moves) {
      if (protectors.includes(move.piece) && move.to === square) {
        return true
      }
    }
    return false
  }

  private isPositionSafe(chess: Chess, isWhite: boolean): boolean {
    const moves = chess.moves({ verbose: true })
    const ourKing = isWhite ? 'k' : 'K'
    const kingSquare = chess.board().flat().find(p => p?.type === ourKing[0] && p?.color === (isWhite ? 'w' : 'b'))?.square
    
    if (!kingSquare) return true
    
    for (const move of moves) {
      if ((move.flags.includes('c') || move.flags.includes('e'))) {
        if (move.to === kingSquare) {
          return false
        }
      }
    }
    
    return true
  }

  private createsPin(chess: Chess, move: Move, isWhite: boolean): boolean {
    const chessCopy = new Chess()
    chessCopy.load(move.before)
    chessCopy.move({ from: move.from, to: move.to, promotion: move.promotion })
    
    const ourKing = isWhite ? 'K' : 'k'
    const ourKingSquare = chessCopy.board().flat().find(p => p?.type === ourKing && p?.color === (isWhite ? 'w' : 'b'))?.square
    
    if (!ourKingSquare) return false
    
    const enemyPieces = isWhite ? 'rnbqp' : 'RNBQP'
    const enemyMoves = chessCopy.moves({ verbose: true }).filter(m => enemyPieces.includes(m.piece))
    
    for (const enemyMove of enemyMoves) {
      if (enemyMove.flags.includes('c')) {
        const pathToKing = this.getRayPath(enemyMove.from, ourKingSquare)
        if (pathToKing.includes(move.to)) {
          const betweenKing = pathToKing.slice(0, pathToKing.indexOf(move.to))
          const hasBlocker = betweenKing.some(sq => 
            chessCopy.board().flat().some(p => p?.square === sq && p?.type !== ourKing[0])
          )
          if (!hasBlocker) {
            return true
          }
        }
      }
    }
    
    return false
  }

  private getRayPath(from: string, to: string): string[] {
    const files = 'abcdefgh'
    const fromFile = files.indexOf(from[0])
    const fromRank = parseInt(from[1]) - 1
    const toFile = files.indexOf(to[0])
    const toRank = parseInt(to[1]) - 1
    
    const path: string[] = []
    const dFile = Math.sign(toFile - fromFile)
    const dRank = Math.sign(toRank - fromRank)
    
    if (dFile !== 0 && dRank !== 0 && Math.abs(toFile - fromFile) !== Math.abs(toRank - fromRank)) {
      return path
    }
    
    let f = fromFile + dFile
    let r = fromRank + dRank
    
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7 && !(f === toFile && r === toRank)) {
      path.push(files[f] + (r + 1))
      f += dFile
      r += dRank
    }
    
    return path
  }

  private filterSuspiciousMoves(
    evaluatedMoves: { move: Move; score: number }[],
  ): { move: Move; score: number }[] {
    if (evaluatedMoves.length === 0) return evaluatedMoves

    const isSuspiciousMove = (m: Move): boolean => {
      if (m.captured || !m.flags || m.flags.includes('e') || m.promotion) {
        return false
      }

      const piece = m.piece
      const toFile = m.to[0]
      const toRank = m.to[1]
      const fromFile = m.from[0]

      if (piece === 'n') {
        if ((toFile === 'a' || toFile === 'h') && (toRank === '1' || toRank === '8')) {
          return true
        }
        return false
      }

      if (piece === 'b') {
        if ((fromFile === 'a' || fromFile === 'h') && (toFile === 'a' || toFile === 'h')) {
          return true
        }
        if ((toFile === 'a' || toFile === 'h') && (toRank === '1' || toRank === '8')) {
          return true
        }
        return false
      }

      return false
    }

    const filtered = evaluatedMoves.filter(m => !isSuspiciousMove(m.move))

    if (filtered.length === 0) {
      return evaluatedMoves
    }

    return filtered
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
