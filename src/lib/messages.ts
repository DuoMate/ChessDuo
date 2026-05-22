import { supabase, Message } from './supabase'

export async function sendMessage(senderId: string, receiverId: string, content: string): Promise<{ data: Message | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      read: false,
    })
    .select('*')
    .single()

  if (error) return { data: null, error: error.message }

  const channel = supabase.channel(`messages:${receiverId}`)
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

export function subscribeToMessages(userId: string, onMessage: (msg: Message) => void) {
  const channelName = `messages:${userId}`
  const channel = supabase.channel(channelName)
  channel
    .on('broadcast', { event: 'new_message' }, (payload) => {
      onMessage(payload.payload as Message)
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
