# Game UI Performance Audit — Unified Gameplay Rendering Pipeline

Branch: `perf/unified-gameplay-rendering` · Date: 2026-09-16 · Scope: presentation/rendering/animation only.

Engine, Stockfish, sync, timers authority, network, DB, auth, billing, ads: **untouched**.

## Shared shell

### MODE: All (Quick/Duo/4P) — SCREEN: Game shell — COMPONENT: `Game.tsx` disconnectedAge poll
- PROBLEM: 1 Hz `setDisconnectedAge(age)` re-rendered the entire 3049-line shell even while connected (constant 0).
- EVIDENCE: `Game.tsx:301-309` (pre-fix); `white/blackPlayersWithPresence` memo invalidated → `BoardTopBar` ref-check missed 1 Hz.
- ROOT CAUSE: Unconditional setState on every tick.
- UI-ONLY FIX: Change-guarded setState (`prev === age ? prev : age`). Connected steady-state: zero shell rerenders. Disconnect countdown still propagates (display only; forfeit authority untouched).
- FILES CHANGED: `src/components/Game.tsx`
- REGRESSION TEST: `npx tsc --noEmit`; manual: online Duo connect → no per-second shell churn; disconnect → countdown still appears.
- RESULT: Typecheck clean; targeted tests pass (38/38 board suites).

### MODE: Duel — COMPONENT: `DuelGame.tsx` `getDuelTimeRemaining`
- PROBLEM: `useCallback` deps `[team, whiteTime, blackTime]` recreated the getter on every non-clock engine event → tore down `IsolatedMatchTimer`'s 1 s interval + invalidated `duelTimerNode` memo.
- EVIDENCE: `DuelGame.tsx:511-519` (pre-fix).
- ROOT CAUSE: State values captured instead of read via ref.
- UI-ONLY FIX: Fallback times mirrored into `fallbackTimeRef`; callback deps `[team]` only. Matches `Game.tsx:2592` stable pattern.
- FILES CHANGED: `src/components/DuelGame.tsx`
- REGRESSION TEST: tsc + Duel suites; manual: duel timer ticks without interval teardown.
- RESULT: Clean.

### MODE: All — COMPONENT: `Game.tsx` `CapturedPiecesDisplay`
- PROBLEM: `[...pieces].sort()` + new `order` array allocated on every shell render; unmemoized component.
- EVIDENCE: `Game.tsx:114-139` (pre-fix).
- ROOT CAUSE: Inline sort during render.
- UI-ONLY FIX: Hoisted `CAPTURED_PIECE_ORDER`, `useMemo` on `[pieces]`, `memo()` wrapper. Identical sort order.
- FILES CHANGED: `src/components/Game.tsx`
- RESULT: Clean.

## Board rendering

### MODE: All — COMPONENT: `ChessBoard.tsx` comparator
- PROBLEM: Custom memo comparator ignored `pendingOverlay.color` / `myPendingOverlay.color` — a color flip alone never re-rendered (stale glyph); conversely any unrelated shell churn relied on parent slices.
- EVIDENCE: `ChessBoard.tsx:613-633` (pre-fix).
- ROOT CAUSE: Missing fields in comparator.
- UI-ONLY FIX: Added both `color` comparisons. Castling path (`setPosition(fen, isCastleMove)`) untouched.
- FILES CHANGED: `src/components/ChessBoard.tsx`
- REGRESSION TEST: `ChessBoard.test.tsx` (castling animate / non-castle snapshot) passes.
- RESULT: Clean.

### MODE: All — COMPONENT: `ChessBoard.tsx` overlay measurement
- PROBLEM: `useLayoutEffect` → `getBoundingClientRect` → `setOverlayWidth` on every resize/orientation → extra render loop; `ResizeObserver` fired per frame during continuous resize.
- EVIDENCE: `ChessBoard.tsx:132-145` (pre-fix).
- ROOT CAUSE: Uncoalesced, unguarded measurement.
- UI-ONLY FIX: Passive `useEffect` + rAF coalescing + `<1px` change guard; `useLayoutEffect` import removed. Same width value delivered, fewer commits.
- FILES CHANGED: `src/components/ChessBoard.tsx`
- RESULT: Clean.

### MODE: All — COMPONENT: `ChessBoard.tsx` `will-change` over-application
- PROBLEM: `will-change-transform` on opacity-only pending glyphs + all 8 retraction particles → excess compositor layers.
- EVIDENCE: overlay JSX (pre-fix).
- ROOT CAUSE: Blanket class.
- UI-ONLY FIX: Removed from opacity-only glyphs/particles; kept on transform-animated teammate label, sliding retraction glyph, winner frame. Same visual intent.
- FILES CHANGED: `src/components/ChessBoard.tsx`
- RESULT: Clean.

## Duo-specific visuals

### MODE: Duo — COMPONENT: `PendingMovesRow.tsx`
- PROBLEM: Inner `MoveCard`/`SubmittedBadge` unmemoized; icon-node identity churn re-rendered cards even when the parent comparator held.
- EVIDENCE: `PendingMovesRow.tsx:36-104` (pre-fix).
- ROOT CAUSE: Missing inner memo.
- UI-ONLY FIX: `memo(SubmittedBadge)`, extracted `MoveCardInner` + `memo(MoveCard)`. Parent SAN/piece/color/label comparator unchanged. No logic change to `buildResolutionData`/ownership/`shadowMove`.
- FILES CHANGED: `src/components/PendingMovesRow.tsx`
- REGRESSION TEST: `PendingMovesRow.test.tsx` passes.
- RESULT: Clean.

### MODE: Duo/4P/Coach — COMPONENT: `RoundHistorySidebar.tsx`
- PROBLEM: Unmemoized; `pieceFor` rebuilt glyph maps per row; full `entries.map` reconciled on every shell render; row JSX inline.
- EVIDENCE: `RoundHistorySidebar.tsx:27-139` (pre-fix).
- ROOT CAUSE: No render boundary.
- UI-ONLY FIX: Module-level glyph maps, memoized `RoundHistoryRow`, `memo()` sidebar gated on `open/entries/onClose/onViewFullHistory` identity. Hooks (`useEscapeKey/useScrollLock/useCapacitorBackButton`) still run with `open` gating (rules-of-hooks compliant). Same rows, same spring animation.
- FILES CHANGED: `src/components/RoundHistorySidebar.tsx`
- RESULT: Clean.

### MODE: All — COMPONENT: `ConfirmMoveBar.tsx`, `TurnStatusArea.tsx`
- PROBLEM: Both unmemoized (`TurnStatusArea` additionally owns an animejs loop; currently unmounted in `Game.tsx`).
- FIX: `memo()` wrappers (inner rename, no prop/visual change).
- FILES CHANGED: `src/components/ConfirmMoveBar.tsx`, `src/components/TurnStatusArea.tsx`
- RESULT: Clean.

## Coach visuals

### MODE: AI Coach — COMPONENT: `CoachPanel` / `CoachInsightsPanel` / `CoachTranscriptPanel`
- PROBLEM: Unmemoized pure views; `analyzing` ticks and suggestion-text changes reconciled the insights/transcript timelines.
- EVIDENCE: `components/coach/*.tsx` (pre-fix).
- ROOT CAUSE: No render boundary (board already `fen`-gated via `ChessBoard` memo).
- UI-ONLY FIX: `memo()` on all three panels. No change to recommendation generation, eval, best-move derivation (`topMoves[0].uci`), voice engine, or `showBestMove` reset-on-`fen` guard.
- FILES CHANGED: `src/components/coach/CoachPanel.tsx`, `CoachInsightsPanel.tsx`, `CoachTranscriptPanel.tsx`
- REGRESSION TEST: coach suites 11/11 pass.
- RESULT: Clean.

## Paint / compositing

### MODE: All — COMPONENT: `GameOverModal.tsx` backdrop
- PROBLEM: Full-viewport `backdrop-blur-xl` on the backdrop + `backdrop-blur-2xl` on the card → nested full-screen backdrop sampling on every game-over open.
- EVIDENCE: `GameOverModal.tsx:63` (pre-fix).
- ROOT CAUSE: Redundant backdrop filter (dim covers it).
- UI-ONLY FIX: Removed `backdrop-blur-xl` from backdrop only; card keeps `backdrop-blur-2xl`. Same dim + card visuals; ad slots (`NativeAdSlot`/`AdSenseSlot`) untouched.
- FILES CHANGED: `src/components/GameOverModal.tsx`
- RESULT: Clean.

## Investigated, intentionally NOT changed

- `Game.tsx` `setOnStateChange` effect has no unsubscribe: `OnlineGame.setOnStateChange` **overwrites** (not additive) and invokes once on register — re-fire replaces rather than stacks, so no listener leak. Changing it would risk event-delivery semantics → documented, untouched.
- Per-move `new Chess(fen)` parses in sound paths (`Game.tsx:1359-1384`, `DuelGame:167-195`): core-adjacent computation, documented only.
- `DuelGame` opponent-profile fetch without cancel flag: pre-existing, out of scope for this pass.

## Measurements

- `npx tsc --noEmit`: clean before and after.
- Targeted suites: `BoardPageComponents` + `PendingMovesRow` + `ChessBoard` 38/38 pass; coach 11/11 pass.
- Frame-level DevTools profiling (long tasks, paint, composite, frame drops per mode scenario) was **not measurable** in this environment — marked as browser-verification follow-up, not invented.
