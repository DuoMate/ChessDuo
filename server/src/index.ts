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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

app.use(express.json())

interface EvaluateRequest {
  fen: string
  depth?: number
  uciElo?: number
}

const DEFAULT_DEPTH = parseInt(process.env.STOCKFISH_DEPTH || '20')
const EVAL_TIMEOUT = 30000
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
  uciElo: number
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

  const startTime = Date.now()
  const jobId = Math.random().toString(36).substring(7)

  console.log(`[STOCKFISH:${jobId}] Starting evaluation`)
  console.log(`[STOCKFISH:${jobId}] FEN: ${job.fen}`)
  console.log(`[STOCKFISH:${jobId}] Depth: ${job.depth}, UCI_Elo: ${job.uciElo}`)

  const proc = spawn(STOCKFISH_PATH, [], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  let output = ''
  let resolved = false
  let uciReady = false

  const timeout = setTimeout(() => {
    if (!resolved) {
      resolved = true
      proc.kill()
      activeProcesses--
      console.log(`[STOCKFISH:${jobId}] TIMEOUT after ${Date.now() - startTime}ms`)
      job.reject(new Error('Evaluation timeout'))
      processNext()
    }
  }, EVAL_TIMEOUT)

  proc.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      output += line + '\n'

      if (line.includes('uciok') && !uciReady) {
        uciReady = true
        console.log(`[STOCKFISH:${jobId}] UCI initialized, setting UCI_Elo: ${job.uciElo}`)
      }

      if (line.includes('score cp') && !resolved && uciReady) {
        const match = line.match(/score cp (-?\d+)/)
        if (match) {
          const score = parseInt(match[1], 10)
          const elapsed = Date.now() - startTime
          console.log(`[STOCKFISH:${jobId}] RESULT: cp=${score} (time: ${elapsed}ms)`)
          console.log(`[STOCKFISH:${jobId}] Full line: ${line.trim()}`)
          resolved = true
          clearTimeout(timeout)
          proc.kill()
          activeProcesses--
          job.resolve(score)
          processNext()
          return
        }
      }

      if (line.includes('score mate') && !resolved && uciReady) {
        const match = line.match(/score mate (-?\d+)/)
        if (match) {
          const mateIn = parseInt(match[1], 10)
          const score = mateIn > 0 ? 10000 : -10000
          const elapsed = Date.now() - startTime
          console.log(`[STOCKFISH:${jobId}] RESULT: mate=${mateIn} (score=${score}) (time: ${elapsed}ms)`)
          console.log(`[STOCKFISH:${jobId}] Full line: ${line.trim()}`)
          resolved = true
          clearTimeout(timeout)
          proc.kill()
          activeProcesses--
          job.resolve(score)
          processNext()
          return
        }
      }
    }
  })

  proc.stderr.on('data', (data: Buffer) => {
    console.log(`[STOCKFISH:${jobId}] STDERR: ${data.toString().trim()}`)
  })

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
  console.log(`[STOCKFISH:${jobId}] CMD: uci`)

  const checkUciOk = (data: Buffer) => {
    const str = data.toString()
    if (str.includes('uciok')) {
      proc.stdout.removeListener('data', checkUciOk)
      proc.stdin.write('setoption name UCI_LimitStrength true\n')
      console.log(`[STOCKFISH:${jobId}] CMD: setoption name UCI_LimitStrength true`)
      proc.stdin.write(`setoption name UCI_Elo ${job.uciElo}\n`)
      console.log(`[STOCKFISH:${jobId}] CMD: setoption name UCI_Elo ${job.uciElo}`)
      proc.stdin.write('isready\n')
      console.log(`[STOCKFISH:${jobId}] CMD: isready`)
      proc.stdin.write(`position fen ${job.fen}\n`)
      console.log(`[STOCKFISH:${jobId}] CMD: position fen ${job.fen.substring(0, 50)}...`)
      proc.stdin.write(`go depth ${job.depth}\n`)
      console.log(`[STOCKFISH:${jobId}] CMD: go depth ${job.depth}`)
    }
  }

  proc.stdout.on('data', checkUciOk)
}

function enqueueJob(fen: string, depth: number, uciElo: number = 2600): Promise<number> {
  return new Promise((resolve, reject) => {
    jobQueue.push({ fen, depth, uciElo, resolve, reject })
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
    const { fen, depth = DEFAULT_DEPTH, uciElo = 2600 } = req.body as EvaluateRequest

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    const startTime = Date.now()
    const score = await enqueueJob(fen, depth, uciElo)
    const elapsed = Date.now() - startTime

    res.json({
      fen,
      score,
      depth,
      uciElo,
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

app.post('/evaluate-multipv', async (req: Request, res: Response) => {
  try {
    const { fen, depth = 12, uciElo = 2600, multiPv = 6, movetime = 1500, searchMoves } = req.body as {
      fen: string
      depth?: number
      uciElo?: number
      multiPv?: number
      movetime?: number
      searchMoves?: string[]
    }

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    const startTime = Date.now()
    const moves = await evaluateWithMultiPV(fen, depth, uciElo, multiPv, movetime, searchMoves)
    const elapsed = Date.now() - startTime

    console.log(`[EVALUATE-MULTIPV] Response: ${JSON.stringify({ fen, moveCount: moves.length, moves: moves.slice(0, 3) })}`)

    res.json({
      success: true,
      fen,
      moves,
      depth,
      uciElo,
      multiPv,
      timeMs: elapsed
    })
  } catch (error) {
    console.error('[EVALUATE-MULTIPV] Error:', error)
    res.status(500).json({
      success: false,
      error: 'engine_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.post('/evaluate-moves', async (req: Request, res: Response) => {
  try {
    const { fen, moves, uciElo = 2600, movetime = 500 } = req.body as {
      fen: string
      moves: string[]
      uciElo?: number
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
    
    const results = await Promise.all(
      moves.map(move => evaluateSingleMove(fen, move, uciElo, movetime))
    )

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

function parseMultiPVLine(line: string): { multipv: number; move: string; score: number } | null {
  if (!line.includes('multipv') || !line.includes('pv')) {
    return null
  }

  const multipvMatch = line.match(/\bmultipv\s+(\d+)/)
  if (!multipvMatch) return null
  const multipv = parseInt(multipvMatch[1], 10)

  let score = 0
  const cpMatch = line.match(/score\s+cp\s+(-?\d+)/)
  const mateMatch = line.match(/score\s+mate\s+(-?\d+)/)

  if (cpMatch) {
    score = parseInt(cpMatch[1], 10)
  } else if (mateMatch) {
    const mateIn = parseInt(mateMatch[1], 10)
    score = mateIn > 0 ? 10000 - mateIn : -10000 - mateIn
  } else {
    return null
  }

  const pvMatch = line.match(/\bpv\s+(.+)/)
  if (!pvMatch) return null

  const pvMoves = pvMatch[1].trim().split(/\s+/)
  const move = pvMoves[0]

  if (!move || move.length < 4) {
    return null
  }

  return { multipv, move, score }
}

function evaluateWithMultiPV(fen: string, depth: number, uciElo: number, multiPv: number, movetime: number = 1500, searchMoves?: string[]): Promise<{ move: string; score: number }[]> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const jobId = Math.random().toString(36).substring(7)

    console.log(`[MULTIPV:${jobId}] ============================================`)
    console.log(`[MULTIPV:${jobId}] STARTING MultiPV evaluation`)
    console.log(`[MULTIPV:${jobId}] FEN: ${fen}`)
    console.log(`[MULTIPV:${jobId}] Config: depth=${depth}, movetime=${movetime}ms, UCI_Elo=${uciElo}, MultiPV=${multiPv}`)
    if (searchMoves) {
      console.log(`[MULTIPV:${jobId}] Searchmoves: ${searchMoves.join(', ')}`)
    }
    console.log(`[MULTIPV:${jobId}] ============================================`)

    const proc = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const results: Record<number, { move: string; score: number }> = {}
    let resolved = false
    let uciReady = false
    let ready = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        proc.kill()
        console.log(`[MULTIPV:${jobId}] TIMEOUT after ${Date.now() - startTime}ms`)
        reject(new Error('MultiPV evaluation timeout'))
      }
    }, EVAL_TIMEOUT)

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')

      for (const line of lines) {
        if (!line.trim()) continue

        if (line.includes('uciok') && !uciReady) {
          uciReady = true
          console.log(`[MULTIPV:${jobId}] >> UCI ready, setting options...`)
          const effectiveMultiPv = searchMoves && searchMoves.length > 0 ? Math.min(searchMoves.length, multiPv) : multiPv
          console.log(`[MULTIPV:${jobId}] >> Setting MultiPV to ${effectiveMultiPv}`)
          proc.stdin.write('setoption name UCI_LimitStrength true\n')
          proc.stdin.write(`setoption name UCI_Elo ${uciElo}\n`)
          proc.stdin.write(`setoption name MultiPV value ${effectiveMultiPv}\n`)
          proc.stdin.write('ucinewgame\n')
          proc.stdin.write('isready\n')
          console.log(`[MULTIPV:${jobId}] >> Waiting for readyok...`)
        }

        if (line.includes('readyok') && !ready) {
          ready = true
          console.log(`[MULTIPV:${jobId}] >> Ready, sending position and go...`)
          proc.stdin.write(`position fen ${fen}\n`)
          let goCmd = `go movetime ${movetime}`
          if (searchMoves && searchMoves.length > 0) {
            goCmd += ' searchmoves ' + searchMoves.join(' ')
          }
          proc.stdin.write(goCmd + '\n')
          console.log(`[MULTIPV:${jobId}] >> Commands sent, waiting for results...`)
        }

        if (line.includes('multipv') && line.includes('score') && line.includes('pv')) {
          console.log(`[MULTIPV:${jobId}] >> RAW: ${line}`)

          const parsed = parseMultiPVLine(line)
          if (parsed) {
            if (searchMoves && searchMoves.length > 0 && !searchMoves.includes(parsed.move)) {
              console.log(`[MULTIPV:${jobId}] ## FILTERED (not in searchmoves): ${parsed.move}`)
              continue
            }
            results[parsed.multipv] = { move: parsed.move, score: parsed.score }
            console.log(`[MULTIPV:${jobId}] ## multipv ${parsed.multipv}: move=${parsed.move} score=${parsed.score}`)
          } else {
            console.log(`[MULTIPV:${jobId}] ## FAILED TO PARSE LINE`)
          }
        }

        if (line.includes('bestmove') && !resolved) {
          resolved = true
          clearTimeout(timeout)
          proc.kill()

          const sorted = Object.entries(results)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, v]) => v)

          const elapsed = Date.now() - startTime
          console.log(`[MULTIPV:${jobId}] ============================================`)
          console.log(`[MULTIPV:${jobId}] COMPLETE: ${sorted.length} moves in ${elapsed}ms`)
          console.log(`[MULTIPV:${jobId}] RETURNING TO CLIENT:`)
          sorted.slice(0, 5).forEach((m, i) => {
            console.log(`[MULTIPV:${jobId}]   ${i + 1}. move=${m.move} score=${m.score}`)
          })
          console.log(`[MULTIPV:${jobId}] ============================================`)

          resolve(sorted)
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      const str = data.toString().trim()
      if (str) {
        console.log(`[MULTIPV:${jobId}] STDERR: ${str}`)
      }
    })

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        console.log(`[MULTIPV:${jobId}] ERROR: ${err.message}`)
        reject(err)
      }
    })

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        console.log(`[MULTIPV:${jobId}] EXITED with code ${code}`)
        resolve([])
      }
    })

    proc.stdin.write('uci\n')
    console.log(`[MULTIPV:${jobId}] >> uci`)
  })
}

function evaluateSingleMove(fen: string, move: string, uciElo: number, movetime: number): Promise<{ move: string; score: number }> {
  return new Promise((resolve, reject) => {
    const jobId = Math.random().toString(36).substring(7)

    console.log(`[SINGLE:${jobId}] Evaluating move ${move} in position ${fen.substring(0, 40)}...`)

    const proc = spawn(STOCKFISH_PATH, [], { stdio: ['pipe', 'pipe', 'pipe'] })

    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        proc.kill()
        console.log(`[SINGLE:${jobId}] TIMEOUT for move ${move}`)
        resolve({ move, score: -500 })
      }
    }, 10000)

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')

      for (const line of lines) {
        if (!line.trim()) continue

        if (line.includes('uciok')) {
          proc.stdin.write('setoption name UCI_LimitStrength true\n')
          proc.stdin.write(`setoption name UCI_Elo ${uciElo}\n`)
          proc.stdin.write('ucinewgame\n')
          proc.stdin.write('isready\n')
        }

        if (line.includes('readyok')) {
          proc.stdin.write(`position fen ${fen} moves ${move}\n`)
          proc.stdin.write(`go movetime ${movetime}\n`)
        }

        if (line.includes('score cp') && !resolved) {
          const match = line.match(/score cp (-?\d+)/)
          if (match) {
            resolved = true
            clearTimeout(timeout)
            proc.kill()
            const score = parseInt(match[1], 10)
            console.log(`[SINGLE:${jobId}] Move ${move}: score=${score}`)
            resolve({ move, score })
          }
        }

        if (line.includes('score mate') && !resolved) {
          const match = line.match(/score mate (-?\d+)/)
          if (match) {
            resolved = true
            clearTimeout(timeout)
            proc.kill()
            const mate = parseInt(match[1], 10)
            const score = mate > 0 ? 10000 - mate : -10000 - mate
            console.log(`[SINGLE:${jobId}] Move ${move}: mate=${mate} score=${score}`)
            resolve({ move, score })
          }
        }

        if (line.startsWith('bestmove') && !resolved) {
          resolved = true
          clearTimeout(timeout)
          proc.kill()
          console.log(`[SINGLE:${jobId}] Move ${move}: no score (using -500)`)
          resolve({ move, score: -500 })
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      const str = data.toString().trim()
      if (str) {
        console.log(`[SINGLE:${jobId}] STDERR: ${str}`)
      }
    })

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        console.log(`[SINGLE:${jobId}] ERROR: ${err.message}`)
        resolve({ move, score: -500 })
      }
    })

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        console.log(`[SINGLE:${jobId}] EXITED with code ${code}`)
      }
    })

    proc.stdin.on('error', () => {
      console.log(`[SINGLE:${jobId}] stdin error (EPIPE likely)`)
    })

    proc.stdin.write('uci\n')
  })
}

app.post('/play-move', async (req: Request, res: Response) => {
  try {
    const { fen, uciElo = 2600, movetime = 1000 } = req.body as { fen: string, uciElo?: number, movetime?: number }

    if (!fen) {
      res.status(400).json({ error: 'FEN is required' })
      return
    }

    const startTime = Date.now()
    const move = await enqueuePlayMove(fen, uciElo, movetime)
    const elapsed = Date.now() - startTime

    res.json({
      fen,
      move,
      uciElo,
      timeMs: elapsed
    })
  } catch (error) {
    console.error('[PLAY-MOVE] Error:', error)
    res.status(500).json({
      error: 'Play move failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

function enqueuePlayMove(fen: string, uciElo: number, movetime: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const jobId = Math.random().toString(36).substring(7)

    console.log(`[STOCKFISH:${jobId}] Starting play-move`)
    console.log(`[STOCKFISH:${jobId}] FEN: ${fen}`)
    console.log(`[STOCKFISH:${jobId}] UCI_Elo: ${uciElo}, movetime: ${movetime}ms`)

    const proc = spawn(STOCKFISH_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        proc.kill()
        console.log(`[STOCKFISH:${jobId}] TIMEOUT after ${Date.now() - startTime}ms`)
        reject(new Error('Play move timeout'))
      }
    }, EVAL_TIMEOUT)

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        output += line + '\n'
        console.log(`[STOCKFISH:${jobId}] ${line.trim()}`)

        const bestMoveMatch = line.match(/bestmove\s+(\S+)/)
        if (bestMoveMatch && !resolved) {
          const move = bestMoveMatch[1]
          const elapsed = Date.now() - startTime
          console.log(`[STOCKFISH:${jobId}] RESULT: move=${move} (time: ${elapsed}ms)`)
          resolved = true
          clearTimeout(timeout)
          proc.kill()
          resolve(move)
          return
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      console.log(`[STOCKFISH:${jobId}] STDERR: ${data.toString().trim()}`)
    })

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
        resolve('resign')
      }
    })

    proc.stdin.write('uci\n')
    console.log(`[STOCKFISH:${jobId}] CMD: uci`)

    const checkUciOk = (data: Buffer) => {
      const str = data.toString()
      if (str.includes('uciok')) {
        proc.stdout.removeListener('data', checkUciOk)
        proc.stdin.write('setoption name UCI_LimitStrength true\n')
        console.log(`[STOCKFISH:${jobId}] CMD: setoption name UCI_LimitStrength true`)
        proc.stdin.write(`setoption name UCI_Elo ${uciElo}\n`)
        console.log(`[STOCKFISH:${jobId}] CMD: setoption name UCI_Elo ${uciElo}`)
        proc.stdin.write('isready\n')
        proc.stdin.write(`position fen ${fen}\n`)
        console.log(`[STOCKFISH:${jobId}] CMD: position fen ${fen.substring(0, 50)}...`)
        proc.stdin.write(`go movetime ${movetime}\n`)
        console.log(`[STOCKFISH:${jobId}] CMD: go movetime ${movetime}`)
      }
    }

    proc.stdout.on('data', checkUciOk)
  })
}

process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down...')
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
  console.log(`[SERVER] Bounded concurrency: max ${MAX_CONCURRENT} processes`)
})
