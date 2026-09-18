'use client'

import { useEffect, useState } from 'react'
import { getPipModeActive, isPipSupported, reaffirmPipEligible, setPipEligible, subscribePipModeChanged } from '@/lib/pip'

/**
 * Publishes PiP eligibility to the native layer while mounted.
 *
 * Callers pass a value derived ONLY from existing authoritative state:
 * `status === PLAYING/playing` with no blocking modal open. When eligibility
 * drops (game over, modal opens, unmount), the native layer is told
 * immediately so auto-enter stops. Best-effort — never affects game flow.
 *
 * On resume from background the last value is re-asserted (bypassing the
 * dedupe cache) so a publish that raced plugin attach can never leave
 * auto-enter disabled for the rest of the game.
 */
export function usePipEligibility(eligible: boolean): void {
  useEffect(() => {
    setPipEligible(eligible)
  }, [eligible])

  useEffect(() => {
    if (!isPipSupported()) {
      return () => {
        setPipEligible(false)
      }
    }
    let cancelled = false
    let removeResumeListener: (() => void) | null = null
    // Mirrors useCapacitorBackButton: dynamic import so web builds never
    // bundle or touch the native App plugin.
    import('@capacitor/app')
      .then(({ App }) => {
        if (cancelled) return
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void reaffirmPipEligible()
        })
          .then((handle) => {
            removeResumeListener = () => {
              handle.remove().catch(() => {
                // Listener teardown is best-effort during unmount.
              })
            }
          })
          .catch(() => {
            // Plugin missing on this build — auto-enter publish still stands.
          })
      })
      .catch(() => {
        // Capacitor not available — no-op on web.
      })
    return () => {
      cancelled = true
      if (removeResumeListener) removeResumeListener()
      setPipEligible(false)
    }
  }, [])
}

/**
 * Tracks whether the activity is currently inside the PiP window. The web
 * layer uses this to swap the full game shell for the compact PiPOverlay.
 * Always false on web builds.
 */
export function usePipMode(): boolean {
  const [inPip, setInPip] = useState<boolean>(() => getPipModeActive())

  useEffect(() => subscribePipModeChanged(setInPip), [])

  return inPip
}
