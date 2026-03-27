import { GameState, GamePhase, Team } from '../gameState'

describe('Game State Machine', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState()
  })

  describe('Initial State', () => {
    test('starts in WAITING phase', () => {
      expect(gameState.phase).toBe(GamePhase.WAITING)
    })

    test('has white team turn initially', () => {
      expect(gameState.currentTeam).toBe(Team.WHITE)
    })

    test('has no players initially', () => {
      expect(gameState.getPlayers(Team.WHITE)).toHaveLength(0)
      expect(gameState.getPlayers(Team.BLACK)).toHaveLength(0)
    })
  })

  describe('Player Management', () => {
    test('adds player to white team', () => {
      gameState.addPlayer('player1', Team.WHITE)
      expect(gameState.getPlayers(Team.WHITE)).toContain('player1')
    })

    test('adds player to black team', () => {
      gameState.addPlayer('player2', Team.BLACK)
      expect(gameState.getPlayers(Team.BLACK)).toContain('player2')
    })

    test('prevents adding more than 2 players per team', () => {
      gameState.addPlayer('p1', Team.WHITE)
      gameState.addPlayer('p2', Team.WHITE)
      expect(() => gameState.addPlayer('p3', Team.WHITE)).toThrow()
    })
  })

  describe('Phase Transitions', () => {
    test('transitions from WAITING to SELECTING when both teams have 2 players', () => {
      gameState.addPlayer('w1', Team.WHITE)
      gameState.addPlayer('w2', Team.WHITE)
      gameState.addPlayer('b1', Team.BLACK)
      gameState.addPlayer('b2', Team.BLACK)
      
      gameState.startMatch()
      
      expect(gameState.phase).toBe(GamePhase.SELECTING)
    })

    test('throws error when starting match with incomplete teams', () => {
      gameState.addPlayer('w1', Team.WHITE)
      gameState.addPlayer('w2', Team.WHITE)
      
      expect(() => gameState.startMatch()).toThrow()
    })

    test('transitions to LOCKED when both players lock in moves', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      gameState.selectMove('w2', 'e4')
      gameState.lockMove('w1')
      gameState.lockMove('w2')
      
      expect(gameState.phase).toBe(GamePhase.LOCKED)
    })
  })

  describe('Move Selection', () => {
    test('allows player to select a move', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      
      expect(gameState.getSelectedMove('w1')).toBe('e4')
    })

    test('allows player to change selection before locking', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      gameState.selectMove('w1', 'd4')
      
      expect(gameState.getSelectedMove('w1')).toBe('d4')
    })

    test('does not reveal move to other player until locked', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      
      expect(gameState.getSelectedMove('w2')).toBeNull()
    })
  })

  describe('Turn Management', () => {
    test('switches teams after resolution', () => {
      setupFullGame()
      completeTurn(gameState, 'w1', 'w2', 'e4', 'd4')
      
      expect(gameState.currentTeam).toBe(Team.BLACK)
    })
  })

  function setupFullGame() {
    gameState.addPlayer('w1', Team.WHITE)
    gameState.addPlayer('w2', Team.WHITE)
    gameState.addPlayer('b1', Team.BLACK)
    gameState.addPlayer('b2', Team.BLACK)
    gameState.startMatch()
  }

  function completeTurn(
    state: GameState,
    p1: string,
    p2: string,
    m1: string,
    m2: string
  ) {
    state.selectMove(p1, m1)
    state.selectMove(p2, m2)
    state.lockMove(p1)
    state.lockMove(p2)
    state.resolve()
  }
})
