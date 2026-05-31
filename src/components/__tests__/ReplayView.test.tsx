import React from 'react'
import { render, screen } from '@testing-library/react'
import { ReplayView } from '../../components/ReplayView'
import { CompletedGame } from '@/lib/matchHistory'

jest.mock('../../components/ChessBoard', () => ({
  ChessBoard: () => React.createElement('div', { 'data-testid': 'chess-board' }),
}))

jest.mock('../../components/MobileChessBoard', () => ({
  MobileChessBoard: () => React.createElement('div', { 'data-testid': 'mobile-chess-board' }),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => React.createElement('div', props, children),
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

const mockGame: CompletedGame = {
  id: 'test-game-1',
  room_id: null,
  winner: 'WHITE',
  game_result: 'White wins by checkmate',
  game_over_reason: 'checkmate',
  white_moves: 12,
  white_sync_rate: 0.75,
  white_conflicts: 2,
  player1_accuracy: 88,
  player2_accuracy: 92,
  total_moves: 24,
  is_online: false,
  move_comparisons: [
    {
      turn: 1,
      team: 'WHITE',
      winningMove: 'e4',
      winningMoveUci: 'e2e4',
      shadowMove: null,
      shadowMoveUci: null,
      isSync: true,
      player1Accuracy: 95,
      player2Accuracy: 95,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    },
    {
      turn: 2,
      team: 'WHITE',
      winningMove: 'Nf3',
      winningMoveUci: 'g1f3',
      shadowMove: 'Nc3',
      shadowMoveUci: 'b1c3',
      isSync: false,
      player1Accuracy: 90,
      player2Accuracy: 45,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 1',
    },
  ],
  challenge_id: null,
  played_at: '2026-05-31T12:00:00Z',
  created_at: '2026-05-31T12:00:00Z',
}

const emptyMovesGame: CompletedGame = {
  ...mockGame,
  id: 'test-game-empty',
  move_comparisons: [],
  white_moves: 0,
}

describe('ReplayView Component', () => {
  test('renders winner result', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText('White Wins')).toBeDefined()
  })

  test('renders game result description', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText('White wins by checkmate')).toBeDefined()
  })

  test('renders match stats', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText(/12 moves/)).toBeDefined()
  })

  test('renders sync rate', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText('Sync 75%')).toBeDefined()
  })

  test('renders player accuracy', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText(/P1: 88%/)).toBeDefined()
    expect(screen.getByText(/P2: 92%/)).toBeDefined()
  })

  test('renders moves in MovePlayback', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText('e4')).toBeDefined()
    expect(screen.getByText('Nf3')).toBeDefined()
  })

  test('shows sync checkmark for synced moves', () => {
    const { container } = render(<ReplayView game={mockGame} />)
    expect(container.innerHTML).toContain('✓')
  })

  test('shows shadow move for conflicting moves', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText('Nc3')).toBeDefined()
  })

  test('shows empty state when no moves', () => {
    render(<ReplayView game={emptyMovesGame} />)
    expect(screen.getByText('No move data available for this game.')).toBeDefined()
  })

  test('renders back button', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText('Back')).toBeDefined()
  })

  test('renders game mode indicator', () => {
    render(<ReplayView game={mockGame} />)
    expect(screen.getByText('Offline')).toBeDefined()
  })
})
