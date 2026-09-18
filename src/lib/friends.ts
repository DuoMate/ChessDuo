import { supabase, Friendship } from './supabase'
import { getAppBaseUrl } from './appUrl'

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<{ error: string | null }> {
  if (senderId === receiverId) return { error: 'Cannot add yourself as a friend' }

  const { data: existing } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_LIST_COLUMNS)
    .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') return { error: 'Already friends' }
    if (existing.status === 'pending') return { error: 'Friend request already sent' }
    if (existing.status === 'blocked') return { error: 'Cannot send request to this user' }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })

  return { error: error?.message || null }
}

export async function acceptFriendRequest(senderId: string, receiverId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')

  return { error: error?.message || null }
}

export async function rejectFriendRequest(senderId: string, receiverId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')

  return { error: error?.message || null }
}

export async function cancelFriendRequest(senderId: string, receiverId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')

  return { error: error?.message || null }
}

export async function deleteFriendship(userId: string, friendId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .eq('status', 'accepted')

  return { error: error?.message || null }
}

export async function blockUser(userId: string, blockedUserId: string): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_LIST_COLUMNS)
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${blockedUserId}),and(sender_id.eq.${blockedUserId},receiver_id.eq.${userId})`)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked', updated_at: new Date().toISOString(), sender_id: userId, receiver_id: blockedUserId })
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${blockedUserId}),and(sender_id.eq.${blockedUserId},receiver_id.eq.${userId})`)

    return { error: error?.message || null }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ sender_id: userId, receiver_id: blockedUserId, status: 'blocked' })

  return { error: error?.message || null }
}

export async function unblockUser(userId: string, blockedUserId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('sender_id', userId)
    .eq('receiver_id', blockedUserId)
    .eq('status', 'blocked')

  return { error: error?.message || null }
}

export interface FriendWithProfile extends Friendship {
  friend_username: string
  friend_avatar_url: string | null
  friend_id: string
  direction: 'sent' | 'received'
  request_sender_id: string
  request_receiver_id: string
}

const FRIENDSHIP_LIST_COLUMNS = 'sender_id, receiver_id, status, created_at, updated_at'

function toFriendWithProfile(f: Friendship, userId: string, profileMap: Map<string, string>, avatarMap: Map<string, string | null>): FriendWithProfile {
  const friendId = f.sender_id === userId ? f.receiver_id : f.sender_id
  return {
    ...f,
    friend_username: profileMap.get(friendId) || 'Unknown',
    friend_avatar_url: avatarMap.get(friendId) || null,
    friend_id: friendId,
    direction: f.sender_id === userId ? 'sent' : 'received',
    request_sender_id: f.sender_id,
    request_receiver_id: f.receiver_id,
  }
}

/**
 * P1 perf: single-bundle friends load — ONE `friendships` SELECT (all rows
 * involving the user, explicit columns) + ONE `profiles.in(union)` instead
 * of 3× (friendships→profiles.in) = 6 hops for accepted/pending/blocked.
 * Splitting is done in memory with identical semantics to
 * getFriendsList/getPendingRequests/getBlockedUsers. Guards empty `.in()`
 * (PostgREST rejects empty lists) and caps rows per status to bound payload.
 */
const FRIENDS_BUNDLE_LIMIT_PER_STATUS = 500

export async function getFriendsBundle(userId: string): Promise<{
  friends: FriendWithProfile[]
  incoming: FriendWithProfile[]
  outgoing: FriendWithProfile[]
  blocked: FriendWithProfile[]
}> {
  const empty = { friends: [], incoming: [], outgoing: [], blocked: [] }
  const { data: friendships } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_LIST_COLUMNS)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(FRIENDS_BUNDLE_LIMIT_PER_STATUS * 3)

  if (!friendships || friendships.length === 0) return empty

  const otherIds = [...new Set(friendships.map(f =>
    f.sender_id === userId ? f.receiver_id : f.sender_id
  ))]
  if (otherIds.length === 0) return empty

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', otherIds)

  const profileMap = new Map<string, string>(
    profiles?.map((p: { id: string; username: string }) => [p.id, p.username] as [string, string]) || [],
  )
  const avatarMap = new Map<string, string | null>(
    profiles?.map((p: { id: string; avatar_url: string | null }) => [p.id, p.avatar_url || null] as [string, string | null]) || [],
  )

  const friends: FriendWithProfile[] = []
  const incoming: FriendWithProfile[] = []
  const outgoing: FriendWithProfile[] = []
  const blocked: FriendWithProfile[] = []

  for (const f of friendships) {
    const withProfile = toFriendWithProfile(f as Friendship, userId, profileMap, avatarMap)
    if (f.status === 'accepted') {
      if (friends.length < FRIENDS_BUNDLE_LIMIT_PER_STATUS) friends.push(withProfile)
    } else if (f.status === 'pending') {
      if (f.receiver_id === userId) {
        if (incoming.length < FRIENDS_BUNDLE_LIMIT_PER_STATUS) incoming.push(withProfile)
      } else {
        if (outgoing.length < FRIENDS_BUNDLE_LIMIT_PER_STATUS) outgoing.push(withProfile)
      }
    } else if (f.status === 'blocked') {
      // Preserve getBlockedUsers semantics: only rows the viewer sent.
      if (f.sender_id === userId && blocked.length < FRIENDS_BUNDLE_LIMIT_PER_STATUS) {
        blocked.push(withProfile)
      }
    }
  }

  return { friends, incoming, outgoing, blocked }
}

export async function getFriendsList(userId: string): Promise<FriendWithProfile[]> {
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_LIST_COLUMNS)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false })
    .limit(FRIENDS_BUNDLE_LIMIT_PER_STATUS)

  if (error || !friendships) return []

  const friendIds = friendships.map(f =>
    f.sender_id === userId ? f.receiver_id : f.sender_id
  )
  if (friendIds.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', friendIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || [])
  const avatarMap = new Map(profiles?.map(p => [p.id, p.avatar_url || null]) || [])

  return friendships.map(f => {
    const friendId = f.sender_id === userId ? f.receiver_id : f.sender_id
    return {
      ...f,
      friend_username: profileMap.get(friendId) || 'Unknown',
      friend_avatar_url: avatarMap.get(friendId) || null,
      friend_id: friendId,
      direction: f.sender_id === userId ? 'sent' : 'received',
      request_sender_id: f.sender_id,
      request_receiver_id: f.receiver_id,
    }
  })
}

export async function getPendingRequests(userId: string): Promise<{
  incoming: FriendWithProfile[]
  outgoing: FriendWithProfile[]
}> {
  const { data: friendships } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_LIST_COLUMNS)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(FRIENDS_BUNDLE_LIMIT_PER_STATUS * 2)

  if (!friendships) return { incoming: [], outgoing: [] }

  const allUserIds = friendships.map(f =>
    f.sender_id === userId ? f.receiver_id : f.sender_id
  )
  if (allUserIds.length === 0) return { incoming: [], outgoing: [] }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', allUserIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || [])
  const avatarMap = new Map(profiles?.map(p => [p.id, p.avatar_url || null]) || [])

  const incoming: FriendWithProfile[] = []
  const outgoing: FriendWithProfile[] = []

  for (const f of friendships) {
    const friendId = f.sender_id === userId ? f.receiver_id : f.sender_id
    const withProfile: FriendWithProfile = {
      ...f,
      friend_username: profileMap.get(friendId) || 'Unknown',
      friend_avatar_url: avatarMap.get(friendId) || null,
      friend_id: friendId,
      direction: f.sender_id === userId ? 'sent' : 'received',
      request_sender_id: f.sender_id,
      request_receiver_id: f.receiver_id,
    }
    if (f.receiver_id === userId) {
      incoming.push(withProfile)
    } else {
      outgoing.push(withProfile)
    }
  }

  return { incoming, outgoing }
}

export async function getBlockedUsers(userId: string): Promise<FriendWithProfile[]> {
  const { data: friendships } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_LIST_COLUMNS)
    .eq('sender_id', userId)
    .eq('status', 'blocked')
    .limit(FRIENDS_BUNDLE_LIMIT_PER_STATUS)

  if (!friendships) return []

  const blockedIds = friendships.map(f => f.receiver_id)
  if (blockedIds.length === 0) return []
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', blockedIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || [])
  const avatarMap = new Map(profiles?.map(p => [p.id, p.avatar_url || null]) || [])

  return friendships.map(f => ({
    ...f,
    friend_username: profileMap.get(f.receiver_id) || 'Unknown',
    friend_avatar_url: avatarMap.get(f.receiver_id) || null,
    friend_id: f.receiver_id,
    direction: 'sent' as const,
    request_sender_id: f.sender_id,
    request_receiver_id: f.receiver_id,
  }))
}

export async function searchUsers(query: string, currentUserId: string): Promise<{ id: string; username: string }[]> {
  if (!query.trim()) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .or(`username.ilike.%${query}%,id.eq.${query}`)
    .neq('id', currentUserId)
    .limit(20)

  return data || []
}

export async function isFriend(userId: string, otherUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_LIST_COLUMNS)
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .neq('status', 'blocked')
    .maybeSingle()

  return !!data
}

export function getInviteLink(userId: string): string {
  return `${getAppBaseUrl()}/invite/${userId}`
}

// A public /profile/[userId] route does not exist yet — sharing a profile points
// the recipient at the friend-request flow instead of a dead link.
export function getProfileLink(userId: string): string {
  return `${getAppBaseUrl()}/invite/${userId}`
}

export async function getFriendStats(friendId: string): Promise<{
  totalGames: number
  wins: number
  losses: number
  draws: number
  avgAccuracy: number
} | null> {
  // Narrow columns (was select('*') incl. unused fields); membership
  // subselect + limit preserved — same rows, smaller payload.
  const { data, error } = await supabase
    .from('completed_games')
    .select('winner, player1_accuracy, player2_accuracy')
    .or(`room_id.in.(select room_id from room_players where player_id.eq.${friendId})`)
    .limit(1000)

  if (error || !data || data.length === 0) return null

  let wins = 0
  let losses = 0
  let draws = 0
  let totalAccuracy = 0
  let accuracyCount = 0

  for (const game of data) {
    if (game.winner === 'DRAW') {
      draws++
    } else if (game.winner === 'WHITE') {
      wins++
    } else {
      losses++
    }
    if (game.player1_accuracy > 0) {
      totalAccuracy += game.player1_accuracy
      accuracyCount++
    }
    if (game.player2_accuracy > 0) {
      totalAccuracy += game.player2_accuracy
      accuracyCount++
    }
  }

  return {
    totalGames: data.length,
    wins,
    losses,
    draws,
    avgAccuracy: accuracyCount > 0 ? totalAccuracy / accuracyCount : 0,
  }
}

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
