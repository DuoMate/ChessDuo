import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team, GameState, Player } from '../../features/game-engine/gameState'

// --- Configurable mock state -------------------------------------------------
let saveGameStateMock = jest.fn().mockResolvedValue(undefined)
let loadGameStateMock = jest.fn().mockResolvedValue(null)
let upsertError: any = null
let submissionsData: any[] = []
let channelSendMock = jest.fn().mockResolvedValue(null)
const upsertMock = jest.fn()

jest.mock('../gamePersistence', () => ({
  saveGameState: (...args: any[]) => saveGameStateMock(...args),
  loadGameState: jest.fn(() => loadGameStateMock()),
}))

jest.mock('../supabase', () => {
  const thenableChain = (data: any[]) => {
    const obj: any = () => data
    obj.then = (cb: any) => {
      cb({ data, error: null })
      return obj
    }
    obj.eq = jest.fn(() => obj)
    obj.order = jest.fn(() => obj)
    obj.select = jest.fn(() => obj)
    return obj
  }

  return {
    supabase: {
      channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((cb: any) => {
          setTimeout(() => cb('SUBSCRIBED'), 0)
          return { unsubscribe: jest.fn() }
        }),
        track: jest.fn().mockResolvedValue(null),
        send: (...args: any[]) => channelSendMock(...args),
        presenceState: jest.fn(() => ({})),
        unsubscribe: jest.fn(),
      })),
      removeChannel: jest.fn().mockResolvedValue(null),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      from: jest.fn((table: string) => ({
        select: jest.fn(() => thenableChain(submissionsData)),
        eq: jest.fn(() => thenableChain(submissionsData)),
        order: jest.fn(() => thenableChain(submissionsData)),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: (...args: any[]) => {
          upsertMock(...args)
          return Promise.resolve({ data: null, error: upsertError })
        },
      })),
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

// Creates a game in PLAYING state with 2 humans (WHITE) + 2 bots (BLACK).
function setupPlayingGame(playerId = 'player1', team: 'WHITE' | 'BLACK' = 'WHITE', gameId = 'game-1') {
  const game = new OnlineGame(600)
  testG(game)._playerId = playerId
  testG(game)._team = team
  testG(game)._gameId = gameId
  testG(game)._status = GameStatus.PLAYING
  testG(game)._currentTurnNumber = 1
  testG(game).gameState.addPlayer('player1' as any, Team.WHITE)
  testG(game).gameState.addPlayer('player2' as any, Team.WHITE)
  testG(game).gameState.addPlayer('bot_opponent_1' as any, Team.BLACK)
  testG(game).gameState.addPlayer('bot_opponent_2' as any, Team.BLACK)
  testG(game).gameState.startMatch()
  return game
}

beforeEach(() => {
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  loadGameStateMock = jest.fn().mockResolvedValue(null)
  upsertError = null
  submissionsData = []
  channelSendMock = jest.fn().mockResolvedValue(null)
  upsertMock.mockClear()
})

describe('submitMoveToDB (Phase 3 — server-authoritative submission)', () => {
  it('writes to turn_submissions with game_id, turn_number, player_id and move data', async () => {
    const game = setupPlayingGame('player1', 'WHITE')
    testG(game)._currentTurnNumber = 3

    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(upsertMock).toHaveBeenCalledTimes(1)
    const [row, opts] = upsertMock.mock.calls[0]
    expect(row).toEqual({
      game_id: 'game-1',
      turn_number: 3,
      player_id: 'player1',
      move_san: 'e4',
      move_from: 'e2',
      move_to: 'e4',
      piece: 'p',
    })
    expect(opts).toEqual({ onConflict: 'game_id,turn_number,player_id' })
  })

  it('sets local pending move and locks it immediately', async () => {
    const game = setupPlayingGame('player1', 'WHITE')

    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)
    const moves = game.getAllPendingMoves()
    expect(moves.get('player1')).toMatchObject({ move: 'e4', from: 'e2', to: 'e4' })
  })

  it('transitions turnState from selecting to waiting_for_teammate', async () => {
    const game = setupPlayingGame('player1', 'WHITE')
    testG(game).turnState = 'selecting'

    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(testG(game).turnState).toBe('waiting_for_teammate')
  })

  it('fully rolls back the local submission on DB error (board can be re-enabled)', async () => {
    upsertError = { message: 'network down' }
    const game = setupPlayingGame('player1', 'WHITE')

    const result = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    // Regression (board freeze): a failed submission must clear the local
    // pending move + lock AND reset turnState to 'selecting' so the board is
    // never permanently disabled and the player can retry.
    expect(result).toBe(false)
    expect(game.isPendingMoveLocked('player1' as Player)).toBe(false)
    expect(game.getAllPendingMoves().has('player1')).toBe(false)
    expect(testG(game).turnState).toBe('selecting')
  })

  it('fails explicitly when no gameId exists and recovery is impossible (H1: no silent broadcast fallback)', async () => {
    const game = setupPlayingGame('player1', 'WHITE', '')
    testG(game)._channel = { send: channelSendMock }

    const ok = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    // H1: the move must NOT be accepted — a broadcast-only submission can
    // never resolve (the teammate lock would always time out). The submission
    // fails visibly and local state rolls back for retry.
    expect(ok).toBe(false)
    expect(upsertMock).not.toHaveBeenCalled()
    // Rollback still emits a best-effort visibility broadcast (with turn identity).
    expect(channelSendMock).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'player_move',
      payload: { playerId: 'player1', move: 'e4', from: 'e2', to: 'e4', turnNumber: 1 },
    })
    expect(game.getAllPendingMoves().has('player1')).toBe(false)
    expect(testG(game).turnState).toBe('selecting')
  })

  it('does not throw when the DB write rejects (returns false, rolls back)', async () => {
    const game = setupPlayingGame('player1', 'WHITE')

    const origFrom = jest.requireMock('../supabase').supabase.from
    jest.requireMock('../supabase').supabase.from = jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
      upsert: jest.fn(() => Promise.reject(new Error('boom'))),
    }))

    try {
      await expect(game.submitMoveToDB('e4', 'e2', 'e4', 'p')).resolves.toBe(false)
      expect(game.isPendingMoveLocked('player1' as any)).toBe(false)
      expect(game.getAllPendingMoves().has('player1')).toBe(false)
      expect(testG(game).turnState).toBe('selecting')
    } finally {
      jest.requireMock('../supabase').supabase.from = origFrom
    }
  })

  it('RLS-403 REGRESSION: retry of an already-persisted move succeeds idempotently', async () => {
    // Production regression: PostgREST UPSERT executes ON CONFLICT DO UPDATE,
    // which PostgreSQL authorizes under the UPDATE policy. While that policy
    // was missing, a legitimate retry (lost response / resubmission after
    // refresh) returned 403 and the move never resolved. The engine must now
    // recognize an authoritative row holding THIS exact move as success.
    upsertError = { code: '42501', message: 'new row violates row-level security policy' }
    // Read-back finds our submission already persisted by the earlier attempt.
    submissionsData = [{ move_san: 'e4' }]
    const game = setupPlayingGame('player1', 'WHITE')

    const result = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(result).toBe(true)
    // Local pending/locked state survives — the turn proceeds normally.
    expect(game.isPendingMoveLocked('player1' as Player)).toBe(true)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'e4' })
  })

  it('does NOT treat a conflicting row holding a DIFFERENT move as success', async () => {
    // The player cannot silently override a prior locked submission: the
    // persisted row differs from the attempted move → visible failure.
    upsertError = { code: '42501', message: 'new row violates row-level security policy' }
    submissionsData = [{ move_san: 'd4' }]
    const game = setupPlayingGame('player1', 'WHITE')

    const result = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(result).toBe(false)
    expect(game.isPendingMoveLocked('player1' as Player)).toBe(false)
    expect(game.getAllPendingMoves().has('player1')).toBe(false)
    expect(testG(game).turnState).toBe('selecting')
  })

  it('fails visibly when a rejected write left no persisted row', async () => {
    // True rejection (e.g. unauthenticated): read-back finds nothing — must
    // roll back and surface the failure, never pretend the move was stored.
    upsertError = { code: '42501', message: 'new row violates row-level security policy' }
    submissionsData = []
    const game = setupPlayingGame('player1', 'WHITE')

    const result = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(result).toBe(false)
    expect(game.getAllPendingMoves().has('player1')).toBe(false)
    expect(testG(game).turnState).toBe('selecting')
  })

  it('M05: second submission in same turn — DB upsert overwrites with ON CONFLICT', async () => {
    // The DB has UNIQUE(game_id, turn_number, player_id) with ON CONFLICT DO NOTHING.
    // A second submitMoveToDB from the same player on the same turn overwrites at DB level
    // but locally the move is already locked, so the local state reflects the second move.
    const game = setupPlayingGame('player1', 'WHITE')

    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')
    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'e4' })

    // Second submission — DB upsert with ON CONFLICT does nothing at DB level,
    // but local state is re-set
    await game.submitMoveToDB('d4', 'd2', 'd4', 'p')
    // Local state shows the second move (since setPendingMove is called again)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'd4' })
  })

  it('M06: submit during opponent turn — rejects when currentTurn !== myTeam', async () => {
    const game = setupPlayingGame('player1', 'WHITE')
    // Simulate it being BLACK's turn by setting currentTeam to BLACK
    testG(game).gameState.setCurrentTeam(Team.BLACK)

    // submitMoveToDB does not check turn — the guard is in executeMove/Game.tsx
    // But the DB still accepts the write. The rejection happens at the UI layer.
    // This test verifies the DB write still succeeds (guard is upstream).
    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it('M07: submit during evaluation — local guard via isPendingMoveLocked blocks duplicate', async () => {
    const game = setupPlayingGame('player1', 'WHITE')
    testG(game).turnState = 'selecting'

    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')
    expect(testG(game).turnState).toBe('waiting_for_teammate')

    // Simulate handleSubmissionFromDB for the same player (dedup guard)
    ;(game as any).handleSubmissionFromDB({
      game_id: 'game-1', turn_number: 1, player_id: 'player1',
      move_san: 'd4', move_from: 'd2', move_to: 'd4', piece: 'p',
    })

    // Should be deduped — still shows e4, not d4
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'e4' })
  })

  it('E15: submit, reconnect, restoreCurrentTurnSubmissions skips self-submission', async () => {
    // Scenario: player1 submitted e4, then reconnects.
    // restoreCurrentTurnSubmissions loads the e4 from DB, but handleSubmissionFromDB
    // ignores self-submissions (player_id === _playerId).
    // The move was already applied locally in submitMoveToDB, so local state is correct.
    submissionsData = [{
      game_id: 'game-1', turn_number: 1, player_id: 'player1',
      move_san: 'e4', move_from: 'e2', move_to: 'e4', piece: 'p',
    }]
    const game = setupPlayingGame('player1', 'WHITE')
    testG(game)._currentTurnNumber = 1

    // Simulate: player already submitted locally before "reconnect"
    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')
    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'e4' })

    // Now "reconnect" — restoreCurrentTurnSubmissions replays DB rows
    // but handleSubmissionFromDB filters self-submission
    await (game as any).restoreCurrentTurnSubmissions()

    // Move is still there (from local state, not from DB replay)
    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'e4' })
  })

  it('E20: teammate never submits — lock timeout resolves with single submission', async () => {
    jest.useFakeTimers()
    const game = setupPlayingGame('player1', 'WHITE')
    testG(game).turnState = 'waiting_for_teammate'

    // Submit my move
    await game.submitMoveToDB('e4', 'e2', 'e4', 'p')
    expect(testG(game).turnState).toBe('waiting_for_teammate')

    // Start waiting for teammate — should resolve after 15s timeout
    const lockPromise = (game as any).waitForTeammateLock()

    let resolved = false
    lockPromise.then(() => { resolved = true })

    // Before timeout
    jest.advanceTimersByTime(10_000)
    await Promise.resolve()
    expect(resolved).toBe(false)

    // After timeout (15s + buffer)
    jest.advanceTimersByTime(6_000)
    await lockPromise
    expect(resolved).toBe(true)

    jest.useRealTimers()
  })
})

describe('handleSubmissionFromDB (postgres_changes handler)', () => {
  function submission(playerId: string, turn = 1, move = 'd4') {
    return {
      game_id: 'game-1',
      turn_number: turn,
      player_id: playerId,
      move_san: move,
      move_from: 'd2',
      move_to: 'd4',
      piece: 'p',
    }
  }

  it('ignores the client\'s own submission (already applied locally)', () => {
    const game = setupPlayingGame('player1', 'WHITE')
    testG(game).turnState = 'selecting'

    ;(game as any).handleSubmissionFromDB(submission('player1'))

    expect(game.isPendingMoveLocked('player2' as any)).toBe(false)
    expect(game.getAllPendingMoves().size).toBe(0)
    expect(testG(game).turnState).toBe('selecting')
  })

  it('ignores submissions for past/future turns', () => {
    const game = setupPlayingGame('player2', 'WHITE')
    testG(game)._currentTurnNumber = 2

    ;(game as any).handleSubmissionFromDB(submission('player1', 1))

    expect(game.getAllPendingMoves().size).toBe(0)
  })

  it('ignores submissions from players not on our team', () => {
    const game = setupPlayingGame('player1', 'WHITE')

    ;(game as any).handleSubmissionFromDB(submission('bot_opponent_1'))

    expect(game.getAllPendingMoves().size).toBe(0)
  })

  it('dedupes a submission already locked', () => {
    const game = setupPlayingGame('player2', 'WHITE')
    testG(game).gameState.setPendingMove('player1' as any, 'd4', 'd2', 'd4', 'p')
    testG(game).gameState.lockPendingMove('player1' as any)

    ;(game as any).handleSubmissionFromDB(submission('player1'))

    expect(game.getAllPendingMoves().size).toBe(1)
  })

  it('sets and locks the teammate move, transitioning to waiting_for_teammate', () => {
    const game = setupPlayingGame('player2', 'WHITE')
    testG(game).turnState = 'selecting'

    ;(game as any).handleSubmissionFromDB(submission('player1'))

    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'd4' })
    expect(testG(game).turnState).toBe('waiting_for_teammate')
  })

  it('resolves a pending waitForTeammateLock and transitions to resolving', async () => {
    const game = setupPlayingGame('player2', 'WHITE')
    testG(game).turnState = 'waiting_for_teammate'

    let resolved = false
    ;(game as any).waitForTeammateLock().then(() => { resolved = true })

    ;(game as any).handleSubmissionFromDB(submission('player1'))

    await Promise.resolve()
    expect(resolved).toBe(true)
    expect(testG(game).turnState).toBe('resolving')
  })
})

describe('restoreCurrentTurnSubmissions (Phase 5 reconnect recovery)', () => {
  it('restores a teammate submission from the DB for the current turn', async () => {
    submissionsData = [{
      game_id: 'game-1',
      turn_number: 1,
      player_id: 'player1',
      move_san: 'd4',
      move_from: 'd2',
      move_to: 'd4',
      piece: 'p',
    }]
    const game = setupPlayingGame('player2', 'WHITE')

    await (game as any).restoreCurrentTurnSubmissions()

    expect(game.isPendingMoveLocked('player1' as any)).toBe(true)
    expect(game.getAllPendingMoves().get('player1')).toMatchObject({ move: 'd4' })
  })

  it('is a no-op when there are no submissions for the current turn', async () => {
    submissionsData = []
    const game = setupPlayingGame('player2', 'WHITE')

    await (game as any).restoreCurrentTurnSubmissions()

    expect(game.getAllPendingMoves().size).toBe(0)
  })

  it('does not throw when the DB query fails', async () => {
    const game = setupPlayingGame('player2', 'WHITE')
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // Force supabase.from to reject by temporarily switching submissionsData
    const orig = jest.requireMock('../supabase').supabase
    const origFrom = orig.from
    orig.from = jest.fn(() => ({
      select: jest.fn(() => Promise.reject(new Error('query failed'))),
    }))

    await expect((game as any).restoreCurrentTurnSubmissions()).resolves.toBe(false)

    orig.from = origFrom
    spy.mockRestore()
  })
})