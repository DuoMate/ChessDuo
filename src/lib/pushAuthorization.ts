/**
 * Push-send authorization policy (P0-4).
 *
 * Pure decision logic, kept free of Supabase/Next imports so the security
 * rules can be unit-tested. The route computes the facts (friendship state,
 * block state, room membership, daily count) and passes them here.
 */

export type PushType = 'friend_request' | 'invite_accepted' | 'chat_message' | 'game_invite'

export const PUSH_TYPES: readonly PushType[] = [
  'friend_request',
  'invite_accepted',
  'chat_message',
  'game_invite',
]

// Per-sender-per-type daily caps (24h sliding window).
export const PUSH_TYPE_CAPS: Record<PushType, number> = {
  friend_request: 25,
  invite_accepted: 50,
  chat_message: 200,
  game_invite: 50,
}

export interface PushAuthFacts {
  type: string
  senderId: string
  receiverId: string
  isAcceptedFriends: boolean
  isBlocked: boolean
  hasPendingRequest: boolean
  isRoomMember: boolean
  dailySent: number
}

export interface PushAuthResult {
  allowed: boolean
  reason: string
}

export function authorizePush(input: PushAuthFacts): PushAuthResult {
  if (!PUSH_TYPES.includes(input.type as PushType)) {
    return { allowed: false, reason: 'unauthorized_type' }
  }
  if (!input.senderId || input.senderId === input.receiverId) {
    return { allowed: false, reason: 'invalid_sender' }
  }
  if (input.isBlocked) {
    return { allowed: false, reason: 'blocked' }
  }
  const cap = PUSH_TYPE_CAPS[input.type as PushType]
  if (input.dailySent >= cap) {
    return { allowed: false, reason: 'rate_limited' }
  }

  switch (input.type) {
    case 'friend_request':
      // A friend request legitimately targets any user; the guard is that a
      // real pending request row must exist (the caller created it first) and
      // the daily cap above bounds abuse.
      return input.hasPendingRequest
        ? { allowed: true, reason: '' }
        : { allowed: false, reason: 'no_pending_request' }
    case 'invite_accepted':
      // The acceptor notifies the requester; the just-accepted request is
      // accepted (or still pending during the write/notify race).
      return input.isAcceptedFriends || input.hasPendingRequest
        ? { allowed: true, reason: '' }
        : { allowed: false, reason: 'no_relationship' }
    case 'chat_message':
      return input.isAcceptedFriends
        ? { allowed: true, reason: '' }
        : { allowed: false, reason: 'not_friends' }
    case 'game_invite':
      return input.isAcceptedFriends || input.isRoomMember
        ? { allowed: true, reason: '' }
        : { allowed: false, reason: 'no_relationship' }
    default:
      return { allowed: false, reason: 'unauthorized_type' }
  }
}
