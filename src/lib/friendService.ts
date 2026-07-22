import { supabase } from '@/lib/supabase'

export async function getPendingRequestCount(receiverId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('friendships')
      .select('sender_id', { count: 'exact', head: true })
      .eq('receiver_id', receiverId)
      .eq('status', 'pending')

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}
