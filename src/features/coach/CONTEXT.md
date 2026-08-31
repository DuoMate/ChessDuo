# Module: Coach Mode (Premium AI Coach)

## Purpose
Isolated, modular premium game mode: Player vs AI with an advisory Stockfish coach (position evaluation, top-3 moves, blunder/missed-opportunity detection, natural-language explanations, optional voice). Fully decoupled from Duo/Quick Play/Duel.

## Files
| File | Purpose |
|------|---------|
| `coachGame.ts` | `CoachGame` — PvE lifecycle (chess.js + `ChessBot` opponent + `CoachEngine`) |
| `coachEngine.ts` | `CoachEngine` — dedicated Stockfish worker (MultiPV-per-query), top-N analysis |
| `coachAnalysis.ts` | Pure analysis — top-3, blunder/miss classification, verdict, explanation text |
| `coachVoice.ts` | Optional TTS (`coachVoice`) — web SpeechSynthesis + Capacitor TTS, graceful degrade |
| `coachPersistence.ts` | Isolated `coach_games` persistence (save/list) |
| `index.ts` | Public API re-exports |

## Logic & Decisions
- **Isolation rule**: Coach Mode does NOT implement `GameInterface` and must never import/alter `localGame`/`onlineGame`/`duelGame`/`gameState`. It owns its board (chess.js) and its engine (its own Worker).
- Opponent reuses `ChessBot` + `difficulty.ts` (read-only).
- `CoachEngine` owns a separate Worker (MultiPV set per query) — never the shared `BrowserMoveEvaluator` singleton.
- Analysis is advisory only: any engine failure degrades to "coach unavailable"; the game never hangs.
- Premium enforcement lives in the UI layer (`components/coach/CoachGate.tsx`), not here.
- `coach_games` table + RLS (player-scoped) is separate from `games`/`completed_games`.

## Dependencies
- `chess.js`, `features/bots` (ChessBot), `features/shared/accuracy`, `features/shared/gameConstants`
- `@capacitor-community/text-to-speech` (Android voice, optional), `@capacitor/core`
- `lib/supabase` (persistence)

## Recent Changes
- **2026-08-29**: Initial implementation (Coach Mode feature branch).
