'use client'

import { useEffect } from 'react'

export function SplashHandler() {
  useEffect(() => {
    const hideSplash = async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
      } catch {
      }
    }
    hideSplash()

    const original = window.onerror
    window.onerror = (msg, source, line, col, err) => {
      console.error('[Global]', msg, source, line, col, err)
      try {
        const errorData = {
          message: msg,
          source,
          line,
          col,
          stack: err?.stack,
          url: window.location.href,
          time: new Date().toISOString(),
        }
        fetch('https://chessduo-fe.onrender.com/api/log-crash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorData),
        }).catch(() => {})
      } catch {
      }
      if (original) return original(msg, source, line, col, err)
      return false
    }

    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Global Unhandled]', e.reason)
    })
  }, [])

  return null
}
