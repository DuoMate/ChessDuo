import { supabase } from '@/lib/supabase'

/**
 * Isolated Coach Mode persistence.
 *
 * Backs the new `coach_games` table (player-scoped RLS) — completely separate
 * from the production `games` / `completed_games` tables and `matchHistory`.
 * Writes are fire-and-forget friendly (never throw); failures are logged and
 * returned as `persisted: false` so the game flow is never blocked.
 */

export type CoachGameResult = 'win' | 'loss' | 'draw'

export interface CoachGameRecord {
  id?: string
  player_id: string
  result: CoachGameResult
  player_color: 'white' | 'black'
  bot_level: number
  fen: string
  move_history: unknown[]
  blunders: number
  mistakes: number
  accuracy: number
  played_at?: string
}

export interface SaveCoachGameResult {
  persisted: boolean
  id?: string
  error?: string
}

export async function saveCoachGame(record: CoachGameRecord): Promise<SaveCoachGameResult> {
  try {
    const { data, error } = await supabase
      .from('coach_games')
      .insert({
        player_id: record.player_id,
        result: record.result,
        player_color: record.player_color,
        bot_level: record.bot_level,
        fen: record.fen,
        move_history: record.move_history,
        blunders: record.blunders,
        mistakes: record.mistakes,
        accuracy: record.accuracy,
        played_at: record.played_at ?? new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[CoachPersistence] coach_games insert failed:', error.code, error.message)
      return { persisted: false, error: `${error.code ?? 'UNKNOWN'}: ${error.message}` }
    }
    return { persisted: true, id: (data as { id?: string } | null)?.id }
  } catch (e) {
    console.error('[CoachPersistence] coach_games insert threw:', e)
    return { persisted: false, error: String((e as Error)?.message || e) }
  }
}

export async function listCoachGames(playerId: string, limit = 20): Promise<CoachGameRecord[]> {
  try {
    const { data, error } = await supabase
      .from('coach_games')
      .select('*')
      .eq('player_id', playerId)
      .order('played_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[CoachPersistence] coach_games select failed:', error.code, error.message)
      return []
    }
    return (data ?? []) as CoachGameRecord[]
  } catch (e) {
    console.error('[CoachPersistence] coach_games select threw:', e)
    return []
  }
}
