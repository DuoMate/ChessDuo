'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ProfileEditor } from '@/components/ProfileEditor'
import { motion } from 'framer-motion'

export default function ProfilePage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPlayerId(session.user.id)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!playerId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <p className="text-gray-400 mb-4">Sign in to view your profile</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-yellow-400"
        >
          Go Home
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-yellow-400 text-sm"
          >
            ← Home
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 p-6 rounded-lg border border-gray-700"
        >
          <ProfileEditor playerId={playerId} />
        </motion.div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/history')}
            className="text-gray-400 hover:text-yellow-400 text-sm"
          >
            View Match History →
          </button>
        </div>
      </div>
    </div>
  )
}
