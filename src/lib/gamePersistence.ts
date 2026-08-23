import { supabase } from './supabase'
import { DEBUG } from './debug'
import { emitTrace } from '@/features/shared/gameTrace'

interface GameSaveData {
  room_id: string
  fen: string
  current_turn: string
  move_history: Array<{
    team: string
    move: string
    fen_before: string
    fen_after: string
    timestamp: string
  }>
  status: string
  match_started_at?: string
  match_time_limit_seconds?: number
  turn_number?: number
  coordinator_id?: string
  last_resolved_move?: string
  last_human_resolution?: unknown
}

// Columns that only exist after the ADR-005 / resolution-state migration. When
// the prod DB predates the migration these make the WHOLE upsert fail
// (PGRST204), which previously left the games row frozen at its starting FEN.
// They are cosmetic/panel state — the board-critical columns must persist even
// on an unmigrated schema, so they are stripped and the upsert retried once.
const OPTIONAL_PERSIST_COLUMNS = ['last_resolved_move', 'last_human_resolution'] as const

const GAMES_FULL_COLUMNS = 'id, fen, current_turn, move_history, status, match_started_at, match_time_limit_seconds, turn_number, coordinator_id, turn_phase, last_resolved_move, last_human_resolution'
// Board-critical fallback set for pre-migration schemas (schema drift).
const GAMES_CORE_COLUMNS = 'id, fen, current_turn, move_history, status, match_started_at, match_time_limit_seconds, turn_number, coordinator_id'

function isSchemaDriftError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  // PGRST204 = PostgREST "column not found in schema cache"; older stacks may
  // surface it as a generic "Could not find the '<col>' column" message.
  return error.code === 'PGRST204' || /could not find the/i.test(error.message || '')
}

function stripOptionalPersistColumns(data: Record<string, unknown>): Record<string, unknown> {
  const stripped = { ...data }
  for (const col of OPTIONAL_PERSIST_COLUMNS) {
    delete stripped[col]
  }
  return stripped
}

export async function saveGameState(roomId: string, fen: string, currentTurn: string, moveEntry: GameSaveData['move_history'][number] | null, status: string, matchStartedAt?: string, matchTimeLimit?: number, turnNumber?: number, coordinatorId?: string, lastResolvedMove?: string, lastHumanResolution?: unknown): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('games')
      .select('move_history, match_started_at')
      .eq('room_id', roomId)
      .maybeSingle()

    const moveHistory: GameSaveData['move_history'] = existing?.move_history || []
    if (moveEntry) {
      moveHistory.push(moveEntry)
    }

    const upsertData: Record<string, unknown> = {
      room_id: roomId,
      fen,
      current_turn: currentTurn,
      move_history: moveHistory,
      status,
      updated_at: new Date().toISOString()
    }

    if (matchStartedAt) {
      upsertData.match_started_at = matchStartedAt
    }
    if (matchTimeLimit !== undefined) {
      upsertData.match_time_limit_seconds = matchTimeLimit
    }
    if (turnNumber !== undefined) {
      upsertData.turn_number = turnNumber
    }
    if (coordinatorId !== undefined) {
      upsertData.coordinator_id = coordinatorId
    }
    if (lastResolvedMove !== undefined) {
      upsertData.last_resolved_move = lastResolvedMove
    }
    if (lastHumanResolution !== undefined) {
      upsertData.last_human_resolution = lastHumanResolution
    }

    let result = await supabase
      .from('games')
      .upsert(upsertData, { onConflict: 'room_id' })
      .select('id')
      .single()

    if (result.error && isSchemaDriftError(result.error)) {
      // Pre-migration schema: drop the optional resolution columns and retry so
      // the authoritative fen/turn_number/status still persist. ADR-005 panel
      // state is best-effort until the migration is applied.
      console.warn('[PERSIST] Schema drift on games — retrying without optional columns:', result.error.message)
      emitTrace('GAME_STATE_SAVE_SCHEMA_DRIFT', { roomId, turnNumber: turnNumber ?? undefined, extra: { errorMessage: result.error.message } })
      result = await supabase
        .from('games')
        .upsert(stripOptionalPersistColumns(upsertData), { onConflict: 'room_id' })
        .select('id')
        .single()
    }

    if (result.error) {
      // NEVER swallow a persistence failure: an unpersisted games row strands
      // _gameId (empty) which silently degrades move submission and prevents
      // the joiner from ever finding the game (lobby timeout / board freeze).
      console.error(`[PERSIST] Game upsert failed for room ${roomId}:`, result.error.code, result.error.message)
      emitTrace('GAME_STATE_SAVE_FAILED', { roomId, turnNumber: turnNumber ?? undefined, extra: { errorCode: result.error.code, errorMessage: result.error.message } })
      throw new Error(`Game upsert failed: ${result.error.message}`)
    }

    // Use INSERT ... RETURNING id as authoritative gameId source — avoids
    // separate SELECT that can fail due to RLS visibility window / replica
    // lag (previously 5×200ms retry that still could return null).
    const gameId = (result.data as { id?: string } | null)?.id ?? null

    emitTrace('GAME_STATE_SAVED', { roomId, turnNumber: turnNumber ?? undefined, extra: { moves: moveHistory.length, gameId: gameId ?? undefined } })

    DEBUG && console.log('[PERSIST] Game state saved:', { roomId, fen: fen.substring(0, 30), turn: currentTurn, moves: moveHistory.length, gameId: gameId ?? undefined })

    return gameId
  } catch (e) {
    // Re-throw so callers can react (retry / roll back the turn) — but only
    // after logging the full error chain, never silently swallowing it.
    if (e instanceof Error && e.message.startsWith('Game upsert failed')) {
      throw e
    }
    console.warn('[PERSIST] Failed to save game state:', e)
    throw e
  }
}

export async function loadGameState(roomId: string): Promise<{
  gameId?: string
  fen: string
  currentTurn: string
  moveHistory: GameSaveData['move_history']
  status: string
  matchStartedAt?: string
  matchTimeLimitSeconds?: number
  turnNumber?: number
  coordinatorId?: string | null
  turnPhase?: string
  lastResolvedMove?: string | null
  lastHumanResolution?: unknown | null
} | null> {
  try {
    let { data, error } = await supabase
      .from('games')
      .select(GAMES_FULL_COLUMNS)
      .eq('room_id', roomId)
      .maybeSingle()

    if (error && isSchemaDriftError(error)) {
      // Pre-migration schema drift: the SELECT naming a missing column fails
      // wholesale, which previously surfaced as "No saved state" and silently
      // disabled every authoritative re-sync. Retry with board-critical
      // columns only so FEN/turn sync keeps working until the migration lands.
      console.warn('[PERSIST] Schema drift on games — retrying read with core columns:', error.message)
      emitTrace('GAME_STATE_LOAD_SCHEMA_DRIFT', { roomId, extra: { errorMessage: error.message } })
      ;({ data, error } = await supabase
        .from('games')
        .select(GAMES_CORE_COLUMNS)
        .eq('room_id', roomId)
        .maybeSingle())
    }

    if (error || !data) {
      // Distinguish the failure modes explicitly: RLS-filtered rows return
      // (null, null); query/schema errors carry a code. Never collapse them
      // into one silent line again.
      console.debug('[PERSIST] No saved state for room:', roomId, JSON.stringify({
        reason: error ? 'QUERY_ERROR' : 'NO_VISIBLE_ROW',
        code: error?.code ?? null,
        message: error?.message ?? null,
      }))
      if (error) {
        emitTrace('GAME_STATE_LOAD_FAILED', { roomId, extra: { errorCode: error.code ?? null, errorMessage: error.message } })
      }
      return null
    }

    DEBUG && console.log('[PERSIST] Loaded game state:', { roomId, fen: data.fen.substring(0, 30), turn: data.current_turn, moves: data.move_history?.length })
    return {
      gameId: data.id,
      fen: data.fen,
      currentTurn: data.current_turn,
      moveHistory: data.move_history || [],
      status: data.status,
      matchStartedAt: data.match_started_at,
      matchTimeLimitSeconds: data.match_time_limit_seconds,
      turnNumber: data.turn_number ?? 0,
      coordinatorId: data.coordinator_id ?? null,
      turnPhase: (data as any).turn_phase ?? 'SUBMITTING',
      lastResolvedMove: (data as any).last_resolved_move ?? null,
      lastHumanResolution: (data as any).last_human_resolution ?? null,
    }
  } catch (e) {
    console.warn('[PERSIST] Failed to load game state:', e)
    return null
  }
}
