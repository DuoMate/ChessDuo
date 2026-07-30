import { createEvaluator, GameEvaluator } from '../evaluatorFactory'
import { BrowserMoveEvaluator } from '../BrowserMoveEvaluator'

describe('evaluatorFactory', () => {
  const originalPlatform = typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>).Capacitor
    : undefined

  afterEach(() => {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>
      if (originalPlatform) {
        w.Capacitor = originalPlatform
      } else {
        delete w.Capacitor
      }
    }
  })

  test('always creates BrowserMoveEvaluator (WASM client-side)', () => {
    const evaluator = createEvaluator()
    expect(evaluator).toBeInstanceOf(BrowserMoveEvaluator)
    expect(evaluator.isUsingStockfish()).toBe(true)
  })

  test('BrowserMoveEvaluator reports getInitError when not yet ready', () => {
    const evaluator = createEvaluator()
    if (evaluator instanceof BrowserMoveEvaluator) {
      expect(evaluator.isReady()).toBe(false)
      expect(typeof evaluator.getInitError() === 'string' || evaluator.getInitError() === null).toBe(true)
    }
  })
})
