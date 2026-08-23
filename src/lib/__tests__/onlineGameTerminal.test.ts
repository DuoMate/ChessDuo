import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team, GameState } from '../../features/game-engine/gameState'

// --- Configurable mock state -------------------------------------------------
let saveGameStateMock = jest.fn().mockResolvedValue('game-1')
let loadGameStateMock = jest.fn().mockResolvedValue(null)
let channelSendMock = jest.fn().mockResolvedValue(null)
const roomsUpdateEqMock = jest.fn().mockResolvedValue({ data: null, error: null })
const gamesStatusUpdateEqMock = jest.fn().mockResolvedValue({ data: null, error: null })
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
      from: jest.fn((table: string) => {
        if (table === 'rooms') {
          return {
            update: jest.fn(() => ({ eq: roomsUpdateEqMock })),
          }
        }
        if (table === 'games') {
          // C3: resign uses a targeted status update (never a full-row write)
          return {
            update: jest.fn(() => ({ eq: gamesStatusUpdateEqMock })),
          }
        }
        return {
          select: jest.fn(() => thenableChain([])),
          eq: jest.fn(() => thenableChain([])),
          order: jest.fn(() => thenableChain([])),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          upsert: (...args: any[]) => turnSubmissionsUpsertMock(...args),
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
  return game
}

beforeEach(() => {
  jest.clearAllMocks()
  saveGameStateMock = jest.fn().mockResolvedValue('game-1')
  loadGameStateMock = jest.fn().mockResolvedValue(null)
  channelSendMock = jest.fn().mockResolvedValue(null)
})

describe('C2: GAME_OVER terminal-state protection', () => {
  it('setGameOverTimeup is a no-op when the game is already GAME_OVER', () => {
    const game = makeGame()
    testG(game)._status = GameStatus.GAME_OVER
    testG(game)._gameOverResult = 'White wins by checkmate'
    testG(game)._gameOverReason = 'checkmate'

    game.setGameOverTimeup('Draw on time', 'timeout')

    expect(testG(game)._gameOverResult).toBe('White wins by checkmate')
    expect(testG(game)._gameOverReason).toBe('checkmate')
    // No timeout persistence or broadcast for an already-terminal game
    expect(saveGameStateMock).not.toHaveBeenCalled()
    expect(channelSendMock).not.toHaveBeenCalled()
  })

  it('a coordinator timeout fires once, persists GAME_OVER, and later ticks cannot change the result', () => {
    jest.useFakeTimers()
    try {
      const game = makeGame('player1', 'WHITE')
      testG(game)._status = GameStatus.PLAYING
      testG(game).gameState.setMatchTimeRemaining(0)
      testG(game).gameState.setMatchTimerActive(true)
      testG(game)._channel = { send: channelSendMock } as any

      // Start the authoritative coordinator countdown
      ;(game as any).startMatchTimer()

      // First tick: remaining <= 0 -> timeout declared
      jest.advanceTimersByTime(1100)

      expect(game.status).toBe(GameStatus.GAME_OVER)
      expect(game.getResult()).toBe('Draw on time')
      expect(game.getGameOverReason()).toBe('timeout')
      expect(channelSendMock).toHaveBeenCalledTimes(1)
      expect(saveGameStateMock).toHaveBeenCalledTimes(1)
      const persistArgs = saveGameStateMock.mock.calls[0]
      expect(persistArgs[4]).toBe(GameStatus.GAME_OVER) // status arg
      expect(persistArgs[0]).toBe('room-1')

      // Subsequent ticks must NOT re-fire the timeout / overwrite the result
      testG(game)._gameOverResult = 'White wins by checkmate'
      jest.advanceTimersByTime(5000)
      expect(testG(game)._gameOverResult).toBe('White wins by checkmate')
      expect(saveGameStateMock).toHaveBeenCalledTimes(1)
      expect(channelSendMock).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('submitMoveToDB rejects moves after GAME_OVER (no resurrection)', async () => {
    const game = makeGame()
    testG(game)._status = GameStatus.GAME_OVER

    const ok = await game.submitMoveToDB('e4', 'e2', 'e4', 'p')

    expect(ok).toBe(false)
    expect(turnSubmissionsUpsertMock).not.toHaveBeenCalled()
  })
})

describe('C2/C4: syncGameState timer restore gate', () => {
  it('does not restart an active timer when the persisted row is GAME_OVER', async () => {
    jest.useFakeTimers()
    try {
      const game = makeGame('player1', 'WHITE')
      testG(game)._status = GameStatus.PLAYING

      loadGameStateMock = jest.fn().mockResolvedValue({
        gameId: 'game-1',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        currentTurn: 'WHITE',
        moveHistory: [],
        status: 'GAME_OVER',
        matchStartedAt: new Date(Date.now() - 30_000).toISOString(),
        matchTimeLimitSeconds: 600,
        turnNumber: 3,
        coordinatorId: 'player1',
        lastResolvedMove: null,
        lastHumanResolution: null,
      })

      const synced = await (game as any).syncGameState()

      expect(synced).toBe(true)
      expect(game.isMatchTimerActive()).toBe(false)
      expect(testG(game)._timerSyncInterval).toBeNull()
      expect(game.status).toBe(GameStatus.GAME_OVER)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('C4: lobby leave vs active-match resignation', () => {
  it('leaving during READY does not persist a games row, broadcast abandonment, or declare a winner', async () => {
    const game = makeGame()
    testG(game)._status = GameStatus.READY
    testG(game)._channel = { send: channelSendMock } as any

    await game.abandonMatch()

    expect(game.status).toBe(GameStatus.READY) // NOT GAME_OVER
    expect(game.getResult()).not.toContain('Resigned')
    expect(saveGameStateMock).not.toHaveBeenCalled()
    expect(channelSendMock).not.toHaveBeenCalled()
    expect(roomsUpdateEqMock).toHaveBeenCalled()
  })

  it('leaving during WAITING behaves like a lobby departure too', async () => {
    const game = makeGame()
    testG(game)._status = GameStatus.WAITING

    await game.abandonMatch()

    expect(game.status).toBe(GameStatus.WAITING)
    expect(saveGameStateMock).not.toHaveBeenCalled()
    expect(roomsUpdateEqMock).toHaveBeenCalled()
  })

  it('resigning during PLAYING keeps the existing resignation behavior', async () => {
    const game = makeGame('player1', 'WHITE')
    testG(game)._status = GameStatus.PLAYING
    testG(game)._channel = { send: channelSendMock } as any

    let abandoned = false
    game.setOnAbandonCallback(() => { abandoned = true })

    await game.abandonMatch()

    expect(game.status).toBe(GameStatus.GAME_OVER)
    expect(game.getResult()).toBe('Resigned - Black wins')
    expect(game.getGameOverReason()).toBe('resignation')
    expect(abandoned).toBe(true)
    // C3: resign persists via a TARGETED status update — it must never
    // overwrite authoritative fen/move_history from a possibly-stale client.
    expect(saveGameStateMock).not.toHaveBeenCalled()
    expect(gamesStatusUpdateEqMock).toHaveBeenCalled()
    // Peer notification still sent for active-match resignation
    const abandonSend = channelSendMock.mock.calls.find(c => c[0]?.event === 'match_abandoned')
    expect(abandonSend).toBeTruthy()
  })

  it('abandonMatch is a no-op when already GAME_OVER', async () => {
    const game = makeGame()
    testG(game)._status = GameStatus.GAME_OVER

    await game.abandonMatch()

    expect(saveGameStateMock).not.toHaveBeenCalled()
    expect(roomsUpdateEqMock).not.toHaveBeenCalled()
  })
})

describe('C4: reason-string consistency', () => {
  it('handleMatchAbandoned records reason "abandoned" (peer-left flow)', () => {
    const game = makeGame('player1', 'WHITE')
    testG(game)._status = GameStatus.PLAYING

    ;(game as any).handleMatchAbandoned({ playerId: 'opponent-id', team: 'BLACK' })

    expect(game.status).toBe(GameStatus.GAME_OVER)
    expect(game.getResult()).toBe('Resigned - White wins')
    expect(game.getGameOverReason()).toBe('abandoned')
  })
})
