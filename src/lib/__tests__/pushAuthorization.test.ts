import { authorizePush, PUSH_TYPES, PUSH_TYPE_CAPS } from '../pushAuthorization'

const base = {
  senderId: 'user-a',
  receiverId: 'user-b',
  isAcceptedFriends: false,
  isBlocked: false,
  hasPendingRequest: false,
  isRoomMember: false,
  dailySent: 0,
}

describe('pushAuthorization', () => {
  it('rejects unknown / unauthorized notification types', () => {
    expect(authorizePush({ ...base, type: 'system_admin' }).allowed).toBe(false)
    expect(authorizePush({ ...base, type: 'spam' }).reason).toBe('unauthorized_type')
  })

  it('rejects a missing or self recipient', () => {
    expect(authorizePush({ ...base, type: 'chat_message', receiverId: '' }).allowed).toBe(false)
    expect(
      authorizePush({ ...base, type: 'chat_message', receiverId: base.senderId }).reason,
    ).toBe('invalid_sender')
  })

  it('User A cannot push chat to User B who is not a friend', () => {
    const r = authorizePush({ ...base, type: 'chat_message', isAcceptedFriends: false })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('not_friends')
  })

  it('User A cannot send a game invite to a stranger without membership', () => {
    const r = authorizePush({ ...base, type: 'game_invite', isAcceptedFriends: false, isRoomMember: false })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('no_relationship')
  })

  it('User A cannot send a friend request with no real pending request row', () => {
    const r = authorizePush({ ...base, type: 'friend_request', hasPendingRequest: false })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('no_pending_request')
  })

  it('User A cannot push to User B who has blocked A', () => {
    const r = authorizePush({ ...base, type: 'friend_request', isBlocked: true, hasPendingRequest: true })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('blocked')
  })

  it('User A is rate-limited once the daily per-type cap is reached', () => {
    const r = authorizePush({
      ...base,
      type: 'friend_request',
      hasPendingRequest: true,
      dailySent: PUSH_TYPE_CAPS.friend_request,
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('rate_limited')
  })

  it('legitimate friend request (pending row exists, under cap) is allowed', () => {
    const r = authorizePush({ ...base, type: 'friend_request', hasPendingRequest: true })
    expect(r.allowed).toBe(true)
  })

  it('legitimate chat to an accepted friend is allowed', () => {
    const r = authorizePush({ ...base, type: 'chat_message', isAcceptedFriends: true })
    expect(r.allowed).toBe(true)
  })

  it('game invite to an accepted friend is allowed', () => {
    const r = authorizePush({ ...base, type: 'game_invite', isAcceptedFriends: true })
    expect(r.allowed).toBe(true)
  })

  it('game invite to a non-friend who shares a room (room member) is allowed', () => {
    const r = authorizePush({ ...base, type: 'game_invite', isAcceptedFriends: false, isRoomMember: true })
    expect(r.allowed).toBe(true)
  })

  it('invite_accepted to the requester is allowed (accepted or pending)', () => {
    expect(authorizePush({ ...base, type: 'invite_accepted', isAcceptedFriends: true }).allowed).toBe(true)
    expect(authorizePush({ ...base, type: 'invite_accepted', hasPendingRequest: true }).allowed).toBe(true)
    expect(authorizePush({ ...base, type: 'invite_accepted' }).reason).toBe('no_relationship')
  })

  it('exposes the allowlist of types and caps', () => {
    expect(PUSH_TYPES).toContain('chat_message')
    expect(PUSH_TYPE_CAPS.chat_message).toBeGreaterThan(0)
  })
})
