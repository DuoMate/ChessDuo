import { evaluationCache } from '../shared/evaluationCache'
import { DEBUG } from '../../lib/debug'

const WORKER_PATH = '/stockfish/stockfish.js'
const EVAL_TIMEOUT_MS = 30000

function workerReady(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Stockfish worker init timed out after 15s'))
    }, 15000)

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = (e.data || '').trim()
      if (line === 'readyok') {
        clearTimeout(timeout)
        resolve()
      }
    }
    worker.onerror = (e: ErrorEvent) => {
      clearTimeout(timeout)
      reject(new Error(`Worker error: ${e.message}`))
    }

    worker.postMessage('uci')
    worker.postMessage('setoption name MultiPV value 2')
    worker.postMessage('isready')
  })
}

export class BrowserMoveEvaluator {
  private worker: Worker | null = null
  private _initError: string | null = null
  private _ready = false
  private _initPromise: Promise<void> | null = null

  constructor() {}

  private ensureWorker(): void {
    if (this.worker) return
    if (this._initError) return

    this._initPromise = (async () => {
      try {
        this.worker = new Worker(WORKER_PATH)
        this.worker.onmessage = () => {}

        await workerReady(this.worker)
        this._ready = true
        DEBUG && console.log('[BROWSER-EVAL] Stockfish worker initialized')
      } catch (err) {
        this._initError = String((err as { message?: string })?.message || err)
        DEBUG && console.error('[BROWSER-EVAL] Init failed:', this._initError)
      }
    })()
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this._ready = false
    this._initPromise = null
  }

  getInitError(): string | null {
    return this._initError
  }

  isReady(): boolean {
    return this._ready && !this._initError
  }

  async waitForReady(timeoutMs = 15000): Promise<void> {
    this.ensureWorker()
    if (this._ready && !this._initError) return
    if (this._initError) throw new Error(`Stockfish failed: ${this._initError}`)

    if (this._initPromise) {
      const race = Promise.race([
        this._initPromise,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Stockfish wait timed out')), timeoutMs)),
      ])
      await race
      if (this._initError) throw new Error(`Stockfish failed: ${this._initError}`)
      return
    }

    throw new Error('Stockfish engine is not ready yet')
  }

  isUsingStockfish(): boolean {
    return true
  }

  async evaluateMove(
    move: string,
    fen: string,
    _depth: number = 15,
    uciElo: number = 2600,
  ): Promise<{ move: string; score: number }> {
    const Chess = (await import('chess.js')).Chess
    const chess = new Chess(fen)
    chess.move(move)
    const newFen = chess.fen()
    const score = await this.evaluatePosition(newFen, 15, uciElo)
    return { move, score }
  }

  async evaluateMoves(
    moves: string[],
    fen: string,
    _depth: number = 15,
    _uciElo: number = 2600,
    _retries: number = 3,
  ): Promise<{ move: string; score: number }[]> {
    await this.ensureReady()
    if (!this.worker) throw new Error('Stockfish worker not available')

    const cachedResults: { move: string; score: number }[] = []
    const uncachedMoves: string[] = []
    for (const move of moves) {
      const cached = evaluationCache.getScore(fen, move)
      if (cached !== null) {
        cachedResults.push({ move, score: cached })
      } else {
        uncachedMoves.push(move)
      }
    }

    if (uncachedMoves.length === 0 && cachedResults.length > 0) {
      DEBUG && console.log(`[BROWSER-EVAL] All ${moves.length} moves cached`)
      return cachedResults
    }

    DEBUG && console.log(`[BROWSER-EVAL] Evaluating ${moves.length} moves`)

    const results = await this.uciEvaluate(fen, uncachedMoves)
    evaluationCache.setScores(fen, results)
    return [...cachedResults, ...results]
  }

  async evaluatePosition(
    fen: string,
    _depth: number = 15,
    _uciElo: number = 2600,
    _retries: number = 3,
  ): Promise<number> {
    await this.ensureReady()
    if (!this.worker) throw new Error('Stockfish worker not available')

    const Chess = (await import('chess.js')).Chess
    const chess = new Chess(fen)
    const allMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''))
    if (allMoves.length === 0) return 0

    const results = await this.uciEvaluate(fen, allMoves)
    if (results.length === 0) return 0
    return results.reduce((a, b) => a.score > b.score ? a : b, results[0]).score
  }

  async getBestScore(
    fen: string,
    movetime: number = 3000,
  ): Promise<{ move: string; score: number }> {
    await this.ensureReady()
    if (!this.worker) throw new Error('Stockfish worker not available')

    return new Promise((resolve, reject) => {
      let bestScore = 0
      let bestMove = ''

      const timeout = setTimeout(() => {
        if (bestMove) {
          resolve({ move: bestMove, score: bestScore })
        } else {
          reject(new Error('getBestScore timed out'))
        }
      }, EVAL_TIMEOUT_MS)

      const handler = (e: MessageEvent<string>) => {
        const line = (e.data || '').trim()
        if (!line) return

        if (line.includes('score cp')) {
          const cpMatch = line.match(/score cp (-?\d+)/)
          const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/)
          if (cpMatch) bestScore = parseInt(cpMatch[1], 10)
          if (pvMatch) bestMove = pvMatch[1]
        }

        if (line.startsWith('bestmove')) {
          clearTimeout(timeout)
          this.worker!.removeEventListener('message', handler)
          const parts = line.split(' ')
          const engineBest = parts[1]
          if (engineBest && engineBest !== '(none)') {
            if (!bestMove) bestMove = engineBest
            resolve({ move: engineBest, score: bestScore })
          } else {
            resolve({ move: '', score: 0 })
          }
        }
      }

      this.worker!.addEventListener('message', handler)
      this.worker!.postMessage(`position fen ${fen}`)
      this.worker!.postMessage(`go movetime ${movetime}`)
    })
  }

  async playMove(fen: string, _uciElo: number = 2600, movetime: number = 3000): Promise<string> {
    await this.ensureReady()
    if (!this.worker) throw new Error('Stockfish worker not available')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('playMove timed out'))
      }, movetime + EVAL_TIMEOUT_MS)

      const handler = (e: MessageEvent<string>) => {
        const line = (e.data || '').trim()
        if (line.startsWith('bestmove')) {
          clearTimeout(timeout)
          this.worker!.removeEventListener('message', handler)
          const parts = line.split(' ')
          if (parts.length >= 2 && parts[1] !== '(none)') {
            resolve(parts[1])
          } else {
            reject(new Error('No best move found'))
          }
        }
      }

      this.worker!.addEventListener('message', handler)
      this.worker!.postMessage(`position fen ${fen}`)
      this.worker!.postMessage(`go movetime ${movetime}`)
    })
  }

  private async ensureReady(): Promise<void> {
    this.ensureWorker()
    if (this._initError) {
      throw new Error(`Stockfish engine failed to load: ${this._initError}`)
    }
    if (!this._ready && this._initPromise) {
      await this._initPromise
    }
    if (this._initError) {
      throw new Error(`Stockfish engine failed to load: ${this._initError}`)
    }
    if (!this._ready) {
      throw new Error('Stockfish engine is not ready yet')
    }
  }

  private uciEvaluate(
    fen: string,
    moves: string[],
  ): Promise<{ move: string; score: number }[]> {
    return new Promise((resolve, reject) => {
      const scores: Record<string, number> = {}
      const timeout = setTimeout(() => {
        const results = Object.entries(scores).map(([move, score]) => ({ move, score }))
        this.worker!.removeEventListener('message', handler)
        resolve(results)
      }, EVAL_TIMEOUT_MS)

      const handler = (e: MessageEvent<string>) => {
        const line = (e.data || '').trim()
        if (!line) return

        if (line.includes(' pv ') && line.includes('score')) {
          const moveMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/)
          const cpMatch = line.match(/score cp (-?\d+)/)
          const mateMatch = line.match(/score mate (-?\d+)/)

          if (moveMatch) {
            const move = moveMatch[1]
            let score = 0
            if (cpMatch) {
              score = parseInt(cpMatch[1], 10)
            } else if (mateMatch) {
              const mate = parseInt(mateMatch[1], 10)
              score = mate > 0 ? 10000 - mate : -10000 - mate
            }
            if (moves.includes(move)) {
              scores[move] = score
            }
          }
        }

        if (line.startsWith('bestmove')) {
          clearTimeout(timeout)
          this.worker!.removeEventListener('message', handler)
          const results = Object.entries(scores).map(([move, score]) => ({ move, score }))
          resolve(results)
        }
      }

      this.worker!.addEventListener('message', handler)

      this.worker!.postMessage(`position fen ${fen}`)
      const useSearchmoves = moves.length > 0 && moves.length <= 10
      this.worker!.postMessage(`go movetime 3000${useSearchmoves ? ' searchmoves ' + moves.join(' ') : ''}`)
    })
  }
}
