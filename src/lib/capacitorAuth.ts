import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

let listenerRegistered = false

function getPathFromUrl(url: string): string | null {
  try {
    if (url.startsWith('chessduo://')) {
      const path = url.slice('chessduo://'.length)
      return '/' + path.split('?')[0]
    }
    if (url.startsWith('http')) {
      const parsed = new URL(url)
      return parsed.pathname
    }
    if (url.startsWith('com.navron.chessduo://')) {
      return null
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

  await App.addListener('appUrlOpen', async (data) => {
    const url = data.url

    if (url.includes('com.navron.chessduo://auth/callback')) {
      const params = new URLSearchParams(url.split('?')[1])
      const code = params.get('code')

      if (!code) {
        console.error('[CapacitorAuth] No code in callback URL')
        return
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('[CapacitorAuth] Failed to exchange code:', error)
        }
      } catch (err) {
        console.error('[CapacitorAuth] Exception exchanging code:', err)
      }

      try {
        await Browser.close()
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

    if (path.startsWith('/duel') || path.startsWith('/game') || path.startsWith('/friends') || path.startsWith('/profile') || path.startsWith('/history')) {
      window.location.href = path
      return
    }

    window.location.href = '/'
  })
}
