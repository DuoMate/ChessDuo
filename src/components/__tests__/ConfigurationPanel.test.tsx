import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfigurationPanel } from '../ConfigurationPanel'

describe('ConfigurationPanel', () => {
  const defaultProps = {
    open: true,
    selectedColor: 'white' as const,
    onColorChange: jest.fn(),
    onClose: jest.fn(),
    onStart: jest.fn(),
    modeTitle: 'Quick Play',
    modeSubtitle: 'You + Bot vs Bots',
    botLevelLabel: 'Medium',
    botLevelDescription: 'Intermediate bot strength.',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the three sections when open', () => {
    render(<ConfigurationPanel {...defaultProps} />)
    expect(screen.getByText(/Game Mode/i)).toBeDefined()
    expect(screen.getByText(/Bot Difficulty/i)).toBeDefined()
    expect(screen.getByText(/Choose Your/i)).toBeDefined()
  })

  it('does not render content when closed', () => {
    render(<ConfigurationPanel {...defaultProps} open={false} />)
    expect(screen.queryByText(/Game Mode/i)).toBeNull()
  })

  it('shows the selected color in the color picker', () => {
    render(<ConfigurationPanel {...defaultProps} selectedColor="black" />)
    const black = screen.getByRole('radio', { name: /black pieces/i })
    expect(black.getAttribute('aria-checked')).toBe('true')
  })

  it('calls onColorChange when a color card is clicked', () => {
    const onColorChange = jest.fn()
    render(<ConfigurationPanel {...defaultProps} onColorChange={onColorChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /random color/i }))
    expect(onColorChange).toHaveBeenCalledWith('random')
  })

  it('calls onStart with the chosen color when Start Game is clicked', () => {
    const onStart = jest.fn()
    render(<ConfigurationPanel {...defaultProps} selectedColor="black" onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: /start game/i }))
    expect(onStart).toHaveBeenCalledWith('black')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    render(<ConfigurationPanel {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close configuration/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<ConfigurationPanel {...defaultProps} onClose={onClose} />)
    const backdrop = document.querySelector('.fixed.inset-0.z-50') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('Start Game button is enabled when a color is selected', () => {
    render(<ConfigurationPanel {...defaultProps} selectedColor="white" />)
    expect(screen.getByRole('button', { name: /start game/i })).not.toBeDisabled()
  })

  it('displays the bot difficulty label and description', () => {
    render(<ConfigurationPanel {...defaultProps} botLevelLabel="Hard" botLevelDescription="Strong bot." />)
    expect(screen.getByText('Hard')).toBeDefined()
    expect(screen.getByText('Strong bot.')).toBeDefined()
  })
})
