export { CoachEngine } from './coachEngine'
export type { EngineMove } from './coachEngine'
export {
  classifyLoss,
  buildSuggestion,
  buildFeedback,
  explainMove,
} from './coachAnalysis'
export type { MoveVerdict, ScoredMove, Suggestion, CoachFeedback } from './coachAnalysis'
export { CoachGame } from './coachGame'
export type { CoachGameState, CoachStatus } from './coachGame'
export { coachVoice } from './coachVoice'
export { saveCoachGame, listCoachGames } from './coachPersistence'
export type { CoachGameRecord, CoachGameResult } from './coachPersistence'
