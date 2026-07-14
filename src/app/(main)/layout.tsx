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
        onProfile={() => { if (!playerId) { router.push('/'); return }; setProfileOpen(true) }}
        onHistory={() => { if (!playerId) { router.push('/'); return }; setHistoryOpen(true) }}
        onFriends={() => { if (!playerId) { router.push('/'); return }; setFriendsOpen(true) }}
        unreadMessages={unreadMessages}
      />
      <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)}>
        {playerId ? (
          <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); setHistoryOpen(true) }} onSignOut={handleSignOut} onClose={() => setProfileOpen(false)} />
        ) : (
          <SignInPrompt onSignIn={() => { setProfileOpen(false); router.push('/?signup=1') }} />
        )}
      </SlideOver>
      <SlideOver open={historyOpen} onClose={() => setHistoryOpen(false)}>
        {playerId ? (
          <HistoryPanel playerId={playerId} onClose={() => setHistoryOpen(false)} />
        ) : (
          <SignInPrompt onSignIn={() => { setHistoryOpen(false); router.push('/?signup=1') }} />
        )}
      </SlideOver>
      <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); if (playerId) refreshUnread() }}>
        {playerId ? (
          <FriendsPanel playerId={playerId} unreadBySender={unreadBySender} onClose={() => setFriendsOpen(false)} />
        ) : (
          <SignInPrompt onSignIn={() => { setFriendsOpen(false); router.push('/?signup=1') }} />
        )}
      </SlideOver>
    </ErrorBoundary>
  )
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-4xl mb-4">🔒</div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sign in required</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
        Sign in to access your profile, match history, and friends.
      </p>
      <button
        onClick={onSignIn}
        className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
      >
        Sign In
      </button>
    </div>
  )
}
