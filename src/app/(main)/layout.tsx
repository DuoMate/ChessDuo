'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { HomeBottomNav } from '@/components/HomeBottomNav'
import { useBadgeCount } from '@/hooks/useBadgeCount'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const { total: unreadMessages } = useBadgeCount(playerId)

  useEffect(() => {
    mountedRef.current = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return
      if (session?.user) setPlayerId(session.user.id)
    }).catch(() => {})
    return () => { mountedRef.current = false }
  }, [])

  useCapacitorBackButton(() => {
    if (window.history.length > 2) { router.back(); return true }
    router.push('/')
    return true
  }, true)

  return (
    <ErrorBoundary>
      <div className="pb-20">
        {children}
      </div>
      <HomeBottomNav unreadMessages={unreadMessages} />
    </ErrorBoundary>
  )
}
