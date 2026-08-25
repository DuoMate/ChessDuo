'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UseNavigationGuardOptions {
  enabled: boolean
  onAttemptLeave: () => void
  onOverlayBack?: () => boolean
  hasOpenOverlay?: boolean
}

/**
 * Marker stored on the guard's own history entry so we can recognize it
 * later via `history.state` (the only way to identify the live entry).
 */
const GUARD_STATE_MARKER = '__chessduoNavGuard'

function liveEntryIsGuardSentinel(): boolean {
  if (typeof window === 'undefined') return false
  const state = window.history.state as Record<string, unknown> | null
  return !!state && state[GUARD_STATE_MARKER] === true
}

export function useNavigationGuard({ enabled, onAttemptLeave, onOverlayBack, hasOpenOverlay = false }: UseNavigationGuardOptions) {
  const router = useRouter()
  const blockedRef = useRef(false)
  const onAttemptLeaveRef = useRef(onAttemptLeave)
  const onOverlayBackRef = useRef(onOverlayBack)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    onAttemptLeaveRef.current = onAttemptLeave
  }, [onAttemptLeave])

  useEffect(() => {
    onOverlayBackRef.current = onOverlayBack
  }, [onOverlayBack])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const blockNavigation = useCallback(() => {
    if (!enabled) return
    blockedRef.current = true
    onAttemptLeaveRef.current()
  }, [enabled])

  const unblockNavigation = useCallback(() => {
    blockedRef.current = false
  }, [])

  // Intercept the browser/device Back button whenever the guard is active
  // (active game) OR an in-game overlay is open (e.g. Move Insights on a
  // completed game). When only an overlay is open the leave modal is skipped.
  const shouldIntercept = enabled || hasOpenOverlay

  useEffect(() => {
    if (!shouldIntercept) return

    // Push a tagged blocker history entry so the first back press
    // does not immediately navigate away from the game page. The
    // popstate handler below relies on this entry: at popstate time
    // window.location is still the game URL, so its re-push restores
    // the exact same URL. The entry is consumed by the effect below
    // when we stop intercepting (game over / overlay closed) —
    // leaving it in place made the first Back after a completed
    // game resurrect the /game history entry.
    const currentPath = window.location.pathname + window.location.search
    window.history.pushState({ [GUARD_STATE_MARKER]: true }, '', currentPath)

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!blockedRef.current) {
        e.preventDefault()
      }
    }

    const handlePopState = () => {
      if (blockedRef.current) return
      // Check for open overlays first — close them before showing leave modal.
      if (onOverlayBackRef.current && onOverlayBackRef.current()) {
        window.history.pushState({ [GUARD_STATE_MARKER]: true }, '', window.location.pathname + window.location.search)
        return
      }
      // Only block navigation (show leave modal) for an active game.
      if (enabledRef.current) {
        window.history.pushState({ [GUARD_STATE_MARKER]: true }, '', window.location.pathname + window.location.search)
        blockedRef.current = true
        onAttemptLeaveRef.current()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload, { capture: true })
    window.addEventListener('popstate', handlePopState, { capture: true })

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload, { capture: true })
      window.removeEventListener('popstate', handlePopState, { capture: true })
    }
  }, [shouldIntercept])

  // Consume the blocker entry when we stop intercepting while the page
  // stays mounted (e.g. GAME_OVER, or an in-game overlay was closed). Only
  // pops when our tagged sentinel is still the live entry — never after the
  // user navigated away normally (confirmLeave push / replace truncate
  // forward entries, and a natural back already consumed the sentinel). The
  // listeners are already removed by the effect above at this point, so this
  // synthetic pop cannot re-trigger the leave modal; the URL does not change
  // (sentinel shares the game URL), so the router performs no navigation.
  useEffect(() => {
    if (shouldIntercept) return
    if (liveEntryIsGuardSentinel()) {
      window.history.back()
    }
  }, [shouldIntercept])

  const confirmLeave = useCallback(() => {
    blockedRef.current = true
    router.push('/')
  }, [router])

  return { blockNavigation, unblockNavigation, confirmLeave }
}
