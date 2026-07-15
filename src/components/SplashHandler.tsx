'use client'

import { useEffect } from 'react'

export function SplashHandler() {
  useEffect(() => {
    const hideSplash = async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
      } catch {
        // Not running in Capacitor environment
      }
    }
    hideSplash()

    const original = window.onerror
    window.onerror = (msg, source, line, col, err) => {
      console.error('[Global]', msg, source, line, col, err)
      try {
        const errorData = {
          message: String(msg),
          source: String(source || ''),
          line: line || 0,
          col: col || 0,
          stack: err?.stack || '',
          url: window.location.href,
          time: new Date().toISOString(),
        }
        fetch('/api/log-crash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorData),
        }).catch(() => {
          // crash-report delivery is best-effort; suppress network failures
        })
      } catch {
        // Ignore crash-report fetch failures
      }
      if (original) return original(msg, source, line, col, err)
      return false
    }

    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Global Unhandled]', e.reason)
      try {
        fetch('/api/log-crash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: String(e.reason || 'Unhandled rejection'),
            url: window.location.href,
            time: new Date().toISOString(),
          }),
        }).catch(() => {})
      } catch { /* suppress */ }
    })
  }, [])

  return null
}
