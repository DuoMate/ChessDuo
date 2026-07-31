import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

let listenerRegistered = false

function getPathFromUrl(url: string): string | null {
  try {
    if (url.startsWith('chessduo://')) {
      const rest = url.slice('chessduo://'.length)
      const q = rest.includes('?') ? '?' + rest.split('?')[1] : ''
      return '/' + rest.split('?')[0] + q
    }
    if (url.startsWith('http')) {
      const parsed = new URL(url)
      return parsed.pathname + parsed.search
    }
    if (url.startsWith('com.navron.chessduo://')) {
      const rest = url.slice('com.navron.chessduo://'.length)
      const q = rest.includes('?') ? '?' + rest.split('?')[1] : ''
      return '/' + rest.split('?')[0] + q
    }
    return null
  } catch {
    return null
  }
}

export async function registerCapacitorAuthListener() {
  const isNative = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

  if (!isNative || listenerRegistered) return

  listenerRegistered = true

  function handleDeepLink(url: string) {
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

    if (path.startsWith('/invite/') || path.startsWith('/challenge/') || path.startsWith('/replay/')) {
      window.location.href = path
      return
    }

    if (path.startsWith('/duel') || path.startsWith('/game') || path.startsWith('/friends') || path.startsWith('/profile') || path.startsWith('/history') || path.startsWith('/premium')) {
      window.location.href = path
      return
    }

    window.location.href = path || '/'
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
