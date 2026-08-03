'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { upsertProfile, fetchProfile } from '@/lib/profileService'

interface NeedUsername {
  userId: string
  suggestedName: string
  avatarUrl?: string | null
  displayName?: string | null
}

interface UseAuthSessionResult {
  loading: boolean
  playerId: string | null
  username: string
  needsUsername: NeedUsername | null
  handleAuthComplete: (userId: string) => void
  handleUsernameChosen: (userId: string) => void
  dismiss: () => void
  reset: () => void
}

export function useAuthSession(): UseAuthSessionResult {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [needsUsername, setNeedsUsername] = useState<NeedUsername | null>(null)
  const mountedRef = useRef(true)
  const authCompletedRef = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    let authStateReceived = false

    AuthService.getSession().then(session => {
      if (!mountedRef.current) return
      if (session?.user) {
        fetchAndCompleteAuth(session.user.id, session.user.email || '', session.user.user_metadata?.full_name || session.user.user_metadata?.name, session.user.user_metadata?.avatar_url || null)
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (mountedRef.current) setLoading(false)
    })

    const unsubscribe = AuthService.onAuthChange((_event: string, session: any) => {
      if (!mountedRef.current) return
      if (session?.user) {
        fetchAndCompleteAuth(session.user.id, session.user.email || '', session.user.user_metadata?.full_name || session.user.user_metadata?.name, session.user.user_metadata?.avatar_url || null)
      } else {
        if (!authStateReceived) {
          authStateReceived = true
          setLoading(false)
        }
        setPlayerId(null)
        setUsername('')
        setNeedsUsername(null)
        authCompletedRef.current = null
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchAndCompleteAuth = useCallback(async (userId: string, email: string, googleDisplayName?: string, googleAvatarUrl?: string | null) => {
    if (authCompletedRef.current === userId) return
    authCompletedRef.current = userId

    const profile = await fetchProfile(userId)

    if (!mountedRef.current) return

    if (profile.username) {
      if (googleAvatarUrl || googleDisplayName) {
        upsertProfile({ id: userId, avatar_url: googleAvatarUrl, display_name: googleDisplayName })
      }
      setPlayerId(userId)
      setUsername(profile.username)
      setNeedsUsername(null)
      setLoading(false)
    } else {
      const displayName = googleDisplayName || email.split('@')[0]
      if (googleAvatarUrl || googleDisplayName) {
        upsertProfile({ id: userId, avatar_url: googleAvatarUrl, display_name: displayName })
      }
      setPlayerId(userId)
      setNeedsUsername({
        userId,
        suggestedName: displayName,
        avatarUrl: googleAvatarUrl || null,
        displayName: googleDisplayName || null,
      })
      setLoading(false)
    }
  }, [])

  const handleAuthComplete = useCallback((userId: string) => {
    setPlayerId(userId)
    setNeedsUsername(null)
  }, [])

  const handleUsernameChosen = useCallback((userId: string) => {
    setNeedsUsername(null)
    setPlayerId(userId)
  }, [])

  const dismiss = useCallback(() => {
    setNeedsUsername(null)
  }, [])

  const reset = useCallback(() => {
    setPlayerId(null)
    setUsername('')
    setNeedsUsername(null)
    setLoading(true)
    authCompletedRef.current = null
  }, [])

  return {
    loading,
    playerId,
    username,
    needsUsername,
    handleAuthComplete,
    handleUsernameChosen,
    dismiss,
    reset,
  }
}
