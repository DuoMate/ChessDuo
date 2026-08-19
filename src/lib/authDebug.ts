import { DEBUG } from './debug'

// Safe fields only — NEVER log password, access_token, refresh_token, a full
// JWT, the confirmation token, or any secret. User ids are hashed before log.

export interface AuthDebugFields {
  stage: string
  correlationId?: string
  authErrorCode?: string | null
  authErrorMessage?: string | null
  hasUser?: boolean
  hasSession?: boolean
  userId?: string | null
  emailConfirmedAt?: string | null
}

/**
 * Extract the Supabase project reference from NEXT_PUBLIC_SUPABASE_URL.
 * Returns only the project id (e.g. "abcdefghijkl"), never the API key.
 */
export function getSupabaseProjectReference(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const match = url.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/i)
  return match ? match[1] : null
}

/** Non-cryptographic, deterministic FNV-1a hash — for correlating logs, not security. */
export function hashUserId(userId: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

export function getPlatform(): string {
  if (typeof window === 'undefined') return 'server'
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  return w.Capacitor?.isNativePlatform?.() ? 'android' : 'browser'
}

export function correlationId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function buildAuthDebugPayload(fields: AuthDebugFields): Record<string, unknown> {
  const { userId, ...rest } = fields
  return {
    ...rest,
    ...(userId ? { userIdHash: hashUserId(userId) } : {}),
    supabaseProjectReference: getSupabaseProjectReference(),
    environment: process.env.NODE_ENV,
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    platform: getPlatform(),
  }
}

export function logAuthDebug(fields: AuthDebugFields): void {
  if (!DEBUG) return
  // eslint-disable-next-line no-console
  console.log('[AUTH_DEBUG]', JSON.stringify(buildAuthDebugPayload(fields)))
}
