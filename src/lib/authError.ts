export interface AuthErrorLike {
  code?: string | number | null
  message?: string | null
  name?: string | null
  status?: number | null
}

export interface ClassifiedAuthError {
  code: string | null
  message: string
}

const NETWORK_MARKERS = ['failed to fetch', 'fetch', 'network', 'load failed', 'connection']

/**
 * Map a raw Supabase Auth error to an accurate user-facing message.
 *
 * Only the `email_not_confirmed` response ever produces an "Email not
 * confirmed" message — unrelated errors (network, RLS, invalid credentials,
 * profile load failures, …) must never be converted into it.
 */
export function classifyAuthError(err: unknown): ClassifiedAuthError {
  const e = (err ?? {}) as AuthErrorLike
  const code = typeof e.code === 'string' ? e.code : null
  const rawMessage = e.message || e.name || ''

  if (code === 'email_not_confirmed' || /email not confirmed/i.test(rawMessage)) {
    return {
      code: 'email_not_confirmed',
      message: 'Email not confirmed. Check your inbox for the confirmation link, then sign in again.',
    }
  }

  if (code === 'invalid_credentials' || /invalid (login )?credentials/i.test(rawMessage)) {
    return { code: 'invalid_credentials', message: 'Invalid email or password.' }
  }

  if (code === 'user_not_found' || /user not found/i.test(rawMessage)) {
    return { code: 'user_not_found', message: 'No account found with this email. Sign up instead.' }
  }

  if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered/i.test(rawMessage)) {
    return { code: 'user_already_exists', message: 'This email is already registered. Try signing in instead.' }
  }

  if (code === 'weak_password' || /password should be at least/i.test(rawMessage)) {
    return { code: 'weak_password', message: rawMessage || 'Password is too weak. Use at least 6 characters.' }
  }

  if (/rate[ _-]?limit/i.test(code || '') || /rate[ _-]?limit/i.test(rawMessage)) {
    return { code: 'rate_limit', message: 'Too many attempts. Please wait a moment and try again.' }
  }

  if (
    code === 'fetch_error' ||
    code === 'network_error' ||
    NETWORK_MARKERS.some((m) => rawMessage.toLowerCase().includes(m))
  ) {
    return { code: 'network_error', message: 'Network error. Check your connection and try again.' }
  }

  // Unknown error — surface the original message verbatim rather than guessing,
  // so we never mislabel an unrelated error as "Email not confirmed".
  return { code, message: rawMessage || 'Authentication failed.' }
}

/**
 * Detect the PKCE "code verifier missing / unusable" class of auth-callback
 * failures. Fired by `exchangeCodeForSession` when the one-time verifier
 * stored at signup is not present in THIS browser's storage — i.e. the
 * confirmation/OAuth link was completed in a different browser or device
 * (inherent to the secure PKCE flow), or the single-use code is being
 * replayed after a refresh. The email itself is already confirmed
 * server-side at that point (GoTrue's /verify endpoint confirms before
 * redirecting with `?code=`), so the correct recovery is normal sign-in.
 */
export function isPkceVerifierMissing(err: unknown): boolean {
  const e = (err ?? {}) as AuthErrorLike
  const rawMessage = `${e.message || ''} ${e.name || ''}`
  return /code\s+verifier/i.test(rawMessage)
}

export type OtpType = 'signup' | 'email' | 'recovery' | 'invite' | 'email_change' | 'phone_change' | 'sms' | 'magiclink'

/**
 * Normalize the `type` query/hash param from an auth link to a value
 * `supabase.auth.verifyOtp` accepts. Legacy `signup`/`magiclink` map to the
 * current `email` verification type.
 */
export function normalizeOtpType(raw: string | null | undefined): OtpType {
  switch (raw) {
    case 'recovery':
    case 'invite':
    case 'email_change':
    case 'phone_change':
    case 'sms':
      return raw
    default:
      return 'email'
  }
}

/**
 * Absolute URL the auth confirmation/OAuth callback redirects to.
 * `emailRedirectTo` requires an absolute URL.
 */
export function buildAuthCallbackUrl(base: string): string {
  const trimmed = (base || '').trim().replace(/\/+$/, '')
  return trimmed ? `${trimmed}/auth/callback` : '/auth/callback'
}
