import { getAppBaseUrl } from '../../lib/appUrl'

/**
 * Deterministic game-lifecycle trace (P0-1/P1 black-bot investigation).
 *
 * Framework-free. When enabled (NEXT_PUBLIC_CHESSDUO_TRACE=true or
 * NEXT_PUBLIC_CHESSDUO_DIAGNOSTICS=true) it emits structured single-line
 * events for every lifecycle stage, keeps them in a per-session buffer
 * (exposed on window.__chessDuoTrace for the reproduction harness), and
 * best-effort flushes batches to the /api/log-crash pipeline
 * (error_type = 'game_trace'), which persists into app_errors.
 *
 * NO behavior is changed — this is observation only.
 */

export type TraceStage =
  | 'GAME_CREATED'
  | 'ROOM_FILLED'
  | 'SIDES_ASSIGNED'
  | 'COORDINATOR_ASSIGNED'
  | 'GAME_STARTED'
  | 'TURN_STARTED'
  | 'BOT_TURN_DETECTED'
  | 'STOCKFISH_STARTED'
  | 'STOCKFISH_READY'
  | 'STOCKFISH_COMPLETED'
  | 'MOVE_SELECTED'
  | 'TURN_RESOLUTION_STARTED'
  | 'TURN_RESOLVED'
  | 'GAME_STATE_SAVED'
  | 'GAME_STATE_SAVE_FAILED'
  | 'REALTIME_BROADCAST'
  | 'CLIENT_RECEIVED'
  | 'TURN_COMPLETED'

export interface TraceCtx {
  gameId?: string
  roomId?: string
  turnNumber?: number
  playerId?: string
  team?: string
  color?: string
  coordinatorId?: string
  extra?: Record<string, unknown>
  stockfish?: {
    evaluationStartTime?: number
    evaluationEndTime?: number
    durationMs?: number
    timeout?: boolean
    fallbackUsed?: boolean
  }
}

export interface TraceEvent extends Required<Omit<TraceCtx, 'extra' | 'stockfish'>> {
  eventId: string
  stage: TraceStage
  timestamp: string
  extra: Record<string, unknown>
  stockfish: NonNullable<TraceCtx['stockfish']>
}

const ENABLED =
  process.env.NEXT_PUBLIC_CHESSDUO_TRACE === 'true' ||
  process.env.NEXT_PUBLIC_CHESSDUO_DIAGNOSTICS === 'true'

let seq = 0
const buffer: TraceEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const FLUSH_MS = 5000
const FLUSH_BATCH = 50

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (buffer.length === 0) return
  const batch = buffer.splice(0, FLUSH_BATCH)
  if (typeof window === 'undefined') return
  try {
    fetch(`${getAppBaseUrl()}/api/log-crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'GAME_TRACE',
        error_type: 'game_trace',
        platform: 'web',
        trace: batch,
      }),
    }).catch(() => {
      // best-effort; buffered copy remains on window for the harness
    })
  } catch {
    // best-effort
  }
}

function scheduleFlush(): void {
  if (typeof window === 'undefined') return
  if (flushTimer) return
  flushTimer = setTimeout(flush, FLUSH_MS)
}

export function emitTrace(stage: TraceStage, ctx: TraceCtx): void {
  if (!ENABLED) return
  seq++
  const now = Date.now()
  const evt: TraceEvent = {
    eventId: `evt-${seq}`,
    stage,
    gameId: ctx.gameId ?? '',
    roomId: ctx.roomId ?? '',
    turnNumber: ctx.turnNumber ?? 0,
    playerId: ctx.playerId ?? '',
    team: ctx.team ?? '',
    color: ctx.color ?? '',
    coordinatorId: ctx.coordinatorId ?? '',
    timestamp: new Date(now).toISOString(),
    extra: ctx.extra ?? {},
    stockfish: {
      evaluationStartTime: ctx.stockfish?.evaluationStartTime ?? null,
      evaluationEndTime: ctx.stockfish?.evaluationEndTime ?? null,
      durationMs: ctx.stockfish?.durationMs ?? null,
      timeout: ctx.stockfish?.timeout ?? false,
      fallbackUsed: ctx.stockfish?.fallbackUsed ?? false,
    },
  }
  try {
    console.debug('[GAME-TRACE] ' + JSON.stringify(evt))
  } catch {
    // console may be unavailable in some WebViews
  }
  buffer.push(evt)
  scheduleFlush()

  if (typeof window !== 'undefined') {
    ;(window as unknown as { __chessDuoTrace: TraceEvent[] }).__chessDuoTrace = [...buffer]
  }
}

export function getTraceBuffer(): TraceEvent[] {
  return [...buffer]
}
