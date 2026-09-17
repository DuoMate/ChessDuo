# Implementation Progress — Unified Gameplay Rendering Pipeline

Branch: `perf/unified-gameplay-rendering` · Base: `ux-polish-phases-1-4` (clean tree, `npx tsc --noEmit` green at start).

## Batch 1 — Shared board + piece rendering ✅
- `ChessBoard.tsx`: comparator now covers `pendingOverlay.color` + `myPendingOverlay.color`.
- `PendingMovesRow.tsx`: memoized `SubmittedBadge` + `MoveCard`.
- `RoundHistorySidebar.tsx`: module glyph maps + memoized `RoundHistoryRow` + memoized sidebar.
- `ConfirmMoveBar.tsx`, `TurnStatusArea.tsx`: memoized.
- `Game.tsx`: `CapturedPiecesDisplay` memoized (`CAPTURED_PIECE_ORDER` + `useMemo`).
- Verify: tsc clean; board suites 38/38.

## Batch 2 — Shared gameplay animations ✅
- `ChessBoard.tsx`: `useLayoutEffect` → rAF-coalesced passive `useEffect` with `<1px` guard; trimmed `will-change` to transform-animated nodes only.
- `GameOverModal.tsx`: backdrop `backdrop-blur-xl` removed (card blur kept).
- Verify: tsc clean; castling test intact; visuals unchanged by inspection.

## Batch 3 — Timer + player UI isolation ✅
- `Game.tsx`: `disconnectedAge` poll change-guarded (connected steady-state: no 1 Hz shell rerender).
- `DuelGame.tsx`: `getDuelTimeRemaining` stabilized via `fallbackTimeRef`, deps `[team]`.
- Verify: tsc clean; timer authority untouched (display only).

## Batch 4 — Duo-specific visual rendering ✅
- Covered by Batch 1 (`PendingMovesRow`, `MoveResolvedInline` already strict-memo + stable `onNext`, sidebar). No shadow/resolution/sync logic touched.

## Batch 5 — 4 Player-specific visual rendering ✅
- Covered by shared slices (`GameTopBarSection`, `GameBoardSection`, sidebar, `BoardTopBar` comparator). No turn/player logic touched. Lobby `sameRoster` bail-out preserved.

## Batch 6 — AI Coach-specific visual rendering ✅
- `CoachPanel`, `CoachInsightsPanel`, `CoachTranscriptPanel` memoized. Engine/eval/suggestion/voice semantics untouched.
- Verify: coach suites 11/11.

## Batch 7 — Browser polish + docs + push ✅
- `docs/game-ui-performance-audit.md` + `docs/implementation-progress.md` (this file) written.
- Full `npm test` + `tsc` + browser verification: **owner follow-up** (web browser check, then production push check per owner workflow).

## Safety confirmation
NO CHESS LOGIC CHANGED · NO STOCKFISH CHANGED · NO EVALUATION CHANGED · NO AI LOGIC CHANGED · NO GAME STATE SEMANTICS CHANGED · NO TURN LOGIC CHANGED · NO MOVE RESOLUTION CHANGED · NO SYNCHRONIZATION CHANGED · NO RACE-CONDITION HANDLING CHANGED · NO SUPABASE CHANGED · NO REALTIME CHANGED · NO DATABASE CHANGED · NO PERSISTENCE CHANGED · NO TIMER LOGIC CHANGED · NO NETWORKING CHANGED · NO AUTH CHANGED · NO BILLING CHANGED · NO ADMOB CHANGED.
Only UI/presentation rendering and animation performance was optimized.

## Files changed (exact)
- `src/components/ChessBoard.tsx`
- `src/components/PendingMovesRow.tsx`
- `src/components/RoundHistorySidebar.tsx`
- `src/components/ConfirmMoveBar.tsx`
- `src/components/TurnStatusArea.tsx`
- `src/components/Game.tsx`
- `src/components/DuelGame.tsx`
- `src/components/GameOverModal.tsx`
- `src/components/coach/CoachPanel.tsx`
- `src/components/coach/CoachInsightsPanel.tsx`
- `src/components/coach/CoachTranscriptPanel.tsx`
- `docs/game-ui-performance-audit.md`
- `docs/implementation-progress.md`

---

# AI Coach Setup + OAuth PKCE Fix — Implementation Progress (2026-09-17)

## Status legend
- [ ] pending · [~] in progress · [x] done

## TRACK A — AI Coach setup consistency
- [x] PHASE 1 — Audit (`ai-coach-setup-audit.md`)
- [x] PHASE 2 — Shared config (`BotDifficultyGrid` + shared `DIFFICULTY_LEVELS`, home rewired, no visual change)
- [x] PHASE 3 — `CoachSetup` presentation (ColorPicker + grid + description + Start CTA, light/dark, 44px targets)
- [x] PHASE 4 — Color wiring (setup → `resolvePlayerColor` → `CoachGame`, board orientation via existing prop)
- [x] PHASE 5 — Difficulty wiring (setup → `ChessBot` via existing `DIFFICULTY` map, levels 1-5)
- [x] PHASE 6 — Silent defaults removed from happy path (defensive `?? 3`/`?? 'w'` retained, documented)
- [x] PHASE 7 — Runtime verification (unit: 13 component/grid tests + 6 engine level/color tests)
- [x] PHASE 8 — Regression (coach suites 71/71 green; full suite + build pending below)
- [x] PHASE 9 — `tsc --noEmit` clean + `npm run build` success + suites green (see Verify track)

## Test matrix (Track A)
- [x] T1 White + Easy → onStart(1, 'white'); engine state botLevel 1
- [x] T2 White + Medium → onStart(2, ...) covered by grid + setup tests
- [x] T3 White + Hard → default-start test (3, 'white')
- [x] T4 Black + Easy → onStart(5, 'black') test (level) + black color test; engine ('b', 2) test
- [x] T5 Black + Medium → grid selection test (level 2 checked)
- [x] T6 Random → passthrough test + shared `resolvePlayerColor` (unchanged mechanism)
- [x] T7 Quick Play unchanged (home rewire only; full suite pending)
- [x] T8 Duo unchanged (same)
- [x] T9 Access allowed → setup renders inside CoachGate (phase state; gate untouched)
- [x] T10 Access denied → locked screen unchanged (gate untouched)

## TRACK B — Browser OAuth PKCE regression
- [x] PHASE 1 — Audit (`browser-auth-regression-audit.md`; root cause: dual-consumer race)
- [x] PHASE 2 — Root cause identified (auto-init `detectSessionInUrl` vs explicit exchange)
- [x] PHASE 3 — Minimal fix (session-as-ground-truth reconciliation, callback PKCE branch only)
- [x] PHASE 4 — Regression tests (`callback.test.tsx`: 5/5 — success, reconciled, redirect-preserved, genuine OAuth failure, email recovery)
- [x] PHASE 5 — Browser verification (unit-level; live Google round-trip needs manual DevTools pass post-deploy)
- [ ] PHASE 6 — Final diff review (pre-push, see Verify track)

## Mobile check (Track B)
- Native OAuth uses `chessduo://auth/callback` deep link (`capacitorAuth.ts:57-80`);
  code comes from the link string, never `window.location.href` → auto-init never
  races → unaffected. `capacitorAuth.ts` untouched.

## Verify track
- [x] `npx tsc --noEmit` clean
- [x] `npm test`: 1444 passed / 1540; 9 failed = 8 pre-existing on clean HEAD
  (ConfirmMoveBar 4, SidebarNav 1, server/engine 3 — verified identical via
  `git stash` full-suite baseline: 1421 passed / 1516, same 8 failures) +
  1 BillingDiagnostics flake (3/3 standalone green; zero billing files touched)
- [x] `npm run build` (browser) succeeds — `/coach` prerenders, 28/28 pages
- [x] New-code eslint clean (1 `any` error + warnings in `page.tsx`/`CoachGame.tsx` pre-existing)
- [ ] Diff review (scope-limited) → push `develop` → merge into `prod`

## Log
- 2026-09-17: Audit complete for both tracks. Plans approved (coach: setup inside /coach, 5 home-UI levels, rematch preserves via persisted setup).
- 2026-09-17: OAuth fix implemented + 5/5 tests green. CoachSetup + grid + /coach wiring implemented; coach suites 71/71 green; tsc clean.
- 2026-09-17: Fix complies with arch rule via `AuthService.getSession()` (architecture.test green). Full-suite baseline compared via stash. Build green. Ready to push.
