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
    const webClientId = process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
    if (!webClientId) {
      console.error('[NativeAuth] Google Client ID is not set')
      return { success: false, error: 'Google Client ID not configured. Set NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in env.' }
    }

    console.log('[NativeAuth] webClientId:', webClientId.substring(0, 25) + '...')
    
    // Check if SocialLogin plugin is available
    if (typeof SocialLogin === 'undefined') {
      console.error('[NativeAuth] SocialLogin plugin is not available')
      return { success: false, error: 'SocialLogin plugin not installed. Run: npm install @capgo/capacitor-social-login && npx cap sync' }
    }

    console.log('[NativeAuth] Initializing SocialLogin...')
    
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
      const responseType = loginResult.result?.responseType || 'null'
      console.error('[NativeAuth] Unexpected response type:', responseType)
      return { success: false, error: `Google returned response type "${responseType}" instead of "online". Check SHA-1 fingerprint in Google Cloud Console.` }
    }

    const { idToken } = loginResult.result
    if (!idToken) {
      console.error('[NativeAuth] No ID token in response')
      return { success: false, error: 'No ID token received from Google. Check SHA-1 fingerprint and package name in Google Cloud Console.' }
    }

    console.log('[NativeAuth] Exchanging ID token with Supabase...')
    
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce: rawNonce,
    })

    if (error) {
      console.error('[NativeAuth] Supabase signInWithIdToken error:', error)
      return { success: false, error: `Supabase error: ${error.message}` }
    }

    console.log('[NativeAuth] Successfully signed in with Supabase')
    
    return {
      success: true,
      userId: data.user?.id,
      email: data.user?.email,
    }
  } catch (err: any) {
    console.error('[NativeAuth] Exception:', err)
    const msg = err.message || err.toString() || 'Unknown error'
    return { success: false, error: `Native SDK error: ${msg}` }
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
    
    console.error('[Auth] Native SDK failed:', nativeResult.error)
    
    // Show error alert on native so user can see what's wrong
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`Native Google Sign-In failed:\n\n${nativeResult.error}\n\nFalling back to browser sign-in...`)
    }
    
    console.log('[Auth] Falling back to Capacitor Browser OAuth...')
    return authenticateWithGoogleCapacitorBrowser()
  }
  
  console.log('[Auth] Running on web platform')
  return authenticateWithGoogleWeb()
}
