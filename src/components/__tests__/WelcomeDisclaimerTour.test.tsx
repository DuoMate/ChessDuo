import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeDisclaimer } from '../WelcomeDisclaimer'

describe('WelcomeDisclaimer', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders when open is true', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} />)
    expect(screen.getByText('Chess')).toBeDefined()
    expect(screen.getByText('Duo')).toBeDefined()
    expect(screen.getByText('Got it!')).toBeDefined()
  })

  it('does not render Take a Tour button (removed)', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} />)
    expect(screen.queryByText('Take a Tour')).toBeNull()
  })

  it('calls onDismiss when Got it is clicked', () => {
    const onDismiss = jest.fn()
    render(<WelcomeDisclaimer open={true} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Got it!'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('saves to localStorage when checkbox is checked', () => {
    const onDismiss = jest.fn()
    render(<WelcomeDisclaimer open={true} onDismiss={onDismiss} />)
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText('Got it!'))
    expect(localStorage.getItem('chessduo_welcome_dismissed')).toBe('true')
  })

  it('shows online-specific caption', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} mode="online" />)
    expect(screen.getByText(/two players, one board/i)).toBeDefined()
  })

  it('shows offline-specific caption', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} mode="offline" />)
    const matches = screen.getAllByText(/botmate/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
