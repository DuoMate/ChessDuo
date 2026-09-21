import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/**
 * Google Play In-App Update (Flexible) bridge — the per-account source of
 * truth for "is a newer version actually available". Mirrors pip.ts /
 * nativeAd.ts: native-only, best-effort, never throws, change-suppressed.
 * Web builds and missing plugins are silent no-ops so game flow is never gated.
 */

export interface NativeAppUpdateStatus {
  /** True when Play reports UPDATE_AVAILABLE for this device/account. */
  available: boolean
  availableVersionCode: number
  stalenessDays: number
  flexibleAllowed: boolean
  immediateAllowed: boolean
  /** UpdateAvailability code: 1 not-available, 2 available, 3 in-progress. */
  updateAvailability: number
}

export type NativeUpdateFlowResult = {
  resultCode: number
  cancelled: boolean
}

export type NativeUpdateInstallStatus =
  | 'unknown'
  | 'pending'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'installed'
  | 'failed'
  | 'canceled'

export interface NativeUpdateStateChanged {
  status: number
  statusName: NativeUpdateInstallStatus
  bytesDownloaded: number
  totalBytesToDownload: number
  installErrorCode: number
}

interface AppUpdatePlugin {
  check(): Promise<NativeAppUpdateStatus>
  startFlexibleUpdate(): Promise<{ started: boolean; reason?: string }>
  completeUpdate(): Promise<void>
  cleanup(): Promise<void>
  addListener(
    eventName: 'stateChanged',
    listener: (event: NativeUpdateStateChanged) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'flowResult',
    listener: (event: NativeUpdateFlowResult) => void,
  ): Promise<PluginListenerHandle>
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate')

/** Native-only gate so web builds never touch the plugin. */
export function isNativeAppUpdateSupported(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform()
}

const EMPTY_STATUS: NativeAppUpdateStatus = {
  available: false,
  availableVersionCode: 0,
  stalenessDays: 0,
  flexibleAllowed: false,
  immediateAllowed: false,
  /**
   * UNKNOWN (0) — the check itself was indeterminate (Play unavailable,
   * sideload, plugin missing on an older APK). Callers fall back to the
   * remote-manifest path only in this case; a definitive UPDATE_NOT_AVAILABLE
   * (1) is authoritative and must never be second-guessed by a stale manifest.
   */
  updateAvailability: 0,
}

/**
 * Asks Play whether a flexible update is genuinely available for this
 * device/account. Never throws: any failure (Play unavailable, sideload,
 * plugin missing, activity not attached) resolves to `available:false`.
 */
export async function checkNativeUpdate(): Promise<NativeAppUpdateStatus> {
  if (!isNativeAppUpdateSupported()) return EMPTY_STATUS
  try {
    const status = await AppUpdate.check()
    return { ...EMPTY_STATUS, ...status }
  } catch {
    // Fail-silent: an uncheckable Play state must never nag or crash.
    return EMPTY_STATUS
  }
}

/** Starts Google's official FLEXIBLE in-app update flow. Returns started flag. */
export async function startNativeFlexibleUpdate(): Promise<boolean> {
  if (!isNativeAppUpdateSupported()) return false
  try {
    const result = await AppUpdate.startFlexibleUpdate()
    return result?.started === true
  } catch {
    // Update flow couldn't start (not available/allowed, activity gone) —
    // the caller falls back to the Play listing.
    return false
  }
}

/** Completes an already-downloaded flexible update (restart-to-install). */
export async function completeNativeUpdate(): Promise<boolean> {
  if (!isNativeAppUpdateSupported()) return false
  try {
    await AppUpdate.completeUpdate()
    return true
  } catch {
    // Not yet downloaded — the not-ready prompt stays up; never a crash.
    return false
  }
}

/** Releases the native install listener (unmount / session end). Best-effort. */
export async function cleanupNativeUpdate(): Promise<void> {
  if (!isNativeAppUpdateSupported()) return
  try {
    await AppUpdate.cleanup()
  } catch {
    // Teardown is best-effort during unmount.
  }
}

/**
 * Subscribe to native install-state changes (DOWNLOADED → prompt restart).
 * Returns an unsubscribe function. No-op on web (never fires). Never throws.
 */
export function subscribeNativeUpdateState(
  listener: (event: NativeUpdateStateChanged) => void,
): () => void {
  if (!isNativeAppUpdateSupported()) return () => {}

  let handle: PluginListenerHandle | null = null
  let cancelled = false
  AppUpdate.addListener('stateChanged', listener)
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
      // Plugin missing on this build — update prompt simply never fires.
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