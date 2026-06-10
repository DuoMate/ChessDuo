'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sendFriendRequest, isFriend } from '@/lib/friends'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const targetUserId = params.userId as string

  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'loading' | 'need_auth' | 'already_friends' | 'sent' | 'error'>('loading')
  const [targetUsername, setTargetUsername] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const requestSent = useRef(false)
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } }) => {
      if (!mountedRef.current) return
      const session = result.data.session
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
      }).catch((err: unknown) => {
        // Target username not found
      })
  }, [targetUserId])

  useEffect(() => {
    if (!playerId || !targetUserId || requestSent.current) return

    requestSent.current = true
    isFriend(playerId, targetUserId).then((already) => {
      if (already) {
        setStatus('already_friends')
        return
      }

      sendFriendRequest(playerId, targetUserId).then(({ error }) => {
        if (error) {
          setStatus('error')
          setErrorMsg(error)
        } else {
          setStatus('sent')
        }
      }).catch(() => {
        setStatus('error')
        setErrorMsg('Could not send friend request')
      })
    }).catch(() => {
      // Could not check friend status
    })
  }, [playerId, targetUserId])

  const isSelf = playerId && targetUserId && playerId === targetUserId

  const handleAuthComplete = (userId: string) => {
    setPlayerId(userId)
    requestSent.current = false
  }

  const handleNeedUsername = (userId: string, suggestedName: string) => {
    setNeedsUsername({ userId, suggestedName })
  }

  const handleUsernameChosen = (userId: string) => {
    setNeedsUsername(null)
    setPlayerId(userId)
    requestSent.current = false
  }

  if (needsUsername) {
    return (
      <ErrorBoundary>
        <ChooseUsername
          userId={needsUsername.userId}
          suggestedName={needsUsername.suggestedName}
          onAuthComplete={handleUsernameChosen}
        />
      </ErrorBoundary>
    )
  }

  if (isSelf) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="text-5xl mb-2">⚠️</div>
            <h1 className="text-xl font-bold text-red-400">Cannot Add Yourself</h1>
            <p className="text-gray-500 dark:text-gray-400">You cannot add yourself as a friend</p>
            <button onClick={() => router.push('/')} className="mt-4 px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400">
              Go Home
            </button>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  if (loading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </ErrorBoundary>
    )
  }

  if (!playerId) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
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
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === 'loading' && (
          <p className="text-gray-500 dark:text-gray-400">Sending friend request...</p>
        )}

        {status === 'already_friends' && (
          <>
            <div className="text-5xl mb-2">🤝</div>
            <h1 className="text-2xl font-bold text-yellow-400">Already Friends!</h1>
            <p className="text-gray-500 dark:text-gray-400">
              {targetUsername ? `You and ${targetUsername} are already friends` : 'You are already friends with this player'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 transition-colors"
            >
              Go Home
            </button>
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
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 transition-colors"
            >
              Go Home
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-2">⚠️</div>
            <h1 className="text-xl font-bold text-red-400">Something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400">{errorMsg || 'Could not send friend request'}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}
