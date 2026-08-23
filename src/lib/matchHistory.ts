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
  player_labels?: { white: string[]; black: string[] }
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
  playerLabels?: { white: string[]; black: string[] }
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

/**
 * C5 (Duel): true when the device-local history already contains an entry for
 * this room. Lets callers that can remount after a refresh (e.g. DuelGame's
 * game-over effect) avoid unshifting duplicate local entries — the Supabase
 * side is already idempotent via UNIQUE(room_id).
 */
export function hasLocalHistoryForRoom(roomId: string, userId?: string): boolean {
  try {
    return getLocalHistory(userId).some(g => g.room_id === roomId)
  } catch (e) {
    console.error('[MatchHistory] hasLocalHistoryForRoom failed:', e)
    return false
  }
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
    player_labels: data.playerLabels,
  }
}

export interface SaveCompletedGameResult {
  /** True when the Supabase completed_games write succeeded. False for guests (no DB write attempted) or on failure. */
  persisted: boolean
  error?: string
}

export async function saveCompletedGame(data: MatchSummaryData, userId?: string): Promise<SaveCompletedGameResult> {
  const localEntry = makeLocalGameEntry(data)
  const existing = getLocalHistory(userId)
  existing.unshift(localEntry)
  saveLocalHistory(existing, userId)

  invalidateStatsCache(userId)

  if (!userId) return { persisted: false }

  try {
    // Upsert on room_id so both participants' clients converge on a single
    // completed_games row (no duplicates). room_id is NULL for offline games,
    // which the UNIQUE(room_id) constraint treats as distinct (always insert).
    const { error } = await supabase.from('completed_games').upsert({
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
    }, { onConflict: 'room_id' })

    if (error) {
      // C6: persistence failures must be observable — the previous silent
      // catch hid RLS/schema problems and made the history race undiagnosable.
      // Never throw (fire-and-forget callers rely on that), but report loudly.
      console.error('[MatchHistory] completed_games upsert failed:',
        error.code, error.message, { roomId: data.roomId ?? null })
      return { persisted: false, error: `${error.code ?? 'UNKNOWN'}: ${error.message}` }
    }
    return { persisted: true }
  } catch (e) {
    console.error('[MatchHistory] completed_games upsert threw:', e, { roomId: data.roomId ?? null })
    return { persisted: false, error: String((e as Error)?.message || e) }
  }
}

// H3: cap the room-membership lookup so the completed_games `.in()` clause can
// never grow unbounded (a long-time user's full room list previously risked
// PostgREST URL/query limits, which silently degraded history to local-only).
const MAX_ROOM_LOOKUP = 200

interface RoomMembership {
  room_id: string
  team?: string | null
}

/**
 * Fetches the viewer's room memberships INCLUDING their assigned team.
 * Runs under the caller's auth (member-only SELECT policy) so this only ever
 * returns rooms the viewer actually played in. H2 identity source for online
 * games.
 */
async function getUserRoomMemberships(userId: string): Promise<RoomMembership[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select('room_id, team')
    .eq('player_id', userId)

  if (error) throw error
  return data || []
}

/**
 * H2: determine which side the VIEWER played in a completed game.
 * Priority: authoritative room_players team (online) → "(You)" marker in the
 * saved player labels (offline entries) → null (unresolvable).
 */
function resolveViewerTeam(
  game: Pick<CompletedGame, 'room_id' | 'player_labels'>,
  viewerTeamsByRoom: Map<string, string>,
): 'WHITE' | 'BLACK' | null {
  if (game.room_id && viewerTeamsByRoom.has(game.room_id)) {
    return viewerTeamsByRoom.get(game.room_id) as 'WHITE' | 'BLACK'
  }
  const labels = game.player_labels
  if (labels) {
    const whiteYou = (labels.white || []).some(l => typeof l === 'string' && l.includes('(You)'))
    const blackYou = (labels.black || []).some(l => typeof l === 'string' && l.includes('(You)'))
    if (whiteYou) return 'WHITE'
    if (blackYou) return 'BLACK'
  }
  return null
}

async function fetchCompletedGames(roomIds: string[], limit: number): Promise<CompletedGame[]> {
  const { data, error } = await supabase
    .from('completed_games')
    .select('*')
    .in('room_id', roomIds)
    .order('played_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * H3: merged history view — DB rows are authoritative for online games
 * (deduplicated per room), while device-local entries (offline games and any
 * online game not yet visible in the DB) are preserved instead of being
 * hidden whenever at least one DB row exists.
 */
async function loadHistoryBundle(
  userId: string,
  limit: number,
): Promise<{ games: CompletedGame[]; viewerTeamsByRoom: Map<string, string> }> {
  let dbGames: CompletedGame[] = []
  const viewerTeamsByRoom = new Map<string, string>()
  try {
    const memberships = await getUserRoomMemberships(userId)
    for (const m of memberships) {
      if (m.room_id && m.team) viewerTeamsByRoom.set(m.room_id, m.team)
    }
    const capped = memberships.slice(0, MAX_ROOM_LOOKUP)
    if (capped.length > 0) {
      dbGames = await fetchCompletedGames(capped.map(m => m.room_id), limit)
    }
  } catch (e) {
    console.error('[MatchHistory] Supabase query failed, falling back to localStorage:', e)
  }

  const dbRoomIds = new Set(dbGames.map(g => g.room_id))
  const localOnly = getLocalHistory(userId).filter(g => !g.room_id || !dbRoomIds.has(g.room_id))

  const games = [...dbGames, ...localOnly]
    .sort((a, b) => (b.played_at || '').localeCompare(a.played_at || ''))
    .slice(0, limit)
  return { games, viewerTeamsByRoom }
}

export async function getMatchHistory(limit = 20, userId?: string): Promise<CompletedGame[]> {
  if (!userId) return getLocalHistory(userId).slice(0, limit)
  const { games } = await loadHistoryBundle(userId, limit)
  return games
}

export async function getCompletedGame(gameId: string, userId?: string): Promise<CompletedGame | null> {
  const local = getLocalHistory(userId).find(g => g.id === gameId)
  if (local) return local

  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('completed_games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (e) {
    console.error('[MatchHistory] Supabase query failed for single game:', e)
    return null
  }
}

export interface PlayerStats {
  totalGames: number
  wins: number
  losses: number
  draws: number
  avgSyncRate: number
  avgAccuracy: number
  totalConflicts: number
}

const statsCache = new Map<string, { value: PlayerStats | null; fetchedAt: number }>()
const STATS_CACHE_TTL_MS = 60_000

export function invalidateStatsCache(userId?: string): void {
  statsCache.delete(userId ?? 'guest')
}

function getStatsCacheKey(userId?: string): string {
  return userId ?? 'guest'
}

function getCachedStats(userId?: string): PlayerStats | null | 'expired' {
  const key = getStatsCacheKey(userId)
  const entry = statsCache.get(key)
  if (!entry) return 'expired'
  if (Date.now() - entry.fetchedAt > STATS_CACHE_TTL_MS) {
    statsCache.delete(key)
    return 'expired'
  }
  return entry.value
}

function computeStatsFromGames(
  games: CompletedGame[],
  viewerTeamsByRoom: Map<string, string>,
  resolveIdentity: boolean,
): PlayerStats | null {
  if (games.length === 0) return null
  let wins = 0
  let losses = 0
  let draws = 0
  let totalSyncRate = 0
  let totalAccuracy = 0
  let totalConflicts = 0

  for (const game of games) {
    const viewerTeam = resolveIdentity ? resolveViewerTeam(game, viewerTeamsByRoom) : null
    if (game.winner === 'DRAW' || game.winner === 'draw') {
      draws++
    } else if (!viewerTeam) {
      // Legacy fallback (no identity info available for this row).
      if (game.winner === 'WHITE') wins++
      else losses++
    } else if (game.winner === viewerTeam || game.winner === viewerTeam.toLowerCase()) {
      wins++
    } else {
      losses++
    }
    totalSyncRate += game.white_sync_rate
    totalAccuracy += (game.player1_accuracy + game.player2_accuracy) / 2
    totalConflicts += game.white_conflicts
  }

  return {
    totalGames: games.length,
    wins,
    losses,
    draws,
    avgSyncRate: totalSyncRate / games.length,
    avgAccuracy: totalAccuracy / games.length,
    totalConflicts,
  }
}

export async function getPlayerStats(userId?: string): Promise<PlayerStats | null> {
  const cached = getCachedStats(userId)
  if (cached !== 'expired') return cached

  let value: PlayerStats | null
  if (!userId) {
    // Guests have no server identity — local history only, legacy counting,
    // and ZERO database access (pre-existing contract).
    value = computeStatsFromGames(getLocalHistory(undefined), new Map(), false)
  } else {
    // Rule 9: wins are counted relative to the VIEWER's actual team, never
    // assumed WHITE. Team resolution: room_players (online) → "(You)" label
    // marker (offline) → legacy WHITE-count fallback for unresolvable rows.
    const { games, viewerTeamsByRoom } = await loadHistoryBundle(userId, 1000)
    value = computeStatsFromGames(games, viewerTeamsByRoom, true)
  }

  statsCache.set(getStatsCacheKey(userId), { value, fetchedAt: Date.now() })
  return value
}
