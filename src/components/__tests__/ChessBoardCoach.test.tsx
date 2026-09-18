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

  test('renders ①②③ badges on destinations only with paired rank colors', () => {
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

    // Numbered badges live ONLY on destinations — the number ranks the
    // destination (1 = Best, 2 = Strong alternative, 3 = Alternative).
    // getAllByText finds exactly one per rank (the destination badge).
    expect(screen.getAllByText('1')).toHaveLength(1)
    expect(screen.getAllByText('2')).toHaveLength(1)
    expect(screen.getAllByText('3')).toHaveLength(1)

    // Rank is never color-only (number + paired color), and no generic
    // cm-chessboard markers remain (shutter/purple/circle removed).
    expect(mockAddMarker).not.toHaveBeenCalled()
  })

  test('origin and destination share the same rank color; badges on destinations only', () => {
    const { container } = render(
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

    // Each rank renders an origin frame (no badge) + a destination frame
    // (badged). Both share the same semantic color var.
    const origins = container.querySelectorAll('[data-coach-origin]')
    const dests = container.querySelectorAll('[data-coach-dest]')
    expect(origins).toHaveLength(3)
    expect(dests).toHaveLength(3)

    const colorFor = (rank: string) =>
      rank === '1'
        ? 'var(--color-coach-best)'
        : rank === '2'
          ? 'var(--color-coach-insight)'
          : 'var(--color-coach-alt)'

    for (const rank of ['1', '2', '3']) {
      const origin = container.querySelector(`[data-coach-origin="${rank}"]`)
      const dest = container.querySelector(`[data-coach-dest="${rank}"]`)
      expect(origin).not.toBeNull()
      expect(dest).not.toBeNull()
      // Same visual identity: same border color on origin + destination.
      expect((origin as HTMLElement).style.borderColor).toBe(colorFor(rank))
      expect((dest as HTMLElement).style.borderColor).toBe(colorFor(rank))
      // Number lives ONLY on the destination; the origin frame is unbadged.
      expect(origin?.textContent).not.toContain(rank)
      expect(dest?.textContent).toContain(rank)
    }

    // No generic cm-chessboard markers for coach moves (removes the
    // camera-shutter frame / purple-blue / faint-circle origins).
    expect(mockAddMarker).not.toHaveBeenCalled()
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
    expect(screen.getAllByText('1')).toHaveLength(1)
    expect(screen.getAllByText('2')).toHaveLength(1)
    expect(screen.getAllByText('3')).toHaveLength(1)
  })

  test('no coachMoves renders no rank badges', () => {
    render(<ChessBoard fen={START_FEN} onMove={jest.fn()} enabled={false} orientation="white" highlightSquares={null} />)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })
})
