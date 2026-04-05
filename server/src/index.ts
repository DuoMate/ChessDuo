import express, { Request, Response } from 'express'
import cors from 'cors'
import { spawn } from 'child_process'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))
app.options('*', cors())
app.use(express.json())

interface EvaluateRequest {
  fen: string
  depth?: number
}

const DEFAULT_DEPTH = parseInt(process.env.STOCKFISH_DEPTH || '8')
const JOB_TIMEOUT = 30000

console.log(`[SERVER] Default depth: ${DEFAULT_DEPTH}`)

function findStockfishPath(): string {
  const fs = require('fs')
  const paths = [
    '/usr/games/stockfish',
    '/usr/bin/stockfish',
    '/usr/local/bin/stockfish',
    'stockfish'
  ]
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return 'stockfish'
}

const STOCKFISH_PATH = findStockfishPath()
console.log(`[SERVER] Stockfish path: ${STOCKFISH_PATH}`)

interface Job {
  fen: string
  depth: number
  resolve: (score: number) => void
  reject: (err: Error) => void
  startTime: number
}

class StockfishQueue {
  private jobQueue: Job[] = []
  private stockfish: ReturnType<typeof spawn> | null = null
  private buffer = ''
  private currentJob: Job | null = null
  private uciReady = false
  private restartTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.startStockfish()
  }

  private startStockfish(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout)
      this.restartTimeout = null
    }

    console.log('[STOCKFISH] Starting process...')
    
    const proc = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.stockfish = proc
    this.buffer = ''
    this.uciReady = false

    proc.stdout.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      this.processBuffer()
    })

    proc.stderr.on('data', () => {})

    proc.on('error', (err) => {
      console.error('[STOCKFISH] Error:', err)
      this.scheduleRestart()
    })

    proc.on('exit', (code) => {
      console.log(`[STOCKFISH] Exited with code ${code}`)
      if (this.currentJob) {
        this.currentJob.reject(new Error('Stockfish crashed'))
        this.currentJob = null
      }
      this.scheduleRestart()
    })

    proc.stdin.write('uci\n')
  }

  private scheduleRestart(): void {
    if (this.restartTimeout) return
    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = null
      this.startStockfish()
    }, 2000)
  }

  private processBuffer(): void {
    if (!this.uciReady) {
      if (this.buffer.includes('uciok')) {
        this.uciReady = true
        this.buffer = ''
        console.log('[STOCKFISH] Ready')
        this.processNext()
      }
      return
    }

    if (!this.currentJob) return

    const lines = this.buffer.split('\n')
    for (const line of lines) {
      if (line.includes('score cp')) {
        const match = line.match(/score cp (-?\d+)/)
        if (match) {
          const score = parseInt(match[1], 10)
          console.log(`[STOCKFISH] Score: ${score}`)
          this.buffer = ''
          const job = this.currentJob
          this.currentJob = null
          job.resolve(score)
          this.processNext()
          return
        }
      }
      
      if (line.includes('score mate')) {
        const match = line.match(/score mate (-?\d+)/)
        if (match) {
          const mateIn = parseInt(match[1], 10)
          const score = mateIn > 0 ? 10000 : -10000
          console.log(`[STOCKFISH] Mate: ${mateIn}`)
          this.buffer = ''
          const job = this.currentJob
          this.currentJob = null
          job.resolve(score)
          this.processNext()
          return
        }
      }
      
      if (line.startsWith('bestmove')) {
        console.log(`[STOCKFISH] Bestmove: ${line}`)
      }
    }

    if (this.currentJob && Date.now() - this.currentJob.startTime > JOB_TIMEOUT) {
      console.log('[STOCKFISH] Job timeout')
      const job = this.currentJob
      this.currentJob = null
      job.reject(new Error('Job timeout'))
      this.buffer = ''
      this.processNext()
    }
  }

  private processNext(): void {
    if (this.currentJob || !this.uciReady || !this.stockfish) return
    if (this.jobQueue.length === 0) return

    const job = this.jobQueue.shift()!
    this.currentJob = job
    console.log(`[QUEUE] Processing job (${this.jobQueue.length + 1} in queue)`)

    this.stockfish.stdin?.write(`position fen ${job.fen}\n`)
    this.stockfish.stdin?.write(`go depth ${job.depth}\n`)
  }

  enqueue(fen: string, depth: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const job: Job = {
        fen,
        depth,
        resolve,
        reject,
        startTime: Date.now()
      }

      this.jobQueue.push(job)
      console.log(`[QUEUE] Job added (queue size: ${this.jobQueue.length})`)
      
      this.processNext()
    })
  }

  getStats() {
    return {
      queueLength: this.jobQueue.length,
      processing: this.currentJob !== null,
      uciReady: this.uciReady
    }
  }
}

const stockfishQueue = new StockfishQueue()

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    ...stockfishQueue.getStats()
  })
})

app.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { fen, depth = DEFAULT_DEPTH } = req.body as EvaluateRequest

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    const startTime = Date.now()
    const score = await stockfishQueue.enqueue(fen, depth)
    const elapsed = Date.now() - startTime

    res.json({
      fen,
      score,
      depth,
      timeMs: elapsed
    })
  } catch (error) {
    console.error('[EVALUATE] Error:', error)
    res.status(500).json({
      error: 'Evaluation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.post('/evaluate-batch', async (req: Request, res: Response) => {
  try {
    const { positions, depth = DEFAULT_DEPTH } = req.body as { positions: string[], depth?: number }

    if (!positions || !Array.isArray(positions)) {
      res.status(400).json({ error: 'positions array is required' })
      return
    }

    const startTime = Date.now()
    
    const evaluations = positions.map(fen => stockfishQueue.enqueue(fen, depth))
    const results = await Promise.all(evaluations)

    const elapsed = Date.now() - startTime

    res.json({
      results: results.map((score, i) => ({
        fen: positions[i],
        score,
        timeMs: elapsed / positions.length
      })),
      totalTimeMs: elapsed
    })
  } catch (error) {
    console.error('[EVALUATE-BATCH] Error:', error)
    res.status(500).json({
      error: 'Batch evaluation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down...')
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`[SERVER] Stockfish server running on port ${PORT}`)
  console.log(`[SERVER] Using persistent Stockfish with job queue`)
})
