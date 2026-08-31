# COACH MODE — Architectural Plan

> Source of truth for the "AI Coach Mode" premium feature. Safety-first: Coach Mode is an **isolated, modular** game mode. It must not destabilize, refactor, or alter existing production behaviour.

---

## 1. Product Objective
Add a premium **Player vs AI** game mode where a Stockfish-powered coach analyses the player's position in real time and after each move: evaluation, top-3 recommended moves, blunder/missed-opportunity detection, and short natural-language explanations. Optional voice coaching (SpeechSynthesis on web, Capacitor TTS on Android).

## 2. User Experience
- Premium user opens **Coach** from the home screen, picks difficulty + colour (optional) and starts.
- They play a normal 1v1 chess game against an AI opponent (reuse `ChessBot`).
- A coach panel sits beside/below the board showing: current evaluation, top 3 moves (SAN + score), and a verdict on the player's last move (Perfect/Great/Good/Inaccuracy/Mistake/Blunder) with a plain-English explanation.
- Post-game, a summary of blunders/missed opportunities is shown.
- Voice coaching (if enabled) reads the coaching line aloud. Disabling voice never affects the game.

## 3. Premium Requirements
- **Premium-only.** Enforced via `SubscriptionService.isPremium()` (client-side, mirroring the existing `InsightsGate` pattern). Documented residual risk: same client-side bypass surface as existing insights.
- Non-premium users see an upsell gate and cannot launch a coach session.

## 4. Architecture
```
Coach Mode (all-new, isolated)
├── src/features/coach/
│   ├── coachGame.ts        CoachGame — own PvE lifecycle (chess.js + ChessBot opponent)
│   ├── coachEngine.ts      dedicated Stockfish worker (MultiPV=3) for analysis
│   ├── coachAnalysis.ts    pure analysis: top-3, blunder/miss, eval diff, text
│   ├── coachVoice.ts       optional TTS (web SpeechSynthesis + Capacitor plugin)
│   └── coachPersistence.ts isolated Supabase `coach_games` persistence
├── src/components/coach/
│   ├── CoachGame.tsx       game shell (own layout)
│   ├── CoachPanel.tsx      top-3 + evaluation + coaching text
│   └── CoachGate.tsx       premium gate
└── src/app/coach/page.tsx  route (Suspense + dynamic ssr:false + ErrorBoundary)
```

## 5. Module Boundaries
| Module | Owns | Must NOT touch |
|---|---|---|
| `CoachGame` | game lifecycle, PvE turn flow, board state | `GameInterface`, `LocalGame`, `OnlineGame`, `gameState` |
| `CoachEngine` | its own Stockfish worker, MultiPV=3 analysis | `BrowserMoveEvaluator` shared singleton |
| `CoachAnalysis` | pure functions over engine output | accuracy/resolution pipelines |
| `CoachVoice` | TTS enable/disable, speak() | game logic |
| `CoachPersistence` | `coach_games` table access | `games`/`completed_games`/`matchHistory` |
| `Coach UI` | rendering, input | existing `Game.tsx`/`DuelGame.tsx` |

## 6. Data Flow
1. Player moves on board → `CoachGame.applyPlayerMove()` (chess.js authoritative legality).
2. Opponent move via `ChessBot.selectMoveAsync(fen)`.
3. After the player's move → `CoachEngine.analyze(fen, playerMove)` → ranked top-3 + eval.
4. `CoachAnalysis.buildCoachFeedback(...)` → verdict + explanation + blunder/miss flags.
5. UI renders `CoachPanel`; `CoachVoice` optionally speaks the explanation.
6. On game over → `CoachPersistence.save()` (premium + signed-in only).

## 7. Engine Architecture
- **Opponent**: reuse `ChessBot` + `difficulty.ts` + `openings.ts` (already production-proven, read-only).
- **Analysis**: a **new dedicated Stockfish worker** (`CoachEngine`) configured `MultiPV=3`, `go movetime <T>`; parses `pv`/`score` lines into a ranked move list. This avoids (a) modifying the production `BrowserMoveEvaluator` (hardcoded MultiPV=6) and (b) worker contention with the opponent bot.

## 8. Coach Architecture
- `coachAnalysis.ts` pure functions:
  - `rankTopMoves(results, n=3)` → top N
  - `detectBlunder(playerEval, bestEval)` / `detectMissedOpportunity(...)`
  - `explainMove(verdict, data)` → short English text (template-driven, no hardcoded fakes)

## 9. Voice Architecture
- `coachVoice.ts` exposes `isSupported()`, `setEnabled()`, `speak(text)`.
- Web: `window.speechSynthesis`.
- Android: Capacitor TTS plugin via dynamic import; failure → silent no-op (graceful degrade).
- Voice is never a dependency of the game loop.

## 10. Persistence Architecture
- New isolated `coach_games` table (player-scoped) + RLS (own rows only) + migration under `supabase/migrations/`.
- `coachPersistence.ts` `saveCoachGame()` / `listCoachGames()` — separate from `gamePersistence`/`matchHistory`.

## 11. Routing Architecture
- New `/coach` route. Existing routes unchanged. Direct access passes through `CoachGate` (session + premium).
- No change to `middleware.ts`/`proxy.ts` (route does its own client-side session check like `/duel`).

## 12. Premium Enforcement
- `CoachGate` (route level): loads session + `SubscriptionService.isPremium()`; non-premium → upsell UI (link to `/premium`). No analysis/engine starts until premium confirmed.
- Location documented in `src/app/coach/page.tsx` + `src/components/coach/CoachGate.tsx`.

## 13. Error Handling
- Engine init/analysis failures degrade to "coach unavailable" state; game continues.
- Empty catch blocks commented per repo rules. No `console.log` user messages; use `useGameToast()`.
- `ErrorBoundary` at route + component level.

## 14. Performance
- Lazy-init analysis worker; `terminate()` on unmount.
- Reuse `evaluationCache` semantics where safe (optional).
- Board memoized via existing `ChessBoard` memo.

## 15. Security
- Premium check read-only via existing `SubscriptionService`.
- Persistence writes scoped to `auth.uid()` via RLS (own rows only).
- No secrets; no new privileged routes.

## 16. Testing Strategy
- Unit: `coachAnalysis`, `coachEngine` (mocked worker), `coachPersistence` (mocked supabase), `coachVoice` (mocked SpeechSynthesis).
- Component: `CoachGate` (premium/non-premium), `CoachPanel`.
- Regression: `npx tsc --noEmit`, `npm test` green; manual smoke of Quick Play / Duo / Duel / auth / subscription.

## 17. Regression Strategy
- Coach Mode is fully additive. Existing game/persistence/realtime/timer files are untouched except one **additive** home-page edit (see §Frozen). After each phase: typecheck + lint + test + review `git diff` for any non-Coach file.

## 18. Rollback Strategy
- Revert branch `feature/coach-mode`. DB: drop `coach_games` + its policies (migration is additive). No other prod surface changed.

## 19. Acceptance Criteria
1. Coach Mode plays a full PvE game with legal moves.
2. Premium enforcement blocks non-premium users.
3. Top-3 engine moves show correctly (not hardcoded).
4. Coaching analysis produces verdict + explanation.
5. Voice works or degrades gracefully.
6. Persistence saves/loads coach games (premium, signed-in).
7. Existing modes behaviourally unchanged.
8. Existing tests/build pass.
9. No unrelated files modified.
10. COACH_MODE_PROGRESS.md + COACH_MODE_CHANGELOG.md complete.

## 20. Non-Goals
- No server-side premium entitlement (consistent with existing insights).
- No cross-device realtime sync of coach sessions.
- No opening-book coaching, no multi-line deep analysis beyond top-3.
- No changes to Duo/Quick Play/Duel logic, timers, realtime, auth, or subscription behaviour.

---

## FROZEN PRODUCTION SYSTEMS
The following must be considered frozen. No modification unless explicitly approved.

- Duo mode (`onlineGame.ts`, `Game.tsx` online path)
- Quick Play (`localGame.ts`)
- Duel mode (`duelGame.ts`, `DuelGame.tsx`)
- Existing move resolution (`resolvePendingMoves` in both games)
- Existing realtime event contracts
- Existing timers (`TeamTimer`/`MatchTimer`/`gameState` timers)
- Existing game persistence (`gamePersistence.ts`, `games` table)
- Existing match history (`matchHistory.ts`, `completed_games` table)
- Existing authentication (`authService.ts`, login callbacks)
- Existing lobby/join flow (`roomActions.ts`, `join_room_by_code`)
- Existing subscription behaviour (`SubscriptionService`, billing providers)
- Existing home-page/game routing (`src/app/page.tsx`)
- Existing production UI behaviour

### Frozen-file modifications requiring approval (tracked)
| File | Change | Status |
|---|---|---|
| `src/app/page.tsx` | Additive: one "Coach" `GameModeCard` + navigation `case 'coach'` | APPROVED (user selected "Home screen Coach card") |

No other frozen file is modified.
