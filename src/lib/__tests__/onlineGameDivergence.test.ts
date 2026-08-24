import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team, GameState } from '../../features/game-engine/gameState'

// ---------------------------------------------------------------------------
// ADR-006 — Idempotent Resolution & Divergence Policy.
//
// "Invalid move: <SAN>" at resolution is a diagnostic: the client's local
// chess.js position diverged from the position a pending submission was
// generated against. These tests pin the contract:
//   1. illegal pending moves NEVER reach chess.move() — they trigger
//      STATE_DIVERGENCE recovery (re-sync, clear pendings) instead
//   2. resolution is single-writer (RESOLVE_IN_PROGRESS re-entry rejected)
//   3. duplicate/equal-seq turn_resolved events are no-ops
//   4. clock broadcasts never advance board/turn state
//   5. a stale games row can never roll the board backward
// ---------------------------------------------------------------------------

let saveGameStateMock = jest.fn().mockResolvedValue(undefined)
let loadGameStateMock = jest.fn().mockResolvedValue(null)

jest.mock('../gamePersistence', () => ({
  saveGameState: (...args: any[]) => saveGameStateMock(...args),
  loadGameState: (...args: any[]) => loadGameStateMock(...args),
}))

jest.mock('../supabase', () => {
  return {
    supabase: {
      channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((cb: any) => {
          setTimeout(() => cb('SUBSCRIBED'), 0)
          return { unsubscribe: jest.fn() }
        }),
        track: jest.fn().mockResolvedValue(null),
        send: jest.fn().mockResolvedValue(null),
        presenceState: jest.fn(() => ({})),
        unsubscribe: jest.fn(),
      })),
      removeChannel: jest.fn().mockResolvedValue(null),
      rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
      from: jest.fn((table: string) => {
        if (table === 'games') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
            upsert: jest.fn(() => Promise.resolve({ data: [{ id: 'game-1' }], error: null })),
          }
        }
        if (table === 'turn_submissions') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
            upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        }
      }),
    },
  }
})

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
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  loadGameStateMock = jest.fn().mockResolvedValue(null)
})

describe('ADR-006 divergence gate in resolvePendingMoves', () => {
  it('rejects with STATE_DIVERGENCE and never mutates the board when a pending move is illegal', async () => {
    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    // e4 is legal from the start position; Nf6 is NOT (black knight on g8
    // cannot jump to f6 while WHITE is to move). This is exactly the shape of
    // the production failure: a submission for the WRONG turn/position.
    coordinator.setPendingMove('player1' as any, 'e4', 'e2', 'e4', 'p')
    coordinator.setPendingMove('player2' as any, 'Nf6', 'g8', 'f6', 'n')
    coordinator.lockPendingMove('player1' as any)
    coordinator.lockPendingMove('player2' as any)

    const fenBefore = coordinator.fen
    const evaluatorSpy = testG(coordinator).evaluator.evaluateMoves as jest.Mock

    await expect(coordinator.resolvePendingMoves()).rejects.toThrow('STATE_DIVERGENCE')

    // Board untouched, no Stockfish work wasted on divergent data.
    expect(coordinator.fen).toBe(fenBefore)
    expect(evaluatorSpy).not.toHaveBeenCalled()
    // Turn is cleanly reopened for retry after recovery.
    expect(testG(coordinator).turnState).toBe('selecting')
    expect(coordinator.getAllPendingMoves().size).toBe(0)
    expect(testG(coordinator).gameState.phase).toBe('SELECTING')
  })

  it('divergence recovery attempts an authoritative re-sync from the DB row', async () => {
    const coordinator = makeClient('player1', 'WHITE', 'player1')
    testG(coordinator)._room = { id: 'room-1' } as any
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    coordinator.setPendingMove('player1' as any, 'e4', 'e2', 'e4', 'p')
    coordinator.setPendingMove('player2' as any, 'Nf6', 'g8', 'f6', 'n')
    coordinator.lockPendingMove('player1' as any)
    coordinator.lockPendingMove('player2' as any)

    await expect(coordinator.resolvePendingMoves()).rejects.toThrow('STATE_DIVERGENCE')

    expect(loadGameStateMock).toHaveBeenCalledWith('room-1')
  })

  it('resolves normally (no divergence) when both pending moves are legal', async () => {
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

    const result = await coordinator.resolvePendingMoves()

    expect(['e4', 'd4']).toContain(result.winningMove)
    // The winning move was applied exactly once — black to move now.
    expect(coordinator.currentTurn).toBe(Team.BLACK)
    expect(coordinator.fen.split(' ')[1]).toBe('b')
  })

  it('is single-writer: a second invocation while resolving throws RESOLVE_IN_PROGRESS', async () => {
    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    testG(coordinator)._resolving = true

    await expect(coordinator.resolvePendingMoves()).rejects.toThrow('RESOLVE_IN_PROGRESS')
  })
})

describe('ADR-006 handleTurnResolved idempotency', () => {
  function receiveResolved(game: OnlineGame, payload: Record<string, unknown>) {
    ;(testG(game).handleTurnResolved as Function).call(game, payload)
  }

  it('ignores an equal-seq duplicate of an already-applied resolution', () => {
    const client = makeClient('player2', 'BLACK', 'player1')
    setupPlayers(client, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'BLACK' },
    ])
    startTurn(client)

    testG(client)._turnSequence = 5
    testG(client)._lastAppliedResolution = { turnSequence: 5, winningMove: 'e4' }
    const fenBefore = client.fen

    receiveResolved(client, {
      winningTeam: 'WHITE',
      winningMove: 'e4',
      coordinatorId: 'player1',
      turnSequence: 5,
      turnNumber: 2,
    })

    // No double application: the position did not change again.
    expect(client.fen).toBe(fenBefore)
    expect(client.currentTurn).toBe(Team.WHITE)
  })

  it('applies a legal move directly when the local phase was never LOCKED (lost submission)', () => {
    const client = makeClient('player2', 'BLACK', 'player1')
    setupPlayers(client, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'BLACK' },
    ])
    startTurn(client)

    const fenBefore = client.fen

    receiveResolved(client, {
      winningTeam: 'WHITE',
      winningMove: 'e4',
      coordinatorId: 'player1',
      turnSequence: 1,
      turnNumber: 2,
    })

    expect(client.fen).not.toBe(fenBefore)
    expect(testG(client)._lastAppliedResolution).toEqual({ turnSequence: 1, winningMove: 'e4' })
    expect(client.fen.split(' ')[1]).toBe('b')
    expect(client.currentTurn).toBe(Team.BLACK)
  })

  it('does not blind-apply an ILLEGAL turn_resolved move — triggers authoritative re-sync instead', async () => {
    const client = makeClient('player2', 'BLACK', 'player1')
    testG(client)._room = { id: 'room-1' } as any
    setupPlayers(client, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'BLACK' },
    ])
    startTurn(client)

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const fenBefore = client.fen

    receiveResolved(client, {
      winningTeam: 'BLACK',
      winningMove: 'Nf6',
      coordinatorId: 'player1',
      turnSequence: 3,
      turnNumber: 2,
    })
    // Nf6 is illegal while WHITE is to move — the old code force-applied it.
    // The re-sync is fire-and-forget; let its first await boundary settle.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(client.fen).toBe(fenBefore)
    expect(loadGameStateMock).toHaveBeenCalledWith('room-1')
    errorSpy.mockRestore()
  })
})

describe('ADR-006 clock/board separation', () => {
  it('timer_sync broadcasts advance the clock but never the turn number', () => {
    const client = makeClient('player2', 'BLACK', 'player1')
    const beforeTurn = testG(client)._currentTurnNumber

    ;(testG(client).handleTimerSync as Function).call(client, { matchTimeRemaining: 42, turnNumber: 99 })

    expect(testG(client)._currentTurnNumber).toBe(beforeTurn)
    expect(client.getMatchTimeRemaining()).toBe(42)
  })
})

describe('ADR-006 stale-authority guard in syncGameState', () => {
  it('refuses to roll the board back onto a games row with a SHORTER move history', async () => {
    const client = makeClient('player1', 'WHITE', 'player1')
    testG(client)._room = { id: 'room-1' } as any
    setupPlayers(client, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'BLACK' },
    ])
    startTurn(client)

    // Local board has advanced one move past the (stale) starting FEN that the
    // frozen pre-migration games row still holds.
    client.board.move('e4')
    const localFenAfterMove = client.fen

    loadGameStateMock.mockResolvedValue({
      gameId: 'game-1',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      currentTurn: 'BLACK',
      moveHistory: [],
      status: 'PLAYING',
      turnNumber: 0,
      coordinatorId: 'player1',
    })

    const synced = await testG(client).syncGameState()

    expect(synced).toBe(true)
    // Local fresher state preserved — no backward rollback onto the stale row.
    expect(client.fen).toBe(localFenAfterMove)
  })
})
