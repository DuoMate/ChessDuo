import { supabase } from './supabase'
import { subscriptionManager } from './subscriptionManager'
import type { RealtimeChannel } from '@supabase/supabase-js'

let channelCounter = 0

export const RealtimeService = {
  subscribeToTable(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    filter: string | undefined,
    callback: (payload: any) => void,
  ): RealtimeChannel {
    const channelConfig: any = { event, schema: 'public', table }
    if (filter) channelConfig.filter = filter

    const channel = supabase.channel(`${table}-${event}-${++channelCounter}`)
      .on('postgres_changes', channelConfig, callback)
      .subscribe()

    subscriptionManager.register(channel)
    return channel
  },

  cleanupChannel(channel: RealtimeChannel): void {
    channel.unsubscribe()
    subscriptionManager.remove(channel)
  },

  /**
   * Force-tears-down any still-registered channel whose topic matches, so a
   * subsequent `supabase.channel(topic)` creates a fresh channel instead of
   * reusing a stale joined one (which would make `.on(...)` throw with
   * "cannot add ... callbacks ... after subscribe()").
   *
   * Needed because `removeChannel` is async and, when the socket is dead (e.g.
   * a CHANNEL_ERROR reconnect), its `unsubscribe()` can time out and never
   * tear the channel down — leaving it registered in the joined state.
   */
  forceRemoveStaleChannels(topic: string): void {
    const realtimeTopic = `realtime:${topic}`
    const allChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : []
    const stale = allChannels.filter((c) => c.topic === realtimeTopic)
    for (const ch of stale) {
      try {
        ch.teardown()
      } catch {
        // Channel may already be closed — safe to ignore.
      }
      subscriptionManager.remove(ch)
    }
  },
}
