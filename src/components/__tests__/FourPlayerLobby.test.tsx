import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { FourPlayerLobby } from '../FourPlayerLobby'
import {
  getLobbyPlayers,
  joinLobby,
  assignPlayer,
  unassignPlayer,
  leaveFourPlayerRoom,
  areTeamsReady,
  LobbyPlayer,
} from '@/lib/fourPlayerActions'
import { supabase } from '@/lib/supabase'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}))

jest.mock('@/lib/fourPlayerActions', () => ({
  getLobbyPlayers: jest.fn(),
  joinLobby: jest.fn(),
  assignPlayer: jest.fn(),
  unassignPlayer: jest.fn(),
  leaveFourPlayerRoom: jest.fn(),
  areTeamsReady: jest.fn(),
}))

jest.mock('@/lib/supabase', () => {
  const mockEq = jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { created_by: 'creator1', status: 'waiting' }, error: null }) })
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = jest.fn().mockReturnValue({ select: mockSelect })
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

const mockGetLobbyPlayers = getLobbyPlayers as jest.MockedFunction<typeof getLobbyPlayers>
const mockJoinLobby = joinLobby as jest.MockedFunction<typeof joinLobby>
const mockAreTeamsReady = areTeamsReady as jest.MockedFunction<typeof areTeamsReady>

const defaultProps = {
  roomId: 'room-uuid',
  roomCode: 'ABC123',
  playerId: 'player1',
  timeSeconds: 600,
  username: 'alice',
}

const emptyPlayers: LobbyPlayer[] = []

const onePlayerJoined: LobbyPlayer[] = [
  { playerId: 'player1', username: 'alice', team: null, slot: null, status: 'joined' },
]

const fullTeams: LobbyPlayer[] = [
  { playerId: 'player1', username: 'alice', team: 'WHITE', slot: 0, status: 'ready' },
  { playerId: 'player2', username: 'bob', team: 'WHITE', slot: 1, status: 'ready' },
  { playerId: 'player3', username: 'charlie', team: 'BLACK', slot: 0, status: 'ready' },
  { playerId: 'player4', username: 'diana', team: 'BLACK', slot: 1, status: 'ready' },
]

describe('FourPlayerLobby Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAreTeamsReady.mockReturnValue(false)
  })

  it('shows loading state initially', async () => {
    mockGetLobbyPlayers.mockReturnValue(new Promise(() => {}))
    render(<FourPlayerLobby {...defaultProps} />)
    expect(screen.getByText(/Loading lobby/)).toBeDefined()
  })

  it('renders lobby view when loaded with empty players', async () => {
    mockGetLobbyPlayers.mockResolvedValue(emptyPlayers)
    mockJoinLobby.mockResolvedValue(undefined)
    await act(async () => {
      render(<FourPlayerLobby {...defaultProps} />)
    })
    await waitFor(() => {
      expect(screen.getByText('Four Player Lobby')).toBeDefined()
    })
  })

  it('renders room code for sharing', async () => {
    mockGetLobbyPlayers.mockResolvedValue(onePlayerJoined)
    await act(async () => {
      render(<FourPlayerLobby {...defaultProps} />)
    })
    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeDefined()
    })
  })

  it('shows error state when room is not found', async () => {
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    ;(supabase.from as jest.Mock).mockImplementationOnce(() => ({ select: mockSelect }))
    await act(async () => {
      render(<FourPlayerLobby {...defaultProps} />)
    })
    await waitFor(() => {
      expect(screen.getByText(/Room not found/)).toBeDefined()
    })
  })

  it('shows user info when joined as creator', async () => {
    mockGetLobbyPlayers.mockResolvedValue(onePlayerJoined)
    await act(async () => {
      render(<FourPlayerLobby {...defaultProps} />)
    })
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeDefined()
    })
  })
})
