'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  decideUpdate,
  fetchVersionManifest,
  resolveManifestBaseUrl,
  type UpdateDecision,
  type VersionManifest,
} from '@/features/app-update'
import { getBundledVersion } from '@/lib/appVersionInfo'
import { isNativePlatform } from '@/lib/share'
import { openPlayListing } from '@/lib/rateApp'
import {
  checkNativeUpdate,
  cleanupNativeUpdate,
  completeNativeUpdate,
  isNativeAppUpdateSupported,
  startNativeFlexibleUpdate,
  subscribeNativeUpdateState,
  type NativeAppUpdateStatus,
  type NativeUpdateInstallStatus,
} from '@/lib/nativeAppUpdate'

const DISMISS_KEY = 'chessduo_update_dismissed_for'
const CHECK_DELAY_MS = 2500

type NativeUpdateFlowState = NativeUpdateInstallStatus | 'downloading' | 'idle'

function isUnsafeRoute(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname.startsWith('/game') ||
    pathname.startsWith('/duel') ||
    pathname.startsWith('/four-player') ||
    pathname.startsWith('/coach')
  )
}

function hasTransientAuthOrInviteParams(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return (
    params.has('code') ||
    params.has('flow') ||
    params.has('redirect') ||
    params.has('room')
  )
}

async function readInstalledVersion(): Promise<{
  version: string
  versionCode: number | null
}> {
  const bundled = getBundledVersion()
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    const code = info?.build ? parseInt(info.build, 10) : NaN
    return {
      version: info?.version || bundled.version,
      versionCode: Number.isFinite(code) ? code : bundled.versionCode,
    }
  } catch {
    // Not native or plugin unavailable — fall back to the build stamp.
    return { version: bundled.version, versionCode: bundled.versionCode }
  }
}

export interface AppUpdateState {
  status: UpdateDecision
  manifest: VersionManifest | null
  installedVersion: string
  nativeAvailable: boolean
  nativeVersionCode: number
  flowState: NativeUpdateFlowState
  dismiss: () => void
  /** Starts the official Play flexible download (or falls back to the listing). */
  startUpdate: () => Promise<void>
  /** Completes a downloaded flexible update (restart-to-install). */
  completeAndRestart: () => Promise<void>
  openStore: () => Promise<void>
}

/**
 * Fail-silent update check (native Android only).
 *
 * PRIMARY — Google Play In-App Updates (flexible), the per-account truth from
 * `AppUpdateManager`: `available && flexibleAllowed` → prompt. No reliance on
 * a hand-synced remote manifest, so a stale/manually-deployed version.json can
 * never suppress (or fabricate) a prompt. "Update" starts the official Play
 * download; install-state events surface "downloaded → Restart to update".
 *
 * FALLBACK — remote manifest `decideUpdate` (existing flow) is used only when
 * the native check is unavailable (old APK without the plugin, Play services
 * missing, sideload, web). This keeps older installed builds working identically.
 *
 * - Runs once per session, delayed so startup never blocks.
 * - Web browsers always report `current` (normal web deploy strategy).
 * - Skips active games, OAuth callbacks, and invite/deep-link captures.
 * - "Later" suppresses the prompt for the reported release only.
 */
export function useAppUpdate(): AppUpdateState {
  const pathname = usePathname()
  const [status, setStatus] = useState<UpdateDecision>('current')
  const [manifest, setManifest] = useState<VersionManifest | null>(null)
  const [installedVersion, setInstalledVersion] = useState('')
  const [nativeStatus, setNativeStatus] = useState<NativeAppUpdateStatus | null>(null)
  const [flowState, setFlowState] = useState<NativeUpdateFlowState>('idle')
  const subscriptionStartedRef = useRef(false)

  const dismiss = useCallback(() => {
    const key = nativeStatus
      ? String(nativeStatus.availableVersionCode)
      : manifest
        ? String(manifest.latestVersionCode)
        : 'unknown'
    try {
      sessionStorage.setItem(DISMISS_KEY, key)
    } catch {
      // storage unavailable — prompt simply reappears next session
    }
    setStatus('current')
  }, [nativeStatus, manifest])

  const openStore = useCallback(async () => {
    try {
      await openPlayListing()
    } catch {
      // best-effort — the Play listing owns the flow from here
    }
  }, [])

  const startUpdate = useCallback(async () => {
    // Native truth → official Play flexible download.
    if (isNativeAppUpdateSupported() && nativeStatus?.available && nativeStatus.flexibleAllowed) {
      const started = await startNativeFlexibleUpdate()
      if (started) return
    }
    // Fallback: no native flow (old APK / not available / web) → Play listing.
    await openStore()
  }, [nativeStatus, openStore])

  const completeAndRestart = useCallback(async () => {
    await completeNativeUpdate()
  }, [])

  // Subscribe to native install-state events once (harmless no-op elsewhere).
  useEffect(() => {
    if (!isNativeAppUpdateSupported()) return
    if (subscriptionStartedRef.current) return
    subscriptionStartedRef.current = true
    const unsubscribe = subscribeNativeUpdateState((event) => {
      setFlowState(event.statusName)
    })
    return () => {
      unsubscribe()
      void cleanupNativeUpdate()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isNativePlatform()) return
    if (isUnsafeRoute(pathname)) return
    if (hasTransientAuthOrInviteParams()) return

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const installed = await readInstalledVersion()
        if (cancelled) return
        setInstalledVersion(installed.version)
        if (!installed.version && installed.versionCode === null) return

        // PRIMARY: Google Play In-App Updates — per-account truth.
        const native = await checkNativeUpdate()
        if (cancelled) return
        if (native.available && native.flexibleAllowed) {
          try {
            const dismissedFor = sessionStorage.getItem(DISMISS_KEY)
            if (
              dismissedFor &&
              dismissedFor === String(native.availableVersionCode)
            )
              return
          } catch {
            // storage unavailable — continue to the decision
          }
          setNativeStatus(native)
          setManifest(null)
          setStatus('optional')
          return
        }
        // Play answered definitively (UPDATE_AVAILABLE not allowed, or
        // UPDATE_NOT_AVAILABLE per this account's rollout): authoritative.
        // Do NOT second-guess with a fallible remote manifest.
        if (native.updateAvailability !== 0) return

        // FALLBACK: check was indeterminate (Play unavailable / sideload /
        // older APK without the plugin) → remote-manifest decideUpdate.
        const baseUrl = resolveManifestBaseUrl(
          process.env.NEXT_PUBLIC_SITE_URL,
          window.location.origin,
        )
        // On native the origin is a local capacitor host — without an
        // explicit site URL there is no safe manifest base, so skip.
        if (!process.env.NEXT_PUBLIC_SITE_URL || !baseUrl) return

        const remote = await fetchVersionManifest({ baseUrl })
        if (cancelled || !remote) return

        try {
          const dismissedFor = sessionStorage.getItem(DISMISS_KEY)
          if (
            dismissedFor &&
            dismissedFor === String(remote.latestVersionCode)
          )
            return
        } catch {
          // storage unavailable — continue to the decision
        }

        const installedArg = {
          version: installed.version,
          ...(installed.versionCode !== null
            ? { versionCode: installed.versionCode }
            : {}),
        }
        const decision = decideUpdate(installedArg, remote)
        if (cancelled) return
        if (decision === 'optional') {
          setManifest(remote)
          setStatus('optional')
        }
      })()
    }, CHECK_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pathname])

  return {
    status,
    manifest,
    installedVersion,
    nativeAvailable: nativeStatus?.available && nativeStatus.flexibleAllowed,
    nativeVersionCode: nativeStatus?.availableVersionCode ?? 0,
    flowState,
    dismiss,
    startUpdate,
    completeAndRestart,
    openStore,
  }
}
