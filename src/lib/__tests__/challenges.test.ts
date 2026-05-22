import { createChallenge, getChallengeUrl, getChallengeByCode, deactivateChallenge } from '../challenges'
import { supabase } from '../supabase'

jest.mock('../../lib/supabase', () => {
  const mockFrom = jest.fn()
  return { supabase: { from: mockFrom } }
})

const mockFrom = supabase.from as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('createChallenge', () => {
  it('creates a challenge with 8-char code', async () => {
    mockFrom.mockReturnValue({
      insert: (data: any) => ({
        select: () => ({
          single: () => Promise.resolve({
            data: {
              id: 'ch-1',
              creator_id: 'user1',
              game_mode: 'online',
              time_seconds: 600,
              code: data.code,
            },
            error: null,
          }),
        }),
      }),
    })

    const { data, error } = await createChallenge('user1', 'online', 600)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.code).toHaveLength(8)
    expect(data!.game_mode).toBe('online')
    expect(data!.time_seconds).toBe(600)
  })

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    const { data, error } = await createChallenge('user1', 'online', 600)
    expect(data).toBeNull()
    expect(error).toBe('DB error')
  })
})

describe('getChallengeUrl', () => {
  it('generates correct challenge URL', () => {
    const url = getChallengeUrl('ABC12345')
    expect(url).toContain('/challenge/ABC12345')
  })
})

describe('getChallengeByCode', () => {
  it('returns challenge for valid code', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: 'ch-1', code: 'ABC12345', is_active: true, expires_at: new Date(Date.now() + 3600000).toISOString() },
                error: null,
              }),
            }),
          }),
        }),
      }),
    })

    const result = await getChallengeByCode('ABC12345')
    expect(result).not.toBeNull()
    expect(result!.code).toBe('ABC12345')
  })

  it('returns null for inactive challenge', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })

    const result = await getChallengeByCode('INVALID')
    expect(result).toBeNull()
  })
})

describe('deactivateChallenge', () => {
  it('sets is_active to false', async () => {
    mockFrom.mockReturnValue({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    })
    await deactivateChallenge('ch-1')
    // Should not throw
  })
})
