import express, { Request, Response } from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import { StockfishEngine } from './engine'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))
app.options('*', cors())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

app.use(express.json())

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

export const STOCKFISH_PATH = findStockfishPath()
console.log(`[SERVER] Stockfish path: ${STOCKFISH_PATH}`)

const EVAL_TIMEOUT = 30000

const engine = new StockfishEngine()

app.get('/health', (_, res) => {
  const status = engine.getStatus()
  res.json({
    status: status.initialized ? 'ok' : 'initializing',
    busy: status.busy,
    queueLength: status.queueLength,
    initialized: status.initialized
  })
})

app.post('/evaluate-moves', async (req: Request, res: Response) => {
  try {
    const { fen, moves, movetime = 500 } = req.body as {
      fen: string
      moves: string[]
      movetime?: number
    }

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    if (!moves || !Array.isArray(moves) || moves.length === 0) {
      res.status(400).json({ error: 'Moves array is required' })
      return
    }

    const startTime = Date.now()

    console.log(`[EVALUATE-MOVES] Request: ${moves.length} moves, fen: ${fen.substring(0, 50)}...`)

    const results = await engine.evaluateMovesSafe(fen, moves, movetime)

    const elapsed = Date.now() - startTime

    console.log(`[EVALUATE-MOVES] Evaluated ${results.length} moves in ${elapsed}ms`)

    res.json({
      success: true,
      fen,
      moves: results,
      timeMs: elapsed
    })
  } catch (error) {
    console.error('[EVALUATE-MOVES] Error:', error)
    res.status(500).json({
      success: false,
      error: 'engine_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.post('/play-move', async (req: Request, res: Response) => {
  try {
    const { fen, uciElo = 2600, movetime = 1000 } = req.body as {
      fen: string
      uciElo?: number
      movetime?: number
    }

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    const startTime = Date.now()

    console.log(`[PLAY-MOVE] Request: fen: ${fen.substring(0, 50)}...`)

    const results = await engine.evaluateMovesSafe(fen, [], movetime)

    const elapsed = Date.now() - startTime

    const bestMove = results.length > 0 ? results[0].move : ''

    console.log(`[PLAY-MOVE] Selected: ${bestMove} in ${elapsed}ms`)

    res.json({
      success: true,
      fen,
      move: bestMove,
      uciElo,
      timeMs: elapsed
    })
  } catch (error) {
    console.error('[PLAY-MOVE] Error:', error)
    res.status(500).json({
      success: false,
      error: 'engine_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down...')
  engine.destroy()
  process.exit(0)
})

process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught exception:', err.message)
  console.error(err.stack)
})

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled rejection:', reason)
})

app.listen(PORT, () => {
  console.log(`[SERVER] Stockfish server running on port ${PORT}`)
  console.log(`[SERVER] Using persistent Stockfish engine`)
})
