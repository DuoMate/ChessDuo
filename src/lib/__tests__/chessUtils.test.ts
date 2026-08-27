import { sanToEvaluationUci } from '../chessUtils'

describe('sanToEvaluationUci', () => {
  test('promotes to queen', () => {
    expect(sanToEvaluationUci('e7', 'e8', 'e8=Q')).toBe('e7e8q')
  })

  test('promotes to rook', () => {
    expect(sanToEvaluationUci('e7', 'e8', 'e8=R')).toBe('e7e8r')
  })

  test('promotes to bishop', () => {
    expect(sanToEvaluationUci('e7', 'e8', 'e8=B')).toBe('e7e8b')
  })

  test('promotes to knight', () => {
    expect(sanToEvaluationUci('e7', 'e8', 'e8=N')).toBe('e7e8n')
  })

  test('promotion by capture', () => {
    expect(sanToEvaluationUci('a7', 'b8', 'axb8=Q')).toBe('a7b8q')
  })

  test('promotion that gives check', () => {
    expect(sanToEvaluationUci('e7', 'e8', 'e8=Q+')).toBe('e7e8q')
  })

test('promotion that gives checkmate', () => {
    expect(sanToEvaluationUci('f7', 'g8', 'fxg8=Q#')).toBe('f7g8q')
  })

  test('normal non-promotion move is unchanged', () => {
    expect(sanToEvaluationUci('e2', 'e4', 'e4')).toBe('e2e4')
  })

  test('castling SAN does not add a promotion suffix', () => {
    expect(sanToEvaluationUci('e1', 'g1', 'O-O')).toBe('e1g1')
  })

  test('missing SAN falls back to from+to', () => {
    expect(sanToEvaluationUci('d7', 'd5', undefined)).toBe('d7d5')
    expect(sanToEvaluationUci('d7', 'd5', null)).toBe('d7d5')
  })
})