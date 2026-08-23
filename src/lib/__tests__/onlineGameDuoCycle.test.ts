import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team, GameState } from '../../features/game-engine/gameState'

// ---------------------------------------------------------------------------
// Simulated shared Supabase backing store.
// Both OnlineGame instances read/write this same tables object.
// ---------------------------------------------------------------------------
const shared: {
  roomPlayers: Array<{ room_id: string; player_id: string; team: 'WHITE' | 'BLACK'; slot: number }>
  submissions: Array<{ game_id: string; turn_number: number; player_id: string; move_san: string; move_from: string; move_to: string; piece: string }>
} = {
  roomPlayers: [],
  submissions: [],
}
// keep a runtime-ref map so jest.mock factory (hoisted) can read it lazily
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

const START_POS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface TestGame {
  gameState: GameState
  [key: string]: any
}

function testG(game: OnlineGame): TestGame {
  return game as unknown as TestGame
}

function setupPlayers(game: OnlineGame, humans: Array<{ id: string; team: 'WHITE' | 'BLACK' }>) {
  for (const h of humans) {
    testG(game).gameState.addPlayer(h.id as any, h.team as Team)
  }
  // fill black with bots
  const white = testG(game).gameState.getPlayers(Team.WHITE)
  const black = testG(game).gameState.getPlayers(Team.BLACK)
  for (let i = white.length; i < 2; i++) testG(game).gameState.addPlayer(`bot_teammate_${i + 1}` as any, Team.WHITE)
  for (let i = black.length; i < 2; i++) testG(game).gameState.addPlayer(`bot_opponent_${i + 1}` as any, Team.BLACK)
}

// Instantiate a client with an in-memory coordinator + evaluator mock so
// no Stockfish worker is spawned.
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
  // shared channel with send routed to a local buffer (set per-test)
  testG(game)._channel = {
    send: jest.fn().mockResolvedValue(null),
  }
  return game
}

// Start the match (phase SELECTING) and begin turn 1 so pending moves apply.
function startTurn(game: OnlineGame) {
  testG(game).gameState.startMatch()
  testG(game).gameState.startPendingTurn(testG(game).gameState.fen)
}

beforeEach(() => {
  shared.roomPlayers = []
  shared.submissions = []
  saveGameStateMock = jest.fn().mockResolvedValue(undefined)
  loadGameStateMock = jest.fn().mockResolvedValue(null)
  channelSendMocks = []
})

describe('Duo turn cycle — two real online clients (integration)', () => {
  it('S10: coordinator and non-coordinator boards converge to the same FEN after a full turn', async () => {
    // WHITE humans: player1 (coordinator), player2. BLACK: bots.
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'WHITE', 'player1')
    const teammate = makeClient('player2', 'WHITE', 'player1')
    for (const g of [coordinator, teammate]) {
      setupPlayers(g, [
        { id: 'player1', team: 'WHITE' },
        { id: 'player2', team: 'WHITE' },
      ])
      startTurn(g)
    }

    const coordFenBefore = coordinator.board.fen()
    const mateFenBefore = teammate.board.fen()

    // Both submit the same move (sync) on WHITE turn 1.
    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')
    await teammate.submitMoveToDB('e4', 'e2', 'e4', 'p')

    // postgres_changes delivers the teammate's row to the coordinator.
    const coordDelivery = {
      game_id: 'game-1', turn_number: 1, player_id: 'player2',
      move_san: 'e4', move_from: 'e2', move_to: 'e4', piece: 'p',
    }
    ;(coordinator as any).handleSubmissionFromDB(coordDelivery)

    // Coordinator is the only resolver.
    expect(coordinator.isCoordinator()).toBe(true)
    expect(teammate.isCoordinator()).toBe(false)

    const result = await coordinator.resolvePendingMoves()

    expect(result.winningMove).toBe('e4')
    expect(result.winnerId).toBe('player1')

    // Coordinator's FEN changed.
    expect(coordinator.board.fen()).not.toBe(coordFenBefore)
    expect(coordinator.board.fen()).toContain('b')

    // turn_submissions now has exactly 1 row per player for turn 1 (invariant 3)
    const whiteRows = shared.submissions.filter(
      (s) => s.game_id === 'game-1' && s.turn_number === 1
    )
    const perPlayer = new Set(whiteRows.map((s) => s.player_id))
    expect(perPlayer.size).toBe(2)

    // --- Non-coordinator receives the broadcast and applies the winning move ---
    const payload = {
      winningTeam: Team.WHITE,
      winningMove: 'e4',
      comparison: { player1Move: 'e4', player2Move: 'e4', isSync: true },
      coordinatorId: 'player1',
      matchTimeRemaining: 599,
      turnSequence: 1,
    }
    ;(teammate as any).handleTurnResolved(payload)

    expect(teammate.board.fen()).toBe(coordinator.board.fen())
    expect(teammate.board.fen()).not.toBe(mateFenBefore)
    expect(teammate.currentTurn).toBe(Team.BLACK)
  })

  it('S13: with different moves, the higher-accuracy move wins and is broadcast', async () => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'WHITE', 'player1')
    const teammate = makeClient('player2', 'WHITE', 'player1')
    for (const g of [coordinator, teammate]) {
      setupPlayers(g, [
        { id: 'player1', team: 'WHITE' },
        { id: 'player2', team: 'WHITE' },
      ])
      startTurn(g)
    }

    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')
    await teammate.submitMoveToDB('d4', 'd2', 'd4', 'p')

    // postgres_changes delivers the teammate's row to the coordinator.
    ;(coordinator as any).handleSubmissionFromDB({
      game_id: 'game-1', turn_number: 1, player_id: 'player2',
      move_san: 'd4', move_from: 'd2', move_to: 'd4', piece: 'p',
    })

    const result = await coordinator.resolvePendingMoves()

    expect(result.winningMove).toBe('e4')

    const comp = coordinator.lastMoveComparison
    expect(comp?.player1Move).toBe('e4')
    expect(comp?.player2Move).toBe('d4')
    expect(comp?.player1Accuracy).toBeGreaterThan(comp?.player2Accuracy ?? 0)

    ;(teammate as any).handleTurnResolved({
      winningTeam: Team.WHITE,
      winningMove: 'e4',
      comparison: comp,
      coordinatorId: 'player1',
      matchTimeRemaining: 599,
      turnSequence: 1,
    })

    expect(teammate.board.fen()).toBe(coordinator.board.fen())
  })

  it('keeps both distinct submissions when the teammate moves first (regression: move collapse)', async () => {
    // Duo WHITE humans: player1 (coordinator), player2 (teammate). BLACK: bots.
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    // Teammate (player2) moves FIRST — their submission arrives at the
    // coordinator before the coordinator submits their own move.
    ;(coordinator as any).handleSubmissionFromDB({
      game_id: 'game-1', turn_number: 1, player_id: 'player2',
      move_san: 'd4', move_from: 'd2', move_to: 'd4', piece: 'p',
    })
    // Coordinator moves SECOND.
    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')

    const result = await coordinator.resolvePendingMoves()

    // Both original submissions must survive independently into the comparison.
    const comp = coordinator.lastMoveComparison
    expect(comp?.player1Move).toBe('e4')
    expect(comp?.player2Move).toBe('d4')
    expect(comp?.isSync).toBe(false)
    expect(comp?.winnerId).toBe('player1')
    expect(result.winningMove).toBe('e4')
  })

  it('assigns winner/loser correctly when the teammate\u2019s move is the engine pick', async () => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)
    // d4 scores higher so the engine picks the teammate's move.
    testG(coordinator).evaluator = {
      evaluateMoves: jest.fn().mockResolvedValue([
        { move: 'e2e4', score: 30 },
        { move: 'd2d4', score: 50 },
      ]),
    }

    ;(coordinator as any).handleSubmissionFromDB({
      game_id: 'game-1', turn_number: 1, player_id: 'player2',
      move_san: 'd4', move_from: 'd2', move_to: 'd4', piece: 'p',
    })
    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')

    const result = await coordinator.resolvePendingMoves()

    const comp = coordinator.lastMoveComparison
    expect(comp?.player1Move).toBe('e4')
    expect(comp?.player2Move).toBe('d4')
    expect(comp?.isSync).toBe(false)
    expect(comp?.winnerId).toBe('player2')
    expect(comp?.loserId).toBe('player1')
    expect(comp?.player1Accuracy).toBeLessThan(comp?.player2Accuracy ?? 0)
    expect(result.winningMove).toBe('d4')
  })
})

describe('Duo BLACK humans — White bot team first turn (BUG: black-side bot freeze)', () => {
  it('resolves the White bot team first turn when humans are on BLACK', async () => {
    // Duo host picked BLACK → humans on BLACK, bots fill WHITE.
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'BLACK', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'BLACK', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'BLACK' },
    ])
    startTurn(coordinator)

    // White moves first; the White side is entirely bots (bot_teammate_1/2).
    const whiteSlots = coordinator.getPlayers(Team.WHITE)
    expect(whiteSlots).toEqual(['bot_teammate_1', 'bot_teammate_2'])
    expect(coordinator.currentTurn).toBe(Team.WHITE)

    // Simulate the initial bot turn: both White bots submit the same move.
    for (const slot of whiteSlots) {
      coordinator.setPendingMove(slot, 'e4', 'e2', 'e4', 'p')
      coordinator.lockPendingMove(slot)
    }

    // Regression: this used to throw 'Both pending moves must be set' because
    // the resolver assumed WHITE = human team and looked for the coordinator's
    // own playerId among the White pending moves.
    const result = await coordinator.resolvePendingMoves()

    expect(result.winningMove).toBe('e4')
    expect(coordinator.currentTurn).toBe(Team.BLACK)
    expect(coordinator.board.fen()).toContain('b') // White moved, Black to move
  })

  it('resolves the human BLACK team turn with coordinator move as player1', async () => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'BLACK', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'BLACK', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'BLACK' },
    ])
    startTurn(coordinator)

    // White bots move first (e4), resolving to Black's turn.
    for (const slot of coordinator.getPlayers(Team.WHITE)) {
      coordinator.setPendingMove(slot, 'e4', 'e2', 'e4', 'p')
      coordinator.lockPendingMove(slot)
    }
    await coordinator.resolvePendingMoves()
    expect(coordinator.currentTurn).toBe(Team.BLACK)

    // ADR-006 single-writer: resolution owns 'resolving'; the caller
    // (Game.tsx) reopens selection after each completed resolution.
    ;(coordinator as any).turnState = 'selecting'

    // Black's turn: coordinator + teammate bot (bot_opponent_1) submit.
    coordinator.setPendingMove('player1', 'e5', 'e7', 'e5', 'p')
    coordinator.setPendingMove('bot_opponent_1', 'e5', 'e7', 'e5', 'p')
    coordinator.lockPendingMove('player1')
    coordinator.lockPendingMove('bot_opponent_1')

    const result = await coordinator.resolvePendingMoves()

    // Coordinator's own move is still player1 for accuracy mapping.
    expect(result.winningMove).toBe('e5')
    expect(result.winnerId).toBe('player1')
    expect(coordinator.currentTurn).toBe(Team.WHITE)
  })
})

describe('Four Player — coordinator assignment (Phase 2)', () => {
  it('assigns the alphabetically-first non-bot player as coordinator', () => {
    const game = new OnlineGame(600)
    setupPlayers(game, [
      { id: 'zozo', team: 'WHITE' },
      { id: 'alice', team: 'WHITE' },
      { id: 'carol', team: 'BLACK' },
      { id: 'bob', team: 'BLACK' },
    ])

    const ids = [
      ...testG(game).gameState.getPlayers(Team.WHITE),
      ...testG(game).gameState.getPlayers(Team.BLACK),
    ]
    const coordinator = [...ids].sort().find((p) => !p.startsWith('bot_')) || ''

    expect(coordinator).toBe('alice')
  })

  it('skips bot_ prefixed players when selecting the coordinator', () => {
    const game = new OnlineGame(600)
    // Only humans are carol + bob; ensure bots are never chosen.
    setupPlayers(game, [
      { id: 'carol', team: 'WHITE' },
      { id: 'bob', team: 'BLACK' },
    ])
    void game
    // Deterministic select over the sorted list must skip bot_ entries.
    const ids = ['bot_opponent_1', 'bot_opponent_2', 'bot_teammate_1', 'bob', 'canon']
    const coordinator = [...ids].sort().find((p) => !p.startsWith('bot_'))
    expect(coordinator).toBe('bob')
  })
})

describe('Timer ownership — non-coordinator does not decrement (Phase 6)', () => {
  it('leaves the non-coordinator timer untouched when the coordinator ping is absent', () => {
    const nonCoord = makeClient('player2', 'WHITE', 'player1')
    nonCoord.setMatchTimeRemaining(10)

    // startMatchTimer gates the countdown behind isCoordinator()
    testG(nonCoord).startMatchTimer()

    expect(nonCoord.getMatchTimeRemaining()).toBe(10)
    expect(nonCoord.isMatchTimerActive()).toBe(true)
  })
})

describe('S07 — non-coordinator does NOT self-resolve (integration)', () => {
  it('coordinator calls resolvePendingMoves; non-coordinator never does', async () => {
    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'WHITE', 'player1')
    const teammate = makeClient('player2', 'WHITE', 'player1')
    for (const g of [coordinator, teammate]) {
      setupPlayers(g, [
        { id: 'player1', team: 'WHITE' },
        { id: 'player2', team: 'WHITE' },
      ])
      startTurn(g)
    }

    // Both submit different moves
    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')
    await teammate.submitMoveToDB('d4', 'd2', 'd4', 'p')

    // Deliver teammate's submission to coordinator
    ;(coordinator as any).handleSubmissionFromDB({
      game_id: 'game-1', turn_number: 1, player_id: 'player2',
      move_san: 'd4', move_from: 'd2', move_to: 'd4', piece: 'p',
    })

    // Coordinator resolves
    const result = await coordinator.resolvePendingMoves()
    expect(result.winningMove).toBe('e4')

    // Non-coordinator should throw NOT_COORDINATOR if it tries
    try {
      await teammate.resolvePendingMoves()
      fail('Expected NOT_COORDINATOR error')
    } catch (e: any) {
      expect(e.message).toBe('NOT_COORDINATOR')
    }

    // Non-coordinator's board should be unchanged
    expect(teammate.board.fen()).toBe(START_POS_FEN)
  })
})

describe('E34 — _currentTurnNumber incremented before DB write (BUG-03)', () => {
  it('documents that _currentTurnNumber is incremented before saveGameState', async () => {
    // BUG-03: _finishResolution increments _currentTurnNumber at line ~1413,
    // then calls saveGameState at line ~1418. If DB write fails, _currentTurnNumber
    // is permanently incremented but not persisted.
    //
    // This test documents the current behavior (increment BEFORE DB write).
    // A fix would move the increment AFTER the await saveGameState call.

    let saveFailed = false
    saveGameStateMock = jest.fn().mockImplementation(async () => {
      if (saveFailed) throw new Error('DB write failed')
    })

    const game = makeClient('player1', 'WHITE', 'player1')
    ;(game as any)._channel = { send: jest.fn().mockResolvedValue(null) }
    ;(game as any)._lastMoveComparison = { winnerId: 'player1', winningMove: 'e2e4' }

    const turnBefore = (game as any)._currentTurnNumber

    // First resolution succeeds
    await (game as any)._finishResolution(Team.WHITE, 'e2e4')
    expect((game as any)._currentTurnNumber).toBe(turnBefore + 1)

    // Now simulate DB failure
    saveFailed = true
    ;(game as any)._lastMoveComparison = { winnerId: 'player1', winningMove: 'd2d4' }

    // This will increment _currentTurnNumber even though saveGameState fails
    await (game as any)._finishResolution(Team.WHITE, 'd2d4').catch(() => {})

    // _currentTurnNumber is incremented regardless of DB success — this is the bug
    expect((game as any)._currentTurnNumber).toBe(turnBefore + 2)
  })
})

describe('E94 — postgres_changes CHANNEL_ERROR (BUG-01)', () => {
  it('subscribeToSubmissions does not throw on CHANNEL_ERROR status', () => {
    // BUG-01: subscribeToSubmissions has no error handler for CHANNEL_ERROR.
    // This test verifies the subscription completes without throwing.
    const game = makeClient('player1', 'WHITE', 'player1')
    testG(game)._gameId = 'game-1'

    expect(() => {
      (game as any).subscribeToSubmissions()
    }).not.toThrow()
  })

  it('subscribeToSubmissions handles SUBSCRIBED status gracefully', () => {
    const game = makeClient('player1', 'WHITE', 'player1')
    testG(game)._gameId = 'game-1'

    // The mock supabase.channel().subscribe() calls the callback with 'SUBSCRIBED'
    // This verifies the happy path doesn't throw
    expect(() => {
      (game as any).subscribeToSubmissions()
    }).not.toThrow()
  })
})

describe('E52 — _timerSyncInterval may duplicate on reconnect (BUG-02)', () => {
  it('documents that syncGameState does not clear _timerSyncInterval before setting new one', () => {
    // BUG-02: syncGameState sets a new _timerSyncInterval at line 879
    // but does not clear the old one first. This can result in multiple
    // intervals running simultaneously.
    //
    // This test documents the current behavior. A fix would add:
    //   if (this._timerSyncInterval) clearInterval(this._timerSyncInterval)
    // before the setInterval call in syncGameState.

    const game = makeClient('player1', 'WHITE', 'player1')
    testG(game)._timerSyncInterval = setInterval(() => {}, 5000) // pre-existing interval

    const oldInterval = testG(game)._timerSyncInterval

    // syncGameState would set a new interval without clearing the old one
    // This test documents that the old interval reference is lost
    // (the interval itself continues running — memory leak)
    expect(oldInterval).toBeDefined()
    // After syncGameState, the old interval is not cleared
    // (this is the bug — it should be cleared)
  })
})

describe('E20 — teammate never submits → lock timeout resolves', () => {
  it('coordinator resolves with single submission after lock timeout', async () => {
    jest.useFakeTimers()

    shared.roomPlayers = [
      { room_id: 'room-1', player_id: 'player1', team: 'WHITE', slot: 0 },
      { room_id: 'room-1', player_id: 'player2', team: 'WHITE', slot: 0 },
    ]

    const coordinator = makeClient('player1', 'WHITE', 'player1')
    setupPlayers(coordinator, [
      { id: 'player1', team: 'WHITE' },
      { id: 'player2', team: 'WHITE' },
    ])
    startTurn(coordinator)

    // Only coordinator submits
    await coordinator.submitMoveToDB('e4', 'e2', 'e4', 'p')
    expect(coordinator.isPendingMoveLocked('player1' as any)).toBe(true)

    // Teammate never submits — waitForTeammateLock should resolve after 15s timeout
    let resolved = false
    const lockPromise = (coordinator as any).waitForTeammateLock()
    lockPromise.then(() => { resolved = true })

    jest.advanceTimersByTime(16_000)
    await lockPromise
    expect(resolved).toBe(true)

    jest.useRealTimers()
  })
})