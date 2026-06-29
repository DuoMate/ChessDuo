import { supabase } from './supabase'
import { Browser } from '@capacitor/browser'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { DEBUG } from './debug'

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
  cancelled?: boolean
  userId?: string
  email?: string
  error?: string
}> {
  try {
    const rawId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
    if (!rawId) {
      console.error('[NativeAuth] Google Web Client ID is not set')
      return { success: false, error: 'Google Web Client ID not configured. Set NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID in env.' }
    }

    // Defensive cleanup: strip https:// prefix and trailing slash
    const webClientId = rawId
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .trim()

    DEBUG && console.log('[NativeAuth] Web Client ID is configured')
    
    // Check if SocialLogin plugin is available
    if (typeof SocialLogin === 'undefined') {
      console.error('[NativeAuth] SocialLogin plugin is not available')
      return { success: false, error: 'SocialLogin plugin not installed. Run: npm install @capgo/capacitor-social-login && npx cap sync' }
    }

    DEBUG && console.log('[NativeAuth] Initializing SocialLogin...')
    
    await SocialLogin.initialize({
      google: {
        webClientId,
        mode: 'online',
      },
    })

    DEBUG && console.log('[NativeAuth] SocialLogin initialized successfully')

    const rawNonce = getUrlSafeNonce()
    const nonceDigest = await sha256Hash(rawNonce)

    DEBUG && console.log('[NativeAuth] Calling SocialLogin.login...')
    
    const loginResult = await SocialLogin.login({
      provider: 'google',
      options: {
        nonce: nonceDigest,
      },
    })

    DEBUG && console.log('[NativeAuth] Login completed')

    // Check for cancellation or error
    const result = loginResult.result as any
    if (!result) {
      console.error('[NativeAuth] No result from SocialLogin.login')
      return { success: false, error: 'Google Sign-In returned no result. Check Google Cloud Console: enable Google Sign-In API and configure OAuth consent screen.' }
    }

    const responseType = result.responseType || 'null'
    if (responseType === 'cancel') {
      return { success: false, cancelled: true }
    }

    if (responseType !== 'online') {
      console.error('[NativeAuth] Unexpected response type:', responseType)
      return { success: false, error: `Google returned response type "${responseType}" instead of "online". Check Google Cloud Console configuration.` }
    }

    const { idToken } = result
    if (!idToken) {
      console.error('[NativeAuth] No ID token in response')
      return { success: false, error: 'No ID token received from Google. Check SHA-1 fingerprint and package name in Google Cloud Console.' }
    }

    DEBUG && console.log('[NativeAuth] Exchanging ID token with Supabase...')
    
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce: rawNonce,
    })

    if (error) {
      console.error('[NativeAuth] Supabase signInWithIdToken error:', error)
      return { success: false, error: `Supabase error: ${error.message}` }
    }

    DEBUG && console.log('[NativeAuth] Successfully signed in with Supabase')
    
    return {
      success: true,
      userId: data.user?.id,
      email: data.user?.email,
    }
  } catch (err: any) {
    console.error('[NativeAuth] Exception:', err)
    const code = err.code ? ` (${err.code})` : ''
    const msg = err.message || err.toString() || 'Unknown error'
    return { success: false, error: `Native SDK error: ${msg}${code}` }
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
          prompt: 'select_account consent',
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
        redirectTo: window.location.href,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account consent',
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
    DEBUG && console.log('[Auth] Running on native platform, trying native SDK...')
    const nativeResult = await authenticateWithGoogleNative()
    
    if (nativeResult.success) {
      DEBUG && console.log('[Auth] Native SDK sign-in succeeded')
      return nativeResult
    }
    
    // Silently return on user cancellation — no popup, no fallback
    if (nativeResult.cancelled) {
      return { success: false, error: '' }
    }
    
    console.error('[Auth] Native SDK failed:', nativeResult.error)
    
    // Show error alert on native so user can see what's wrong
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`Native Google Sign-In failed:\n\n${nativeResult.error}\n\nFalling back to browser sign-in...`)
    }
    
    DEBUG && console.log('[Auth] Falling back to Capacitor Browser OAuth...')
    return authenticateWithGoogleCapacitorBrowser()
  }
  
  DEBUG && console.log('[Auth] Running on web platform')
  return authenticateWithGoogleWeb()
}
