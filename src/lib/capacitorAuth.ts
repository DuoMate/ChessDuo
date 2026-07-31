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

export async function registerCapacitorAuthListener() {
  const isNative = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

  if (!isNative || listenerRegistered) return

  listenerRegistered = true

  function handleDeepLink(url: string) {
    if (!url || url === lastHandledUrl) return
    lastHandledUrl = url

    if (url.includes('com.navron.chessduo://auth/callback')) {
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

    // Handle /?code=X (home page with room code) — need to go through home page
    // where the auto-join effect can consume the code param
    if (targetPath.startsWith('/') && targetPath.includes('?code=')) {
      window.location.replace(targetPath)
      return
    }

    if (targetPath.startsWith('/invite/') || targetPath.startsWith('/challenge/') || targetPath.startsWith('/replay/')) {
      window.location.replace(targetPath)
      return
    }

    if (targetPath.startsWith('/duel') || targetPath.startsWith('/game') || targetPath.startsWith('/friends') || targetPath.startsWith('/profile') || targetPath.startsWith('/history') || targetPath.startsWith('/premium')) {
      window.location.replace(targetPath)
      return
    }

    window.location.replace(targetPath || '/')
  }

  try {
    const result = await App.getLaunchUrl()
    if (result?.url) {
      handleDeepLink(result.url)
    }
  } catch {
    // getLaunchUrl not supported or app was not launched via deep link
  }

  await App.addListener('appUrlOpen', async (data) => {
    handleDeepLink(data.url)
  })
}
