# Performance Audit — ChessDuo UI (baseline, 2026-09-15)

> Branch: `ui-refactoring`. Scope: UI presentation only (see `implementation-progress.md`).
> Target device: mid-range Android WebView (Capacitor APK); desktop Chrome as sanity check.

## 1. UI architecture (verified read-only)
- Next 16.2.6 + React 19.2.4 + Tailwind v4 + cm-chessboard 8.11.5 (DOM/SVG) + chess.js + framer-motion 12.38.0 (5.8M, 49 importers) + animejs 4.4.1 (2.5M, 5 shimmer importers) + stockfish.wasm 440K.
- Routes `/game /duel /coach /four-player /replay` use `next/dynamic(ssr:false)` + Suspense + ErrorBoundary (correct). Home `/` static.
- Providers eager on first paint: Toast/Network/Suspense/Premium/Splash/Badge + `preloadNativeAd()` + `createEvaluator()` + Capacitor listeners + SW `/sw.js`. Layout adds `theme-init.js beforeInteractive` + 3× chessboard CSS globally.
- `Game.tsx` 3031 lines (28 useState, 32 useEffect); monolithic `gameState` re-renders whole shell. `DuelGame.tsx` 680 lines; timer state in same component as board (1Hz parent render). `ChessBoard.tsx` memoized with custom comparator; `MobileChessBoard` thin wrapper.

## 2. Top bottlenecks + evidence
1. **P0 — Unstable memo-busting props**: `Game.tsx:2705` new `timerNode` JSX + `2696-2697` new player arrays defeat `BoardTopBar` custom comparator (`BoardTopBar.tsx:274-286`); inline nav handlers defeat `BoardBottomNav` shallow memo (`DuelGame.tsx:606-629`).
2. **P0 — DuelGame 1Hz parent tick**: `DuelGame.tsx:119-174` `setWhiteTime/setBlackTime` every tick; `BoardTopBar:492-493` re-renders by design (no IsolatedMatchTimer, unlike Game).
3. **P0 — Board input main-thread parses**: `ChessBoard.tsx:233-316` constructs `new Chess(fen)` + `moves({verbose:true})` 3× per gesture; ResizeObserver `setOverlayWidth:99-112` extra render; framer-motion overlays (8 particles, spring label, winner border) over `backdrop-blur-xl` frame (`:360`).
4. **P1 — Compositor-hostile CSS/anims**: 52 backdrop-blur, 56 gradients, 116 shadows; body dual radial-gradients + transition; 50-row stagger in HistoryPanel; height:auto anims; whileHover scale everywhere.
5. **P2 — Startup/bundle + lists**: framer-motion eager on home; chessboard CSS global; Stockfish pre-warm on `/`; animejs redundant; zero virtualization (History 50 animated, Chat unbounded+smooth scroll, Replay unbounded).

## 3. Baseline measurements
| Metric | Before | After | Method |
|---|---|---|---|
| First-load JS / TTI (mid-range WebView) | TODO — remote inspect + Lighthouse | — | Dev-only analyzer, removed before final |
| Game shell renders / 30s idle | TODO — React Profiler | — | |
| Board renders / timer-only 30s (Game vs Duel) | TODO — Profiler + counters | — | Expect Game≈0, Duel>0 before fix |
| Drag/tap input latency, frame drops | TODO — Performance trace | — | State honestly if WebView FPS unreliable |
| `npx tsc --noEmit` | TODO — run at each group | — | Must pass |
| `npm test` | TODO — run at each group | — | No new failures |

No numbers manufactured — all TODOs filled with profiler evidence during P0–P3.
No stack migration: fixable within current stack; canvas-board replacement is future-only.

## 5. Changes made (branch `ui-refactoring`, all UI-presentation-only)
See `implementation-progress.md` (UI Performance Refactor section) for per-group detail.
Summary: stabilized memo-busting props (`Game/DuelGame/ReplayView`), `DuelGame`
isolated 1 Hz timer + clock-tick filter, board input-path `chess.js` cache (3 parses → 1
per gesture) + board-frame blur removal, history stagger cap + content-visibility,
chat instant initial scroll, idle-deferred Stockfish pre-warm.
`tsc` clean; full suite matches clean baseline exactly (1394 pass, same 9 pre-existing
failures); scope grep clean. Device FPS TODOs remain for release-time WebView profiling.

## 4. Strategy pointer
See `implementation-progress.md` queue (P0→P3, smallest safe diff per group, re-measure each).
