import express, { Request, Response } from 'express'
import cors from 'cors'
import { spawn, ChildProcess } from 'child_process'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

interface EvaluateRequest {
  fen: string
  depth?: number
}

let stockfishProc: ChildProcess | null = null
let stockfishReady = false
let pendingResolve: ((score: number) => void) | null = null
let pendingReject: ((error: Error) => void) | null = null
let evalTimeout: NodeJS.Timeout | null = null

function initStockfish(): void {
  if (stockfishProc) {
    return
  }
  
  console.log('[STOCKFISH] Initializing...')
  
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
    try {
      if (fs.existsSync(p)) {
        stockfishPath = p
        console.log('[STOCKFISH] Found at:', stockfishPath)
        break
      }
    } catch {}
  }
  
  console.log('[STOCKFISH] Spawning:', stockfishPath)
  
  stockfishProc = spawn(stockfishPath, [], {
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  stockfishProc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      if (line.trim()) {
        console.log('[STOCKFISH] <<<', line.trim())
      }
      
      if (line.trim() === 'uciok') {
        stockfishReady = true
        console.log('[STOCKFISH] UCI initialized')
        stockfishProc?.stdin?.write('isready\n')
      }
      
      if (line.trim() === 'readyok' && stockfishReady) {
        console.log('[STOCKFISH] Ready!')
      }
      
      // Parse score
      const cpMatch = line.match(/score cp (-?\d+)/)
      if (cpMatch && pendingResolve) {
        const score = parseInt(cpMatch[1], 10)
        console.log('[STOCKFISH] Got score:', score)
        cleanup()
        pendingResolve(score)
      }
      
      // Parse mate score
      const mateMatch = line.match(/score mate (-?\d+)/)
      if (mateMatch && pendingResolve) {
        const mateIn = parseInt(mateMatch[1], 10)
        const score = mateIn > 0 ? 10000 : -10000
        console.log('[STOCKFISH] Got mate score:', score)
        cleanup()
        pendingResolve(score)
      }
      
      // Bestmove indicates evaluation is complete
      if (line.startsWith('bestmove') && pendingResolve) {
        console.log('[STOCKFISH] Bestmove received, resolving with 0')
        cleanup()
        pendingResolve(0)
      }
    }
  })
  
  stockfishProc.stderr?.on('data', (data: Buffer) => {
    const output = data.toString()
    if (output.trim()) {
      console.log('[STOCKFISH] stderr:', output.trim())
    }
  })
  
  stockfishProc.on('error', (err) => {
    console.error('[STOCKFISH] Process error:', err)
    cleanup()
  })
  
  stockfishProc.on('exit', (code) => {
    console.log('[STOCKFISH] Process exited with code:', code)
    stockfishProc = null
    stockfishReady = false
  })
  
  // Initialize UCI
  stockfishProc.stdin?.write('uci\n')
}

function cleanup(): void {
  if (evalTimeout) {
    clearTimeout(evalTimeout)
    evalTimeout = null
  }
  pendingResolve = null
  pendingReject = null
}

function evaluate(fen: string, depth: number): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!stockfishProc || !stockfishReady) {
      initStockfish()
      // Wait for stockfish to be ready
      const checkReady = setInterval(() => {
        if (stockfishReady) {
          clearInterval(checkReady)
          evaluate(fen, depth).then(resolve).catch(reject)
        }
      }, 100)
      return
    }
    
    pendingResolve = resolve
    pendingReject = reject
    
    evalTimeout = setTimeout(() => {
      console.log('[STOCKFISH] Evaluation timeout')
      cleanup()
      reject(new Error('Evaluation timeout'))
    }, 30000)
    
    console.log('[STOCKFISH] Position:', fen)
    stockfishProc?.stdin?.write(`position fen ${fen}\n`)
    stockfishProc?.stdin?.write(`go depth ${depth}\n`)
  })
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', stockfishReady })
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

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down...')
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`[SERVER] Stockfish server running on port ${PORT}`)
  console.log(`[SERVER] Endpoints:`)
  console.log(`[SERVER]   GET  /health - Health check`)
  console.log(`[SERVER]   POST /evaluate - Evaluate single position`)
  console.log(`[SERVER]   POST /evaluate-batch - Evaluate multiple positions`)
  
  // Initialize Stockfish on startup
  initStockfish()
})