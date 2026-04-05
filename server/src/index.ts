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
const EVAL_TIMEOUT = 20000

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

function evaluate(fen: string, depth: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        proc.kill()
        reject(new Error('Evaluation timeout'))
      }
    }, EVAL_TIMEOUT)

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        output += line + '\n'
        
        if (line.includes('score cp')) {
          const match = line.match(/score cp (-?\d+)/)
          if (match && !resolved) {
            resolved = true
            clearTimeout(timeout)
            proc.kill()
            resolve(parseInt(match[1], 10))
            return
          }
        }

        if (line.includes('score mate')) {
          const match = line.match(/score mate (-?\d+)/)
          if (match && !resolved) {
            resolved = true
            clearTimeout(timeout)
            proc.kill()
            const mateIn = parseInt(match[1], 10)
            resolve(mateIn > 0 ? 10000 : -10000)
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
        reject(err)
      }
    })

    proc.on('exit', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve(0)
      }
    })

    proc.stdin.write('uci\n')
    
    const checkUciOk = (data: Buffer) => {
      const str = data.toString()
      if (str.includes('uciok')) {
        proc.stdout.removeListener('data', checkUciOk)
        proc.stdin.write('isready\n')
        proc.stdin.write(`position fen ${fen}\n`)
        proc.stdin.write(`go depth ${depth}\n`)
      }
    }

    proc.stdout.on('data', checkUciOk)
  })
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

app.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { fen, depth = DEFAULT_DEPTH } = req.body as EvaluateRequest

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    const startTime = Date.now()
    const score = await evaluate(fen, depth)
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
    
    const evaluations = positions.map(fen => evaluate(fen, depth))
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
  console.log(`[SERVER] Spawns new process per evaluation (sequential)`)
})
