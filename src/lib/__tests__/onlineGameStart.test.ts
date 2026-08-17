import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team } from '../../features/game-engine/gameState'
import { supabase } from '../supabase'

// ---------------------------------------------------------------------------
// Simulated shared backing store: room_players + realtime presence.
// This mimics the Duo join race — the joiner is already PRESENT in the channel
// (with team metadata) but their room_players row may not be committed yet.
// ---------------------------------------------------------------------------
const shared: {
  roomPlayers: Array<{ room_id: string; player_id: string; team: 'WHITE' | 'BLACK'; slot: number }>
  presence: Record<string, { player_id?: string; team?: 'WHITE' | 'BLACK' }>
} = {
  roomPlayers: [],
  presence: {},
}
const sharedValue = () => shared

let saveGameStateMock = jest.fn().mockResolvedValue(undefined)
let loadGameStateCalls = 0
let gameRow: any = null
let channelSendMocks: Array<jest.Mock> = []

jest.mock('../gamePersistence', () => ({
  saveGameState: (...args: any[]) => saveGameStateMock(...args),
  loadGameState: jest.fn(() => {
    loadGameStateCalls += 1
    // First call is the "does a game already exist?" pre-check → null.
    // Second call (after save) should return the persisted row.
    if (loadGameStateCalls === 1) return Promise.resolve(null)
    return Promise.resolve(gameRow)
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
      rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
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
  [key: string]: any
}

function t(g: OnlineGame): T {
  return g as unknown as T
}

function makeGame({ playerId, team, roomIsFourPlayer = false }: { playerId: string; team: 'WHITE' | 'BLACK'; roomIsFourPlayer?: boolean }) {
  const game = new OnlineGame(600)
  t(game)._playerId = playerId
  t(game)._team = team
  t(game)._status = GameStatus.READY
  t(game)._room = {
    id: 'room-1',
    code: 'ABC123',
    mode: roomIsFourPlayer ? 'fourplayer' : 'online',
    host_team: team,
  }
  // Real joinRoom sets the channel via supabase.channel(); this test drives
  // startGameWhenReady directly, so wire the same shape (presence + send).
  t(game)._channel = (supabase as any).channel(`room:room-1`)
  return game
}

beforeEach(() => {
  shared.roomPlayers = []
  shared.presence = {}
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  loadGameStateCalls = 0
  gameRow = null
  channelSendMocks = []
})

afterEach(() => {
  // startGameWhenReady arms timer intervals on success — clear to avoid leaks.
  for (const mock of [...(global as any).__clearedIntervals || []]) {
    clearInterval(mock)
  }
  ;(global as any).__clearedIntervals = []
})

describe('startGameWhenReady — presence-authoritative human count', () => {
  it('starts when both humans are present in the channel even if the joiner room_players row has not committed yet', async () => {
    // Duo host picked BLACK. The joiner is live in presence (with team meta)
    // but only the host's room_players row exists — the exact lobby-timeout race.
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'host-uuid', team: 'BLACK', slot: 0 },
    ]
    shared.presence = {
      'host-uuid': { player_id: 'host-uuid', team: 'BLACK' },
      'joiner-uuid': { player_id: 'joiner-uuid', team: 'BLACK' },
    }
    gameRow = {
      id: 'game-1',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      current_turn: 'WHITE',
      move_history: [],
      status: 'PLAYING',
      turn_number: 0,
      coordinator_id: 'host-uuid',
    }

    const game = makeGame({ playerId: 'host-uuid', team: 'BLACK' })
    await game.startGameWhenReady()

    expect(game.status).toBe(GameStatus.PLAYING)
    // Both humans seated on BLACK (both chose Black in Duo).
    const blacks = game.getPlayers(Team.BLACK)
    expect(blacks).toContain('host-uuid')
    expect(blacks).toContain('joiner-uuid')
    // Bots fill the WHITE side (bots on the non-human team).
    const whites = game.getPlayers(Team.WHITE)
    expect(whites).toEqual(['bot_teammate_1', 'bot_teammate_2'])
    // Coordinator broadcast game_started so the joiner syncs.
    const sends = channelSendMocks.flatMap((m) => m.mock.calls)
    expect(sends.some((args) => args[0]?.event === 'game_started')).toBe(true)
  })

  it('derives the unknown-team joiner from room.host_team when presence meta has no team', async () => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'host-uuid', team: 'BLACK', slot: 0 },
    ]
    // Presence keys without metadata (edge case: metadata stripped).
    shared.presence = { 'host-uuid': {}, 'joiner-uuid': {} }
    gameRow = {
      id: 'game-1',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      current_turn: 'WHITE',
      move_history: [],
      status: 'PLAYING',
      turn_number: 0,
      coordinator_id: 'host-uuid',
    }

    const game = makeGame({ playerId: 'host-uuid', team: 'BLACK' })
    await game.startGameWhenReady()

    expect(game.status).toBe(GameStatus.PLAYING)
    expect(game.getPlayers(Team.BLACK)).toEqual(['host-uuid', 'joiner-uuid'])
  })

  it('defers when fewer humans are present than required (joiner not connected yet)', async () => {
    // Both rows exist but only the host is live in the channel.
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'host-uuid', team: 'BLACK', slot: 0 },
      { room_id: 'room-1', player_id: 'joiner-uuid', team: 'BLACK', slot: 0 },
    ]
    shared.presence = {
      'host-uuid': { player_id: 'host-uuid', team: 'BLACK' },
    }

    const game = makeGame({ playerId: 'host-uuid', team: 'BLACK' })
    await game.startGameWhenReady()

    expect(game.status).toBe(GameStatus.READY)
    expect((game as any).starting).toBe(false)
  })

  it('does not start a 2-human duo room from a single present human in a four-player room', async () => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'a-uuid', team: 'WHITE', slot: 0 },
    ]
    shared.presence = {
      'a-uuid': { player_id: 'a-uuid', team: 'WHITE' },
    }

    const game = makeGame({ playerId: 'a-uuid', team: 'WHITE', roomIsFourPlayer: true })
    await game.startGameWhenReady()

    expect(game.status).toBe(GameStatus.READY)
  })
})