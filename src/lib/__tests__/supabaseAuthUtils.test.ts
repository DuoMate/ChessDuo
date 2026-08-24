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
// The `flow=oauth` marker lets /auth/callback reliably distinguish OAuth
// from email confirmation, and the destination (when present) is carried
// inside an encoded `redirect` param — never as a top-level `code`.
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
    expect(opts.options.redirectTo).toBe(`${window.location.origin}/auth/callback?flow=oauth`)
    // The auth GUID must never land on the home page's ?code= handler.
    expect(opts.options.redirectTo).not.toBe(`${window.location.origin}/`)
  })

  it('preserves the original destination via an encoded redirect param on the callback URL', async () => {
    await authenticateWithGoogle({ redirectUrl: '/duel?room=abc&time=600' })
    const opts = oauthSpy.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(opts.options.redirectTo).toBe(
      `${window.location.origin}/auth/callback?flow=oauth&redirect=${encodeURIComponent('/duel?room=abc&time=600')}`,
    )
  })

  it('carries the room code inside redirect, never as a top-level ?code=', async () => {
    await authenticateWithGoogle({ redirectUrl: '/game?mode=online&room=ABC&code=XYZ123&team=WHITE' })
    const opts = oauthSpy.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(opts.options.redirectTo).toContain('flow=oauth')
    expect(opts.options.redirectTo).toContain(`redirect=${encodeURIComponent('/game?mode=online&room=ABC&code=XYZ123&team=WHITE')}`)
    // The room code must be inside the encoded redirect value, not a bare ?code=
    expect(opts.options.redirectTo).not.toContain('&code=XYZ123')
  })

  it('does not force a consent wall and uses the standard SDK redirect (no skipBrowserRedirect)', async () => {
    await authenticateWithGoogle()
    const call = oauthSpy.mock.calls[0][0] as { options: { queryParams: Record<string, string>; skipBrowserRedirect?: boolean } }
    expect(call.options.queryParams.prompt).toBe('select_account')
    expect(call.options.queryParams.access_type).toBe('offline')
    expect(call.options.skipBrowserRedirect).toBeUndefined()
  })
})
