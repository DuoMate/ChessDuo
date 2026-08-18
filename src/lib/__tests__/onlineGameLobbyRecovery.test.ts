import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'

// ---------------------------------------------------------------------------
// Lobby-timeout regression: the joiner (non-coordinator) must recover when the
// one-shot `game_started` broadcast is missed (subscribe race / realtime gap).
// The fallback poll keeps running until the authoritative games row is visible,
// instead of stopping the moment both humans are counted.
// ---------------------------------------------------------------------------

const shared: {
  roomPlayers: Array<{ room_id: string; player_id: string; team: 'WHITE' | 'BLACK'; slot: number }>
  presence: Record<string, unknown>
} = {
  roomPlayers: [],
  presence: {},
}
const sharedValue = () => shared

let loadGameStateMock = jest.fn().mockResolvedValue(null)
let saveGameStateMock = jest.fn().mockResolvedValue(undefined)
let channelSendMocks: Array<jest.Mock> = []

jest.mock('../gamePersistence', () => ({
  saveGameState: (...args: any[]) => saveGameStateMock(...args),
  loadGameState: jest.fn(() => loadGameStateMock()),
}))

jest.mock('@/lib/roomActions', () => ({
  joinRoomByCode: jest.fn().mockResolvedValue({
    roomId: 'room-1', code: 'ABC123', team: 'WHITE', slot: 1,
    status: 'waiting', mode: 'online', hostTeam: 'WHITE', createdBy: 'a-uuid',
    timeSeconds: 600, gameId: null, gameStatus: null,
  }),
}))

jest.mock('../supabase', () => {
  return {
    supabase: {
      channel: jest.fn(() => {
        const send = jest.fn().mockResolvedValue(null)
        channelSendMocks.push(send)
        return {
          on: jest.fn().mockReturnThis(),
          subscribe: jest.fn((cb: any) => {
            setTimeout(() => cb('SUBSCRIBED'), 0)
            return { unsubscribe: jest.fn() }
          }),
          track: jest.fn().mockResolvedValue(null),
          send,
          presenceState: jest.fn(() => {
            const state: Record<string, unknown> = {}
            for (const [key, meta] of Object.entries(sharedValue().presence)) state[key] = meta
            return state
          }),
          unsubscribe: jest.fn(),
        }
      }),
      removeChannel: jest.fn().mockResolvedValue(null),
      rpc: jest.fn(() => Promise.resolve({ data: sharedValue().roomPlayers, error: null })),
      from: jest.fn((table: string) => {
        if (table === 'room_players') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: sharedValue().roomPlayers, error: null })),
              })),
            })),
          }
        }
        if (table === 'games') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
            upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
          }
        }
        return {
          select: jest.fn(() => Promise.resolve({ data: [], error: null })),
          upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
        }
      }),
    },
  }
})

interface T {
  _playerId: string
  _team: 'WHITE' | 'BLACK'
  _status: GameStatus
  _room: any
  _channel: any
  _pollingInterval: any
  [key: string]: any
}

function t(g: OnlineGame): T {
  return g as unknown as T
}

const GAME_ROW = {
  id: 'game-1',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn: 'WHITE',
  move_history: [],
  status: 'PLAYING',
  turn_number: 0,
  coordinator_id: 'a-uuid',
  turn_phase: 'SUBMITTING',
}

beforeEach(() => {
  shared.roomPlayers = []
  shared.presence = {}
  loadGameStateMock = jest.fn().mockResolvedValue(null)
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  channelSendMocks = []
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function makeJoiner() {
  const game = new OnlineGame(600)
  t(game)._playerId = 'z-uuid'
  t(game)._team = 'WHITE'
  t(game)._status = GameStatus.READY
  t(game)._room = { id: 'room-1', code: 'ABC123', mode: 'online', host_team: 'WHITE' }
  return game
}

describe('fallback poll — non-coordinator lobby recovery', () => {
  it('keeps polling after counting 2 humans and syncs when the game row becomes visible (missed game_started broadcast)', async () => {
    // Both members committed; joiner is NOT the coordinator (a-uuid is).
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'a-uuid', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'z-uuid', team: 'WHITE', slot: 1 },
    ]
    shared.presence = {
      'a-uuid': { player_id: 'a-uuid', team: 'WHITE' },
      'z-uuid': { player_id: 'z-uuid', team: 'WHITE' },
    }

    // First poll: game not persisted yet (coordinator still creating it).
    // Second poll: game row is visible — the missed-broadcast recovery path.
    let calls = 0
    loadGameStateMock = jest.fn().mockImplementation(async () => {
      calls += 1
      return calls >= 2 ? GAME_ROW : null
    })

    const game = makeJoiner()
    const joinPromise = game.joinRoom({ id: 'room-1', code: 'ABC123' } as any, 'z-uuid', 'WHITE')

    // Let subscription settle, then run poll 1 (t=500) and poll 2 (t=500+900).
    await jest.advanceTimersByTimeAsync(600)
    expect(game.status).toBe(GameStatus.READY) // game row not visible yet — still polling

    await jest.advanceTimersByTimeAsync(1000) // poll 2 sees the persisted game row
    await joinPromise

    expect(game.status).toBe(GameStatus.PLAYING)
    expect(t(game)._pollingInterval).toBeNull()
  })

  it('keeps polling when syncGameState hits a transient failure instead of dying in the lobby', async () => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'a-uuid', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'z-uuid', team: 'WHITE', slot: 1 },
    ]

    let calls = 0
    loadGameStateMock = jest.fn().mockImplementation(async () => {
      calls += 1
      // First time the game row is found, syncGameState fails transiently
      // (the room_players query rejects). The poll must keep going.
      return calls >= 2 ? GAME_ROW : null
    })

    // Force the room_players query inside syncGameState to fail on first sight
    // of the game row, then succeed — simulating a transient DB hiccup.
    const origFrom = jest.requireMock('../supabase').supabase.from
    let failOnce = true
    jest.requireMock('../supabase').supabase.from = jest.fn((table: string) => {
      const base = origFrom(table)
      if (table === 'room_players') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => {
                if (failOnce) {
                  failOnce = false
                  return Promise.reject(new Error('transient DB error'))
                }
                return Promise.resolve({ data: sharedValue().roomPlayers, error: null })
              }),
            })),
          })),
        }
      }
      return base
    })

    try {
      const game = makeJoiner()
      const joinPromise = game.joinRoom({ id: 'room-1', code: 'ABC123' } as any, 'z-uuid', 'WHITE')

      await jest.advanceTimersByTimeAsync(600) // poll 1: no game row yet
      await jest.advanceTimersByTimeAsync(1000) // poll 2: game row found but sync fails transiently
      expect(game.status).toBe(GameStatus.READY) // not stuck-dead yet

      await jest.advanceTimersByTimeAsync(2000) // poll 3: sync succeeds now
      await joinPromise

      expect(game.status).toBe(GameStatus.PLAYING)
    } finally {
      jest.requireMock('../supabase').supabase.from = origFrom
    }
  })
})
