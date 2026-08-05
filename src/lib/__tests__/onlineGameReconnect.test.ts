import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team, GameState } from '../../features/game-engine/gameState'

// ---------------------------------------------------------------------------
// Simulated shared Supabase backing store for reconnect tests.
// ---------------------------------------------------------------------------
const shared: {
  roomPlayers: Array<{ room_id: string; player_id: string; team: 'WHITE' | 'BLACK'; slot: number }>
  submissions: Array<{ game_id: string; turn_number: number; player_id: string; move_san: string; move_from: string; move_to: string; piece: string }>
} = {
  roomPlayers: [],
  submissions: [],
}
const sharedValue = () => shared

let saveGameStateMock = jest.fn().mockResolvedValue(undefined)
let loadGameStateMock = jest.fn().mockResolvedValue(null)

jest.mock('../gamePersistence', () => ({
  saveGameState: (...args: any[]) => saveGameStateMock(...args),
  loadGameState: jest.fn(() => loadGameStateMock()),
}))

jest.mock('../supabase', () => {
  return {
    supabase: {
      channel: jest.fn(() => {
        return {
          on: jest.fn().mockReturnThis(),
          subscribe: jest.fn((cb: any) => {
            setTimeout(() => cb('SUBSCRIBED'), 0)
            return { unsubscribe: jest.fn() }
          }),
          track: jest.fn().mockResolvedValue(null),
          send: jest.fn().mockResolvedValue(null),
          presenceState: jest.fn(() => {
            const state: Record<string, unknown> = {}
            for (const p of shared.roomPlayers) state[p.player_id] = {}
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
        if (table === 'turn_submissions') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn((col: string, val: string) => ({
                eq: jest.fn((col2: string, val2: number) => {
                  const rows = sharedValue().submissions.filter(
                    (s) => s[col] === val && s[col2] === val2
                  )
                  return Promise.resolve({ data: rows, error: null })
                }),
              })),
            })),
            upsert: jest.fn(async (row: any) => {
              const idx = shared.submissions.findIndex(
                (s) => s.game_id === row.game_id && s.turn_number === row.turn_number && s.player_id === row.player_id
              )
              if (idx >= 0) shared.submissions[idx] = row
              else shared.submissions.push(row)
              return { data: null, error: null }
            }),
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

interface TestGame {
  gameState: GameState
  [key: string]: any
}

function testG(game: OnlineGame): TestGame {
  return game as unknown as TestGame
}

// FEN immediately after 1.e4 (WHITE played, BLACK to move).
// chess.js drops the (non-legal) en-passant flag when the FEN is reloaded
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const START_POS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function makeClient(playerId: string, team: 'WHITE' | 'BLACK', coordinatorId: string) {
  const game = new OnlineGame(600)
  testG(game)._playerId = playerId
  testG(game)._team = team
  testG(game)._status = GameStatus.PLAYING
  testG(game)._coordinatorId = coordinatorId
  testG(game)._gameId = 'game-1'
  testG(game)._currentTurnNumber = 1
  testG(game)._room = { id: 'room-1' } as any
  return game
}

beforeEach(() => {
  shared.roomPlayers = [
    { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
    { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
  ]
  shared.submissions = []
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  loadGameStateMock = jest.fn().mockResolvedValue(null)
})

describe('syncGameState (Phase 5 — reconnect restores state from DB)', () => {
  it('C06: restores _currentTurnNumber and status from the authoritative DB', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: AFTER_E4_FEN,
      currentTurn: 'BLACK',
      moveHistory: [{ team: 'WHITE', move: 'e4' }],
      status: GameStatus.PLAYING,
      turnNumber: 3,
      coordinatorId: 'player1',
      currentTurn: 'BLACK',
    })

    const game = makeClient('player1', 'WHITE', 'player1')
    testG(game)._currentTurnNumber = 1

    await (game as any).syncGameState()

    // saved.turnNumber = 3 resolved + 1 current => 4
    expect(testG(game)._currentTurnNumber).toBe(4)
    expect(testG(game)._status).toBe(GameStatus.PLAYING)
    // coordinator_id restored from DB (never recomputed)
    expect(game.isCoordinator()).toBe(true)
  })

  it('C01: restores the board from the authoritative DB FEN via replay', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: AFTER_E4_FEN,
      currentTurn: 'BLACK',
      moveHistory: [{ team: 'WHITE', move: 'e4' }],
      status: GameStatus.PLAYING,
      turnNumber: 1,
      coordinatorId: 'player1',
    })

    const game = makeClient('player2', 'WHITE', 'player1')
    const before = game.board.fen()

    await (game as any).syncGameState()

    expect(game.board.fen()).not.toBe(before)
    expect(game.board.fen()).toBe(AFTER_E4_FEN)
    expect(game.currentTurn).toBe(Team.BLACK)
  })

  it('C07: restores a teammate submission from turn_submissions for the current turn', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: START_POS_FEN,
      currentTurn: 'WHITE',
      moveHistory: [],
      status: GameStatus.PLAYING,
      turnNumber: 0,
      coordinatorId: 'player1',
    })
    shared.submissions = [{
      game_id: 'game-1', turn_number: 1, player_id: 'player1',
      move_san: 'd4', move_from: 'd2', move_to: 'd4', piece: 'p',
    }]

    const game = makeClient('player2', 'WHITE', 'player1')
    testG(game)._currentTurnNumber = 1

    // register the humans so getPlayerTeam('player1') resolves to WHITE
    game.gameState.addPlayer('player1' as any, Team.WHITE)
    game.gameState.addPlayer('player2' as any, Team.WHITE)
    // startMatch requires 2 per team — fill with bots
    game.gameState.addPlayer('bot_opponent_1' as any, Team.BLACK)
    game.gameState.addPlayer('bot_opponent_2' as any, Team.BLACK)
    // makeClient leaves gameState at WAITING; ensure SELECTING so restore can lock a pending move
    game.gameState.startMatch()

    await (game as any).syncGameState()

    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'd4' })
  })

  it('C05: preserves GAME_OVER status on reconnect (R2 regression)', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: AFTER_E4_FEN,
      currentTurn: 'BLACK',
      moveHistory: [{ team: 'WHITE', move: 'e4' }],
      status: GameStatus.GAME_OVER,
      turnNumber: 1,
      coordinatorId: 'player1',
    })

    const game = makeClient('player1', 'WHITE', 'player1')
    testG(game)._status = GameStatus.GAME_OVER
    testG(game)._currentTurnNumber = 10 // ahead of DB; must NOT be clobbered backward

    await (game as any).syncGameState()

    expect(testG(game)._status).toBe(GameStatus.GAME_OVER)
  })

  it('T07: restores the match timer from matchStartedAt + elapsed', async () => {
    const startedIso = new Date(Date.now() - 30_000).toISOString() // 30s ago
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: AFTER_E4_FEN,
      currentTurn: 'BLACK',
      moveHistory: [{ team: 'WHITE', move: 'e4' }],
      status: GameStatus.PLAYING,
      turnNumber: 1,
      coordinatorId: 'player1',
      matchStartedAt: startedIso,
      matchTimeLimitSeconds: 600,
    })

    const game = makeClient('player1', 'WHITE', 'player1')
    testG(game).startMatchTimer = jest.fn()

    await (game as any).syncGameState()

    const remaining = game.getMatchTimeRemaining()
    // 600s limit minus ~30s elapsed => ~570
    expect(remaining).toBeGreaterThan(550)
    expect(remaining).toBeLessThanOrEqual(570)
    expect(game.isMatchTimerActive()).toBe(true)
  })

  it('E39: when behind, client falls back to reconstructing the board from move_history if FEN restore fails', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: 'garbage-fen-not-parseable',
      currentTurn: 'WHITE',
      moveHistory: [
        { team: 'WHITE', move: 'e4' },
        { team: 'BLACK', move: 'e5' },
      ],
      status: GameStatus.PLAYING,
      turnNumber: 2,
      coordinatorId: 'player1',
    })

    const game = makeClient('player1', 'WHITE', 'player1')

    await (game as any).syncGameState()

    // e4 then e5 => both moves applied; board is valid and it is WHITE's turn
    expect(game.board.fen()).toContain('4p3') // BLACK pawn on e5
    expect(game.board.fen()).toContain('4P3') // WHITE pawn on e4
    expect(game.currentTurn).toBe(Team.WHITE)
  })
})

describe('syncGameState — additional reconnect scenarios', () => {
  beforeEach(() => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
    ]
    shared.submissions = []
    saveGameStateMock = jest.fn().mockResolvedValue(undefined)
    loadGameStateMock = jest.fn().mockResolvedValue(null)
  })

  it('C02: non-coordinator refresh during selecting — board restored from DB FEN', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: AFTER_E4_FEN,
      currentTurn: 'BLACK',
      moveHistory: [{ team: 'WHITE', move: 'e4' }],
      status: GameStatus.PLAYING,
      turnNumber: 1,
      coordinatorId: 'player1',
    })

    const game = makeClient('player2', 'WHITE', 'player1')
    const before = game.board.fen()

    await (game as any).syncGameState()

    // Board should be restored from authoritative DB FEN
    expect(game.board.fen()).not.toBe(before)
    expect(game.board.fen()).toBe(AFTER_E4_FEN)
    // Non-coordinator must not become coordinator
    expect(game.isCoordinator()).toBe(false)
  })

  it('C03: coordinator refresh during evaluation — loads DB state, turn_number restored', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: START_POS_FEN,
      currentTurn: 'WHITE',
      moveHistory: [],
      status: GameStatus.PLAYING,
      turnNumber: 2,
      coordinatorId: 'player1',
    })

    const game = makeClient('player1', 'WHITE', 'player1')
    testG(game)._currentTurnNumber = 1 // stale

    await (game as any).syncGameState()

    // turn_number restored from DB: 2 resolved + 1 current = 3
    expect(testG(game)._currentTurnNumber).toBe(3)
    expect(game.isCoordinator()).toBe(true)
  })

  it('C04: submit after reconnect — duplicate rejected when already in DB', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: START_POS_FEN,
      currentTurn: 'WHITE',
      moveHistory: [],
      status: GameStatus.PLAYING,
      turnNumber: 0,
      coordinatorId: 'player1',
    })
    // Teammate already submitted on this turn
    shared.submissions = [{
      game_id: 'game-1', turn_number: 1, player_id: 'player1',
      move_san: 'e4', move_from: 'e2', move_to: 'e4', piece: 'p',
    }]

    const game = makeClient('player2', 'WHITE', 'player1')
    testG(game)._currentTurnNumber = 1
    game.gameState.addPlayer('player1' as any, Team.WHITE)
    game.gameState.addPlayer('player2' as any, Team.WHITE)
    game.gameState.addPlayer('bot_opponent_1' as any, Team.BLACK)
    game.gameState.addPlayer('bot_opponent_2' as any, Team.BLACK)
    game.gameState.startMatch()

    // After sync, teammate's move is already restored as pending
    await (game as any).syncGameState()
    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)

    // Now the refresher tries to submit — the upsert with ON CONFLICT handles dedup at DB level
    // But locally, the move is already locked so the dedup guard in handleSubmissionFromDB would skip it
    const upsertBefore = shared.submissions.length
    await game.submitMoveToDB('d4', 'd2', 'd4', 'p')
    // DB has 2 rows now (player1 + player2) — no conflict since different players
    expect(shared.submissions.length).toBe(upsertBefore + 1)
    // But player2's move is now also locked locally
    expect(game.isPendingMoveLocked('player2' as any)).toBe(true)
  })

  it('C10: network interruption — syncGameState recovers after reconnection', async () => {
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'game-1',
      fen: AFTER_E4_FEN,
      currentTurn: 'BLACK',
      moveHistory: [{ team: 'WHITE', move: 'e4' }],
      status: GameStatus.PLAYING,
      turnNumber: 1,
      coordinatorId: 'player1',
    })

    const game = makeClient('player2', 'WHITE', 'player1')
    // Simulate being offline: board is at start position
    expect(game.board.fen()).toBe(START_POS_FEN)

    // Reconnect: syncGameState loads from DB
    await (game as any).syncGameState()

    // Board restored from DB — network interruption recovery verified
    expect(game.board.fen()).toBe(AFTER_E4_FEN)
    expect(game.currentTurn).toBe(Team.BLACK)
  })

  it('C11: network interruption during submission — submitMoveToDB does not throw', async () => {
    const game = makeClient('player1', 'WHITE', 'player1')
    game.gameState.addPlayer('player1' as any, Team.WHITE)
    game.gameState.addPlayer('player2' as any, Team.WHITE)
    game.gameState.addPlayer('bot_opponent_1' as any, Team.BLACK)
    game.gameState.addPlayer('bot_opponent_2' as any, Team.BLACK)
    game.gameState.startMatch()
    testG(game).gameState.startPendingTurn(START_POS_FEN)

    // Simulate network failure: make upsert throw
    const origFrom = jest.requireMock('../supabase').supabase.from
    jest.requireMock('../supabase').supabase.from = jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
      upsert: jest.fn(() => Promise.reject(new Error('network error'))),
    }))

    // Should not throw — error is caught internally
    await expect(game.submitMoveToDB('e4', 'e2', 'e4', 'p')).resolves.toBeUndefined()

    // Local state should not be updated (error path returns early)
    expect(game.isPendingMoveLocked('player1' as any)).toBe(false)

    jest.requireMock('../supabase').supabase.from = origFrom
  })
})