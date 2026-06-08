import { supabase } from './supabase'
import { Browser } from '@capacitor/browser'

const APP_SCHEME = 'com.navron.chessduo://auth/callback'

async function authenticateWithGoogleNative(): Promise<{
  success: boolean
  userId?: string
  email?: string
  displayName?: string
  error?: string
}> {
  const nativePath = './supa' + 'baseAuthUtils.native'
  const { authenticateWithGoogleNative: nativeFn } = await import(nativePath)
  return nativeFn()
}

async function authenticateWithGoogleCapacitorBrowser(): Promise<{
  success: boolean
  userId?: string
  email?: string
  displayName?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: APP_SCHEME,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) return { success: false, error: error.message }
    if (!data?.url) return { success: false, error: 'No OAuth URL returned' }

    await Browser.open({ url: data.url })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Capacitor Browser sign-in failed' }
  }
}

async function authenticateWithGoogleWeb(): Promise<{
  success: boolean
  userId?: string
  email?: string
  displayName?: string
  error?: string
}> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Google sign-in failed' }
  }
}

export async function authenticateWithGoogle(): Promise<{
  success: boolean
  userId?: string
  email?: string
  displayName?: string
  error?: string
}> {
  const isNative = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  if (isNative) {
    try {
      const result = await authenticateWithGoogleNative()
      if (result.success) return result
    } catch {
      // Native SDK unavailable — fall through to Capacitor Browser OAuth
    }
    return authenticateWithGoogleCapacitorBrowser()
  }
  return authenticateWithGoogleWeb()
}
