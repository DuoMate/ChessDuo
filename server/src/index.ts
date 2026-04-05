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
const EVAL_TIMEOUT = 15000
const MAX_CONCURRENT = 2

console.log(`[SERVER] Default depth: ${DEFAULT_DEPTH}`)
console.log(`[SERVER] Max concurrent: ${MAX_CONCURRENT}`)

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
}

let activeProcesses = 0
const jobQueue: Job[] = []

function processNext(): void {
  if (activeProcesses >= MAX_CONCURRENT) return
  if (jobQueue.length === 0) return

  const job = jobQueue.shift()!
  activeProcesses++

  const proc = spawn(STOCKFISH_PATH, [], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  let output = ''
  let resolved = false

  const timeout = setTimeout(() => {
    if (!resolved) {
      resolved = true
      proc.kill()
      activeProcesses--
      job.reject(new Error('Evaluation timeout'))
      processNext()
    }
  }, EVAL_TIMEOUT)

  proc.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      output += line + '\n'
      
      if (line.includes('score cp') && !resolved) {
        const match = line.match(/score cp (-?\d+)/)
        if (match) {
          resolved = true
          clearTimeout(timeout)
          proc.kill()
          activeProcesses--
          job.resolve(parseInt(match[1], 10))
          processNext()
          return
        }
      }

      if (line.includes('score mate') && !resolved) {
        const match = line.match(/score mate (-?\d+)/)
        if (match) {
          resolved = true
          clearTimeout(timeout)
          proc.kill()
          activeProcesses--
          const mateIn = parseInt(match[1], 10)
          job.resolve(mateIn > 0 ? 10000 : -10000)
          processNext()
          return
        }
      }
    }
  })

  proc.stderr.on('data', () => {})

  proc.on('error', (err) => {
    if (!resolved) {
      resolved = true
      clearTimeout(timeout)
      activeProcesses--
      job.reject(err)
      processNext()
    }
  })

  proc.on('exit', () => {
    if (!resolved) {
      resolved = true
      clearTimeout(timeout)
      activeProcesses--
      job.resolve(0)
      processNext()
    }
  })

  proc.stdin.write('uci\n')
  
  const checkUciOk = (data: Buffer) => {
    const str = data.toString()
    if (str.includes('uciok')) {
      proc.stdout.removeListener('data', checkUciOk)
      proc.stdin.write('isready\n')
      proc.stdin.write(`position fen ${job.fen}\n`)
      proc.stdin.write(`go depth ${job.depth}\n`)
    }
  }

  proc.stdout.on('data', checkUciOk)
}

function enqueueJob(fen: string, depth: number): Promise<number> {
  return new Promise((resolve, reject) => {
    jobQueue.push({ fen, depth, resolve, reject })
    processNext()
  })
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    queueLength: jobQueue.length,
    activeProcesses
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
    const score = await enqueueJob(fen, depth)
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
    
    const evaluations = positions.map(fen => enqueueJob(fen, depth))
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
  console.log(`[SERVER] Bounded concurrency: max ${MAX_CONCURRENT} processes`)
})
