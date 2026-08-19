import {
  getSupabaseProjectReference,
  hashUserId,
  buildAuthDebugPayload,
  correlationId,
} from '../authDebug'

describe('getSupabaseProjectReference', () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original
  })

  it('extracts the project reference from a supabase.co URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co'
    expect(getSupabaseProjectReference()).toBe('abcdefghijklmnopqrst')
  })

  it('returns null for non-supabase URLs', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com'
    expect(getSupabaseProjectReference()).toBeNull()
  })

  it('returns null when unset', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    expect(getSupabaseProjectReference()).toBeNull()
  })
})

describe('hashUserId', () => {
  it('is deterministic', () => {
    expect(hashUserId('user-123')).toBe(hashUserId('user-123'))
  })

  it('produces different hashes for different ids', () => {
    expect(hashUserId('user-123')).not.toBe(hashUserId('user-456'))
  })

  it('returns a hex string', () => {
    expect(hashUserId('user-123')).toMatch(/^[0-9a-f]+$/)
  })
})

describe('buildAuthDebugPayload', () => {
  it('hashes userId instead of logging it raw', () => {
    const payload = buildAuthDebugPayload({ stage: 'signInWithPassword', userId: 'secret-user-id' })
    expect(payload).not.toHaveProperty('userId')
    expect(payload.userIdHash).toBe(hashUserId('secret-user-id'))
    expect(JSON.stringify(payload)).not.toContain('secret-user-id')
  })

  it('never includes token/password/secret keys', () => {
    const payload = buildAuthDebugPayload({ stage: 'signInWithPassword' })
    const keys = Object.keys(payload)
    const forbidden = ['password', 'accessToken', 'access_token', 'refreshToken', 'refresh_token', 'jwt', 'token', 'anonKey', 'serviceRoleKey', 'codeVerifier']
    for (const secret of forbidden) {
      expect(keys).not.toContain(secret)
    }
  })

  it('enriches with environment, route, platform, and project reference', () => {
    const payload = buildAuthDebugPayload({ stage: 'test' })
    expect(payload).toHaveProperty('environment')
    expect(payload).toHaveProperty('route')
    expect(payload).toHaveProperty('platform')
    expect(payload).toHaveProperty('supabaseProjectReference')
  })
})

describe('correlationId', () => {
  it('returns a non-empty string', () => {
    expect(typeof correlationId()).toBe('string')
    expect(correlationId().length).toBeGreaterThan(0)
  })
})
