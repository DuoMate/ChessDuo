import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeDisclaimer } from '../WelcomeDisclaimer'

describe('WelcomeDisclaimer', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders when open is true', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} />)
    expect(screen.getByText('ChessDuo')).toBeDefined()
    expect(screen.getByText('Got it!')).toBeDefined()
  })

  it('does not render when open is false', () => {
    render(<WelcomeDisclaimer open={false} onDismiss={jest.fn()} />)
    expect(screen.queryByText('ChessDuo')).toBeNull()
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

  it('does not save to localStorage when checkbox is unchecked', () => {
    const onDismiss = jest.fn()
    render(<WelcomeDisclaimer open={true} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByText('Got it!'))
    expect(localStorage.getItem('chessduo_welcome_dismissed')).toBeNull()
  })

  it('shows rules about two players and bot', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} />)
    expect(screen.getByText(/you & your teammate/i)).toBeDefined()
    expect(screen.getByText(/pick your move/i)).toBeDefined()
    expect(screen.getByText(/better move wins/i)).toBeDefined()
  })

  it('shows winner/loser indicators', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} />)
    expect(screen.getByText('Winner')).toBeDefined()
    expect(screen.getByText('Loser')).toBeDefined()
  })

  it('uses custom storageKey when provided', () => {
    const onDismiss = jest.fn()
    render(
      <WelcomeDisclaimer
        open={true}
        onDismiss={onDismiss}
        storageKey="chessduo_offline_disclaimer_dismissed"
      />
    )

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText('Got it!'))

    expect(localStorage.getItem('chessduo_offline_disclaimer_dismissed')).toBe('true')
    expect(localStorage.getItem('chessduo_welcome_dismissed')).toBeNull()
  })

  it('uses default storageKey when not provided', () => {
    const onDismiss = jest.fn()
    render(<WelcomeDisclaimer open={true} onDismiss={onDismiss} />)

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText('Got it!'))

    expect(localStorage.getItem('chessduo_welcome_dismissed')).toBe('true')
  })
})
