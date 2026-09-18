'use client'

import { useCallback, useEffect, useState } from 'react'
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

const DISMISS_KEY = 'chessduo_update_dismissed_for'
const CHECK_DELAY_MS = 2500

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
  dismiss: () => void
  openStore: () => Promise<void>
}

/**
 * Fail-silent Play Store update check (native Android only).
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

  const dismiss = useCallback(() => {
    try {
      const key = manifest ? String(manifest.latestVersionCode) : 'unknown'
      sessionStorage.setItem(DISMISS_KEY, key)
    } catch {
      // storage unavailable — prompt simply reappears next session
    }
    setStatus('current')
  }, [manifest])

  const openStore = useCallback(async () => {
    const url = manifest?.playUrl
    try {
      await openPlayListing()
    } catch {
      // best-effort — the Play listing owns the flow from here
    }
    if (!url) return
  }, [manifest])

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

  return { status, manifest, installedVersion, dismiss, openStore }
}
