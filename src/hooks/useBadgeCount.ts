import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface BadgeData {
  unreadMessages: number
  pendingRequests: number
  total: number
  unreadBySender: Record<string, number>
}

export function useBadgeCount(playerId: string | null): BadgeData {
  const [badge, setBadge] = useState<BadgeData>({
    unreadMessages: 0,
    pendingRequests: 0,
    total: 0,
    unreadBySender: {},
  })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchCounts = useCallback(async () => {
    if (!playerId) {
      if (mountedRef.current) {
        setBadge({ unreadMessages: 0, pendingRequests: 0, total: 0, unreadBySender: {} })
      }
      return
    }

    try {
      const [msgResult, reqResult] = await Promise.all([
        supabase.from('messages').select('sender_id').eq('receiver_id', playerId).eq('read', false),
        supabase.from('friend_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', playerId).eq('status', 'pending'),
      ])

      if (!mountedRef.current) return

      const bySender: Record<string, number> = {}
      if (msgResult.data) {
        for (const msg of msgResult.data) {
          bySender[msg.sender_id] = (bySender[msg.sender_id] || 0) + 1
        }
      }

      const pendingRequests = reqResult.count || 0
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

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  useEffect(() => {
    if (!playerId) return

    const msgChannel = supabase
      .channel(`badge-messages-${playerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${playerId}` },
        () => { if (mountedRef.current) fetchCounts() }
      )
      .subscribe()

    const reqChannel = supabase
      .channel(`badge-friend-requests-${playerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${playerId}` },
        () => { if (mountedRef.current) fetchCounts() }
      )
      .subscribe()

    const handleVisibility = () => {
      if (!document.hidden && mountedRef.current) fetchCounts()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(reqChannel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [playerId, fetchCounts])

  return badge
}
