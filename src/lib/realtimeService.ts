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
}
