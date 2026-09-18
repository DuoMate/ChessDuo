import { ChessPawn, ChessKnight, ChessBishop, ChessRook, Crown } from 'lucide-react'

export interface DifficultyLevelOption {
  level: number
  label: string
  Icon: typeof ChessPawn
  description: string
}

/**
 * Shared bot-difficulty options — the SAME 5 levels exposed by Quick Play / Duo
 * on the home screen. Single source of truth for every setup surface
 * (home, desktop ConfigurationPanel, AI Coach setup).
 *
 * Engine mapping lives in `src/features/bots/difficulty.ts` (6 tiers; the UI
 * uses levels 1-5 one-to-one). Never duplicate these labels elsewhere.
 */
/** localStorage key shared with the home screen — setup selections persist across visits. */
export const SELECTED_LEVEL_KEY = 'chessduo_selected_level'

export const DIFFICULTY_LEVELS: DifficultyLevelOption[] = [
  { level: 1, label: 'Easy', Icon: ChessPawn, description: 'Great for learning. Bots make occasional mistakes and miss tactical opportunities.' },
  { level: 2, label: 'Medium', Icon: ChessKnight, description: 'Balanced play that does not punish mistakes too harshly. Good for casual games.' },
  { level: 3, label: 'Hard', Icon: ChessBishop, description: 'Bots play solid chess and capitalize on obvious errors. Expect a challenge.' },
  { level: 4, label: 'Expert', Icon: ChessRook, description: 'Strong positional moves and punishing tactics. Recommended for experienced players.' },
  { level: 5, label: 'Master', Icon: Crown, description: 'Near-perfect play with deep calculation. Only for the most skilled players.' },
]
