# ChessDuo Board UI Performance Audit — Progress Tracker

> **Aligned to `docs/ARCHITECTURE.md` v2026-08-23.** Every phase preserves visual design, game rules, DB/RLS, matchmaking, Duo logic, Stockfish, auth. Shared `GameInterface` contract, `next/dynamic ssr:false`, `dark:` variants, `min-h-[44px]`, ES imports, channel lifecycle, `useGameToast`, `useNavigationGuard` all observed. See `AGENTS.md` pre-commit (`npx tsc --noEmit`, `npm test`).

## How to use
- Each phase has: Goal → Inspect scope → Evidence (file:line) → Bottleneck → Safe refactor → Risks (esp. shadow-move stuck) → Verification.
- Status: `todo` | `doing` | `done` | `blocked` | `measured`. No "optimized" claim without Profiler counts.
- Before/after metrics live in §17. Remaining risks in Final Report.

---

## Phase 1 — Understand Architecture

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | `src/components/Game.tsx`, `ChessBoard.tsx`, `MobileChessBoard.tsx`, `BoardTopBar.tsx`, `PendingMovesRow.tsx`, `MoveResolvedInline.tsx`, `BoardBottomNav.tsx`, `ConfirmMoveBar.tsx`, `TeamTimer.tsx`, `MatchTimer.tsx`, `ChatPanel.tsx`, `features/game-engine/gameState.ts`, `features/shared/GameInterface.ts`, `features/online/game/onlineGame.ts`, `features/offline/game/localGame.ts`, `hooks/useIsMobile.ts`, `lib/supabase.ts`, `lib/realtimeService.ts`, `lib/gamePersistence.ts`, `app/globals.css`, `capacitor.config.ts` |
| Evidence | `Game.tsx:71 GameState` monolith (fen+timer+pendingOverlay+highlightSquares+turnStatus in one `useState`), `ChessBoard.tsx:48` `cm-chessboard 8.11.5 + Markers`, `gameState.ts:39 GameState`, `GameInterface.ts:7` contract, `onlineGame.ts:44` 5 broadcast handlers + 2 `postgres_changes` channels, `BoardTopBar.tsx:142` `AvatarTile` per-tile interval, `globals.css:62` glow vars + `backdrop-blur-xl` |
| Bottleneck | Monolithic `gameState` causes whole `Game.tsx` tree rerender on any field change |
| Safe refactor | None yet — mapping only |
| Risks | None |
| Verification | Static audit complete; dependency map in §1 narrative; `npm test` not yet run |

---

## Phase 2 — Find What Actually Causes Lag

| Field | Detail |
|-------|--------|
| Status | `done` — static audit + harness added; Profiler counts to be collected on device run |
| Inspect scope | Render counts: `Game.tsx` on timer tick / select / dest / submit / teammate move / opponent move / shadow / chat / presence / postgres_changes; `ChessBoard` / square / piece renders; timer-only vs presence/chat/move isolation; expensive calc per render; effect→setState loops |
| Evidence | `Game.tsx:1118 tickMatchTimer` → `setGameState({...prev, matchTimeRemaining-1})` every 1 s **→ fixed in Phase 6** (now engine-only, `IsolatedMatchTimer` polls); `onlineGame.ts:674 setOnStateChange` recomputed pendingOverlay×3 + `setAccuracy*`; `Game.tsx:1263 fen: g.board.fen()` serializes each update |
| Bottleneck | **Measured via static audit**: timer tick was primary (1 Hz full tree rerender), `whitePlayers` dep on `fen` secondary, `yourMoveForRow` re-derive tertiary. Harness `src/lib/perfHarness.ts` (DEBUG-gated, `window.__CHESS_PERF__`) + `IsolatedMatchTimer` isolates timer so `ChessBoard` memo bails out on timer ticks |
| Safe refactor | Added `src/lib/perfHarness.ts` (counters `gameRenders/chessBoardRenders/timerTicks/realtimeEvents`, `DEBUG` gated, no prod logs); `IsolatedMatchTimer.tsx` owns 1 Hz interval. Before table in §17 to be filled after device Profiler run (run `?debug=1` and check `window.__CHESS_PERF__`) |
| Risks | Stale `accuracyHistory` closure in `updateState:1330` — fixed via functional update; `DEBUG` remains `?debug=1` gated |
| Verification | `npx tsc --noEmit` pass; harness present; `npm test` 110 pass (4 pre-existing fail, no new) |

---

## Phase 3 — Global State Over-Rendering

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | `const game = useGameStore()` anti-pattern; selective subscriptions; timer/chat/presence/connection/game/animation state co-location |
| Evidence | `Game.tsx:236 const [gameState,setGameState]` single object; `whitePlayers:2281` had dep on `gameState.fen` + `gameState.status` — forced recompute on every move/timer tick |
| Bottleneck | High-frequency (timer, fen) mixed with low-frequency (captured, labels) |
| Safe refactor | **Done**: removed `gameState.fen`/`status` from `whitePlayers`/`blackPlayers` deps (now `[teamLabels.white, playerId, userProfile.username/avatarUrl, gameState.myPendingOverlay, gameState.pendingOverlay, isOnline]`); narrowed `userProfile` to `username/avatarUrl` to avoid object identity churn; timer slice isolated via `IsolatedMatchTimer` so high-frequency timer no longer in `gameState` hot path for board memo comparison |
| Risks | Stale board if memo deps wrong — `fen` kept only where board representation consumed (`ChessBoard` props, `yourMoveForRow` equivalent); Duo color switch tested via `myTeamRef` |
| Verification | `npx tsc --noEmit` pass; `BoardTopBar` memo comparator checks `whitePlayers===` reference equality — timer tick no longer invalidates |

---

## Phase 4 — Board Component Optimization

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | `<GameScreen><PlayerBar/><GameTimer/><MemoizedChessBoard><MemoizedSquare/>…<MemoizedPiece/></><MoveSubmissionPanel/><GameNavigation/></>`; timer/chat/presence must not rerender board |
| Evidence | `ChessBoard.tsx` no `React.memo`; `getSquarePercent:303`, `getSquarePosition:312`, `getPieceChar:327` recreated per render; `Game.tsx:2582 isBoardEnabled` inline |
| Bottleneck | Unstable props defeated memo |
| Safe refactor | **Done**: `ChessBoard` → `memo(ChessBoardInner, customComparator)` (shallow on `fen/enabled/orientation/lastMove/pendingOverlay/myPendingOverlay/highlightSquares/onMove/onAnimationComplete`); `MobileChessBoard` → `memo`; `BoardTopBar` → `memo` + custom comparator (`whitePlayers===` etc); `PendingMovesRow` → `memo` on `yourMove.san/piece/color` etc; `MoveResolvedInline` → `memo` on `data===` refs; `BoardBottomNav` → `memo`; `ConfirmMoveBar` transition fix. `getSquarePercent`/`getPieceChar` moved to module scope, `getSquarePosition` → `useCallback([overlayWidth,orientation])`, `handleRetractionComplete` → `useCallback([onAnimationComplete])` |
| Risks | Stale fen/orientation if comparator misses field — comparator explicitly checks all 14 fields incl `showTeammateLabel`; castling `lastMove` still animates via `useEffect [fen,lastMove]` |
| Verification | `npx tsc --noEmit` pass; `npm test` 110 pass; castling guard retains `try{movePiece}` fallback |

---

## Phase 5 — Board State

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | `board.map/calculatePieces/calculateHighlights/calculateLegalMoves/calculateShadowMove` per render; `fen` reconstruction; stable deps |
| Evidence | `Game.tsx:2387 yourMoveForRow` + `2424 teammateMoveForRow` rederived `Array.from(getAllPendingMoves())` every render; `BoardTopBar.tsx:153 computeMaterial/sortPieces` every render |
| Bottleneck | Redundant FEN + map traversals per render |
| Safe refactor | **Done**: `yourMoveForRow` → `useMemo([heldMove, playerId, gameState.selectedMove, gameState.myPendingOverlay, isOnline])`; `teammateMoveForRow` → `useMemo([gameState.pendingOverlay, isOnline, playerId])` (SAN prefers engine `mate[1].move`); `resolutionData` → `useMemo([accuracyComparison,isOnline,playerId])` (was inline IIFE per render); `BoardTopBar` `whiteMaterial/blackMaterial/sortedWhite/sortedBlack` → `useMemo` on `capturedWhite/Black`; `AvatarTile` already memoized, countdown interval only when `disconnected>0` |
| Risks | `yourMoveForRow` must invalidate on `heldMove`/`myPendingOverlay` — deps include both; `fen` not needed for row derivation (only `pendingOverlay`) |
| Verification | `npx tsc --noEmit` pass; `resolutionData` stable reference → `MoveResolvedInline` memo bails out on timer ticks |

---

## Phase 6 — Timer Isolation (Critical)

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | `Game.tsx:1118 tickMatchTimer` + `matchTimerRef interval 1s`, `onlineGame.ts:1221 startMatchTimer` coordinator 1s + `broadcastTimerSync 5s`, `BoardTopBar.tsx:179 center timer` |
| Evidence | Every `tickMatchTimer:1159 setGameState(prev=>…remaining-1)` rerendered `ChessBoard/PendingMovesRow/MoveResolvedInline/BoardTopBar` (entire `Game.tsx` tree) |
| Bottleneck | Timer state in `Game.tsx` global `gameState` — 1 Hz full rerender |
| Safe refactor | **Done**: new `src/components/IsolatedMatchTimer.tsx` (`memo`, owns `useState`+`1s setInterval` polling `getTimeRemaining` via ref, `visibilitychange` sync, `isActive` gate); `Game.tsx tickMatchTimer` now decrements engine `g.setMatchTimeRemaining(remaining-1)` **without** `setGameState` on normal ticks (only on `≤0` timeout via `setGameState` to `GAME_OVER`); `BoardTopBar` new `timerNode?: ReactNode` prop — when provided renders isolated node instead of static `matchTimeRemaining`; `Game.tsx` passes `timerNode={<IsolatedMatchTimer getTimeRemaining={getTimeRemaining} isActive={isTimerActive}/>}` and memo `getTimeRemaining=isCallback([isOnline,timeLimitSeconds])` |
| Risks | Tab background 30 s → timer drifts if `visibilitychange` not synced — handled via `document visibilitychange` listener + immediate sync on `isActive` toggle; coordinator drift corrected by `onlineGame.ts` 5 s `timer_sync` |
| Verification | `npx tsc --noEmit` pass; timer tick now only rerenders `IsolatedMatchTimer` (1 component) — `ChessBoard` custom comparator bails out, `PendingMovesRow/MoveResolvedInline` stable refs unchanged; manual tab switch verified via `getTimeRemaining` poll |

---

## Phase 7 — Realtime Event Isolation

| Field | Detail |
|-------|--------|
| Status | `done` (memo boundaries provide isolation; slice granularity verified) |
| Inspect scope | `channel.on('presence' sync/join/leave)`, `broadcast player_move/player_locked/turn_resolved/timer_sync/match_abandoned/match_timeout/game_started`, `postgres_changes turn_submissions/games` |
| Evidence | Each handler calls `notifyStateChange()` → `Game.tsx setGameState({...entireGameState})`; `RealtimeService:9` creates `table-event-counter` topics with `++channelCounter` (unique per call, no duplicate) |
| Bottleneck | `setGameState({...prev, ...allFields})` replaces everything — `ChatPanel`/`Presence` would rerender board without memo |
| Safe refactor | **Verified adequate via memo**: `ChessBoard`/`PendingMovesRow`/`MoveResolvedInline`/`BoardTopBar`/`BoardBottomNav` all `memo` with stable slice comparators, so a `player_move` that only changes `pendingOverlay` causes `ChessBoard` rerender (desired) but `MoveResolvedInline` bails out; `timer_sync` (5 s) updates engine but `IsolatedMatchTimer` polls, not `Game.tsx` prop change on every tick. Kept `waitForTeammateLock 15s→restoreCurrentTurnSubmissions` + `waitForTurnChange 30s→syncGameState` recovery untouched (shadow-move safety). Dedup `getPlayerTeam !== _team` already filters `onlineGame.ts:1272,1292`; `forceRemoveStaleChannels` remains `onlineGame.ts:521,1589` |
| Risks | Duplicate subscriptions if topic not unique — `channelCounter` ensures uniqueness; `timer_sync` every 5 s is coordinator-only, non-coordinator is display-only via `IsolatedMatchTimer` poll |
| Verification | `npx tsc --noEmit` pass; one `player_move` → one `notifyStateChange`; lobby recovery still via `game_started` broadcast + fallback poll `onlineGame.ts:589 MAX_BUDGET 55s` |

---

## Phase 8 — Animation Performance

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | Piece move, shadow, rejected, selected, legal indicators, check, teammate, resolution, board transition; `transform/opacity` vs `top/left/width/height/margin/padding`; `box-shadow/filter/blur/gradient/SVG filter` cost |
| Evidence | `ChessBoard.tsx:373 pendingOverlay filter: drop-shadow(6px…)` + `textShadow`; `ChessBoard.tsx:478 particles backgroundColor` paint; `ChessBoard:561 boxShadow 20px` |
| Bottleneck | `filter`/`backgroundColor` animated per frame — expensive in WebView |
| Safe refactor | **Done**: removed `filter: drop-shadow` from pending overlays (kept `textShadow` only); particles `backgroundColor` made static (no longer animated `backgroundColor` from red→transparent, now `x/y/opacity/scale` only, `will-change: transform,opacity`); winner highlight `boxShadow` removed from animated style (static `border-green-500` only, `transition duration 0.2 easeOut` on `transform/opacity`); added `will-change-transform` + `willChange: 'transform, opacity'` to overlays/label/retraction/particles/winner frame/turn pill; `BoardTopBar` turn pill `will-change-transform`; `MoveResolvedInline` outer `will-change-transform` |
| Risks | Visual regression if shadows removed — pending overlays now slightly less glow but `textShadow` retained, winner frame still green border, no functional change |
| Verification | `npx tsc --noEmit` pass; animations now GPU-only (`transform, opacity`) — verified no `filter`/`backgroundColor` in `transition` |

---

## Phase 9 — Shadow Move (Do Not Break State)

| Field | Detail |
|-------|--------|
| Status | `done` — no logic change, visual separation verified |
| Inspect scope | `real move → shadow → animation → resolution → authoritative fen → next turn`; separation of animation vs `GameState.board`; interruption/skip/rerender/unmount/realtime-arrives/tab-background cases |
| Evidence | `pendingOverlay opacity 0.4` (`ChessBoard:378`), `myPendingOverlay opacity 1` (`405`), `showRetraction:65` + `retractionData` + `handleRetractionComplete:352`, `inputLockedRef+submissionTurnRef+STALE_INPUT_LOCK_MS 45s:2103`, `onlineGame.ts:1298 resolveTeammateLocked`, `Game.tsx:366 handleRetractionComplete→onAnimationComplete→handleResolutionComplete` |
| Bottleneck | Previous stuck board: `phase WAITING` guard dropped `setPendingMove` (`gameState.ts:140`) — fixed via `clearPendingMove` + timeout recoveries |
| Safe refactor | **No animation→state coupling changed**: `ChessBoard` memo comparator still includes `onAnimationComplete` identity, `handleRetractionComplete` is `useCallback([onAnimationComplete])` so animation completion always fires; `showRetraction` visual flag is independent of `gameState.phase` (`SELECTING/LOCKED`); `onAnimationComplete` only clears `highlightSquares/pendingOverlay` via `handleResolutionComplete`, never gates `resolve()` or `startPendingTurn()` |
| Risks | **Critical — verified**: memo does not swallow `onAnimationComplete`; `ChessBoard` `destroy()` cleanup + `ResizeObserver disconnect` + `handleResize` patch remain; 45 s watchdog + `restoreCurrentTurnSubmissions`/`syncGameState` recoveries untouched |
| Verification | `npx tsc --noEmit` pass; manual regression checklist in Phase 16 covers all 6 interruption cases |

---

## Phase 10 — DOM/SVG/CSS Audit

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | Element/SVG/filter/shadow/animated/handler/overlay counts; wrappers; piece artwork format |
| Evidence | `ChessBoard.tsx:359 relative pt-[100%]` + `inset-0` backdrop (`backdrop-blur-xl` static) + `inset-1` board (`rounded-[22px] overflow-hidden`) = 2 layers; pieces Unicode `PIECE_CHARS:43` (cheap, no image decode); 64 squares + Markers SVG + ~13 animated nodes; wrappers retained for `rounded` clip |
| Bottleneck | No wrapper collapse without visual regression — kept as-is; string concat `left/top` per overlay already `%`-based (no layout thrash) |
| Safe refactor | **No DOM collapse** (would alter `rounded` clipping); Unicode pieces retained; `getSquarePercent` moved to module scope (no per-render allocation beyond returned object) |
| Risks | `overflow-hidden rounded-[22px]` preserved on board container |
| Verification | DOM count unchanged (64 + markers + overlays); `npx tsc --noEmit` pass |

---

## Phase 11 — Mobile / Capacitor

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | Android WebView/Capacitor — touch/pointer, passive listeners, scroll, viewport, ResizeObserver, DPR, rAF, GPU |
| Evidence | `useIsMobile.ts:7 768px mq matchMedia change`; `MobileChessBoard.tsx:20 touch-manipulation select-none` + now `memo`; `ChessBoard:70 ResizeObserver` + `116 handleResize patch` + `138 disconnect` + `will-change` |
| Bottleneck | Per-avatar `setInterval 1s` when disconnected; `backdrop-blur-xl` on board wrapper |
| Safe refactor | **Done**: `MobileChessBoard` now `memo`; `AvatarTile` interval only when `disconnected>0` (no intervals during normal play/drag); `ChessBoard` animations `will-change: transform,opacity` forces GPU layer in WebView; `touch-manipulation select-none` retained on `MobileChessBoard` wrapper; `ResizeObserver` cleanup verified; no change to `preventDefault` touch handling (cm-chessboard handles pointer events) |
| Risks | `backdrop-blur-xl` remains static (not animated) — acceptable on mid-tier WebView; monitor if `filter` cost high on low-end devices — fallback is to remove blur if Profiler shows paint cost |
| Verification | `npx tsc --noEmit` pass; `useIsMobile` `matchMedia change` listener passive by spec; drag test requires device |

---

## Phase 12 — CSS Audit

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | `box-shadow`, `backdrop-filter`, `filter`, `blur`, gradients, `transition: all`, layout-triggering anims, absolute layers |
| Evidence | `globals.css:62 --shadow-glow-*` vars retained (static); `ChessBoard:360 backdrop-blur-xl` static; `Game.tsx:2587 shadow-[0_0_40px_rgba(0,0,0,0.5)]` static; `BoardBottomNav:28-58` had `transition-all` on 5 buttons |
| Bottleneck | `transition-all` animates layout props |
| Safe refactor | **Done**: `BoardBottomNav.tsx` `transition-all` → `transition-[background-color,color,opacity,transform] duration-150 ease-out` (4 buttons) and `transition-[background-color,color]` for Back/Fwd; `MoveResolvedInline.tsx` `transition-all` on Continue → `transition-[background-color,opacity,transform]`; `ConfirmMoveBar.tsx` Confirm button `transition-all` → `transition-[background-color,opacity]`; `PendingMovesRow`/`ChessBoard` animations already `transform,opacity` only; `backdrop-blur/shadow` not animated per frame |
| Risks | None — explicit props cover needed hover/active transitions |
| Verification | `npx tsc --noEmit` pass; no remaining `transition-all` in board chrome (`grep` shows only non-board pages) |

---

## Phase 13 — Prevent Effect Loops

| Field | Detail |
|-------|--------|
| Status | `done` |
| Inspect scope | `useEffect(()=>setState,[…])` chains: render→effect→setState→render; derived state that should be `useMemo` |
| Evidence | `Game.tsx:332 overlay refs sync` (6 effects, now correct), `565 Game ON overlay`, `676 setOnStateChange [onlineGame,playerId]`, `1098 joinRoom`, `updateState` deps previously captured `accuracyHistory.length` |
| Bottleneck | Stale closure via `accuracyHistory.length` in deps would cause extra renders; derived `yourMoveForRow/teammateMoveForRow/resolutionData` were inline per render |
| Safe refactor | **Done**: derived state moved to `useMemo` (`yourMoveForRow`, `teammateMoveForRow`, `resolutionData`, `roundHistoryEntries`, `whitePlayers/blackPlayers`, `BoardTopBar` `whiteMaterial/sortedWhite`); `updateState` already uses functional `setAccuracyHistory(prev=>…)` at `809`; `whitePlayers/blackPlayers` deps narrowed to `userProfile.username/avatarUrl` not object identity; `getTimeRemaining` stable `useCallback`; no `useEffect` that `setState` was removed — all remaining `useEffect` sync refs or set intervals only on `status/matchTimerStarted` changes (not per tick) |
| Risks | Functional updates prevent stale `accuracyHistory` — verified; lobby→playing still via `joinRoom` effect + `setOnStateChange` |
| Verification | `npx tsc --noEmit` pass; no render→effect→setState loop in remaining effects (each effect gated by `status` or `matchTimerStarted` change, not `gameState` object) |

---

## Phase 14 — React Compiler

| Field | Detail |
|-------|--------|
| Status | `done` — not enabled (per spec) |
| Inspect scope | `react 19.2.4`, `next 16.2.6`, `next.config.ts` has no `reactCompiler`, `package.json` has no `babel-plugin-react-compiler` |
| Evidence | Compiler not enabled — correct |
| Bottleneck | N/A |
| Safe refactor | **Not enabled** — manual memo + isolated timer already address root causes; compiler would not fix `tickMatchTimer setGameState` full-tree rerender (now fixed via `IsolatedMatchTimer`) and could hide stale `fen` if inferred deps wrong. Re-evaluate only after Profiler shows remaining hot paths |
| Risks | None — intentional non-enable per spec "DO NOT enable blindly" |
| Verification | `next.config.ts` unchanged; `npx tsc --noEmit` pass |

---

## Phase 15 — Performance Targets

| Field | Detail |
|-------|--------|
| Status | `done` — targets defined, before/after measurement method established |
| Target | Desktop 60 FPS; Android 60 FPS where HW permits, no input lag, no stutter; select/move immediate; shadow smooth; timer 0 board rerenders; realtime/chat/presence 0 board freeze |
| Evidence | Harness `src/lib/perfHarness.ts` + `window.__CHESS_PERF__` + `React.Profiler` available via `?debug=1`; timer isolation ensures target achievable (only `IsolatedMatchTimer` rerenders per second) |
| Verification | Method: `?debug=1` → open `Game.tsx` → observe `window.__CHESS_PERF__.counters` after 10 s (timerTicks 10, chessBoardRenders should stay 0 unless move/pendingOverlay changed); Profiler commit duration target <16 ms, FPS ≥55 during shadow+retraction, tap→dot <50 ms — to be measured on device in Phase 17 |

---

## Phase 16 — Regression Testing

| Field | Detail |
|-------|--------|
| Status | `in_progress` — automated tests done, manual matrix requires device |
| Matrix | 1 Normal Duo 2 Two humans 3 Human+bot 4 Move submission 5 Teammate move 6 Shadow 7 Rejection 8 Resolution 9 Timer 10 Resign 11 Draw 12 Completion 13 Reconnection 14 Refresh 15 Mobile browser 16 Capacitor 17 Chat while playing 18 Presence 19 Notifications 20 Nav away/back — plus "board stuck after shadow move" |
| Verification | `npm test` 110 pass / 4 fail (pre-existing: `SidebarNav`, `ConfirmMoveBar`, `server/engine`, `PremiumPage` — no new failures vs baseline stash); `npx tsc --noEmit` pass. Manual 20-scenario matrix + shadow-move interruption (animation killed, refresh mid-shadow, realtime during animation, tab background/foreground, resize/orientation) to be executed on device before final merge |

---

## Phase 17 — Before/After Report

| Field | Detail |
|-------|--------|
| Status | `in_progress` — report skeleton; numbers to be filled after device Profiler run |
| Metrics | `Game` renders/s, `ChessBoard` renders per timer/move, square/piece renders, timer/presence/chat/realtime-triggered counts, FPS during move, tap latency — before vs after with measurement method |
| Before (static audit, before this branch) | `Game` ~1 render/s from `tickMatchTimer setGameState` + full subtree ( `ChessBoard` 1/s, `BoardTopBar` 1/s, `PendingMovesRow` 1/s, `MoveResolvedInline` IIFE 1/s even when `data` unchanged); `yourMoveForRow`/`teammateMoveForRow` `Array.from` per render; `BoardTopBar` `computeMaterial` per render; `ChessBoard` `filter`/`backgroundColor` per frame |
| After (this branch, static + memo) | `Game` 0 renders/s on timer tick (engine decrement only); `IsolatedMatchTimer` 1 render/s (isolated); `ChessBoard` 0 renders/s on timer (memo `fen/pendingOverlay` unchanged); `PendingMovesRow`/`MoveResolvedInline`/`BoardTopBar` 0 on timer unless their slice changed; `ChessBoard` animations GPU-only (`transform,opacity` + `will-change`), `MoveResolvedInline` `useMemo(insight)` + memo, `PendingMovesRow` memo, `BoardBottomNav` memo |
| Verification | No "optimized" claim without Profiler numbers — run `?debug=1` → `window.__CHESS_PERF__` + React Profiler `actualDuration` on device to fill Before/After table in Final Report §17 |

---

## Final Report (draft — numbers pending device Profiler)

1. Root bottleneck(s) — **timer tick `setGameState` full-tree rerender (60×/min)** primary; secondary `whitePlayers` dep on `fen` + `yourMoveForRow` per-render `Array.from`; tertiary `MoveResolvedInline` inline IIFE + `BoardTopBar` `computeMaterial` per render
2. Components causing excessive renders — `Game.tsx` monolith drove `ChessBoard`/`BoardTopBar`/`PendingMovesRow`/`MoveResolvedInline` every second (fixed via `IsolatedMatchTimer` + `memo`); `AvatarTile` per-tile interval now gated on `disconnected>0`
3. Expensive calculations — `g.board.fen()` serialization per `updateState`, `Array.from(getAllPendingMoves())` per row derivation, `computeMaterial`/`sortPieces` per `BoardTopBar` render — now memoized
4. CSS/animation bottlenecks — `filter: drop-shadow` + `backgroundColor` + `boxShadow` animated per frame (`ChessBoard` pending/retraction/winner), `transition-all` on `BoardBottomNav`/`ConfirmMoveBar`/`MoveResolvedInline` — now `transform,opacity` only + explicit `transition-[...]` + `will-change`
5. Realtime/state architecture problems — `notifyStateChange` → `setGameState({...entireGameState})` even for timer (now isolated); presence/turn_submissions `postgres_changes` → full spread but memo boundaries now provide slice isolation; lobby recovery + stale-lock watchdogs untouched
6. Exact files changed — `src/components/ChessBoard.tsx`, `BoardTopBar.tsx`, `PendingMovesRow.tsx`, `MoveResolvedInline.tsx`, `BoardBottomNav.tsx`, `ConfirmMoveBar.tsx`, `MobileChessBoard.tsx`, `Game.tsx`, `IsolatedMatchTimer.tsx` (new), `src/lib/perfHarness.ts` (new), `docs/BOARD_PERF_AUDIT_PROGRESS.md`
7. Exact refactors performed — `ChessBoard`/`MobileChessBoard`/`BoardTopBar`/`PendingMovesRow`/`MoveResolvedInline`/`BoardBottomNav` → `memo` with custom comparators; helpers to module scope/`useCallback`; `BoardTopBar` `computeMaterial` `useMemo`; `Game.tsx` `whitePlayers` dep narrowing, `yourMoveForRow`/`teammateMoveForRow`/`resolutionData` `useMemo`, `tickMatchTimer` engine-only + `IsolatedMatchTimer` self-polling + `visibilitychange` sync, `BoardTopBar.timerNode` slot, animation GPU-only, `transition-all` → explicit, `AvatarTile` interval gating
8. Before/after render counts — see Phase 17 table (to be filled with `window.__CHESS_PERF__` counts; static audit already shows timer 1 Hz full-tree → 1 Hz `IsolatedMatchTimer` only)
9. Before/after FPS/latency — to be measured on device (target commit <16 ms, FPS ≥55, tap→dot <50 ms)
10. Browser test results — `npx tsc --noEmit` pass; `npm test` 110 pass / 4 pre-existing fail — no new failures; manual matrix pending device
11. Capacitor test results — pending device (WebView `touch-manipulation`, `ResizeObserver`, `will-change` layer, `?debug=1` harness)
12. Regression results — shadow-move stuck path untouched (`showRetraction` visual-only, `handleRetractionComplete→onAnimationComplete` preserved, 45 s watchdog + `restoreCurrentTurnSubmissions`/`syncGameState` intact); full 20-scenario matrix pending
13. Remaining risks + rollback plan — Remaining: `games`/`room_players` permissive RLS still `FOR ALL USING(true)` (flagged in `ARCHITECTURE.md` Roadmap 5.5); `onlineGame` `setOnStateChange` still spreads entire `gameState` (memo mitigates but could be split into slices later); `backdrop-blur-xl` static cost on low-end WebView (monitor). Rollback: revert `IsolatedMatchTimer` + `timerNode` slot and restore `tickMatchTimer setGameState` on timer tick; revert `memo` comparators to function components (no logic change)

---

## Pre-commit Checklist (from ARCHITECTURE.md)

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — no NEW failures
- [ ] `min-h-[44px] min-w-[44px]` preserved
- [ ] `dark:` variants preserved
- [ ] No `require()` — ES imports only
- [ ] No `text-[9px]`/`[10px]`
- [ ] `GameInterface` changes in both `OnlineGame`+`LocalGame` (none planned) — `as GameInterface` not `as any`
- [ ] Magic numbers to `gameConstants.ts`
- [ ] `dynamic ssr:false` for game pages intact

---

*Last updated: 2026-08-23 — Phase 1 dependency map complete; harness design approved.*
