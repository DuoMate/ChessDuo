import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

let listenerRegistered = false

export function getPathFromUrl(url: string): string | null {
  try {
    if (url.startsWith('chessduo://')) {
      let rest = url.slice('chessduo://'.length)
      rest = rest.replace(/^\/+/, '')
      const q = rest.includes('?') ? '?' + rest.split('?')[1] : ''
      return '/' + rest.split('?')[0] + q
    }
    if (url.startsWith('http')) {
      const parsed = new URL(url)
      return parsed.pathname + parsed.search
    }
    if (url.startsWith('com.navron.chessduo://')) {
      let rest = url.slice('com.navron.chessduo://'.length)
      rest = rest.replace(/^\/+/, '')
      const q = rest.includes('?') ? '?' + rest.split('?')[1] : ''
      return '/' + rest.split('?')[0] + q
    }
    return null
  } catch {
    return null
  }
}

let lastHandledUrl = ''

interface RegisterOptions {
  /** Client-side router navigate function (e.g. router.replace). Used for
   *  warm opens so the app does not do a full page reload. */
  navigate?: (path: string) => void
}

export async function registerCapacitorAuthListener(opts?: RegisterOptions) {
  const isNative = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

  if (!isNative || listenerRegistered) return

  listenerRegistered = true

  const isOAuthCallback = (url: string) =>
    url.includes('com.navron.chessduo://auth/callback') || url.includes('chessduo://auth/callback')

  function handleDeepLink(url: string, allowClientNav: boolean) {
    if (!url) return
    // Normalize before dedupe so the same logical target from different raw
    // schemes is treated once.
    const normalized = getPathFromUrl(url) || url
    if (normalized === lastHandledUrl) return
    lastHandledUrl = normalized

    if (isOAuthCallback(url)) {
      const params = new URLSearchParams(url.split('?')[1])
      const code = params.get('code')

      if (!code) {
        console.error('[CapacitorAuth] No code in callback URL')
        return
      }

      try {
        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (error) console.error('[CapacitorAuth] Failed to exchange code:', error)
        })
      } catch (err) {
        console.error('[CapacitorAuth] Exception exchanging code:', err)
      }

      try {
        Browser.close()
      } catch {
        // browser may already be closed
      }
      return
    }

    const path = getPathFromUrl(url)
    if (!path) return

    // Map /join?code=X to /?code=X (invite deep-links — no dedicated /join route)
    let targetPath = path
    if (path.startsWith('/join')) {
      const joinParams = path.includes('?') ? path.substring(path.indexOf('?')) : ''
      targetPath = `/${joinParams}`
    }

    // Skip navigation if already at target
    const currentPath = window.location.pathname + window.location.search
    if (currentPath === targetPath) return

    // Cold start must use full reload to bootstrap the app shell.
    // Warm appUrlOpen should use the provided router navigate to avoid
    // tearing down the JS context and losing realtime state.
    const navigate = allowClientNav && opts?.navigate
      ? opts.navigate
      : (p: string) => window.location.replace(p)

    // These paths need a full reload when no router is available.
    const needsReload = !opts?.navigate

    if (targetPath.startsWith('/') && targetPath.includes('?code=')) {
      navigate(targetPath)
      return
    }

    if (targetPath.startsWith('/invite/') || targetPath.startsWith('/challenge/') || targetPath.startsWith('/replay/')) {
      // These dynamic routes have no pre-rendered HTML in the static-export
      // APK (generateStaticParams only emits a `placeholder` entry), so a full
      // window.location.replace would 404 on the local Capacitor server. Prefer
      // the client router when available — getLaunchUrl() resolves after
      // Providers has mounted it, so this is safe even on cold start.
      if (opts?.navigate) opts.navigate(targetPath)
      else window.location.replace(targetPath)
      return
    }

    if (targetPath.startsWith('/duel') || targetPath.startsWith('/game') || targetPath.startsWith('/friends') || targetPath.startsWith('/profile') || targetPath.startsWith('/history') || targetPath.startsWith('/premium')) {
      navigate(targetPath)
      return
    }

    navigate(targetPath || '/')
  }

  try {
    const result = await App.getLaunchUrl()
    if (result?.url) {
      handleDeepLink(result.url, false)
    }
  } catch {
    // getLaunchUrl not supported or app was not launched via deep link
  }

  await App.addListener('appUrlOpen', async (data) => {
    handleDeepLink(data.url, true)
  })
}
