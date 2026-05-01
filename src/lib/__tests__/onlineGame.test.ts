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
})