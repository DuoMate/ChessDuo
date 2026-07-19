'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { HomeBottomNav } from '@/components/HomeBottomNav'
import { DesktopSidebar } from '@/components/DesktopSidebar'
import { useBadgeCount } from '@/hooks/useBadgeCount'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const { total: unreadMessages } = useBadgeCount(playerId)
  const isMobile = useIsMobile()

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
      {isMobile ? (
        <>
          <div className="pb-20">{children}</div>
          <HomeBottomNav unreadMessages={unreadMessages} />
        </>
      ) : (
        <>
          <DesktopSidebar unreadMessages={unreadMessages} />
          <div className="md:pl-[220px] lg:pl-[240px]">{children}</div>
        </>
      )}
    </ErrorBoundary>
  )
}
