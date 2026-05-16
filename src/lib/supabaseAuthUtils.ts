import { supabase } from './supabase'

async function authenticateWithGoogleNative(): Promise<{
  success: boolean
  userId?: string
  email?: string
  error?: string
}> {
  const nativePath = './supa' + 'baseAuthUtils.native'
  const { authenticateWithGoogleNative: nativeFn } = await import(nativePath)
  return nativeFn()
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
