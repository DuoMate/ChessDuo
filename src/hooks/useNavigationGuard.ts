'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UseNavigationGuardOptions {
  enabled: boolean
  onAttemptLeave: () => void
  onOverlayBack?: () => boolean
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

    // Push a blocker history entry so the first back press
    // does not immediately navigate away from the game page
    const currentPath = window.location.pathname + window.location.search
    window.history.pushState(null, '', currentPath)

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!blockedRef.current) {
        e.preventDefault()
      }
    }

    const handlePopState = () => {
      if (!blockedRef.current) {
        // Check for open overlays first — close them before showing leave modal
        if (onOverlayBackRef.current && onOverlayBackRef.current()) {
          window.history.pushState(null, '', window.location.pathname + window.location.search)
          return
        }
        window.history.pushState(null, '', window.location.pathname + window.location.search)
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

  const confirmLeave = useCallback(() => {
    blockedRef.current = true
    router.push('/')
  }, [router])

  return { blockNavigation, unblockNavigation, confirmLeave }
}
