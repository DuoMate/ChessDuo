import express, { Request, Response } from 'express'
import cors from 'cors'
import { spawn } from 'child_process'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

interface EvaluateRequest {
  fen: string
  depth?: number
}

const STOCKFISH_PATHS = [
  '/usr/games/stockfish',
  '/usr/bin/stockfish',
  '/usr/local/bin/stockfish',
  'stockfish'
]

function findStockfishPath(): string {
  const fs = require('fs')
  for (const p of STOCKFISH_PATHS) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return 'stockfish'
}

const STOCKFISH_PATH = findStockfishPath()
const NUM_WORKERS = parseInt(process.env.STOCKFISH_WORKERS || '4')
const DEFAULT_DEPTH = parseInt(process.env.STOCKFISH_DEPTH || '15')

console.log(`[SERVER] Stockfish path: ${STOCKFISH_PATH}`)
console.log(`[SERVER] Worker pool size: ${NUM_WORKERS}`)
console.log(`[SERVER] Default depth: ${DEFAULT_DEPTH}`)

interface WorkerMessage {
  fen: string
  depth: number
  resolve: (score: number) => void
  reject: (err: Error) => void
}

class StockfishWorkerPool {
  private workers: Array<{
    proc: ReturnType<typeof spawn>
    busy: boolean
    currentResolve: ((score: number) => void) | null
    currentReject: ((err: Error) => void) | null
  }> = []
  private pendingQueue: WorkerMessage[] = []

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.createWorker(i)
    }
  }

  private createWorker(index: number): void {
    const proc = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    proc.stdin?.write('uci\n')

    let buffer = ''
    let resolved = false

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        buffer += line + '\n'
        
        const cpMatch = buffer.match(/score cp (-?\d+)/)
        const mateMatch = buffer.match(/score mate (-?\d+)/)
        
        if (cpMatch && !resolved) {
          resolved = true
          const worker = this.workers[index]
          if (worker?.currentResolve) {
            worker.currentResolve(parseInt(cpMatch[1], 10))
          }
          this.clearWorker(index)
          this.processNext()
          return
        }
        
        if (mateMatch && !resolved) {
          resolved = true
          const worker = this.workers[index]
          if (worker?.currentResolve) {
            const mateIn = parseInt(mateMatch[1], 10)
            worker.currentResolve(mateIn > 0 ? 10000 : -10000)
          }
          this.clearWorker(index)
          this.processNext()
          return
        }
      }
    })

    proc.stderr.on('data', () => {})
    
    proc.on('error', (err) => {
      console.error(`[WORKER-${index}] Error:`, err)
      const worker = this.workers[index]
      if (worker?.currentReject) {
        worker.currentReject(err)
      }
      this.clearWorker(index)
      this.processNext()
    })

    proc.on('exit', () => {
      if (!resolved) {
        const worker = this.workers[index]
        if (worker?.currentResolve) {
          worker.currentResolve(0)
        }
        this.clearWorker(index)
        this.processNext()
      }
    })

    this.workers[index] = {
      proc,
      busy: false,
      currentResolve: null,
      currentReject: null
    }
  }

  private clearWorker(index: number): void {
    const worker = this.workers[index]
    if (worker) {
      worker.busy = false
      worker.currentResolve = null
      worker.currentReject = null
    }
  }

  private processNext(): void {
    const availableWorker = this.workers.findIndex(w => !w.busy)
    if (availableWorker === -1) return

    const pending = this.pendingQueue.shift()
    if (!pending) return

    const worker = this.workers[availableWorker]
    worker.busy = true

    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        worker.currentResolve = null
        worker.currentReject = null
        worker.busy = false
        worker.proc.kill()
        this.createWorker(availableWorker)
        pending.reject(new Error('Evaluation timeout'))
        this.processNext()
      }
    }, 20000)

    worker.currentResolve = (score: number) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      pending.resolve(score)
    }

    worker.currentReject = (err: Error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      pending.reject(err)
    }

    worker.proc.stdin?.write(`position fen ${pending.fen}\n`)
    worker.proc.stdin?.write(`go depth ${pending.depth}\n`)
  }

  async evaluate(fen: string, depth: number = DEFAULT_DEPTH): Promise<number> {
    return new Promise((resolve, reject) => {
      this.pendingQueue.push({
        fen,
        depth,
        resolve,
        reject
      })

      this.processNext()
    })
  }

  getStats() {
    return {
      workers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      pendingRequests: this.pendingQueue.length
    }
  }
}

const workerPool = new StockfishWorkerPool(NUM_WORKERS)

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    ...workerPool.getStats()
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
    const score = await workerPool.evaluate(fen, depth)
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
    
    const evaluations = positions.map(fen => workerPool.evaluate(fen, depth))
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

app.get('/stats', (req: Request, res: Response) => {
  res.json(workerPool.getStats())
})

process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down...')
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`[SERVER] Stockfish server running on port ${PORT}`)
  console.log(`[SERVER] Endpoints:`)
  console.log(`[SERVER]   GET  /health  - Health check with stats`)
  console.log(`[SERVER]   GET  /stats   - Worker pool stats`)
  console.log(`[SERVER]   POST /evaluate - Evaluate single position`)
  console.log(`[SERVER]   POST /evaluate-batch - Evaluate multiple positions`)
})
