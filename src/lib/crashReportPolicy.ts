/**
 * Pure crash-report policy (P0-2).
 *
 * Kept free of `next/server` imports so the security-critical decisions
 * (origin allowlist + payload validation/sanitization) can be unit-tested
 * without a Next.js runtime.
 */

export const ALLOWED_ORIGINS = [
  'https://chessduo.navron.org',
  'https://chessduo.chessdoubles27.workers.dev',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
]

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return true // no Origin header (same-origin fetch / curl) is allowed
  return ALLOWED_ORIGINS.includes(origin)
}

export interface SanitizedCrashPayload {
  message: string
  stack: string | null
  error_type: string
  source: string | null
  line: number | null
  col: number | null
  platform: string
  app_version: string | null
  session_id: string | null
  user_id: string | null
  route: string | null
  game_id: string | null
  room_id: string | null
  turn_number: number | null
}

export function sanitizeCrashPayload(
  body: Record<string, unknown> | null,
): SanitizedCrashPayload | null {
  if (!body || !body.message || !body.platform) return null
  return {
    message: String(body.message).slice(0, 4000),
    stack: body.stack ? String(body.stack).slice(0, 8000) : null,
    error_type: body.error_type ? String(body.error_type) : 'unhandled',
    source: body.source ? String(body.source) : null,
    line: typeof body.line === 'number' ? body.line : null,
    col: typeof body.col === 'number' ? body.col : null,
    platform: String(body.platform).slice(0, 16),
    app_version: body.app_version ? String(body.app_version).slice(0, 64) : null,
    session_id: body.session_id ? String(body.session_id).slice(0, 64) : null,
    user_id: body.user_id ? String(body.user_id).slice(0, 64) : null,
    route: body.route ? String(body.route).slice(0, 512) : null,
    game_id: body.game_id ? String(body.game_id).slice(0, 64) : null,
    room_id: body.room_id ? String(body.room_id).slice(0, 64) : null,
    turn_number: typeof body.turn_number === 'number' ? body.turn_number : null,
  }
}
