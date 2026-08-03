import { supabase, Message } from './supabase'
import { subscriptionManager } from './subscriptionManager'

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  messageType: 'chat' | 'challenge' = 'chat'
): Promise<{ data: Message | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      read: false,
      message_type: messageType,
    })
    .select('*')
    .single()

  if (error) return { data: null, error: error.message }

  const channel = supabase.channel(`messages:${receiverId}`)
  subscriptionManager.register(channel)
  await channel.send({
    type: 'broadcast',
    event: 'new_message',
    payload: data,
  })

  return { data, error: null }
}

export async function getConversation(userId: string, friendId: string, limit = 50): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .eq('message_type', 'chat')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data || []).reverse()
}

export async function markMessagesAsRead(userId: string, friendId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', friendId)
    .eq('receiver_id', userId)
    .eq('read', false)
}

export async function getUnreadCounts(userId: string): Promise<{ total: number; bySender: Record<string, number> }> {
  const { data } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('receiver_id', userId)
    .eq('read', false)

  if (!data) return { total: 0, bySender: {} }

  const bySender: Record<string, number> = {}
  for (const msg of data) {
    bySender[msg.sender_id] = (bySender[msg.sender_id] || 0) + 1
  }

  return { total: data.length, bySender }
}

export async function getUnreadChallenges(userId: string): Promise<{ senderId: string; content: string }[]> {
  const { data } = await supabase
    .from('messages')
    .select('sender_id, content')
    .eq('receiver_id', userId)
    .eq('read', false)
    .eq('message_type', 'challenge')
    .order('created_at', { ascending: false })

  if (!data) return []
  return data.map(d => ({ senderId: d.sender_id, content: d.content }))
}

export async function markChallengeAsRead(userId: string, senderId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', senderId)
    .eq('receiver_id', userId)
    .eq('message_type', 'challenge')
}

export function subscribeToMessages(userId: string, onMessage: (msg: Message) => void) {
  const channelName = `messages:${userId}`
  const channel = supabase.channel(channelName)
  subscriptionManager.register(channel)
  channel
    .on('broadcast', { event: 'new_message' }, (payload) => {
      onMessage(payload.payload as Message)
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
