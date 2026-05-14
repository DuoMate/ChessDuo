'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Profile } from '@/lib/supabase'

export function ProfileEditor({ playerId }: { playerId: string }) {
  const [profile, setProfile] = useState<{ username: string } | null>(null)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', playerId)
          .maybeSingle()
        if (data) {
          setProfile(data)
          setUsername(data.username)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [playerId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      if (profile) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ username })
          .eq('id', playerId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: playerId, username })

        if (insertError) throw insertError
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400 text-center">Loading profile...</p>

  return (
    <div className="space-y-4">
      <div className="bg-gray-700 p-4 rounded-lg">
        <label className="text-sm text-gray-400 block mb-1">Player ID</label>
        <p className="text-white font-mono text-sm truncate">{playerId}</p>
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1" htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          maxLength={30}
          className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-yellow-400 focus:outline-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {saved && <p className="text-green-400 text-sm">Profile saved!</p>}

      <button
        onClick={handleSave}
        disabled={saving || !username.trim()}
        className="w-full p-3 bg-yellow-500 text-gray-900 font-bold rounded hover:bg-yellow-400 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  )
}
