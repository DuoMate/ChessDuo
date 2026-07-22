import { getPendingRequestCount } from '../friendService'

const mockEq2 = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: mockEq2,
        }),
      }),
    })),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('FriendService', () => {
  describe('getPendingRequestCount', () => {
    it('returns count when successful', async () => {
      mockEq2.mockResolvedValue({ data: null, count: 3, error: null })

      const result = await getPendingRequestCount('user-1')

      expect(result).toBe(3)
    })

    it('returns 0 on error', async () => {
      mockEq2.mockResolvedValue({ data: null, count: null, error: { message: 'table not found' } })

      const result = await getPendingRequestCount('user-1')

      expect(result).toBe(0)
    })

    it('returns 0 on network exception', async () => {
      mockEq2.mockRejectedValue(new Error('Network error'))

      const result = await getPendingRequestCount('user-1')

      expect(result).toBe(0)
    })

    it('returns 0 when count is null', async () => {
      mockEq2.mockResolvedValue({ data: null, count: null, error: null })

      const result = await getPendingRequestCount('user-1')

      expect(result).toBe(0)
    })
  })
})
