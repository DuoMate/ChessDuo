import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomNav } from '../BottomNav'

describe('BottomNav', () => {
  const defaultProps = {
    activeOverlay: 'none' as const,
    onProfileClick: jest.fn(),
    onHistoryClick: jest.fn(),
    onSoundToggle: jest.fn(),
    soundEnabled: true,
  }

  it('renders all navigation buttons', () => {
    render(<BottomNav {...defaultProps} />)
    expect(screen.getByText('Profile')).toBeDefined()
    expect(screen.getByText('History')).toBeDefined()
    expect(screen.getByText('Mute')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
  })

  it('calls onProfileClick when profile is clicked', () => {
    render(<BottomNav {...defaultProps} />)
    fireEvent.click(screen.getByText('Profile'))
    expect(defaultProps.onProfileClick).toHaveBeenCalled()
  })

  it('calls onHistoryClick when history is clicked', () => {
    render(<BottomNav {...defaultProps} />)
    fireEvent.click(screen.getByText('History'))
    expect(defaultProps.onHistoryClick).toHaveBeenCalled()
  })

  it('calls onSoundToggle when sound button is clicked', () => {
    render(<BottomNav {...defaultProps} />)
    fireEvent.click(screen.getByText('Mute'))
    expect(defaultProps.onSoundToggle).toHaveBeenCalled()
  })

  it('shows Sound label when sound is disabled', () => {
    render(<BottomNav {...defaultProps} soundEnabled={false} />)
    expect(screen.getByText('Sound')).toBeDefined()
  })

  it('shows Mute label when sound is enabled', () => {
    render(<BottomNav {...defaultProps} soundEnabled={true} />)
    expect(screen.getByText('Mute')).toBeDefined()
  })

  it('highlights active profile button', () => {
    render(<BottomNav {...defaultProps} activeOverlay="profile" />)
    const profileButton = screen.getByText('Profile').closest('button')
    expect(profileButton?.className).toContain('text-yellow-400')
  })

  it('highlights active history button', () => {
    render(<BottomNav {...defaultProps} activeOverlay="history" />)
    const historyButton = screen.getByText('History').closest('button')
    expect(historyButton?.className).toContain('text-yellow-400')
  })

  it('profile button is always enabled (guests can tap to see sign-in prompt)', () => {
    render(<BottomNav {...defaultProps} />)
    const profileButton = screen.getByText('Profile').closest('button')
    expect(profileButton).not.toBeDisabled()
  })

  it('home button is always clickable', () => {
    render(<BottomNav {...defaultProps} />)
    const homeButton = screen.getByText('Home')
    expect(homeButton).toBeDefined()
    expect(homeButton.closest('button')).not.toBeDisabled()
  })
})
