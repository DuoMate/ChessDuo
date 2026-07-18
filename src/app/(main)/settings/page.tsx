'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SettingsPanel } from '@/components/SettingsPanel'
import { BackButton } from '@/components/BackButton'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return
      if (session?.user) setPlayerId(session.user.id)
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) setLoading(false)
    })
  }, [])

  useCapacitorBackButton(() => { router.push('/'); return true }, true)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white flex items-center justify-center pb-20">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!playerId) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col items-center justify-center p-4 pb-20">
          <h1 className="text-2xl font-bold mb-4">Settings</h1>
          <p className="text-slate-400 mb-4">Sign in to access your settings</p>
          <BackButton label="Go Home" alwaysFallback />
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0e1a] text-white p-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <BackButton alwaysFallback />
          </div>
          <SettingsPanel onClose={() => router.push('/')} />
        </div>
      </div>
    </ErrorBoundary>
  )
}
