# CHESSDUO — PHASE 5: ARCHITECTURAL REVIEW

> **Engineering roadmap deliverable.** Complete architecture review: dependencies, coupling, duplication, boundary violations, SSOT audit, risk analysis, and technical debt.
> This document is **documentation only** — no implementation changes were made.
> Pairs with: `01_REPOSITORY_DISCOVERY.md` (P1), `02_MODULE_ARCHITECTURE.md` (P2), `03_STATE_OWNERSHIP.md` (P3), `04_EVENT_FLOW.md` (P4).

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Architecture Health Score](#2-architecture-health-score)
3. [Dependency Graph](#3-dependency-graph)
4. [Coupling Matrix](#4-coupling-matrix)
5. [Boundary Violations](#5-boundary-violations)
6. [Duplicate Logic Report](#6-duplicate-logic-report)
7. [State Ownership Violations](#7-state-ownership-violations)
8. [High-Risk Modules](#8-high-risk-modules)
9. [Technical Debt Register](#9-technical-debt-register)
10. [Recommendations](#10-recommendations)
11. [Appendix](#11-appendix)

---

## 1. EXECUTIVE SUMMARY

This phase performed a **complete architecture review** of the ChessDuo repository beyond the documentation captured in Phases 1–4. Four parallel code-level analyses were executed: (1) all 31 `CONTEXT.md` files audited, (2) import-level dependency map of 21 key files, (3) source-level duplication scan, (4) test coverage gap analysis.

**Architecture health score: 42 / 100** (down from Phase 2's 52/100 — the deeper source-level review revealed more debt than documentation-only analysis captured).

### Key findings at a glance

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 1 | **`Game.tsx` (M17) is untested** — 2,477-line orchestrator with zero test file | CRITICAL | No `Game.test.tsx` exists |
| 2 | **`resolveLegacy` fully duplicates `resolvePendingMoves`** — ~170 identical lines inside `localGame.ts` | CRITICAL | Source comparison |
| 3 | **`features/auth/` contains React components** — violates the framework-free domain rule | HIGH | `AuthGate.tsx`, `useAuthSession.ts` import React |
| 4 | **`lib/settings.ts` exports a React hook** (`useSettings`) from the utilities layer | HIGH | `useState`/`useCallback` in lib/ |
| 5 | **`lib/chessUtils.ts` imports a type from `components/ChessBoard`** — inverted dependency | MEDIUM | `PromotionPiece` type |
| 6 | **MoveComparison construction duplicated in 3 resolution methods** (~25 lines × 3) | HIGH | onlineGame + localGame×2 |
| 7 | **Timer countdown + timeout winner logic duplicated in 3 places** — creates a timeout race | HIGH | onlineGame + Game.tsx + duelGame |
| 8 | **Move resolution has 4 implementations** (confirmed from P3) | HIGH | M14/M15/M16/M17 |
| 9 | **~1,950 lines of test code skipped** across 22 `describe.skip` blocks | HIGH | gameState, accuracy, localGame |
| 10 | **`duelGame.ts` (475 lines) has zero tests** | HIGH | 1v1 mode core engine |

### What is healthy
- **No `supabase.from()` calls in any `components/*.tsx` file** — components correctly delegate DB access to engines/services.
- **No true circular imports** among the 21 files analyzed — the import graph is acyclic.
- **`GameInterface` contract is the sole gateway** for `Game.tsx` to talk to engines (no `as any`).
- **`SubscriptionService.isPremium()` is used** in `ProfilePanel` and `InsightsGate` (not direct DB reads).
- **Billing state machine** (M30) is mature with hardened webhook/verify paths.
- **Push notification module** (M32) is well-hardened after multiple bug sweeps.

---

## 2. ARCHITECTURE HEALTH SCORE

| Dimension | Phase 2 | Phase 5 | Justification |
|-----------|---------|---------|---------------|
| Layer separation | 60 | **45** | `features/auth/` React components, `lib/settings.ts` hook, `lib/duelGame.ts` `'use client'` |
| Interface contracts | 75 | 75 | GameInterface strong; M16 still lacks shared contract |
| Single ownership | 35 | 30 | Timer/resolution/status still split; new: dual timer race |
| Dependency direction | 65 | **50** | `chessUtils`→components inversion; online→offline type imports |
| Testability | 40 | **30** | Game.tsx/DuelGame.tsx/duelGame.ts zero tests; ~1,950 skipped lines |
| Event-driven design | 55 | 55 | Coordinator pattern good; ordering assumptions fragile |
| Error handling | 50 | 50 | Toast + documented catches; no structured logging |
| Configuration management | 70 | 70 | Env vars defined; settings localStorage-only |
| Documentation | 65 | **60** | 5 new doc-code inconsistencies found (MultiPV, SvelteKit artifacts, etc.) |
| Modularity | 40 | 35 | God objects confirmed + new feature-auth duplication |
| **Overall** | **52** | **42** | Deeper source-level review revealed hidden debt |

**Score delta explanation**: Phase 2 was documentation-driven; Phase 5 verified against actual source. The 10-point drop reflects newly discovered layer violations (`features/auth/`, `lib/settings.ts`), the `resolveLegacy` full duplication, and the critical test gaps, not a regression in the codebase.

---

## 3. DEPENDENCY GRAPH

### 3.1 Verified import map (key files)

```
Game.tsx (M17) ── 49 imports ──────────────────────────────────────────────┐
  ├── react, next/navigation, framer-motion, lucide-react, chess.js        │
  ├── ./ChessBoard, MobileChessBoard, MoveComparison, GameOverModal,       │
  │   GameLobby, GameOnOverlay, EvaluatingLoader, SlideOver, ProfilePanel, │
  │   HistoryPanel, GameMenu, SettingsPanel, ResignConfirmModal,           │
  │   BoardTopBar, PendingMovesRow, ConfirmMoveBar, MoveResolvedInline,    │
  │   RoundHistorySidebar, BoardBottomNav, ChatPanel, MoveInsights,        │
  │   LeaveConfirmModal, MovePlayback, Toast, (22 local components)        │
  ├── @/features: localGame, onlineGame, GameInterface, gameState,         │
  │   chessBot, botConfig, avatars (6)                                     │
  ├── @/lib: supabase, authService, appUrl, chessUtils, sounds,            │
  │   matchHistory, settings, insights (8)                                 │
  ├── @/hooks: useIsMobile, useNavigationGuard, useCapacitorBackButton (3) │
  └── @/features/... engines receive `supabase` via constructor            │

DuelGame.tsx (M18) ── ~26 imports ─────────────────────────────────────────┐
  ├── react, next/navigation, framer-motion, lucide-react, chess.js        │
  ├── ./ChessBoard, MobileChessBoard, GameOverModal, GameMenu,             │
  │   ConfirmMoveBar, BoardBottomNav, BoardTopBar, SettingsPanel,          │
  │   ResignConfirmModal, LeaveConfirmModal, Toast (11 local)              │
  ├── @/lib/duelGame (engine), @/lib/supabase, @/lib/settings,             │
  │   @/lib/matchHistory, @/lib/sounds (5)                                 │
  ├── @/hooks: useIsMobile, useNavigationGuard, useCapacitorBackButton (3) │
  └── @/features/game-engine/gameState (Team type) (1)                     │

onlineGame.ts (M15) ── 14 imports ─────────────────────────────────────────┐
  ├── chess.js, @supabase/supabase-js (RealtimeChannel)                    │
  ├── ../../game-engine/gameState (GameState, GamePhase, Team, Player,     │
  │   CapturedPieces, PendingMoveInfo)                                     │
  ├── ../../offline/game/localGame (GameStatus, MoveComparison) ◄── MEDIUM │
  ├── ../../mobile-engine/evaluatorFactory (createEvaluator, GameEvaluator)│
  ├── ../../shared/accuracy, ../../shared/gameConstants (CHECKMATE_SCORE)  │
  ├── ../../../lib/supabase, authService, roomService, gamePersistence,    │
  │   debug (5)                                                            │

localGame.ts (M14) ── 9 imports ───────────────────────────────────────────┐
  ├── chess.js (Chess, Move)                                               │
  ├── ../../game-engine/gameState (6 types)                                │
  ├── ../../mobile-engine/evaluatorFactory                                 │
  ├── ../../shared/accuracy, ../../shared/gameConstants                    │
  ├── ../../../lib/debug                                                   │
  └── does NOT import GameInterface (interface imports FROM it ◄── inverted)│

duelGame.ts (M16) ── 6 imports ────────────────────────────────────────────┐
  ├── 'use client' directive (lib/ layer violation) ◄── LOW                │
  ├── chess.js, @supabase/supabase-js                                      │
  ├── ./supabase, @/features/mobile-engine/evaluatorFactory,               │
  │   @/features/shared/accuracy                                           │

providers.tsx ── ~20 imports from ALL 5 layers ────────────────────────────┐
  ├── components (Toast, NetworkOverlay, SplashHandler, PremiumCornerBadge)│
  ├── hooks (useNetworkStatus, useCapacitorBackButton, useScrollToTop,     │
  │   useNotificationRedirect, usePremium)                                 │
  ├── lib (supabase, authService, capacitorAuth)                           │
  ├── features (push-notifications, billing, mobile-engine) ◄── eager      │
  │   createEvaluator() side-effect                                        │
  └── app (loading)                                                        │

page.tsx (home) ── 33 imports from ALL 5 layers ───────────────────────────┐
  ├── react, next/navigation, lucide-react, framer-motion                  │
  ├── 11 components, 5 hooks, 9 lib modules, 2 features, 1 app             │
  └── GOD PAGE — marketing + session + room auto-join + matchmaking        │
```

### 3.2 Dependency categories per module

| Module | Incoming (consumers) | Outgoing (dependencies) | Direct deps | Hidden deps | Forbidden | Unused | Optional |
|--------|----------------------|-------------------------|-------------|-------------|-----------|--------|----------|
| M01 Auth | all pages, M30, M32 | Supabase, Capacitor | M27 | — | — | 3-way Google paths | Google native |
| M02 Profile | M17, M18, M33, home | M27, M30, M35 | 3 | direct reads in UI | — | — | — |
| M03 Settings | M17, M18, layout, settings page | none (localStorage) | 0 | **hook in lib/** (S1) | React | — | server sync (absent) |
| M04 Routing | all | M01, M17/M18 (lazy) | 2 | — | — | — | — |
| M05 Mobile Nav | (main)/layout, M17, M18 | M34, M31 | 2 | — | — | `BottomNav` legacy | — |
| M06 Capacitor | M01, M07, providers | Capacitor plugins, M01, M07 | 3 | — | — | — | iOS |
| M07 Deep Link | share UI, M32, M17 | M08, M27, M01 | 3 | `.well-known` deploy sync | — | — | — |
| M08 Room Mgmt | M07, M09, M10, M15, M16 | M27, M13 | 2 | RLS-safe join contract | — | — | — |
| M09 Matchmaking | home page | M08, M27, M13 | 3 | O(n) room scan | — | — | queue table |
| M10 4-Player Lobby | four-player page, M11 | M08, M27 | 2 | — | — | — | — |
| M11 Lobby UI | M17, M18, M10 page | M07, share | 2 | 60s magic number | — | — | — |
| M12 GameState | M14, M15 | chess.js, M13 | 2 | — | — | `DEFAULT_MOVE_TIMER_SECONDS` | — |
| M13 Shared/Constants | M14, M15, M17, M18, M20, M23, M24, M31 | chess.js types, M12 types | 2 | — | — | — | — |
| M14 LocalGame | M17 | M12, M13, M23, M24 | 4 | — | M16? no | — | — |
| M15 OnlineGame | M17 | M12, M13, M23, M26, M27, M28 | 6 | coordinator alphabetical order | — | `_forceCreate` dead | — |
| M16 DuelGame | M18 | chess.js, M23, M27, M28 | 4 | divergent presence scheme | **React via 'use client'** | — | — |
| M17 Game Shell | /game page | M14/M15, M19, M22, M25, M31, M34, M35, M01, M02, M03, M05 | 11+ | — | **direct `profiles` reads** | — | — |
| M18 Duel Shell | /duel page | M16, M19, M05, M22, M01/M02 | 6 | — | **direct `profiles` reads** | — | — |
| M19 ChessBoard | M17, M18 | cm-chessboard, chess.js, M13 | 3 | chess.js dual validation | — | — | — |
| M20 Move Resolution | M17 | M23 | 1 | **no owner** | — | — | — |
| M21 Turn Mgmt | M17 | M15, M12 | 2 | UI-driven bot continuation | — | — | — |
| M22 Timer | M17, M18 | M12, M15 | 2 | **4 owners** | — | — | — |
| M23 Stockfish | M14, M15, M16, M24 | WASM worker, M13 | 2 | eager init in providers | — | Render server orphaned | — |
| M24 Bot AI | M14, M15, M17 | M23, M13 | 2 | bot orchestration in M17 | — | — | — |
| M25 Playback | M17, M18, M35 | M13, framer-motion, M19 | 3 | — | — | — | — |
| M26 Game Persistence | M15, M35 | M27 | 1 | untyped `games` table | — | — | — |
| M27 Supabase Client | every module | @supabase/ssr, @supabase/supabase-js | 2 | — | — | — | generated types |
| M28 Realtime Layer | M15, M16, M34, hooks | @supabase/supabase-js | 1 | bypassed by M16/M34 | — | — | — |
| M29 API Infra | M30, M32 routes | M27, Supabase, jose | 3 | per-isolate rate limit | — | — | — |
| M30 Premium Billing | M31, M02, premium page | creem, @creem_io/nextjs, M27, M29, M01 | 5 | webhook metadata gaps | — | — | Apple/Google |
| M31 Insights | M17, premium page | M13, M30, M27 | 3 | — | **direct `profiles.is_premium` fallback** | `insights_reveals_used` dead | — |
| M32 Push Notif | providers, M33, M34, M17 | web-push, jose, M27, M29, M01, M07 | 6 | bridge listener ordering | — | — | — |
| M33 Friends | friends page, badge | M27, M32, M34 | 3 | badge table-name mismatch | — | — | — |
| M34 Chat | ChatPanel, FriendsPanel, M17 | M27, M32, M33 | 3 | — | — | — | — |
| M35 History | M17, M18, history, profile | M27, M13 | 2 | dual storage no reconcile | — | — | cloud sync |

### 3.3 Circular dependencies

**Import-level:** none detected — the graph is acyclic.

**Logical (control-flow) cycles** (from P2 §7.4, confirmed unchanged):
- M15 ↔ M17 — engine broadcasts → UI reacts → UI calls engine (callback-mediated).
- M30 ↔ M02 — SubscriptionService writes `profiles`; ProfilePanel reads it (one row, two modules).
- M33 ↔ M34 — FriendsPanel opens ChatPanel; message broadcasts drive FriendsPanel badges.

**Structural inversion (new in Phase 5):**
- `features/shared/GameInterface.ts` imports `GameStatus`, `MoveComparison` **from** `features/offline/game/localGame.ts` — the shared contract depends on one implementation's types. `onlineGame.ts` also imports these from `localGame.ts`. These types belong in `features/shared/`.
- `lib/chessUtils.ts` imports `PromotionPiece` **from** `components/ChessBoard.tsx` — data layer depends on the presentation layer.

### 3.4 Hidden dependencies (verified at source)

| # | Hidden dependency | Where |
|---|-------------------|-------|
| H1 | `providers.tsx` eagerly calls `createEvaluator()` as a side effect (return value discarded) — game pages depend on it implicitly | `providers.tsx` |
| H2 | Coordinator election relies on alphabetical player-ID ordering across clients | `onlineGame.ts` |
| H3 | M07 challenge pre-created rooms depend on `host_team` + `get_room_join_state` RPC (RLS contract) | `challenges.ts` |
| H4 | M32 deep-link routing depends on `.well-known/` files being deployed in sync | `push-notifications/` |
| H5 | M17 game-over save depends on localStorage presence; DB save is silent best-effort | `Game.tsx` |
| H6 | `useBadgeCount` depends on specific Realtime table names matching schema | `useBadgeCount.ts` |
| H7 | `lib/settings.ts` hook couples pure utilities to React | `settings.ts` |
| H8 | `lib/insights.ts` dynamic-imports billing with a raw `profiles.is_premium` fallback | `insights.ts` |
| H9 | `lib/duelGame.ts` `'use client'` directive makes it browser-only from lib/ | `duelGame.ts` |
| H10 | `app/challenge/[code]/client.tsx` queries `rooms` directly, bypassing `lib/roomActions` | `client.tsx` |

### 3.5 Unused / orphaned dependencies

| Item | Status |
|------|--------|
| Render Stockfish server (`server/`) | Orphaned — `SERVER_URL` removed from engines; deployment still exists |
| `DEFAULT_MOVE_TIMER_SECONDS = 10` | Declared, effectively unused (turns are event-driven) |
| `_forceCreate` field in OnlineGame | Appears dead |
| `BottomNav.tsx` | Legacy mobile nav, superseded by `BoardBottomNav`/`HomeBottomNav` |
| `profiles.insights_reveals_used` column | Written nowhere client-side |
| `TeamIndicator.tsx` | Marked legacy in ARCHITECTURE.md, replaced by `BoardTopBar` |
| `ConfirmMoveButton.tsx` | Phase 9 replaced it with `ConfirmMoveBar` — verify no importers remain |

---

## 4. COUPLING MATRIX

### 4.1 Coupling heat map (module → dependency fan-out)

| Module | Fan-out (imports) | Coupling | Verdict |
|--------|------------------|----------|---------|
| **M17 Game.tsx** | 49 | EXTREME | Tight to 22 local components + 8 lib + 6 features + 3 hooks |
| **home page.tsx** | 33 | EXTREME | God page: marketing + session + room + matchmaking + nav |
| **providers.tsx** | ~20 | HIGH | Cross-layer integration point (expected, but Stockfish init is a side effect) |
| **M15 OnlineGame** | 14 | HIGH | Networking + resolution + timer + reconnect in one class |
| **M18 DuelGame.tsx** | ~26 | HIGH | Duplicates half of M17's orchestration |
| **M30 Billing** | 5-7 | MEDIUM | Well-abstracted behind `BillingProvider` |
| **M12 GameState** | 2 | LOW | Cleanest module — framework-free |
| **M32 Push** | 6 | MEDIUM | Well-hardened, isolated |

### 4.2 Coupling relationships (tight / loose)

| Relationship | Type | Direction | Risk | Notes |
|--------------|------|-----------|------|-------|
| M17 ↔ M15 (Game.tsx ↔ OnlineGame) | Tight — callback control loop | bidirectional | HIGH | `setOnStateChange` + refs; stale-closure risk |
| M17 ↔ M14 (Game.tsx ↔ LocalGame) | Tight | bidirectional | MEDIUM | same callback pattern |
| M17 ↔ M19 (Game.tsx ↔ ChessBoard) | Tight — prop contract | down | MEDIUM | boardKey remount coupling |
| M17 ↔ sub-components | Tight — prop drilling | down | MEDIUM | 22 direct children |
| M15 ↔ M28 (OnlineGame ↔ subscriptionManager) | Loose | down | LOW | registry only |
| M30 ↔ M31 (billing ↔ insights) | Tight — leaky | M31→M30 | MEDIUM | `insights.ts` direct `profiles` fallback |
| M33 ↔ M34 (friends ↔ chat) | Tight — shared panel | bidirectional | MEDIUM | FriendsPanel embeds chat |
| M14 ↔ M15 (local ↔ online) | Tight — type inversion | online→offline | MEDIUM | shared types in wrong module |
| M16 ↔ M18 (duel engine ↔ shell) | Tight | bidirectional | HIGH | island: no shared contract |
| M32 ↔ M07 (push ↔ deep link) | Loose | M32→M07 | MEDIUM | redirect routing coupling |

### 4.3 Shared state / services / utilities inventory

| Shared item | Consumers | Owner | SSOT |
|-------------|-----------|-------|------|
| `BrowserMoveEvaluator` singleton | M14, M15, M16, M24 | M23 via factory | ✅ |
| `evaluationCache` | M23, M24 | M23 (with M13 doc overlap) | ✅ |
| `subscriptionManager` | M15, M16, M34 | M28 | ✅ (bypassed by M16/M34) |
| `supabase` client | every module | M27 | ✅ |
| `useSettings` hook | M17, M18, layout | M03 (in lib/) | ✅ (layer violation) |
| `useGameToast` | M17, M18, panels | Toast context | ✅ |
| `useBadgeCount` | home nav, friends | M33 | ⚠ duplicated per-mount |
| `PremiumContext` | premium page, gates | M30 | ⚠ derived copy |
| Match timer | M12, M15, M17, M22 | none | ❌ 4 owners |
| Move resolution | M14, M15, M16, M17 | none | ❌ 4 impls |

### 4.4 God objects / services / modules

| Module | Size | Why it's a god object |
|--------|------|-----------------------|
| **M17 Game.tsx** | 2,477 lines, 49 imports, 28+ useState, 16+ useRef, 14+ useEffect | Orchestrates engines, bots, timers, sounds, persistence, modals, playback, insights, chat |
| **M15 OnlineGame** | 1,679 lines | Networking + coordinator + resolution + timer + reconnect + polling |
| **home page.tsx** | 33 imports | Marketing + session + room auto-join + matchmaking + pending-action recovery |
| **M01 Auth.tsx** | — | UI + session state machine mixed |
| **FriendsPanel** | — | List + requests + search + chat overlay in one component |
| **providers.tsx** | ~20 imports | All-layers bootstrap (partially justified) |

### 4.5 Modules that should eventually be split

| Module | Suggested split (NOT performed) |
|--------|----------------------------------|
| M17 Game.tsx | `useGameEngine`, `useBotOrchestrator`, `useMatchTimer`, `useSoundEffects`, `useGameOverPersistence`, `GameShell` |
| M15 OnlineGame | `ChannelManager`, `PresenceManager`, `CoordinatorResolution`, `TimerSync`, `ReconnectPolicy` |
| M01 Auth.tsx | `useAuth` hook + `AuthForm` + `SocialLoginButton` |
| M08 roomActions | `RoomCreator` (online), `MatchmakingRooms`, `FourPlayerRooms` |
| M16 duelGame.ts | move to `features/duel/`; split engine vs sync |
| M28 subscriptionManager | `ChannelFactory` + `ChannelRegistry` |
| home page.tsx | `HomePage` (marketing) + `usePendingAction` hook + `useQuickPlay` hook |
| lib/settings.ts | `lib/settingsStorage.ts` (pure) + `hooks/useSettings.ts` (React) |

---

## 5. BOUNDARY VIOLATIONS

### 5.1 Layer violations (module in wrong layer)

| # | Violation | File | Severity | Should be |
|---|-----------|------|----------|-----------|
| BV1 | **React component in `features/`** | `src/features/auth/AuthGate.tsx` (imports React, framer-motion, `@/components/*`) | HIGH | `src/components/AuthGate.tsx` |
| BV2 | **React hook in `features/`** | `src/features/auth/useAuthSession.ts` (imports useState/useEffect/useRef/useCallback) | HIGH | `src/hooks/useAuthSession.ts` |
| BV3 | **React hook in `lib/`** | `src/lib/settings.ts` exports `useSettings()` (useState/useCallback, `'use client'`) | HIGH | split: pure utils in lib/, hook in hooks/ |
| BV4 | **Engine in `lib/`** | `src/lib/duelGame.ts` (`'use client'`, full game engine) | LOW-MEDIUM | `src/features/duel/` (confirmed from P2) |
| BV5 | **Type inversion: lib → components** | `src/lib/chessUtils.ts` imports `PromotionPiece` from `../components/ChessBoard` | MEDIUM | move type to `features/shared/gameConstants.ts` |

### 5.2 A module performing another module's responsibility

| # | Violation | Where | Responsible owner bypassed |
|---|-----------|-------|---------------------------|
| BV6 | **Direct `profiles` reads in UI** | `Game.tsx`, `DuelGame.tsx`, `Auth.tsx`, `ChooseUsername.tsx`, `ProfilePanel.tsx`, `FriendsPanel.tsx`, `ProfileEditor.tsx`, home `page.tsx`, `invite/[userId]/client.tsx` — 12+ call sites | M02 `profileService` (exists, inconsistently used) |
| BV7 | **`insights.ts` fallback queries `profiles.is_premium` directly** | `src/lib/insights.ts` (dynamic-import failure fallback) | M30 `SubscriptionService` |
| BV8 | **`app/challenge/[code]/client.tsx` queries `rooms` table directly** | `supabase.from('rooms').select(...)` in page | M08 `roomActions` |
| BV9 | **`ChatPanel.tsx` directly calls `notifyChatMessage` from push-notifications feature** | `src/components/ChatPanel.tsx` | M32 abstraction |
| BV10 | **`providers.tsx` eagerly initializes Stockfish as a side effect** | `createEvaluator()` return value discarded | M23 bootstrapping concern |

### 5.3 Business logic inside UI components

| # | Logic | Location | Severity |
|---|-------|----------|----------|
| BV11 | Bot turn continuation (`pendingOpponentTurnRef`, `initialBotTurnTriggeredRef`, `opponentInProgressRef`) | `Game.tsx` | HIGH (P3 V9) |
| BV12 | Match timer timeout winner determination (captured-piece comparison) | `Game.tsx tickMatchTimer` | HIGH — duplicates M15 |
| BV13 | Sound detection on state change (FEN/captured diff) | `Game.tsx`, `DuelGame.tsx` | MEDIUM (duplication) |
| BV14 | Auth sign-in state machine | `Auth.tsx` | MEDIUM |
| BV15 | Promotion handling | `Game.tsx`, `DuelGame.tsx` | MEDIUM |
| BV16 | Game-over save orchestration | `Game.tsx`, `DuelGame.tsx` | MEDIUM |

### 5.4 Navigation inside business logic

| # | Violation | Location |
|---|-----------|----------|
| BV17 | `router.push` / `router.replace` inside game-flow handlers (game-over navigate home, resign 200ms navigate) | `Game.tsx` |
| BV18 | Home page performs route-driven room auto-join from URL params | `page.tsx` |
| BV19 | Deep-link URL translation in `capacitorAuth.ts` (M06) rather than M07 | `capacitorAuth.ts` |

### 5.5 Database logic inside presentation

| # | Violation | Location |
|---|-----------|----------|
| BV6 | Direct `profiles` queries in 9+ UI files | components + pages (see table above) |
| BV8 | Direct `rooms` query in challenge page | `app/challenge/[code]/client.tsx` |

### 5.6 Realtime logic inside rendering

| # | Violation | Location |
|---|-----------|----------|
| BV20 | `useBadgeCount` creates Realtime channels per component mount | `useBadgeCount.ts` |
| BV21 | `FriendsPanel` / `MatchmakingQueue` / `FourPlayerLobby` create channels inside component lifecycle | components |
| BV22 | M16/M34 create channels directly, bypassing M28 factory | `duelGame.ts`, `messages.ts` |

### 5.7 Board rendering changing game state / game state changing navigation

| # | Violation | Location | Notes |
|---|-----------|----------|-------|
| BV23 | `boardKey` remount used to cancel moves (cancel flow mutates render state) | `Game.tsx`, `DuelGame.tsx` | board render → UI state side effect |
| BV24 | `prevFenRef`/`prevGameFenRef` diffs trigger sounds (render-driven game reactions) | `Game.tsx` | engine/UI coupling |
| BV25 | Game status → navigation (GAME_OVER → router.push home) | `Game.tsx` | game state changes navigation |

---

## 6. DUPLICATE LOGIC REPORT

### 6.1 Move resolution (M20) — 4 implementations

| Path | Location | Notes |
|------|----------|-------|
| Online | `onlineGame.ts:resolvePendingMoves` (1372–1494) | coordinator, 2 moves → evaluator → MoveComparison |
| Offline | `localGame.ts:resolvePendingMoves` (297–409) | 2 moves → evaluator → MoveComparison |
| Offline legacy | `localGame.ts:resolveLegacy` (476–586) | **full duplicate** of resolvePendingMoves via old API |
| Duel | `duelGame.ts:makeMove` | 1 move + inline accuracy, no comparison |

**Severity: CRITICAL** — `resolveLegacy` (~170 lines) is a near-verbatim copy of `resolvePendingMoves` using `lockMove`/`getSelectedMove`/`this.gameState.fen` instead of the pending API. Called only from `Game.tsx executeBotMove`.

### 6.2 Identified duplications (complete list)

| # | Duplicated logic | Locations | Lines | Severity |
|---|------------------|-----------|-------|----------|
| D1 | `resolveLegacy` vs `resolvePendingMoves` (LocalGame) | `localGame.ts` | ~170 | **CRITICAL** |
| D2 | Checkmate short-circuit (temp Chess, try move, isCheckmate, MoveComparison w/ CHECKMATE_SCORE) | `onlineGame.ts`, `localGame.ts`×2 | ~55 × 3 | HIGH |
| D3 | MoveComparison object construction (20+ props) | `onlineGame.ts`, `localGame.ts`×2 | ~25 × 3 | HIGH |
| D4 | Timer countdown + timeout winner logic (captured-piece comparison) | `onlineGame.ts`, `Game.tsx`, `duelGame.ts` | ~40 × 3 | HIGH |
| D5 | AudioContext resume pattern (`tryResumeAudio`) | `Game.tsx`, `DuelGame.tsx` | ~18 × 2 | HIGH |
| D6 | Score calculation + winner determination | `onlineGame.ts`, `localGame.ts`×2 | ~35 × 3 | MEDIUM-HIGH |
| D7 | Sound triggers on state change (FEN/captured diff) | `Game.tsx`, `DuelGame.tsx` | ~30 × 2 | MEDIUM-HIGH |
| D8 | Game-over save effect | `Game.tsx`, `DuelGame.tsx` | ~66 × 2 | MEDIUM |
| D9 | `getMoveParts(move, fen)` helper | `onlineGame.ts`, `localGame.ts` | ~14 × 2 | MEDIUM |
| D10 | chess.js move validation (new Chess(fen) + verbose moves find) | `ChessBoard.tsx` (3×) + `gameState.ts tryMove` | ~8 × 4 | MEDIUM |
| D11 | Promotion handling (auto-queen + modal) | `Game.tsx`, `DuelGame.tsx` | ~15 × 2 | MEDIUM |
| D12 | `getResult()` game-over condition chain | `onlineGame.ts`, `localGame.ts`, `duelGame.ts` | ~12 × 3 | MEDIUM |
| D13 | `getGameOverReason()` chain | `onlineGame.ts`, `localGame.ts` | ~10 × 2 | MEDIUM |
| D14 | Room insert + player registration | `roomActions.ts`, `matchmaking.ts` | ~30 × 2 | MEDIUM |
| D15 | Four-player vs online room creation | `roomActions.ts`, `fourPlayerActions.ts` | ~30 × 2 | MEDIUM |
| D16 | Direct `supabase.from('profiles')` fetch pattern | 12+ call sites | — | MEDIUM |
| D17 | Reconnection timer restoration | `onlineGame.ts`, `duelGame.ts` | ~20 × 2 | MEDIUM |
| D18 | Capacitor back-button pattern | `Game.tsx`, `DuelGame.tsx` | ~15 × 2 | LOW-MEDIUM |
| D19 | SVG circular timer rendering | `MatchTimer.tsx`, `TeamTimer.tsx` | ~30 × 2 | LOW-MEDIUM |
| D20 | Room code generation (`generateRoomCode` vs `generateCode`) | `roomActions.ts`, `matchmaking.ts` | ~7 × 2 | LOW |
| D21 | Sound settings sync effect | `Game.tsx`, `DuelGame.tsx` | ~3 × 2 | LOW |
| D22 | `useNavigationGuard` usage + LeaveConfirmModal | `Game.tsx`, `DuelGame.tsx` | ~3 + modal | LOW |
| D23 | Timer cleanup pattern | `onlineGame.ts`, `duelGame.ts` | ~5 × 3 | LOW |

### 6.3 Duplication by category (Phase 5 requirements)

| Category | Duplicated items | Locations |
|----------|------------------|-----------|
| **Business logic** | Move resolution (D1–D3, D6), game-over detection (D12–D13), room creation (D14–D15) | engines + UI |
| **State** | Match timer (D4), settings hook (BV3), badge counts, FEN copy | M12/M15/M17/M22, M31 |
| **Validation** | chess.js legal-move dots (D10), engine validation | M19 + M12 |
| **Navigation** | Nav guard + leave modal (D22), back button (D18) | M17 + M18 |
| **Realtime handling** | Channel creation (BV22), presence schemes | M15 vs M16, M34 |
| **Database queries** | Direct `profiles` fetch (D16), direct `rooms` query (BV8) | components + pages |
| **Stockfish calls** | Eval pipeline in resolve methods (D6), fallback eval in M24 | engines + bots |
| **Move resolution** | 4 implementations (D1–D3, D6) | M14/M15/M16/M17 |
| **Notification logic** | Push trigger patterns in ChatPanel/M33 | M32 call sites |
| **Premium logic** | `isPremium` read paths (M30 vs M31 fallback) | M30/M31 |
| **Deep link logic** | URL parsing (M06 vs M07), getPathFromUrl | capacitorAuth, appUrl |
| **Friend logic** | friendService vs friends.ts overlap | lib/ |
| **History logic** | dual storage save/read | M35 |
| **Authentication logic** | 3-way Google paths, auth in AuthGate + Auth.tsx | M01 |

---

## 7. STATE OWNERSHIP VIOLATIONS

### 7.1 Phase 3 violations — re-verified unchanged

All 10 primary violations (V1–V10) from `03_STATE_OWNERSHIP.md` are **confirmed at source** with no resolution:

| # | Violation | SSOT verdict | Status |
|---|-----------|--------------|--------|
| V1 | Match timer — 4 owners + M16 island | ❌ | Confirmed |
| V2 | Board FEN dual source (engine vs M17 aggregate) | ⚠ | Confirmed |
| V3 | Move resolution — no owner (4 impls) | ❌ | Confirmed + D1 CRITICAL |
| V4 | Premium bypass read path (M31 direct read) | ⚠ | Confirmed + BV7 fallback |
| V5 | `profiles` row split writer (M02 + M30) | ⚠ | Confirmed |
| V6 | Divergent status enums (GameStatus vs M16 strings) | ⚠ | Confirmed |
| V7 | History dual storage (localStorage + DB, no reconcile) | ⚠ | Confirmed |
| V8 | `ROOM_EXPIRY_MS` duplicated (24h vs 60s) | ⚠ | Confirmed |
| V9 | UI-driven turn advancement (M17 refs) | ⚠ | Confirmed |
| V10 | Duel architecture island | ⚠ | Confirmed |

### 7.2 New state ownership findings (Phase 5)

| # | Finding | Severity | Detail |
|---|---------|----------|--------|
| S1 | **Settings hook lives in lib/** — `useSettings()` React hook shares a file with pure localStorage utils | MEDIUM | violates framework-free layering; couples pure code to React |
| S2 | **Dual timer race**: Game.tsx `tickMatchTimer` AND OnlineGame `startMatchTimer` both decrement and both can fire timeout — captured-piece winner logic duplicated | HIGH | R18 from P4 confirmed at source |
| S3 | **Badge subscription target mismatch**: `useBadgeCount` subscribes to `friend_requests` table name not in schema (`friendships.status='pending'` is the real model) | MEDIUM | R14 from P4; needs verification of actual table filter |
| S4 | **Type ownership inversion**: `GameStatus`/`MoveComparison` defined in `localGame.ts` but used by `GameInterface` + `onlineGame` — shared types owned by an implementation | MEDIUM | structural violation |
| S5 | **`profileService.ts` exists but is inconsistently used** — 12+ call sites bypass it | MEDIUM | BV6 |
| S6 | **`friends.ts` and `friendService.ts` overlap** — two friend modules with unclear ownership | LOW-MEDIUM | duplication |
| S7 | **`DEFAULT_MOVE_TIMER_SECONDS` unused** — declared constant for a feature that doesn't exist | LOW | dead state |
| S8 | **`profiles.insights_reveals_used` dead column** — quota SSOT is localStorage only | LOW | P3 S7 confirmed |

### 7.3 SSOT summary (updated)

| Verdict | Count | States |
|---------|-------|--------|
| ✅ Single | 14 | Auth, settings (despite layer issue), room, room_players, submitted/locked moves, current turn, game persistence, push tokens, messages, friendships, challenge links, evaluation cache, channel registry, notification redirect |
| ⚠ Split | 10 | profile row, premium status, board FEN, game status, stats, completed history, insights quota, unread counts, premium context, duel clocks |
| ❌ None | 3 | resolved move, move comparison, match timer |

**SSOT health: 40 / 100** (unchanged from Phase 3 — no fixes were applied in Phase 5).

---

## 8. HIGH-RISK MODULES

Ranked by (complexity × coupling × regression risk ÷ maintainability × testability × scalability).

| Rank | Module | Rating | Complexity | Coupling | Regression risk | Maintainability | Testability | Scalability |
|------|--------|--------|-----------|----------|-----------------|---------------|-------------|-------------|
| 1 | **M17 Game.tsx** | **CRITICAL** | 2,477 lines, 44 state vars | 49 imports | EVERY change risks all modes | Very low | Zero tests | Low |
| 2 | **M15 OnlineGame** | **CRITICAL** | 1,679 lines | 14 imports | broadcast ordering + reconnect | Low | Partial (31 tests, no reconnect) | Medium |
| 3 | **M16 duelGame.ts** | **HIGH** | 475 lines | island | 1v1 mode entirely | Low | Zero tests | Low |
| 4 | **M12 GameState** | **HIGH** | 353 lines | low | core state machine | High | **Entire suite skipped** | High |
| 5 | **M18 DuelGame.tsx** | **HIGH** | 634 lines | 26 imports | duplicates M17 | Low | Zero tests | Low |
| 6 | **M22 Timer** | **HIGH** | split 4 ways | high | timeout races | Low | Partial | Medium |
| 7 | **M20 Move Resolution** | **HIGH** | 4 impls | high | D1 CRITICAL | Very low | Partial (skipped) | Medium |
| 8 | **M01 Auth** | **MEDIUM** | 3 Google paths | medium | session races | Medium | Partial | Medium |
| 9 | **M07 Deep Link** | **MEDIUM** | moderate | medium | prod bugs 37/38/39 | Medium | Partial | Medium |
| 10 | **M08/M09 Room/Matchmaking** | **MEDIUM** | moderate | medium | expiry constants, O(n) scan | Medium | Partial | Low at scale |
| 11 | **M30 Billing** | **MEDIUM** | high logic | medium | webhook metadata | High | Good | High |
| 12 | **M32 Push** | **MEDIUM** | moderate | medium | bridge races | High | Minimal (1 test) | Medium |
| 13 | **M33/M34 Friends/Chat** | **MEDIUM** | moderate | medium | badge mismatch | Medium | Partial | Medium |
| 14 | **M35 History** | **LOW** | low | low | dual storage | Medium | Partial | Low |
| 15 | **M13/M19/M23/M24/M25/M26/M27/M28/M29/M31** | **LOW–MEDIUM** | — | — | — | — | — | — |

### 8.1 Regression hotspots (highest-value test targets)

| Hotspot | Why |
|---------|-----|
| **Game.tsx turn lifecycle** | 2,477 untested lines; every mode passes through it |
| **OnlineGame `resolvePendingMoves`** | coordinator path + checkmate short-circuit (D2) |
| **OnlineGame reconnect / `syncGameState`** | R2 race — DB load vs in-flight broadcasts; untested |
| **Game.tsx `tickMatchTimer`** | duplicates M15 timeout logic; race (R18) |
| **gameState.ts** | core state machine, entire test suite skipped |
| **duelGame.ts** | 1v1 engine, zero tests |
| **broadcast ordering (`turn_resolved` vs `player_locked`)** | R1 — the 2026-08-03 bug |
| **Game-over save effect** | D8 duplication + `gameSavedRef` dedupe |

---

## 9. TECHNICAL DEBT REGISTER

### 9.1 Structural (S)

| ID | Debt | Module | Severity | Source |
|----|------|--------|----------|--------|
| S-01 | God object: Game.tsx | M17 | CRITICAL | P2 §7.5, verified |
| S-02 | God object: OnlineGame | M15 | HIGH | P2 §7.5 |
| S-03 | God page: home page.tsx | M04 | HIGH | this phase |
| S-04 | resolveLegacy full duplication | M14 | CRITICAL | D1 |
| S-05 | 4 move-resolution implementations | M20 | HIGH | V3 |
| S-06 | Timer 4 owners + island | M22 | HIGH | V1 |
| S-07 | Duel architecture island | M16/M18 | HIGH | V10 |
| S-08 | No shared GameShell (Game vs Duel) | M17/M18 | HIGH | P2 |
| S-09 | GameInterface depends on localGame types | M13 | MEDIUM | S4 |
| S-10 | `features/auth/` React components | M01 | HIGH | BV1/BV2 |
| S-11 | `lib/settings.ts` hook | M03 | HIGH | BV3 |
| S-12 | `lib/duelGame.ts` in wrong layer | M16 | LOW-MED | BV4 |
| S-13 | `chessUtils`→components type inversion | M13 | MEDIUM | BV5 |
| S-14 | `profileService` inconsistently used | M02 | MEDIUM | S5 |
| S-15 | `friends.ts` vs `friendService.ts` overlap | M33 | LOW-MED | S6 |

### 9.2 Duplication (D)

| ID | Debt | Severity | Source |
|----|------|----------|--------|
| D-01 | Checkmate short-circuit ×3 | HIGH | D2 |
| D-02 | MoveComparison construction ×3 | HIGH | D3 |
| D-03 | Timer countdown + timeout ×3 | HIGH | D4 |
| D-04 | AudioContext resume ×2 | HIGH | D5 |
| D-05 | Sound triggers ×2 | MED-HIGH | D7 |
| D-06 | Game-over save effect ×2 | MEDIUM | D8 |
| D-07 | Room creation ×3 paths | MEDIUM | D14/D15 |
| D-08 | Direct `profiles` fetch ×12+ | MEDIUM | D16 |
| D-09 | `getResult`/`getGameOverReason` chains | MEDIUM | D12/D13 |
| D-10 | Move validation (board + engine) | MEDIUM | D10 |
| D-11 | Promotion handling ×2 | MEDIUM | D11 |
| D-12 | Reconnect timer restore ×2 | MEDIUM | D17 |
| D-13 | Nav guard + back button ×2 | LOW-MED | D18/D22 |
| D-14 | Circular timer SVG ×2 | LOW-MED | D19 |
| D-15 | Room code gen ×2 | LOW | D20 |
| D-16 | Sound settings sync ×2 | LOW | D21 |
| D-17 | Timer cleanup ×3 | LOW | D23 |

### 9.3 Layering / boundary (B)

| ID | Debt | Severity | Source |
|----|------|----------|--------|
| B-01 | UI→DB direct reads (profiles, rooms) | HIGH | BV6/BV8 |
| B-02 | M31 premium bypass fallback | MEDIUM | BV7 |
| B-03 | Chat→push direct call | LOW-MED | BV9 |
| B-04 | providers eager Stockfish init | MEDIUM | BV10 |
| B-05 | Bot turn logic in UI | HIGH | BV11 |
| B-06 | Timeout logic in UI | HIGH | BV12 |
| B-07 | Channels created outside M28 | MEDIUM | BV22 |
| B-08 | boardKey render-state coupling | LOW-MED | BV23 |
| B-09 | Game state → navigation | LOW | BV25 |

### 9.4 RLS / security (R)

| ID | Debt | Severity | Source |
|----|------|----------|--------|
| R-01 | "Allow all" RLS on `room_players` + `games` | HIGH | P1 §12, P2 |
| R-02 | `games`, `duel_games`, `message_type` missing from `Database` type | MEDIUM | P2 |
| R-03 | Per-isolate rate limiting (bypassable at scale) | MEDIUM | P2 |
| R-04 | `/api/log-crash` no client rate limit | LOW | P4 E47 |
| R-05 | Hand-maintained type drift vs `tables.sql` | MEDIUM | M27 |

### 9.5 Test gaps (T)

| ID | Debt | Severity | Source |
|----|------|----------|--------|
| T-01 | Game.tsx — zero tests | CRITICAL | this phase |
| T-02 | DuelGame.tsx + duelGame.ts — zero tests | CRITICAL | this phase |
| T-03 | gameState.ts — entire suite skipped | HIGH | this phase |
| T-04 | ~1,950 lines skipped (22 describe.skip) | HIGH | this phase |
| T-05 | OnlineGame reconnect untested | HIGH | this phase |
| T-06 | Broadcast-ordering scenarios untested | HIGH | this phase |
| T-07 | Push notification — 1 test only | MEDIUM | this phase |
| T-08 | Middleware auth redirect untested | MEDIUM | this phase |
| T-09 | Deep-link pages untested | MEDIUM | this phase |

### 9.6 Documentation drift (DOC)

| ID | Debt | Severity | Detail |
|----|------|----------|--------|
| DOC-01 | `src/features/bots/CONTEXT.md` says MultiPV=2; code/change-log say MultiPV=6 | LOW | stale section |
| DOC-02 | `CONTEXT-SYSTEM.md` uses SvelteKit conventions (`+page.svelte`) | LOW | borrowed template |
| DOC-03 | ARCHITECTURE.md references legacy `src/proxy.ts`; actual is `src/middleware.ts` | LOW | P2 noted |
| DOC-04 | Settings "Supabase sync" documented but not implemented | LOW | P3 S8 |
| DOC-05 | `profile/CONTEXT.md` has HTML entity `&amp;` | LOW | cosmetic |
| DOC-06 | `server/` CONTEXT.md documents a possibly orphaned deployment | MEDIUM | deprecated |

### 9.7 Debt totals

| Category | Count | Critical | High |
|----------|-------|----------|------|
| Structural | 15 | 2 | 8 |
| Duplication | 17 | 1 | 4 |
| Layering | 9 | 0 | 4 |
| RLS/Security | 5 | 0 | 1 |
| Test gaps | 9 | 2 | 5 |
| Documentation | 6 | 0 | 0 |
| **Total** | **61** | **5** | **22** |

---

## 10. RECOMMENDATIONS

Ordered by (payoff ÷ risk). These map to `06_REFACTORING_ROADMAP.md` phases.

| # | Recommendation | Debt resolved | Effort | Payoff | Phase |
|---|----------------|---------------|--------|--------|-------|
| 1 | **Unify `resolveLegacy` into `resolvePendingMoves`** (delete the legacy path + its 2 call sites) | S-04, D1 | Small-Med | CRITICAL (~170 lines + 4-impl gap) | C |
| 2 | **Extract `buildMoveComparison()` factory** shared by M14/M15 | D-02, D3 | Small | HIGH (25×3) | C |
| 3 | **Extract checkmate short-circuit helper** | D-01, D2 | Small | HIGH (55×3) | C |
| 4 | **Move `features/auth/` components to `components/` + hooks** | S-10, BV1/BV2 | Small | HIGH (layer integrity) | A |
| 5 | **Split `lib/settings.ts`** — pure utils stay, `useSettings` hook to `hooks/` | S-11, BV3 | Small | HIGH | A |
| 6 | **Move shared types** (`GameStatus`, `MoveComparison`, `PromotionPiece`) to `features/shared/` | S-09, S-13, S-04 | Small | MEDIUM (inversion removed) | A |
| 7 | **Create `useAudioInit()` + `useGameSounds()` hooks** | D-05, D7 | Small | MEDIUM (18+30×2) | B |
| 8 | **Create `useGameOverSave()` hook** | D-06, D8 | Small-Med | MEDIUM (66×2) | B |
| 9 | **Single `TimerService`** with authoritative clock + delta sync | S-06, D-03, V1 | Large | CRITICAL (timer race + drift) | D |
| 10 | **Extract `ResolutionService`** pure `(a, b, fen) → MoveComparison` for all engines | S-05, V3 | Large | CRITICAL (4→1 impls) | C |
| 11 | **Extract `TurnManager`** — engine-level turn advancement + bot continuation | B-05, V9 | Medium | HIGH | C |
| 12 | **Shared `GameShell`** for M17+M18 | S-08, S-07 | Large | HIGH (Duel island + dedup) | E |
| 13 | **Event versioning / sequence numbers** on broadcasts | R1 | Medium | CRITICAL (multiplayer correctness) | F |
| 14 | **Engine-level lock timeout** for `waitForTeammateLock` | R3 | Small | HIGH | F |
| 15 | **Versioned reconnect sync** (`syncGameState` merge) | R2 | Medium | HIGH | F |
| 16 | **Regenerate `Database` type + tighten RLS** | R-01, R-02 | Medium | HIGH | G |
| 17 | **Backfill tests**: Game.tsx critical paths → DuelGame → skipped suites with mocked engines | T-01..T-09 | Large | CRITICAL (regression shield) | H |
| 18 | **Structured event log + crash analytics** | R-04, DOC-06 | Small-Med | MEDIUM | I |
| 19 | **Consolidate room creation to one path + named expiry constants** | D-07, V8 | Medium | MEDIUM | A |
| 20 | **ProfileService adoption** — route all 12+ `profiles` call sites through it | B-01, D-08 | Medium | MEDIUM | A |

### 10.1 Quick wins (do first)

1. Delete `resolveLegacy` (D1) — pure removal, highest line-savings per risk.
2. Fix `features/auth/` placement (BV1/BV2) — no behavior change, mechanical move.
3. Split `lib/settings.ts` (BV3) — mechanical.
4. Move shared types to `features/shared/` (BV5/S4) — mechanical with import updates.
5. Extract `useAudioInit()` + `useGameSounds()` (D5/D7) — mechanical dedup.

### 10.2 Forbidden / deferred

- Do NOT rewrite Game.tsx wholesale — decompose via extraction (Strangler Fig).
- Do NOT change game resolution semantics during refactors.
- Do NOT tighten `room_players`/`games` RLS without staging anonymous Quick Play tests (documented P0 caveat).
- Do NOT remove the Render server without confirming zero traffic.
- Do NOT attempt iOS (Capacitor 6.6) within these phases.

---

## 11. APPENDIX

### 11.1 Verified file inventory (test coverage)

| File | Lines | Tests? |
|------|-------|--------|
| `Game.tsx` | 2,477 | ❌ none |
| `DuelGame.tsx` | 634 | ❌ none |
| `duelGame.ts` | 475 | ❌ none |
| `onlineGame.ts` | 1,679 | ✅ 31 tests (no reconnect) |
| `localGame.ts` | ~760 | ⚠ 6 active + ~260 skipped |
| `gameState.ts` | 353 | ⚠ entire suite skipped |
| `accuracyAndMoveTrail.test.ts` | 807 | ⚠ 100% skipped |
| `botIntegration.test.ts` | 387 | ⚠ skipped |
| `gameOver.test.ts` | 57 | ⚠ skipped |
| `moveValidation.test.ts` | ~70 | ⚠ 2 blocks skipped |
| `PushNotificationService` | — | ⚠ 1 test |
| middleware.ts | 44 | ❌ none |

### 11.2 Module inventory (35 modules, from P2)

M01 Auth · M02 Profile · M03 Settings · M04 Routing · M05 Mobile Nav · M06 Capacitor · M07 Deep Link · M08 Room · M09 Matchmaking · M10 4-Player · M11 Lobby UI · M12 GameState · M13 Shared · M14 LocalGame · M15 OnlineGame · M16 Duel · M17 Game Shell · M18 Duel Shell · M19 ChessBoard · M20 Resolution · M21 Turn · M22 Timer · M23 Stockfish · M24 Bot · M25 Playback · M26 Persistence · M27 Supabase · M28 Realtime · M29 API Infra · M30 Billing · M31 Insights · M32 Push · M33 Friends · M34 Chat · M35 History

### 11.3 Cross-reference

- P1: `01_REPOSITORY_DISCOVERY.md` — §8 dependencies, §14 realtime, §15 risks.
- P2: `02_MODULE_ARCHITECTURE.md` — §3 module specs, §4 state map, §7 dependency analysis.
- P3: `03_STATE_OWNERSHIP.md` — §7 violations V1–V10, §9 refactor priorities.
- P4: `04_EVENT_FLOW.md` — §7 races R1–R18, §8 ordering rules.
- Module IDs (M01–M35) follow Phase 2 definitions.

---

### Phase 5 Part 1 Complete

This document is **documentation only**. No implementation was modified.

**Every future refactoring phase should be validated against this review before starting, and its debt register entries checked off as resolved.**

**See `06_REFACTORING_ROADMAP.md` for the execution plan.**
