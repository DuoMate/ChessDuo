import React from 'react'
import { render, screen } from '@testing-library/react'
import { TurnStatusArea } from '../TurnStatusArea'

// Mock animejs
jest.mock('animejs', () => ({
  Timeline: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockReturnThis(),
    pause: jest.fn(),
    seek: jest.fn(),
  })),
}))

describe('TurnStatusArea', () => {
  const baseProps = {
    seconds: 180,
    isActive: true,
    totalSeconds: 300,
    isMobile: false,
  }

  it('renders timer in idle state', () => {
    render(<TurnStatusArea {...baseProps} state="idle" />)
    expect(screen.getByText('3:00')).toBeDefined()
  })

  it('renders evaluating pulse in resolving state', () => {
    render(<TurnStatusArea {...baseProps} state="resolving" />)
    expect(screen.getByText(/evaluating/i)).toBeDefined()
  })

  it('renders selected move badge in selected state', () => {
    render(<TurnStatusArea {...baseProps} state="selected" selectedMove="e4" />)
    expect(screen.getByText('e4')).toBeDefined()
    expect(screen.getByText(/move locked/i)).toBeDefined()
  })

  it('renders bot thinking indicator in bot_thinking state', () => {
    render(<TurnStatusArea {...baseProps} state="bot_thinking" />)
    expect(screen.getByText(/bot is thinking/i)).toBeDefined()
  })

  it('shows warning color when active and time is low', () => {
    render(<TurnStatusArea {...baseProps} state="idle" seconds={45} isActive={true} />)
    expect(screen.getByText('0:45')).toBeDefined()
  })

  it('shows inactive color when timer is not active', () => {
    render(<TurnStatusArea {...baseProps} state="idle" isActive={false} />)
    expect(screen.getByText('3:00')).toBeDefined()
  })
})
