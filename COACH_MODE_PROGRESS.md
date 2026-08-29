# COACH MODE — Progress Tracker

Phase-by-phase implementation log. One phase at a time: implement → typecheck → lint → build → test → review diff → update this file + changelog.

| Phase | Description | Status |
|---|---|---|
| 0 | Repository investigation | COMPLETE |
| 1 | Architecture + control docs | COMPLETE |
| 2 | Isolated game shell (`CoachGame`) | COMPLETE |
| 3 | Engine integration (`CoachEngine`) | COMPLETE |
| 4 | Coach analysis (`CoachAnalysis`) | COMPLETE |
| 5 | Top-3 moves | COMPLETE |
| 6 | Coaching explanations | COMPLETE |
| 7 | Voice coaching (`CoachVoice`) | COMPLETE |
| 8 | Premium enforcement (`CoachGate` + route) | COMPLETE |
| 9 | Persistence (`CoachPersistence` + migration) | COMPLETE |
| 10 | Home entry point (frozen `page.tsx` additive) | COMPLETE |
| 11 | Testing | COMPLETE |
| 12 | Regression verification | COMPLETE |

---

## Phase 0 — Repository Investigation
- **What was done**: Traced game-mode routing, Duo/Quick Play/Duel flows, board/state representation, chess.js + Stockfish integration, bot difficulty, move generation/resolution, realtime, timers, persistence, auth, subscription, navigation, history, audio. Searched for prior AI/bot/engine/analysis/voice implementations (none existed beyond the shared evaluator + bot).
- **Decisions made**: reuse `ChessBot`/`BrowserMoveEvaluator` (read-only); isolate a dedicated `CoachEngine` worker; isolate persistence; client-side premium gate.

## Phase 1 — Architecture
- **What was done**: Wrote the three control documents.
- **Files created**: COACH_MODE_PLAN.md, COACH_MODE_PROGRESS.md, COACH_MODE_CHANGELOG.md

## Phase 2 — Isolated Game Shell
- **What was done**: `CoachGame` class — own board (chess.js), PvE lifecycle, reuses `ChessBot` opponent, emits `CoachGameState`.
- **Files created**: `src/features/coach/coachGame.ts`

## Phase 3 — Engine Integration
- **What was done**: `CoachEngine` — dedicated Stockfish Worker (MultiPV-per-query), `analyzeTopMoves`/`scoreMove`/`evaluatePosition`/`terminate`. Graceful degrade on failure.
- **Files created**: `src/features/coach/coachEngine.ts`

## Phase 4 + 5 + 6 — Analysis / Top-3 / Explanations
- **What was done**: `coachAnalysis.ts` — `classifyLoss`, `buildSuggestion` (top-3), `buildFeedback` (blunder/missed-opportunity/verdict), `explainMove` (natural-language, template-driven). `coachPersistence.ts` isolated Supabase persistence.
- **Files created**: `src/features/coach/coachAnalysis.ts`, `src/features/coach/coachPersistence.ts`

## Phase 7 — Voice Coaching
- **What was done**: `coachVoice.ts` — web `SpeechSynthesis` + `@capacitor-community/text-to-speech` (Android), independently enabled, graceful degrade. Added dependency.
- **Files created**: `src/features/coach/coachVoice.ts`
- **Files modified**: `package.json` + `package-lock.json` (new dep `@capacitor-community/text-to-speech`)

## Phase 8 — Premium Enforcement + Route
- **What was done**: `CoachGate` (client-side `SubscriptionService.isPremium()` gate, fail-closed) + `/coach` route (Suspense + dynamic ssr:false + ErrorBoundary + session check).
- **Files created**: `src/components/coach/CoachGate.tsx`, `src/components/coach/CoachGame.tsx`, `src/components/coach/CoachPanel.tsx`, `src/app/coach/page.tsx`

## Phase 9 — Persistence
- **What was done**: `coach_games` table + player-scoped RLS (4 policies) + GRANT, all inside `supabase.sql` as a single **idempotent** block (safe to re-run; no separate migration file).
- **Files created**: none
- **Files modified**: `supabase/supabase.sql`

## Phase 10 — Home Entry Point
- **What was done**: Additive "Coach" `GameModeCard` (mobile + desktop) + `handleStartCoach` (auth-aware navigation to `/coach`).
- **Files modified**: `src/app/page.tsx` (additive only — approved frozen-file edit)

## Phase 11 — Testing
- **What was done**: 24 unit tests across `coachAnalysis`, `coachEngine` (mocked Worker), `coachGame` (mocked engine/bot).
- **Files created**: `src/features/coach/__tests__/coachAnalysis.test.ts`, `coachEngine.test.ts`, `coachGame.test.ts`

## Phase 12 — Regression Verification
- **What was done**: `npx tsc --noEmit` clean (exit 0). `npx jest` — 118 suites pass; **4 pre-existing failures** unrelated to Coach Mode (see below).
- **Existing modes tested**: no production game/persistence/auth/subscription files modified; `page.tsx` change is additive.
- **Unrelated pre-existing failures (NOT fixed, recorded)**: `src/app/__tests__/PremiumPage.test.tsx`, `src/components/__tests__/SidebarNav.test.tsx`, `src/components/__tests__/ConfirmMoveBar.test.tsx`, `server/__tests__/engine.test.ts` (LRUCache constructor issue).
