import { isCancellationError, authenticateWithGoogle } from '../supabaseAuthUtils'
import { supabase } from '../supabase'

describe('supabaseAuthUtils', () => {
  describe('cancellation detection', () => {
    it('returns true for USER_CANCELLED code', () => {
      expect(isCancellationError({ code: 'USER_CANCELLED', message: 'cancelled' })).toBe(true)
    })

    it('returns true for error code 16', () => {
      expect(isCancellationError({ code: 16, message: 'some error' })).toBe(true)
    })

    it('returns true when message contains "Cancelled by user"', () => {
      expect(isCancellationError({ code: '', message: 'GetCredentialCancellationException: [16] Cancelled by user' })).toBe(true)
    })

    it('returns true when message contains GetCredentialCancellationException', () => {
      expect(isCancellationError({ code: '', message: 'GetCredentialCancellationException: something' })).toBe(true)
    })

    it('returns false for other errors', () => {
      expect(isCancellationError({ code: 'NETWORK_ERROR', message: 'connection failed' })).toBe(false)
    })

    it('returns false for empty error', () => {
      expect(isCancellationError({ code: '', message: '' })).toBe(false)
    })
  })
})

// ============================================================
// AUTH-JOIN FIX: Google OAuth must return through /auth/callback so
// GoTrue's one-time `?code=<uuid>` never lands on `/` and gets mistaken
// for a ROOM code by the home page's auto-join effect.
// ============================================================
describe('authenticateWithGoogle redirect target', () => {
  let oauthSpy: jest.SpyInstance

  beforeEach(() => {
    oauthSpy = jest.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
      data: { url: 'https://providers.example' }, error: null,
    } as any)
  })

  afterEach(() => oauthSpy.mockRestore())

  it('default sign-in returns through /auth/callback (never bare "/")', async () => {
    await authenticateWithGoogle()
    expect(oauthSpy).toHaveBeenCalledTimes(1)
    const opts = oauthSpy.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(opts.options.redirectTo).toBe(`${window.location.origin}/auth/callback`)
  })

  it('preserves the original destination via an encoded redirect param on the callback URL', async () => {
    await authenticateWithGoogle({ redirectUrl: '/duel?room=abc&time=600' })
    const opts = oauthSpy.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(opts.options.redirectTo).toBe(
      `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/duel?room=abc&time=600')}`,
    )
  })
})
