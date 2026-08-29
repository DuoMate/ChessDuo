import { Chess } from 'chess.js'
import { CHECKMATE_SCORE } from '../shared/gameConstants'

/**
 * Dedicated Stockfish analysis worker for Coach Mode.
 *
 * Isolation: Coach Mode must NOT reuse the production `BrowserMoveEvaluator`
 * shared singleton — it hardcodes `MultiPV 6` and a fixed 3000ms movetime, and
 * its worker is shared with the opponent bot. This engine owns its own Worker,
 * configures `MultiPV` per query, and only supports analysis (no move resolution
 * state). Failure to initialise degrades to "coach unavailable", never a crash.
 */

const WORKER_PATH = '/stockfish/stockfish.js'
const INIT_TIMEOUT_MS = 15000
const SEARCH_TIMEOUT_MS = 30000
const DEFAULT_MOVETIME_MS = 1500

export interface EngineMove {
  /** UCI long-algebraic move (e.g. `e2e4`, `e7e8q`). */
  uci: string
  /** SAN of the move. */
  san: string
  /** Centipawn score from side-to-move perspective (null when mate). */
  cp: number | null
  /** Mate distance from side-to-move perspective (positive = side to move mates). */
  mate: number | null
  /** Principal variation (first entry = the move itself). */
  pv: string[]
}

/** Normalise a score to a single comparable number (white-ish, higher = better for side to move). */
export function normalizeEngineScore(cp: number | null, mate: number | null): number {
  if (mate !== null) {
    return mate > 0 ? CHECKMATE_SCORE - mate : -CHECKMATE_SCORE - mate
  }
  return cp ?? 0
}

function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen)
    const promotion = uci.length >= 5 ? uci[4] : undefined
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined })
    return move.san
  } catch {
    return uci
  }
}

interface ParsedInfo {
  multipv: number
  cp: number | null
  mate: number | null
  pv: string[]
}

function parseInfoLine(line: string): ParsedInfo | null {
  if (!line.startsWith('info') || !line.includes(' pv ')) return null
  const multipvMatch = line.match(/multipv (\d+)/)
  const cpMatch = line.match(/score cp (-?\d+)/)
  const mateMatch = line.match(/score mate (-?\d+)/)
  const pvMatch = line.match(/ pv (.+)$/)
  return {
    multipv: multipvMatch ? parseInt(multipvMatch[1], 10) : 1,
    cp: cpMatch ? parseInt(cpMatch[1], 10) : null,
    mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
    pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : [],
  }
}

export class CoachEngine {
  private worker: Worker | null = null
  private _initError: string | null = null
  private _ready = false
  private _readyPromise: Promise<void> | null = null
  private _queue: Promise<unknown> = Promise.resolve()

  constructor() {
    try {
      this.worker = new Worker(WORKER_PATH)
      this.worker.onmessage = () => {}
      this._readyPromise = this._init()
    } catch (err) {
      this._initError = `Failed to create Stockfish worker: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  private _init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error(this._initError ?? 'No worker'))
        return
      }
      const timeout = setTimeout(() => {
        reject(new Error('Stockfish worker init timed out'))
      }, INIT_TIMEOUT_MS)

      const handler = (e: MessageEvent<string>) => {
        const line = (e.data || '').trim()
        if (line === 'readyok') {
          clearTimeout(timeout)
          this.worker!.removeEventListener('message', handler)
          this._ready = true
          resolve()
        }
      }
      this.worker.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('Stockfish worker error during init'))
      }
      this.worker.addEventListener('message', handler)
      this.worker.postMessage('uci')
      this.worker.postMessage('setoption name MultiPV value 3')
      this.worker.postMessage('isready')
    })
  }

  getInitError(): string | null {
    return this._initError
  }

  isReady(): boolean {
    return this._ready && !this._initError
  }

  async waitForReady(timeoutMs = INIT_TIMEOUT_MS): Promise<void> {
    if (this.isReady()) return
    if (this._initError) throw new Error(`Coach engine failed: ${this._initError}`)
    if (!this._readyPromise) throw new Error('Coach engine not initialised')
    await Promise.race([
      this._readyPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Coach engine ready timeout')), timeoutMs)),
    ])
  }

  /** Serialise all searches through one queue so UCI commands never interleave. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this._queue.then(fn, fn)
    this._queue = run.catch(() => {})
    return run
  }

  /**
   * Rank the top `count` moves in a position (MultiPV = count), best-first from
   * side-to-move perspective. Returns [] on engine failure (coach degrades).
   */
  async analyzeTopMoves(fen: string, count = 3, movetimeMs = DEFAULT_MOVETIME_MS): Promise<EngineMove[]> {
    if (count < 1) count = 1
    return this.enqueue(async () => {
      try {
        await this.waitForReady()
      } catch {
        return [] as EngineMove[]
      }
      if (!this.worker) return []

      const infoByMultiPv = new Map<number, EngineMove>()
      const sorted = await this.runSearch(fen, `setoption name MultiPV value ${count}`, `go movetime ${movetimeMs}`, movetimeMs, (parsed) => {
        if (parsed.pv.length === 0) return
        const uci = parsed.pv[0]
        infoByMultiPv.set(parsed.multipv, {
          uci,
          san: uciToSan(fen, uci),
          cp: parsed.cp,
          mate: parsed.mate,
          pv: parsed.pv,
        })
      })
      void sorted
      return Array.from(infoByMultiPv.values()).sort((a, b) => normalizeEngineScore(b.cp, b.mate) - normalizeEngineScore(a.cp, a.mate))
    })
  }

  /** Score a single move exactly (searchmoves). Degrades to `{uci, san, cp:null, mate:null}` on failure. */
  async scoreMove(fen: string, uci: string, movetimeMs = DEFAULT_MOVETIME_MS): Promise<EngineMove> {
    return this.enqueue(async () => {
      const fallback: EngineMove = { uci, san: uciToSan(fen, uci), cp: null, mate: null, pv: [uci] }
      try {
        await this.waitForReady()
      } catch {
        return fallback
      }
      if (!this.worker) return fallback

      let cp: number | null = null
      let mate: number | null = null
      await this.runSearch(fen, '', `go searchmoves ${uci} movetime ${movetimeMs}`, movetimeMs, (parsed) => {
        cp = parsed.cp
        mate = parsed.mate
      })
      return { uci, san: uciToSan(fen, uci), cp, mate, pv: [uci] }
    })
  }

  /** Evaluate a position (best move + score from side to move). */
  async evaluatePosition(fen: string, movetimeMs = DEFAULT_MOVETIME_MS): Promise<EngineMove | null> {
    const top = await this.analyzeTopMoves(fen, 1, movetimeMs)
    return top[0] ?? null
  }

  private runSearch(
    fen: string,
    setupCommand: string,
    goCommand: string,
    movetimeMs: number,
    onInfo: (parsed: ParsedInfo) => void,
  ): Promise<string> {
    return new Promise((resolve) => {
      const worker = this.worker!
      const timeout = setTimeout(() => {
        cleanup()
        resolve('')
      }, movetimeMs + SEARCH_TIMEOUT_MS)

      const handler = (e: MessageEvent<string>) => {
        const line = (e.data || '').trim()
        if (!line) return
        const parsed = parseInfoLine(line)
        if (parsed) onInfo(parsed)
        if (line.startsWith('bestmove')) {
          clearTimeout(timeout)
          cleanup()
          const parts = line.split(' ')
          resolve(parts.length >= 2 ? parts[1] : '')
        }
      }

      const cleanup = () => {
        worker.removeEventListener('message', handler)
      }

      worker.addEventListener('message', handler)
      worker.postMessage(`position fen ${fen}`)
      if (setupCommand) worker.postMessage(setupCommand)
      worker.postMessage(goCommand)
    })
  }

  terminate(): void {
    this._ready = false
    this._readyPromise = null
    if (this.worker) {
      try {
        this.worker.terminate()
      } catch {
        // Worker already gone — nothing to clean up.
      }
      this.worker = null
    }
  }
}
