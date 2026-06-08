import { supabase } from './supabase'
import { Browser } from '@capacitor/browser'
import { SocialLogin } from '@capgo/capacitor-social-login'

const APP_SCHEME = 'com.navron.chessduo://auth/callback'

function getUrlSafeNonce(): string {
  const array = new Uint32Array(8)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...new Uint8Array(array.buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function sha256Hash(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function authenticateWithGoogleNative(): Promise<{
  success: boolean
  userId?: string
  email?: string
  error?: string
}> {
  try {
    const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
    if (!webClientId) {
      console.error('[NativeAuth] NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set')
      return { success: false, error: 'Google Web Client ID not configured' }
    }

    console.log('[NativeAuth] Initializing SocialLogin with webClientId:', webClientId.substring(0, 20) + '...')
    
    await SocialLogin.initialize({
      google: {
        webClientId,
        mode: 'online',
      },
    })

    console.log('[NativeAuth] SocialLogin initialized successfully')

    const rawNonce = getUrlSafeNonce()
    const nonceDigest = await sha256Hash(rawNonce)

    console.log('[NativeAuth] Calling SocialLogin.login...')
    
    const loginResult = await SocialLogin.login({
      provider: 'google',
      options: {
        nonce: nonceDigest,
        scopes: ['email', 'profile'],
      },
    })

    console.log('[NativeAuth] Login result:', JSON.stringify(loginResult, null, 2))

    if (!loginResult.result || loginResult.result.responseType !== 'online') {
      console.error('[NativeAuth] Unexpected response type:', loginResult.result?.responseType)
      return { success: false, error: 'Expected online response mode from Google' }
    }

    const { idToken } = loginResult.result
    if (!idToken) {
      console.error('[NativeAuth] No ID token in response')
      return { success: false, error: 'No ID token received from Google' }
    }

    console.log('[NativeAuth] Exchanging ID token with Supabase...')
    
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce: rawNonce,
    })

    if (error) {
      console.error('[NativeAuth] Supabase signInWithIdToken error:', error)
      return { success: false, error: error.message }
    }

    console.log('[NativeAuth] Successfully signed in with Supabase')
    
    return {
      success: true,
      userId: data.user?.id,
      email: data.user?.email,
    }
  } catch (err: any) {
    console.error('[NativeAuth] Exception:', err)
    return { success: false, error: err.message || 'Google sign-in failed' }
  }
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
    console.log('[Auth] Running on native platform, trying native SDK...')
    const nativeResult = await authenticateWithGoogleNative()
    
    if (nativeResult.success) {
      console.log('[Auth] Native SDK sign-in succeeded')
      return nativeResult
    }
    
    console.warn('[Auth] Native SDK failed:', nativeResult.error)
    console.log('[Auth] Falling back to Capacitor Browser OAuth...')
    return authenticateWithGoogleCapacitorBrowser()
  }
  
  console.log('[Auth] Running on web platform')
  return authenticateWithGoogleWeb()
}
