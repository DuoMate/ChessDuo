import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'

// ---------------------------------------------------------------------------
// PERF-03: lobby/sync/restore polls must select narrow columns (never `*`).
// ADR-006 safety: these queries feed readiness gating (DB-authoritative
// membership), syncGameState roster rebuild, and submission restore — the
// narrowed sets are exactly the fields each consumer reads.
// ---------------------------------------------------------------------------

const selectCalls: Array<{ table: string; cols: string }> = []

let loadGameStateMock = jest.fn().mockResolvedValue(null)
let saveGameStateMock = jest.fn().mockResolvedValue(undefined)

jest.mock('../gamePersistence', () => ({
  saveGameState: (...args: unknown[]) => saveGameStateMock(...args),
  loadGameState: jest.fn(() => loadGameStateMock()),
}))

jest.mock('@/lib/roomActions', () => ({
  joinRoomByCode: jest.fn().mockResolvedValue({
    roomId: 'room-1', code: 'ABC123', team: 'WHITE', slot: 0,
    status: 'waiting', mode: 'online', hostTeam: 'WHITE', createdBy: 'a-uuid',
    timeSeconds: 600, gameId: null, gameStatus: null,
  }),
}))

jest.mock('../supabase', () => {
  const chainable = (final: () => Promise<unknown>) => {
    const self: Record<string, jest.Mock> = {}
    self.eq = jest.fn(() => self)
    self.order = jest.fn(() => self)
    self.maybeSingle = jest.fn(final)
    self.single = jest.fn(final)
    self.then = jest.fn((res: (v: unknown) => unknown) => final().then(res))
    return self
  }
  return {
    supabase: {
      channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
        track: jest.fn().mockResolvedValue(null),
        send: jest.fn().mockResolvedValue(null),
        presenceState: jest.fn(() => ({})),
        unsubscribe: jest.fn(),
      })),
      removeChannel: jest.fn().mockResolvedValue(null),
      rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
      from: jest.fn((table: string) => {
        if (table === 'room_players') {
          return {
            select: jest.fn((cols: string) => {
              selectCalls.push({ table, cols })
              return chainable(() => Promise.resolve({
                data: [
                  { room_id: 'room-1', player_id: 'a-uuid', team: 'WHITE', slot: 0, status: 'ready' },
                  { room_id: 'room-1', player_id: 'z-uuid', team: 'BLACK', slot: 0, status: 'ready' },
                ],
                error: null,
              }))
            }),
          }
        }
        if (table === 'turn_submissions') {
          return {
            select: jest.fn((cols: string) => {
              selectCalls.push({ table, cols })
              return chainable(() => Promise.resolve({ data: [], error: null }))
            }),
          }
        }
        if (table === 'games') {
          return {
            select: jest.fn((cols: string) => {
              selectCalls.push({ table, cols })
              return chainable(() => Promise.resolve({ data: null, error: null }))
            }),
            upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
          }
        }
        return {
          select: jest.fn(() => chainable(() => Promise.resolve({ data: [], error: null }))),
          upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
        }
      }),
    },
  }
})

function colsFor(table: string): string[] {
  return selectCalls.filter(c => c.table === table).map(c => c.cols)
}

beforeEach(() => {
  selectCalls.length = 0
  loadGameStateMock = jest.fn().mockResolvedValue(null)
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  jest.clearAllMocks()
})

function makeGame(): OnlineGame {
  const game = new OnlineGame(600)
  const g = game as unknown as Record<string, unknown>
  g['_playerId'] = 'a-uuid'
  g['_team'] = 'WHITE'
  g['_status'] = GameStatus.READY
  g['_room'] = { id: 'room-1', code: 'ABC123', mode: 'online', host_team: 'WHITE' }
  g['_gameId'] = 'game-1'
  g['_currentTurnNumber'] = 1
  return game
}

describe('onlineGame poll selects (PERF-03 narrow)', () => {
  it('syncGameState roster query selects only player_id,team', async () => {
    const game = makeGame()
    await (game as unknown as { syncGameState(): Promise<boolean> }).syncGameState()
    const selects = colsFor('room_players')
    expect(selects.length).toBeGreaterThan(0)
    for (const cols of selects) {
      expect(cols).not.toContain('*')
      expect(cols).toBe('player_id,team')
    }
  })

  it('restoreCurrentTurnSubmissions selects only consumed submission columns', async () => {
    const game = makeGame()
    const restored = await (game as unknown as { restoreCurrentTurnSubmissions(): Promise<boolean> }).restoreCurrentTurnSubmissions()
    expect(restored).toBe(false)
    const selects = colsFor('turn_submissions')
    expect(selects.length).toBeGreaterThan(0)
    for (const cols of selects) {
      expect(cols).not.toContain('*')
      expect(cols).toBe('player_id,turn_number,move_san,move_from,move_to,piece')
    }
  })
})
