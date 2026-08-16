import { upsertProfile, fetchProfile, deriveUsername } from '../profileService'

const mockUpsert = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockMaybeSingle = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockUpsert,
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ProfileService', () => {
  describe('upsertProfile', () => {
    it('sends only specified fields to profiles table', async () => {
      mockUpsert.mockResolvedValue({ error: null })

      await upsertProfile({ id: 'user-1', username: 'testuser' })

      expect(mockUpsert).toHaveBeenCalledWith(
        { id: 'user-1', username: 'testuser' },
        { onConflict: 'id' },
      )
    })

    it('omits undefined fields from payload', async () => {
      mockUpsert.mockResolvedValue({ error: null })

      await upsertProfile({ id: 'user-1', display_name: 'Test User' })

      expect(mockUpsert).toHaveBeenCalledWith(
        { id: 'user-1', display_name: 'Test User' },
        { onConflict: 'id' },
      )
      const payload = mockUpsert.mock.calls[0][0]
      expect(payload).not.toHaveProperty('username')
      expect(payload).not.toHaveProperty('avatar_url')
    })

    it('returns success when upsert succeeds', async () => {
      mockUpsert.mockResolvedValue({ error: null })

      const result = await upsertProfile({ id: 'user-1', username: 'testuser' })

      expect(result).toEqual({ success: true, isUniqueConflict: false })
    })

    it('detects unique constraint violations', async () => {
      mockUpsert.mockResolvedValue({
        error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      })

      const result = await upsertProfile({ id: 'user-1', username: 'taken' })

      expect(result).toEqual({ success: false, isUniqueConflict: true })
    })

    it('detects unique constraint in error message', async () => {
      mockUpsert.mockResolvedValue({
        error: { message: 'unique constraint violated — profiles_username_unique' },
      })

      const result = await upsertProfile({ id: 'user-1', username: 'taken' })

      expect(result.success).toBe(false)
      expect(result.isUniqueConflict).toBe(true)
    })

    it('returns non-unique failure for other errors', async () => {
      mockUpsert.mockResolvedValue({
        error: { message: 'connection refused' },
      })

      const result = await upsertProfile({ id: 'user-1' })

      expect(result).toEqual({ success: false, isUniqueConflict: false })
    })

    it('handles network exceptions gracefully', async () => {
      mockUpsert.mockRejectedValue(new Error('Network error'))

      const result = await upsertProfile({ id: 'user-1' })

      expect(result).toEqual({ success: false, isUniqueConflict: false })
    })

    it('does NOT send null values for explicitly null fields', async () => {
      mockUpsert.mockResolvedValue({ error: null })

      await upsertProfile({ id: 'user-1', avatar_url: null, display_name: null })

      expect(mockUpsert).toHaveBeenCalledWith(
        { id: 'user-1', avatar_url: null, display_name: null },
        { onConflict: 'id' },
      )
    })
  })

  describe('deriveUsername', () => {
    it('keeps a valid candidate unchanged', () => {
      expect(deriveUsername('john_doe')).toBe('john_doe')
      expect(deriveUsername('alice123')).toBe('alice123')
    })

    it('sanitizes invalid characters from a candidate', () => {
      expect(deriveUsername('john.doe@gmail')).toMatch(/^[a-zA-Z0-9_]{3,30}$/)
      expect(deriveUsername('john.doe@gmail')).not.toContain('.')
    })

    it('falls back to a seeded player_ username for empty/invalid input', () => {
      const seeded = deriveUsername('', 'user-abc')
      expect(seeded).toMatch(/^player_[a-z0-9]{6}$/)
      expect(deriveUsername(null, 'user-abc')).toMatch(/^player_[a-z0-9]{6}$/)
      expect(deriveUsername('  ', 'user-abc')).toMatch(/^player_[a-z0-9]{6}$/)
    })

    it('always produces a format-valid username (3-30, alnum + underscore)', () => {
      const cases = ['', 'x', 'with spaces here', 'emoji😀', 'a'.repeat(50), 'double--dash']
      for (const c of cases) {
        expect(deriveUsername(c, 'seed')).toMatch(/^[a-zA-Z0-9_]{3,30}$/)
      }
    })
  })

  describe('fetchProfile', () => {
    it('returns username and avatar_url when found', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { username: 'testuser', avatar_url: 'https://example.com/av.jpg' }, error: null })

      const result = await fetchProfile('user-1')

      expect(result).toEqual({ username: 'testuser', avatar_url: 'https://example.com/av.jpg' })
    })

    it('returns nulls when no profile exists', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      const result = await fetchProfile('unknown')

      expect(result).toEqual({ username: null, avatar_url: null })
    })

    it('uses the correct query chain', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      await fetchProfile('user-1')

      expect(mockSelect).toHaveBeenCalledWith('username, avatar_url')
      expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
      expect(mockMaybeSingle).toHaveBeenCalled()
    })
  })
})
