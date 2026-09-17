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

# UI/UX Revamp — Progress (branch `UI-UX-refactoring`, base `ebb0541`)

Scope: presentation only. No routing/auth/realtime/game-logic/billing/ads changes.

## Commits (one per phase slice)
1. `0a74e71` docs: UI/UX revamp audit + theme audit (PHASE 1-2)
2. `a3d9c32` ui: semantic presentation-only design tokens + focus-ring + reduced-motion (PHASE 3)
3. `9cb6d06` ui: shared focus-visible states + toast live region (PHASE 4a)
4. `875dfc3` ui: error fallback touch targets + focus states (PHASE 4b)
5. `52fb567` ui: bottom nav focus-visible states (PHASE 4c)
6. `db79ccd` ui: home selection controls focus-visible states (PHASE 5a)
7. `09bb3c9` ui: home selected states on brand tokens (PHASE 5b)
8. `773cc03` ui: color picker brand tokens + focus states (PHASE 6a, incl. test update)
9. `7889451` ui: bot difficulty selector brand tokens + focus states (PHASE 6b)
10. `7f6fc21` ui: confirm bar keyboard focus states (PHASE 7a)
11. `59269cb` ui: game menu focus states + expanded semantics (PHASE 7b)
12. `87db549` ui: duo move cards light-mode support (PHASE 8a)
13. `4561a9b` ui: game-over modal focus states (PHASE 11a)
14. `01fb70e` ui: resign/leave confirm focus states (PHASE 11b)
15. `51243a4` ui: coach panel light-mode support + focus states (PHASE 10a)
16. `c142d44` ui: auth + premium CTA focus states (PHASE 13-14a)
17. `5902241` ui: lobby safe-area + bottom clearance; test: BotEloSelector brand assertion (PHASE 15a + 6b follow-up)
18. (pending) docs: progress + final report (PHASE 17 close)

## What was intentionally NOT changed
Routing, navigation behavior, auth/OAuth/session, realtime, game state/rules/timers,
Stockfish/eval, billing/ads, push, persistence, APIs. All edits are className/ARIA-only
except `globals.css` token additions and two audit docs.

## Validation per commit
`npx tsc --noEmit` before every commit; targeted jest suites where they exist
(Toast, BackButton, ColorPicker incl. assertion update, PendingMovesRow, coach);
production `npm run build` green after PHASE 3. Full suite + build + safety sweep at close.
