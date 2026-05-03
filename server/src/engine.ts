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
  private currentFen: string = ''
  private currentMoves: string[] = []
  private currentResolve: ((result: { move: string; score: number }[]) => void) | null = null
  private currentReject: ((err: Error) => void) | null = null
  private restartCount = 0
  private readonly MAX_RESTARTS = 3
  private initializationComplete = false
  private timeoutId: NodeJS.Timeout | null = null
  private readonly EVAL_TIMEOUT_MS = 4000

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
      if (str) console.log('[ENGINE STDERR]', str)
    })

    this.proc.on('error', (err) => {
      console.error('[ENGINE] Process error:', err.message)
      this.handleCrash()
    })

    this.proc.on('exit', (code) => {
      console.log('[ENGINE] Process exited with code:', code)
      if (this.busy) this.handleCrash()
    })

    this.send('uci')
    this.send('setoption name UCI_LimitStrength true')
    this.send('setoption name UCI_Elo 2600')
    this.send('setoption name MultiPV value 6')
    this.send('isready')
  }

  private send(cmd: string): void {
    if (this.proc?.stdin) {
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
        this.startEvaluation()
        continue
      }

      if (line.includes(' pv ') && line.includes('score')) {
        const depthMatch = line.match(/\bdepth\s+(\d+)/)
        if (!depthMatch) continue

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

          if (this.currentMoves.includes(move)) {
            this.scores[move] = score
          }
        }
        continue
      }

      if (line.startsWith('bestmove') && this.busy) {
        this.clearTimeout()

        const results = this.currentMoves.map(m => ({
          move: m,
          score: this.scores[m] ?? 0
        }))

        this.currentResolve?.(results)

        this.resetState()
        this.processNext()
      }
    }
  }

  private startEvaluation(): void {
    const moveNumber = this.getMoveNumber(this.currentFen)
    const movetime = moveNumber < 10 ? 800 : 1200

    console.log(`[ENGINE] Evaluating ${this.currentMoves.length} moves (${movetime}ms)`)

    if (this.currentMoves.length > 0) {
      this.send(`go movetime ${movetime} searchmoves ${this.currentMoves.join(' ')}`)
    } else {
      this.send(`go movetime ${movetime}`)
    }

    this.setTimeout()
  }

  private setTimeout(): void {
    this.clearTimeout()

    this.timeoutId = setTimeout(() => {
      if (!this.busy) return

      console.warn('[ENGINE] Timeout fallback')

      const results = this.currentMoves.map(m => ({
        move: m,
        score: this.scores[m] ?? 0
      }))

      this.currentResolve?.(results)
      this.resetState()
      this.processNext()
    }, this.EVAL_TIMEOUT_MS)
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  private resetState(): void {
    this.busy = false
    this.scores = {}
    this.currentFen = ''
    this.currentMoves = []
    this.currentResolve = null
    this.currentReject = null
  }

  private getMoveNumber(fen: string): number {
    return parseInt(fen.split(' ')[5] || '1', 10)
  }

  private handleCrash(): void {
    console.error('[ENGINE] Crash detected')

    this.clearTimeout()
    this.currentReject?.(new Error('Stockfish crashed'))

    if (this.restartCount < this.MAX_RESTARTS) {
      this.restartCount++
      this.restart()
    }
  }

  private restart(): void {
    this.initializationComplete = false
    this.spawn()
  }

  private processNext(): void {
    if (this.busy || this.queue.length === 0 || !this.initializationComplete) return

    const job = this.queue.shift()!
    this.busy = true
    this.currentFen = job.fen
    this.currentMoves = job.moves
    this.currentResolve = job.resolve
    this.currentReject = job.reject
    this.scores = {}

    this.send(`position fen ${job.fen}`)
    this.send('isready')
  }

  evaluateMoves(fen: string, moves: string[], movetime = 500) {
    return new Promise<{ move: string; score: number }[]>((resolve, reject) => {
      this.queue.push({ fen, moves, movetime, resolve, reject })
      this.processNext()
    })
  }
}
