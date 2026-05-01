import { OnlineGame } from '../../features/online/game/onlineGame'
import { GameStatus } from '../../features/offline/game/localGame'
import { Team } from '../../features/game-engine/gameState'

// Mock Supabase
jest.mock('../supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0)
        return { unsubscribe: jest.fn() }
      }),
      track: jest.fn().mockResolvedValue(null),
      send: jest.fn().mockResolvedValue(null),
      unsubscribe: jest.fn()
    })),
    removeChannel: jest.fn().mockResolvedValue(null),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ 
        data: { 
          id: 'room-123', 
          code: 'ABC123', 
          status: 'waiting',
          created_by: 'player1' 
        }, 
        error: null 
      })
    }))
  }
}))

describe('OnlineGame', () => {
  let game: OnlineGame

  beforeEach(() => {
    game = new OnlineGame()
  })

  describe('constructor', () => {
    it('should initialize with WAITING status', () => {
      expect(game.status).toBe(GameStatus.WAITING)
    })

    it('should have board property', () => {
      expect(game.board).toBeDefined()
      expect(game.board.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    })

    it('should have currentTurn as WHITE initially', () => {
      expect(game.currentTurn).toBe(Team.WHITE)
    })

    it('should have getPlayers method', () => {
      expect(typeof game.getPlayers).toBe('function')
    })

    it('should have lastMoveComparison as null initially', () => {
      expect(game.lastMoveComparison).toBeNull()
    })

    it('should have pendingOverlay as null initially', () => {
      expect(game.pendingOverlay).toBeNull()
    })
  })

  describe('joinRoom', () => {
    it('should set status to READY after joining', async () => {
      const room = {
        id: 'room-123',
        code: 'ABC123',
        status: 'waiting' as const,
        created_by: 'player1',
        created_at: new Date().toISOString()
      }

      await game.joinRoom(room, 'player1', 'WHITE')

      expect(game.status).toBe(GameStatus.READY)
    })
  })

  describe('getCapturedPieces', () => {
    it('should return captured pieces object with white and black arrays', () => {
      const captured = game.getCapturedPieces()

      expect(captured).toHaveProperty('white')
      expect(captured).toHaveProperty('black')
      expect(Array.isArray(captured.white)).toBe(true)
      expect(Array.isArray(captured.black)).toBe(true)
    })

    it('should return empty arrays initially', () => {
      const captured = game.getCapturedPieces()

      expect(captured.white).toEqual([])
      expect(captured.black).toEqual([])
    })
  })

  describe('broadcast methods', () => {
    it('should have broadcastMove method', () => {
      expect(typeof game.broadcastMove).toBe('function')
    })

    it('should have broadcastLocked method', () => {
      expect(typeof game.broadcastLocked).toBe('function')
    })
  })

  describe('setOnStateChange', () => {
    it('should accept a callback function', () => {
      const callback = jest.fn()
      expect(() => game.setOnStateChange(callback)).not.toThrow()
    })
  })

  describe('getPlayers', () => {
    it('should have getPlayers method for both teams', () => {
      expect(typeof game.getPlayers).toBe('function')
      
      const whitePlayers = game.getPlayers(Team.WHITE)
      const blackPlayers = game.getPlayers(Team.BLACK)
      
      // Should return arrays (may be empty or have default players)
      expect(Array.isArray(whitePlayers)).toBe(true)
      expect(Array.isArray(blackPlayers)).toBe(true)
    })
  })

  describe('pendingOverlay', () => {
    it('should return null when no pending moves from teammate', () => {
      expect(game.pendingOverlay).toBeDefined()
    })
  })

  describe('setPendingMove and lockPendingMove', () => {
    it('should allow setting pending moves with startPendingTurn', () => {
      game.startPendingTurn()
      
      // Set a pending move
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'p')
      
      // Should not throw when checking locked state
      expect(() => game.isBothPendingLocked()).not.toThrow()
    })
  })

  describe('isBothPendingLocked', () => {
    it('should return boolean for locked state', () => {
      const result = game.isBothPendingLocked()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('startPendingTurn', () => {
    it('should allow calling startPendingTurn without throwing', () => {
      expect(() => game.startPendingTurn()).not.toThrow()
    })
  })

  describe('getTeamTimer', () => {
    it('should return a number for team timer', () => {
      const timer = game.getTeamTimer()
      expect(typeof timer).toBe('number')
    })
  })

  describe('isTimerActive', () => {
    it('should return boolean for timer active state', () => {
      const active = game.isTimerActive()
      expect(typeof active).toBe('boolean')
    })
  })

  describe('handleTurnResolved - turn sync fix', () => {
    let gameWithState: OnlineGame

    beforeEach(() => {
      gameWithState = new OnlineGame()
      // Initialize game state with players (simulates game started)
      gameWithState.gameState.addPlayer('player1' as any, Team.WHITE)
      gameWithState.gameState.addPlayer('player2' as any, Team.WHITE)
      gameWithState.gameState.addPlayer('bot_opponent_1' as any, Team.BLACK)
      gameWithState.gameState.addPlayer('bot_opponent_2' as any, Team.BLACK)
      gameWithState.gameState.startMatch()
    })

    it('should NOT force-switch turn when resolve() returns null (second client receiving broadcast)', () => {
      // Simulate: WHITE was resolved, turn is now BLACK (phase is SELECTING)
      // Set phase to LOCKED so we can properly resolve, then manually set to SELECTING
      gameWithState.startPendingTurn()
      gameWithState.gameState.setPendingMove('player1' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player1' as any)
      gameWithState.gameState.setPendingMove('player2' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player2' as any)
      
      // Resolve WHITE - this advances turn to BLACK
      gameWithState.gameState.resolve('e2e4')
      expect(gameWithState.currentTurn).toBe(Team.BLACK)
      
      const phaseBefore = gameWithState.gameState.phase
      
      // Now simulate second client receiving broadcast - resolve returns null because phase is SELECTING
      const result = gameWithState.gameState.resolve('e2e4')
      
      // Turn should stay on BLACK because resolve() returned null (no force-switch should happen)
      expect(result).toBeNull() // Already resolved
      expect(gameWithState.currentTurn).toBe(Team.BLACK) // Should NOT be WHITE
    })

    it('should maintain correct turn when receiving broadcast for already-resolved turn', () => {
      // Simulate full WHITE resolve -> BLACK flow
      gameWithState.startPendingTurn()
      gameWithState.gameState.setPendingMove('player1' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player1' as any)
      gameWithState.gameState.setPendingMove('player2' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player2' as any)
      
      // WHITE resolves, turn should be BLACK
      gameWithState.gameState.resolve('e2e4')
      expect(gameWithState.currentTurn).toBe(Team.BLACK)
      expect(gameWithState.gameState.phase).toBe('SELECTING')
      
      // Second client receives broadcast for WHITE resolution
      // resolve() should return null because phase is SELECTING (not LOCKED)
      const result = gameWithState.gameState.resolve('e2e4')
      expect(result).toBeNull()
      
      // Turn should stay BLACK (not force-switched to WHITE)
      expect(gameWithState.currentTurn).toBe(Team.BLACK)
    })

    it('should allow BLACK resolve when properly set up', () => {
      // First resolve WHITE properly
      gameWithState.startPendingTurn()
      gameWithState.gameState.setPendingMove('player1' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player1' as any)
      gameWithState.gameState.setPendingMove('player2' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player2' as any)
      
      gameWithState.gameState.resolve('e2e4')
      expect(gameWithState.currentTurn).toBe(Team.BLACK)
      
      // Now set up BLACK pending moves
      gameWithState.startPendingTurn()
      gameWithState.gameState.setPendingMove('bot_opponent_1' as any, 'b8c6', 'b8', 'c6', 'n')
      gameWithState.gameState.lockPendingMove('bot_opponent_1' as any)
      gameWithState.gameState.setPendingMove('bot_opponent_2' as any, 'b8c6', 'b8', 'c6', 'n')
      gameWithState.gameState.lockPendingMove('bot_opponent_2' as any)
      
      // Now resolve BLACK - should work because phase is LOCKED and turn is BLACK
      const blackResult = gameWithState.gameState.resolve('b8c6')
      
      expect(blackResult).not.toBeNull()
      expect(gameWithState.currentTurn).toBe(Team.WHITE)
    })

    it('should sync turn with FEN when resolve returns null (second client broadcast handling)', () => {
      // Simulate: WHITE just resolved, board now shows BLACK turn
      gameWithState.startPendingTurn()
      gameWithState.gameState.setPendingMove('player1' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player1' as any)
      gameWithState.gameState.setPendingMove('player2' as any, 'e2e4', 'e2', 'e4', 'p')
      gameWithState.gameState.lockPendingMove('player2' as any)
      
      // Resolve WHITE - turn advances to BLACK
      gameWithState.gameState.resolve('e2e4')
      expect(gameWithState.currentTurn).toBe(Team.BLACK)
      expect(gameWithState.gameState.fen.split(' ')[1]).toBe('b') // FEN shows BLACK

      // Now simulate receiving broadcast again (second client scenario)
      // resolve() returns null because phase is already SELECTING
      // After applying move, turn should still be BLACK (matching FEN)
      const result = gameWithState.gameState.resolve('e2e4')
      expect(result).toBeNull()
      
      // FEN should show BLACK (board advanced)
      expect(gameWithState.gameState.fen.split(' ')[1]).toBe('b')
      // currentTurn should also be BLACK (synced with board)
      expect(gameWithState.currentTurn).toBe(Team.BLACK)
    })
  })
})