import { RealtimeService } from '../realtimeService'

const mockChannel = { subscribe: jest.fn(() => mockChannel), unsubscribe: jest.fn(), on: jest.fn(() => mockChannel) }
const mockSupabaseChannel = jest.fn()
const mockGetChannels = jest.fn(() => [])

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: () => mockSupabaseChannel(),
    getChannels: () => mockGetChannels(),
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
  mockGetChannels.mockReturnValue([])
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

  describe('forceRemoveStaleChannels', () => {
    it('tears down and deregisters any channel whose topic matches', () => {
      const { subscriptionManager } = require('@/lib/subscriptionManager')
      const stale = { topic: 'realtime:room:abc', teardown: jest.fn() }
      const other = { topic: 'realtime:room:xyz', teardown: jest.fn() }
      mockGetChannels.mockReturnValue([stale, other])

      RealtimeService.forceRemoveStaleChannels('room:abc')

      expect(stale.teardown).toHaveBeenCalledTimes(1)
      expect(other.teardown).not.toHaveBeenCalled()
      expect(subscriptionManager.remove).toHaveBeenCalledWith(stale)
      expect(subscriptionManager.remove).not.toHaveBeenCalledWith(other)
    })

    it('does not throw when getChannels is unavailable', () => {
      const { supabase } = require('@/lib/supabase')
      supabase.getChannels = undefined
      expect(() => RealtimeService.forceRemoveStaleChannels('room:abc')).not.toThrow()
      supabase.getChannels = () => mockGetChannels()
    })
  })
})
