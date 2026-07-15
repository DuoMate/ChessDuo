import { BrowserMoveEvaluator } from './BrowserMoveEvaluator'

export type GameEvaluator = BrowserMoveEvaluator

export function createEvaluator(_serverUrl?: string): GameEvaluator {
  return new BrowserMoveEvaluator()
}
