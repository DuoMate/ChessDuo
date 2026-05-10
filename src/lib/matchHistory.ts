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

const HISTORY_KEY = 'chessduo_history'

function getLocalHistory(): CompletedGame[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveLocalHistory(games: CompletedGame[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(games.slice(0, 50)))
  } catch {}
}

function makeLocalGameEntry(data: MatchSummaryData): CompletedGame {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).substring(2),
    room_id: data.roomId || null,
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
    move_comparisons: data.moveComparisons || [],
    played_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

export async function saveCompletedGame(data: MatchSummaryData): Promise<void> {
  // Always save locally first
  const localEntry = makeLocalGameEntry(data)
  const existing = getLocalHistory()
  existing.unshift(localEntry)
  saveLocalHistory(existing)

  // Try server save
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
      console.warn('[MatchHistory] Server save failed, game saved locally:', error.message?.substring?.(0, 80) || error.code)
    } else {
      console.log('[MatchHistory] Game saved to server')
    }
  } catch (e) {
    console.warn('[MatchHistory] Server save exception, game saved locally:', e)
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
      console.warn('[MatchHistory] Server fetch failed, using local:', error.message?.substring?.(0, 80) || error.code)
      return getLocalHistory().slice(0, limit)
    }

    if (data && data.length > 0) {
      return data
    }

    // Server returned empty, fall back to local
    return getLocalHistory().slice(0, limit)
  } catch (e) {
    console.warn('[MatchHistory] Server error, using local:', e)
    return getLocalHistory().slice(0, limit)
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
  const games = await getMatchHistory(1000)
  if (games.length === 0) return null

  let wins = 0
  let draws = 0
  let totalSyncRate = 0
  let totalAccuracy = 0
  let totalConflicts = 0

  for (const game of games) {
    if (game.winner === 'WHITE') wins++
    else if (game.winner === 'DRAW') draws++
    totalSyncRate += game.white_sync_rate
    totalAccuracy += (game.player1_accuracy + game.player2_accuracy) / 2
    totalConflicts += game.white_conflicts
  }

  return {
    totalGames: games.length,
    wins,
    losses: games.length - wins - draws,
    draws,
    avgSyncRate: games.length > 0 ? totalSyncRate / games.length : 0,
    avgAccuracy: games.length > 0 ? totalAccuracy / games.length : 0,
    totalConflicts,
  }
}
