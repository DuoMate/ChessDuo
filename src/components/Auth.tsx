'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react'
import ChessDuoLogo from '@/components/ChessDuoLogo'
import { supabase } from '@/lib/supabase'
import { authenticateWithGoogle } from '@/lib/supabaseAuthUtils'
import { Spinner } from '@/components/Spinner'

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
  onClose?: () => void
}

export function Auth({ onAuthComplete, defaultSignup = false, redirectUrl, onNeedUsername, onClose }: AuthProps) {
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
  const [initialSessionChecked, setInitialSessionChecked] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authCompletedRef = useRef<string | null>(null)
  const googleAuthInProgressRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchAndCompleteAuth(session.user.id, session.user.email || '', session.user.user_metadata?.full_name || session.user.user_metadata?.name, session.user.user_metadata?.avatar_url || null)
      } else {
        setInitialSessionChecked(true)
      }
    }).catch(() => {
      setInitialSessionChecked(true)
    })
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        fetchAndCompleteAuth(session.user.id, session.user.email || '', session.user.user_metadata?.full_name || session.user.user_metadata?.name, session.user.user_metadata?.avatar_url || null)
      }
    })
    return () => subscription.unsubscribe()
  }, [onAuthComplete])

  const fetchAndCompleteAuth = async (userId: string, email: string, googleDisplayName?: string, googleAvatarUrl?: string | null) => {
    if (authCompletedRef.current === userId) return
    authCompletedRef.current = userId
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()
    if (data?.username) {
      if (googleAvatarUrl || googleDisplayName) {
        try { await supabase.from('profiles').upsert({ id: userId, avatar_url: googleAvatarUrl || undefined, display_name: googleDisplayName || undefined }, { onConflict: 'id' }) } catch { /* best effort */ }
      }
      onAuthComplete(userId, data.username)
      if (googleAuthInProgressRef.current) {
        setGoogleLoading(false)
        googleAuthInProgressRef.current = false
      }
    } else if (onNeedUsername) {
      const suggested = googleDisplayName || email.split('@')[0]
      onNeedUsername(userId, suggested)
      if (googleAuthInProgressRef.current) {
        setGoogleLoading(false)
        googleAuthInProgressRef.current = false
      }
    } else {
      const displayName = email.split('@')[0]
      const formatError = validateUsernameFormat(displayName)
      if (formatError) {
        onAuthComplete(userId, displayName)
        if (googleAuthInProgressRef.current) {
          setGoogleLoading(false)
          googleAuthInProgressRef.current = false
        }
        return
      }
      try {
        await supabase.from('profiles').upsert({ id: userId, username: displayName, avatar_url: googleAvatarUrl || undefined }, { onConflict: 'id' })
      } catch { console.error('[Auth] Failed to upsert profile') }
      onAuthComplete(userId, displayName)
      if (googleAuthInProgressRef.current) {
        setGoogleLoading(false)
        googleAuthInProgressRef.current = false
      }
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
    googleAuthInProgressRef.current = true
    try {
      const result = await authenticateWithGoogle()
      if (result.success && result.userId) {
        // Dismiss Google loading immediately — profile query runs in background
        setGoogleLoading(false)
        googleAuthInProgressRef.current = false
        await fetchAndCompleteAuth(result.userId, result.email || '', result.displayName, result.avatarUrl)
      } else if (result.error) {
        setError(result.error)
        setGoogleLoading(false)
        googleAuthInProgressRef.current = false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setGoogleLoading(false)
      googleAuthInProgressRef.current = false
    }
  }

  const canSubmit = isLogin
    ? email.trim() && password.length >= 6
    : email.trim() && password.length >= 6 && usernameStatus === 'available'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.16),_transparent_28%)] px-4 py-6 sm:px-6">
      {googleLoading || !initialSessionChecked ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-white/80 p-10 shadow-[0_20px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-[0_20px_80px_rgba(2,6,23,0.36)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-400/15 via-transparent to-indigo-500/15" />
          <div className="relative flex flex-col items-center text-center">
            <ChessDuoLogo size="lg" />
            <div className="mt-8">
              <Spinner size="lg" />
            </div>
            <p className="mt-5 text-base font-semibold text-slate-900 dark:text-white">
              {googleLoading ? 'Signing in with Google' : 'Checking session...'}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {googleLoading ? 'Complete sign-in in your browser' : 'Please wait'}
            </p>
          </div>
        </motion.div>
      ) : (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-[0_20px_80px_rgba(2,6,23,0.36)] sm:p-8"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label="Close sign in"
          >
            <X size={16} className="text-slate-400 dark:text-slate-500" />
          </button>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-400/15 via-transparent to-indigo-500/15" />
        <div className="relative">
          <div className="mb-6 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-700 dark:text-blue-300">
              <Sparkles size={12} />
              Multiplayer Tag Team Chess
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <ChessDuoLogo size="lg" />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {isLogin ? 'Sign in to continue your match.' : 'Create your account and invite a teammate.'}
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700/80"
          >
            <svg className="h-5 w-5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.54 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.78l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {googleLoading ? 'Connecting...' : 'Sign in with Google'}
          </motion.button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <h2 className="mb-5 text-center text-xl font-semibold text-slate-900 dark:text-white">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="username">
                  Username
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    required
                    maxLength={30}
                    autoComplete="username"
                    className={`w-full rounded-2xl border bg-slate-50/80 py-3 pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition-all focus:ring-2 dark:bg-slate-800/70 dark:text-slate-100 ${
                      usernameStatus === 'available'
                        ? 'border-emerald-500 focus:border-emerald-400 focus:ring-emerald-500/20'
                        : usernameStatus === 'taken' || usernameStatus === 'invalid'
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/20'
                          : 'border-slate-200 focus:border-amber-500 focus:ring-amber-500/20 dark:border-slate-700'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === 'checking' && (
                      <Spinner size="sm" />
                    )}
                    {usernameStatus === 'available' && (
                      <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && username.trim() && (
                      <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                </div>
                {usernameMessage && username.trim() && (
                  <p className={`mt-1 text-xs ${usernameStatus === 'available' ? 'text-emerald-500' : 'text-rose-500 dark:text-rose-400'}`}>
                    {usernameMessage}
                  </p>
                )}
                {!usernameMessage && !username.trim() && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    3-30 characters, letters, numbers, and underscores only
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100"
                  required
                  minLength={6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <ShieldCheck size={15} />
                <span>{error}</span>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || checkingUsername || !canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); setUsernameStatus('idle'); setUsernameMessage(null) }}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </motion.div>
      )}
    </div>
  )
}
