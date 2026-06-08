import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

let listenerRegistered = false

export async function registerCapacitorAuthListener() {
  const isNative = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  
  if (!isNative || listenerRegistered) return
  
  listenerRegistered = true
  
  await App.addListener('appUrlOpen', async (data) => {
    const url = data.url
    
    if (!url.includes('com.navron.chessduo://auth/callback')) return
    
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
  })
}
