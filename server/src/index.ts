import express, { Request, Response } from 'express'
import cors from 'cors'
import { Chess } from 'chess.js'
import { StockfishEngine } from './engine'
import { PolyglotBook } from './polyglot'

const app = express()
const PORT = process.env.PORT || 3001
const DEBUG = process.env.NODE_ENV !== 'production'

app.use(cors())
app.use(express.json())

function findStockfishPath(): string {
  const fs = require('fs')
  const paths = [
    '/usr/games/stockfish',
    '/usr/bin/stockfish',
    '/usr/local/bin/stockfish',
    'stockfish'
  ]
  return paths.find(p => fs.existsSync(p)) || 'stockfish'
}

export const STOCKFISH_PATH = findStockfishPath()
DEBUG && console.log(`[SERVER] Stockfish path: ${STOCKFISH_PATH}`)

const engine = new StockfishEngine(STOCKFISH_PATH)

// Load Polyglot opening book (optional — falls through to Stockfish if not found)
const bookPath = process.env.POLYGLOT_BOOK_PATH || ''
if (bookPath) {
  try {
    const book = new PolyglotBook(bookPath)
    if (book.isLoaded()) {
      engine.setBook(book)
      DEBUG && console.log(`[SERVER] Opening book active: ${bookPath}`)
    }
  } catch (err) {
    console.warn('[SERVER] Failed to load opening book, using Stockfish only:', err)
  }
} else {
  DEBUG && console.log('[SERVER] No POLYGLOT_BOOK_PATH set — using Stockfish only')
}

// Warm cache: pre-evaluate common opening positions after engine is ready
const WARMUP_FENS = [
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  'rnbqkbnr/1ppppppp/8/p7/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 1',
]

async function warmCache(eng: StockfishEngine): Promise<void> {
  DEBUG && console.log(`[WARMUP] Pre-evaluating ${WARMUP_FENS.length} common openings...`)
  let done = 0
  for (const fen of WARMUP_FENS) {
    try {
      const chess = new Chess(fen)
      const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to)
      const uniqueMoves = [...new Set(legalMoves)]
      if (uniqueMoves.length > 0) {
        await eng.evaluateMoves(fen, uniqueMoves)
      }
      done++
    } catch (err) {
      console.warn(`[WARMUP] Skipped ${fen}:`, err)
    }
  }
  DEBUG && console.log(`[WARMUP] Complete — ${done}/${WARMUP_FENS.length} positions cached`)
}

// Start warmup after engine is initialized (delay to ensure UCI is ready)
setTimeout(() => warmCache(engine), 4000)

app.get('/health', (_, res) => {
  res.json({ status: 'ok' })
})

app.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { fen } = req.body

    if (!fen) {
      return res.status(400).json({ error: 'Invalid request: fen required' })
    }

    const start = Date.now()

    const results = await engine.evaluateMoves(fen, [])
    const bestScore = results.length > 0 ? Math.max(...results.map(r => r.score)) : 0

    res.json({
      fen,
      score: bestScore,
      depth: 0,
      timeMs: Date.now() - start
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'engine_failed' })
  }
})

app.post('/evaluate-moves', async (req: Request, res: Response) => {
  try {
    const { fen, moves } = req.body

    if (!fen) {
      return res.status(400).json({ error: 'Invalid request: fen required' })
    }

    const start = Date.now()

    const results = await engine.evaluateMoves(fen, moves || [])

    res.json({
      success: true,
      moves: results,
      timeMs: Date.now() - start
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'engine_failed' })
  }
})

app.listen(PORT, () => {
  DEBUG && console.log(`🚀 Server running on port ${PORT}`)
})
