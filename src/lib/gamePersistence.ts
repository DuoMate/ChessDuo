import { supabase } from './supabase'

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
}

export async function saveGameState(roomId: string, fen: string, currentTurn: string, moveEntry: GameSaveData['move_history'][number] | null, status: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('games')
      .select('move_history')
      .eq('room_id', roomId)
      .maybeSingle()

    const moveHistory: GameSaveData['move_history'] = existing?.move_history || []
    if (moveEntry) {
      moveHistory.push(moveEntry)
    }

    await supabase
      .from('games')
      .upsert({
        room_id: roomId,
        fen,
        current_turn: currentTurn,
        move_history: moveHistory,
        status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'room_id' })

    console.log('[PERSIST] Game state saved:', { roomId, fen: fen.substring(0, 30), turn: currentTurn, moves: moveHistory.length })
  } catch (e) {
    console.warn('[PERSIST] Failed to save game state:', e)
  }
}

export async function loadGameState(roomId: string): Promise<{
  fen: string
  currentTurn: string
  moveHistory: GameSaveData['move_history']
  status: string
} | null> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('fen, current_turn, move_history, status')
      .eq('room_id', roomId)
      .maybeSingle()

    if (error || !data) {
      console.log('[PERSIST] No saved state for room:', roomId, error?.message || '')
      return null
    }

    console.log('[PERSIST] Loaded game state:', { roomId, fen: data.fen.substring(0, 30), turn: data.current_turn, moves: data.move_history?.length })
    return {
      fen: data.fen,
      currentTurn: data.current_turn,
      moveHistory: data.move_history || [],
      status: data.status
    }
  } catch (e) {
    console.warn('[PERSIST] Failed to load game state:', e)
    return null
  }
}
