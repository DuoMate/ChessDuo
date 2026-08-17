function isDebugRequested(): boolean {
  if (process.env.NODE_ENV === 'development') return true
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage.getItem('chessduo_debug') === '1') return true
    return new URL(window.location.href).searchParams.get('debug') === '1'
  } catch {
    return false
  }
}

// Enabled in dev builds by default. In production, support can capture the
// same [ONLINE]/[CHESSDUO-BOT-TRACE]/[TURN-RESOLVE] diagnostics by loading the
// page with `?debug=1` or setting localStorage `chessduo_debug=1` then reloading
// (the flag is read once at module load).
export const DEBUG = isDebugRequested()
