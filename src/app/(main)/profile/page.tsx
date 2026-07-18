'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProfileEditor } from '@/components/ProfileEditor'
import { BackButton } from '@/components/BackButton'
import { motion } from 'framer-motion'
import { InitialsAvatar } from '@/components/InitialsAvatar'

export default function ProfilePage() {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } }) => {
      if (!mountedRef.current) return
      const session = result.data.session
      if (session?.user) {
        setPlayerId(session.user.id)
      }
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!playerId) return
    supabase
      .from('profiles')
      .select('username')
      .eq('id', playerId)
      .maybeSingle()
      .then((result) => {
        if (!mountedRef.current) return
        if (result.data?.username) setUsername(result.data.username)
      }).catch(() => {})
  }, [playerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white flex items-center justify-center pb-20">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!playerId) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col items-center justify-center p-4 pb-20">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <p className="text-slate-400 mb-4">Sign in to view your profile</p>
        <BackButton label="Go Home" alwaysFallback />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0e1a] text-white p-4 pb-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Profile</h1>
            <BackButton alwaysFallback />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Profile Card */}
            <div className="p-6 bg-slate-800/50 border border-white/5 rounded-2xl flex flex-col items-center">
              <InitialsAvatar username={username || 'U'} size="lg" />
              <div className="mt-4 w-full">
                <ProfileEditor playerId={playerId} />
              </div>
            </div>

            <div className="text-center">
              <BackButton label="Go Home" alwaysFallback />
            </div>
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
