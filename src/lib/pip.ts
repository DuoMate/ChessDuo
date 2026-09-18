import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { GameStatus } from '@/features/shared/gameTypes'

interface PipPlugin {
  setEligible(options: { eligible: boolean }): Promise<void>
  enter(): Promise<void>
  isInPip(): Promise<{ inPip: boolean }>
  addListener(
    eventName: 'pipModeChanged',
    listener: (event: { inPip: boolean }) => void,
  ): Promise<PluginListenerHandle>
}

const Pip = registerPlugin<PipPlugin>('Pip')

let lastEligibleSent: boolean | null = null
let pipModeActive = false

function canUsePip(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform()
}

/**
 * Pure eligibility rule — SINGLE SOURCE OF TRUTH for tests and hooks.
 *
 * PiP is available only while a real match is actively running (`PLAYING` /
 * `playing` across all four modes) with no blocking modal open (resign
 * confirm, leave confirm, insights, moves, chat, settings, game-over).
 * Every terminal state (checkmate, timeout, resignation, draw, abandonment)
 * resolves to a non-playing status, which revokes eligibility.
 */
export function shouldEnablePip(status: GameStatus | string, hasBlockingModal: boolean): boolean {
  if (hasBlockingModal) return false
  return String(status).toLowerCase() === 'playing'
}

/**
 * Publish PiP eligibility to the native layer. Best-effort and never throws:
 * PiP failure must never block game start, moves, game-over, or navigation.
 * Redundant updates are suppressed so the bridge only fires on real changes
 * (no per-tick native traffic).
 */
export async function setPipEligible(eligible: boolean): Promise<void> {
  if (lastEligibleSent === eligible) return
  lastEligibleSent = eligible
  if (!canUsePip()) return

  try {
    await Pip.setEligible({ eligible })
  } catch {
    // Native bridge unavailable (web build, old APK without the plugin) —
    // the game continues normally without PiP.
  }
}

/** Reset the eligibility cache (tests + unmount paths). */
export function resetPipEligibleCache(): void {
  lastEligibleSent = null
}

/** Manually request PiP entry (used only as a fallback; Home-gesture auto-enter is primary). */
export async function enterPip(): Promise<boolean> {
  if (!canUsePip()) return false

  try {
    await Pip.enter()
    return true
  } catch {
    // Entry rejected (not eligible, old Android) — game continues normally.
    return false
  }
}

/** Last known PiP mode (updated by native `pipModeChanged` events). */
export function getPipModeActive(): boolean {
  return pipModeActive
}

/**
 * Subscribe to native PiP mode changes. No-op on web (never fires). The
 * returned function unsubscribes. Never throws.
 */
export function subscribePipModeChanged(listener: (inPip: boolean) => void): () => void {
  if (!canUsePip()) return () => {}

  let handle: PluginListenerHandle | null = null
  let cancelled = false
  Pip.addListener('pipModeChanged', (event) => {
    pipModeActive = event.inPip
    listener(event.inPip)
  })
    .then((h) => {
      if (cancelled) {
        h.remove().catch(() => {
          // Listener teardown is best-effort during unmount.
        })
      } else {
        handle = h
      }
    })
    .catch(() => {
      // Plugin missing on this build — stay in full-screen mode.
    })
  return () => {
    cancelled = true
    if (handle) {
      handle.remove().catch(() => {
        // Listener teardown is best-effort during unmount.
      })
    }
  }
}
