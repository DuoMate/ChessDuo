import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getPendingRequestCount } from '@/lib/friendService'

interface BadgeData {
  unreadMessages: number
  pendingRequests: number
  total: number
  unreadBySender: Record<string, number>
}

let channelCounter = 0

export function useBadgeCount(playerId: string | null): BadgeData {
  const [badge, setBadge] = useState<BadgeData>({
    unreadMessages: 0,
    pendingRequests: 0,
    total: 0,
    unreadBySender: {},
  })
  const mountedRef = useRef(true)
  const fetchCountsRef = useRef<() => Promise<void>>(async () => {})
  const instanceId = useRef(++channelCounter)

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

  // Realtime subscriptions — only re-subscribe when playerId changes
  useEffect(() => {
    if (!playerId) return

    const onUpdate = () => { if (mountedRef.current) fetchCountsRef.current() }

    const msgChannel = supabase
      .channel(`badge-messages-${playerId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${playerId}` },
        onUpdate,
      )
      .subscribe()

    const reqChannel = supabase
      .channel(`badge-friend-requests-${playerId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${playerId}` },
        onUpdate,
      )
      .subscribe()

    const handleVisibility = () => {
      if (!document.hidden && mountedRef.current) fetchCountsRef.current()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(reqChannel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [playerId])

  return badge
}
