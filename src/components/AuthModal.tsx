'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onAuthComplete: (userId: string, username: string) => void
}

export function AuthModal({ open, onClose, onAuthComplete }: AuthModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationSent, setVerificationSent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}`
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (googleError) throw googleError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setVerificationSent(false)

    try {
      if (isLogin) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (authError) throw authError
        if (authData.user) {
          onAuthComplete(authData.user.id, email.split('@')[0])
          onClose()
        }
      } else {
        const redirectTo = `${window.location.origin}`
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        })
        if (authError) throw authError
        if (authData.user) {
          await supabase.from('profiles').insert({
            id: authData.user.id,
            username: username || email.split('@')[0],
          })
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

  const handleGuest = async () => {
    setLoading(true)
    try {
      const { data, error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) {
        const randomId = Math.random().toString(36).substring(2, 15)
        onAuthComplete(`anon_${randomId}`, `Player${randomId}`)
        onClose()
        return
      }
      if (data.user) {
        onAuthComplete(data.user.id, `Player${data.user.id.substring(0, 8)}`)
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  ♟️ ChessDuo
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white text-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <p className="text-xl text-center mb-5 text-white font-bold">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </p>

              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full p-3 rounded-lg border border-gray-500 bg-white text-gray-900 font-medium text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {googleLoading ? 'Connecting...' : 'Sign in with Google'}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 border-t border-gray-600" />
                <span className="text-gray-500 text-xs">or</span>
                <div className="flex-1 border-t border-gray-600" />
              </div>

              {verificationSent ? (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-center mb-4">
                  <p className="text-green-400 font-bold mb-1">✓ Check your email</p>
                  <p className="text-gray-300 text-sm">
                    We sent a verification link to <strong>{email}</strong>.
                  </p>
                  <button
                    onClick={() => setVerificationSent(false)}
                    className="text-yellow-400 hover:underline text-xs mt-2"
                  >
                    try again
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  {!isLogin && (
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-400 focus:outline-none text-sm"
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-400 focus:outline-none text-sm"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-400 focus:outline-none text-sm"
                    required
                  />
                  {error && (
                    <p className="text-red-400 text-xs">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full p-3 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 text-sm transition-colors"
                  >
                    {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
                  </button>
                </form>
              )}

              <div className="mt-3 text-center">
                <button
                  onClick={() => { setIsLogin(!isLogin); setVerificationSent(false); setError(null) }}
                  className="text-gray-400 hover:text-yellow-400 text-xs"
                >
                  {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                </button>
              </div>

              <div className="mt-4 border-t border-gray-700 pt-4 text-center">
                <button
                  onClick={handleGuest}
                  disabled={loading}
                  className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                >
                  Play as Guest
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
