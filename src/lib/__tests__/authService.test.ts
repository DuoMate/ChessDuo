import { AuthService, clearSessionCache } from '../authService'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
let mockSubscription: { unsubscribe: jest.Mock }

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  clearSessionCache()
  mockSubscription = { unsubscribe: jest.fn() }
})

describe('AuthService', () => {
  describe('getSession', () => {
    it('returns session when user is authenticated', async () => {
      const fakeSession = { user: { id: 'user-1' } }
      mockGetSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const result = await AuthService.getSession()

      expect(result).toEqual(fakeSession)
    })

    it('returns null when no session exists', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      const result = await AuthService.getSession()

      expect(result).toBeNull()
    })

    it('returns null on error', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error('fail') })

      const result = await AuthService.getSession()

      expect(result).toBeNull()
    })
  })

  describe('onAuthChange', () => {
    it('registers a wrapper that forwards events and returns unsubscribe function', () => {
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } })
      const callback = jest.fn()

      const unsubscribe = AuthService.onAuthChange(callback)

      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
      const wrapper = mockOnAuthStateChange.mock.calls[0][0] as (event: string, session: null) => void
      wrapper('SIGNED_IN', null)
      expect(callback).toHaveBeenCalledWith('SIGNED_IN', null)
      expect(typeof unsubscribe).toBe('function')
    })

    it('returned unsubscribe calls supabase subscription.unsubscribe', () => {
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } })
      const callback = jest.fn()

      const unsubscribe = AuthService.onAuthChange(callback)
      unsubscribe()

      expect(mockSubscription.unsubscribe).toHaveBeenCalled()
    })
  })

  describe('getSession cache (P0 perf)', () => {
    it('collapses same-tick bursts into one supabase read', async () => {
      const fakeSession = { user: { id: 'user-1' } }
      mockGetSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const [a, b] = await Promise.all([AuthService.getSession(), AuthService.getSession()])

      expect(a).toEqual(fakeSession)
      expect(b).toEqual(fakeSession)
      expect(mockGetSession).toHaveBeenCalledTimes(1)
    })
  })
})
