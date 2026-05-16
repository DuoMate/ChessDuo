'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { authenticateWithGoogle } from '@/lib/supabaseAuthUtils'

interface AuthProps {
  onAuthComplete: (userId: string, username: string) => void
}

export function Auth({ onAuthComplete }: AuthProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationSent, setVerificationSent] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.user.email_confirmed_at) {
        onAuthComplete(session.user.id, session.user.email?.split('@')[0] || 'Player')
      }
    })

    return () => subscription.unsubscribe()
  }, [onAuthComplete])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setVerificationSent(false)

    try {
      if (isLogin) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (authError) throw authError

        if (authData.user) {
          onAuthComplete(authData.user.id, email.split('@')[0])
        }
      } else {
        const redirectTo = `${window.location.origin}`

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
          }
        })

        if (authError) throw authError

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              username: username || email.split('@')[0]
            })

          if (profileError) {
            console.warn('Profile creation skipped:', profileError.message)
          }

          if (authData.user.identities?.length === 0) {
            setError('This email is already registered. Try signing in instead.')
          } else {
            setVerificationSent(true)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAnonymous = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInAnonymously()

      if (error) {
        console.warn('[Auth] Anonymous sign-in failed, using fallback:', error.message)
        const randomId = Math.random().toString(36).substring(2, 15)
        const anonymousUsername = `Player${randomId}`
        onAuthComplete(`anon_${randomId}`, anonymousUsername)
        return
      }

      if (data.user) {
        onAuthComplete(data.user.id, `Player${data.user.id.substring(0, 8)}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const result = await authenticateWithGoogle()
      if (result.success && result.userId) {
        onAuthComplete(result.userId, result.email?.split('@')[0] || 'Player')
      } else if (result.error) {
        setError(result.error)
        setGoogleLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-yellow-400">
          ♟️ ChessDuo
        </h1>

        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full p-3 rounded-lg border border-gray-500 bg-white text-gray-900 font-medium text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mb-5"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 border-t border-gray-600"/>
          <span className="text-gray-500 text-xs">or</span>
          <div className="flex-1 border-t border-gray-600"/>
        </div>

        <h2 className="text-xl text-center mb-6 text-white">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {verificationSent ? (
          <div className="space-y-4">
            <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-center">
              <p className="text-green-400 font-bold text-lg mb-2">✓ Check your email</p>
              <p className="text-gray-300 text-sm">
                We sent a verification link to <strong>{email}</strong>.
                Click the link in the email to complete your registration.
              </p>
            </div>
            <p className="text-gray-500 text-xs text-center">
              Didn&apos;t receive it? Check spam folder or{' '}
              <button
                onClick={() => setVerificationSent(false)}
                className="text-yellow-400 hover:underline"
              >
                try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-yellow-400 focus:outline-none"
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-yellow-400 focus:outline-none"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-yellow-400 focus:outline-none"
              required
            />

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full p-3 bg-yellow-500 text-gray-900 font-bold rounded hover:bg-yellow-400 disabled:opacity-50"
            >
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setVerificationSent(false); setError(null) }}
            className="text-gray-400 hover:text-yellow-400 text-sm"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>

        <div className="mt-6 border-t border-gray-700 pt-6">
          <p className="text-center text-gray-500 text-sm mb-3">Or play as guest</p>
          <button
            onClick={handleAnonymous}
            disabled={loading}
            className="w-full p-3 bg-gray-700 text-white font-bold rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Play as Guest
          </button>
        </div>
      </div>
    </div>
  )
}