import { supabase, Database } from './supabase'

export type CompletedGame = Database['public']['Tables']['completed_games']['Row']
export type CompletedGameInsert = Database['public']['Tables']['completed_games']['Insert']

export interface MatchSummaryData {
  winner: 'WHITE' | 'BLACK' | 'DRAW'
  gameResult: string
  gameOverReason: string | null
  stats: {
    whiteMovesPlayed: number
    whiteSyncRate: number
    whiteConflicts: number
    player1Accuracy: number
    player2Accuracy: number
    totalMoves: number
  }
  isOnline: boolean
  roomId?: string
  moveComparisons?: unknown[]
}

export async function saveCompletedGame(data: MatchSummaryData): Promise<void> {
  try {
    const { error } = await supabase
      .from('completed_games')
      .insert({
        winner: data.winner,
        game_result: data.gameResult,
        game_over_reason: data.gameOverReason,
        white_moves: data.stats.whiteMovesPlayed,
        white_sync_rate: data.stats.whiteSyncRate,
        white_conflicts: data.stats.whiteConflicts,
        player1_accuracy: Math.round(data.stats.player1Accuracy),
        player2_accuracy: Math.round(data.stats.player2Accuracy),
        total_moves: data.stats.totalMoves,
        is_online: data.isOnline,
        room_id: data.roomId || null,
        move_comparisons: data.moveComparisons || [],
        played_at: new Date().toISOString(),
      })

    if (error) {
      console.warn('[MatchHistory] Failed to save completed game:', error.message)
    } else {
      console.log('[MatchHistory] Game saved successfully')
    }
  } catch (e) {
    console.warn('[MatchHistory] Error saving game:', e)
  }
}

export async function getMatchHistory(limit = 20): Promise<CompletedGame[]> {
  try {
    const { data, error } = await supabase
      .from('completed_games')
      .select('*')
      .order('played_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[MatchHistory] Failed to load history:', error.message)
      return []
    }

    return data || []
  } catch (e) {
    console.warn('[MatchHistory] Error loading history:', e)
    return []
  }
}

export async function getPlayerStats(): Promise<{
  totalGames: number
  wins: number
  losses: number
  draws: number
  avgSyncRate: number
  avgAccuracy: number
  totalConflicts: number
} | null> {
  try {
    const { data, error } = await supabase
      .from('completed_games')
      .select('*')

    if (error || !data || data.length === 0) return null

    let wins = 0
    let draws = 0
    let totalSyncRate = 0
    let totalAccuracy = 0
    let totalConflicts = 0

    for (const game of data) {
      if (game.winner === 'WHITE') wins++
      else if (game.winner === 'DRAW') draws++
      totalSyncRate += game.white_sync_rate
      totalAccuracy += (game.player1_accuracy + game.player2_accuracy) / 2
      totalConflicts += game.white_conflicts
    }

    return {
      totalGames: data.length,
      wins,
      losses: data.length - wins - draws,
      draws,
      avgSyncRate: data.length > 0 ? totalSyncRate / data.length : 0,
      avgAccuracy: data.length > 0 ? totalAccuracy / data.length : 0,
      totalConflicts,
    }
  } catch (e) {
    console.warn('[MatchHistory] Error computing stats:', e)
    return null
  }
}
