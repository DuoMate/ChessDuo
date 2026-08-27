import { isAllowedOrigin, sanitizeCrashPayload } from '../crashReportPolicy'

describe('crashReportPolicy', () => {
  describe('isAllowedOrigin', () => {
    it('allows the web app origin', () => {
      expect(isAllowedOrigin('https://chessduo.navron.org')).toBe(true)
      expect(isAllowedOrigin('https://chessduo.chessdoubles27.workers.dev')).toBe(true)
    })

    it('allows the Capacitor Android origin (https://localhost) — the P0-2 fix', () => {
      expect(isAllowedOrigin('https://localhost')).toBe(true)
      expect(isAllowedOrigin('http://localhost')).toBe(true)
      expect(isAllowedOrigin('capacitor://localhost')).toBe(true)
    })

    it('allows missing Origin (same-origin fetch / curl)', () => {
      expect(isAllowedOrigin(null)).toBe(true)
      expect(isAllowedOrigin(undefined)).toBe(true)
    })

    it('rejects unknown origins', () => {
      expect(isAllowedOrigin('https://evil.example.com')).toBe(false)
      expect(isAllowedOrigin('https://chessduo.attacker.net')).toBe(false)
    })
  })

  describe('sanitizeCrashPayload', () => {
    const valid = {
      message: 'boom',
      platform: 'web',
      error_type: 'window_error',
      route: '/game',
      game_id: 'g1',
      room_id: 'r1',
      turn_number: 2,
    }

    it('accepts a valid payload and normalizes fields', () => {
      const out = sanitizeCrashPayload(valid)!
      expect(out.message).toBe('boom')
      expect(out.platform).toBe('web')
      expect(out.error_type).toBe('window_error')
      expect(out.game_id).toBe('g1')
      expect(out.room_id).toBe('r1')
      expect(out.turn_number).toBe(2)
      expect(out.stack).toBeNull()
    })

    it('defaults error_type to "unhandled" when absent', () => {
      const { error_type } = sanitizeCrashPayload({ ...valid, error_type: undefined })!
      expect(error_type).toBe('unhandled')
    })

    it('rejects payloads missing message or platform', () => {
      expect(sanitizeCrashPayload({ ...valid, message: undefined })).toBeNull()
      expect(sanitizeCrashPayload({ ...valid, platform: undefined })).toBeNull()
      expect(sanitizeCrashPayload(null)).toBeNull()
    })

    it('truncates oversized fields and coerces numeric fields', () => {
      const out = sanitizeCrashPayload({
        message: 'x'.repeat(5000),
        stack: 'y'.repeat(9000),
        platform: 'android_very_long_name',
        line: 'not-a-number',
        col: 5,
      })!
      expect(out.message.length).toBeLessThanOrEqual(4000)
      expect(out.stack!.length).toBeLessThanOrEqual(8000)
      expect(out.line).toBeNull()
      expect(out.col).toBe(5)
    })

    it('never passes through raw credential-like fields (allowlist only)', () => {
      const out = sanitizeCrashPayload({
        message: 'boom',
        platform: 'web',
        access_token: 'secret-token',
        password: 'hunter2',
        authorization: 'Bearer x',
        secret_key: 'abc',
      })!
      expect((out as unknown as Record<string, unknown>).access_token).toBeUndefined()
      expect((out as unknown as Record<string, unknown>).password).toBeUndefined()
      expect((out as unknown as Record<string, unknown>).authorization).toBeUndefined()
      expect((out as unknown as Record<string, unknown>).secret_key).toBeUndefined()
    })
  })
})
