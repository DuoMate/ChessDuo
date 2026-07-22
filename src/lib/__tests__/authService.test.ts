import { AuthService } from '../authService'

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
    it('registers callback and returns unsubscribe function', () => {
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } })
      const callback = jest.fn()

      const unsubscribe = AuthService.onAuthChange(callback)

      expect(mockOnAuthStateChange).toHaveBeenCalledWith(callback)
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
})
