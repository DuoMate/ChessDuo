import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameOverModal } from '../GameOverModal'

describe('GameOverModal', () => {
  it('renders with close button when onClose is provided', () => {
    render(
      <GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} onClose={jest.fn()} />
    )
    expect(screen.getByLabelText('Close')).toBeDefined()
  })

  it('does not render close button when onClose is not provided', () => {
    render(<GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} />)
    expect(screen.queryByLabelText('Close')).toBeNull()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    render(<GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders Play Again button for non-abandoned matches', () => {
    render(<GameOverModal open={true} winner="DRAW" onPlayAgain={jest.fn()} />)
    expect(screen.getByText('Play Again')).toBeDefined()
  })

  it('calls onPlayAgain when Play Again button is clicked', () => {
    const onPlayAgain = jest.fn()
    render(<GameOverModal open={true} winner="DRAW" onPlayAgain={onPlayAgain} />)
    fireEvent.click(screen.getByText('Play Again'))
    expect(onPlayAgain).toHaveBeenCalled()
  })

  it('renders Review Board button for non-abandoned matches', () => {
    render(<GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByText('Review Board')).toBeDefined()
  })

  it('calls onClose when Review Board is clicked', () => {
    const onClose = jest.fn()
    render(<GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByText('Review Board'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Go Home for abandoned matches', () => {
    render(<GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} gameOverReason="abandoned" />)
    expect(screen.getByText('Match Abandoned')).toBeDefined()
    expect(screen.getByText('Go Home')).toBeDefined()
    expect(screen.queryByText('Play Again')).toBeNull()
  })

  it('shows trophy icon for White win', () => {
    const { container } = render(<GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} />)
    expect(container.querySelector('.lucide-trophy')).toBeDefined()
  })

  it('shows handshake icon for draw', () => {
    const { container } = render(<GameOverModal open={true} winner="DRAW" onPlayAgain={jest.fn()} />)
    expect(container.querySelector('.lucide-handshake')).toBeDefined()
  })

  it('does not render an embedded ad slot', () => {
    render(<GameOverModal open={true} winner="WHITE" onPlayAgain={jest.fn()} />)
    expect(screen.queryByText('Advertisement')).toBeNull()
    expect(screen.queryByText('Ad will appear here')).toBeNull()
  })
})
