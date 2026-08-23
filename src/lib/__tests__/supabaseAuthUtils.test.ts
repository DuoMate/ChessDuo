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
// HISTORY HYGIENE: the OAuth jump itself uses window.location.replace()
// (not a pushed top-level redirect) so no accounts.google.com entry is
// left in the back stack after sign-in — pressing Back after login can
// never re-enter the Google flow.
// ============================================================
describe('authenticateWithGoogle redirect target', () => {
  let oauthSpy: jest.SpyInstance
  let navigateMock: jest.Mock

  beforeEach(() => {
    oauthSpy = jest.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
      data: { url: 'https://providers.example' }, error: null,
    } as any)
    // Use injectable navigate — avoids jsdom window.Location.prototype incompatibility
    navigateMock = jest.fn()
  })

  afterEach(() => oauthSpy.mockRestore())

  it('default sign-in returns through /auth/callback (never bare "/")', async () => {
    await authenticateWithGoogle({ navigate: navigateMock })
    expect(oauthSpy).toHaveBeenCalledTimes(1)
    const opts = oauthSpy.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(opts.options.redirectTo).toBe(`${window.location.origin}/auth/callback`)
  })

  it('preserves the original destination via an encoded redirect param on the callback URL', async () => {
    await authenticateWithGoogle({ redirectUrl: '/duel?room=abc&time=600', navigate: navigateMock })
    const opts = oauthSpy.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(opts.options.redirectTo).toBe(
      `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/duel?room=abc&time=600')}`,
    )
  })

  it('navigates via history-replacing jump so Google pages never enter the back stack', async () => {
    await authenticateWithGoogle({ navigate: navigateMock })
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('https://providers.example')
  })

  it('does not force a consent wall (prompt is select_account, PKCE untouched)', async () => {
    await authenticateWithGoogle({ navigate: navigateMock })
    const opts = oauthSpy.mock.calls[0][0] as { options: { queryParams: Record<string, string> } }
    expect(opts.options.queryParams.prompt).toBe('select_account')
    expect(opts.options.queryParams.access_type).toBe('offline')
    expect((oauthSpy.mock.calls[0][0] as { options: { skipBrowserRedirect: boolean } }).options.skipBrowserRedirect)
      .toBe(true)
  })
})
