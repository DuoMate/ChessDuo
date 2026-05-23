import React from 'react'
import { render } from '@testing-library/react'

jest.mock('../ChessBoard', () => ({
  ChessBoard: (props: Record<string, unknown>) =>
    React.createElement('div', {
      'data-testid': 'chess-board',
      'data-fen': props.fen,
      'data-enabled': String(props.enabled),
      'data-orientation': props.orientation,
      className: 'chess-board-mock',
    }),
  PromotionPiece: {},
  PendingOverlay: {},
  HighlightSquares: {},
}))

import { MobileChessBoard } from '../MobileChessBoard'

describe('MobileChessBoard', () => {
  const defaultProps = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    onMove: jest.fn(),
    enabled: true,
    orientation: 'white' as const,
  }

  it('renders the board container with touch-manipulation class', () => {
    const { container } = render(<MobileChessBoard {...defaultProps} />)
    const wrapper = container.querySelector('.w-full.aspect-square')
    expect(wrapper).toBeTruthy()
    expect(wrapper?.className).toContain('touch-manipulation')
  })

  it('passes fen to ChessBoard', () => {
    const { container } = render(<MobileChessBoard {...defaultProps} />)
    const board = container.querySelector('[data-testid="chess-board"]')
    expect(board).toBeTruthy()
    expect(board?.getAttribute('data-fen')).toContain('rnbqkbnr')
  })

  it('passes enabled prop to ChessBoard', () => {
    const { container } = render(<MobileChessBoard {...defaultProps} enabled={false} />)
    const board = container.querySelector('[data-testid="chess-board"]')
    expect(board?.getAttribute('data-enabled')).toBe('false')
  })

  it('passes orientation to ChessBoard', () => {
    const { container } = render(
      <MobileChessBoard {...defaultProps} orientation="black" />
    )
    const board = container.querySelector('[data-testid="chess-board"]')
    expect(board?.getAttribute('data-orientation')).toBe('black')
  })

  it('renders without layout shift (select-none)', () => {
    const { container } = render(<MobileChessBoard {...defaultProps} />)
    const wrapper = container.querySelector('.w-full.aspect-square')
    expect(wrapper?.className).toContain('select-none')
  })

  it('renders with max-w-full for responsive sizing', () => {
    const { container } = render(<MobileChessBoard {...defaultProps} />)
    const wrapper = container.querySelector('.w-full.aspect-square')
    expect(wrapper?.className).toContain('max-w-full')
  })
})
