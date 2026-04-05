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
  id: string
  fen: string
  depth: number
  resolve: (score: number) => void
  reject: (err: Error) => void
  startTime: number
}

class StockfishQueue {
  private jobQueue: Job[] = []
  private processing = false
  private stockfish: ReturnType<typeof spawn> | null = null
  private buffer = ''
  private currentJob: Job | null = null
  private uciReady = false

  constructor() {
    this.startStockfish()
  }

  private startStockfish(): void {
    console.log('[STOCKFISH] Starting process...')
    
    const proc = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.stockfish = proc
    this.buffer = ''
    this.uciReady = false
    this.processing = false

    proc.stdout.on('data', (data: Buffer) => {
      const str = data.toString()
      this.buffer += str
      this.processBuffer()
    })

    proc.stderr.on('data', (data: Buffer) => {
      console.log('[STOCKFISH stderr]:', data.toString().trim())
    })

    proc.on('error', (err) => {
      console.error('[STOCKFISH] Error:', err)
      this.restart()
    })

    proc.on('exit', (code) => {
      console.log(`[STOCKFISH] Exited with code ${code}`)
      this.restart()
    })

    proc.stdin.write('uci\n')
  }

  private restart(): void {
    if (this.stockfish) {
      this.stockfish.removeAllListeners()
      this.stockfish.kill()
      this.stockfish = null
    }
    
    setTimeout(() => {
      this.startStockfish()
    }, 1000)
  }

  private processBuffer(): void {
    if (!this.uciReady) {
      if (this.buffer.includes('uciok')) {
        this.uciReady = true
        this.buffer = ''
        console.log('[STOCKFISH] Ready')
        this.processQueue()
      }
      return
    }

    if (!this.currentJob || !this.stockfish) return

    const cpMatch = this.buffer.match(/score cp (-?\d+)/)
    const mateMatch = this.buffer.match(/score mate (-?\d+)/)
    const bestMoveMatch = this.buffer.match(/bestmove (\S+)/)

    if (cpMatch) {
      const score = parseInt(cpMatch[1], 10)
      console.log(`[STOCKFISH] Score: ${score}`)
      this.buffer = ''
      const job = this.currentJob
      this.currentJob = null
      job.resolve(score)
      this.processQueue()
    } else if (mateMatch) {
      const mateIn = parseInt(mateMatch[1], 10)
      const score = mateIn > 0 ? 10000 : -10000
      console.log(`[STOCKFISH] Mate: ${mateIn} -> score ${score}`)
      this.buffer = ''
      const job = this.currentJob
      this.currentJob = null
      job.resolve(score)
      this.processQueue()
    } else if (bestMoveMatch) {
      this.buffer = ''
    }
  }

  private processQueue(): void {
    if (this.processing || !this.uciReady || !this.stockfish) return
    if (this.jobQueue.length === 0) return

    const job = this.jobQueue.shift()!
    this.currentJob = job
    this.processing = true

    const elapsed = Date.now() - job.startTime
    if (elapsed > JOB_TIMEOUT) {
      console.log(`[STOCKFISH] Job timeout after ${elapsed}ms`)
      job.reject(new Error('Job timeout'))
      this.currentJob = null
      this.processing = false
      this.processQueue()
      return
    }

    console.log(`[STOCKFISH] Processing job (${this.jobQueue.length + 1} in queue)`)
    this.buffer = ''
    if (this.stockfish?.stdin) {
      this.stockfish.stdin.write(`position fen ${job.fen}\n`)
      this.stockfish.stdin.write(`go depth ${job.depth}\n`)
    }

    setTimeout(() => {
      if (this.currentJob === job) {
        console.log('[STOCKFISH] Job timeout')
        job.reject(new Error('Evaluation timeout'))
        this.currentJob = null
        this.processing = false
        this.processQueue()
      }
    }, JOB_TIMEOUT)
  }

  enqueue(fen: string, depth: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const job: Job = {
        id: Math.random().toString(36).substr(2, 9),
        fen,
        depth,
        resolve,
        reject,
        startTime: Date.now()
      }

      this.jobQueue.push(job)
      console.log(`[QUEUE] Job added (queue size: ${this.jobQueue.length})`)
      
      this.processQueue()
    })
  }

  getStats() {
    return {
      queueLength: this.jobQueue.length,
      processing: this.processing,
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
  console.log(`[SERVER] Using persistent Stockfish process with job queue`)
})
