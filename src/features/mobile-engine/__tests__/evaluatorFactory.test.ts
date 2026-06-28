import { createEvaluator, GameEvaluator } from '../evaluatorFactory'
import { BrowserMoveEvaluator } from '../BrowserMoveEvaluator'
import { ServerMoveEvaluator } from '../../bots/serverMoveEvaluator'

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

  describe('web platform (no Capacitor)', () => {
    test('creates ServerMoveEvaluator when not on native platform', () => {
      const evaluator = createEvaluator('http://test-server:3001')
      expect(evaluator).toBeInstanceOf(ServerMoveEvaluator)
      expect(evaluator.isUsingStockfish()).toBe(true)
    })

    test('uses provided serverUrl over env var', () => {
      const evaluator = createEvaluator('http://custom:9999')
      expect(evaluator).toBeInstanceOf(ServerMoveEvaluator)
    })

    test('creates evaluator with empty URL when none provided', () => {
      // Temporarily clear env var
      const original = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL
      delete process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL
      try {
        const evaluator = createEvaluator()
        expect(evaluator).toBeInstanceOf(ServerMoveEvaluator)
        expect(evaluator.isUsingStockfish()).toBe(false)
      } finally {
        process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL = original
      }
    })
  })

  describe('mobile platform (Capacitor)', () => {
    test('creates BrowserMoveEvaluator when on native platform', () => {
      if (typeof window !== 'undefined') {
        ;(window as any).Capacitor = {
          isNativePlatform: () => true
        }
      }
      const evaluator = createEvaluator()
      expect(evaluator).toBeInstanceOf(BrowserMoveEvaluator)
    })

    test('BrowserMoveEvaluator reports isUsingStockfish as true', () => {
      if (typeof window !== 'undefined') {
        ;(window as any).Capacitor = {
          isNativePlatform: () => true
        }
      }
      const evaluator = createEvaluator()
      expect(evaluator.isUsingStockfish()).toBe(true)
    })

    test('BrowserMoveEvaluator reports getInitError when not yet ready', () => {
      if (typeof window !== 'undefined') {
        ;(window as any).Capacitor = {
          isNativePlatform: () => true
        }
      }
      const evaluator = createEvaluator()
      if (evaluator instanceof BrowserMoveEvaluator) {
        expect(evaluator.isReady()).toBe(false)
        expect(typeof evaluator.getInitError() === 'string' || evaluator.getInitError() === null).toBe(true)
      }
    })
  })
})
