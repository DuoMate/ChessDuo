'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchProfile, updateProfile } from '@/lib/profileService'
import { validateUsernameFormat } from '@/components/Auth'
import { Spinner } from '@/components/Spinner'

export function ProfileEditor({ playerId }: { playerId: string }) {
  const [username, setUsername] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await fetchProfile(playerId)
        if (profile.username) {
          setUsername(profile.username)
          setOriginalUsername(profile.username)
        }
      } catch { /* supabase query may fail — fallback to empty profile */ } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [playerId])

  const checkUsernameAvailability = useCallback(async (name: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', name)
      .neq('id', playerId)
      .maybeSingle()
    return !data
  }, [playerId])

  useEffect(() => {
    if (!editing || !username.trim() || username === originalUsername) {
      if (!editing) {
        setUsernameStatus('idle')
        setUsernameMessage(null)
      }
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
  }, [username, editing, originalUsername, checkUsernameAvailability])

  const handleSave = async () => {
    if (usernameStatus !== 'available' && username !== originalUsername) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const success = await updateProfile(playerId, {
        username: username.trim(),
        username_lower: username.trim().toLowerCase()
      })

      if (!success) throw new Error('Update failed')

      setOriginalUsername(username.trim())
      setSaved(true)
      setEditing(false)
      setUsernameStatus('idle')
      setUsernameMessage(null)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setUsername(originalUsername)
    setEditing(false)
    setError(null)
    setUsernameStatus('idle')
    setUsernameMessage(null)
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner size="md" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between min-h-[44px]">
        <label className="text-sm text-gray-400">Username</label>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="Enter username"
              maxLength={30}
              autoFocus
              className={`w-full min-h-[44px] px-4 py-2 pr-10 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl border focus:outline-none text-sm transition-colors ${
                usernameStatus === 'available'
                  ? 'border-green-500 focus:border-green-400'
                  : usernameStatus === 'taken' || usernameStatus === 'invalid'
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-gray-600 focus:border-yellow-600 dark:focus:border-yellow-400'
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && (
                <Spinner size="sm" />
              )}
              {usernameStatus === 'available' && (
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && username.trim() && username !== originalUsername && (
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </div>
          {usernameMessage && username.trim() && username !== originalUsername && (
            <p className={`text-xs ${
              usernameStatus === 'available' ? 'text-green-500' : 'text-red-500 dark:text-red-400'
            }`}>
              {usernameMessage}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || (username !== originalUsername && usernameStatus !== 'available')}
              className="flex-1 min-h-[44px] bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="min-h-[44px] px-4 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-900 dark:text-white font-semibold text-lg">{username}</p>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {saved && <p className="text-green-400 text-xs">Username saved!</p>}
    </div>
  )
}
