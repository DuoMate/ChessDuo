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
  private searchDepth: number = 8
  private skillLevel: number = 4
  
  private evaluationQueue: Array<{
    fen: string
    resolve: (score: number) => void
    reject: (error: Error) => void
  }> = []
  
  private isProcessing: boolean = false
  private currentHandler: ((e: MessageEvent) => void) | null = null

  constructor(skillLevel: number = 4) {
    this.skillLevel = Math.max(1, Math.min(skillLevel, 6))
    this.searchDepth = this.getDepthForSkill(skillLevel)
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      this.initPromise = this.initStockfish()
    }
  }

  private getDepthForSkill(skillLevel: number): number {
    if (skillLevel <= 2) return 8
    if (skillLevel <= 4) return 12
    return 15
  }

  private getMoveTimeForSkill(): number {
    if (this.skillLevel <= 2) return 2000
    if (this.skillLevel <= 4) return 4000
    return 6000
  }

  setSearchDepth(depth: number): void {
    this.searchDepth = Math.max(1, Math.min(depth, 20))
  }

  getSearchDepth(): number {
    return this.searchDepth
  }

  private async initStockfish(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return false
    }
    
    try {
      this.stockfishWorker = new Worker('/stockfish/stockfish.js')
      
      const readyPromise = new Promise<boolean>((resolve) => {
        const handler = (e: MessageEvent) => {
          const msg = e.data
          if (msg === 'uciok') {
            this.stockfishWorker?.removeEventListener('message', handler)
            resolve(true)
          }
        }
        this.stockfishWorker?.addEventListener('message', handler)
      })

      this.stockfishWorker.addEventListener('error', (e) => {
        console.error('[Stockfish] Worker error:', e)
      })
      
      this.stockfishWorker.postMessage('uci')
      
      const uciReady = await readyPromise
      if (uciReady) {
        this.stockfishWorker?.postMessage(`setoption name Skill Level value ${this.getStockfishSkill()}`)
        await new Promise(r => setTimeout(r, 100))
        this.stockfishReady = true
        console.log('[Stockfish] Initialization complete')
      }
      
      return uciReady
    } catch (e) {
      console.error('[Stockfish] Initialization failed:', e)
      return false
    }
  }

  private getStockfishSkill(): number {
    const skillMap: Record<number, number> = {
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 19,
      6: 20
    }
    return skillMap[this.skillLevel] || 10
  }

  private async ensureStockfishReady(): Promise<boolean> {
    if (this.stockfishReady) return true
    if (this.initPromise) {
      const result = await this.initPromise
      return result
    }
    return false
  }

  isUsingStockfish(): boolean {
    return this.stockfishReady
  }

  isReady(): boolean {
    return this.stockfishReady
  }

  async evaluateMove(move: string, fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    
    chess.move(move)
    const newFen = chess.fen()
    chess.undo()
    
    const score = await this.getEngineScore(newFen)
    
    return {
      move,
      score
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
    if (eval1.score > eval2.score) {
      winner = move1
    } else if (eval2.score > eval1.score) {
      winner = move2
    } else {
      winner = move1
    }

    return {
      move1,
      move2,
      score1: eval1.score,
      score2: eval2.score,
      winner,
      centipawnLoss: Math.abs(eval1.score - eval2.score)
    }
  }

  async getBestScore(fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    const moves = chess.moves()
    const isBlackTurn = chess.turn() === 'b'
    
    if (moves.length === 0) {
      return { move: '', score: 0 }
    }

    if (moves.length === 1) {
      return { move: moves[0], score: 0 }
    }

    const score = await this.getEngineScore(fen)
    let bestMove = moves[0]
    
    for (const move of moves) {
      try {
        const evalResult = await this.evaluateMove(move, fen)
        if (isBlackTurn) {
          if (evalResult.score < score) {
            return { move, score: evalResult.score }
          }
        } else {
          if (evalResult.score > score) {
            return { move, score: evalResult.score }
          }
        }
      } catch {
      }
    }

    return { move: bestMove, score }
  }

  private processQueue(): void {
    if (this.isProcessing || this.evaluationQueue.length === 0) {
      return
    }

    const item = this.evaluationQueue.shift()
    if (!item) return

    this.isProcessing = true
    this.executeEvaluation(item.fen, item.resolve, item.reject)
  }

  private executeEvaluation(
    fen: string, 
    resolve: (score: number) => void, 
    reject: (error: Error) => void
  ): void {
    if (!this.stockfishWorker) {
      reject(new Error('Stockfish worker not available'))
      this.isProcessing = false
      this.processQueue()
      return
    }

    const moveTime = this.getMoveTimeForSkill()
    let lastScore: number | null = null
    let resolved = false

    const messageHandler = (e: MessageEvent) => {
      const line = e.data
      
      if (typeof line !== 'string' || resolved) return

      if (line.includes('score cp')) {
        const match = line.match(/score cp (-?\d+)/)
        if (match) {
          lastScore = parseInt(match[1], 10)
        }
      }
      
      if (line.includes('score mate')) {
        const match = line.match(/score mate (-?\d+)/)
        if (match) {
          const mateIn = parseInt(match[1], 10)
          lastScore = mateIn > 0 ? 10000 : -10000
        }
      }
      
      if (line.startsWith('bestmove')) {
        resolved = true
        
        if (this.currentHandler) {
          this.stockfishWorker?.removeEventListener('message', this.currentHandler)
          this.currentHandler = null
        }
        clearTimeout(timeout)
        
        if (lastScore !== null) {
          resolve(lastScore)
        } else {
          resolve(0)
        }
        
        this.isProcessing = false
        setTimeout(() => this.processQueue(), 0)
      }
    }

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        
        if (this.currentHandler) {
          this.stockfishWorker?.removeEventListener('message', this.currentHandler)
          this.currentHandler = null
        }
        
        console.log('[Stockfish] Timeout, using last score:', lastScore)
        
        if (lastScore !== null) {
          resolve(lastScore)
        } else {
          resolve(0)
        }
        
        this.isProcessing = false
        setTimeout(() => this.processQueue(), 0)
      }
    }, moveTime)

    this.currentHandler = messageHandler
    this.stockfishWorker.addEventListener('message', messageHandler)
    
    this.stockfishWorker.postMessage(`position fen ${fen}`)
    this.stockfishWorker.postMessage(`go depth ${this.searchDepth} movetime ${moveTime}`)
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
    if (!isReady) {
      throw new Error('Stockfish not available')
    }

    return new Promise((resolve, reject) => {
      this.evaluationQueue.push({ fen, resolve, reject })
      
      setTimeout(() => {
        this.processQueue()
      }, 0)
    })
  }
}
