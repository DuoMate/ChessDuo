import { DEBUG } from './debug'
import { hashId } from './duoJoinTrace'

// Structured, dev-gated diagnostics for the Duo lifecycle state machine.
// Mirrors the [DUO_JOIN] / [ONLINE] conventions: DEBUG is enabled in dev and in
// production only via ?debug=1 or localStorage chessduo_debug=1, so this has no
// runtime cost in normal production. Never log tokens, passwords, or service
// keys — only a short non-reversible hash of the authenticated user id.

export type DuoStage = 'ROOM' | 'GAME' | 'REALTIME' | 'MOVE' | 'CLOCK' | 'STATE'

interface DuoTraceMeta {
  roomId?: string | null
  gameId?: string | null
  userId?: string | null
  event?: string
  prev?: unknown
  next?: unknown
  errorCode?: string
  errorMessage?: string
  [key: string]: unknown
}

export function traceDuo(stage: DuoStage, meta: DuoTraceMeta = {}): void {
  if (!DEBUG) return
  try {
    const { userId, roomId, gameId, ...rest } = meta
    console.log(`[DUO:${stage}]`, JSON.stringify({
      t: new Date().toISOString(),
      roomId: roomId ?? undefined,
      gameId: gameId ?? undefined,
      user: userId ? hashId(userId) : undefined,
      ...rest,
    }))
  } catch {
    // Logging must never break the game flow.
  }
}
