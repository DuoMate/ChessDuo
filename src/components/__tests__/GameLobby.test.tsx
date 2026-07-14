import React from 'react'
import { render, screen } from '@testing-library/react'
import { GameLobby } from '../GameLobby'

jest.mock('animejs', () => ({
  Timeline: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    pause: jest.fn(),
    seek: jest.fn(),
  })),
}))

jest.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

describe('GameLobby Component', () => {
  it('renders connecting state when isLoading is true', () => {
    render(<GameLobby isLoading={true} />)
    expect(screen.getByText('Connecting to room...')).toBeDefined()
  })

  it('renders waiting state when isLoading is false', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.getByText('Connected')).toBeDefined()
    expect(screen.getByText(/Waiting for your teammate/i)).toBeDefined()
  })

  it('renders room code in both joining and waiting phases', () => {
    render(<GameLobby isLoading={true} roomCode="ABC123" />)
    expect(screen.getByText('ABC123')).toBeDefined()
  })

  it('renders instruction text above room code', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.getByText(/Send this code/i)).toBeDefined()
  })

  it('renders copy code button when roomCode is provided', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.getByText('Copy')).toBeDefined()
  })

  it('renders share button when inviteUrl is provided', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" inviteUrl="https://example.com/game" />)
    expect(screen.getByText('Share Invite Link')).toBeDefined()
    expect(screen.getByText(/Or share the invite link/i)).toBeDefined()
  })

  it('does not render share section when inviteUrl is missing', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.queryByText(/Or share the invite link/i)).toBeNull()
    expect(screen.queryByText('Share Invite Link')).toBeNull()
  })

  it('does not render connecting text in waiting state', () => {
    render(<GameLobby isLoading={false} />)
    expect(screen.queryByText('Connecting to room...')).toBeNull()
  })

  it('does not render room code section when roomCode is missing', () => {
    render(<GameLobby isLoading={false} />)
    expect(screen.queryByText(/Send this code/i)).toBeNull()
  })

  it('shows the refreshed welcome messaging for waiting players', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" username="Mina" />)
    expect(screen.getByText(/ready/i)).toBeInTheDocument()
    expect(screen.getByText(/Waiting for your teammate/i)).toBeInTheDocument()
  })
})
