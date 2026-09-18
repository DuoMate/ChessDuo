import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  deleteFriendship,
  blockUser,
  unblockUser,
  getInviteLink,
  getProfileLink,
  isFriend,
  searchUsers,
  getPendingRequests,
  getFriendsBundle,
} from '../friends'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

import { supabase } from '../supabase'

function mockFromChain(overrides: Record<string, jest.Mock> = {}) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  }
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('sendFriendRequest', () => {
  it('returns error when adding self', async () => {
    const result = await sendFriendRequest('user1', 'user1')
    expect(result.error).toBe('Cannot add yourself as a friend')
  })

  it('returns error if already friends', async () => {
    mockFromChain({
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: { status: 'accepted' }, error: null }),
    })
    const result = await sendFriendRequest('user1', 'user2')
    expect(result.error).toBe('Already friends')
  })

  it('returns error if request already pending', async () => {
    mockFromChain({
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: { status: 'pending' }, error: null }),
    })
    const result = await sendFriendRequest('user1', 'user2')
    expect(result.error).toBe('Friend request already sent')
  })

  it('sends friend request successfully', async () => {
    const chain = mockFromChain({
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
    })
    const result = await sendFriendRequest('user1', 'user2')
    expect(result.error).toBeNull()
    expect(chain.insert).toHaveBeenCalledWith({
      sender_id: 'user1',
      receiver_id: 'user2',
      status: 'pending',
    })
  })
})

describe('acceptFriendRequest', () => {
  it('accepts a pending request', async () => {
    const chain = mockFromChain()
    await acceptFriendRequest('sender', 'receiver')
    expect(chain.update).toHaveBeenCalledWith({
      status: 'accepted',
      updated_at: expect.any(String),
    })
  })
})

describe('rejectFriendRequest', () => {
  it('deletes a pending request', async () => {
    const chain = mockFromChain()
    await rejectFriendRequest('sender', 'receiver')
    expect(chain.delete).toHaveBeenCalled()
  })
})

describe('cancelFriendRequest', () => {
  it('deletes a pending request initiated by sender', async () => {
    const chain = mockFromChain()
    await cancelFriendRequest('sender', 'receiver')
    expect(chain.delete).toHaveBeenCalled()
  })
})

describe('deleteFriendship', () => {
  it('deletes an accepted friendship', async () => {
    const chain = mockFromChain()
    await deleteFriendship('user1', 'user2')
    expect(chain.delete).toHaveBeenCalled()
  })
})

describe('blockUser', () => {
  it('creates a block for new relation', async () => {
    mockFromChain({
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
    })
    const result = await blockUser('user1', 'user2')
    expect(result.error).toBeNull()
  })
})

describe('unblockUser', () => {
  it('removes a block', async () => {
    mockFromChain()
    const result = await unblockUser('user1', 'user2')
    expect(result.error).toBeNull()
  })
})

describe('isFriend', () => {
  it('returns true when friendship exists', async () => {
    mockFromChain({
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: { status: 'accepted' }, error: null }),
    })
    const result = await isFriend('user1', 'user2')
    expect(result).toBe(true)
  })

  it('returns false when no friendship exists', async () => {
    mockFromChain({
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
    })
    const result = await isFriend('user1', 'user2')
    expect(result).toBe(false)
  })
})

describe('searchUsers', () => {
  it('returns empty for empty query', async () => {
    const result = await searchUsers('', 'user1')
    expect(result).toEqual([])
  })
})

describe('getPendingRequests', () => {
  it('returns empty when no pending', async () => {
    const chain = mockFromChain()
    chain.or.mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })
    const result = await getPendingRequests('user1')
    expect(result.incoming).toEqual([])
    expect(result.outgoing).toEqual([])
  })
})

describe('getInviteLink', () => {
  it('returns correct invite URL', () => {
    const link = getInviteLink('abc123')
    expect(link).toContain('/invite/abc123')
  })
})

describe('getFriendsBundle (P1 perf)', () => {
  it('splits one friendships fetch + one profiles fetch in memory (no select *)', async () => {
    const rows = [
      { sender_id: 'user1', receiver_id: 'user2', status: 'accepted', created_at: '2026-01-01', updated_at: '2026-01-02' },
      { sender_id: 'user3', receiver_id: 'user1', status: 'pending', created_at: '2026-01-01', updated_at: '2026-01-02' },
      { sender_id: 'user1', receiver_id: 'user4', status: 'pending', created_at: '2026-01-01', updated_at: '2026-01-02' },
      { sender_id: 'user1', receiver_id: 'user5', status: 'blocked', created_at: '2026-01-01', updated_at: '2026-01-02' },
    ]
    const selectMock = jest.fn()
    selectMock
      .mockReturnValueOnce({
        or: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        in: jest.fn().mockResolvedValue({
          data: [
            { id: 'user2', username: 'bob', avatar_url: null },
            { id: 'user3', username: 'cara', avatar_url: null },
            { id: 'user4', username: 'dan', avatar_url: null },
            { id: 'user5', username: 'erin', avatar_url: null },
          ],
          error: null,
        }),
      })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: selectMock })

    const bundle = await getFriendsBundle('user1')

    expect(bundle.friends).toHaveLength(1)
    expect(bundle.friends[0].friend_username).toBe('bob')
    expect(bundle.incoming).toHaveLength(1)
    expect(bundle.outgoing).toHaveLength(1)
    expect(bundle.blocked).toHaveLength(1)
    // Narrow columns on the friendships fetch — never select('*').
    expect(selectMock.mock.calls[0][0]).not.toContain('*')
    expect(supabase.from).toHaveBeenCalledTimes(2)
  })
})

describe('getProfileLink', () => {
  it('returns the invite URL (no public /profile/[userId] route exists — Bug: dead profile share)', () => {
    const link = getProfileLink('abc123')
    expect(link).toContain('/invite/abc123')
  })
})
