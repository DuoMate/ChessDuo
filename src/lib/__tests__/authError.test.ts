import { classifyAuthError, normalizeOtpType, buildAuthCallbackUrl } from '../authError'

describe('classifyAuthError', () => {
  it('maps email_not_confirmed code to an "Email not confirmed" message', () => {
    const result = classifyAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' })
    expect(result.code).toBe('email_not_confirmed')
    expect(result.message).toContain('Email not confirmed')
  })

  it('maps a raw "Email not confirmed" message even without a code', () => {
    const result = classifyAuthError({ message: 'Email not confirmed' })
    expect(result.code).toBe('email_not_confirmed')
  })

  it('maps invalid credentials', () => {
    expect(classifyAuthError({ code: 'invalid_credentials' }).code).toBe('invalid_credentials')
  })

  it('maps user_not_found', () => {
    expect(classifyAuthError({ code: 'user_not_found' }).code).toBe('user_not_found')
  })

  it('maps user_already_exists', () => {
    expect(classifyAuthError({ code: 'user_already_exists' }).code).toBe('user_already_exists')
  })

  it('maps rate limit codes', () => {
    expect(classifyAuthError({ code: 'over_email_send_rate_limit' }).code).toBe('rate_limit')
  })

  it('maps network errors', () => {
    expect(classifyAuthError({ code: 'fetch_error' }).code).toBe('network_error')
    expect(classifyAuthError({ message: 'Failed to fetch' }).code).toBe('network_error')
  })

  it('never converts unrelated errors into "Email not confirmed"', () => {
    const cases = [
      { code: 'RLS_ERROR', message: 'permission denied' },
      { code: 'NETWORK_ERROR', message: 'connection refused' },
      { code: 'SESSION_ERROR', message: 'session expired' },
      { code: 'SERVER_ERROR', message: 'internal error' },
      { code: 'invalid_credentials', message: 'bad password' },
      { message: 'PROFILE_LOAD_FAILED' },
    ]
    for (const c of cases) {
      const result = classifyAuthError(c)
      expect(result.code).not.toBe('email_not_confirmed')
      expect(result.message.toLowerCase()).not.toContain('email not confirmed')
    }
  })

  it('falls back to the raw message for unknown errors', () => {
    const result = classifyAuthError({ code: 'some_unknown_code', message: 'Weird custom error' })
    expect(result.message).toBe('Weird custom error')
  })

  it('returns a generic message for empty errors', () => {
    expect(classifyAuthError(null).message).toBe('Authentication failed.')
  })
})

describe('normalizeOtpType', () => {
  it('maps legacy signup/magiclink to email', () => {
    expect(normalizeOtpType('signup')).toBe('email')
    expect(normalizeOtpType('magiclink')).toBe('email')
  })

  it('preserves supported types', () => {
    expect(normalizeOtpType('recovery')).toBe('recovery')
    expect(normalizeOtpType('invite')).toBe('invite')
    expect(normalizeOtpType('email_change')).toBe('email_change')
    expect(normalizeOtpType('phone_change')).toBe('phone_change')
    expect(normalizeOtpType('sms')).toBe('sms')
  })

  it('defaults unknown/empty to email', () => {
    expect(normalizeOtpType('email')).toBe('email')
    expect(normalizeOtpType('')).toBe('email')
    expect(normalizeOtpType(null)).toBe('email')
    expect(normalizeOtpType(undefined)).toBe('email')
  })
})

describe('buildAuthCallbackUrl', () => {
  it('appends /auth/callback to a base URL', () => {
    expect(buildAuthCallbackUrl('https://chessduo.app')).toBe('https://chessduo.app/auth/callback')
  })

  it('strips trailing slashes', () => {
    expect(buildAuthCallbackUrl('https://chessduo.app/')).toBe('https://chessduo.app/auth/callback')
  })

  it('falls back to a relative path when base is empty', () => {
    expect(buildAuthCallbackUrl('')).toBe('/auth/callback')
  })
})
