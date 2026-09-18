import { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// P0 perf: getSession() was called 5–8× per cold startup (providers,
// PremiumProvider ×2, home page ×2, (main)/layout, game pages...).
// supabase.auth.getSession() is a local-storage read, but every caller
// awaited it independently and each premium path then fanned out to
// GET /api/subscription/status. A short-lived shared promise collapses
// same-tick bursts into one read; TTL is intentionally seconds-short so
// sign-out / token-refresh can never serve stale auth for long.
let cachedSession: Session | null | undefined = undefined
let cachedSessionAt = 0
let pendingSession: Promise<Session | null> | null = null
const SESSION_CACHE_MS = 5_000

export function clearSessionCache(): void {
  cachedSession = undefined
  cachedSessionAt = 0
  pendingSession = null
}

export const AuthService = {
  getSession: async (): Promise<Session | null> => {
    const now = Date.now()
    if (cachedSession !== undefined && (now - cachedSessionAt) < SESSION_CACHE_MS) {
      return cachedSession
    }
    if (!pendingSession) {
      pendingSession = supabase.auth.getSession()
        .then(({ data }) => {
          cachedSession = data.session
          cachedSessionAt = Date.now()
          return cachedSession
        })
        .finally(() => { pendingSession = null })
    }
    return pendingSession
  },

  onAuthChange: (callback: (event: string, session: Session | null) => void) => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Auth state is ground truth — drop the short-lived cache so the
      // next getSession() observes sign-in/out/refresh immediately.
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        clearSessionCache()
      }
      callback(event, session)
    })
    return () => data.subscription.unsubscribe()
  },
}
