import { BrowserMoveEvaluator } from './BrowserMoveEvaluator'
import { ServerMoveEvaluator } from '../bots/serverMoveEvaluator'

function isNativePlatform(): boolean {
  return typeof window !== 'undefined'
    && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.()
}

export type GameEvaluator = BrowserMoveEvaluator | ServerMoveEvaluator

export function createEvaluator(serverUrl?: string): GameEvaluator {
  if (isNativePlatform()) {
    return new BrowserMoveEvaluator()
  }

  const url = serverUrl || process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''
  return new ServerMoveEvaluator(url)
}
