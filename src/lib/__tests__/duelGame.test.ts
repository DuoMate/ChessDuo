import { DuelGame } from '../duelGame'
import type { DuelGameState } from '../duelGame'

// --- Configurable mock state -------------------------------------------------
let updateEqMock = jest.fn().mockResolvedValue({ data: null, error: null })
const updateMock = jest.fn((..._args: any[]) => ({ eq: updateEqMock }))
let singleMock = jest.fn().mockResolvedValue({ data: null, error: null })
let channelSendMock = jest.fn().mockResolvedValue(null)

jest.mock('../supabase', () => ({
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
    from: jest.fn((table: string) => {
      expect(table).toBe('duel_games')
      return {
        update: updateMock,
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ single: singleMock })),
        })),
      }
    }),
  },
}))

function makeEngine(team: 'WHITE' | 'BLACK' = 'WHITE') {
  return new DuelGame('room-duel-1', 'player-A', team, 600)
}

function stubRow(row: Record<string, unknown> | null, error: unknown = null) {
  singleMock = jest.fn().mockResolvedValue({ data: row, error })
}

beforeEach(() => {
  jest.clearAllMocks()
  updateEqMock = jest.fn().mockResolvedValue({ data: null, error: null })
  channelSendMock = jest.fn().mockResolvedValue(null)
})

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('C5: authoritative persistence on move', () => {
  it('persists the full authoritative state and broadcasts only after the DB commit', async () => {
    const g = makeEngine('WHITE')
    ;(g as any)._status = 'playing'
    ;(g as any)._channel = { send: channelSendMock }

    const result = await g.makeMove('e2e4')

    expect(result.success).toBe(true)
    // Authoritative payload written to duel_games
    expect(updateMock).toHaveBeenCalledTimes(1)
    const payload = updateMock.mock.calls[0]![0]
    expect(payload.status).toBe('playing')
    expect(payload.move_history).toEqual(['e4'])
    expect(typeof payload.white_time_remaining).toBe('number')
    expect(typeof payload.black_time_remaining).toBe('number')
    expect(payload.fen).not.toBe(INITIAL_FEN)
    expect(updateEqMock).toHaveBeenCalledWith('room_id', 'room-duel-1')
    // Broadcast happens AFTER the DB write (invocation order)
    expect(updateEqMock.mock.invocationCallOrder[0]).toBeLessThan(channelSendMock.mock.invocationCallOrder[0])
    const sendPayload = channelSendMock.mock.calls[0][0]
    expect(sendPayload.event).toBe('duel_move')
    expect(sendPayload.payload.move).toBe('e4')
    expect(sendPayload.payload.ply).toBe(1)
  })

  it('rolls back cleanly when persistence fails — no broadcast, no corrupted state', async () => {
    const g = makeEngine('WHITE')
    ;(g as any)._status = 'playing'
    updateEqMock = jest.fn().mockResolvedValue({ data: null, error: { message: 'network down' } })

    const result = await g.makeMove('e2e4')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Persist failed')
    // Local board/history restored
    expect((g as any).fen).toBe(INITIAL_FEN)
    expect(g.moveHistory).toEqual([])
    expect(channelSendMock).not.toHaveBeenCalled()
    // The failed write was attempted twice (single bounded retry is reserved
    // for terminal persists; move persist fails fast after ONE attempt here).
    expect(updateMock).toHaveBeenCalledTimes(1)
  })
})

describe('C5: reconciliation from duel_games', () => {
  it('restores an active game (fen/history/clocks)', async () => {
    const g = makeEngine('BLACK')
    stubRow({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
      move_history: ['e4'],
      white_time_remaining: 590,
      black_time_remaining: 600,
      status: 'playing',
      winner: null,
      game_result: null,
      game_over_reason: null,
    })

    const outcome = await (g as any)._syncFromDB()

    expect(outcome).toBe('restored-playing')
    expect((g as any).fen).toContain('b KQkq')
    expect(g.moveHistory).toEqual(['e4'])
    expect(g.whiteTimeRemaining).toBe(590)
    expect(g.blackTimeRemaining).toBe(600)
  })

  it('ignores a stale row that knows LESS chess than the local board', async () => {
    const g = makeEngine('WHITE')
    ;(g as any)._status = 'playing'
    await g.makeMove('e2e4')
    stubRow({ fen: INITIAL_FEN, move_history: [], status: 'playing' })

    const outcome = await (g as any)._syncFromDB()

    expect(outcome).toBe('up-to-date')
    expect(g.moveHistory).toEqual(['e4'])
  })

  it('restores GAME_OVER immutably and startGame() refuses to restart it', async () => {
    jest.useFakeTimers()
    try {
      const g = makeEngine('WHITE')
      stubRow({
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
        move_history: ['e4'],
        white_time_remaining: 100,
        black_time_remaining: 120,
        status: 'game_over',
        winner: 'white',
        game_result: 'White wins by resignation',
        game_over_reason: 'resignation',
      })

      await (g as any).startGame()

      expect(g.status).toBe('game_over')
      expect(g.winner).toBe('white')
      expect(g.gameResult).toBe('White wins by resignation')
      expect((g as any)._gameOverReason).toBe('resignation')
      expect(g.matchTimerActive).toBe(false)
      expect((g as any)._timerInterval).toBeNull()
      // No moves accepted post-terminal
      const res = await g.makeMove('e7e5')
      expect(res.success).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it('pre-move reconciliation catches a missed broadcast instead of moving stale', async () => {
    const g = makeEngine('BLACK')
    ;(g as any)._status = 'playing'
    // Locally we saw 1.e4 (black to move); the DB already holds Black's reply,
    // i.e. our own earlier broadcast attempt raced a lost duel_move for e5.
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1'
    ;(g as any).chess.load(afterE4)
    ;(g as any)._moveHistory = ['e4']
    stubRow({
      fen: 'rnbqkbnr/pp1bpppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      move_history: ['e4', 'e5'],
      white_time_remaining: 590,
      black_time_remaining: 596,
      status: 'playing',
    })

    const result = await g.makeMove('e7e5')

    expect(result.success).toBe(false)
    expect(result.error).toContain('out of date')
    // Board was fast-forwarded to the authoritative position.
    expect(g.moveHistory).toEqual(['e4', 'e5'])
    expect(channelSendMock).not.toHaveBeenCalled()
  })
})

describe('C5: realtime staleness guards', () => {
  it('ignores duplicate/stale duel_move events (ply <= local length)', () => {
    const g = makeEngine('WHITE')
    ;(g as any)._moveHistory = ['e4']

    ;(g as any).handleOpponentMove({ move: 'c7c5', ply: 1 })

    expect(g.moveHistory).toEqual(['e4'])
  })

  it('reconciles from DB when a gap is detected (ply > local+1)', async () => {
    const g = makeEngine('WHITE')
    ;(g as any)._moveHistory = []
    stubRow({
      fen: INITIAL_FEN,
      move_history: ['e4', 'e5', 'Nf3'],
      status: 'playing',
    })
    const spy = jest.spyOn(g as any, '_syncFromDB')

    ;(g as any).handleOpponentMove({ move: 'Nf3', ply: 3 })

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('C5: deterministic timeout authority', () => {
  function expiredEngine(viewerTeam: 'WHITE' | 'BLACK') {
    const g = makeEngine(viewerTeam)
    ;(g as any)._status = 'playing'
    ;(g as any)._whiteTimeRemaining = 0
    ;(g as any)._blackTimeRemaining = 123
    ;(g as any)._channel = { send: channelSendMock }
    return g
  }

  it('only the non-expiring side declares, persists BEFORE broadcasting, winner = opposite side', async () => {
    const g = expiredEngine('BLACK')

    ;(g as any).checkExpiredClockAuthority()
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))

    expect(updateMock).toHaveBeenCalled()
    const payload = updateMock.mock.calls[0]![0]
    expect(payload.status).toBe('game_over')
    expect(payload.winner).toBe('black')
    expect(payload.game_result).toBe('Black wins by timeout')
    expect(payload.game_over_reason).toBe('timeout')
    expect(updateEqMock.mock.invocationCallOrder[0]).toBeLessThan(channelSendMock.mock.invocationCallOrder[0])
    expect(channelSendMock.mock.calls[0][0].event).toBe('duel_game_over')
    expect(g.status).toBe('game_over')
    expect(g.winner).toBe('black')
  })

  it('the expiring device itself does NOT declare (peer authority)', async () => {
    const g = expiredEngine('WHITE')

    ;(g as any).checkExpiredClockAuthority()
    await new Promise(r => setTimeout(r, 0))

    expect(updateMock).not.toHaveBeenCalled()
    expect(channelSendMock).not.toHaveBeenCalled()
    expect(g.status).toBe('playing')
  })

  it('timeout cannot overwrite an already-terminal game and does not broadcast unpersisted results', async () => {
    const g = expiredEngine('BLACK')
    ;(g as any)._status = 'game_over'
    updateEqMock = jest.fn().mockResolvedValue({ data: null, error: { message: 'down' } })

    await (g as any).handleTimeout('white')

    expect(updateMock).not.toHaveBeenCalled()
    expect(channelSendMock).not.toHaveBeenCalled()
  })
})

describe('C5: resign persists before broadcast', () => {
  it('writes GAME_OVER then broadcasts', async () => {
    const g = makeEngine('WHITE')
    ;(g as any)._status = 'playing'
    ;(g as any)._channel = { send: channelSendMock }

    await g.resign()

    const payload = updateMock.mock.calls[0]![0]
    expect(payload.status).toBe('game_over')
    expect(payload.winner).toBe('black')
    expect(payload.game_result).toBe('Black wins by resignation')
    expect(payload.game_over_reason).toBe('resignation')
    expect(updateEqMock.mock.invocationCallOrder[0]).toBeLessThan(channelSendMock.mock.invocationCallOrder[0])
    expect(channelSendMock.mock.calls[0][0].event).toBe('duel_game_over')
    expect(g.status).toBe('game_over')
  })
})

// ============================================================
// Legacy engine contract suite (restored from the pre-C5 test
// file; assertions adapted only where C5 intentionally changed
// behavior — resign is now async and persists first).
// ============================================================
describe('DuelGame engine — legacy compatibility', () => {
  let game: DuelGame

  beforeEach(() => {
    game = new DuelGame('room-legacy', 'player1', 'WHITE', 300)
    // Isolate from other tests' DB stubs — behave like "no authoritative row".
    stubRow(null)
  })

  it('starts in waiting status with initial FEN and timers', () => {
    expect(game.status).toBe('waiting')
    expect(game.fen).toContain('rnbqkbnr')
    expect(game.currentTurn).toBe('w')
    expect(game.winner).toBeNull()
    expect(game.whiteTimeRemaining).toBe(300)
    expect(game.blackTimeRemaining).toBe(300)
    expect(game.matchTimerActive).toBe(false)
  })

  it('accepts state/opponent callbacks', () => {
    expect(() => game.setOnStateChange(jest.fn())).not.toThrow()
    expect(() => game.setOnOpponentMove(jest.fn())).not.toThrow()
  })

  it('applies a valid UCI move, records SAN, flips the turn', async () => {
    ;(game as any)._status = 'playing'
    const result = await game.makeMove('e2e4')
    expect(result.success).toBe(true)
    expect(game.currentTurn).toBe('b')
    expect(game.moveHistory).toContain('e4')
  })

  it('returns error for an invalid move', async () => {
    ;(game as any)._status = 'playing'
    const result = await game.makeMove('e2e5')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects moves after game over and canMove() is false', async () => {
    ;(game as any)._status = 'game_over'
    const result = await game.makeMove('e2e4')
    expect(result.success).toBe(false)
    expect(game.canMove()).toBe(false)
  })

  it('state snapshot reflects moves', async () => {
    ;(game as any)._status = 'playing'
    await game.makeMove('e2e4')
    const state: DuelGameState = game.state
    expect(state.currentTurn).toBe('b')
    expect(state.moveHistory.length).toBe(1)
  })

  it('isMyTurn / isPlayerWhite are team-aware', () => {
    ;(game as any)._status = 'playing'
    expect(game.isMyTurn()).toBe(true)
    const blackGame = new DuelGame('room-legacy', 'player2', 'BLACK', 300)
    ;(blackGame as any)._status = 'playing'
    expect(blackGame.isMyTurn()).toBe(false)
    expect(game.isPlayerWhite()).toBe(true)
    expect(blackGame.isPlayerWhite()).toBe(false)
  })

  it('setGameOver sets winner/result/status', () => {
    game.setGameOver('white', 'White wins', 'checkmate')
    expect(game.winner).toBe('white')
    expect(game.gameResult).toBe('White wins')
    expect(game.status).toBe('game_over')
  })

  it('resign ends the game with the opponent winning (async, persisted first)', async () => {
    ;(game as any)._status = 'playing'
    await game.resign()
    expect(game.status).toBe('game_over')
    expect(game.winner).toBe('black')
  })

  it('destroy does not throw', () => {
    expect(() => game.destroy()).not.toThrow()
  })
})
