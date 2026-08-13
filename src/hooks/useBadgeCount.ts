import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getPendingRequestCount } from '@/lib/friends'

interface BadgeData {
  unreadMessages: number
  pendingRequests: number
  total: number
  unreadBySender: Record<string, number>
}

// Unique per-subscription-instance suffix. Supabase reuses a channel with the
// same topic while it is still registered (removeChannel is async), so a fixed
// name causes `.on('postgres_changes', ...)` to throw on fast remounts
// (e.g. home <-> profile navigation). This keeps each mount on a fresh channel.
let badgeChannelCounter = 0

export function useBadgeCount(playerId: string | null): BadgeData {
  const [badge, setBadge] = useState<BadgeData>({
    unreadMessages: 0,
    pendingRequests: 0,
    total: 0,
    unreadBySender: {},
  })
  const mountedRef = useRef(true)
  const fetchCountsRef = useRef<() => Promise<void>>(async () => {})
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const fetchCounts = useCallback(async () => {
    if (!playerId) {
      if (mountedRef.current) {
        setBadge({ unreadMessages: 0, pendingRequests: 0, total: 0, unreadBySender: {} })
      }
      return
    }

    try {
      const [msgResult, pendingCount] = await Promise.all([
        supabase.from('messages').select('sender_id').eq('receiver_id', playerId).eq('read', false),
        getPendingRequestCount(playerId),
      ])

      if (!mountedRef.current) return

      const bySender: Record<string, number> = {}
      if (msgResult.data) {
        for (const msg of msgResult.data) {
          bySender[msg.sender_id] = (bySender[msg.sender_id] || 0) + 1
        }
      }

      const pendingRequests = pendingCount
      const unreadMessages = msgResult.data ? msgResult.data.length : 0

      setBadge({
        unreadMessages,
        pendingRequests,
        total: unreadMessages + pendingRequests,
        unreadBySender: bySender,
      })
    } catch {
      /* counts unavailable — keep previous state */
    }
  }, [playerId])

  // Keep latest fetchCounts in a ref so realtime callbacks use current closure
  fetchCountsRef.current = fetchCounts

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Realtime subscription — single channel with two listeners, INSERT-only, debounced
  useEffect(() => {
    if (!playerId) return

    const debouncedUpdate = () => {
      if (!mountedRef.current) return
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        if (mountedRef.current) fetchCountsRef.current()
      }, 300)
    }

    const badgeChannel = supabase
      .channel(`badge:${playerId}:${++badgeChannelCounter}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${playerId}` },
        debouncedUpdate,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${playerId}` },
        debouncedUpdate,
      )
      .subscribe()

    const handleVisibility = () => {
      if (!document.hidden && mountedRef.current) fetchCountsRef.current()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(debounceTimerRef.current)
      supabase.removeChannel(badgeChannel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [playerId])

  return badge
}
