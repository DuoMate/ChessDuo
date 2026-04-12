import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { STOCKFISH_PATH } from './index'

interface PendingJob {
  fen: string
  moves: string[]
  movetime: number
  resolve: (result: { move: string; score: number }[]) => void
  reject: (err: Error) => void
}

export class StockfishEngine {
  private proc: ChildProcessWithoutNullStreams | null = null
  private queue: PendingJob[] = []
  private busy = false
  private scores: Record<string, number> = {}
  private currentMoves: string[] = []
  private currentResolve: ((result: { move: string; score: number }[]) => void) | null = null
  private currentReject: ((err: Error) => void) | null = null
  private restartCount = 0
  private readonly MAX_RESTARTS = 3
  private initializationComplete = false

  constructor() {
    this.spawn()
  }

  private spawn(): void {
    if (this.proc) {
      this.proc.kill()
      this.proc = null
    }

    console.log('[ENGINE] Spawning Stockfish process...')
    this.proc = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.proc.stdout.on('data', (data: Buffer) => this.handleOutput(data))
    this.proc.stderr.on('data', (data: Buffer) => {
      const str = data.toString().trim()
      if (str) {
        console.log('[ENGINE STDERR]', str)
      }
    })
    this.proc.on('error', (err) => {
      console.error('[ENGINE] Process error:', err.message)
      this.handleCrash()
    })
    this.proc.on('exit', (code) => {
      console.log('[ENGINE] Process exited with code:', code)
      if (this.busy) {
        this.handleCrash()
      }
    })

    this.send('uci')
    this.send('setoption name UCI_LimitStrength true')
    this.send('setoption name MultiPV value 6')
    this.send('isready')
  }

  private send(cmd: string): void {
    if (this.proc && this.proc.stdin) {
      this.proc.stdin.write(cmd + '\n')
    }
  }

  private handleOutput(data: Buffer): void {
    const lines = data.toString().split('\n')

    for (const line of lines) {
      if (!line.trim()) continue

      if (line.includes('uciok') && !this.initializationComplete) {
        console.log('[ENGINE] UCI initialized')
        this.initializationComplete = true
        this.processNext()
        continue
      }

      if (line.includes('readyok') && this.busy) {
        this.send(`position fen ${this.currentMoves[0]}`)
        const moveNumber = this.getMoveNumber(this.currentMoves[0])
        const movetime = moveNumber < 10 ? 300 : 500
        this.send(`go movetime ${movetime}`)
        continue
      }

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

          if (move.length >= 4) {
            this.scores[move] = score
            console.log(`[ENGINE] Captured: move=${move} score=${score}`)
          }
        }
        continue
      }

      if (line.startsWith('bestmove') && this.busy) {
        console.log('[ENGINE] Bestmove received, resolving job')
        
        const results = this.currentMoves
          .filter(m => this.scores[m] !== undefined)
          .map(m => ({
            move: m,
            score: this.scores[m]
          }))

        console.log(`[ENGINE] Returning ${results.length} evaluated moves out of ${this.currentMoves.length} requested`)

        if (this.currentResolve) {
          this.currentResolve(results)
        }

        this.busy = false
        this.scores = {}
        this.currentMoves = []
        this.currentResolve = null
        this.currentReject = null

        this.processNext()
        continue
      }
    }
  }

  private getMoveNumber(fen: string): number {
    const parts = fen.split(' ')
    const moveCount = parseInt(parts[5] || '1', 10)
    return moveCount
  }

  private handleCrash(): void {
    console.error('[ENGINE] Crash detected!')
    this.busy = false

    if (this.currentReject) {
      this.currentReject(new Error('Stockfish crashed'))
    }

    this.scores = {}
    this.currentMoves = []
    this.currentResolve = null
    this.currentReject = null

    if (this.restartCount < this.MAX_RESTARTS) {
      this.restartCount++
      console.log(`[ENGINE] Restarting... (attempt ${this.restartCount}/${this.MAX_RESTARTS})`)
      this.restart()
    } else {
      console.error('[ENGINE] Max restarts reached, giving up')
      this.restartCount = 0
    }
  }

  private restart(): void {
    this.initializationComplete = false
    this.spawn()
  }

  private processNext(): void {
    if (this.busy || this.queue.length === 0 || !this.initializationComplete) {
      return
    }

    const job = this.queue.shift()!
    this.busy = true
    this.currentMoves = job.moves
    this.currentResolve = job.resolve
    this.currentReject = job.reject

    this.scores = {}

    console.log(`[ENGINE] Processing job: ${job.moves.length} moves, fen: ${job.fen.substring(0, 50)}...`)

    this.send(`position fen ${job.fen}`)
    const moveNumber = this.getMoveNumber(job.fen)
    const movetime = moveNumber < 10 ? 300 : 500
    this.send(`go movetime ${movetime}`)
  }

  evaluateMoves(fen: string, moves: string[], movetime: number = 500): Promise<{ move: string; score: number }[]> {
    return new Promise((resolve, reject) => {
      const job: PendingJob = { fen, moves, movetime, resolve, reject }
      this.queue.push(job)
      console.log(`[ENGINE] Queued job: ${moves.length} moves, queue length: ${this.queue.length}`)
      this.processNext()
    })
  }

  async evaluateMovesSafe(fen: string, moves: string[], movetime: number = 500): Promise<{ move: string; score: number }[]> {
    try {
      return await this.evaluateMoves(fen, moves, movetime)
    } catch (err) {
      console.error('[ENGINE] Evaluation failed:', err)
      
      if (this.restartCount < this.MAX_RESTARTS) {
        this.restartCount++
        console.log(`[ENGINE] Restarting engine and retrying (${this.restartCount}/${this.MAX_RESTARTS})`)
        this.restart()
        await new Promise(r => setTimeout(r, 1000))
        return this.evaluateMoves(fen, moves, movetime)
      }
      
      throw err
    }
  }

  isHealthy(): boolean {
    return this.proc !== null && this.busy === false && this.initializationComplete
  }

  destroy(): void {
    console.log('[ENGINE] Destroying...')
    if (this.proc) {
      this.proc.kill()
      this.proc = null
    }
    this.queue = []
    this.busy = false
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getStatus(): { busy: boolean; queueLength: number; initialized: boolean; restartCount: number } {
    return {
      busy: this.busy,
      queueLength: this.queue.length,
      initialized: this.initializationComplete,
      restartCount: this.restartCount
    }
  }
}
