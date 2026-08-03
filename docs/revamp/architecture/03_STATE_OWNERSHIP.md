# CHESSDUO — PHASE 3: STATE OWNERSHIP & SINGLE SOURCE OF TRUTH

> **Foundation document.** Defines every important piece of application state, its single source of truth (SSOT), lifecycle, and synchronization path.
> This document is **documentation only** — no implementation changes were made.
> Pairs with: `docs/revamp/01_REPOSITORY_DISCOVERY.md` (Phase 1) and `docs/revamp/architecture/02_MODULE_ARCHITECTURE.md` (Phase 2).

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Complete State Inventory](#2-complete-state-inventory)
3. [State Ownership Matrix](#3-state-ownership-matrix)
4. [State Lifecycle Diagrams](#4-state-lifecycle-diagrams)
5. [Synchronization Paths](#5-synchronization-paths)
6. [Single Source of Truth Matrix](#6-single-source-of-truth-matrix)
7. [State Violations](#7-state-violations)
8. [High Risk States](#8-high-risk-states)
9. [Future Refactoring Priorities](#9-future-refactoring-priorities)
10. [Appendix](#10-appendix)

---

## 1. EXECUTIVE SUMMARY

ChessDuo manages **~300 distinct state items** across 9 React components (84 `useState` + 37 `useRef`), 6 class instances (engines, evaluator, managers), 13 localStorage keys, 10 Supabase tables, 4 React Contexts, browser history, and 1 edge worker.

**Overall SSOT health: 40 / 100.**

### Key findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | **Match timer has 4 owners** (M12 storage, M15 sync, M17 tick, M22 UI; plus a 3rd independent model in M16 Duel) | HIGH |
| 2 | **Board position/FEN is dual-sourced** (M12 engine FEN vs M17 aggregated `gameState.fen`) | HIGH |
| 3 | **Move resolution has no single owner** (M14, M15, M16, M17 all implement it differently) | HIGH |
| 4 | **Premium status has a bypass read path** (M31 reads `profiles.is_premium` directly instead of M30) | MEDIUM |
| 5 | **`profiles` row is written by two modules** (M02 identity + M30 subscription) | MEDIUM |
| 6 | **Game status enums diverge** (M14/M15 `GameStatus` vs M16 string literals) | MEDIUM |
| 7 | **Match history is dual-storage** (M35 localStorage primary + `completed_games` best-effort, no reconciliation) | MEDIUM |
| 8 | **Room expiry constant is duplicated** (M13 24h vs M09 60s, same name) | MEDIUM |
| 9 | **Turn advancement is UI-driven** (M17 owns bot continuation via refs, not the engine) | MEDIUM |
| 10 | **Duel game is an architectural island** (M16 in `lib/`, divergent realtime + timer model, no shared contract) | MEDIUM |

### What is healthy
- **Auth session** (M01) — single source via Supabase Auth, one event stream.
- **Settings** (M03) — single localStorage key, single hook.
- **Realtime channel registry** (M28) — centralized lifecycle tracking.
- **Evaluation cache** (M23/M13) — one LRU singleton, well-scoped.
- **Friend/message/challenge tables** — each owned by exactly one module (M33/M34/M07).

---

## 2. COMPLETE STATE INVENTORY

Every important state item, grouped by concern. Format: **Name** — *type* — storage — init — readers → writers.

Legend: storage = where the value lives at rest; **LS** = localStorage, **M** = in-memory/module, **C** = class instance field, **R** = React state/ref, **DB** = Supabase table, **HW** = browser/native hardware state.

---

### 2.1 Identity & Authentication (M01)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Auth session | `Session \| null` | Supabase Auth (cookie web / Bearer Capacitor) | On mount via `getSession()` | all modules → M01 (Supabase) |
| Auth event stream | `SIGNED_IN/SIGNED_OUT/INITIAL_SESSION/TOKEN_REFRESHED` | M (authService callback registry) | provider mount | M30, M32, M02, M17 → M01 |
| Access token cache (push) | `string` | M (`cachedAccessToken`) | `''` | M32 → M01 (`setCachedAccessToken`) |
| Middleware guard decision | route matcher + session | edge (middleware.ts) | per request | M04 routes → M01 |

### 2.2 User Profile & Premium (M02 / M30)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Profile row | `Profile` | DB `profiles` | `handle_new_user()` trigger | M02, M17, M18, M33 → M02 (identity), M30 (subscription) |
| Username | `string` | DB `profiles.username` | OAuth metadata / user edit | M02, M33, M17 → M02 |
| Avatar URL | `string \| null` | DB `profiles.avatar_url` | OAuth / Google default | M02, M17, M18 → M02 |
| Premium status | `boolean` | DB `profiles.is_premium` + M30 cache (30s) | `/api/subscription/status` fetch | M02, M31, premium page → M30 |
| Subscription detail | `SubscriptionInfo` | DB `profiles.subscription_*` | Creem webhook / verify | M02, premium page → M30 |
| Premium context | `isPremium`, `loading` | R (PremiumContext) | `checkPremium()` on mount | all consumers → PremiumProvider |
| Insights quota | `{ revealsUsed: number }` | LS `chessduo_insights_{userId}` | `{ revealsUsed: 0 }` | M31 → M31 (increment) |

### 2.3 Settings & Preferences (M03)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Settings object | `{autoQueen, lowTimeWarning, confirmMove, soundEnabled, theme}` | LS `chessduo_settings` + R | `DEFAULTS` | M17, M18, settings page, layout → M03 setters |
| Theme class | `.dark` on `<html>` | HW (DOM) | from settings | all components → M03 `setTheme` |
| Selected time | `number` (seconds) | LS `chessduo_selected_time` | `DEFAULT_TEAM_TIMER_SECONDS` | home page → home page |
| Selected level | `number` (1–5) | LS `chessduo_selected_level` | `3` | home page → home page |
| Selected color | `'white'\|'black'\|'random'` | LS `SELECTED_COLOR_KEY` (`chessduo_selected_color`) | `DEFAULT_PLAYER_COLOR` | home page, LocalGame → home page |

### 2.4 Room & Lobby (M08 / M09 / M10 / M11)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Room row | `Room` | DB `rooms` | `createOnlineRoom` etc. | M07, M09, M15, M16, lobby → M08 |
| Room code | `string` (6 chars) | DB `rooms.code` | `generateRoomCode()` | share UI, join flow → M08 |
| Room players | `RoomPlayer[]` | DB `room_players` | join/insert | M07, M09, M10, M15 → M08 |
| Room presence (who's online) | presence map | Supabase Presence (`room:{roomId}`) | subscribe | M15/M16 → M15/M16 |
| Team/slot assignment | `team`, `slot` | DB `room_players` | host_team derivation | M10, M15, M17 → M08 |
| Ready status | `status` on player | DB `room_players.status` | join/ready | M10 → M10 |
| Lobby countdown | `remaining: number` | R (GameLobby) | `lobbyTimeoutSeconds` (60) | M11 UI → M11 |
| Lobby `copied`/`timedOut` | `boolean` | R (GameLobby) | `false` | M11 UI → M11 UI |
| Matchmaking queue selection | `{room, team, slot}` | M (transient) | find/create | home page → M09 |

### 2.5 Game Engine Core — GameState (M12)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Chess position | `Chess` instance | C (GameState) | `new Chess()` | M14/M15/M16/M19 → M12 (`chess.move`/`load`) |
| FEN | `string` | derived from `chess` | starting position | M17, M26, board → M12 |
| Game phase | `GamePhase` (WAITING/SELECTING/LOCKED/RESOLVED/GAME_OVER) | C (GameState) | `WAITING` | M14/M15/M17 → M12 |
| Current team | `Team` (WHITE/BLACK) | C (GameState) | `WHITE` | M14/M15/M17 → M12 |
| White players | `Player[]` (max 2) | C (GameState) | `[]` | M14/M15 → M12 (`addPlayer`) |
| Black players | `Player[]` (max 2) | C (GameState) | `[]` | M14/M15 → M12 |
| Selections | `Map<Player, string>` (SAN) | C (GameState) | `new Map()` | M14/M15/M17 → M12 |
| Locked set | `Set<Player>` | C (GameState) | `new Set()` | M14/M15 → M12 |
| Pending moves | `Map<Player, PendingMoveInfo>` | C (GameState) | `new Map()` | M14/M15/M17 (overlay) → M12 |
| Turn start FEN | `string` | C (GameState) | `''` | M14/M15 (eval) → M12 |
| Captured pieces | `string[][]` (by team) | C (GameState) | `[]` | M17, BoardTopBar → M12 (`trackCapturedPiece`) |
| Match time remaining | `number` | C (GameState) | `timeLimitSeconds` | M17, M15 → M12 (setter) / M15 (decrement) |
| Match timer active | `boolean` | C (GameState) | `false` | M17, M15 → M12 |

### 2.6 Online Game — OnlineGame (M15)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Status | `GameStatus` | C (OnlineGame) | `WAITING` | M17 → M15 |
| Room ref | `Room \| null` | C (OnlineGame) | `null` | M15 → M15 (joinRoom) |
| Player ID / team | `string` / `'WHITE'\|'BLACK'` | C (OnlineGame) | from join | M15 → M15 |
| Player 1 ID (accuracy anchor) | `string` | C (OnlineGame) | `''` | M15 → M15 |
| Saved move history (reconnect) | `{team, move}[]` | C (OnlineGame) | `[]` | M17 (playback) → M26 via syncGameState |
| Players map | `Map<string, RoomPlayer>` | C (OnlineGame) | `new Map()` | M17 display → M15 |
| Channel | `RealtimeChannel \| null` | C (OnlineGame) | `null` | M15 → M15 |
| Turn sub-state | `'selecting'\|'waiting_for_teammate'\|'locked'\|'resolving'` | C (OnlineGame) | `'selecting'` | M17 → M15 |
| `resolveTeammateLocked` / `resolveTurnChange` | promise resolvers | C (OnlineGame) | `null` | M15 waitFor* → M15 |
| Stats | `GameStats` (7 fields) | C (OnlineGame) | all 0 | M17, M31, M35 → M15 (resolve) |
| Last-move comparisons | `MoveComparison \| null` (x3 refs) | C (OnlineGame) | `null` | M17 → M15 |
| Broadcast throttle map | `Map<string, number>` | C (OnlineGame) | `new Map()` | M15 → M15 |
| Polling / timer-sync / countdown / disconnect intervals | `setInterval` handles | C (OnlineGame) | `null` | M15 → M15 |
| Disconnect age | `_disconnectedSince: number\|null` | C (OnlineGame) | `null` | M17 (BoardTopBar) → M15 |
| Game-over result / reason cache | `string` | C (OnlineGame) | `''` | M17 → M15 |
| `starting` guard, `initialized` | `boolean` | C (OnlineGame) | `false` | M15 → M15 |

### 2.7 Offline Game — LocalGame (M14)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Status | `GameStatus` | C (LocalGame) | `WAITING` | M17 → M14 |
| Stats | `GameStats` (10 fields incl. white/black splits) | C (LocalGame) | all 0, accuracies 100 | M17, M31 → M14 (`updateStats`) |
| Player color (resolved) | `ResolvedColor` | C (LocalGame) | `resolvePlayerColor()` | M17 → M14 (constructor, frozen) |
| Last move / last comparison | `{from,to}` / `MoveComparison` | C (LocalGame) | `null` | M17 → M14 |
| Game-over result / reason cache | `string` | C (LocalGame) | `''` | M17 → M14 |
| `initialized` guard | `boolean` | C (LocalGame) | `false` | M14 → M14 |

### 2.8 Duel Game — DuelGame (M16, island)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Chess position | `Chess` instance | C (DuelGame) | `new Chess()` | M18 → M16 |
| Status | `'waiting'\|'playing'\|'game_over'` (string!) | C (DuelGame) | `'waiting'` | M18 → M16 |
| White/black player presence | `DuelPlayerState \| null` | C (DuelGame) | `null` | M18 → M16 (presence) |
| White/black time remaining | `number` (per-player) | C (DuelGame) | `timeLimit` | M18 → M16 (1s decrement) |
| Match timer active | `boolean` | C (DuelGame) | `false` | M18 → M16 |
| Last move / move history | `{from,to}` / `string[]` | C (DuelGame) | `null` / `[]` | M18 → M16 |
| Winner / result / reason | `'white'\|'black'\|'draw'\|null` / strings | C (DuelGame) | `null` | M18 → M16 |
| Move / opponent accuracy | `number \| null` | C (DuelGame) | `null` | M18 → M16 (makeMove) |
| Polling interval / iterations | `setInterval` / `number` | C (DuelGame) | `null` / `0` | M16 → M16 |
| Disconnect age | `_disconnectedAt: number\|null` | C (DuelGame) | `null` | M18 → M16 |

### 2.9 Component UI State — 2v2 Game Shell (M17, `Game.tsx`)

| State | Type | Storage | Init | Purpose |
|-------|------|---------|------|---------|
| `game` / `onlineGame` | engine refs | R | per mode | engine instance |
| `botEloLevel` | `number` | R | `level \|\| 4` | lobby-selected bot difficulty |
| `gameState` (aggregate) | 22-field object | R | literal | derived engine snapshot |
| `accuracyComparison` | `MoveComparison \| null` | R | `null` | current round comparison |
| `accuracyHistory` | `MoveComparison[]` | R | `[]` | accumulated for insights |
| `showGameOn` | `boolean` | R | `false` | overlay |
| `showSettings` / `showResignConfirm` / `showLeaveModal` / `showGameOverDismissed` | `boolean` | R | `false` | modal toggles |
| `isMobile` | `boolean` | R | from `useIsMobile` | responsive |
| `matchTimerStarted` | `boolean` | R | `false` | timer gate |
| `playbackIndex` / `playbackFen` | `number\|null` / `string\|null` | R | `null` | move playback |
| `disconnectedAge` | `number` | R | `0` | disconnect banner |
| `overlayMode` | `'none'\|'profile'\|'history'` | R | `'none'` | slide-over |
| `sessionPlayerId` | `string\|null` | R | `null` | auth id |
| `activeBoardTab` | `BoardTab` | R | `'game'` | bottom nav |
| `showRoundHistory` / `showInsights` / `showChat` | `boolean` | R | `false` | panels |
| `insightsState` | `{isPremium, revealsRemaining}` | R | defaults | insights gate |
| `revealedIndices` | `Set<number>` | R | `new Set()` | insights reveal |
| `heldMove` | `{move, promotion?}\|null` | R | `null` | confirm-move flow |
| `boardKey` | `number` | R | `0` | board remount |
| `userProfile` / `teamLabels` | objects | R | defaults | team display |
| Refs: `myTeamRef`, `prevTurnRef`, `gameSavedRef`, `moveHistoryRef`, `teammateLabelShownRef`, `lastTeammateLabelMoveKeyRef`, `prevFenRef`, `prevCapturedWhite/BlackRef`, `prevStatusRef`, `prevGameFenRef`, `onlineGameRef`, `abandonNotifiedRef`, `matchTimerRef`, `matchTimeoutFlagRef`, `gameRef`, `opponentInProgressRef`, `pendingOpponentTurnRef`, `initialBotTurnTriggeredRef`, `teamRef`, `teamNamesFetchedRef`, `playerIdRef`, `updateStateRef` | refs | R | per-ref | stale-closure avoidance + bot orchestration guards |

### 2.10 Component UI State — Duel Shell (M18, `DuelGame.tsx`)

| State | Type | Storage | Init | Purpose |
|-------|------|---------|------|---------|
| `fen` / `status` / `currentTurn` | strings | R | start FEN / `'waiting'` / `'w'` | board + lifecycle |
| `whiteTime` / `blackTime` / `timerActive` | `number` / `number` / `boolean` | R | `timeLimit` / `false` | timer display |
| `lastMove` / `winner` / `gameResult` / `gameOverReason` | mixed | R | `null` | game-over state |
| `moveHistory` | `string[]` | R | `[]` | playback |
| `playbackIndex` / `playbackFen` | `number\|null` / `string\|null` | R | `null` | playback |
| `moveAccuracy` / `opponentAccuracy` | `number\|null` | R | `null` | accuracy display |
| `pendingPromotion` / `heldMove` | `{from,to}` / `{move,promotion?}` | R | `null` | promotion + confirm-move |
| `boardKey` | `number` | R | `0` | board remount |
| `waiting` | `boolean` | R | `true` | waiting screen |
| `opponentUsername` / `opponentAvatar` / `userProfile` | strings/objects | R | defaults | team display |
| `disconnectedAge` | `number` | R | `0` | disconnect |
| `activeBoardTab` | `BoardTab` | R | `'game'` | bottom nav |
| Refs: `gameRef`, `accuracyTimeoutRef`, `moveEntriesRef`, `moveAccuracyRef`, `opponentAccuracyRef`, `prevFenRef`, `prevStatusRef`, `gameSavedRef` | refs | R | per-ref | engine + save + sounds |

### 2.11 Board & Overlay (M19, `ChessBoard.tsx`)

| State | Type | Storage | Init | Purpose |
|-------|------|---------|------|---------|
| `showRetraction` | `boolean` | R | `false` | retraction animation |
| `retractionData` | `{from,to,piece,color}\|null` | R | `null` | animation payload |
| `teammateLabelVisible` | `boolean` | R | `false` | teammate label |
| `overlayWidth` | `number` | R | `0` | overlay coordinate math |
| `boardRef` / `containerRef` / `onMoveRef` / `fenRef` / `lastMoveRef` | refs | R | per-ref | cm-chessboard handle + stable callbacks |

### 2.12 Persistence & History (M26 / M35)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| In-progress game state | `GameSaveData` | DB `games` | first resolve | M15 (reconnect) → M26 (`saveGameState`) |
| Completed game list | `CompletedGame[]` (max 50) | LS `chessduo_history_{userId}` | `[]` (migrated from legacy key) | M35, profile stats → M35 |
| Completed game (DB backup) | row | DB `completed_games` | game-over | M35 → M35 (best-effort) |
| Player stats (derived) | wins/draws/accuracies | computed from history | per query | M02, history page → M35 |
| Replay data | FEN + move history | DB `games` / LS history | load | `/replay` → M26/M35 |

### 2.13 Notifications & Push (M32)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Push tokens | `PushTokenRow[]` | DB `push_tokens` | register | M32 → M32 |
| `fcmRegistered` | `boolean` | M (module let) | `false` | M32 → M32 |
| `pushInitInProgress` | `boolean` | M (module let) | `false` | M32 → M32 |
| Access token cache | `string` | M (module let) | `''` | M32 → M01/M32 |
| FCM token | `string` | LS `chessduo_fcm_token` | absent | M32 → M32 |
| Push in-progress guard | timestamp | LS `chessduo_push_in_progress` | absent | M32 → M32 |
| Push opt-out | `'true'` or absent | LS `chessduo_push_disabled` | absent | M32, SettingsPanel → SettingsPanel |
| Last push error | `string` | LS `chessduo_push_last_error` | absent | M32 → M32 (rate-limited) |
| Cached VAPID key | `string` | LS `chessduo_vapid_public_key` | absent | M32 → M32 |
| Notification redirect | `NotificationRedirect` JSON | LS `chessduo_notification_redirect` | absent | `useNotificationRedirect` → SW/localStorage |
| SW registration | `ServiceWorkerRegistration` | HW | provider mount | M32 → providers |

### 2.14 Realtime & Cache Infrastructure (M27 / M28 / M23 / M31)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Supabase client | `SupabaseClient` singleton | M (module let) | lazy `createBrowserClient` | every module → M27 |
| Channel registry | `Set<RealtimeChannel>` | M (SubscriptionManager) | `new Set()` | M15/M16/M34 → M28 |
| Evaluation cache | `Map<FEN, Map<move, score>>` + LRU order | M (singleton) | `new Map()`, `[]` | M23 → M23 |
| Shared evaluator | `BrowserMoveEvaluator \| null` | M (evaluatorFactory let) | lazy | M14/M15/M16/M24 → factory |
| Worker ready / init error | `boolean` / `string\|null` | C (BrowserMoveEvaluator) | `false` / `null` | M23 → M23 |
| Badge count | `{unreadMessages, pendingRequests, total, unreadBySender}` | R (useBadgeCount) | all 0 | home nav → hook (Realtime) |
| Network status | `online: boolean` | R (useNetworkStatus) | `navigator.onLine` | NetworkOverlay → hook |
| Toast queue | messages | R (Toast context) | `[]` | any module → `useGameToast()` |
| Rate-limit buckets | per-endpoint counters | M (edge worker, in-memory) | per request | /api routes → M29 |

### 2.15 Navigation & Deep Linking (M04 / M05 / M06 / M07)

| State | Type | Storage | Init | Readers → Writers |
|-------|------|---------|------|-------------------|
| Current route | pathname | HW (Next router) | from URL | all components → router |
| `gameMode` / `showAuthOverlay` history entries | `window.history` states | HW | `pushState` | home page → home page |
| Navigation guard flag | `blockedRef` | R (useNavigationGuard) | `false` | M17/M18 → hook |
| Capacitor back-handler stack | `BackHandler[]` | M (module array) | `[]` | M17/M18/providers → hook |
| Scroll-lock count | `number` | M (module let) | `0` | modals → hook |
| Challenge links | `ChallengeLink[]` | DB `challenge_links` | `createChallenge` | M07 → M07 |
| Redirect-after-auth URL | `string\|null` | R (home page ref) | from `?redirect=` | home page → home page |

---

## 3. STATE OWNERSHIP MATRIX

> **Owner** = the module that must be the single decision-maker/writer. **SSOT** = current verdict: ✅ single, ⚠ split (multiple writers/readers), ❌ none.

### 3.1 Identity & Account

| State | Owner | Readers | Writers | Persistence | Realtime Source | SSOT | Problems |
|-------|-------|---------|---------|-------------|-----------------|------|----------|
| Auth session | M01 | all | M01 (Supabase) | Supabase Auth | auth events | ✅ | 3-way Google path |
| Access token (push) | M01 | M32 | M01 | M (cache) | TOKEN_REFRESHED | ✅ | cache vs cookie duplication |
| Profile row | M02 + M30 | M02/M17/M18/M33 | M02 (identity), M30 (sub) | `profiles` | none | ⚠ | two writers, one row |
| Username/avatar | M02 | all | M02 | `profiles` | none | ✅ | direct reads in components |
| Premium status | M30 | M02/M31/premium | M30 | `profiles.is_premium` + cache | webhook/verify | ⚠ | M31 direct read; 30s staleness |
| Settings | M03 | M17/M18/layout | M03 | LS `chessduo_settings` | none | ✅ | no server sync (doc mismatch) |
| Push opt-out | M32 | M32/SettingsPanel | M32 | LS `chessduo_push_disabled` | none | ✅ | — |
| Insights quota | M31 | M31 | M31 | LS `chessduo_insights_{uid}` | none | ⚠ | `profiles.insights_reveals_used` unused |

### 3.2 Room & Game

| State | Owner | Readers | Writers | Persistence | Realtime Source | SSOT | Problems |
|-------|-------|---------|---------|-------------|-----------------|------|----------|
| Room row | M08 | M07/M09/M15/M16 | M08 | `rooms` | presence (M15) | ✅ | 3 creation paths; 2 expiry constants |
| Room players | M08 | M07/M09/M10/M15 | M08 | `room_players` | presence (M15) | ✅ | Allow-all RLS |
| Lobby/seat state | M10 | M10 UI | M10 | `room_players` | presence | ✅ | handoff to M15 implicit |
| Game status | M14/M15/M16 | M17/M18 | engines | `games.status` | broadcast | ⚠ | per-engine enums diverge |
| Current turn | M12 | M14/M15/M17 | M12 via engines | `games.current_turn` | `turn_resolved` | ✅ | reconnect sync |
| Board position | M12 | M14/M15/M17/M19 | M12 via engines | `games.fen` | `turn_resolved` | ⚠ | M17 aggregates separate `fen` |
| Submitted moves | M12 | M14/M15/M17 | M12 via engines | none (transient) | `player_move` | ✅ | — |
| Locked moves | M12 | M14/M15/M17 | M12 via engines | none | `player_locked` | ✅ | broadcast-order risk |
| Resolved move | M20 (none) | M17/M25/M31 | M14/M15/M16/M17 | `games.move_history` | `turn_resolved` | ❌ | 4 implementations |
| Move comparison | M20 (none) | M17/M25/M31 | M14/M15/M16 | `completed_games.move_comparisons` | `turn_resolved` payload | ❌ | built per-engine |
| Match timer | M22 (none) | M17/BoardTopBar/MatchTimer | M15 sync / M17 tick / M12 storage | `games.match_*` (partial) | `timer_sync` | ❌ | 4 owners; drift ≤15s |
| Duel per-player clocks | M16 | M18 | M16 | `duel_games.timers` | presence | ✅ (but 3rd model) | duplicates M22 |
| Team/color | M08 (room) / M12 (engine) | M17/BoardTopBar | M08, M14 | `rooms.host_team`, engine | presence | ✅ | — |
| Stats | M14/M15 | M17/M31/M35 | M14/M15 | `completed_games` | none | ⚠ | per-engine stats shapes differ |

### 3.3 Social, Delivery & Infra

| State | Owner | Readers | Writers | Persistence | Realtime Source | SSOT | Problems |
|-------|-------|---------|---------|-------------|-----------------|------|----------|
| Friendships | M33 | M33/M34 | M33 | `friendships` | badge Realtime | ✅ | badge table-name mismatch |
| Messages | M34 | M34/M33 | M34 | `messages` | `messages:{userId}` | ✅ | untyped `message_type` |
| Unread counts | M34/M33 | M34/M33 | M34/M33 | none (derived) | Realtime | ⚠ | two hooks/readers |
| Push tokens | M32 | M32 | M32 | `push_tokens` | none | ✅ | registry growth |
| Match history | M35 | M35/M02 | M35 | LS + `completed_games` | none | ⚠ | dual storage, no reconciliation |
| Challenge links | M07 | M07/M15/M16 | M07 | `challenge_links` | none | ✅ | — |
| Game persistence | M26 | M15/M35 | M26 | `games` | none | ✅ | Allow-all RLS, untyped |
| Realtime channel registry | M28 | M15/M16/M34 | M28 | M | none | ✅ | bypassed by M16/M34 |
| Evaluation cache | M23 | M14/M15/M16/M24 | M23 | M | none | ✅ | — |
| Badge count | M33 | nav components | M33 hook | derived from DB | Realtime | ⚠ | duplicated per-mount |
| Notification redirect | M32 | `useNotificationRedirect` | SW/M32 | LS | SW message | ✅ | 30s TTL fragility |

---

## 4. STATE LIFECYCLE DIAGRAMS

### 4.1 Room Lifecycle

```
                    ┌────────────────────────────────────────────────────────────┐
                    │  M08 (rooms + room_players)                                 │
                    │                                                            │
 Created ─────────► Joined ──────────► Presence Synced ──────────► Game Started   │
 (M08 create*)      (M08 join;        (M15 presence sync;           (M15          │
  3 paths:           host_team          >=2 present)                 startGame     │
  online/quick/      derivation)                                            │     │
  fourplayer)                                                            │     │
                    ┌────────────────────┘  Game Over (M14/M15)                  │
                    │                     status='finished'                       │
                    │                                                            │
                    ▼  expires_at reached (cleanup_stale_game_data RPC)           │
                 Destroyed ────────────────────────────────────────────────────────┘
```

**Issues**: 3 creation paths with different invariants (online auto-joins host; fourplayer does not); two expiry constants (24h manual vs 60s matchmaking); cleanup is scheduled, not event-driven.

### 4.2 Game Lifecycle (2v2 — M12/M14/M15)

```
GameState._phase          M15._status (online)        Trigger
────────────────        ────────────────────        ─────────────────────
WAITING ──────────────►  WAITING ──► READY ──► PLAYING   joinRoom / startGameWhenReady
SELECTING ───────────►  PLAYING                          startPendingTurn(fen)
   │
   ├── setPendingMove(player) → selections/pendingMoves
   ├── lockPendingMove(player) → locked; phase → LOCKED
   │     (online: broadcast player_move, player_locked;
   │      waitForTeammateLock promise resolves on handleTeammateLocked)
   ▼
LOCKED (both locked)
   │
   ├── coordinator (M15) / local (M14): evaluateMoves → MoveComparison
   ├── resolve(winningMove) → chess.move(); captured tracking
   ├── phase → SELECTING; turn toggles; broadcast turn_resolved (online)
   │
   ▼
RESOLVED ─────────────►  (repeat)
   │
   └── board game over? → status GAME_OVER
        → saveGameState (M26), matchHistory.saveCompletedGame (M35)
        → GameOverModal (M17)
```

**Issues**: online transitions are driven by broadcast events whose ordering is not guaranteed; a `turn_resolved` arriving before `player_locked` handling completes can desync non-coordinators (recent 2026-08-03 bug).

### 4.3 Match Timer Lifecycle (M22 — 4 owners)

```
GameState (M12)
  _matchTimeRemaining (seconds, init = timeLimit)
  _matchTimerActive    (boolean)
      ▲ stores            ▲ stores
      │                   │
  OnlineGame (M15)              Game.tsx (M17)
  startMatchTimer():            tickMatchTimer(): 1s setInterval
    1s local decrement            reads matchTimeRemaining,
    broadcast timer_sync (15s)    decrements via refs, timeout detect
    timeout → setGameOverTimeup   showTimeout detection
      │
      └──► non-coordinators (M17 UI) receive timer_sync,
            update matchTimeRemaining (drift up to 15s)

Duel (M16) — separate per-player clocks:
  _whiteTimeRemaining / _blackTimeRemaining (1s decrement in M16)
```

**Issues**: single logical timer, 4 implementers + 1 independent model; local countdown + 15s sync → client divergence; timeout detection coordinator-only while display ticks everywhere.

### 4.4 Auth Session Lifecycle (M01)

```
unauthenticated ──sign in──► SIGNED_IN
                                  │
  INITIAL_SESSION (restore) ◄─────┤
                                  │
  TOKEN_REFRESHED (periodic) ─────┤
                                  │
  sign out / expire ◄─────────────┘
        │
        ▼
  SIGNED_OUT ──► clear push cache, reset push state, clear localStorage keys
```

### 4.5 Premium Status Lifecycle (M30)

```
unpaid ── purchase ──► checkout (Creem) ── return bridge / verify-checkout ──► granted
     (checkout.session.completed / subscription.active/completed/paid/trialing)
            │
            ▼
   profiles.is_premium = true (SubscriptionService writes)
   M30 30s cache invalidated on webhook / explicit invalidate()
            │
   cancel / expire / past-due ──► webhook ──► profiles.is_premium = false
```

### 4.6 Chat Message Lifecycle (M34)

```
draft (M34 UI) ── sendMessage ──► INSERT messages ──► new_message broadcast
                                                          │
   read flag set (markMessagesAsRead) ◄── receiver UI ◄───┘
                                                          │
                                                    push notify (M32)
```

### 4.7 Push Token Lifecycle (M32)

```
register (Capacitor FCM / browser VAPID)
  → POST /api/push/register (auth token) → INSERT push_tokens
  → SW registration (web)
  → invalid delivery → DELETE token
  → account deletion (delete_my_account RPC) → cascade delete
```

### 4.8 Notification Redirect Lifecycle (M32/M06/M07)

```
push received (foreground listener / SW message)
  → storeNotificationRedirect(localStorage, 30s TTL, {type, senderId, roomId, code, ...})
  → user taps → consumeNotificationRedirect() → navigate (deep-link)
  → consumed flag or TTL expiry → clear
```

---

## 5. SYNCHRONIZATION PATHS

Every boundary where state flows between layers, with risk.

| # | Path | Mechanism | Producer → Consumer | Risk | Notes |
|---|------|-----------|---------------------|------|-------|
| 1 | **Engine → UI** | `setOnStateChange(cb)` | M14/M15/M16 → M17/M18 | HIGH | stale-closure risk; M17 uses 6 refs to compensate; no ordering guarantee |
| 2 | **UI → Engine** | `GameInterface` method calls | M17 → M14/M15 | LOW | interface-bound by design |
| 3 | **Peer → Peer (moves)** | Supabase Broadcast `player_move`/`player_locked` | coordinator/teammate → all | HIGH | ordering not guaranteed |
| 4 | **Peer → Peer (resolution)** | Broadcast `turn_resolved` | M15 coordinator → all | HIGH | can arrive before lock handlers finish; recent bug |
| 5 | **Coordinator → Non-coordinator (timer)** | Broadcast `timer_sync` (15s) | M15 → M17 | MEDIUM | drift vs 1s local tick |
| 6 | **DB → UI (reconnect)** | `games` table read in `syncGameState()` | M26 → M15 → M17 | MEDIUM | may overwrite in-flight moves |
| 7 | **DB → UI (profile)** | direct `supabase.from('profiles')` | M17/M18 → M02 data | HIGH | bypasses service layer; RLS-dependent |
| 8 | **DB → UI (premium)** | `/api/subscription/status` + PremiumContext | M30 → consumers | MEDIUM | 30s cache; M31 bypass |
| 9 | **DB → UI (badges)** | `postgres_changes` Realtime | M33/M34 → nav | MEDIUM | `friend_requests` table-name mismatch |
| 10 | **Webhook → DB** | Creem webhook → `/api/creem/webhook` | Creem → M30 → `profiles` | MEDIUM | empty-metadata fallback (Bug 40) |
| 11 | **localStorage → Hook** | `useSettings` read/write | M03 → components | LOW | multi-key, no schema, cleared on sign-out |
| 12 | **SW ↔ localStorage** | service worker messages + `storeNotificationRedirect` | M32 ↔ `useNotificationRedirect` | MEDIUM | 30s TTL, consumed-once race |
| 13 | **localStorage → history** | `saveCompletedGame` | M35 → local + DB | MEDIUM | dual-store, no reconciliation |
| 14 | **HTTP → edge** | `/api/*` fetch | M17/M30/M32 → Cloudflare | MEDIUM | base-URL bugs (Bug 36) |
| 15 | **Presence → start** | Supabase Presence sync | M15/M16 → game start | MEDIUM | join/leave races; alphabetical coordinator election |

### Cross-layer diagram

```
┌──────────────────────────────  React (M17/M18 + hooks)  ──────────────────────────────┐
│  useSettings   useBadgeCount   usePremium   useNavigationGuard   useNetworkStatus       │
│  ├─ Game.tsx: 28 useState + 22 refs   ─┐        ┌─ DuelGame.tsx: 28 useState + 8 refs   │
│  └─ gameState (aggregate)  ◄───────────┤  ──────┘ (own aggregate per engine)            │
│        ▲ callbacks                     │                                              │
│        │                               ▼                                              │
│  ┌─────┴──────────────── Engine layer ───────────────────────────────────────────┐     │
│  │  LocalGame (M14)     OnlineGame (M15)      DuelGame (M16)                      │     │
│  │    │ GameState (M12)   │ GameState (M12)     └─ chess.js (own)                 │     │
│  │    └── ChessBot (M24)  └─ coordinator ── Broadcast/Presence                     │     │
│  └────────────────────────────────────────────────────────────────────────────────┘     │
│         │                        │                        │                            │
│    BrowserMoveEvaluator      games table (M26)       duel_games table (M16)            │
│    (M23, shared singleton)   completed_games (M35)    messages:{userId} (M34)          │
│         │                        │                        │                            │
└─────────┼────────────────────────┼────────────────────────┼────────────────────────────┘
          ▼                        ▼                        ▼
   Stockfish WASM            Supabase (DB + Realtime)   Creem webhooks / FCM / WebPush
```

---

## 6. SINGLE SOURCE OF TRUTH MATRIX

| State | SSOT | Authoritative source | Duplicate sources | Verdict |
|-------|------|---------------------|-------------------|---------|
| Auth session | ✅ | Supabase Auth | cookie vs Bearer token | Single owner, dual transport |
| Profile row | ⚠ | `profiles` table | — | Two writers (M02/M30) on one row |
| Premium status | ⚠ | M30 service | `profiles.is_premium` direct read (M31) | Bypass path exists |
| Settings | ✅ | LS `chessduo_settings` | — | Doc claims server sync (absent) |
| Room row | ✅ | `rooms` | — | 3 creation paths |
| Room players | ✅ | `room_players` | — | Allow-all RLS |
| Board position (FEN) | ⚠ | M12 `gameState.chess` | M17 `gameState.fen` aggregate | UI copy can drift |
| Current turn | ✅ | M12 `_currentTeam` | `games.current_turn` (persisted) | Reconnect read |
| Submitted moves | ✅ | M12 `pendingMoves` | — | Transient only |
| Locked moves | ✅ | M12 `locked` | — | Broadcast-order dependent |
| **Resolved move** | ❌ | none | M14/M15/M16/M17 | 4 implementations |
| **Move comparison** | ❌ | none | M14/M15/M16 | 3 builders, 22-field shape |
| **Match timer** | ❌ | none | M12+M15+M17+M22 (+M16) | 4 owners + 1 island model |
| Duel clocks | ⚠ | M16 | — | Separate model, no shared contract |
| Game status | ⚠ | M14/M15 `GameStatus` | M16 string literals | Divergent enums |
| Stats | ⚠ | M14 `GameStats` | M15 stats (same shape) | Two owners |
| Game persistence | ✅ | M26 / `games` | — | Untyped + world-writable |
| Completed history | ⚠ | LS (primary) | `completed_games` (backup) | No reconciliation |
| Insights quota | ⚠ | LS | `profiles.insights_reveals_used` (unused) | Field dead |
| Push tokens | ✅ | `push_tokens` | — | — |
| Messages | ✅ | `messages` | — | untyped `message_type` |
| Friendships | ✅ | `friendships` | — | badge table-name mismatch |
| Unread counts | ⚠ | derived (M34/M33) | two hooks | duplicated computation |
| Challenge links | ✅ | `challenge_links` | — | — |
| Notification redirect | ✅ | LS | — | 30s TTL |
| Evaluation cache | ✅ | M23 singleton | — | — |
| Realtime channel registry | ✅ | M28 | channels created directly (M16/M34) | Bypassed |
| Premium context | ⚠ | M30 | — | Derived copy of profile |

**SSOT summary**: 14 ✅ single, 10 ⚠ split, 3 ❌ none (resolved move, move comparison, match timer).

---

## 7. STATE VIOLATIONS

### 7.1 Primary Violations (must fix before Phase 4 features)

#### V1 — Match timer: 4 owners + 1 island model (HIGH)
- **Owners**: M12 (stores `_matchTimeRemaining`/`_matchTimerActive`), M15 (start/stop + 15s broadcast), M17 (1s `tickMatchTimer`, timeout refs), M22 (UI presenters), M16 (independent per-player clocks).
- **Consequence**: clients diverge up to 15s; timeout detection coordinator-only; 3rd model in Duel.
- **Target SSOT**: single `TimerService` with authoritative value + tick event.

#### V2 — Board FEN dual source (HIGH)
- **Owners**: M12 (`gameState.fen`) is authoritative; M17 keeps an aggregated copy in its `gameState` object updated via callback.
- **Consequence**: during reconnect (`syncGameState`) or polling, the UI copy can momentarily diverge; M17 also tracks `prevFenRef`, `prevGameFenRef` for sound/playback.
- **Target SSOT**: render only from engine getters; remove UI-side FEN copy.

#### V3 — Move resolution: no owner (HIGH)
- **Owners**: M14 `resolvePendingMoves`/`resolveLegacy`, M15 `resolvePendingMoves` (coordinator), M16 `makeMove`, M17 `checkAndResolve`/`handleResolutionComplete`.
- **Consequence**: 4 divergent implementations; bug fixes applied in multiple places; Duel has a different model (no comparison/coordinator).
- **Target SSOT**: single pure `ResolutionService` `(moveA, moveB, fen) → MoveComparison`.

#### V4 — Premium bypass read path (MEDIUM)
- **Owners**: M30 `SubscriptionService` (authoritative) vs M31 `insights.ts` reading `profiles.is_premium` directly.
- **Consequence**: bypasses 30s cache + provider abstraction; stale or inconsistent premium.
- **Target SSOT**: all premium reads via `SubscriptionService.isPremium()`.

#### V5 — `profiles` row split writer (MEDIUM)
- **Owners**: M02 (username/avatar) + M30 (subscription fields).
- **Consequence**: two modules on one row; a future feature writing profile casually risks clobbering subscription fields (no partition enforcement).
- **Target SSOT**: M02 for identity columns, M30 for subscription columns, enforced by accessor.

#### V6 — Divergent status enums (MEDIUM)
- **Owners**: M14/M15 `GameStatus` (WAITING/READY/PLAYING/GAME_OVER) vs M16 `'waiting'|'playing'|'game_over'` strings vs `games.status` column values.
- **Consequence**: shared logic cannot be written against one type; serialization mismatches.
- **Target SSOT**: one `GameStatus` union in M13 shared by all engines + DB.

#### V7 — History dual storage (MEDIUM)
- **Owners**: M35 writes LS (primary) + `completed_games` (best-effort). Reads only from LS.
- **Consequence**: cross-device history missing; no reconciliation/merge; DB rows can diverge from local.
- **Target SSOT**: DB `completed_games` primary with local cache; add reconciliation.

#### V8 — Room expiry duplicate constant (MEDIUM)
- **Owners**: M13 `ROOM_EXPIRY_MS = 86400000` vs M09 local `ROOM_EXPIRY_MS = 60000` in `matchmaking.ts`.
- **Consequence**: same name, different value; matchmaking rooms expire in 60s, manual rooms 24h; ambiguous room lifecycle.
- **Target SSOT**: single constant (likely two named constants if both intents are real).

#### V9 — UI-driven turn advancement (MEDIUM)
- **Owners**: M15 phase machine + M17 refs (`opponentInProgressRef`, `pendingOpponentTurnRef`, `initialBotTurnTriggeredRef`) that drive bot continuation.
- **Consequence**: turn logic in the UI; untestable outside React; duplicated between Game.tsx and engine.
- **Target SSOT**: engine-level `TurnManager`; UI renders only.

#### V10 — Duel architecture island (MEDIUM)
- **Owners**: M16 engine in `lib/` (wrong layer), different presence-key scheme, 2s polling (vs exponential backoff), string statuses, separate per-player timer.
- **Consequence**: two realtime models, two timer models, two component shells; ~half of M17 orchestration duplicated in M18.
- **Target SSOT**: unify M16 into engine family (move to `features/`), shared `GameShell`.

### 7.2 Secondary Violations

| # | Violation | Location | Detail |
|---|-----------|----------|--------|
| S1 | Direct `profiles` reads in UI | M17/M18 | `useEffect` fetch bypasses M02 |
| S2 | Channels created directly | M16/M34 | bypass M28 factory |
| S3 | M16 engine in `lib/` | M16 | layer violation |
| S4 | `friend_requests` subscription | M33 `useBadgeCount` | table not in schema |
| S5 | Untyped DB columns | M27 | `games`, `duel_games`, `message_type` |
| S6 | "Allow all" RLS | `room_players`, `games` | world-readable/writable |
| S7 | Insights quota field unused | `profiles.insights_reveals_used` | server field dead |
| S8 | Settings doc mismatch | M03 | CONTEXT claims Supabase sync; none exists |
| S9 | `chessduo_history` cleared on sign-out | M35/home page | legacy key deleted; user-scoped key survives sign-out (inconsistent) |
| S10 | `pending_offline_game`/`pending_online_game` | home page LS | cross-route handoff; only consumed once, fragile |
| S11 | 3 nav components | M05 | `HomeBottomNav`/`BottomNav`/`BoardBottomNav` overlap |
| S12 | Duplicate board components | M19 | `ChessBoard` vs `MobileChessBoard` |
| S13 | Board validation duplicated | M19/M12 | chess.js legal-move dots vs engine validation |
| S14 | Timer interval handles in 3 places | M17/M15/M16 | multiple `setInterval` owners |
| S15 | Toast/network context copies | providers | `NetworkAwareToastProvider` wraps Toast |
| S16 | Badge count duplicated | M33 | `useBadgeCount` re-fetches per mount; no shared store |

### 7.3 Stale / Hidden / Derived State

| Item | Status |
|------|--------|
| `_forceCreate` in OnlineGame | appears unused (dead field) |
| `_broadcastThrottle` map | maintained but only consulted via `canBroadcast` (few call sites) |
| `DEFAULT_MOVE_TIMER_SECONDS = 10` | declared but effectively unused (move selection is event-based, not timed) |
| `profiles.insights_reveals_used` | written nowhere client-side |
| `games.match_*` timer columns | partially persisted; timer SSOT is not the DB |
| Render Stockfish server | orphaned deployment; `SERVER_URL` removed from engines |

---

## 8. HIGH RISK STATES

Ranked by blast radius × likelihood of race/sync bug.

### 8.1 Match Timer (V1)
- **Why**: 4 owners; drift up to 15s; coordinator-only timeout; 3rd model in Duel.
- **Race risk**: `timer_sync` broadcast interleaves with local tick → double-decrement or rewind.
- **Sync risk**: coordinator times out but non-coordinators still show time; game-over by timeout inconsistent across clients.
- **Current mitigation**: 500ms broadcast throttle; 15s sync cadence; refs in M17; `matchTimeoutFlagRef` dedupe.

### 8.2 Board FEN (V2)
- **Why**: dual source; reconnect + polling can present stale FEN; playback overrides live FEN.
- **Race risk**: `syncGameState()` (DB load) races in-flight `turn_resolved`.
- **Sync risk**: UI board and engine board diverge; sound triggers depend on `prevFenRef` diffs.
- **Current mitigation**: `prevGameFenRef` auto-reset playback; board `key` remount on cancel.

### 8.3 Turn Phase / Resolution (V3 + ordering)
- **Why**: broadcast ordering not guaranteed; `turn_resolved` can arrive before `player_locked` handlers finish (2026-08-03 bug fixed by removing a status guard — now relies on ordering).
- **Race risk**: `waitForTeammateLock` promise never resolves if broadcast lost (30s recovery added in M17).
- **Sync risk**: coordinator vs non-coordinator divergence in pendingMoves/locked state.
- **Current mitigation**: event-based promises, 30s recovery timeout, removed status guard.

### 8.4 Premium Status (V4)
- **Why**: bypass path + 30s cache; multiple lenient grant conditions; webhook metadata gaps.
- **Race risk**: webhook vs verify-checkout double-grant; cache serving stale `false`/`true`.
- **Current mitigation**: `invalidate()` calls, provider abstraction, fallback `checkouts.retrieve`.

### 8.5 Game Status Enum (V6)
- **Why**: 3 representations; status gates in M15 (e.g., `_status !== PLAYING`) drive broadcast handling.
- **Race risk**: a stale status in `handleTurnResolved` silently drops events (the exact 2026-08-03 bug).
- **Current mitigation**: recent guard removal; rely on broadcast order.

### 8.6 Unread Counts / Badges (S4/S16)
- **Why**: two hooks + a subscription to a possibly non-existent `friend_requests` table.
- **Race risk**: duplicate channels per mount (`channelCounter` mitigates naming); stale counts after visibility changes.
- **Current mitigation**: `visibilitychange` re-fetch, unique channel names.

---

## 9. FUTURE REFACTORING PRIORITIES

Ranked, mapped to Phase 2 modules. **Not performed** — documentation only.

| # | Priority | Refactor | Phase 2 tie | Effort | Payoff |
|---|----------|----------|-------------|--------|--------|
| 1 | **Timer SSOT** | Extract single `TimerService` (authoritative `matchTimeRemaining` + tick events + `timer_sync`); collapse M12/M15/M17/M22; unify Duel clocks | M22, M12, M15, M17, M18 | Large | Eliminates V1 + 15s drift + 3rd model |
| 2 | **Resolution SSOT** | Extract pure `ResolutionService` `(a, b, fen) → MoveComparison`; used by M14/M15/M16; delete `resolveLegacy` | M20, M14, M15, M16 | Large | Eliminates V3 + 4 implementations |
| 3 | **TurnManager** | Move turn advancement + bot continuation into engines; M17 renders only; remove `pendingOpponentTurnRef`/`initialBotTurnTriggeredRef` | M21, M17, M24 | Medium | Eliminates V9 + UI bot logic |
| 4 | **GameShell** | Shared shell for M17+M18 (single state projection from engine getters); remove UI FEN copy | M17, M18 | Large | V2 + Duel island (V10) |
| 5 | **M30 read path** | Route all premium reads through `SubscriptionService`; remove M31 direct read | M30, M31 | Small | V4 |
| 6 | **M27 types + RLS** | Regenerate `Database` type (add `games`, `duel_games`, `message_type`); tighten `room_players`/`games` RLS | M27, M08, M26 | Medium | S5 + S6 |
| 7 | **History SSOT** | Promote `completed_games` to primary with local cache + reconciliation | M35 | Medium | V7 |
| 8 | **Room consolidation** | Single room-creation path + explicit expiry constants | M08, M09 | Medium | V8 |
| 9 | **Constants enforcement** | Single `ROOM_EXPIRY_MS`; lint duplicate magic numbers | M13 | Small | V8 |
| 10 | **Quota SSOT** | Decide insights quota: server column or local; wire `profiles.insights_reveals_used` | M31 | Small | S7 |
| 11 | **M28 channel factory** | M16/M34 create channels through factory; global sign-out cleanup | M28, M16, M34 | Medium | S2 |
| 12 | **ProfileService** | Centralize `profiles` reads; remove M17/M18 UI→DB fetches | M02, M17, M18 | Medium | S1 |

**Sequence suggestion**: 5 → 6 → 9 (cheap wins) → 3 → 2 (core engine) → 1 → 4 (shell) → 7 → 8 → 10 → 11 → 12.

---

## 10. APPENDIX

### 10.1 localStorage key map

| Key | Shape | Module | Cleared on sign-out |
|-----|-------|--------|---------------------|
| `chessduo_settings` | `Settings` JSON | M03 | ✅ |
| `chessduo_selected_time` | `number` | home page | ❌ |
| `chessduo_selected_level` | `number` | home page | ❌ |
| `chessduo_selected_color` (`SELECTED_COLOR_KEY`) | `PlayerColor` | home page / M13 | ❌ |
| `chessduo_insights_{userId}` | `{revealsUsed}` | M31 | ✅ |
| `chessduo_history_{userId}` | `CompletedGame[]` | M35 | ❌ (user-scoped survives) |
| `chessduo_history` (legacy) | `CompletedGame[]` | M35 | ✅ (migrated then deleted) |
| `chessduo_push_disabled` | `'true'` | M32 | ❌ (intentional) |
| `chessduo_fcm_token` | `string` | M32 | ❌ (resetPushState) |
| `chessduo_push_in_progress` | timestamp | M32 | ❌ |
| `chessduo_push_last_error` | `string` | M32 | ✅ |
| `chessduo_vapid_public_key` | `string` | M32 | ❌ |
| `chessduo_notification_redirect` | `NotificationRedirect` JSON (30s TTL) | M32/M06 | ❌ |
| `chessduo_offline_disclaimer_dismissed` | `'true'` | home page | ❌ |
| `chessduo_welcome_dismissed` | `'true'` | home page | ❌ |
| `chessduo_pending_offline_game` | JSON `{level,time,color}` | home page | ❌ (consumed once) |
| `chessduo_pending_online_game` | JSON `{time,playerId,color}` | home page | ❌ (consumed in /welcome) |

### 10.2 Supabase table → state map

| Table | Owning state | Primary writers | RLS note |
|-------|-------------|-----------------|----------|
| `profiles` | identity, premium, subscription | M02 (identity), M30 (sub) | public select; self update |
| `rooms` | room lifecycle | M08 | public select; creator update |
| `room_players` | membership/team/slot | M08 | **Allow all OR** |
| `games` | in-progress state | M26 | **Allow all OR** |
| `completed_games` | finished records | M35 | auth select+insert |
| `friendships` | social graph | M33 | self-owned rows |
| `messages` | chat | M34 | self-owned rows |
| `challenge_links` | deep links | M07 | public select; creator update |
| `duel_games` | duel state | M16 | participants only |
| `push_tokens` | device registration | M32 | self-owned only |

### 10.3 React Context / Provider state

| Context | State | Provider | Consumers |
|---------|-------|----------|-----------|
| `PremiumContext` | `isPremium`, `loading` | `PremiumProvider` | any `usePremium()` |
| `ToastContext` | toast queue | `NetworkAwareToastProvider` → `ToastProvider` | `useGameToast()` |
| Network status | `online` | `useNetworkStatus` (rendered by NetworkOverlay) | NetworkOverlay |

### 10.4 Class instances and their mutable surface

| Class | Instance location | Mutable state surface |
|-------|-------------------|-----------------------|
| `GameState` | created by M14/M15 | phase, team, players, selections, locked, pendingMoves, captured, timers, chess |
| `OnlineGame` | created by M17 | status, room, playerId/team, turnState, promises, stats, comparisons, intervals, disconnect |
| `LocalGame` | created by M17 | status, stats, playerColor, lastMove, comparison, game-over cache |
| `DuelGame` | created by M18 | chess, status, players, clocks, winner, history, accuracies, intervals |
| `BrowserMoveEvaluator` | singleton via factory | worker, ready, initError |
| `SubscriptionManager` | singleton | channel set |

### 10.5 Counts recap

| Category | Count |
|----------|-------|
| `useState` declarations (M17/M18/ChessBoard/GameLobby/others) | ~90 |
| `useRef` declarations | ~40 |
| Class instance fields (6 classes) | ~100 |
| localStorage keys | 17 |
| Supabase tables | 10 |
| React Contexts | 3 |
| Browser/hardware state sources | 3 (history, navigator.onLine, DOM theme class) |
| Edge worker state | 1 (rate-limit buckets) |

### 10.6 Cross-reference

- Phase 1: `docs/revamp/01_REPOSITORY_DISCOVERY.md` — §10 State Management Overview, §14 Realtime Overview.
- Phase 2: `docs/revamp/architecture/02_MODULE_ARCHITECTURE.md` — §4 State Ownership Map, §5 Module Communication, §7 Dependency Analysis.
- Module IDs (M01–M35) follow Phase 2 definitions.

---

### Phase 3 Complete

This document is **documentation only**. No implementation was modified.

**Every future bug fix should answer**: *which state is affected, who owns it, is the SSOT intact?* When a fix touches state with a ⚠ or ❌ verdict, locate the violation in §7 and preserve (or move toward) the target SSOT in §9.

**Waiting for Phase 4.**
