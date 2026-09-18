'use client'

import { memo, useEffect, useState } from 'react'
import { getBundledVersion, formatVersionLabel } from '@/lib/appVersionInfo'

/**
 * Small version identifier for Settings/About surfaces.
 * Shows the bundled release (e.g. "ChessDuo · Version 1.0.386").
 * On native, upgrades to the installed App.getInfo() version when available.
 */
function AppVersionLabelInner() {
  const [label, setLabel] = useState(() =>
    formatVersionLabel(getBundledVersion().version),
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        if (!cancelled && info?.version) {
          setLabel(formatVersionLabel(info.version))
        }
      } catch {
        // web or plugin unavailable — keep the build stamp
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!label) return null

  return (
    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
      ChessDuo · {label}
    </p>
  )
}

export const AppVersionLabel = memo(AppVersionLabelInner)
