import { supabase } from './supabase'

export interface CompletedGame {
  id: string
  room_id: string | null
  winner: string
  game_result: string
  game_over_reason: string | null
  white_moves: number
  white_sync_rate: number
  white_conflicts: number
  player1_accuracy: number
  player2_accuracy: number
  total_moves: number
  is_online: boolean
  move_comparisons: unknown[]
  challenge_id: string | null
  played_at: string
  created_at: string
}

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
  challengeId?: string
}

const HISTORY_KEY_PREFIX = 'chessduo_history_'

function getHistoryKey(userId?: string): string {
  return userId ? `${HISTORY_KEY_PREFIX}${userId}` : 'chessduo_history'
}

function getLocalHistory(userId?: string): CompletedGame[] {
  try {
    const key = getHistoryKey(userId)
    const raw = localStorage.getItem(key)
    // Also check legacy key (pre-user-scoping) and migrate if found
    if (!raw && userId) {
      const legacy = localStorage.getItem('chessduo_history')
      if (legacy) {
        localStorage.setItem(key, legacy)
        localStorage.removeItem('chessduo_history')
        return JSON.parse(legacy)
      }
    }
    if (raw) return JSON.parse(raw)
  } catch (e) { console.error('[MatchHistory] Failed to read from localStorage:', e) }
  return []
}

function saveLocalHistory(games: CompletedGame[], userId?: string) {
  try {
    const key = getHistoryKey(userId)
    localStorage.setItem(key, JSON.stringify(games.slice(0, 50)))
  } catch (e) { console.error('[MatchHistory] Failed to write to localStorage:', e) }
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
    challenge_id: data.challengeId || null,
    played_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

export async function saveCompletedGame(data: MatchSummaryData, userId?: string): Promise<void> {
  const localEntry = makeLocalGameEntry(data)
  const existing = getLocalHistory(userId)
  existing.unshift(localEntry)
  saveLocalHistory(existing, userId)

  if (userId) {
    try {
      await supabase.from('completed_games').insert({
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
        challenge_id: data.challengeId || null,
        played_at: new Date().toISOString(),
      })
    } catch {
      // Supabase insert is best-effort — history still saved locally
    }
  }
}

export async function getMatchHistory(limit = 20, userId?: string): Promise<CompletedGame[]> {
  return getLocalHistory(userId).slice(0, limit)
}

export async function getCompletedGame(gameId: string, userId?: string): Promise<CompletedGame | null> {
  return getLocalHistory(userId).find(g => g.id === gameId) || null
}

export async function getPlayerStats(userId?: string): Promise<{
  totalGames: number
  wins: number
  losses: number
  draws: number
  avgSyncRate: number
  avgAccuracy: number
  totalConflicts: number
} | null> {
  const games = await getMatchHistory(1000, userId)
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
