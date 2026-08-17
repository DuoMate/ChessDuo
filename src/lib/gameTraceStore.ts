import { createClient } from '@supabase/supabase-js'

/**
 * Server-side sink for game-lifecycle trace events (black-bot investigation).
 * Same model as appErrorStore: anon-key, append-only into game_traces.
 */

let client: ReturnType<typeof createClient> | null = null

function getClient(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !anonKey) return null
  if (!client) client = createClient(url, anonKey)
  return client
}

type TraceInsert = {
  from: (table: string) => {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message?: string } | null }>
  }
}

export async function recordGameTrace(events: unknown[]): Promise<boolean> {
  if (!Array.isArray(events) || events.length === 0) return false
  try {
    const supabase = getClient()
    if (!supabase) return false
    const rows = events.map((e) => {
      const evt = (e ?? {}) as Record<string, unknown>
      const stockfish = (evt.stockfish ?? {}) as Record<string, unknown>
      return {
        event_id: evt.eventId ? String(evt.eventId) : null,
        stage: evt.stage ? String(evt.stage) : null,
        game_id: evt.gameId ? String(evt.gameId) : null,
        room_id: evt.roomId ? String(evt.roomId) : null,
        turn_number: typeof evt.turnNumber === 'number' ? evt.turnNumber : null,
        player_id: evt.playerId ? String(evt.playerId) : null,
        team: evt.team ? String(evt.team) : null,
        color: evt.color ? String(evt.color) : null,
        coordinator_id: evt.coordinatorId ? String(evt.coordinatorId) : null,
        duration_ms: typeof stockfish.durationMs === 'number' ? stockfish.durationMs : null,
        timeout: stockfish.timeout === true,
        fallback_used: stockfish.fallbackUsed === true,
        extra: evt.extra ? evt.extra : null,
      }
    })
    const { error } = await (supabase as unknown as TraceInsert)
      .from('game_traces')
      .insert(rows)
    return !error
  } catch {
    return false
  }
}
