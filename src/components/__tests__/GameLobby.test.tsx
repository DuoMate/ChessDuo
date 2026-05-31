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

describe('GameLobby Component', () => {
  it('renders connecting state when isLoading is true', () => {
    render(<GameLobby isLoading={true} />)
    expect(screen.getByText('Connecting to room...')).toBeDefined()
  })

  it('renders waiting state when isLoading is false', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.getByText('Connected')).toBeDefined()
    expect(screen.getByText('Waiting for teammate')).toBeDefined()
  })

  it('renders room code when provided', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.getByText('ABC123')).toBeDefined()
  })

  it('renders copy code button in waiting state', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.getByText('Copy code')).toBeDefined()
  })

  it('renders share button when inviteUrl is provided', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" inviteUrl="https://example.com/game" />)
    expect(screen.getByText('Share link')).toBeDefined()
  })

  it('does not render share section when inviteUrl is missing', () => {
    render(<GameLobby isLoading={false} roomCode="ABC123" />)
    expect(screen.queryByText('Share link')).toBeNull()
  })

  it('does not render connecting text in waiting state', () => {
    render(<GameLobby isLoading={false} />)
    expect(screen.queryByText('Connecting to room...')).toBeNull()
  })

  it('does not render room code section when roomCode is missing', () => {
    render(<GameLobby isLoading={false} />)
    expect(screen.queryByText('Room code')).toBeNull()
  })
})
