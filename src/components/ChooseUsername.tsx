'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { validateUsernameFormat } from '@/components/Auth'
import { Spinner } from '@/components/Spinner'

interface ChooseUsernameProps {
  userId: string
  suggestedName?: string
  onAuthComplete: (userId: string, username: string) => void
}

export function sanitizeDisplayName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30)
}

export function ChooseUsername({ userId, suggestedName, onAuthComplete }: ChooseUsernameProps) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (suggestedName) {
      const sanitized = sanitizeDisplayName(suggestedName)
      if (sanitized && sanitized.length >= 3) {
        setUsername(sanitized)
      }
    }
  }, [suggestedName])

  const checkUsernameAvailability = useCallback(async (name: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', name)
      .maybeSingle()
    return !data
  }, [])

  useEffect(() => {
    if (!username.trim()) {
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
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username, checkUsernameAvailability])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (usernameStatus !== 'available') return

    setLoading(true)
    setError(null)

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: username.trim()
        }, { onConflict: 'id' })

      if (profileError) {
        if (profileError.message?.includes('unique') || profileError.code === '23505') {
          setUsernameStatus('taken')
          setUsernameMessage('Username is already taken')
          setError('Username is already taken. Please choose another.')
        } else {
          setError('Failed to create profile. Please try again.')
        }
        setLoading(false)
        return
      }

      onAuthComplete(userId, username.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-yellow-600 dark:text-yellow-400">
          ChessDuo
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
          Choose your unique display name
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter a username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                required
                maxLength={30}
                autoFocus
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
                  <Spinner size="sm" />
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

          {error && (
            <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || usernameStatus !== 'available'}
            className="w-full p-3 bg-yellow-500 text-gray-900 font-bold rounded hover:bg-yellow-400 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating profile...' : 'Continue'}
          </button>
        </form>

        <p className="text-gray-500 dark:text-gray-400 text-xs text-center mt-4">
          You can change your username anytime in your profile settings.
        </p>
      </div>
    </div>
  )
}
