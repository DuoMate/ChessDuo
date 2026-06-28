import { supabase } from './supabase'
import { DEBUG } from './debug'

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
}

export async function saveGameState(roomId: string, fen: string, currentTurn: string, moveEntry: GameSaveData['move_history'][number] | null, status: string, matchStartedAt?: string, matchTimeLimit?: number): Promise<void> {
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

    await supabase
      .from('games')
      .upsert(upsertData, { onConflict: 'room_id' })

    DEBUG && console.log('[PERSIST] Game state saved:', { roomId, fen: fen.substring(0, 30), turn: currentTurn, moves: moveHistory.length })
  } catch (e) {
    console.warn('[PERSIST] Failed to save game state:', e)
  }
}

export async function loadGameState(roomId: string): Promise<{
  fen: string
  currentTurn: string
  moveHistory: GameSaveData['move_history']
  status: string
  matchStartedAt?: string
  matchTimeLimitSeconds?: number
} | null> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('fen, current_turn, move_history, status, match_started_at, match_time_limit_seconds')
      .eq('room_id', roomId)
      .maybeSingle()

    if (error || !data) {
      console.debug('[PERSIST] No saved state for room:', roomId, error?.message || '')
      return null
    }

    DEBUG && console.log('[PERSIST] Loaded game state:', { roomId, fen: data.fen.substring(0, 30), turn: data.current_turn, moves: data.move_history?.length })
    return {
      fen: data.fen,
      currentTurn: data.current_turn,
      moveHistory: data.move_history || [],
      status: data.status,
      matchStartedAt: data.match_started_at,
      matchTimeLimitSeconds: data.match_time_limit_seconds
    }
  } catch (e) {
    console.warn('[PERSIST] Failed to load game state:', e)
    return null
  }
}
