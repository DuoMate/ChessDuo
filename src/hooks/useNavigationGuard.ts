'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UseNavigationGuardOptions {
  enabled: boolean
  onAttemptLeave: () => void
  onOverlayBack?: () => boolean
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

export function useNavigationGuard({ enabled, onAttemptLeave, onOverlayBack }: UseNavigationGuardOptions) {
  const router = useRouter()
  const blockedRef = useRef(false)
  const onAttemptLeaveRef = useRef(onAttemptLeave)
  const onOverlayBackRef = useRef(onOverlayBack)

  useEffect(() => {
    onAttemptLeaveRef.current = onAttemptLeave
  }, [onAttemptLeave])

  useEffect(() => {
    onOverlayBackRef.current = onOverlayBack
  }, [onOverlayBack])

  const blockNavigation = useCallback(() => {
    if (!enabled) return
    blockedRef.current = true
    onAttemptLeaveRef.current()
  }, [enabled])

  const unblockNavigation = useCallback(() => {
    blockedRef.current = false
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Push a tagged blocker history entry so the first back press
    // does not immediately navigate away from the game page. The
    // popstate handler below relies on this entry: at popstate time
    // window.location is still the game URL, so its re-push restores
    // the exact same URL. The entry is consumed by the effect below
    // when the guard deactivates (game over / unmount-after-disable)
    // — leaving it in place made the first Back after a completed
    // game resurrect the /game history entry.
    const currentPath = window.location.pathname + window.location.search
    window.history.pushState({ [GUARD_STATE_MARKER]: true }, '', currentPath)

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!blockedRef.current) {
        e.preventDefault()
      }
    }

    const handlePopState = () => {
      if (!blockedRef.current) {
        // Check for open overlays first — close them before showing leave modal
        if (onOverlayBackRef.current && onOverlayBackRef.current()) {
          window.history.pushState({ [GUARD_STATE_MARKER]: true }, '', window.location.pathname + window.location.search)
          return
        }
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
  }, [enabled])

  // Consume the blocker entry when the guard deactivates while the page
  // stays mounted (e.g. GAME_OVER). Only pops when our tagged sentinel is
  // still the live entry — never after the user navigated away normally
  // (confirmLeave push / replace truncate forward entries, and a natural
  // back already consumed the sentinel). The listeners are already removed
  // by the effect above at this point, so this synthetic pop cannot
  // re-trigger the leave modal; the URL does not change (sentinel shares
  // the game URL), so the router performs no navigation.
  useEffect(() => {
    if (enabled) return
    if (liveEntryIsGuardSentinel()) {
      window.history.back()
    }
  }, [enabled])

  const confirmLeave = useCallback(() => {
    blockedRef.current = true
    router.push('/')
  }, [router])

  return { blockNavigation, unblockNavigation, confirmLeave }
}
