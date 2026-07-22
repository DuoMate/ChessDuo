import { RealtimeService } from '../realtimeService'

const mockChannel = { subscribe: jest.fn(() => mockChannel), unsubscribe: jest.fn(), on: jest.fn(() => mockChannel) }
const mockSupabaseChannel = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: () => mockSupabaseChannel(),
  },
}))

jest.mock('@/lib/subscriptionManager', () => ({
  subscriptionManager: {
    register: jest.fn((ch: any) => ch),
    remove: jest.fn(),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockSupabaseChannel.mockReturnValue(mockChannel)
})

describe('RealtimeService', () => {
  describe('subscribeToTable', () => {
    it('creates a channel with postgres_changes filter', () => {
      const callback = jest.fn()
      const channel = RealtimeService.subscribeToTable('profiles', 'UPDATE', 'id=eq.123', callback)

      expect(mockSupabaseChannel).toHaveBeenCalled()
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.123' },
        expect.any(Function),
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
      expect(channel).toBe(mockChannel)
    })

    it('creates a channel without filter', () => {
      RealtimeService.subscribeToTable('friendships', 'INSERT', undefined, jest.fn())

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friendships' },
        expect.any(Function),
      )
    })
  })

  describe('cleanupChannel', () => {
    it('unsubscribes and removes from manager', () => {
      const { subscriptionManager } = require('@/lib/subscriptionManager')

      RealtimeService.cleanupChannel(mockChannel)

      expect(mockChannel.unsubscribe).toHaveBeenCalled()
      expect(subscriptionManager.remove).toHaveBeenCalledWith(mockChannel)
    })
  })
})
