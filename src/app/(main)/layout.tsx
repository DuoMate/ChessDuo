'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { HomeBottomNav } from '@/components/HomeBottomNav'
import { SlideOver } from '@/components/SlideOver'
import { ProfilePanel } from '@/components/ProfilePanel'
import { HistoryPanel } from '@/components/HistoryPanel'
import { FriendsPanel } from '@/components/FriendsPanel'
import { getUnreadCounts } from '@/lib/messages'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return
      if (session?.user) {
        setPlayerId(session.user.id)
      }
    }).catch(() => {})
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!playerId) return
    getUnreadCounts(playerId).then(({ total, bySender }) => {
      if (mountedRef.current) {
        setUnreadMessages(total)
        setUnreadBySender(bySender)
      }
    }).catch(() => {})
  }, [playerId])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('chessduo_history')
    localStorage.removeItem('chessduo_settings')
    router.push('/')
  }

  const refreshUnread = useCallback(() => {
    if (!playerId) return
    getUnreadCounts(playerId).then(({ total, bySender }) => {
      if (mountedRef.current) {
        setUnreadMessages(total)
        setUnreadBySender(bySender)
      }
    }).catch(() => {})
  }, [playerId])

  return (
    <ErrorBoundary>
      <div className="pb-20">
        {children}
      </div>
      <HomeBottomNav
        onProfile={() => setProfileOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onFriends={() => setFriendsOpen(true)}
        unreadMessages={unreadMessages}
      />
      {playerId && (
        <>
          <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
            <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); setHistoryOpen(true) }} onSignOut={handleSignOut} />
          </SlideOver>
          <SlideOver open={historyOpen} onClose={() => setHistoryOpen(false)} title="Match History">
            <HistoryPanel playerId={playerId} />
          </SlideOver>
          <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); refreshUnread() }} title="Friends">
            <FriendsPanel playerId={playerId} unreadBySender={unreadBySender} />
          </SlideOver>
        </>
      )}
    </ErrorBoundary>
  )
}
