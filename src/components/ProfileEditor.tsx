'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function ProfileEditor({ playerId }: { playerId: string }) {
  const [username, setUsername] = useState('')
  const [editing, setEditing] = useState(false)
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
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: playerId, username }, { onConflict: 'id' })

      if (updateError) throw updateError

      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400 text-center text-sm">Loading profile...</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400">Username</label>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-gray-400 hover:text-yellow-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            maxLength={30}
            autoFocus
            className="w-full min-h-[44px] px-4 py-2 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-yellow-400 focus:outline-none text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !username.trim()}
              className="flex-1 min-h-[44px] bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="min-h-[44px] px-4 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-white font-semibold text-lg">{username}</p>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {saved && <p className="text-green-400 text-xs">Username saved!</p>}
    </div>
  )
}
