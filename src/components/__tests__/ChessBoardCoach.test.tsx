import React from 'react'
import { render, screen } from '@testing-library/react'
import { mockAddMarker, resetCaptured } from '../../__mocks__/cm-chessboard'

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => {
      const { animate, initial, exit, transition, ...rest } = props
      return React.createElement('div', { ...rest, ref })
    }),
    span: React.forwardRef((props: any, ref: any) => {
      const { animate, initial, exit, transition, ...rest } = props
      return React.createElement('span', { ...rest, ref })
    }),
  },
  AnimatePresence: ({ children }: any) => children,
}))

import { ChessBoard } from '../ChessBoard'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('ChessBoard coach top-3', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetCaptured()
  })

  test('renders ①②③ badges with distinct marker types per rank', () => {
    render(
      <ChessBoard
        fen={START_FEN}
        onMove={jest.fn()}
        enabled={false}
        orientation="white"
        highlightSquares={{
          coachMoves: [
            { from: 'e2', to: 'e4', rank: 1 },
            { from: 'g1', to: 'f3', rank: 2 },
            { from: 'd2', to: 'd4', rank: 3 },
          ],
        }}
      />,
    )

    // Numbered endpoint badges — visible without zooming
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Distinct marker types (never color-only): frame / framePrimary / circle
    const classes = mockAddMarker.mock.calls.map((c: any[]) => c[0]?.class)
    expect(classes).toContain('frame')
    expect(classes).toContain('framePrimary')
    expect(classes).toContain('circle')
  })

  test('same destination renders all three badges (no hide)', () => {
    render(
      <ChessBoard
        fen={START_FEN}
        onMove={jest.fn()}
        enabled={false}
        orientation="white"
        highlightSquares={{
          coachMoves: [
            { from: 'e2', to: 'e4', rank: 1 },
            { from: 'd2', to: 'e4', rank: 2 },
            { from: 'f2', to: 'e4', rank: 3 },
          ],
        }}
      />,
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('no coachMoves renders no rank badges', () => {
    render(<ChessBoard fen={START_FEN} onMove={jest.fn()} enabled={false} orientation="white" highlightSquares={null} />)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })
})
