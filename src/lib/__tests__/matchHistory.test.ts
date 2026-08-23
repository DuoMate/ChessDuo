import { supabase } from '@/lib/supabase'
import { getPlayerStats, saveCompletedGame, invalidateStatsCache, getMatchHistory } from '../matchHistory'

const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockInsert = jest.fn()
const mockIn = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'room_players') {
        return {
          select: jest.fn(() => ({ eq: mockEq })),
        }
      }
      if (table === 'completed_games') {
        return {
          select: mockSelect,
          insert: mockInsert,
        }
      }
      return { select: jest.fn(), insert: mockInsert }
    }),
  },
}))

function stubHistory(roomIds: string[], games: unknown[]) {
  mockEq.mockResolvedValue({ data: roomIds.map(id => ({ room_id: id })), error: null })
  mockSelect.mockReturnValue({ in: mockIn })
  mockIn.mockReturnValue({ order: mockOrder })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockLimit.mockResolvedValue({ data: games, error: null })
}

beforeEach(() => {
  jest.clearAllMocks()
  invalidateStatsCache('user-1')
  invalidateStatsCache()
  localStorage.clear()
})

describe('getPlayerStats cache', () => {
  it('computes a correct aggregate on the first call', async () => {
    stubHistory(['r1'], [
      { winner: 'WHITE', white_sync_rate: 1, player1_accuracy: 80, player2_accuracy: 90, white_conflicts: 2 },
      { winner: 'BLACK', white_sync_rate: 0.5, player1_accuracy: 60, player2_accuracy: 70, white_conflicts: 1 },
      { winner: 'DRAW', white_sync_rate: 0.8, player1_accuracy: 50, player2_accuracy: 60, white_conflicts: 0 },
    ])

    const stats = await getPlayerStats('user-1')

    expect(stats).toEqual({
      totalGames: 3,
      wins: 1,
      losses: 1,
      draws: 1,
      avgSyncRate: expect.closeTo(0.766, 1),
      avgAccuracy: expect.closeTo(68.33, 1),
      totalConflicts: 3,
    })
    expect(mockSelect).toHaveBeenCalledTimes(1)
  })

  it('serves the second call from cache without querying again', async () => {
    stubHistory(['r1'], [
      { winner: 'WHITE', white_sync_rate: 1, player1_accuracy: 80, player2_accuracy: 90, white_conflicts: 2 },
    ])

    await getPlayerStats('user-1')
    const second = await getPlayerStats('user-1')

    expect(second?.totalGames).toBe(1)
    expect(mockSelect).toHaveBeenCalledTimes(1)
  })

  it('caches the null (no-games) result', async () => {
    stubHistory(['r1'], [])

    const first = await getPlayerStats('user-1')
    const second = await getPlayerStats('user-1')

    expect(first).toBeNull()
    expect(second).toBeNull()
    expect(mockSelect).toHaveBeenCalledTimes(1)
  })

  it('invalidates when a new game is saved for that user', async () => {
    stubHistory(['r1'], [
      { winner: 'WHITE', white_sync_rate: 1, player1_accuracy: 80, player2_accuracy: 90, white_conflicts: 2 },
    ])
    mockInsert.mockResolvedValue({ error: null })

    await getPlayerStats('user-1')

    await saveCompletedGame({
      winner: 'BLACK',
      gameResult: 'Black wins',
      gameOverReason: 'checkmate',
      stats: { whiteMovesPlayed: 20, whiteSyncRate: 0.7, whiteConflicts: 0, player1Accuracy: 40, player2Accuracy: 50, totalMoves: 20 },
      isOnline: true,
      moveComparisons: [],
    }, 'user-1')

    stubHistory(['r1', 'r2'], [
      { winner: 'WHITE', white_sync_rate: 1, player1_accuracy: 80, player2_accuracy: 90, white_conflicts: 2 },
      { winner: 'BLACK', white_sync_rate: 0.7, player1_accuracy: 40, player2_accuracy: 50, white_conflicts: 0 },
    ])

    const refreshed = await getPlayerStats('user-1')

    // H3: the saved entry has no roomId (local-only), so it now MERGES with
    // the two DB rows instead of being hidden whenever a DB row exists.
    expect(refreshed?.totalGames).toBe(3)
    expect(mockSelect).toHaveBeenCalledTimes(2)
  })

  it('uses the guest key when no userId is provided', async () => {
    mockInsert.mockResolvedValue({ error: null })

    await getPlayerStats()
    const cached = await getPlayerStats()

    expect(cached).toBeNull()
    expect(mockSelect).toHaveBeenCalledTimes(0)

    await saveCompletedGame({
      winner: 'WHITE',
      gameResult: 'White wins',
      gameOverReason: 'checkmate',
      stats: { whiteMovesPlayed: 10, whiteSyncRate: 1, whiteConflicts: 0, player1Accuracy: 70, player2Accuracy: 70, totalMoves: 10 },
      isOnline: false,
      moveComparisons: [],
    })

    const refreshed = await getPlayerStats()

    expect(refreshed?.totalGames).toBe(1)
    expect(mockSelect).toHaveBeenCalledTimes(0)
  })
})
// ============================================================
// GROUP 3 — H2: team-aware win/loss stats (Rule 9)
// ============================================================
describe('H2: viewer-team-aware player stats', () => {
  function stubMemberships(rows: Array<{ room_id: string; team?: string }>) {
    mockEq.mockResolvedValue({ data: rows, error: null })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
  }

  it('counts a BLACK-side win as a win for a BLACK viewer', async () => {
    stubMemberships([
      { room_id: 'r1', team: 'BLACK' },
    ])
    mockLimit.mockResolvedValue({
      data: [
        { winner: 'WHITE', white_sync_rate: 1, player1_accuracy: 80, player2_accuracy: 90, white_conflicts: 0 },
        { winner: 'BLACK', white_sync_rate: 0.5, player1_accuracy: 60, player2_accuracy: 70, white_conflicts: 1 },
      ],
      error: null,
    })

    const stats = await getPlayerStats('user-1')

    expect(stats?.wins).toBe(1)   // the BLACK win
    expect(stats?.losses).toBe(1) // the WHITE loss
    expect(stats?.draws).toBe(0)
  })

  it('counts a WHITE-side win as a win for a WHITE viewer (regression guard)', async () => {
    stubMemberships([{ room_id: 'r1', team: 'WHITE' }])
    mockLimit.mockResolvedValue({
      data: [{ winner: 'WHITE', white_sync_rate: 1, player1_accuracy: 80, player2_accuracy: 90, white_conflicts: 0 }],
      error: null,
    })

    const stats = await getPlayerStats('user-1')
    expect(stats?.wins).toBe(1)
    expect(stats?.losses).toBe(0)
  })

  it('falls back to the saved "(You)" label marker when no room team exists (offline entries)', async () => {
    stubMemberships([]) // offline game → no memberships
    mockIn.mockReturnValue({ order: mockOrder })
    mockLimit.mockResolvedValue({ data: [], error: null }) // no DB rows

    // Seed device-local history with an offline game the viewer played as BLACK.
    localStorage.setItem('chessduo_history_user-1', JSON.stringify([{
      id: 'local-1',
      room_id: null,
      winner: 'BLACK',
      game_result: 'Black wins',
      game_over_reason: 'checkmate',
      white_moves: 10, white_sync_rate: 1, white_conflicts: 0,
      player1_accuracy: 70, player2_accuracy: 80, total_moves: 10,
      is_online: false, move_comparisons: [],
      played_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      player_labels: { white: ['White Team (Bot)'], black: ['Black Team (You)'] },
    }]))

    const stats = await getPlayerStats('user-1')

    expect(stats?.totalGames).toBe(1)
    expect(stats?.wins).toBe(1)   // viewer was BLACK and BLACK won
    expect(stats?.losses).toBe(0)

    localStorage.removeItem('chessduo_history_user-1')
  })

  it('preserves legacy WHITE-count behavior for rows with no identity info', async () => {
    stubMemberships([{ room_id: 'r1' }]) // membership without team (legacy stub shape)
    mockLimit.mockResolvedValue({
      data: [
        { winner: 'WHITE', white_sync_rate: 1, player1_accuracy: 80, player2_accuracy: 90, white_conflicts: 0 },
        { winner: 'BLACK', white_sync_rate: 0.5, player1_accuracy: 60, player2_accuracy: 70, white_conflicts: 1 },
      ],
      error: null,
    })

    const stats = await getPlayerStats('user-1')
    expect(stats?.wins).toBe(1)
    expect(stats?.losses).toBe(1)
  })
})

// ============================================================
// GROUP 3 — H3: merged DB + local history, dedupe, bounded query
// ============================================================
describe('H3: merged history', () => {
  it('keeps local-only/offline games alongside DB games and dedupes by room', async () => {
    const now = new Date().toISOString()
    mockEq.mockResolvedValue({ data: [{ room_id: 'r1', team: 'WHITE' }], error: null })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue({
      data: [{
        id: 'db-1', room_id: 'r1', winner: 'WHITE', game_result: 'White wins',
        game_over_reason: 'resignation', white_moves: 5, white_sync_rate: 1,
        white_conflicts: 0, player1_accuracy: 80, player2_accuracy: 85,
        total_moves: 5, is_online: true, move_comparisons: [],
        played_at: now, created_at: now,
      }],
      error: null,
    })
    // Local duplicate of r1 + one offline entry.
    localStorage.setItem('chessduo_history_user-1', JSON.stringify([
      { id: 'local-dup', room_id: 'r1', winner: 'WHITE', game_result: 'White wins', played_at: now, created_at: now, white_moves: 0, white_sync_rate: 0, white_conflicts: 0, player1_accuracy: 0, player2_accuracy: 0, total_moves: 0, is_online: true, move_comparisons: [] },
      { id: 'local-offline', room_id: null, winner: 'DRAW', game_result: 'Draw', played_at: now, created_at: now, white_moves: 0, white_sync_rate: 0, white_conflicts: 0, player1_accuracy: 0, player2_accuracy: 0, total_moves: 0, is_online: false, move_comparisons: [] },
    ]))

    const games = await getMatchHistory(20, 'user-1')

    expect(games).toHaveLength(2)
    expect(games.map(g => g.id).sort()).toEqual(['db-1', 'local-offline'])

    localStorage.removeItem('chessduo_history_user-1')
  })

  it('caps the room-membership lookup at 200 rooms', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ room_id: `room-${i}`, team: 'WHITE' }))
    mockEq.mockResolvedValue({ data: rows, error: null })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue({ data: [], error: null })

    await getMatchHistory(20, 'user-1')

    expect(mockIn).toHaveBeenCalledTimes(1)
    const idsArg = mockIn.mock.calls[0][1] as string[]
    expect(idsArg.length).toBe(200)
  })
})
