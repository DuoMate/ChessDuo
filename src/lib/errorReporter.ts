import { getAppBaseUrl } from './appUrl'

/**
 * Client-side error reporter (P0-2).
 *
 * Centralizes payload assembly so every error captures enough context to
 * diagnose (platform, app version, session, hashed user id, route, and any
 * game/room/turn context) while NEVER capturing passwords, tokens, private
 * keys, or secrets — the payload only ever contains the explicit allowlist
 * below and is built from fields the caller opts into.
 */

export interface ReportContext {
  gameId?: string
  roomId?: string
  turnNumber?: number
}

export interface ReportInput {
  message: string
  stack?: string
  errorType?: string
  source?: string
  line?: number
  col?: number
  url?: string
  userId?: string
  ctx?: ReportContext
}

type Platform = 'web' | 'android' | 'ios'

let sessionId = ''
function getSessionId(): string {
  if (!sessionId) {
    sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
  }
  return sessionId
}

let platformCache: Platform | null = null
let platformPromise: Promise<Platform> | null = null
function detectPlatform(): Promise<Platform> {
  if (platformCache) return Promise.resolve(platformCache)
  if (!platformPromise) {
    platformPromise = (async (): Promise<Platform> => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          const p = Capacitor.getPlatform()
          if (p === 'android' || p === 'ios') return p
        }
      } catch {
        /* not a Capacitor build — web */
      }
      return 'web'
    })().then((p) => {
      platformCache = p
      return p
    })
  }
  return platformPromise
}

let versionPromise: Promise<string> | null = null
function detectAppVersion(): Promise<string> {
  if (!versionPromise) {
    versionPromise = (async (): Promise<string> => {
      const env = process.env.NEXT_PUBLIC_APP_VERSION || ''
      if (env) return env
      try {
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        if (info?.version) return info.version
      } catch {
        /* not native or plugin unavailable */
      }
      return ''
    })()
  }
  return versionPromise
}

async function hashUserId(uid: string): Promise<string> {
  if (!uid) return ''
  try {
    const data = new TextEncoder().encode(uid)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
  } catch {
    return 'redacted'
  }
}

// In-memory client-side flood guard (a crashing loop must not hammer the API).
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
let windowStart = Date.now()
let sentInWindow = 0

export async function reportError(input: ReportInput): Promise<void> {
  if (typeof window === 'undefined') return

  const now = Date.now()
  if (now - windowStart > WINDOW_MS) {
    windowStart = now
    sentInWindow = 0
  }
  if (sentInWindow >= MAX_PER_WINDOW) return
  sentInWindow++

  const [platform, appVersion, userId] = await Promise.all([
    detectPlatform(),
    detectAppVersion(),
    input.userId ? hashUserId(input.userId) : Promise.resolve(''),
  ])

  const route =
    input.url ||
    (window.location ? window.location.pathname + window.location.search : '')

  const payload = {
    message: (input.message || 'unknown').slice(0, 4000),
    stack: (input.stack || '').slice(0, 8000),
    error_type: input.errorType || 'unhandled',
    source: input.source || '',
    line: input.line || 0,
    col: input.col || 0,
    platform,
    app_version: appVersion,
    session_id: getSessionId(),
    user_id: userId,
    route,
    game_id: input.ctx?.gameId || null,
    room_id: input.ctx?.roomId || null,
    turn_number: input.ctx?.turnNumber ?? null,
    timestamp: new Date().toISOString(),
  }

  try {
    await fetch(`${getAppBaseUrl()}/api/log-crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // crash-report delivery is best-effort; suppress network failures
    })
  } catch {
    // suppress any reporting errors — never let reporting break the app
  }
}
