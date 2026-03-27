import { Chess } from 'chess.js'

describe('Chess Move Validation', () => {
  let chess: Chess

  beforeEach(() => {
    chess = new Chess()
  })

  test('validates legal chess moves', () => {
    const result = chess.move('e4')
    expect(result).not.toBeNull()
    const fen = chess.fen()
    expect(fen).toMatch(/4P3/)
  })

  test('rejects illegal chess moves', () => {
    expect(() => chess.move('e5')).toThrow()
  })

  test('tracks turn correctly', () => {
    expect(chess.turn()).toBe('w')
    chess.move('e4')
    expect(chess.turn()).toBe('b')
  })

  test('gets legal moves for a position', () => {
    const moves = chess.moves()
    expect(moves.length).toBeGreaterThan(0)
    expect(moves).toContain('e4')
  })

  test('resets to initial position', () => {
    chess.move('e4')
    chess.move('e5')
    chess.reset()
    expect(chess.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  })
})
