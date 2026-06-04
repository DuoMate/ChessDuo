import type { PendingOverlay } from '../ChessBoard'

describe('PendingOverlay interface — showTeammateLabel', () => {
  test('accepts showTeammateLabel as true', () => {
    const overlay: PendingOverlay = {
      from: 'e2',
      to: 'e4',
      piece: 'p',
      color: 'white',
      showTeammateLabel: true,
    }
    expect(overlay.showTeammateLabel).toBe(true)
  })

  test('showTeammateLabel defaults to undefined when not set', () => {
    const overlay: PendingOverlay = {
      from: 'd2',
      to: 'd4',
      piece: 'p',
      color: 'black',
    }
    expect(overlay.showTeammateLabel).toBeUndefined()
  })

  test('showTeammateLabel can be false', () => {
    const overlay: PendingOverlay = {
      from: 'g1',
      to: 'f3',
      piece: 'n',
      color: 'white',
      showTeammateLabel: false,
    }
    expect(overlay.showTeammateLabel).toBe(false)
  })

  test('PendingOverlay has all required fields', () => {
    const overlay: PendingOverlay = {
      from: 'b1',
      to: 'c3',
      piece: 'n',
      color: 'black',
    }
    expect(overlay.from).toBe('b1')
    expect(overlay.to).toBe('c3')
    expect(overlay.piece).toBe('n')
    expect(overlay.color).toBe('black')
  })
})
