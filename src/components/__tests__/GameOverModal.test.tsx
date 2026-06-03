import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameOverModal } from '../GameOverModal'

describe('GameOverModal', () => {
  it('renders with close button when onClose is provided', () => {
    render(
      <GameOverModal
        winner="WHITE"
        onPlayAgain={jest.fn()}
        onClose={jest.fn()}
      />
    )
    expect(screen.getByLabelText('Close')).toBeDefined()
  })

  it('does not render close button when onClose is not provided', () => {
    render(
      <GameOverModal winner="WHITE" onPlayAgain={jest.fn()} />
    )
    expect(screen.queryByLabelText('Close')).toBeNull()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    render(
      <GameOverModal winner="WHITE" onPlayAgain={jest.fn()} onClose={onClose} />
    )
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onPlayAgain when button is clicked', () => {
    const onPlayAgain = jest.fn()
    render(<GameOverModal winner="DRAW" onPlayAgain={onPlayAgain} />)
    fireEvent.click(screen.getByText('Play Again'))
    expect(onPlayAgain).toHaveBeenCalled()
  })

  it('shows Go Home for abandoned matches', () => {
    render(
      <GameOverModal winner="WHITE" onPlayAgain={jest.fn()} gameOverReason="abandoned" />
    )
    expect(screen.getByText('Match Abandoned')).toBeDefined()
    expect(screen.getByText('Go Home')).toBeDefined()
  })

  it('does not render signup prompt', () => {
    render(<GameOverModal winner="WHITE" onPlayAgain={jest.fn()} />)
    expect(screen.queryByText(/create a profile/i)).toBeNull()
    expect(screen.queryByText(/enjoyed the game/i)).toBeNull()
  })
})
