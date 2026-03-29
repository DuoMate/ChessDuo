import { Chess } from 'chess.js'

export interface MoveEvaluation {
  move: string
  score: number
  centipawnLoss?: number
}

export interface MoveComparison {
  move1: string
  move2: string
  score1: number
  score2: number
  winner: string
  centipawnLoss: number
}

export class MoveEvaluator {
  private stockfishReady: boolean = false
  private stockfishWorker: Worker | null = null
  private initPromise: Promise<boolean> | null = null
  private searchDepth: number = 10

  constructor(searchDepth: number = 10) {
    this.searchDepth = Math.max(1, Math.min(searchDepth, 20))
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      this.initPromise = this.initStockfish()
    }
  }

  setSearchDepth(depth: number): void {
    this.searchDepth = Math.max(1, Math.min(depth, 20))
  }

  getSearchDepth(): number {
    return this.searchDepth
  }

  private async initStockfish(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      console.log('[Stockfish] Skipped: No window or Worker support')
      return false
    }
    
    try {
      console.log('[Stockfish] Creating worker...')
      this.stockfishWorker = new Worker('/stockfish/stockfish.js')
      console.log('[Stockfish] Worker created:', this.stockfishWorker)
      
      const readyPromise = new Promise<boolean>((resolve) => {
        const messageHandler = (e: MessageEvent) => {
          const msg = e.data
          console.log('[Stockfish] Message received:', JSON.stringify(msg))
          if (msg === 'uciok') {
            this.stockfishReady = true
            this.stockfishWorker?.removeEventListener('message', messageHandler)
            console.log('[Stockfish] Ready!')
            resolve(true)
          }
        }
        this.stockfishWorker?.addEventListener('message', messageHandler)
        console.log('[Stockfish] Message handler attached')
      })

      this.stockfishWorker.addEventListener('error', (e) => {
        console.error('[Stockfish] Worker error:', e)
      })
      
      console.log('[Stockfish] Sending uci command...')
      this.stockfishWorker.postMessage('uci')
      
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.warn('[Stockfish] Timeout after 5s')
          resolve(false)
        }, 5000)
      })

      return Promise.race([readyPromise, timeoutPromise])
    } catch (error) {
      console.warn('[Stockfish] Failed:', error)
      return false
    }
  }

  private async ensureStockfishReady(): Promise<boolean> {
    console.log('[Stockfish] ensureStockfishReady called, ready:', this.stockfishReady)
    if (this.stockfishReady) return true
    if (this.initPromise) {
      return this.initPromise
    }
    return false
  }

  isUsingStockfish(): boolean {
    return this.stockfishReady
  }

  isReady(): boolean {
    return this.stockfishReady || this.initPromise === null
  }

  async evaluateMove(move: string, fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    
    try {
      const turnBeforeMove = chess.turn()
      chess.move(move)
      const newFen = chess.fen()
      chess.undo()
      
      let score = await this.getEngineScore(newFen)
      
      if (turnBeforeMove === 'b') {
        score = -score
      }
      
      return {
        move,
        score
      }
    } catch {
      return {
        move,
        score: -Infinity
      }
    }
  }

  async compareMoves(
    move1: string,
    move2: string,
    fen: string
  ): Promise<MoveComparison> {
    const eval1 = await this.evaluateMove(move1, fen)
    const eval2 = await this.evaluateMove(move2, fen)

    if (move1 === move2) {
      return {
        move1,
        move2,
        score1: eval1.score,
        score2: eval2.score,
        winner: 'draw',
        centipawnLoss: 0
      }
    }

    let winner: string
    if (eval1.score === -Infinity && eval2.score === -Infinity) {
      winner = 'draw'
    } else if (eval1.score === -Infinity) {
      winner = move2
    } else if (eval2.score === -Infinity) {
      winner = move1
    } else if (eval1.score > eval2.score) {
      winner = move1
    } else if (eval2.score > eval1.score) {
      winner = move2
    } else {
      winner = move1
    }

    const centipawnLoss = Math.abs(eval1.score - eval2.score)

    return {
      move1,
      move2,
      score1: eval1.score,
      score2: eval2.score,
      winner,
      centipawnLoss
    }
  }

  async getBestScore(fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    const moves = chess.moves()
    
    if (moves.length === 0) {
      return { move: '', score: 0 }
    }

    let bestMove = moves[0]
    let bestScore = -Infinity

    for (const move of moves) {
      const evalResult = await this.evaluateMove(move, fen)
      if (evalResult.score > bestScore) {
        bestScore = evalResult.score
        bestMove = move
      }
    }

    return {
      move: bestMove,
      score: bestScore
    }
  }

  private async getEngineScore(fen: string): Promise<number> {
    const chess = new Chess(fen)
    
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        return chess.turn() === 'w' ? -10000 : 10000
      }
      return 0
    }

    const isReady = await this.ensureStockfishReady()
    let score: number
    
    if (isReady && this.stockfishWorker) {
      try {
        const stockfishScore = await this.evaluateWithStockfish(fen)
        if (stockfishScore !== null) {
          score = stockfishScore
        } else {
          console.log('[Eval] Stockfish returned null, falling back to simple')
          score = this.simpleEvaluate(fen)
        }
      } catch (error) {
        console.warn('[Stockfish] Evaluation failed, using simple eval:', error)
        score = this.simpleEvaluate(fen)
      }
    } else {
      console.log('[Eval] Stockfish not ready, using simple evaluation')
      score = this.simpleEvaluate(fen)
    }

    return score
  }

  private evaluateWithStockfish(fen: string): Promise<number | null> {
    return new Promise((resolve) => {
      if (!this.stockfishReady || !this.stockfishWorker) {
        console.log('[Stockfish] evaluateWithStockfish: not ready, worker:', this.stockfishWorker, 'ready:', this.stockfishReady)
        resolve(null)
        return
      }

      console.log('[Stockfish] evaluateWithStockfish: evaluating FEN:', fen)
      const timeout = setTimeout(() => {
        console.log('[Stockfish] evaluateWithStockfish: timeout')
        resolve(null)
      }, 3000)

      const messageHandler = (e: MessageEvent) => {
        const line = e.data
        console.log('[Stockfish] eval message:', line)
        if (line && typeof line === 'string' && line.startsWith('info') && line.includes('score cp')) {
          const match = line.match(/score cp (-?\d+)/)
          if (match) {
            const score = parseInt(match[1], 10)
            clearTimeout(timeout)
            this.stockfishWorker?.removeEventListener('message', messageHandler)
            console.log('[Stockfish] eval score:', score)
            resolve(score)
          }
        } else if (line && typeof line === 'string' && line.startsWith('bestmove')) {
          clearTimeout(timeout)
          this.stockfishWorker?.removeEventListener('message', messageHandler)
          console.log('[Stockfish] eval bestmove received')
          resolve(null)
        }
      }

      this.stockfishWorker!.addEventListener('message', messageHandler)
      this.stockfishWorker!.postMessage(`position fen ${fen}`)
      console.log(`[Stockfish] Evaluating at depth ${this.searchDepth}`)
      this.stockfishWorker!.postMessage(`go depth ${this.searchDepth}`)
    })
  }

  private simpleEvaluate(fen: string): number {
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
          const positionBonus = this.getPositionBonus(piece, row, col)
          score += (value + positionBonus) * multiplier
        }
      }
    }

    if (chess.isCheck()) {
      score += chess.turn() === 'w' ? -50 : 50
    }

    const mobilityScore = this.getMobilityScore(chess)
    score += mobilityScore

    return score
  }

  private getPositionBonus(piece: { type: string; color: 'w' | 'b' }, row: number, col: number): number {
    const pawnBonus: number[][] = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5, -10,  0,  0, -10, -5,  5],
      [5, 10, 10, -20, -20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ]

    const knightBonus: number[][] = [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20,  0,  0,  0,  0, -20, -40],
      [-30,  0, 10, 15, 15, 10,  0, -30],
      [-30,  5, 15, 20, 20, 15,  5, -30],
      [-30,  0, 15, 20, 20, 15,  0, -30],
      [-30,  5, 10, 15, 15, 10,  5, -30],
      [-40, -20,  0,  5,  5,  0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50]
    ]

    const bishopBonus: number[][] = [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10,  0,  0,  0,  0,  0,  0, -10],
      [-10,  0,  5, 10, 10,  5,  0, -10],
      [-10,  5,  5, 10, 10,  5,  5, -10],
      [-10,  0, 10, 10, 10, 10,  0, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10,  5,  0,  0,  0,  0,  5, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20]
    ]

    const rookBonus: number[][] = [
      [0,  0,  0,  0,  0, 0, 0, 0],
      [5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [0,  0,  0,  5,  5,  0,  0,  0]
    ]

    const queenBonus: number[][] = [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10,  0,  0,  0,  0,  0,  0, -10],
      [-10,  0,  5,  5,  5,  5,  0, -10],
      [-5,  0,  5,  5,  5,  5,  0, -5],
      [0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0, -10],
      [-10,  0,  5,  0,  0,  0,  0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20]
    ]

    const kingBonus: number[][] = [
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [20, 20,  0,  0,  0,  0, 20, 20],
      [20, 30, 10,  0,  0, 10, 30, 20]
    ]

    const isBlack = piece.color === 'b'
    let adjustedRow = isBlack ? row : 7 - row

    switch (piece.type) {
      case 'p': return pawnBonus[adjustedRow][col]
      case 'n': return knightBonus[adjustedRow][col]
      case 'b': return bishopBonus[adjustedRow][col]
      case 'r': return rookBonus[adjustedRow][col]
      case 'q': return queenBonus[adjustedRow][col]
      case 'k': return kingBonus[adjustedRow][col]
      default: return 0
    }
  }

  private getMobilityScore(chess: Chess): number {
    const moves = chess.moves()
    const baseMobility = moves.length * 5
    
    if (chess.turn() === 'w') {
      return baseMobility
    } else {
      return -baseMobility
    }
  }
}
