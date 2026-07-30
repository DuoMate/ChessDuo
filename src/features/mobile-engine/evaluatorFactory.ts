import { BrowserMoveEvaluator } from './BrowserMoveEvaluator'

export type GameEvaluator = BrowserMoveEvaluator

let sharedEvaluator: BrowserMoveEvaluator | null = null

export function createEvaluator(): BrowserMoveEvaluator {
  if (!sharedEvaluator) {
    sharedEvaluator = new BrowserMoveEvaluator()
  }
  return sharedEvaluator
}

export function getSharedEvaluator(): BrowserMoveEvaluator | null {
  return sharedEvaluator
}
