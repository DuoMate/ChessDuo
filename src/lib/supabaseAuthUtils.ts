import { supabase } from './supabase'

function getUrlSafeNonce(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
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
  const { SocialLogin } = await import('@capgo/capacitor-social-login')

  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
  if (!webClientId) {
    return { success: false, error: 'Google Web Client ID not configured' }
  }

  await SocialLogin.initialize({
    google: {
      webClientId,
      mode: 'online',
    },
  })

  const rawNonce = getUrlSafeNonce()
  const nonceDigest = await sha256Hash(rawNonce)

  const loginResult = await SocialLogin.login({
    provider: 'google',
    options: {
      nonce: nonceDigest,
      scopes: ['email', 'profile'],
    },
  })

  if (!loginResult.result || loginResult.result.responseType !== 'online') {
    return { success: false, error: 'Expected online response mode from Google' }
  }

  const { idToken } = loginResult.result
  if (!idToken) {
    return { success: false, error: 'No ID token received from Google' }
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce: rawNonce,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    userId: data.user?.id,
    email: data.user?.email,
  }
}

async function authenticateWithGoogleWeb(): Promise<{
  success: boolean
  userId?: string
  email?: string
  error?: string
}> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Google sign-in failed' }
  }
}

export async function authenticateWithGoogle(): Promise<{
  success: boolean
  userId?: string
  email?: string
  error?: string
}> {
  try {
    return await authenticateWithGoogleNative()
  } catch {
    return authenticateWithGoogleWeb()
  }
}
