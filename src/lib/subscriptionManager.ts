import type { RealtimeChannel } from '@supabase/supabase-js'
import { realtimeMetrics } from './realtimeMetrics'

class SubscriptionManager {
  private channels: Set<RealtimeChannel> = new Set()

  register(channel: RealtimeChannel): RealtimeChannel {
    realtimeMetrics.onChannelCreated(channel.topic)
    this.channels.add(channel)
    return channel
  }

  remove(channel: RealtimeChannel): void {
    if (this.channels.has(channel)) {
      realtimeMetrics.onChannelRemoved(channel.topic)
    }
    this.channels.delete(channel)
  }

  cleanup(): void {
    for (const channel of this.channels) {
      try {
        channel.unsubscribe()
      } catch {
        // Channel may already be closed
      }
    }
    this.channels.clear()
  }

  get count(): number {
    return this.channels.size
  }
}

export const subscriptionManager = new SubscriptionManager()
