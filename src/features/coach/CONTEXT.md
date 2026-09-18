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
| `coachTrial.ts` | Daily quota layer (N per UTC day): eligibility, idempotent claim, server + local mirror, central messages |
| `__tests__/coachDailyLimit.test.ts` | Config single-source-of-truth contract (limit value, derived messages, day math) |
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
- **2026-09-18**: Central daily allowance (`AI_COACH_FREE_DAILY_LIMIT = 3`, `AI_COACH_FREE_DAILY_LIMIT_ENABLED`, single source of truth in `shared/gameConstants.ts`): `coachTrial.ts` rewritten to N-games-per-UTC-calendar-day (`coach_free_day` + `coach_free_count`, legacy timestamp tolerated; local mirror `{day,count}` with legacy-shape compat; idempotent per-session claim; UTC-midnight reset; fail-closed). Central messages (`getAiCoachDailyLimitMessage` / `getAiCoachRemainingMessage` / `getAiCoachLimitReachedMessage`) feed `CoachGate` (remaining banner, limit-reached block) and home subtitle. Server `subscription/status` computes used/remaining from the same limit. New migration `supabase/migrations/2026-09-18_coach_daily_limit.sql` (manual apply; tolerant pre-migration). Tests: `coachDailyLimit.test.ts` (contract) + rewritten `coachTrial.test.ts`. No engine/analysis/billing/game changes.
- **2026-09-17**: Explicit setup contract — `CoachGame`/`CoachGameEngine` now always receive explicit `{playerColor (resolved), botLevel (1-5)}` from the `CoachSetup` selection; `?? 'w'` / `?? 3` remain as defensive fallbacks only. Opponent still reuses `ChessBot` + `difficulty.ts` read-only (same mapping as Quick Play/Duo). No engine/analysis/billing changes.
- **2026-09-12 (nav)**: In-game bottom nav (Moves/Chat/Insights + view-only Back/Fwd) via shared `BoardBottomNav` (unmodified). Engine appends `feedbackHistory` snapshots (`CoachInsight`) per analyzed move; `CoachInsightsPanel` (history timeline, best move inline, no reveal) + `CoachTranscriptPanel` (read-only coach-notes log, no backend) + `coachHistoryAdapters` (sidebar entries, SAN→fen replay). Top 3 stays current-position in `CoachPanel`. No engine/backend/schema/billing/ads changes.
- **2026-09-12**: Daily free game (1 per rolling 24h, `COACH_TRIAL_WINDOW_MS`): `coachTrial.ts` (pure eligibility/countdown + idempotent per-session claim; `profiles.coach_last_free_game_at` authoritative with localStorage mirror pre-migration/offline), `CoachGate` trial-aware (premium unlimited / trial pass / hard block + countdown + `/premium` CTA), `CoachGame` claims at START only and embeds the existing `NativeAdSlot`/`AdSenseSlot` pair plus premium offer in the inline Game Over modal for trial games. Requires migration `supabase/migrations/2026-09-12_coach_daily_trial.sql` (manual apply; code is tolerant pre-migration).
- **2026-08-29**: Initial implementation (Coach Mode feature branch).
- **2026-09-18**: Terminal unification — new `CoachGame.abandon()` (terminal-only `Match abandoned`/`abandoned` → `game_over`, no-op unless playing so it never overwrites a recorded result). Active-game Leave now calls `abandon()` into the existing inline game-over modal (ad + offer + Back to Home) instead of routing straight Home, matching Quick Play/Duo/Duel. Resign confirm falls back to a toast when the engine ref is null instead of silently no-op'ing. No engine/analysis/scoring/timer/billing changes. Tests: `coachGame.test.ts` (abandon + no-overwrite).
