import express, { Request, Response } from 'express'
import cors from 'cors'
import { StockfishEngine } from './engine'

const app = express()
const PORT = process.env.PORT || 3001

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
console.log(`[SERVER] Stockfish path: ${STOCKFISH_PATH}`)

const engine = new StockfishEngine()

app.get('/health', (_, res) => {
  res.json({ status: 'ok' })
})

app.post('/evaluate-moves', async (req: Request, res: Response) => {
  try {
    const { fen, moves } = req.body

    if (!fen || !moves?.length) {
      return res.status(400).json({ error: 'Invalid request' })
    }

    const start = Date.now()

    const results = await engine.evaluateMoves(fen, moves)

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
  console.log(`🚀 Server running on port ${PORT}`)
})
