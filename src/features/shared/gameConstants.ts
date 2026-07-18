export const CHECKMATE_SCORE = 10000

export const DEFAULT_TEAM_TIMER_SECONDS = 600

export const DEFAULT_MOVE_TIMER_SECONDS = 10

export const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_POLLING_INTERVAL_MS = 2000

export const INSIGHTS_FREE_LIMIT = 3

export type PlayerColor = 'white' | 'black' | 'random'

export type ResolvedColor = 'white' | 'black'

export const DEFAULT_PLAYER_COLOR: PlayerColor = 'white'

export const BROWSER_BOT_LEVEL = 3

export const SELECTED_COLOR_KEY = 'chessduo_selected_color'

export function resolvePlayerColor(color: PlayerColor): ResolvedColor {
  if (color === 'random') {
    return Math.random() < 0.5 ? 'white' : 'black'
  }
  return color
}
