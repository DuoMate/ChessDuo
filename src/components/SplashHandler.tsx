'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/errorReporter'

/**
 * Global client error capture (P0-2).
 *
 * Wires window.onerror + unhandledrejection into the centralized reporter,
 * which captures platform/version/session/route context and posts to
 * /api/log-crash (now accepting the Capacitor origin).
 *
 * `/?__crash_test=1` throws a single controlled error on mount so the full
 * Web → log-crash → app_errors pipeline can be verified on web and on a
 * physical Android device. Inert unless the query param is present.
 */
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
      reportError({
        message: String(msg),
        stack: err?.stack || '',
        errorType: 'window_error',
        source: String(source || ''),
        line: line || 0,
        col: col || 0,
      })
      if (original) return original(msg, source, line, col, err)
      return false
    }

    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Global Unhandled]', e.reason)
      reportError({
        message: String(e.reason || 'Unhandled rejection'),
        stack: e.reason instanceof Error ? e.reason.stack || '' : '',
        errorType: 'unhandled_rejection',
      })
    })

    // Optional intentional test error (verify the pipeline end-to-end).
    const params = new URLSearchParams(window.location.search)
    if (params.get('__crash_test') === '1') {
      const timeout = setTimeout(() => {
        // Throw so the real window.onerror handler (above) is exercised.
        throw new Error('CHESSDUO_CRASH_TEST ' + Date.now())
      }, 50)
      return () => clearTimeout(timeout)
    }

    return () => {}
  }, [])

  return null
}
