import express, { Request, Response } from 'express'
import cors from 'cors'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

interface EvaluateRequest {
  fen: string
  depth?: number
  skillLevel?: number
}

interface StockfishInstance {
  process: ChildProcess
  ready: boolean
  pendingResolve: ((score: number) => void) | null
  pendingReject: ((error: Error) => void) | null
  timeout: NodeJS.Timeout | null
}

const instances: Map<string, StockfishInstance> = new Map()
const STOCKFISH_PATHS = [
  '/usr/local/bin/stockfish',
  '/usr/local/bin/stockfish/stockfish',
  'stockfish',
  '/usr/bin/stockfish',
  './stockfish-linux',
  path.join(__dirname, '../stockfish/stockfish16nnue')
]

function findStockfishPath(): string {
  for (const p of STOCKFISH_PATHS) {
    try {
      return p
    } catch {
      continue
    }
  }
  return 'stockfish'
}

function createStockfishInstance(instanceId: string): StockfishInstance {
  const stockfishPath = findStockfishPath()
  
  const proc = spawn(stockfishPath, [], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const instance: StockfishInstance = {
    process: proc,
    ready: false,
    pendingResolve: null,
    pendingReject: null,
    timeout: null
  }

  proc.on('error', (err) => {
    console.error(`[Stockfish:${instanceId}] Process error:`, err.message)
    cleanupInstance(instanceId)
  })

  proc.on('exit', (code) => {
    console.log(`[Stockfish:${instanceId}] Process exited with code ${code}`)
    cleanupInstance(instanceId)
  })

  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      handleStockfishOutput(instanceId, line.trim())
    }
  })

  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[Stockfish:${instanceId}] stderr:`, data.toString())
  })

  sendUciCommand(instanceId, 'uci')
  
  return instance
}

function sendUciCommand(instanceId: string, command: string): void {
  const instance = instances.get(instanceId)
  if (!instance || !instance.process.stdin) return
  
  instance.process.stdin.write(command + '\n')
  console.log(`[Stockfish:${instanceId}] >>> ${command}`)
}

function handleStockfishOutput(instanceId: string, line: string): void {
  const instance = instances.get(instanceId)
  if (!instance) return

  console.log(`[Stockfish:${instanceId}] <<< ${line}`)

  if (line === 'uciok' && !instance.ready) {
    sendUciCommand(instanceId, 'isready')
  }

  if (line === 'readyok' && !instance.ready) {
    instance.ready = true
    console.log(`[Stockfish:${instanceId}] Ready!`)
  }

  if (line.startsWith('info') && line.includes('score cp')) {
    const match = line.match(/score cp (-?\d+)/)
    if (match) {
      const score = parseInt(match[1], 10)
      if (instance.pendingResolve && !instance.timeout) {
        clearTimeout(instance.timeout!)
        instance.pendingResolve(score)
        instance.pendingResolve = null
        instance.pendingReject = null
      }
    }
  }

  if (line.startsWith('info') && line.includes('score mate')) {
    const match = line.match(/score mate (-?\d+)/)
    if (match) {
      const mateIn = parseInt(match[1], 10)
      const score = mateIn > 0 ? 10000 : -10000
      if (instance.pendingResolve) {
        clearTimeout(instance.timeout!)
        instance.pendingResolve(score)
        instance.pendingResolve = null
        instance.pendingReject = null
      }
    }
  }

  if (line.startsWith('bestmove')) {
    if (instance.pendingResolve) {
      clearTimeout(instance.timeout!)
      instance.pendingResolve(0)
      instance.pendingResolve = null
      instance.pendingReject = null
    }
  }
}

function cleanupInstance(instanceId: string): void {
  const instance = instances.get(instanceId)
  if (!instance) return

  if (instance.timeout) {
    clearTimeout(instance.timeout)
  }

  if (instance.process && !instance.process.killed) {
    instance.process.kill()
  }

  instances.delete(instanceId)
}

async function evaluatePosition(fen: string, depth: number = 15): Promise<number> {
  const instanceId = 'eval'
  
  let instance = instances.get(instanceId)
  if (!instance || !instance.ready) {
    if (instance) cleanupInstance(instanceId)
    instance = createStockfishInstance(instanceId)
    instances.set(instanceId, instance)
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanupInstance(instanceId)
        reject(new Error('Stockfish initialization timeout'))
      }, 15000)
      
      const checkReady = setInterval(() => {
        const inst = instances.get(instanceId)
        if (inst?.ready) {
          clearTimeout(timeout)
          clearInterval(checkReady)
          resolve()
        }
      }, 100)
    })
  }

  return new Promise<number>((resolve, reject) => {
    const inst = instances.get(instanceId)
    if (!inst) {
      reject(new Error('Stockfish instance not found'))
      return
    }

    inst.pendingResolve = resolve
    inst.pendingReject = reject

    inst.timeout = setTimeout(() => {
      if (inst.pendingResolve) {
        console.log(`[Stockfish:${instanceId}] Timeout, resolving with 0`)
        inst.pendingResolve(0)
        inst.pendingResolve = null
        inst.pendingReject = null
      }
    }, 10000)

    sendUciCommand(instanceId, `position fen ${fen}`)
    sendUciCommand(instanceId, `go depth ${depth}`)
  })
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', instances: instances.size })
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
    const score = await evaluatePosition(fen, depth)
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

    console.log(`\n[EVALUATE-BATCH] ${positions.length} positions, Depth: ${depth}`)

    const results: { fen: string, score: number, timeMs: number }[] = []

    for (const fen of positions) {
      const startTime = Date.now()
      const score = await evaluatePosition(fen, depth)
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
  console.log('[SERVER] SIGTERM received, cleaning up...')
  for (const [id] of instances) {
    cleanupInstance(id)
  }
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, cleaning up...')
  for (const [id] of instances) {
    cleanupInstance(id)
  }
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`[SERVER] Stockfish server running on port ${PORT}`)
  console.log(`[SERVER] Endpoints:`)
  console.log(`[SERVER]   GET  /health - Health check`)
  console.log(`[SERVER]   POST /evaluate - Evaluate single position`)
  console.log(`[SERVER]   POST /evaluate-batch - Evaluate multiple positions`)
})