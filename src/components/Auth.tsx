'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authCompletedRef = useRef<string | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        fetchAndCompleteAuth(session.user.id, session.user.email || '')
      }
    })
    return () => subscription.unsubscribe()
  }, [onAuthComplete])

  const fetchAndCompleteAuth = async (userId: string, email: string, googleDisplayName?: string) => {
    if (authCompletedRef.current === userId) return
    authCompletedRef.current = userId
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
      } catch { console.error('[Auth] Failed to upsert profile') }
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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.16),_transparent_28%)] px-4 py-6 sm:px-6">
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-400/15 via-transparent to-indigo-500/15" />
        <div className="relative">
          <div className="mb-6 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">
              <Sparkles size={12} />
              Multiplayer Tag Team Chess
            </div>
          </div>

          <div className="text-center">
            <h1 className="bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-500 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
              ChessDuo
            </h1>
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
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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
    </div>
  )
}
