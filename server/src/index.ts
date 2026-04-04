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

function evaluate(fen: string, depth: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const fs = require('fs')
    const paths = [
      '/usr/games/stockfish',
      '/usr/bin/stockfish',
      '/usr/local/bin/stockfish',
      '/usr/local/bin/stockfish/stockfish-ubuntu-x86-64',
      'stockfish'
    ]
    
    let stockfishPath = 'stockfish'
    for (const p of paths) {
      if (fs.existsSync(p)) {
        stockfishPath = p
        break
      }
    }
    
    console.log('[STOCKFISH] Using:', stockfishPath)
    
    const proc = spawn(stockfishPath, [], {
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
    }, 30000)
    
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
          }
        }
      }
    })
    
    proc.stderr.on('data', (data: Buffer) => {
      console.log('[STOCKFISH] stderr:', data.toString())
    })
    
    proc.on('error', (err) => {
      console.error('[STOCKFISH] Error:', err)
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(err)
      }
    })
    
    proc.on('exit', (code) => {
      if (!resolved) {
        // No score found, return 0
        resolved = true
        clearTimeout(timeout)
        resolve(0)
      }
    })
    
    // Initialize UCI and evaluate
    proc.stdin.write('uci\n')
    
    // Wait for uciok then send position
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
    const { fen, depth = 15 } = req.body as EvaluateRequest

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    console.log(`\n[EVALUATE] FEN: ${fen}, Depth: ${depth}`)

    const startTime = Date.now()
    const score = await evaluate(fen, depth)
    const elapsed = Date.now() - startTime

    console.log(`[EVALUATE] Score: ${score}, Time: ${elapsed}ms`)

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
    const { positions, depth = 15 } = req.body as { positions: string[], depth?: number }

    if (!positions || !Array.isArray(positions)) {
      res.status(400).json({ error: 'positions array is required' })
      return
    }

    const results: { fen: string, score: number, timeMs: number }[] = []

    for (const fen of positions) {
      const startTime = Date.now()
      const score = await evaluate(fen, depth)
      const elapsed = Date.now() - startTime
      results.push({ fen, score, timeMs: elapsed })
    }

    res.json({ results })
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
  console.log(`[SERVER] Endpoints:`)
  console.log(`[SERVER]   GET  /health - Health check`)
  console.log(`[SERVER]   POST /evaluate - Evaluate single position`)
  console.log(`[SERVER]   POST /evaluate-batch - Evaluate multiple positions`)
})