/**
 * Safe back-navigation helper (navigation/history only — no auth, billing, or game logic).
 *
 * RULE (docs/ARCHITECTURE.md §4): prefer the app router (`router.back()` /
 * `router.replace()`) and never blindly `window.history.back()` or
 * `window.location = "/home"`. A raw `router.back()` is only safe when the
 * previous history entry belongs to this app — otherwise Back can land on
 * Google OAuth consent, an auth callback, or an external referrer, or exit
 * the Capacitor app.
 *
 * `canGoBackSafely()` keeps the existing `history.length > 2` signal but adds
 * a same-origin `document.referrer` check: an external referrer vetoes `back()`
 * so callers fall back to an in-app route (usually `/`).
 */
export function canGoBackSafely(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (window.history.length <= 2) return false
    const ref = typeof document !== 'undefined' ? document.referrer : ''
    if (!ref) return true
    return new URL(ref).origin === window.location.origin
  } catch {
    // Malformed referrer — fall back to the legacy length signal.
    try {
      return window.history.length > 2
    } catch {
      return false
    }
  }
}
