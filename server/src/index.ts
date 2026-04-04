import express, { Request, Response } from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

interface EvaluateRequest {
  fen: string
  depth?: number
  skillLevel?: number
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
    
    try {
      const score = await evaluateWithStockfish(fen, depth)
      const elapsed = Date.now() - startTime

      console.log(`[EVALUATE] Score: ${score}, Time: ${elapsed}ms`)

      res.json({
        fen,
        score,
        depth,
        timeMs: elapsed
      })
    } catch (evalError) {
      console.error('[EVALUATE] Evaluation error:', evalError)
      res.status(500).json({ 
        error: 'Evaluation failed',
        message: evalError instanceof Error ? evalError.message : 'Unknown error'
      })
    }
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
      const score = await evaluateWithStockfish(fen, depth)
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

function evaluateWithStockfish(fen: string, depth: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const stockfish = require('stockfish')
    
    let timeout = setTimeout(() => {
      worker.postMessage('quit')
      reject(new Error('Stockfish evaluation timeout'))
    }, 30000)

    const worker = stockfish()

    worker.onmessage = (event: string | { type: string; data: string }) => {
      const data = typeof event === 'string' ? event : event.data
      
      if (typeof data !== 'string') return

      // Look for evaluation score
      const cpMatch = data.match(/score cp (-?\d+)/)
      if (cpMatch) {
        clearTimeout(timeout)
        worker.postMessage('quit')
        resolve(parseInt(cpMatch[1], 10))
        return
      }

      // Look for mate score
      const mateMatch = data.match(/score mate (-?\d+)/)
      if (mateMatch) {
        clearTimeout(timeout)
        worker.postMessage('quit')
        const mateIn = parseInt(mateMatch[1], 10)
        resolve(mateIn > 0 ? 10000 : -10000)
        return
      }

      // Check for bestmove (evaluation ended without score)
      if (data.startsWith('bestmove')) {
        clearTimeout(timeout)
        worker.postMessage('quit')
        resolve(0)
      }
    }

    worker.onerror = (err: Error) => {
      clearTimeout(timeout)
      console.error('[STOCKFISH] Error:', err)
      reject(err)
    }

    // Initialize UCI
    worker.postMessage('uci')
    
    // Wait for uciok, then set up position
    const checkUciOk = (event: string | { type: string; data: string }) => {
      const data = typeof event === 'string' ? event : event.data
      if (data === 'uciok') {
        worker.postMessage('isready')
        worker.removeListener('message', checkUciOk)
        worker.postMessage(`position fen ${fen}`)
        worker.postMessage(`go depth ${depth}`)
      }
    }
    
    worker.addEventListener('message', checkUciOk)
  })
}

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
})