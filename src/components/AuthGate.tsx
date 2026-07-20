'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Auth } from './Auth'
import { ChooseUsername } from './ChooseUsername'
import { BackButton } from './BackButton'
import { Spinner } from './Spinner'
import { ErrorBoundary } from './ErrorBoundary'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

interface AuthGateProps {
  pageTitle: string
  pageEmoji?: string
  subtitle?: string
  children: (playerId: string) => React.ReactNode
}

export function AuthGate({ pageTitle, pageEmoji, subtitle, children }: AuthGateProps) {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authDismissed, setAuthDismissed] = useState(false)
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string; avatarUrl?: string | null } | null>(null)
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
      if (!mountedRef.current) return
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return
      if (session?.user) {
        setPlayerId(session.user.id)
        setAuthDismissed(false)
      } else {
        setPlayerId(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useCapacitorBackButton(() => {
    if (needsUsername) return true
    if (!playerId) { router.push('/'); return true }
    return false
  }, !playerId || !!needsUsername)

  const handleAuthComplete = (userId: string) => {
    setPlayerId(userId)
    setAuthDismissed(false)
    setNeedsUsername(null)
  }

  const handleNeedUsername = (userId: string, suggestedName: string, avatarUrl?: string | null) => {
    setNeedsUsername({ userId, suggestedName, avatarUrl })
  }

  const handleUsernameChosen = (userId: string) => {
    setNeedsUsername(null)
    setPlayerId(userId)
  }

  const handleAuthClose = () => {
    setAuthDismissed(true)
  }

  if (loading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#0a0e1a] text-white flex items-center justify-center pb-20">
          <Spinner size="md" />
        </div>
      </ErrorBoundary>
    )
  }

  if (playerId) {
    return <>{children(playerId)}</>
  }

  if (needsUsername) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#0a0e1a] text-white flex items-center justify-center p-4 pb-20">
          <div className="w-full max-w-md">
            <ChooseUsername
              userId={needsUsername.userId}
              suggestedName={needsUsername.suggestedName}
              avatarUrl={needsUsername.avatarUrl}
              onAuthComplete={handleUsernameChosen}
            />
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  if (authDismissed) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col items-center justify-center p-4 pb-20">
          {pageEmoji && <div className="text-5xl mb-3">{pageEmoji}</div>}
          <h1 className="text-2xl font-bold mb-4">{pageTitle}</h1>
          <p className="text-slate-400 mb-6">{subtitle || 'Sign in to access this page'}</p>
          <button
            onClick={() => setAuthDismissed(false)}
            className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors mb-4"
          >
            Sign In
          </button>
          <BackButton label="Go Home" alwaysFallback />
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col items-center justify-center p-4 pb-20">
        {pageEmoji && <div className="text-5xl mb-3">{pageEmoji}</div>}
        <h1 className="text-2xl font-bold mb-2">{pageTitle}</h1>
        {subtitle && <p className="text-slate-400 mb-2">{subtitle}</p>}
        <div className="w-full max-w-md mt-4">
          <Auth
            onAuthComplete={handleAuthComplete}
            onNeedUsername={handleNeedUsername}
            onClose={handleAuthClose}
          />
        </div>
      </div>
    </ErrorBoundary>
  )
}