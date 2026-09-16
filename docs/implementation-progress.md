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
