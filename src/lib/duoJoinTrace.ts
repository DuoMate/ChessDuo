import { DEBUG } from './debug'

// Structured tracing for the Duo room-join flow. Gated by DEBUG (enabled in
// dev, or in prod via ?debug=1 / localStorage chessduo_debug=1) so it has no
// runtime cost in normal production. Never log tokens, passwords, or service
// keys — only short, non-reversible hashes of sensitive identifiers.

function hash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8)
}

export function hashId(input?: string | null): string | undefined {
  if (!input) return undefined
  return hash(input)
}

export type DuoJoinStage =
  | 'DUO_JOIN_STARTED'
  | 'DUO_JOIN_ROOM_FOUND'
  | 'DUO_JOIN_ROOM_LOCKED'
  | 'DUO_JOIN_VALIDATED'
  | 'DUO_JOIN_EXISTING_MEMBER'
  | 'DUO_JOIN_TEAM_ASSIGNED'
  | 'DUO_JOIN_SLOT_ASSIGNED'
  | 'DUO_JOIN_PLAYER_INSERTED'
  | 'DUO_JOIN_SUCCESS'
  | 'DUO_JOIN_FAILED'

interface DuoJoinTraceMeta {
  requestId?: string
  roomId?: string | null
  codeHash?: string
  userIdHash?: string
  errorCode?: string
  errorMessage?: string
  [key: string]: unknown
}

export function traceDuoJoin(stage: DuoJoinStage, meta: DuoJoinTraceMeta = {}): void {
  if (!DEBUG) return
  try {
    console.log(`[DUO_JOIN] ${stage}`, JSON.stringify({ stage, t: new Date().toISOString(), ...meta }))
  } catch {
    // Logging must never break the join flow.
  }
}
