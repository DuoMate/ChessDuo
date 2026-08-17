import { renderHook, act } from '@testing-library/react'

const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

jest.mock('@/lib/notificationRedirect', () => {
  const actual = jest.requireActual('@/lib/notificationRedirect')
  return {
    ...actual,
    consumeNotificationRedirect: jest.fn(),
    getNotificationRedirectRoute: jest.fn(),
    storeNotificationRedirect: jest.fn(),
  }
})

import { useNotificationRedirect } from '../useNotificationRedirect'
import {
  consumeNotificationRedirect,
  getNotificationRedirectRoute,
} from '@/lib/notificationRedirect'

const dispatchSpy = jest.spyOn(window, 'dispatchEvent')

function findFriendRefreshDispatch(): CustomEvent | undefined {
  return dispatchSpy.mock.calls
    .map((c) => c[0])
    .find((e): e is CustomEvent => e instanceof CustomEvent && e.type === 'chessduo:refresh-friends')
}

describe('useNotificationRedirect — friends refresh signal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    dispatchSpy.mockClear()
  })

  it('navigates to /friends and signals a refetch for a friend_request redirect', async () => {
    ;(consumeNotificationRedirect as jest.Mock).mockReturnValue({
      type: 'friend_request',
      senderId: 'sender-1',
      timestamp: Date.now(),
    })
    ;(getNotificationRedirectRoute as jest.Mock).mockReturnValue('/friends')

    renderHook(() => useNotificationRedirect())
    await act(async () => {})

    expect(mockReplace).toHaveBeenCalledWith('/friends')
    expect(findFriendRefreshDispatch()).toBeDefined()
  })

  it('signals a refetch for an invite_accepted redirect', async () => {
    ;(consumeNotificationRedirect as jest.Mock).mockReturnValue({
      type: 'invite_accepted',
      senderId: 'sender-1',
      timestamp: Date.now(),
    })
    ;(getNotificationRedirectRoute as jest.Mock).mockReturnValue('/friends')

    renderHook(() => useNotificationRedirect())
    await act(async () => {})

    expect(findFriendRefreshDispatch()).toBeDefined()
  })

  it('does NOT signal a refetch for a game_invite redirect', async () => {
    ;(consumeNotificationRedirect as jest.Mock).mockReturnValue({
      type: 'game_invite',
      roomId: 'room-1',
      timestamp: Date.now(),
    })
    ;(getNotificationRedirectRoute as jest.Mock).mockReturnValue('/duel?room=room-1')

    renderHook(() => useNotificationRedirect())
    await act(async () => {})

    expect(mockReplace).toHaveBeenCalledWith('/duel?room=room-1')
    expect(findFriendRefreshDispatch()).toBeUndefined()
  })
})
