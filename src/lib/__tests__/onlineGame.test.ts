import { OnlineGame } from '../onlineGame'
import { GameStatus } from '../localGame'

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
})
