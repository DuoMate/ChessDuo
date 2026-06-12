'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UseNavigationGuardOptions {
  enabled: boolean
  onAttemptLeave: () => void
}

export function useNavigationGuard({ enabled, onAttemptLeave }: UseNavigationGuardOptions) {
  const router = useRouter()
  const blockedRef = useRef(false)
  const onAttemptLeaveRef = useRef(onAttemptLeave)

  useEffect(() => {
    onAttemptLeaveRef.current = onAttemptLeave
  }, [onAttemptLeave])

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

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!blockedRef.current) {
        e.preventDefault()
        onAttemptLeaveRef.current()
      }
    }

    const handlePopState = () => {
      const currentPath = window.location.pathname + window.location.search
      if (currentPath.startsWith('/game') && !blockedRef.current) {
        window.history.pushState(null, '', currentPath)
        onAttemptLeaveRef.current()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled])

  const confirmLeave = useCallback(() => {
    blockedRef.current = true
    router.push('/')
  }, [router])

  return { blockNavigation, unblockNavigation, confirmLeave }
}
