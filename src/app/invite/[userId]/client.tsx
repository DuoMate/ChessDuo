'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { sendFriendRequest, isFriend } from '@/lib/friends'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ArrowLeft } from 'lucide-react'
import InstallBanner from '@/components/InstallBanner'

function GoHomeButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push('/')}
      className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-2xl px-3 py-1.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <ArrowLeft size={18} strokeWidth={2} />
      <span className="text-[11px] font-medium leading-none">Go Home</span>
    </button>
  )
}

export default function InvitePageClient() {
  const params = useParams()
  const router = useRouter()
  const targetUserId = params.userId as string

  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'loading' | 'confirm' | 'already_friends' | 'sent' | 'error'>('loading')
  const [sending, setSending] = useState(false)
  const [targetUsername, setTargetUsername] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string; avatarUrl?: string | null } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (!mountedRef.current) return
      setPlayerId(session?.user?.id || null)
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setLoading(false)
    })

    supabase
      .from('profiles')
      .select('username')
      .eq('id', targetUserId)
      .maybeSingle()
      .then((result: { data: any }) => {
        if (!mountedRef.current) return
        const data = result.data
        if (data) setTargetUsername(data.username)
      }).catch(() => {})
  }, [targetUserId])

  useEffect(() => {
    if (!playerId || !targetUserId) return
    if (playerId === targetUserId) return

    // No auto-send on page load — the recipient confirms before a request
    // is sent to avoid accidental friend requests from shared links.
    isFriend(playerId, targetUserId).then((already) => {
      if (!mountedRef.current) return
      setStatus(already ? 'already_friends' : 'confirm')
    }).catch(() => {
      if (!mountedRef.current) return
      setStatus('confirm')
    })
  }, [playerId, targetUserId])

  const handleSendRequest = async () => {
    if (!playerId || !targetUserId || sending) return
    setSending(true)
    try {
      const { error } = await sendFriendRequest(playerId, targetUserId)
      if (!mountedRef.current) return
      if (error) {
        setStatus('error')
        setErrorMsg(error)
      } else {
        setStatus('sent')
      }
    } catch {
      if (!mountedRef.current) return
      setStatus('error')
      setErrorMsg('Could not send friend request')
    } finally {
      setSending(false)
    }
  }

  const isSelf = playerId && targetUserId && playerId === targetUserId

  const handleAuthComplete = (userId: string) => {
    setPlayerId(userId)
  }

  const handleNeedUsername = (userId: string, suggestedName: string, avatarUrl?: string | null) => {
    setNeedsUsername({ userId, suggestedName, avatarUrl })
  }

  const handleUsernameChosen = (userId: string) => {
    setNeedsUsername(null)
    setPlayerId(userId)
  }

  if (needsUsername) {
    return (
      <>
        <InstallBanner />
        <ErrorBoundary>
          <ChooseUsername
            userId={needsUsername.userId}
            suggestedName={needsUsername.suggestedName}
            avatarUrl={needsUsername.avatarUrl}
            onAuthComplete={handleUsernameChosen}
          />
        </ErrorBoundary>
      </>
    )
  }

  if (isSelf) {
    return (
      <>
        <InstallBanner />
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg-alt)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
            <div className="max-w-sm w-full text-center space-y-4">
              <div className="text-5xl mb-2">⚠️</div>
              <h1 className="text-xl font-bold text-red-400">Cannot Add Yourself</h1>
              <p className="text-gray-500 dark:text-gray-400">You cannot add yourself as a friend</p>
              <GoHomeButton />
            </div>
          </div>
        </ErrorBoundary>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <InstallBanner />
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg-alt)] text-gray-900 dark:text-white flex items-center justify-center pb-20">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </ErrorBoundary>
      </>
    )
  }

  if (!playerId) {
    return (
      <>
        <InstallBanner />
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg-alt)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
            <div className="max-w-sm w-full text-center space-y-6">
              <div className="text-5xl mb-2">👥</div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Friend Invite</h1>
              {targetUsername && (
                <p className="text-gray-500 dark:text-gray-400">{targetUsername} invited you to be friends</p>
              )}
              <p className="text-gray-500 text-sm">Sign in to accept this friend request</p>

              <Auth onAuthComplete={handleAuthComplete} onNeedUsername={handleNeedUsername} />
            </div>
          </div>
        </ErrorBoundary>
      </>
    )
  }

  return (
    <>
      <InstallBanner />
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg-alt)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
        <div className="max-w-sm w-full text-center space-y-4">
          {status === 'loading' && (
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          )}

          {status === 'confirm' && (
            <>
              <div className="text-5xl mb-2">👥</div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Friend Invite</h1>
              <p className="text-gray-500 dark:text-gray-400">
                {targetUsername ? `${targetUsername} invited you to be friends` : 'You have been invited to be friends'}
              </p>
              <button
                onClick={handleSendRequest}
                disabled={sending}
                className="min-h-[44px] w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? 'Sending...' : 'Send Friend Request'}
              </button>
              <GoHomeButton />
            </>
          )}

          {status === 'already_friends' && (
            <>
              <div className="text-5xl mb-2">🤝</div>
              <h1 className="text-2xl font-bold text-yellow-400">Already Friends!</h1>
              <p className="text-gray-500 dark:text-gray-400">
                {targetUsername ? `You and ${targetUsername} are already friends` : 'You are already friends with this player'}
              </p>
              <GoHomeButton />
            </>
          )}

          {status === 'sent' && (
            <>
              <div className="text-5xl mb-2">✉️</div>
              <h1 className="text-2xl font-bold text-yellow-400">Friend Request Sent!</h1>
              <p className="text-gray-500 dark:text-gray-400">
                {targetUsername ? `Friend request sent to ${targetUsername}` : 'Friend request sent'}
              </p>
              <p className="text-gray-500 text-sm">They will see your request in their friends panel</p>
              <GoHomeButton />
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-5xl mb-2">⚠️</div>
              <h1 className="text-xl font-bold text-red-400">Something went wrong</h1>
              <p className="text-gray-500 dark:text-gray-400">{errorMsg || 'Could not send friend request'}</p>
              <GoHomeButton />
            </>
          )}
        </div>
      </div>
      </ErrorBoundary>
    </>
  )
}
