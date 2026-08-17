import { render, act } from '@testing-library/react'
import { FriendsPanel } from '../FriendsPanel'

const getFriendsList = jest.fn().mockResolvedValue([])
const getPendingRequests = jest.fn().mockResolvedValue({ incoming: [], outgoing: [] })
const getBlockedUsers = jest.fn().mockResolvedValue([])
const getUnreadChallenges = jest.fn().mockResolvedValue([])

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@/lib/friends', () => ({
  getFriendsList: (...args: unknown[]) => getFriendsList(...args),
  getPendingRequests: (...args: unknown[]) => getPendingRequests(...args),
  getBlockedUsers: (...args: unknown[]) => getBlockedUsers(...args),
  searchUsers: jest.fn().mockResolvedValue([]),
  sendFriendRequest: jest.fn().mockResolvedValue({ error: null }),
  acceptFriendRequest: jest.fn().mockResolvedValue({ error: null }),
  rejectFriendRequest: jest.fn().mockResolvedValue({ error: null }),
  cancelFriendRequest: jest.fn().mockResolvedValue({ error: null }),
  deleteFriendship: jest.fn().mockResolvedValue({ error: null }),
  blockUser: jest.fn().mockResolvedValue({ error: null }),
  unblockUser: jest.fn().mockResolvedValue({ error: null }),
  getInviteLink: jest.fn().mockReturnValue('https://example.com/invite/user1'),
}))

jest.mock('@/lib/share', () => ({
  shareLink: jest.fn().mockResolvedValue('copied'),
}))

jest.mock('@/lib/messages', () => ({
  getUnreadChallenges: (...args: unknown[]) => getUnreadChallenges(...args),
  markChallengeAsRead: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/features/push-notifications', () => ({
  notifyFriendRequest: jest.fn().mockResolvedValue(undefined),
  notifyInviteAccepted: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/notificationRedirect', () => {
  const actual = jest.requireActual('@/lib/notificationRedirect')
  return { ...actual }
})

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      track: jest.fn().mockResolvedValue(undefined),
      presenceState: jest.fn().mockReturnValue({}),
    }),
    removeChannel: jest.fn(),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { username: 'me' }, error: null }),
        }),
      }),
    }),
  },
}))

jest.mock('../FriendActionsMenu', () => ({
  FriendActionsMenu: () => null,
}))

jest.mock('../ChatPanel', () => ({
  ChatPanel: () => null,
}))

jest.mock('../ChallengePicker', () => ({
  ChallengePicker: () => null,
}))

jest.mock('../InitialsAvatar', () => ({
  InitialsAvatar: () => null,
}))

jest.mock('../Spinner', () => ({
  Spinner: () => null,
}))

jest.mock('../Toast', () => ({
  useToast: () => ({ addToast: jest.fn() }),
}))

describe('FriendsPanel — refetch on resume / friend-request deep-link', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('refetches friends + pending requests when the app returns to the foreground', async () => {
    render(<FriendsPanel playerId="user1" />)
    await act(async () => {})

    expect(getPendingRequests).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(getPendingRequests).toHaveBeenCalledTimes(2)
    expect(getFriendsList).toHaveBeenCalledTimes(2)
    expect(getBlockedUsers).toHaveBeenCalledTimes(2)
  })

  it('refetches when a friend-request notification deep-link is consumed while mounted', async () => {
    render(<FriendsPanel playerId="user1" />)
    await act(async () => {})

    expect(getPendingRequests).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new CustomEvent('chessduo:refresh-friends'))
    })

    expect(getPendingRequests).toHaveBeenCalledTimes(2)
  })
})
