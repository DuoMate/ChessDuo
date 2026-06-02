import { GameState } from '../../features/game-engine/gameState'
import { Team, GamePhase } from '../../features/game-engine/gameState'

describe('isBothPendingLocked with UUID player IDs', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState(600)
    gameState.addPlayer('user-uuid-123', Team.WHITE)
    gameState.addPlayer('user-uuid-456', Team.WHITE)
    gameState.addPlayer('bot_opponent_1', Team.BLACK)
    gameState.addPlayer('bot_opponent_2', Team.BLACK)
    gameState.startMatch()
    gameState.startPendingTurn(gameState.fen)
  })

  test('returns true when both players locked with UUID IDs', () => {
    gameState.setPendingMove('user-uuid-123', 'e4', 'e2', 'e4', 'p')
    gameState.setPendingMove('user-uuid-456', 'd4', 'd2', 'd4', 'p')
    gameState.lockPendingMove('user-uuid-123')
    gameState.lockPendingMove('user-uuid-456')

    expect(gameState.isBothPendingLocked()).toBe(true)
  })

  test('returns false when only one player locked', () => {
    gameState.setPendingMove('user-uuid-123', 'e4', 'e2', 'e4', 'p')
    gameState.setPendingMove('user-uuid-456', 'd4', 'd2', 'd4', 'p')
    gameState.lockPendingMove('user-uuid-123')

    expect(gameState.isBothPendingLocked()).toBe(false)
  })

  test('returns true for bot player IDs', () => {
    gameState.setPendingMove('bot_opponent_1', 'e5', 'e7', 'e5', 'p')
    gameState.setPendingMove('bot_opponent_2', 'd5', 'd7', 'd5', 'p')
    gameState.lockPendingMove('bot_opponent_1')
    gameState.lockPendingMove('bot_opponent_2')

    expect(gameState.isBothPendingLocked()).toBe(true)
  })
})

describe('areBothTeamPlayersLocked phase transition', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState(600)
    gameState.addPlayer('user-a', Team.WHITE)
    gameState.addPlayer('user-b', Team.WHITE)
    gameState.addPlayer('bot-1', Team.BLACK)
    gameState.addPlayer('bot-2', Team.BLACK)
    gameState.startMatch()
    gameState.startPendingTurn(gameState.fen)
  })

  test('transitions to LOCKED phase when both players lock with UUID IDs', () => {
    gameState.setPendingMove('user-a', 'e4', 'e2', 'e4', 'p')
    gameState.setPendingMove('user-b', 'd4', 'd2', 'd4', 'p')
    gameState.lockPendingMove('user-a')
    gameState.lockPendingMove('user-b')

    expect(gameState.phase).toBe(GamePhase.LOCKED)
  })

  test('does NOT transition to LOCKED when only one player locked', () => {
    gameState.setPendingMove('user-a', 'e4', 'e2', 'e4', 'p')
    gameState.setPendingMove('user-b', 'd4', 'd2', 'd4', 'p')
    gameState.lockPendingMove('user-a')

    expect(gameState.phase).toBe(GamePhase.SELECTING)
  })
})

describe('resolve with forcedWinningMove', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState(600)
    gameState.addPlayer('user-a', Team.WHITE)
    gameState.addPlayer('user-b', Team.WHITE)
    gameState.addPlayer('bot-1', Team.BLACK)
    gameState.addPlayer('bot-2', Team.BLACK)
    gameState.startMatch()
    gameState.startPendingTurn(gameState.fen)
  })

  const lockAndResolve = (): any => {
    gameState.setPendingMove('user-a', 'e4', 'e2', 'e4', 'p')
    gameState.setPendingMove('user-b', 'd4', 'd2', 'd4', 'p')
    gameState.lockPendingMove('user-a')
    gameState.lockPendingMove('user-b')
  }

  test('applies forcedWinningMove and flips turn', () => {
    lockAndResolve()

    const result = gameState.resolve('e4')

    expect(result).not.toBeNull()
    expect(result!.move).toBe('e4')
    expect(gameState.currentTeam).toBe(Team.BLACK)
    expect(gameState.phase).toBe(GamePhase.SELECTING)
  })

  test('returns null when phase is not LOCKED', () => {
    gameState.setPendingMove('user-a', 'e4', 'e2', 'e4', 'p')
    gameState.setPendingMove('user-b', 'd4', 'd2', 'd4', 'p')
    gameState.lockPendingMove('user-a')

    const result = gameState.resolve('e4')

    expect(result).toBeNull()
  })
})

describe('startPendingTurn clears all state', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState(600)
    gameState.addPlayer('user-a', Team.WHITE)
    gameState.addPlayer('user-b', Team.WHITE)
    gameState.addPlayer('bot-1', Team.BLACK)
    gameState.addPlayer('bot-2', Team.BLACK)
    gameState.startMatch()
    gameState.startPendingTurn(gameState.fen)
  })

  test('clears pendingMoves, locked, and selections', () => {
    gameState.setPendingMove('user-a', 'e4', 'e2', 'e4', 'p')
    gameState.setPendingMove('user-b', 'd4', 'd2', 'd4', 'p')
    gameState.lockPendingMove('user-a')
    gameState.lockPendingMove('user-b')

    expect(gameState.isBothPendingLocked()).toBe(true)

    gameState.startPendingTurn('new-fen')

    expect(gameState.isBothPendingLocked()).toBe(false)
    expect(gameState.getPendingMoves().human).toBeNull()
    expect(gameState.getPendingMoves().teammate).toBeNull()
  })
})
