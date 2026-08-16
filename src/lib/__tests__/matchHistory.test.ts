import { supabase } from '@/lib/supabase'
import { getPlayerStats, saveCompletedGame, invalidateStatsCache } from '../matchHistory'

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

    expect(refreshed?.totalGames).toBe(2)
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