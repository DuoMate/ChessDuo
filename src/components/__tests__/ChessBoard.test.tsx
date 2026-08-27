import React from 'react'
import { render, act } from '@testing-library/react'
import { Chess } from 'chess.js'
import {
  mockAddMarker,
  mockRemoveMarkers,
  mockEnableMoveInput,
  mockSetPosition,
  getLastHandler,
  getLastColor,
  resetCaptured,
  INPUT_EVENT_TYPE,
} from '../../__mocks__/cm-chessboard'

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

describe('ChessBoard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetCaptured()
  })

  const mount = (props: Partial<Parameters<typeof ChessBoard>[0]> = {}) => {
    return render(
      React.createElement(ChessBoard, {
        fen: START_FEN,
        onMove: jest.fn(),
        enabled: true,
        orientation: 'white',
        ...props,
      } as Parameters<typeof ChessBoard>[0])
    )
  }

  describe('step assist dots', () => {
    test('moveInputStarted clears existing dots before adding new ones', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'e2' })
      })

      expect(mockRemoveMarkers).toHaveBeenCalled()
    })

    test('moveInputStarted adds dots for all legal destinations of selected piece', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        const result = handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'e2' })
        expect(result).toBe(true)
      })

      const chess = new Chess()
      const expectedMoves = chess.moves({ square: 'e2' as any, verbose: true })

      expect(mockAddMarker).toHaveBeenCalledTimes(expectedMoves.length)
      for (const move of expectedMoves) {
        expect(mockAddMarker).toHaveBeenCalledWith(
          expect.objectContaining({ class: 'dot' }),
          move.to
        )
      }
    })

    test('moveInputStarted for empty square does not crash', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        const result = handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'e4' })
        expect(result).toBe(true)
      })

      expect(mockAddMarker).not.toHaveBeenCalled()
    })

    test('moveInputCanceled clears dots', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'e2' })
      })
      expect(mockAddMarker).toHaveBeenCalled()

      act(() => {
        const result = handler({ type: INPUT_EVENT_TYPE.moveInputCanceled })
        expect(result).toBe(true)
      })

      const removeCalls = mockRemoveMarkers.mock.calls.filter(
        (call: any[]) => call[0] !== undefined
      )
      expect(removeCalls.length).toBeGreaterThanOrEqual(1)
    })

    test('moveInputFinished clears dots', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'e2' })
      })

      act(() => {
        const result = handler({ type: INPUT_EVENT_TYPE.moveInputFinished, squareFrom: 'e2', squareTo: 'e4' })
        expect(result).toBe(true)
      })

      const removeCalls = mockRemoveMarkers.mock.calls.filter(
        (call: any[]) => call[0] !== undefined
      )
      expect(removeCalls.length).toBeGreaterThanOrEqual(1)
    })

    test('selecting different piece clears old dots and shows new ones', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'e2' })
      })

      act(() => {
        const result = handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'd2' })
        expect(result).toBe(true)
      })

      const chess = new Chess()
      const d2Moves = chess.moves({ square: 'd2' as any, verbose: true })

      const totalD2Calls = mockAddMarker.mock.calls.filter((call: any[]) =>
        call[0]?.class === 'dot' && d2Moves.some(m => m.to === call[1])
      ).length
      expect(totalD2Calls).toBe(d2Moves.length)
    })

    test('moveInputStarted returns true even when piece has no legal moves', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        const result = handler({ type: INPUT_EVENT_TYPE.moveInputStarted, squareFrom: 'a1' })
        expect(result).toBe(true)
      })

      expect(mockAddMarker).not.toHaveBeenCalled()
    })

    test('moveInputStarted returns true when squareFrom is missing', () => {
      mount()
      const handler = getLastHandler()
      expect(handler).not.toBeNull()

      act(() => {
        const result = handler({ type: INPUT_EVENT_TYPE.moveInputStarted })
        expect(result).toBe(true)
      })

      expect(mockAddMarker).not.toHaveBeenCalled()
    })
  })

  describe('castling animation', () => {
    test('animates setPosition when lastMove is a castle', () => {
      mount({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', lastMove: { from: 'e1', to: 'g1' } })
      expect(mockSetPosition).toHaveBeenLastCalledWith(
        'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
        true
      )
    })

    test('animates black queenside castle', () => {
      mount({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', lastMove: { from: 'e8', to: 'c8' } })
      expect(mockSetPosition).toHaveBeenLastCalledWith(
        'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',
        true
      )
    })

    test('does not animate a normal move', () => {
      mount({ fen: START_FEN, lastMove: { from: 'e2', to: 'e4' } })
      expect(mockSetPosition).toHaveBeenLastCalledWith(START_FEN, false)
    })

    test('does not animate when there is no lastMove', () => {
      mount({ fen: START_FEN, lastMove: null })
      expect(mockSetPosition).toHaveBeenLastCalledWith(START_FEN, false)
    })
  })

  describe('board enabled/disabled', () => {
    test('enabled=true allows move input', () => {
      mount({ enabled: true })
      expect(mockEnableMoveInput).toHaveBeenCalled()
    })

    test('orientation=black passes COLOR.black', () => {
      mount({ orientation: 'black' })
      expect(getLastColor()).toBe('black')
    })

    test('orientation=white passes COLOR.white', () => {
      mount({ orientation: 'white' })
      expect(getLastColor()).toBe('white')
    })

    test('disabled board does not enable move input', () => {
      mount({ enabled: false })
      expect(mockEnableMoveInput).not.toHaveBeenCalled()
    })
  })
})
