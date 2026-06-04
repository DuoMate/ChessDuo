import type { RealtimeChannel } from '@supabase/supabase-js'

class SubscriptionManager {
  private channels: Set<RealtimeChannel> = new Set()

  register(channel: RealtimeChannel): RealtimeChannel {
    this.channels.add(channel)
    return channel
  }

  remove(channel: RealtimeChannel): void {
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
