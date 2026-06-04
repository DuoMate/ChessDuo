'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { authenticateWithGoogle } from '@/lib/supabaseAuthUtils'

const RESERVED_USERNAMES = new Set([
  'admin', 'moderator', 'system', 'chessduo', 'support', 'official',
  'help', 'bot', 'null', 'undefined', 'root', 'superuser', 'staff',
  'mod', 'owner', 'developer', 'dev', 'administrator', 'manager',
  'test', 'guest', 'anonymous', 'api', 'webmaster', 'info',
])

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/

export function validateUsernameFormat(name: string): string | null {
  if (!name.trim()) return 'Username is required'
  if (name.length < 3) return 'Username must be at least 3 characters'
  if (name.length > 30) return 'Username must be 30 characters or less'
  if (!USERNAME_REGEX.test(name)) return 'Only letters, numbers, and underscores allowed'
  if (RESERVED_USERNAMES.has(name.toLowerCase())) return 'This username is reserved'
  return null
}

interface AuthProps {
  onAuthComplete: (userId: string, username: string) => void
  defaultSignup?: boolean
  redirectUrl?: string
  onNeedUsername?: (userId: string, suggestedName: string) => void
}

export function Auth({ onAuthComplete, defaultSignup = false, redirectUrl, onNeedUsername }: AuthProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(!defaultSignup)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        fetchAndCompleteAuth(session.user.id, session.user.email || '')
      }
    })
    return () => subscription.unsubscribe()
  }, [onAuthComplete])

  const fetchAndCompleteAuth = async (userId: string, email: string, googleDisplayName?: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()
    if (data?.username) {
      onAuthComplete(userId, data.username)
    } else if (onNeedUsername) {
      const suggested = googleDisplayName || email.split('@')[0]
      onNeedUsername(userId, suggested)
    } else {
      const displayName = email.split('@')[0]
      const formatError = validateUsernameFormat(displayName)
      if (formatError) {
        onAuthComplete(userId, displayName)
        return
      }
      try {
        await supabase.from('profiles').upsert({ id: userId, username: displayName }, { onConflict: 'id' })
      } catch {}
      onAuthComplete(userId, displayName)
    }
  }

  const checkUsernameAvailability = useCallback(async (name: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', name)
      .maybeSingle()
    return !data
  }, [])

  useEffect(() => {
    if (isLogin || !username.trim()) {
      setUsernameStatus('idle')
      setUsernameMessage(null)
      return
    }

    const formatError = validateUsernameFormat(username)
    if (formatError) {
      setUsernameStatus('invalid')
      setUsernameMessage(formatError)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    setUsernameStatus('checking')
    setUsernameMessage(null)
    setCheckingUsername(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(username.trim())
        if (available) {
          setUsernameStatus('available')
          setUsernameMessage('Username is available')
        } else {
          setUsernameStatus('taken')
          setUsernameMessage('Username is already taken')
        }
      } catch {
        setUsernameStatus('idle')
        setUsernameMessage(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username, isLogin, checkUsernameAvailability])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (authError) throw authError

        if (authData.user) {
          await fetchAndCompleteAuth(authData.user.id, email)
        }
      } else {
        const desiredUsername = username.trim()
        const formatError = validateUsernameFormat(desiredUsername)
        if (formatError) {
          setError(formatError)
          setLoading(false)
          return
        }

        if (usernameStatus === 'checking') {
          setError('Please wait while we check username availability')
          setLoading(false)
          return
        }

        if (usernameStatus === 'taken') {
          setError(`Username "${desiredUsername}" is already taken. Choose another.`)
          setLoading(false)
          return
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: desiredUsername },
          }
        })

        if (authError) throw authError

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              username: desiredUsername
            }, { onConflict: 'id' })

          if (profileError) {
            if (profileError.message?.includes('unique') || profileError.code === '23505') {
              setError(`Username "${desiredUsername}" is already taken. Choose another.`)
            } else {
              setError('Failed to create profile. Please try again.')
            }
            setLoading(false)
            return
          }

          if (authData.user.identities?.length === 0) {
            setError('This email is already registered. Try signing in instead.')
          } else {
            await fetchAndCompleteAuth(authData.user.id, email)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
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
        await fetchAndCompleteAuth(result.userId, result.email || '', result.displayName)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  const canSubmit = isLogin
    ? email.trim() && password.length >= 6
    : email.trim() && password.length >= 6 && usernameStatus === 'available'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-yellow-600 dark:text-yellow-400">
          ChessDuo
        </h1>

        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-white text-gray-900 font-medium text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mb-5"
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
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"/>
          <span className="text-gray-500 text-xs">or</span>
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"/>
        </div>

        <h2 className="text-xl text-center mb-6 text-gray-900 dark:text-white">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  required
                  maxLength={30}
                  autoComplete="username"
                  className={`w-full p-3 pr-10 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded border focus:outline-none transition-colors ${
                    usernameStatus === 'available'
                      ? 'border-green-500 focus:border-green-400'
                      : usernameStatus === 'taken' || usernameStatus === 'invalid'
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:border-yellow-400'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {usernameStatus === 'available' && (
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && username.trim() && (
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              </div>
              {usernameMessage && username.trim() && (
                <p className={`text-xs mt-1 ${
                  usernameStatus === 'available' ? 'text-green-500' : 'text-red-500 dark:text-red-400'
                }`}>
                  {usernameMessage}
                </p>
              )}
              {!usernameMessage && !username.trim() && (
                <p className="text-gray-500 text-xs mt-1">
                  3-30 characters, letters, numbers, and underscores only
                </p>
              )}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-yellow-400 focus:outline-none"
            required
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-yellow-400 focus:outline-none"
            required
            minLength={6}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />

          {error && (
            <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || checkingUsername || !canSubmit}
            className="w-full p-3 bg-yellow-500 text-gray-900 font-bold rounded hover:bg-yellow-400 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null); setUsernameStatus('idle'); setUsernameMessage(null) }}
            className="text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 text-sm"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}
