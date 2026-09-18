'use client'

import { useEffect, useState } from 'react'
import { getPipModeActive, setPipEligible, subscribePipModeChanged } from '@/lib/pip'

/**
 * Publishes PiP eligibility to the native layer while mounted.
 *
 * Callers pass a value derived ONLY from existing authoritative state:
 * `status === PLAYING/playing` with no blocking modal open. When eligibility
 * drops (game over, modal opens, unmount), the native layer is told
 * immediately so auto-enter stops. Best-effort — never affects game flow.
 */
export function usePipEligibility(eligible: boolean): void {
  useEffect(() => {
    setPipEligible(eligible)
  }, [eligible])

  useEffect(() => {
    return () => {
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
