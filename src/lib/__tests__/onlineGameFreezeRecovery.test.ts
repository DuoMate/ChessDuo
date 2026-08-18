import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team, GameState } from '../../features/game-engine/gameState'

// ---------------------------------------------------------------------------
// Board-freeze regression (P0): no promise may leave the board permanently
// disabled. Covers the three dead-ends in the Duo move state machine:
//   A. teammate submission missed via realtime → coordinator DB re-fetch
//   B. Stockfish cold-start / evaluator failure → recovery primitives restore
//   C. non-coordinator turn_resolved broadcast lost → timeout re-syncs from DB
// ---------------------------------------------------------------------------

const shared: {
  roomPlayers: Array<{ room_id: string; player_id: string; team: 'WHITE' | 'BLACK'; slot: number }>
  submissions: Array<{
    game_id: string; turn_number: number; player_id: string
    move_san: string; move_from: string; move_to: string; piece: string
  }>
} = {
  roomPlayers: [],
  submissions: [],
}
const sharedValue = () => shared

let saveGameStateMock = jest.fn().mockResolvedValue(undefined)
let loadGameStateMock = jest.fn().mockResolvedValue(null)
let channelSendMocks: Array<jest.Mock> = []

jest.mock('../gamePersistence', () => ({
  saveGameState: (...args: any[]) => saveGameStateMock(...args),
  loadGameState: jest.fn(() => loadGameStateMock()),
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
          presenceState: jest.fn(() => ({})),
          unsubscribe: jest.fn(),
        }
      }),
      removeChannel: jest.fn().mockResolvedValue(null),
      rpc: jest.fn(() => Promise.resolve({ data: sharedValue().roomPlayers, error: null })),
      from: jest.fn((table: string) => {
        if (table === 'turn_submissions') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn((col: string, val: string) => ({
                eq: jest.fn((col2: string, val2: number) => {
                  const rows = sharedValue().submissions.filter(
                    (s) => s[col as 'game_id' | 'turn_number'] === (val as never) && s[col2 as 'game_id' | 'turn_number'] === (val2 as never)
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

const START_POS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface TestGame {
  gameState: GameState
  turnState: 'selecting' | 'waiting_for_teammate' | 'locked' | 'resolving'
  [key: string]: any
}

function testG(game: OnlineGame): TestGame {
  return game as unknown as TestGame
}

function setupPlayers(game: OnlineGame, humans: Array<{ id: string; team: 'WHITE' | 'BLACK' }>) {
  for (const h of humans) {
    testG(game).gameState.addPlayer(h.id as any, h.team as Team)
  }
  const white = testG(game).gameState.getPlayers(Team.WHITE)
  const black = testG(game).gameState.getPlayers(Team.BLACK)
  for (let i = white.length; i < 2; i++) testG(game).gameState.addPlayer(`bot_teammate_${i + 1}` as any, Team.WHITE)
  for (let i = black.length; i < 2; i++) testG(game).gameState.addPlayer(`bot_opponent_${i + 1}` as any, Team.BLACK)
}

function startTurn(game: OnlineGame) {
  testG(game).gameState.startMatch()
  testG(game).gameState.startPendingTurn(testG(game).gameState.fen)
}

function makeClient(playerId: string, team: 'WHITE' | 'BLACK', coordinatorId: string) {
  const game = new OnlineGame(600)
  testG(game)._playerId = playerId
  testG(game)._team = team
  testG(game)._status = GameStatus.PLAYING
  testG(game)._coordinatorId = coordinatorId
  testG(game)._gameId = 'game-1'
  testG(game)._currentTurnNumber = 1
  testG(game).evaluator = {
    evaluateMoves: jest.fn().mockResolvedValue([
      { move: 'e2e4', score: 50 },
      { move: 'd2d4', score: 30 },
    ]),
  }
  testG(game)._channel = { send: jest.fn().mockResolvedValue(null) }
  return game
}

beforeEach(() => {
  shared.roomPlayers = []
  shared.submissions = []
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  loadGameStateMock = jest.fn().mockResolvedValue(null)
  channelSendMocks = []
})

describe('A — coordinator recovers when the teammate submission realtime event is missed', () => {
  it('waitForTeammateLock timeout re-fetches the current turn from DB and locks both moves', async () => {
    jest.useFakeTimers()
    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    // Coordinator submits locally (locked). The teammate's row IS persisted,
    // but the postgres_changes INSERT event was missed (channel gap).
    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')
    shared.submissions.push({
      game_id: 'game-1', turn_number: 1, player_id: 'player2',
      move_san: 'e4', move_from: 'e2', move_to: 'e4', piece: 'p',
    })

    expect(coordinator.isBothPendingLocked()).toBe(false)

    // Wait out the 15s lock timeout — recovery must restore the teammate move.
    const lockPromise = coordinator.waitForTeammateLock()
    await jest.advanceTimersByTimeAsync(16_000)
    await lockPromise

    // The DB re-fetch restored + locked the teammate's move: both locked now.
    expect(coordinator.isBothPendingLocked()).toBe(true)
    expect(coordinator.isPendingMoveLocked('player2' as any)).toBe(true)
    expect(testG(coordinator).gameState.phase).toBe('LOCKED')
    jest.useRealTimers()
  })

  it('recovery leaves turnState out of "waiting_for_teammate" so executeMove can resolve', async () => {
    jest.useFakeTimers()
    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')
    shared.submissions.push({
      game_id: 'game-1', turn_number: 1, player_id: 'player2',
      move_san: 'e4', move_from: 'e2', move_to: 'e4', piece: 'p',
    })

    const lockPromise = coordinator.waitForTeammateLock()
    await jest.advanceTimersByTimeAsync(16_000)
    await lockPromise

    expect(['resolving', 'locked', 'selecting']).toContain(testG(coordinator).turnState)
    expect(testG(coordinator).turnState).not.toBe('waiting_for_teammate')
    jest.useRealTimers()
  })
})

describe('B — evaluator cold-start / failure recovery primitives', () => {
  it('resolvePendingMoves rejects when Stockfish is not ready (Game.tsx catch recovers, never a dead end)', async () => {
    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    coordinator.setPendingMove('player1' as any, 'e4', 'e2', 'e4', 'p')
    coordinator.setPendingMove('player2' as any, 'e4', 'e2', 'e4', 'p')
    coordinator.lockPendingMove('player1' as any)
    coordinator.lockPendingMove('player2' as any)

    testG(coordinator).evaluator = {
      evaluateMoves: jest.fn().mockRejectedValue(new Error('Stockfish engine is not ready yet')),
    }

    await expect(coordinator.resolvePendingMoves()).rejects.toThrow('not ready')

    // The board-freeze invariant: Game.tsx's catch calls these exact recovery
    // primitives, after which no pending move of mine can keep the board locked.
    testG(coordinator).turnState = 'selecting'
    coordinator.clearPendingMove('player1' as any)
    expect(coordinator.getAllPendingMoves().has('player1')).toBe(false)
    expect(coordinator.getTurnState()).toBe('selecting')
  })

  it('clearPendingMove removes lock + selection for one player only', async () => {
    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    coordinator.setPendingMove('player1' as any, 'e4', 'e2', 'e4', 'p')
    coordinator.setPendingMove('player2' as any, 'd4', 'd2', 'd4', 'p')
    coordinator.lockPendingMove('player1' as any)
    coordinator.lockPendingMove('player2' as any)

    coordinator.clearPendingMove('player1' as any)

    expect(coordinator.getAllPendingMoves().has('player1')).toBe(false)
    expect(coordinator.isPendingMoveLocked('player1' as any)).toBe(false)
    expect(coordinator.getAllPendingMoves().has('player2')).toBe(true)
    expect(coordinator.isPendingMoveLocked('player2' as any)).toBe(true)
  })
})

describe('C — non-coordinator recovers when turn_resolved broadcast is lost', () => {
  it('waitForTurnChange timeout triggers a DB sync instead of doing nothing', async () => {
    jest.useFakeTimers()
    const nonCoord = makeClient('player2', 'WHITE', 'player1')
    setupPlayers(nonCoord, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(nonCoord)
    testG(nonCoord).turnState = 'locked'

    // The authoritative DB already advanced past the turn — a lost broadcast.
    loadGameStateMock = jest.fn().mockResolvedValue({
      id: 'game-1',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
      current_turn: 'BLACK',
      move_history: [{ team: 'WHITE', move: 'e4' }],
      status: 'PLAYING',
      turn_number: 1,
      coordinator_id: 'player1',
      turn_phase: 'SUBMITTING',
    })

    const syncSpy = jest.spyOn(nonCoord as unknown as { syncGameState: () => Promise<boolean> }, 'syncGameState')

    const changePromise = nonCoord.waitForTurnChange()
    await jest.advanceTimersByTimeAsync(31_000)
    await changePromise

    expect(syncSpy).toHaveBeenCalled()
    expect(testG(nonCoord)._turnChangeTimeout).toBeNull()
    syncSpy.mockRestore()
    jest.useRealTimers()
  })

  it('non-coordinator timeout does not leave turnState as "locked" forever (Game.tsx resets to selecting)', async () => {
    jest.useFakeTimers()
    const nonCoord = makeClient('player2', 'WHITE', 'player1')
    setupPlayers(nonCoord, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(nonCoord)
    testG(nonCoord).turnState = 'locked'

    // No game row (coordinator never persisted) — sync returns false but the
    // wait still resolves so Game.tsx can reset the input locks.
    loadGameStateMock = jest.fn().mockResolvedValue(null)

    const changePromise = nonCoord.waitForTurnChange()
    await jest.advanceTimersByTimeAsync(31_000)
    await changePromise

    // The waiter resolved — Game.tsx's post-await recovery now resets state.
    testG(nonCoord).turnState = 'selecting'
    nonCoord.clearPendingMove('player2' as any)
    expect(nonCoord.getTurnState()).toBe('selecting')
    expect(nonCoord.getAllPendingMoves().has('player2')).toBe(false)
    jest.useRealTimers()
  })
})
