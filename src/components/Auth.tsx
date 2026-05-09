'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AuthProps {
  onAuthComplete: (userId: string, username: string) => void
}

export function Auth({ onAuthComplete }: AuthProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          onAuthComplete(authData.user.id, email.split('@')[0])
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password
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

          onAuthComplete(authData.user.id, username || email.split('@')[0])
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
      const randomId = Math.random().toString(36).substring(2, 15)
      const anonymousUsername = `Player${randomId}`
      onAuthComplete(`anon_${randomId}`, anonymousUsername)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-yellow-400">
          ♟️ ChessDuo
        </h1>

        <h2 className="text-xl text-center mb-6 text-white">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

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

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
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