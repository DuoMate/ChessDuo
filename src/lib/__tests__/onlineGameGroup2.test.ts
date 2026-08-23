import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team, GameState } from '../../features/game-engine/gameState'

// --- Configurable mock state -------------------------------------------------
let saveGameStateMock = jest.fn().mockResolvedValue('game-1')
let loadGameStateMock = jest.fn().mockResolvedValue(null)
let channelSendMock = jest.fn().mockResolvedValue(null)
const turnSubmissionsUpsertMock = jest.fn().mockResolvedValue({ data: null, error: null })

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
        select: jest.fn(() => thenableChain([])),
        eq: jest.fn(() => thenableChain([])),
        order: jest.fn(() => thenableChain([])),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) })),
        upsert: (...args: any[]) => turnSubmissionsUpsertMock(...args),
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

function makeGame(playerId = 'player1', team: 'WHITE' | 'BLACK' = 'WHITE') {
  const game = new OnlineGame(600)
  testG(game)._playerId = playerId
  testG(game)._team = team
  testG(game)._gameId = 'game-1'
  testG(game)._room = { id: 'room-1', code: 'ABC123' } as any
  testG(game)._coordinatorId = playerId
  testG(game).gameState.addPlayer('player1' as any, Team.WHITE)
  testG(game).gameState.addPlayer('bot_teammate_2' as any, Team.WHITE)
  testG(game).gameState.addPlayer('bot_opponent_1' as any, Team.BLACK)
  testG(game).gameState.addPlayer('bot_opponent_2' as any, Team.BLACK)
  // Mirror the real startup flow so the engine reaches SELECTING —
  // otherwise GameState.setPendingMove drops everything by design.
  testG(game)._status = GameStatus.PLAYING
  testG(game).gameState.startMatch()
  testG(game).gameState.startPendingTurn(testG(game).gameState.fen)
  return game
}

beforeEach(() => {
  jest.clearAllMocks()
  saveGameStateMock = jest.fn().mockResolvedValue('game-1')
  loadGameStateMock = jest.fn().mockResolvedValue(null)
  channelSendMock = jest.fn().mockResolvedValue(null)
})

describe('C1: wall-clock authoritative timer', () => {
  it('derives remaining time from the persisted start anchor without any ticks', () => {
    const game = makeGame()
    // Anchor "120s ago", limit 600 — zero interval ticks have fired.
    testG(game)._matchStartedAtMs = Date.now() - 120_000

    expect(game.getMatchTimeRemaining()).toBe(480)
  })

  it('a backgrounded coordinator catches up on the next throttled tick (no paused-clock)', () => {
    jest.useFakeTimers()
    try {
      const game = makeGame()
      testG(game)._status = GameStatus.PLAYING
      testG(game)._matchStartedAtMs = Date.now()
      ;(game as any).startMatchTimer()

      // Simulate heavy throttling: wall clock jumps 120s while only ONE tick fires.
      // advanceTimersByTime also advances the mocked Date by 1s → elapsed 121s.
      jest.setSystemTime(Date.now() + 120_000)
      jest.advanceTimersByTime(1000)

      expect(testG(game).gameState.getMatchTimeRemaining()).toBe(479)
      expect(game.status).toBe(GameStatus.PLAYING)
    } finally {
      jest.useRealTimers()
    }
  })

  it('timeout fires exactly once when the wall clock exceeds the limit', () => {
    jest.useFakeTimers()
    try {
      const game = makeGame()
      testG(game)._status = GameStatus.PLAYING
      testG(game)._channel = { send: channelSendMock } as any
      testG(game)._matchStartedAtMs = Date.now()
      ;(game as any).startMatchTimer()

      // Jump far past the 600s limit; a single catch-up tick must declare it.
      jest.setSystemTime(Date.now() + 700_000)
      jest.advanceTimersByTime(1000)

      expect(game.status).toBe(GameStatus.GAME_OVER)
      expect(game.getResult()).toBe('Draw on time')
      expect(channelSendMock).toHaveBeenCalledTimes(1)
      expect(saveGameStateMock).toHaveBeenCalledTimes(1)

      // Later ticks / repeated expiry cannot change the result.
      jest.advanceTimersByTime(5000)
      expect(game.getResult()).toBe('Draw on time')
      expect(saveGameStateMock).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('falls back to the stored value when no anchor exists (legacy rows)', () => {
    const game = makeGame()
    testG(game).gameState.setMatchTimeRemaining(123)
    expect(game.getMatchTimeRemaining()).toBe(123)
  })
})

describe('H1: missing gameId is recovered or fails explicitly (no broadcast fallback)', () => {
  it('recovers the gameId from the authoritative row and submits normally', async () => {
    const game = makeGame()
    testG(game)._gameId = ''
    loadGameStateMock = jest.fn().mockResolvedValue({
      gameId: 'recovered-game',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      currentTurn: 'WHITE',
      moveHistory: [],
      status: 'PLAYING',
    })

    const ok = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(ok).toBe(true)
    expect(testG(game)._gameId).toBe('recovered-game')
    expect(turnSubmissionsUpsertMock).toHaveBeenCalledTimes(1)
    expect(turnSubmissionsUpsertMock.mock.calls[0][0].game_id).toBe('recovered-game')
  })

  it('fails explicitly when recovery is impossible — no submission, pending rolled back', async () => {
    const game = makeGame()
    testG(game)._gameId = ''
    testG(game)._channel = { send: channelSendMock } as any
    loadGameStateMock = jest.fn().mockResolvedValue(null)

    const ok = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(ok).toBe(false)
    expect(turnSubmissionsUpsertMock).not.toHaveBeenCalled()
    // Local pending state was rolled back so the board unlocks for retry.
    expect(game.getAllPendingMoves().size).toBe(0)
    expect(game.getTurnState()).toBe('selecting')
  })
})

describe('H6: broadcast turn-number validation', () => {
  it('ignores stale player_move broadcasts from an older turn', () => {
    const game = makeGame()
    testG(game)._status = GameStatus.PLAYING
    testG(game)._currentTurnNumber = 3

    ;(game as any).handleTeammateMove({
      playerId: 'bot_teammate_2', move: 'e4', from: 'e2', to: 'e4', turnNumber: 2,
    })

    expect(game.getAllPendingMoves().has('bot_teammate_2')).toBe(false)
  })

  it('accepts player_move for the current turn and legacy payloads without turnNumber', () => {
    const game = makeGame()
    testG(game)._status = GameStatus.PLAYING
    testG(game)._currentTurnNumber = 3

    ;(game as any).handleTeammateMove({
      playerId: 'bot_teammate_2', move: 'e4', from: 'e2', to: 'e4', turnNumber: 3,
    })
    expect(game.getAllPendingMoves().has('bot_teammate_2')).toBe(true)

    ;(game as any).handleTeammateMove({
      playerId: 'bot_opponent_1', move: 'd4', from: 'd2', to: 'd4',
    })
    // Wrong TEAM is still rejected by the existing team filter.
    expect(game.getAllPendingMoves().has('bot_opponent_1')).toBe(false)

    const game2 = makeGame()
    testG(game2)._status = GameStatus.PLAYING
    ;(game2 as any).handleTeammateMove({
      playerId: 'bot_teammate_2', move: 'e4', from: 'e2', to: 'e4',
    })
    expect(game2.getAllPendingMoves().has('bot_teammate_2')).toBe(true)
  })

  it('ignores player_move after GAME_OVER', () => {
    const game = makeGame()
    testG(game)._status = GameStatus.GAME_OVER

    ;(game as any).handleTeammateMove({
      playerId: 'bot_teammate_2', move: 'e4', from: 'e2', to: 'e4', turnNumber: 1,
    })
    expect(game.getAllPendingMoves().size).toBe(0)
  })

  it('ignores stale player_locked broadcasts', () => {
    const game = makeGame()
    testG(game)._status = GameStatus.PLAYING
    testG(game)._currentTurnNumber = 5
    ;(game as any).handleTeammateMove({
      playerId: 'bot_teammate_2', move: 'e4', from: 'e2', to: 'e4', turnNumber: 5,
    })

    ;(game as any).handleTeammateLocked({ playerId: 'bot_teammate_2', turnNumber: 4 })
    expect(game.isPendingMoveLocked('bot_teammate_2' as any)).toBe(false)

    ;(game as any).handleTeammateLocked({ playerId: 'bot_teammate_2', turnNumber: 5 })
    expect(game.isPendingMoveLocked('bot_teammate_2' as any)).toBe(true)
  })
})

describe('H4: own-resignation echo guard (games-table UPDATE)', () => {
  it('ignores the GAME_OVER DB update while our own resignation is in flight', () => {
    const game = makeGame('player1', 'WHITE')
    testG(game)._status = GameStatus.PLAYING
    testG(game)._resignInProgress = true
    const notifySpy = jest.fn()
    game.setOnStateChange(notifySpy)

    ;(game as any).handleGameStatusUpdate('GAME_OVER')

    // No premature/incorrect "opponent resigned" transition.
    expect(game.status).toBe(GameStatus.PLAYING)
    expect(game.getGameOverReason()).toBeNull()
    expect(notifySpy).not.toHaveBeenCalled()
  })

  it('still processes genuine opponent GAME_OVER updates when not resigning', () => {
    const game = makeGame('player1', 'WHITE')
    testG(game)._status = GameStatus.PLAYING

    ;(game as any).handleGameStatusUpdate('GAME_OVER')

    expect(game.status).toBe(GameStatus.GAME_OVER)
    expect(game.getGameOverReason()).toBe('abandoned')
  })

  it('ignores non-GAME_OVER status updates entirely', () => {
    const game = makeGame('player1', 'WHITE')
    testG(game)._status = GameStatus.PLAYING

    ;(game as any).handleGameStatusUpdate('PLAYING')

    expect(game.status).toBe(GameStatus.PLAYING)
  })
})

describe('C3: resign persistence authority', () => {
  it('resign persists via targeted games.status update, never a full-row write', async () => {
    const game = makeGame('player1', 'WHITE')
    testG(game)._status = GameStatus.PLAYING
    testG(game)._channel = { send: channelSendMock } as any
    const gamesFromMock = (require('../supabase').supabase.from as jest.Mock)

    await game.abandonMatch()

    expect(saveGameStateMock).not.toHaveBeenCalled()
    const gamesCall = gamesFromMock.mock.calls.find((c: string[]) => c[0] === 'games')
    expect(gamesCall).toBeTruthy()
  })
})
describe('H7: bounded realtime retry with exponential backoff', () => {
  it('first retry is immediate, subsequent retries back off', () => {
    jest.useFakeTimers()
    try {
      const game = makeGame()
      const setup = jest.fn()

      expect((game as any).scheduleChannelRetry('submissions', setup)).toBe(true)
      expect(setup).toHaveBeenCalledTimes(1) // immediate first attempt

      expect((game as any).scheduleChannelRetry('submissions', setup)).toBe(true)
      expect(setup).toHaveBeenCalledTimes(1) // waiting for backoff...
      jest.advanceTimersByTime(500)
      expect(setup).toHaveBeenCalledTimes(2)

      expect((game as any).scheduleChannelRetry('submissions', setup)).toBe(true)
      jest.advanceTimersByTime(1000 - 1)
      expect(setup).toHaveBeenCalledTimes(2)
      jest.advanceTimersByTime(1)
      expect(setup).toHaveBeenCalledTimes(3)
    } finally {
      jest.useRealTimers()
    }
  })

  it('gives up loudly after exhausting the retry budget', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const game = makeGame()
      const setup = jest.fn()
      const max = (OnlineGame as any).MAX_CHANNEL_RETRIES as number

      for (let i = 0; i < max; i++) {
        expect((game as any).scheduleChannelRetry('game-status', setup)).toBe(true)
        // Drain any scheduled timer between attempts
        jest.advanceTimersByTime(60_000)
      }
      // Budget exhausted — no further retries.
      expect((game as any).scheduleChannelRetry('game-status', setup)).toBe(false)
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining("retry budget exhausted"),
        expect.any(String),
      )
    } finally {
      errSpy.mockRestore()
    }
  })

  it('resetChannelRetries restores the immediate-first-retry behavior', () => {
    jest.useFakeTimers()
    try {
      const game = makeGame()
      const setup = jest.fn()

      ;(game as any).scheduleChannelRetry('room', setup) // attempt 1 (immediate)
      ;(game as any).scheduleChannelRetry('room', setup) // attempt 2 (backoff)
      ;(game as any).resetChannelRetries('room')

      expect((game as any).scheduleChannelRetry('room', setup)).toBe(true)
      expect(setup).toHaveBeenCalledTimes(2) // fresh cycle → immediate again
    } finally {
      jest.useRealTimers()
    }
  })

  it('leaveRoom cancels pending reconnect timers', async () => {
    jest.useFakeTimers()
    try {
      const game = makeGame()
      const setup = jest.fn()
      ;(game as any).scheduleChannelRetry('room', setup)          // immediate #1
      ;(game as any).scheduleChannelRetry('room', setup)          // schedules timer

      await game.leaveRoom()

      jest.advanceTimersByTime(60_000)
      expect(setup).toHaveBeenCalledTimes(1)                      // cancelled
    } finally {
      jest.useRealTimers()
    }
  })
})
