# CHESSDUO — PHASE 2: MODULE ARCHITECTURE & OWNERSHIP

> **Foundation document.** Every future bug fix, feature, and refactoring maps to an owning module defined here.
> This document is **documentation only** — no implementation changes were made.
> Pairs with: `docs/revamp/01_REPOSITORY_DISCOVERY.md` (Phase 1).

---

## TABLE OF CONTENTS

1. [Reading Guide](#1-reading-guide)
2. [Module Inventory](#2-module-inventory)
3. [Detailed Module Specifications](#3-detailed-module-specifications)
4. [State Ownership Map](#4-state-ownership-map)
5. [Module Communication](#5-module-communication)
6. [Module Boundaries](#6-module-boundaries)
7. [Dependency Analysis](#7-dependency-analysis)
8. [Assessment & Conclusion](#8-assessment--conclusion)

---

## 1. READING GUIDE

### How to use this document

1. **Mapping a bug** → locate the owning module in §3, read its Known Risks and Current Violations.
2. **Planning a feature** → read the module's Public API, Extension Points, and Boundaries before touching code.
3. **Refactoring** → start with modules flagged in §7 (God Objects, duplicate owners) and §8 (priority review list).

### Conventions

- **OWNED** = module is the single writer/decision-maker for this concern.
- **Shared read** = multiple modules read; exactly one writes.
- **Violation** = current code breaks the intended boundary. Documented here, **not resolved**.

---

## 2. MODULE INVENTORY

### 2.1 Module List (35 modules)

| # | Module | Category | Primary Location | Module Spec |
|---|--------|----------|-----------------|-------------|
| M01 | Authentication | Foundation | `src/lib/authService.ts`, `src/lib/supabaseAuthUtils.ts`, `src/lib/capacitorAuth.ts`, `src/components/Auth.tsx`, `src/middleware.ts` | §3.1 |
| M02 | User Profile | Foundation | `src/components/ProfilePanel.tsx`, `src/app/(main)/profile/`, `profiles` table | §3.2 |
| M03 | Settings | Foundation | `src/lib/settings.ts`, `src/components/SettingsPanel.tsx`, `src/app/(main)/settings/` | §3.3 |
| M04 | Browser Routing & Navigation | Foundation | `src/middleware.ts`, `src/app/` route tree, `src/components/DesktopSidebar.tsx` | §3.4 |
| M05 | Mobile Navigation | Foundation | `src/components/HomeBottomNav.tsx`, `BottomNav.tsx`, `BoardBottomNav.tsx` | §3.5 |
| M06 | Capacitor Bridge | Foundation | `src/lib/capacitorAuth.ts`, `src/hooks/useCapacitorBackButton.ts`, `capacitor.config.ts` | §3.6 |
| M07 | Deep Linking | Foundation | `src/lib/appUrl.ts`, `src/lib/challenges.ts`, `src/app/challenge/[code]/`, `src/app/invite/[userId]/`, `public/.well-known/` | §3.7 |
| M08 | Room Management | Game | `src/lib/roomActions.ts` | §3.8 |
| M09 | Matchmaking | Game | `src/lib/matchmaking.ts`, `src/components/MatchmakingQueue.tsx` | §3.9 |
| M10 | 4-Player Lobby | Game | `src/lib/fourPlayerActions.ts`, `src/app/(main)/four-player/`, `src/components/GameLobby.tsx` | §3.10 |
| M11 | Lobby & Pre-Game UI | Game | `src/components/GameLobby.tsx`, `GameLoading.tsx`, `EvaluatingLoader.tsx` | §3.11 |
| M12 | Game Engine (Core) | Game | `src/features/game-engine/gameState.ts` | §3.12 |
| M13 | Game Interface Contract | Game | `src/features/shared/GameInterface.ts` | §3.13 |
| M14 | Offline Game (LocalGame) | Game | `src/features/offline/game/localGame.ts` | §3.14 |
| M15 | Online Game (OnlineGame) | Game | `src/features/online/game/onlineGame.ts` | §3.15 |
| M16 | Duel Game Engine | Game | `src/lib/duelGame.ts` | §3.16 |
| M17 | 2v2 Game Shell | Game | `src/components/Game.tsx` | §3.17 |
| M18 | Duel Game Shell | Game | `src/components/DuelGame.tsx` | §3.18 |
| M19 | Chess Board | Game | `src/components/ChessBoard.tsx`, `MobileChessBoard.tsx` | §3.19 |
| M20 | Move Resolution | Game | `localGame.ts` + `onlineGame.ts` + `Game.tsx` (cross-cutting) | §3.20 |
| M21 | Turn Management | Game | `OnlineGame` + `Game.tsx` (cross-cutting) | §3.21 |
| M22 | Timer | Game | `MatchTimer.tsx`, `TeamTimer.tsx`, `GameState`, `OnlineGame`, `Game.tsx` (cross-cutting) | §3.22 |
| M23 | Stockfish Evaluation | Game | `src/features/mobile-engine/BrowserMoveEvaluator.ts`, `evaluatorFactory.ts` | §3.23 |
| M24 | Bot AI | Game | `src/features/bots/chessBot.ts`, `botConfig.ts`, `difficulty.ts`, `openings.ts` | §3.24 |
| M25 | Move History & Playback | Game | `src/components/MovePlayback.tsx`, `RoundHistorySidebar.tsx` | §3.25 |
| M26 | Game Persistence | Game | `src/lib/gamePersistence.ts` | §3.26 |
| M27 | Supabase Client | Infrastructure | `src/lib/supabase.ts` | §3.27 |
| M28 | Realtime Layer | Infrastructure | `src/lib/subscriptionManager.ts`, channels inside M15/M16 | §3.28 |
| M29 | API Infrastructure | Infrastructure | `src/app/api/healthz/`, `log-crash/`, `delete-account/`, `src/lib/rateLimit.ts`, `src/lib/apiAuth.ts` | §3.29 |
| M30 | Premium Billing | Feature | `src/features/billing/`, `src/app/api/creem/` | §3.30 |
| M31 | Insights (Premium Gate) | Feature | `src/lib/insights.ts`, `src/components/InsightsGate.tsx`, `MoveComparison.tsx` | §3.31 |
| M32 | Push Notifications | Feature | `src/features/push-notifications/`, `src/app/api/push/`, `public/sw.js` | §3.32 |
| M33 | Friends | Feature | `src/lib/friends.ts`, `src/components/FriendsPanel.tsx`, `src/app/(main)/friends/` | §3.33 |
| M34 | Chat & Messages | Feature | `src/lib/messages.ts`, `src/components/ChatPanel.tsx` | §3.34 |
| M35 | Match History & Replay | Feature | `src/lib/matchHistory.ts`, `HistoryPanel.tsx`, `src/app/(main)/history/`, `src/app/replay/` | §3.35 |

### 2.2 Cross-Cutting Modules (not standalone)

These concerns do not own a directory — they are embedded inside the modules above. Their fragmentation is itself a documented finding.

| Concern | Fragmented Across | Finding |
|---------|-------------------|---------|
| Move Resolution | M20 (M14/M15/M17) | 3 implementations, subtle divergence |
| Turn Management | M21 (M15/M17) | Coordinator logic in engine + UI |
| Timer | M22 (M12/M15/M17/M22) | 4 owners, sync via broadcast |
| Game State Sync | M15, M26 | DB snapshot + broadcast reconciliation |
| Shared UI primitives | components/ | No dedicated `ui/` package |
| Shared constants | M13 | Well-centralized (`gameConstants.ts`) |

---

## 3. DETAILED MODULE SPECIFICATIONS

---

### §3.1 M01 — Authentication

**Purpose**: Verify identity, manage sessions, and gate access. Backed by Supabase Auth (email/password + Google OAuth + anonymous) with two transport paths (web cookies, Capacitor Bearer token).

**Responsibilities**
- Sign in / sign up / sign out (email, Google web, Google native via Capgo)
- Session lifecycle broadcast (`onAuthStateChange`)
- Anonymous guest session support
- Middleware route guard (`/game`, `/duel`, `/history`)
- Cross-platform auth flow selection (web OAuth vs Capacitor Browser vs native Capgo)

**What it OWNS**
- Auth session state (`AuthService` event stream)
- Access-token cache for push registration (`cachedAccessToken`)
- Route guard decisions for protected pages

**What it does NOT own**
- User profile data (M02)
- Push token registration (M32) — reads the token cache
- Premium status (M30) — reads session only to know *who*
- Local settings (M03)

**Inputs**
- Credentials (email/password), Google OAuth result, deep-link return
- Incoming HTTP requests (middleware)

**Outputs**
- `Session | null`, auth event stream, middleware redirects, cached access token

**Public API**
- `AuthService.getSession()`, `AuthService.onAuthChange(cb)`
- `authenticateWithGoogle()`, `authenticateWithGoogleNative()`, `authenticateWithGoogleWeb()`, `authenticateWithGoogleCapacitorBrowser()`
- `registerCapacitorAuthListener()`, `registerBackButtonListener()`
- Middleware export in `src/middleware.ts`

**Internal Components**
- `authService.ts`, `supabaseAuthUtils.ts`, `capacitorAuth.ts`, `Auth.tsx`, `middleware.ts`

**Database Tables**: none directly (session lives in Supabase Auth; profile row created by trigger)

**Realtime Channels**: none

**Cloudflare Endpoints**: none (middleware runs at edge)

**Dependencies**
- Supabase Auth (`@supabase/ssr`), Capacitor plugins (`@capgo/capacitor-social-login`, `@capacitor/app`)

**Consumers**
- M02, M30, M32, M17, M18, all `(main)/` pages via layout

**Published Events**
- `SIGNED_IN`, `SIGNED_OUT`, `INITIAL_SESSION`, `TOKEN_REFRESHED` (via `AuthService.onAuthChange`)

**Subscribed Events**: none

**Allowed Dependencies**: Supabase SDK, Capacitor plugins, `src/lib/supabase.ts`
**Forbidden Dependencies**: game engines (M14/M15/M16), billing internals, components above it

**Extension Points**
- New OAuth provider → add branch in `supabaseAuthUtils.ts`
- New protected route → add matcher to `middleware.ts`

**Known Risks**
- Middleware only guards 3 paths; `/replay`, `/challenge`, `/invite` handle auth at page level — inconsistent protection model
- Google OAuth has 3 web/native paths; subtle divergence in returned metadata

**Current Violations**
- `Auth.tsx` is a UI component but owns sign-in state machine — mixes presentation with session logic
- `capacitorAuth.ts` mixes deep-link routing (M07 concern) with auth bridging

**Architecture Notes**: Auth is reasonably isolated. The main debt is the 3-way Google path and auth logic living inside a UI component.

---

### §3.2 M02 — User Profile

**Purpose**: Store and display user identity (username, avatar, display name) and per-user aggregate stats.

**Responsibilities**
- Read/update profile row (`profiles` table)
- Username editing with validation
- Google avatar/display-name capture from OAuth metadata
- Stats aggregation (wins/losses/draws, accuracy, sync rate)
- Premium status card display (reads M30, not `profiles` directly in UI)

**What it OWNS**
- The `profiles` table row for the current user (write path)
- Profile display UI (`ProfilePanel`)

**What it does NOT own**
- Subscription fields on `profiles` — written by M30 (webhook/verify) — **shared row, split writer risk**
- Match history rows (M35)
- Auth session (M01)

**Inputs**
- Session user ID, edit requests, avatar URL from OAuth metadata

**Outputs**
- `Profile` object, stats object

**Public API**
- `supabase.from('profiles')` (used directly by consumers — violation)
- `getPlayerStats(userId)` in M35 (`matchHistory.ts`) aggregates stats

**Internal Components**: `ProfilePanel.tsx`, `profile/page.tsx`, `InitialsAvatar.tsx`

**Database Tables**: `profiles`

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: `src/lib/supabase.ts`, M30 (premium read), M35 (stats)

**Consumers**: `profile/page.tsx`, `ProfilePanel`, `BoardTopBar` (via player label derivation), `FriendsPanel` (reads other users' profiles), home `page.tsx`

**Published Events**: none

**Subscribed Events**: auth events (M01) to know the current user

**Allowed Dependencies**: Supabase, M30, M35
**Forbidden Dependencies**: game engines, realtime internals

**Extension Points**: profile image upload; richer stats queries

**Known Risks**
- Direct `profiles` reads scattered in components (Game.tsx, DuelGame.tsx, FriendsPanel) — no single accessor
- `is_premium` is on the same row but written only by M30 — two writers on one table is fragile if a future feature writes profile casually

**Current Violations**
- `Game.tsx` and `DuelGame.tsx` fetch `profiles` directly inside `useEffect` — UI → DB, bypassing any service
- `insights.ts` (M31) reads `profiles.is_premium` directly instead of going through M30

**Architecture Notes**: Needs a `ProfileService` accessor to centralize reads and remove UI→DB queries.

---

### §3.3 M03 — Settings

**Purpose**: Persist and apply per-user client preferences.

**Responsibilities**
- Store settings to `localStorage` (`chessduo_settings`)
- Provide synchronous read/write + a React hook
- Apply theme (`dark` class toggle), sound enabled, auto-queen, low-time warning, confirm-move
- Gate confirm-move UI in game shells (M17/M18)

**What it OWNS**
- The `chessduo_settings` localStorage key
- The `useSettings()` hook state

**What it does NOT own**
- Push opt-out flag (`chessduo_push_disabled`) — owned by M32
- Server-side settings (none exist)

**Inputs**: toggle actions from `SettingsPanel` / `GameMenu`

**Outputs**: `Settings` object, DOM class changes, sound engine enable state

**Public API**
- `getSetting(key)`, `setSetting(key, value)`, `getTheme()`, `useSettings()`

**Internal Components**: `SettingsPanel.tsx`, `settings/page.tsx`, `settings.ts`

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: none (localStorage only)

**Consumers**: M17 (confirmMove gate), M18, `GameMenu`, settings page, root layout theme

**Published Events**: none (hook consumers read on render)

**Subscribed Events**: none

**Allowed Dependencies**: none beyond platform APIs
**Forbidden Dependencies**: game engines, Supabase

**Extension Points**: new settings keys; server sync (documented gap)

**Known Risks**
- CONTEXT/RULES and ARCHITECTURE.md claim "localStorage with Supabase sync when authenticated" — **no such sync exists in code** (documented gap)
- Settings are device-local; no cross-device migration

**Current Violations**
- `setSetting`/`useSettings` are pure localStorage; no Supabase persistence despite documentation
- `GameMenu` (hamburger) duplicates a Settings toggle path alongside `SettingsPanel`

**Architecture Notes**: Small, well-scoped. The only debt is the doc-vs-code sync gap and dual settings UI entry points.

---

### §3.4 M04 — Browser Routing & Navigation

**Purpose**: Define the URL structure, edge auth guard, and desktop navigation shell.

**Responsibilities**
- App Router page tree (home, game, duel, welcome, challenge, invite, replay, `(main)/` group)
- Middleware guard for `/game`, `/duel`, `/history`
- Desktop sidebar navigation (`DesktopSidebar`)
- Back navigation (`BackButton`)
- Lazy loading of game components (`next/dynamic`, `ssr: false`)

**What it OWNS**
- The route tree and its layouts
- Middleware redirect rules
- Desktop nav UI

**What it does NOT own**
- Mobile bottom nav (M05)
- Deep-link URL generation (M07) — consumes it
- In-game tab navigation (M05 `BoardBottomNav`)

**Inputs**: URL, auth state (M01), query params

**Outputs**: Rendered pages, redirects, layout shell

**Public API**: route files; `BackButton`; `useNavigationGuard` (M17 uses it)

**Internal Components**: `layout.tsx`, `providers.tsx`, `DesktopSidebar.tsx`, `BackButton`, `PageLoading`, route-level `page.tsx`/`loading.tsx`

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none (edge middleware)

**Dependencies**: M01 (guard), M17/M18 (lazy components)

**Consumers**: all users of the app

**Published Events**: none

**Subscribed Events**: auth events

**Allowed Dependencies**: M01, components
**Forbidden Dependencies**: game engine internals

**Extension Points**: new routes; matcher changes

**Known Risks**
- Route groups (`(main)/` vs root-level dynamic routes) are load-bearing for static export — moving routes breaks `generateStaticParams`
- Middleware matcher is hardcoded string array — new protected routes must remember to add them

**Current Violations**
- `src/app/CONTEXT.md` references `src/proxy.ts` (renamed/legacy); actual file is `src/middleware.ts` — stale docs
- Home page (`page.tsx`) contains inline room auto-join logic (M08 concern) alongside layout

**Architecture Notes**: Route tree is clean and deliberate; the home page god-page is the main smell.

---

### §3.5 M05 — Mobile Navigation

**Purpose**: Mobile-first bottom navigation and in-game tab navigation.

**Responsibilities**
- `HomeBottomNav` (floating pill, 4 tabs) for non-game pages
- `BottomNav` (legacy mobile nav used by DuelGame/ReplayView)
- `BoardBottomNav` (5-tab in-game nav: Moves / Game / Surrender / Insights / Chat)
- Active-tab detection via `usePathname()`

**What it OWNS**
- Mobile nav UI + active-state logic

**What it does NOT own**
- Game content (M17/M18)
- Chat content (M34) — opens it via slide-over
- Insights content (M31) — opens it via slide-over

**Inputs**: `usePathname()`, props (`activeTab`, `onTabChange`, `unreadChat`, `insightsLocked`)

**Outputs**: navigation events, tab-change callbacks

**Public API**: `HomeBottomNav`, `BottomNav`, `BoardBottomNav` components

**Internal Components**: same as above

**Database Tables**: none

**Realtime Channels**: none (badge counts come from M33/M34 via M28 `useBadgeCount`)

**Dependencies**: `usePathname`, M34 (unread badge), M31 (insights lock badge)

**Consumers**: `(main)/layout.tsx`, M17, M18, home page

**Published Events**: `onTabChange(tab)` (local)

**Subscribed Events**: none (reads props)

**Allowed Dependencies**: hooks, M34/M31 props
**Forbidden Dependencies**: game engines

**Extension Points**: new tabs

**Known Risks**
- `BoardBottomNav` and `BottomNav` coexist — legacy `BottomNav` used in some shells, `BoardBottomNav` in others (inconsistent shell APIs)
- Unread/insight badges couple nav UI to M31/M34

**Current Violations**
- Three overlapping nav components (`HomeBottomNav`, `BottomNav`, `BoardBottomNav`) with different props — duplicated patterns

**Architecture Notes**: Functionally fine; consolidation is a UI-polish concern.

---

### §3.6 M06 — Capacitor Bridge

**Purpose**: Native container integration for Android (and future iOS): hardware back, deep-link receipt, splash, in-app browser, social login bridge.

**Responsibilities**
- Register hardware back-button handler
- Parse incoming deep links (`chessduo://`, `com.navron.chessduo://`, https) into app paths
- `chessduo://premium` return-bridge routing
- Social login native bridge
- Splash screen lifecycle (`SplashHandler`)
- Capacitor auth listener for phone/OAuth flows

**What it OWNS**
- Capacitor native plugin invocation and lifecycle wiring
- Deep-link → path translation (shared with M07)

**What it does NOT own**
- URL *generation* (M07)
- Auth state (M01) — it feeds it

**Inputs**: Capacitor plugin events (URL open, back press, resume)

**Outputs**: translated paths, back events, auth payloads

**Public API**
- `getPathFromUrl(url)`, `registerCapacitorAuthListener()`, `registerBackButtonListener()`, `handleDeepLink()`
- Hooks: `useCapacitorBackButton`, `useNotificationRedirect` (with M32)

**Internal Components**: `capacitorAuth.ts`, `useCapacitorBackButton.ts`, `SplashHandler.tsx`, `capacitor.config.ts`, `android-patches/`, `scripts/*.sh`

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: `@capacitor/*` plugins, M01 (auth), M07 (URLs)

**Consumers**: M01, M07, providers.tsx, M17/M18 (back button)

**Published Events**: deep-link handled, back pressed

**Subscribed Events**: Capacitor plugin events

**Allowed Dependencies**: Capacitor, M01, M07
**Forbidden Dependencies**: game internals

**Extension Points**: new native plugins; iOS support

**Known Risks**
- Native-specific behavior is untestable in Jest (guarded by platform checks)
- `chessduo://` custom scheme is deliberately NOT shared (Bug 37) — deep-link surface depends on App Links/assetlinks

**Current Violations**
- `capacitorAuth.ts` mixes deep-link parsing (M07) with auth bridging (M01) — two concerns, one file
- `getPathFromUrl` duplicates URL-parsing that could live solely in M07

**Architecture Notes**: Small surface, high fragility (native bridge races have caused crashes — see M32). Keep logic minimal here.

---

### §3.7 M07 — Deep Linking

**Purpose**: Generate and resolve shareable URLs (invites, challenges, rooms) across web and native.

**Responsibilities**
- Build HTTPS App Links (`getAppBaseUrl`, `getRoomInviteLink`, `getProfileLink`, `getInviteLink`, `getChallengeUrl`)
- Create/validate challenge links (`challenge_links` table, 8-char codes, 24h expiry)
- Pre-create duel rooms with `host_team: 'WHITE'` for challenge links
- Landing pages `/challenge/[code]` and `/invite/[userId]`
- Platform manifests: `assetlinks.json`, `apple-app-site-association`
- Return-bridge page `/api/creem/return` (native checkout)

**What it OWNS**
- All shareable-URL generation
- Challenge-link lifecycle (with M08 for rooms)
- `public/.well-known/` verification files

**What it does NOT own**
- Room join execution (M08/M15) — it prepares and hands off
- Friend-request execution (M33) — `/invite` hands off to it

**Inputs**: room code, user ID, challenge mode/time, checkout session id

**Outputs**: HTTPS URLs, `ChallengeLink` rows, landing page redirects

**Public API**
- `getAppBaseUrl()`, `getRoomInviteLink(code)`, `getProfileLink(userId)`, `getInviteLink(userId)`, `getChallengeUrl(code)`
- `createChallenge(creatorId, gameMode, timeSeconds, friendId?)`, `getChallengeByCode(code)`, `deactivateChallenge(id)`, `getChallengeHistory(creatorId)`
- `challenge/[code]/page.tsx`, `invite/[userId]/page.tsx`

**Internal Components**: `appUrl.ts`, `challenges.ts`, `share.ts`, landing pages

**Database Tables**: `challenge_links` (own), `rooms` + `room_players` (creates via M08), `duel_games` (creates for duels)

**Realtime Channels**: none

**Cloudflare Endpoints**: none (static `.well-known/`)

**Dependencies**: M08 (rooms), M27 (Supabase), M01 (session on landing pages)

**Consumers**: share buttons across M11, M33, M02; push notifications (M32 game_invite payload); home page auto-join

**Published Events**: challenge accepted → redirect to `/duel` or `/game`

**Subscribed Events**: none

**Allowed Dependencies**: M08, M27, M01
**Forbidden Dependencies**: game engines (M14–M16)

**Extension Points**: new share-link types; new deep-link route handlers

**Known Risks**
- Deep-link correctness has been the source of several prod bugs (Bug 37/38/39) — high regression surface
- RLS interplay: joiners must NOT read `room_players` before joining (Bug 39) — the `host_team` + `get_room_join_state` RPC contract is load-bearing
- `store/` (Play Store metadata) has no CONTEXT.md and no link to `.well-known` generation

**Current Violations**
- `getPathFromUrl` lives in M06 (`capacitorAuth.ts`), not here
- `share.ts` (in M07's orbit) is a separate lib file without its own module doc

**Architecture Notes**: One of the most bug-prone areas. Centralize all URL construction here and treat `.well-known` + `challenges.ts` + `appUrl.ts` as one unit.

---

### §3.8 M08 — Room Management

**Purpose**: CRUD for game rooms and room membership — the durable record behind online games.

**Responsibilities**
- Create rooms (online, matchmaking, four-player, challenge pre-created)
- Generate room codes (6-char, ambiguous chars excluded)
- Insert/upsert room players, assign teams/slots
- `host_team` storage (RLS-safe join model)
- Delete rooms + all players

**What it OWNS**
- `rooms` and `room_players` table writes
- The `host_team` join-derivation contract
- Room code generation

**What it does NOT own**
- Real-time channel lifecycle (M15)
- Matchmaking queue selection (M09) — uses M08 primitives
- Game state (M26/M12)

**Inputs**: player ID, time, host color, mode, room code

**Outputs**: `Room`, `RoomPlayer`, room ID/code/team

**Public API**
- `generateRoomCode()`, `createOnlineRoom({playerId, timeSeconds, hostColor?})`
- Matchmaking: `createQuickMatchRoom`, `joinQuickMatchRoom`, `findAvailableRoom`, `deleteRoom`, `checkMyRoomJoined`
- Four-player: `createFourPlayerRoom`, `joinFourPlayerRoom`, `leaveFourPlayerRoom`, `assignPlayer`, `unassignPlayer`, `getFourPlayerSeats`, `joinFourPlayerByCode`
- `getRoomJoinState` RPC (via M27)

**Internal Components**: `roomActions.ts`, `matchmaking.ts`, `fourPlayerActions.ts`

**Database Tables**: `rooms` (own), `room_players` (own), `profiles` (read for usernames in seats)

**Realtime Channels**: none directly

**Cloudflare Endpoints**: none

**Dependencies**: M27 (Supabase), M13 (constants: ROOM_EXPIRY_MS)

**Consumers**: M07 (challenges), M09, M10, home page, M15 (joinRoom reads room), M16 (duel rooms)

**Published Events**: none (DB rows are the signal; Realtime presence via M15 picks them up)

**Subscribed Events**: none

**Allowed Dependencies**: M27, M13
**Forbidden Dependencies**: React, game engines

**Extension Points**: new room modes; custom seat assignment

**Known Risks**
- "Allow all" RLS on `room_players` means any client can read/write any room membership (see §7)
- Room cleanup relies on `expires_at` + scheduled `cleanup_stale_game_data`; matchmaking uses a *different* 60s expiry constant (`ROOM_EXPIRY_MS` in `matchmaking.ts` re-defined as 60_000, shadowing the 24h constant from M13) — **two expiry constants for the same table**
- `createOnlineRoom` vs `createFourPlayerRoom` vs `createQuickMatchRoom` — three creation paths with subtly different invariants (host auto-join vs not)

**Current Violations**
- `matchmaking.ts` locally redefines `ROOM_EXPIRY_MS = 60_000`, shadowing `gameConstants.ROOM_EXPIRY_MS = 86400000` — same name, different value, different module (M13 violation)
- Four-player creation doesn't auto-join creator; online does — inconsistent ownership of "who is in the room"

**Architecture Notes**: The RLS-safe join model (Bug 39) is a deliberate, correct design — preserve it. Consolidate the three room-creation paths and the two expiry constants.

---

### §3.9 M09 — Matchmaking

**Purpose**: Match players into online rooms automatically (Quick Play queue).

**Responsibilities**
- Find an available `waiting` room with team capacity
- Create a room if none available (with retry on code collision)
- Join the matched room as the correct team/slot
- Tolerate duplicate-key races (two players match same room)

**What it OWNS**
- Quick-match queue selection logic

**What it does NOT own**
- Room persistence (M08) — delegates
- Real-time start signaling (M15) — presence detects join
- Lobby UI (M11)

**Inputs**: player ID, time

**Outputs**: `{ room, team, slot } | null`

**Public API**
- `findAvailableRoom(playerId, timeSeconds?)`, `createQuickMatchRoom(playerId, timeSeconds?)`, `joinQuickMatchRoom(...)`, `checkMyRoomJoined(roomId)`, `deleteRoom(roomId)`

**Internal Components**: `matchmaking.ts`, `MatchmakingQueue.tsx` (UI)

**Database Tables**: `rooms`, `room_players`

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M08, M27, M13

**Consumers**: home page (`page.tsx`) Quick Play button, `MatchmakingQueue`

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: M08, M27, M13
**Forbidden Dependencies**: React internals, game engines

**Extension Points**: skill-based matching, region, custom filters

**Known Risks**
- O(n) room scan to find capacity — no index/queue table (perf at scale)
- Race: two joiners matched to same free slot — mitigated by upsert tolerance, but team/slot may over-subscribe until start
- 60s room expiry vs 24h for manual rooms (see M08 risk)

**Current Violations**
- `MatchmakingQueue.tsx` (UI) is listed under M11 responsibilities but is used by M09 — ownership split between "queue logic" and "queue UI"

**Architecture Notes**: Simple and correct for low concurrency. Needs a proper queue table or DB-side matching for scale.

---

### §3.10 M10 — 4-Player Lobby

**Purpose**: Lobby + seat assignment for all-human 4-player team chess.

**Responsibilities**
- Create 4-player room (does NOT auto-join creator)
- Seat assignment (2 WHITE + 2 BLACK, slots 0/1)
- Ready-state tracking, join/leave
- Ready detection (`areTeamsReady`)
- Lobby UI with room code sharing

**What it OWNS**
- Four-player seat assignment state
- Four-player lobby page

**What it does NOT own**
- Game start (M15 presence detects 4 present + ready)
- Room table (M08)

**Inputs**: player ID, room ID, team, slot, code

**Outputs**: seat map, lobby player list, readiness

**Public API**
- `createFourPlayerRoom`, `joinFourPlayerRoom`, `leaveFourPlayerRoom`, `getFourPlayerSeats`, `areAllSeatsFilled`, `joinLobby`, `assignPlayer`, `unassignPlayer`, `getLobbyPlayers`, `areTeamsReady`, `joinFourPlayerByCode`, `getRoomMode`

**Internal Components**: `fourPlayerActions.ts`, `four-player/page.tsx`, `GameLobby.tsx` (shared)

**Database Tables**: `rooms`, `room_players`, `profiles`

**Realtime Channels**: none directly (M15 presence picks up joins)

**Cloudflare Endpoints**: none

**Dependencies**: M08, M27

**Consumers**: `four-player/page.tsx`, M11 (lobby UI)

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: M08, M27
**Forbidden Dependencies**: game engines

**Extension Points**: custom team sizes

**Known Risks**
- Seat assignment + game-start handoff to M15 is implicit (presence), no explicit "everyone ready" broadcast
- Same "Allow all" RLS exposure as M08

**Current Violations**: none major

**Architecture Notes**: Small, correct. Handoff to game start is the fuzziest part.

---

### §3.11 M11 — Lobby & Pre-Game UI

**Purpose**: Pre-game waiting screens: connecting, room code share, countdown, timeout, loading states.

**Responsibilities**
- Show room code + copy/share invite
- "Connecting / Connected / Waiting for teammate" states
- 60s lobby timeout countdown
- Loading screens (`GameLoading`, `EvaluatingLoader`, `PageLoading`)
- Pre-warm indicator

**What it OWNS**
- Pre-game presentation state (copied, timed out, remaining)

**What it does NOT own**
- Room persistence (M08)
- Match selection (M09)
- Game start trigger (M15)

**Inputs**: roomCode, inviteUrl, isLoading, username, timeout seconds

**Outputs**: user actions (copy, share, leave), timed-out callback

**Public API**
- `GameLobby`, `GameLoading`, `ConnectionStatus`, `TeamTurnIndicator`, `EvaluatingLoader`, `MatchmakingQueue`, `PageLoading`

**Internal Components**: same as above

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M07 (share links), `share.ts`

**Consumers**: M17, M18, M10 page, route-level loading.tsx

**Published Events**: `onTimeoutLeave` callback

**Subscribed Events**: none

**Allowed Dependencies**: M07, share util
**Forbidden Dependencies**: game engines

**Extension Points**: themed loading states

**Known Risks**
- `GameLobby` does not create rooms but is often assumed to — ownership confusion with M08
- Timeout (60s) is a magic number duplicated in UI and room logic

**Current Violations**: none major

**Architecture Notes**: Clean presentation module. Keep engine-free.

---

### §3.12 M12 — Game Engine (Core / GameState)

**Purpose**: Framework-free chess game state machine: board, phases, teams, pending moves, timers. Shared foundation for M14 and M15.

**Responsibilities**
- Chess position (chess.js `Chess`)
- Phase machine: `WAITING → SELECTING → LOCKED → RESOLVED → GAME_OVER`
- Team/player roster management (add/remove/replace)
- Pending move storage + lock tracking
- Turn start FEN capture
- Timer state fields
- Move application (`tryMove`), capture tracking
- Resolve into `MoveResult` given a forced move

**What it OWNS**
- `GamePhase`, `Team`, `PendingMoveInfo`, `CapturedPieces`, `MoveResult` types
- Board mutation through legal-move validation

**What it does NOT own**
- Engine scoring / Stockfish (M23)
- Stats/accuracy (M14/M15 derive)
- Networking (M15)
- UI (M17)

**Inputs**: time limit, moves (`uci`), players, FEN resets

**Outputs**: phase, FEN, pending-move map, match time remaining

**Public API**
- `startMatch()`, `startPendingTurn(fen)`, `setPendingMove(...)`, `lockPendingMove(player)`, `isBothPendingLocked()`, `getPendingMoves()`, `getAllPendingMoves()`, `getTurnStartFen()`, `selectMove/lockMove/getSelectedMove`, `resolve(forcedWinningMove?)`, `resetBoard(fen)`, timer getters/setters, `getPlayers(team)`

**Internal Components**: `gameState.ts`

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: `chess.js`, M13 (constants)

**Consumers**: M14, M15

**Published Events**: none (state read via getters; M14/M15 notify UI)

**Subscribed Events**: none

**Allowed Dependencies**: `chess.js`, M13
**Forbidden Dependencies**: React, Supabase, M23 evaluator

**Extension Points**: new phases, new move side-effects

**Known Risks**
- `resolve()` applies a *forced* winning move without engine — M14/M15 compute the winner outside; correctness depends on callers passing the right move
- Timer fields live here but ticking lives in M15/M17 (see M22)

**Current Violations**
- Timer *state* is here but timer *logic* is in M15/M17 — single field, three owners (M22 finding)

**Architecture Notes**: Cleanest module in the codebase. Preserve its framework-free purity.

---

### §3.13 M13 — Game Interface Contract & Shared Constants

**Purpose**: The type-level contract both game engines implement, plus shared constants and pure helpers.

**Responsibilities**
- Define `GameInterface` (32 methods) consumed by UI
- Centralize magic numbers (`gameConstants.ts`)
- Accuracy model (`accuracy.ts`)
- Avatar URL map (`avatars.ts`)
- Player color resolution

**What it OWNS**
- `GameInterface` type
- `gameConstants.ts` constants
- `accuracy.ts` formulas
- `avatars.ts` map

**What it does NOT own**
- Implementations (M14/M15)
- Scoring execution (M23)

**Inputs**: n/a (contract)

**Outputs**: types, constants, pure functions

**Public API**
- `GameInterface` (all methods listed in Phase 1 §5)
- Constants: `CHECKMATE_SCORE`, `DEFAULT_TEAM_TIMER_SECONDS`, `DEFAULT_MOVE_TIMER_SECONDS`, `ROOM_EXPIRY_MS`, `DEFAULT_POLLING_INTERVAL_MS`, `INSIGHTS_FREE_LIMIT`, `DEFAULT_PLAYER_COLOR`, `BROWSER_BOT_LEVEL`, `SELECTED_COLOR_KEY`
- `calculateAccuracy`, `getAccuracyCategory`, `calculateSyncRate`, `calculateDisagreementRate`
- `getAvatarUrl`, `resolvePlayerColor`

**Internal Components**: `GameInterface.ts`, `gameConstants.ts`, `accuracy.ts`, `avatars.ts`, `evaluationCache.ts`

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: `chess.js` types, M12 types

**Consumers**: M14, M15, M17, M18, M20, M23, M24, M31

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: chess.js, M12
**Forbidden Dependencies**: Supabase, React, components

**Extension Points**: new interface methods (must be added to both M14 + M15)

**Known Risks**
- Interface is UI-facing and engine-facing at once — any addition touches 3 files (interface + 2 engines)
- Duplicate constants: `matchmaking.ts` shadows `ROOM_EXPIRY_MS` (M08 violation)

**Current Violations**
- Constants duplicated outside this module (`ROOM_EXPIRY_MS` in `matchmaking.ts`, timeout numbers in M11/M22 UI)
- CONTEXT lists `evaluationCache.ts` under M13; it's also referenced by M23 — shared ownership of one file

**Architecture Notes**: Keep this as the single constants + contract home. Enforce via lint.

---

### §3.14 M14 — Offline Game (LocalGame)

**Purpose**: Fully client-side 2v2 game (bot teammate + bot opponent), no network.

**Responsibilities**
- Implement `GameInterface`
- Local turn lifecycle (select → lock → resolve)
- Player roster setup (4 placeholders, human + bots)
- Bot move orchestration on teammate/opponent slots (with M24)
- Local resolution via M23 evaluator (2 player moves)
- Stats + accuracy tracking (`GameStats`, `MoveComparison`)
- Timeout handling

**What it OWNS**
- Local game lifecycle & local resolution
- `GameStats`/`MoveComparison` construction for offline mode
- Player color resolution at construction

**What it does NOT own**
- Networking (M15)
- Stockfish internals (M23)
- Bot decision-making (M24) — it invokes
- UI rendering (M17)

**Inputs**: time limit, player color, moves

**Outputs**: `MoveComparison`, stats, phase transitions

**Public API**
- Full `GameInterface` impl + `addPlayer`, `selectMove`, `lockMove`, `lockAndResolve`, `resolveLegacy`, `getStats`, `isGameOver`, `getHiddenMove`

**Internal Components**: `localGame.ts`

**Database Tables**: none (offline)

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M12, M13, M23 (evaluator), M24 (bot)

**Consumers**: M17

**Published Events**: state-change callback (`setOnStateChange`)

**Subscribed Events**: none

**Allowed Dependencies**: M12, M13, M23, M24, M26 (persistence for replay)
**Forbidden Dependencies**: Supabase Realtime, React

**Extension Points**: new offline modes; hot-seat

**Known Risks**
- `resolveLegacy` and `resolvePendingMoves` coexist — two resolution paths in one class (M20 finding)
- LocalGame spawns 4 placeholders but UI collapses to 2 visual bots (Quick Play) — engine/UI invariant mismatch (documented in CONTEXT, still a smell)

**Current Violations**
- Duplicate resolution logic vs M15 (M20)
- `getHiddenMove`/`getTurnState` no-ops exist to satisfy interface — interface may be over-broad

**Architecture Notes**: Good separation from UI. Resolution duplication with M15 is the main refactor target.

---

### §3.15 M15 — Online Game (OnlineGame)

**Purpose**: Real-time multiplayer 2v2 via Supabase Broadcast + Presence with the coordinator pattern.

**Responsibilities**
- Implement `GameInterface`
- Supabase channel lifecycle (`room:{roomId}`)
- Presence tracking + start-when-ready detection
- Broadcast handling (player_move, player_locked, turn_resolved, timer_sync, match_abandoned, match_timeout, game_started)
- Coordinator election + local resolution
- Reconnection (`CHANNEL_ERROR` → re-setup + `syncGameState`)
- Fallback polling (exponential backoff)
- Disconnect/forfeit detection (35s)
- Broadcast throttling (500ms)
- Timer broadcast sync (15s interval) + local countdown

**What it OWNS**
- Real-time game state synchronization
- Coordinator election
- Online resolution execution
- Disconnect/abandon semantics
- The `room:{roomId}` channel

**What it does NOT own**
- Board logic (M12)
- Scoring (M23)
- UI (M17)
- Room rows (M08) — reads/uses them

**Inputs**: room, player ID, team, moves

**Outputs**: broadcast events, state-change callbacks, persisted state

**Public API**
- Full `GameInterface` impl + `joinRoom`, `startGameWhenReady`, `broadcastMove`, `broadcastLocked`, `isCoordinator`, `getCoordinatorId`, `waitForTeammateLock`, `waitForTurnChange`, `leaveRoom`, `abandonMatch`, `syncGameState`, `stopEngineTimer`, `getOtherPlayerId`, `isBlackCoordinator`, `setOnAbandonCallback`

**Internal Components**: `onlineGame.ts`

**Database Tables**: `rooms` (read), `room_players` (read/upsert via join), `games` (via M26)

**Realtime Channels**: `room:{roomId}` (presence + 7 broadcast events)

**Cloudflare Endpoints**: none

**Dependencies**: M12, M13, M23, M26 (persistence), M28 (subscriptionManager), M27

**Consumers**: M17

**Published Events**
- Broadcast: `player_move`, `player_locked`, `turn_resolved`, `timer_sync`, `match_abandoned`, `match_timeout`, `game_started`
- Presence: sync/join/leave

**Subscribed Events**: same broadcast set (from peers)

**Allowed Dependencies**: M12, M13, M23, M26, M27, M28
**Forbidden Dependencies**: React, UI components, billing

**Extension Points**: new broadcast events; server-authoritative mode (future)

**Known Risks**
- **Broadcast ordering is not guaranteed** — `turn_resolved` can arrive before `player_locked` handlers complete (Bug 2026-08-03 fix removed a guard that caused silent drops)
- Coordinator runs WASM on a client — evaluation latency and device variability affect all players
- 1679-line class — approaching god-object territory
- Timer sync interval (15s) + local countdown can drift between clients
- Reconnect `syncGameState` may overwrite in-flight moves

**Current Violations**
- Resolution logic duplicated with M14 (M20 finding)
- Channel setup + polling + reconnection all in one class — SRP pressure
- Timer ownership split with M22

**Architecture Notes**: The most complex and risk-dense module. Any change here needs the full broadcast-sequence mental model.

---

### §3.16 M16 — Duel Game Engine

**Purpose**: 1v1 chess engine with Supabase Realtime (separate from the 2v2 OnlineGame path).

**Responsibilities**
- Chess.js game state + turn validation
- Supabase channel (`room:{roomId}`) with per-team presence keys (`playerId_WHITE`/`_BLACK`)
- `duel_move` / `duel_game_over` broadcasts
- 2s DB polling fallback on `duel_games`
- Local timers (white/black), 35s disconnect forfeit
- End-game detection (checkmate, stalemate, insufficient material, 3-fold, timeout)
- Per-move accuracy evaluation via M23

**What it OWNS**
- Duel game state + lifecycle
- `duel_games` table reads/writes
- Duel presence keys

**What it does NOT own**
- 2v2 game logic (M14/M15)
- UI (M18)
- Room rows (M08) — challenge links pre-create them

**Inputs**: room ID, player ID, team, time limit, UCI moves

**Outputs**: `DuelGameState`, broadcasts, callbacks

**Public API**
- `join()`, `destroy()`, `makeMove(uci)`, `resign()`, `isMyTurn()`, `isPlayerWhite()`, `setOnStateChange(cb)`, `setOnOpponentMove(cb)`

**Internal Components**: `duelGame.ts`

**Database Tables**: `duel_games`

**Realtime Channels**: `room:{roomId}` (presence + `duel_move`, `duel_game_over`)

**Cloudflare Endpoints**: none

**Dependencies**: `chess.js`, M23, M27, M28

**Consumers**: M18

**Published Events**: `duel_move`, `duel_game_over`, presence sync/join/leave

**Subscribed Events**: same broadcast set

**Allowed Dependencies**: chess.js, M23, M27, M28
**Forbidden Dependencies**: React, M14/M15 internals

**Extension Points**: new duel formats

**Known Risks**
- **Architectural island**: uses a *different* presence-key scheme and a *different* sync strategy than M15 — two realtime models in one app
- Lives in `lib/` (utilities layer) but is a full engine — violates the layering (game engines live in `features/`)
- Duplicates timer, disconnect, and game-over logic from M14/M15

**Current Violations**
- Engine in `lib/` instead of `features/` — layer violation
- Realtime model diverges from M15 (presence key format, 2s polling vs backoff polling)
- No shared `GameInterface` contract — M18 can't treat M16 like M14/M15

**Architecture Notes**: Consolidating M16 into the same engine family as M14/M15 is a major Phase 3+ candidate.

---

### §3.17 M17 — 2v2 Game Shell

**Purpose**: The main 2v2 game component — orchestrates engine, board, UI, timers, sounds, persistence.

**Responsibilities**
- Instantiate LocalGame (offline) or OnlineGame (online)
- Render board + top bar + bottom nav + modals + slide-overs
- Turn lifecycle orchestration (select → confirm → lock → resolve)
- Timer tick UI
- Sound detection (FEN/capture diff)
- Playback + insights + chat slide-overs
- Game-over handling + save
- Team label derivation
- Navigation guard

**What it OWNS**
- Component-level orchestration of a live game
- 28 `useState` + 16 `useRef` game-state aggregation
- Confirmation-move flow (`heldMove`, `confirmMove` gate)
- Game-over save trigger

**What it does NOT own**
- Engine internals (M14/M15)
- Scoring (M23)
- Room creation (M08) — receives room via props/URL

**Inputs**: props (level, roomCode, mode, roomId, team, playerId, timeLimitSeconds, challengeId, fourplayer, playerColor)

**Outputs**: user actions to engine, rendering, toasts, saved history

**Public API**: `Game` component + props

**Internal Components**: `Game.tsx` (2478 lines) + all board-page revamp children (`BoardTopBar`, `BoardBottomNav`, `PendingMovesRow`, `ConfirmMoveBar`, `MoveResolvedCard`, `RoundHistorySidebar`, `MoveComparison`, `InsightsGate`, `ChessBoard`, `GameOverModal`, `GameMenu`, `ResignConfirmModal`, `LeaveConfirmModal`, `ChatPanel`, `MoveInsights`)

**Database Tables**: `profiles` (direct read — violation), `completed_games` (via M35)

**Realtime Channels**: none directly (engine owns channel)

**Cloudflare Endpoints**: none

**Dependencies**: M14/M15, M19, M22 (timer UI), M25, M31, M34, M35, M01, M02, M03, M05, sounds

**Consumers**: `/game/page.tsx`

**Published Events**: none (internal)

**Subscribed Events**: engine state-change callbacks, auth events, settings changes

**Allowed Dependencies**: engines, board, UI sub-components, hooks, M35
**Forbidden Dependencies**: direct DB writes (except documented), billing internals

**Extension Points**: new game modes (render differently); new board-page panels

**Known Risks**
- **GOD OBJECT** — 2478 lines, 44 state variables, 14 effects (see §7)
- Bot orchestration (online coordinator bot turns, offline opponent turns) is embedded and has produced repeated bugs
- Overlap with M18 (DuelGame) — significant duplicated logic
- Direct `profiles` fetch violates layering

**Current Violations**
- God object (SRP) — highest-priority refactor target
- Direct DB read of `profiles`
- Bot turn logic embedded in UI instead of M24/M14/M15

**Architecture Notes**: Decompose into hooks (game hooks, timer hook, bot orchestrator) + presentational shell. This is Phase 3+ #1 priority.

---

### §3.18 M18 — Duel Game Shell

**Purpose**: 1v1 duel component using the standalone M16 engine.

**Responsibilities**
- Instantiate DuelGameEngine
- Render board, top bar, timer, game-over
- Move handling + promotion
- Accuracy display with auto-fade
- Navigation guard during play

**What it OWNS**
- Duel component orchestration (20 `useState` + 6 `useRef`)

**What it does NOT own**
- Engine (M16)
- Room (M08)

**Inputs**: props (roomId, roomCode, playerId, team, timeLimit, onLeave)

**Outputs**: move submission, rendering, game-over UI

**Public API**: `DuelGame` component + props

**Internal Components**: `DuelGame.tsx` (634 lines) + shared board-page children

**Database Tables**: `profiles` (direct read for opponent avatar — violation)

**Realtime Channels**: none directly

**Cloudflare Endpoints**: none

**Dependencies**: M16, M19, M05, M22, sounds, M01/M02

**Consumers**: `/duel/page.tsx`

**Published Events**: none

**Subscribed Events**: engine callbacks

**Allowed Dependencies**: M16, board, UI children, hooks
**Forbidden Dependencies**: M14/M15 internals

**Extension Points**: duel variants

**Known Risks**
- Duplicates ~half of M17's orchestration (sounds, timer, board, nav guard)
- Direct `profiles` fetch (opponent)
- Different state pattern than M17 (20 separate useState vs aggregated object)

**Current Violations**
- Duplicate orchestration with M17 — no shared GameShell
- Direct DB read of `profiles`
- M16 engine in lib/ (inherited violation)

**Architecture Notes**: Merge into a shared GameShell with M17 (composition over duplication).

---

### §3.19 M19 — Chess Board

**Purpose**: Interactive chess board rendering + move input via cm-chessboard.

**Responsibilities**
- Render FEN position
- Orientation (white/black)
- Legal-move dots on input
- Move validation + UCI/SAN submission
- Promotion handling
- Last-move dots, highlight markers (winner/loser)
- Pending-move ghost overlays + teammate label
- Retraction animation

**What it OWNS**
- Board DOM/rendering state
- Move-input translation → UCI callback

**What it does NOT own**
- Move validation semantics (chess.js is used here but engine decides)
- Turn gating (M17/M18 pass `enabled`)

**Inputs**: FEN, enabled, orientation, lastMove, pendingOverlay, highlightSquares, callbacks

**Outputs**: `onMove(uci, promotion?)`

**Public API**: `ChessBoard`, `MobileChessBoard` components

**Internal Components**: same; `cm-chessboard` wrapper; overlay motion components

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: `cm-chessboard`, `chess.js`, framer-motion, M13 (overlay types)

**Consumers**: M17, M18, welcome page demo board

**Published Events**: `onMove` callback, `onAnimationComplete`

**Subscribed Events**: prop-driven (FEN changes)

**Allowed Dependencies**: chess libs, M13
**Forbidden Dependencies**: Supabase, engines

**Extension Points**: new markers, piece themes

**Known Risks**
- `MobileChessBoard` (Capacitor touch-optimized) duplicates the wrapper — drift risk with `ChessBoard`
- Direct `chess.js` instantiation inside for legal-move dots — duplicated validation vs engine

**Current Violations**
- Two board components with overlapping responsibility
- Uses `chess.js` internally for input validation while engine also validates — two sources of move validity

**Architecture Notes**: Clean presentation boundary. Consolidate the two board components.

---

### §3.20 M20 — Move Resolution

**Purpose**: Determine which of the two submitted moves plays, compute accuracy/comparison, apply to board.

**Current state**: **Cross-cutting, no single owner.** Implemented 3 ways.

| Path | Location | Behavior |
|------|----------|----------|
| Offline | `M14 resolvePendingMoves` / `resolveLegacy` | 2 player moves → M23 → MoveComparison |
| Online | `M15 resolvePendingMoves` (coordinator) | 2 player moves → M23 → broadcast `turn_resolved` |
| Duel | `M16 makeMove` | single move + inline accuracy (1v1, no comparison) |
| UI | `M17 checkAndResolve` / `handleResolutionComplete` | orchestrates engine resolution + bot continuation |

**What it SHOULD own**
- Winner selection from 2 scored moves
- `MoveComparison` construction (scores, accuracy, categories, sync detection)
- Move application to board
- (Online) resolution broadcast payload

**What it currently does NOT own**: a dedicated module — it lives inside engines + UI.

**Inputs**: 2 player UCI moves, turn FEN
**Outputs**: `MoveComparison`, winning move, applied board state, broadcast payload

**Published Events**: `turn_resolved` (M15), state-change callback

**Subscribed Events**: `player_locked` (both locked)

**Known Risks**
- **3 divergent implementations** — bug fixes must be applied in multiple places
- Coordinator-vs-client asymmetry: coordinator computes, others consume broadcast
- Bot continuation after resolution is UI-orchestrated (M17) — hard to test

**Current Violations**
- M20 has no home file; logic split across M14/M15/M17
- Duel (M16) has a *different* resolution model (no comparison, no coordinator)

**Architecture Notes**: Extract a `ResolutionService` (pure function: `(moveA, moveB, fen) → MoveComparison`) used by all engines. Phase 3+ priority.

---

### §3.21 M21 — Turn Management

**Purpose**: Drive the turn state machine and decide whose turn is next / when resolution fires.

**Current state**: **Cross-cutting.**

| Concern | Owner |
|---------|-------|
| Phase machine (SELECTING→LOCKED→RESOLVED) | M12 |
| "Both locked → resolve" trigger | M14/M15/M17 |
| Coordinator election | M15 |
| Next-turn advance + bot continuation | M17 (UI) |
| waitForTeammateLock / waitForTurnChange promises | M15 |

**What it OWNS**: nothing exclusively (shared)

**Published Events**: state-change callbacks, `turn_resolved`

**Subscribed Events**: `player_locked`, `player_move`, presence

**Known Risks**
- Turn-advance logic in UI (M17) — bot orchestration, `pendingOpponentTurnRef`, `initialBotTurnTriggeredRef`
- waitFor* promise patterns can hang if a broadcast is lost (no timeout in some paths; M17 added 30s recovery)

**Current Violations**
- Turn transitions split between engine and UI
- Bot turn continuation is UI state, not engine state

**Architecture Notes**: Consolidate into a `TurnManager` inside the engines; UI only renders.

---

### §3.22 M22 — Timer

**Purpose**: Match countdown, team timers, sync across clients.

**Current state**: **4 owners.**

| Owner | Role |
|-------|------|
| M12 `GameState` | stores `_matchTimeRemaining`, `_matchTimerActive` |
| M15 `OnlineGame` | `startMatchTimer`/`stopMatchTimer`, 15s `timer_sync` broadcast, local countdown |
| M17 `Game.tsx` | `tickMatchTimer` 1s interval, timeout detection/refs |
| M22 UI | `MatchTimer.tsx` (circular SVG), `TeamTimer.tsx`, `BoardTopBar` center timer |

**What it OWNS**: nothing exclusively (worst case of the split-state problem)

**Known Risks**
- Local countdown (1s) + 15s sync → clients can diverge up to 15s
- Timeout detection is coordinator-only (M15) but display ticks everywhere (M17)
- Duel (M16) has its own white/black timers — a 3rd model
- Move timer constant `DEFAULT_MOVE_TIMER_SECONDS = 10` appears unused in some paths

**Current Violations**
- Single logical timer, four implementers
- UI (M17) drives countdown for an engine-owned value (M12)

**Architecture Notes**: Single `TimerService` with authoritative source + tick events. Phase 3+ priority.

---

### §3.23 M23 — Stockfish Evaluation

**Purpose**: Chess move/position evaluation via Stockfish WASM in the browser.

**Responsibilities**
- UCI protocol over Web Worker (`/stockfish/stockfish.js`)
- MultiPV=6 evaluation
- `evaluateMoves` (searchmoves), `getBestScore`, `evaluateMove`, `evaluatePosition`, `playMove`
- Result caching (`evaluationCache`)
- Singleton lifecycle (`evaluatorFactory`)

**What it OWNS**
- The shared evaluator instance (one Web Worker per app)
- Evaluation result cache
- UCI parsing

**What it does NOT own**
- Which moves to evaluate (callers decide)
- Bot selection from scored moves (M24)
- Winner determination (M20)

**Inputs**: FEN, UCI moves, depth, ELO, retries
**Outputs**: `{ move, score }[]`, best score, best move, played move

**Public API**
- `evaluateMoves(moves, fen, depth?, elo?, retries?)`, `getBestScore`, `evaluatePosition`, `evaluateMove`, `playMove`, `waitForReady`, `isReady`, `getInitError`, `terminate`
- `createEvaluator()`, `getSharedEvaluator()`

**Internal Components**: `BrowserMoveEvaluator.ts`, `evaluatorFactory.ts`, `evaluationCache.ts`

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none (local WASM only — Render server is orphaned, see §7)

**Dependencies**: Stockfish WASM, M13 (cache)

**Consumers**: M14, M15, M16, M24, M17 (via engines)

**Published Events**: none (promise-based)

**Subscribed Events**: worker messages

**Allowed Dependencies**: stockfish, M13
**Forbidden Dependencies**: React, Supabase

**Extension Points**: alternative backends (server/remote) via evaluator factory — **currently unused**

**Known Risks**
- Eager init in `providers.tsx` — one worker always alive, no teardown on navigation
- MultiPV=6 in-browser is memory/CPU heavy on low-end Android
- Recent revert (2026-08-02) shows evaluation-depth/config changes have caused bot-strength regressions

**Current Violations**
- `SERVER_URL`/Render server path removed from engines but `server/` deployment still exists (orphaned infra)
- `getSharedEvaluator`/`terminate` lifecycle only used by Capacitor — no web teardown

**Architecture Notes**: Well-encapsulated. Watch performance and the orphaned server.

---

### §3.24 M24 — Bot AI

**Purpose**: Humanized chess bot moves across 6 difficulty tiers.

**Responsibilities**
- Difficulty config (ELO, depth, topMoves, noise, weights, blunder/weird chance, maxDrop)
- Move evaluation pipeline (`evaluateMovesWithFallback`)
- Humanization (`applyHumanizedSelection`: noise → guardrail → dominance → weird filter → blunder → softmax)
- Opening book
- Material-count fallback evaluation

**What it OWNS**
- Bot difficulty configuration
- Bot move-selection algorithm

**What it does NOT own**
- Stockfish evaluation (M23) — it calls it
- Turn orchestration (M21/M17)
- Room/team assignment (M08)

**Inputs**: FEN, skill level
**Outputs**: selected UCI/SAN move

**Public API**
- `createBot(config?)`, `selectMoveAsync(fen)`, `selectBestMove(fen)`, `selectMove(fen)`, `isStockfishReady`, `getEvaluator`, `getSkillDescription`, `setSkillLevel`
- `getBotConfig()`, `createBotConfig(opp, team)`, `getAvailableSkillLevels()`, `DIFFICULTY`, `DESCRIPTIONS`

**Internal Components**: `chessBot.ts`, `botConfig.ts`, `difficulty.ts`, `openings.ts`

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M23, M13

**Consumers**: M14 (teammate/opponent bots), M15 (coordinator-side bot), M17 (indirectly)

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: M23, M13
**Forbidden Dependencies**: React, Supabase, networking

**Extension Points**: new difficulty curves; new opening books

**Known Risks**
- Difficulty config volatility (MultiPV revert 2026-08-02 broke Master-level bot temporarily)
- Fallback material heuristic used when MultiPV misses moves — quality cliff at high levels
- Bot behavior embedded in M17's UI orchestration (bot turn continuation) — bot logic exists both in M24 and M17

**Current Violations**
- `evaluateMovesWithFallback` + `fallbackEvaluate` duplicate scoring logic conceptually owned by M23

**Architecture Notes**: Clean module; the danger is M17's UI-level bot orchestration bypassing it.

---

### §3.25 M25 — Move History & Playback

**Purpose**: Timeline scrubber, round history panel, replay navigation.

**Responsibilities**
- `MovePlayback` scrubber (back/forward, playback FEN)
- `RoundHistorySidebar` (past rounds list)
- Round accuracy history (`accuracyHistory`)
- Shadow-move display

**What it OWNS**
- Playback index/FEN state
- Round-history presentation

**What it does NOT own**
- Persistent completed-game history (M35)
- Engine move history source (M14/M15 `savedMoveHistory`/`moveHistory`)

**Inputs**: move history, comparisons, playback actions
**Outputs**: playback FEN, navigation

**Public API**: `MovePlayback`, `RoundHistorySidebar` components

**Internal Components**: same

**Database Tables**: none

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M13, framer-motion, M19 (board re-render at playback FEN)

**Consumers**: M17, M18, ReplayView (M35)

**Published Events**: `onBackMove`/`onForwardMove` (via BoardBottomNav props)

**Subscribed Events**: none

**Allowed Dependencies**: M13, framer-motion
**Forbidden Dependencies**: Supabase, engines

**Extension Points**: move-detail drilldown

**Known Risks**
- Playback state reset logic (auto-reset on game-end) embedded in M17's effects

**Current Violations**: none major

**Architecture Notes**: Presentation-only; keep it that way.

---

### §3.26 M26 — Game Persistence

**Purpose**: Save/load in-progress game state to the `games` table (for reconnect + replay).

**Responsibilities**
- Upsert game state keyed by `room_id`
- Append move-history entries (JSONB)
- Load state on reconnect
- Store FEN, current turn, status, timers

**What it OWNS**
- The `games` table (with M15 as its only real consumer + M35 for replay reads)

**What it does NOT own**
- Completed-game records (M35 `completed_games`)
- Move resolution (M20)

**Inputs**: room ID, FEN, turn, move entry, status, timers
**Outputs**: `GameSaveData | null`

**Public API**
- `saveGameState(roomId, fen, currentTurn, moveEntry, status, matchStartedAt?, matchTimeLimit?)`, `loadGameState(roomId)`

**Internal Components**: `gamePersistence.ts`

**Database Tables**: `games` (own)

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M27

**Consumers**: M15 (save on resolve, load on reconnect), M35 (replay reads)

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: M27
**Forbidden Dependencies**: React

**Extension Points**: snapshots, undo

**Known Risks**
- `games` table is **missing from the TypeScript `Database` type** (M27 finding) — untyped access
- "Allow all" RLS on `games` (see §7)
- Save-on-every-resolve can be chatty; no batching

**Current Violations**
- Untyped table access
- World-writable RLS

**Architecture Notes**: Small data layer. Fix typing + RLS.

---

### §3.27 M27 — Supabase Client

**Purpose**: Typed Supabase client singleton + database schema types.

**Responsibilities**
- Create browser client (`createBrowserClient<Database>`)
- Export `supabase` singleton
- Define `Database` type (8 tables typed; 2 missing)
- Export row types (`Profile`, `Room`, `RoomPlayer`, `Friendship`, `Message`, `ChallengeLink`)

**What it OWNS**
- The client singleton
- The TypeScript `Database` type

**What it does NOT own**
- Business logic (all in M08–M35)
- Auth (M01) — uses this client

**Inputs**: env vars
**Outputs**: client, types

**Public API**: `supabase`, `Database`, `Profile`, `Room`, `RoomPlayer`, `Friendship`, `Message`, `ChallengeLink`

**Internal Components**: `supabase.ts`

**Database Tables**: all (type-level)

**Realtime Channels**: none (provides channel API)

**Cloudflare Endpoints**: none

**Dependencies**: `@supabase/ssr`, `@supabase/supabase-js`

**Consumers**: every lib + engine module

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: Supabase SDK
**Forbidden Dependencies**: game engines

**Extension Points**: generated types (supabase gen types) — currently hand-written

**Known Risks**
- `games` + `duel_games` untyped → silent column errors
- Hand-maintained type drift vs `supabase/tables.sql`

**Current Violations**
- Missing 2 tables from `Database` type

**Architecture Notes**: Low-level infra. Regenerate types from `tables.sql`.

---

### §3.28 M28 — Realtime Layer

**Purpose**: Centralize Supabase Realtime channel lifecycle + provide channel helpers.

**Responsibilities**
- `subscriptionManager.register/remove/cleanup` for channel tracking
- Provide channel subscription patterns (used by M15, M16, M34, hooks)

**What it OWNS**
- The channel-tracking registry (`SubscriptionManager`)

**What it does NOT own**
- Specific channel event logic (M15/M16/M34 own their events)

**Inputs**: channels
**Outputs**: registered channels, cleanup

**Public API**: `subscriptionManager` (register/remove/cleanup/count)

**Internal Components**: `subscriptionManager.ts`

**Database Tables**: none

**Realtime Channels**: none (registry only)

**Cloudflare Endpoints**: none

**Dependencies**: `@supabase/supabase-js` (RealtimeChannel type)

**Consumers**: M15, M16, M34, `useBadgeCount` (M33), `messages.ts`

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: Supabase
**Forbidden Dependencies**: React

**Extension Points**: channel auto-reconnect registry; diagnostics

**Known Risks**
- Cleanup only happens on explicit `leaveRoom`/`destroy` — abrupt navigation relies on React effect cleanup
- Registry is inert — doesn't enforce lifecycle (no auto-unsubscribe on sign-out globally)

**Current Violations**
- `messages.ts` (M34) and `duelGame.ts` (M16) create channels directly instead of through a shared channel factory in M28
- No global sign-out cleanup

**Architecture Notes**: Extend into a real channel factory + lifecycle manager. Phase 3+ candidate.

---

### §3.29 M29 — API Infrastructure

**Purpose**: Edge/worker API plumbing: auth helper, rate limiting, health, crash log, account deletion.

**Responsibilities**
- `getAuthClient(request)` — Bearer-token or cookie auth resolution
- In-memory per-endpoint rate limiting
- Health check, crash ingestion, delete-account endpoints
- Server-client creation for API routes

**What it OWNS**
- API auth resolution
- Rate-limit buckets
- Infra endpoints

**What it does NOT own**
- Billing logic (M30), push logic (M32)

**Inputs**: HTTP requests
**Outputs**: responses, rate-limit headers

**Public API**
- `getAuthClient(request, route, requestId)`
- `rateLimit()` per-route config
- Routes: `/api/healthz`, `/api/log-crash`, `/api/delete-account`

**Internal Components**: `apiAuth.ts`, `rateLimit.ts`, route files

**Database Tables**: via RPC (`delete_my_account`), none for health/crash

**Realtime Channels**: none

**Cloudflare Endpoints**: the 3 routes

**Dependencies**: M27, Supabase SSR, `jose`

**Consumers**: M30, M32 routes reuse `getAuthClient`

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: M27, Supabase
**Forbidden Dependencies**: React

**Extension Points**: new guarded routes

**Known Risks**
- In-memory rate limiting is per-isolate — not global across Workers; bypassable at scale
- `delete_my_account` must keep RPC revocations in sync with schema

**Current Violations**: none major

**Architecture Notes**: Solid infra. Rate limiting is a soft limit only.

---

### §3.30 M30 — Premium Billing

**Purpose**: Provider-agnostic subscription billing, currently Creem (Merchant of Record).

**Responsibilities**
- `BillingProvider` interface + `SubscriptionService` facade
- Creem checkout creation, redirect (web + native), return bridge
- Verify-on-return immediate grant
- Webhook-driven lifecycle (grant/revoke/cancel/past-due)
- Subscription status cache (30s) + invalidation
- Restore purchases
- `profiles` subscription-field writes (is_premium, subscription_plan/status/expiry/provider, purchase_token, etc.)

**What it OWNS**
- All premium/subscription state on `profiles` (write path)
- The subscription status cache
- Creem integration (client + server)

**What it does NOT own**
- Insights counters (M31)
- UI presentation beyond premium page + gates

**Inputs**: purchase intent, webhook events, checkout session IDs
**Outputs**: `SubscriptionInfo`, purchase/restore results, profile upserts

**Public API**
- `SubscriptionService`: `initialize()`, `purchaseMonthly()`, `purchaseYearly()`, `restore()`, `isPremium()`, `getPlans()`, `getStatus()`, `invalidate()`, `setProvider()`
- API routes: `/api/creem/checkout`, `/products`, `/subscriptions`, `/verify-checkout`, `/webhook`, `/return`
- `/api/subscription/status`

**Internal Components**: `types.ts`, `SubscriptionStateMachine.ts`, `CreemBillingProvider.ts`, `SubscriptionService.ts`, `index.ts`, `__tests__/`

**Database Tables**: `profiles` (subscription fields — **shared row with M02, M30 is the writer**)

**Realtime Channels**: none

**Cloudflare Endpoints**: 7 routes

**Dependencies**: `creem`, `@creem_io/nextjs`, `@capacitor/browser`, M27, M29, M01

**Consumers**: M31 (InsightsGate), M02 (premium card), premium page, providers.tsx

**Published Events**: none (poll/refresh driven)

**Subscribed Events**: Creem webhooks

**Allowed Dependencies**: creem SDK, M27, M29, M01, Capacitor browser
**Forbidden Dependencies**: game engines

**Extension Points**: new providers (Apple IAP, Google Play) behind `BillingProvider`

**Known Risks**
- Webhook metadata sometimes empty → resolve via `checkouts.retrieve` (Bug 40) — complex fallback chain
- 30s status cache can serve stale premium; mitigated by `invalidate()` calls
- Native checkout return relies on deep-link/App-Link chain (fragile)
- Multiple lenient grant conditions (`active|completed|paid|trialing`) risk over-granting

**Current Violations**
- `insights.ts` (M31) reads `profiles.is_premium` directly instead of `SubscriptionService.isPremium()` (documented bug risk)
- Row-write ownership of `profiles` split between M02 (username/avatar) and M30 (subscription) — needs a defined partition (currently respected by convention)

**Architecture Notes**: The most mature module (many edge cases hardened). Preserve the provider abstraction.

---

### §3.31 M31 — Insights

**Purpose**: Premium-gated move insights with a free quota.

**Responsibilities**
- Free-reveal quota (`INSIGHTS_FREE_LIMIT = 3`) via localStorage counter
- Premium check (via M30, fallback direct `profiles` read — violation)
- `InsightsGate` UI (locked / reveal / exhausted states)
- `MoveInsights` rendering (heuristic analysis via `moveClassifier`)
- Move classification (SAN heuristic: castle, check, capture, development, etc.)

**What it OWNS**
- The reveal-quota counter (`chessduo_insights_{userId}`)
- Gate UI state
- `moveClassifier` heuristics

**What it does NOT own**
- Subscription state (M30)
- Accuracy computation (M13/M20)

**Inputs**: player ID, comparison data
**Outputs**: reveal state, insights content

**Public API**
- `getUserInsightsState(userId)`, `incrementInsightsReveals(userId)`, `isUserPremium()`
- `classifyMove(san)` (moveClassifier)
- Components: `InsightsGate`, `MoveInsights`, `MoveComparison` (presentation)

**Internal Components**: `insights.ts`, `moveClassifier.ts`, `InsightsGate.tsx`, `MoveComparison.tsx`

**Database Tables**: `profiles` (read `is_premium` — violation path)

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M13 (limits), M30 (premium), M27

**Consumers**: M17 (insights slide-over), premium page, MoveComparison

**Published Events**: `onStateChange` (gate state), `onUpgradeClick`

**Subscribed Events**: none

**Allowed Dependencies**: M13, M30, M27
**Forbidden Dependencies**: game engines

**Extension Points**: new insight types

**Known Risks**
- Free-quota is localStorage-only — resets across devices; server field `profiles.insights_reveals_used` exists but is unused client-side
- Gate logic duplicated (InsightsGate vs premium page)

**Current Violations**
- Direct `profiles.is_premium` read bypassing M30
- `profiles.insights_reveals_used` column exists but is never written by this module (localStorage only) — schema field unused

**Architecture Notes**: Tightly scoped; fix the M30 read path + decide quota source of truth.

---

### §3.32 M32 — Push Notifications

**Purpose**: Register devices and send notifications across web (Web Push/VAPID) and native (FCM).

**Responsibilities**
- Register device tokens (`android`/`ios`/`web`) via `/api/push/register`
- Send via `/api/push/send` (FCM HTTP v1 with JWT via jose; web-push with VAPID)
- Service worker (`sw.js`) push + notificationclick routing
- Capacitor push listener setup (post-`register()` to avoid bridge races)
- Opt-out flag (`chessduo_push_disabled`)
- Deep-link navigation on tap (with M07)
- Token cleanup on invalid delivery

**What it OWNS**
- `push_tokens` table
- VAPID/FCM credential usage
- Notification opt-out flag
- Service worker

**What it does NOT own**
- When to send (M33/M34/M17 call `notify*`)
- Deep-link URL construction (M07)

**Inputs**: auth token, device, notification intent
**Outputs**: registered tokens, sent notifications, deep-link navigations

**Public API**
- `initPushNotifications(token)`, `notifyFriendRequest()`, `notifyChatMessage()`, `notifyGameInvite()`, `notifyInviteAccepted()`
- `registerDeviceToken()`, `sendPushNotification()`, `setCachedAccessToken()`, `clearCachedAccessToken()`, `resetPushState()`
- Routes: `/api/push/register`, `/api/push/send`

**Internal Components**: `types.ts`, `PushNotificationService.ts`, `index.ts`, `public/sw.js`, `src/lib/webPush.ts`

**Database Tables**: `push_tokens`

**Realtime Channels**: none

**Cloudflare Endpoints**: 2 routes

**Dependencies**: `web-push`, `jose`, `@capacitor/push-notifications`, M27, M29, M01, M07

**Consumers**: providers.tsx, M33 (friends), M34 (chat), M17 (game invite), SettingsPanel (opt-out)

**Published Events**: notification taps → deep-link navigation

**Subscribed Events**: auth events, service worker events

**Allowed Dependencies**: web-push, jose, Capacitor, M27, M29, M01, M07
**Forbidden Dependencies**: game engines

**Extension Points**: new notification types (add to `NotificationType` + sw.js routing + notify*)

**Known Risks**
- Native bridge race history (crashes) — listener ordering is critical and hard-won
- `chessduo://` custom scheme not clickable in chat apps → App Links dependency (Bug 37)
- Web push requires VAPID; native requires FCM — dual-credential ops burden
- Token registry can grow; cleanup only on failed sends + account deletion

**Current Violations**: none major (this module is well-hardened)

**Architecture Notes**: Mature module. Keep listener ordering and App-Link routing intact.

---

### §3.33 M33 — Friends

**Purpose**: Social graph: requests, accept/reject, block/unblock, search, badges.

**Responsibilities**
- Friend request lifecycle (send/accept/reject/cancel)
- Block/unblock
- Friendship list + pending requests (incoming/outgoing)
- User search (username ilike / ID match)
- Badge count (`useBadgeCount`: unread messages + pending requests via Realtime)
- Friend stats (from completed_games)

**What it OWNS**
- `friendships` table
- Badge count logic

**What it does NOT own**
- Chat content (M34) — opens it
- Profile data (M02) — reads for display

**Inputs**: user ID, friend ID, query
**Outputs**: friendship rows, lists, counts

**Public API**
- `sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`, `cancelFriendRequest`, `deleteFriendship`, `blockUser`, `unblockUser`, `getFriendsList`, `getPendingRequests`, `getBlockedUsers`, `searchUsers`, `isFriend`, `getInviteLink`, `getProfileLink`, `getFriendStats`
- Hook: `useBadgeCount`

**Internal Components**: `friends.ts`, `FriendsPanel.tsx`, `friends/page.tsx`, `useBadgeCount.ts`

**Database Tables**: `friendships` (own), `profiles` (read), `completed_games` (stats)

**Realtime Channels**: `postgres_changes` on `messages` + `friend_requests` (badge) — note `friend_requests` is not a table; badge subscribes to `friendships`-adjacent changes

**Cloudflare Endpoints**: none

**Dependencies**: M27, M32 (notify on request), M34 (chat open)

**Consumers**: friends page, home badge, M17 chat

**Published Events**: friend-request notification (via M32)

**Subscribed Events**: Realtime for badges

**Allowed Dependencies**: M27, M32, M34
**Forbidden Dependencies**: game engines

**Extension Points**: friend groups, presence

**Known Risks**
- `useBadgeCount` subscribes to `friend_requests` table which doesn't exist in schema (`friendships.status='pending'` is the real model) — possible subscription mismatch (needs verification)
- Direct data access in `FriendsPanel` (no service layer beyond friends.ts)

**Current Violations**
- Badge subscribes to a non-existent `friend_requests` table name (M27 type mismatch — verify actual code)
- `FriendsPanel` mixes list + requests + chat + search — large component (M34 overlap)

**Architecture Notes**: Functionally complete. Verify the Realtime subscription target; consider splitting FriendsPanel.

---

### §3.34 M34 — Chat & Messages

**Purpose**: Real-time 1:1 messaging + challenge DMs.

**Responsibilities**
- Send/read messages (`messages` table, `message_type` chat/challenge)
- Conversation fetch (bidirectional)
- Mark-as-read + unread counts
- Real-time `new_message` broadcast on `messages:{userId}` channel
- Challenge messages + accept flow (with M07)

**What it OWNS**
- `messages` table
- The `messages:{userId}` channel
- Unread-count state

**What it does NOT own**
- Push sending (M32) — it triggers `notifyChatMessage`
- Friends list (M33)

**Inputs**: sender/receiver IDs, content
**Outputs**: messages, unread counts, broadcasts

**Public API**
- `sendMessage`, `getConversation`, `markMessagesAsRead`, `getUnreadCounts`, `getUnreadChallenges`, `markChallengeAsRead`, `subscribeToMessages`

**Internal Components**: `messages.ts`, `ChatPanel.tsx`

**Database Tables**: `messages`

**Realtime Channels**: `messages:{userId}` (broadcast `new_message`)

**Cloudflare Endpoints**: none

**Dependencies**: M27, M32 (notify), M33 (recipient identity)

**Consumers**: ChatPanel, FriendsPanel, `useBadgeCount` (M33), M17 (in-game chat)

**Published Events**: `new_message` broadcast; chat push notification

**Subscribed Events**: `new_message` broadcast

**Allowed Dependencies**: M27, M32, M33
**Forbidden Dependencies**: game engines

**Extension Points**: group chat, typing indicators

**Known Risks**
- `message_type` column exists in schema but not in the TS `Database` type (M27 finding)
- Channel created directly in `messages.ts` (bypasses M28 factory)
- No rate limit on client-side sends beyond API defaults

**Current Violations**
- Untyped `message_type` column
- Direct channel creation without M28

**Architecture Notes**: Clean data layer; fold channel creation into M28.

---

### §3.35 M35 — Match History & Replay

**Purpose**: Completed-game records, per-player stats, and replay reconstruction.

**Responsibilities**
- Save completed games (localStorage primary + `completed_games` best-effort)
- List history (localStorage, up to 50)
- Aggregate player stats
- Replay viewer (`/replay/[gameId]`) — reconstruct from FEN + move history
- Game-over persistence trigger (from M17)

**What it OWNS**
- `completed_games` table (write + read)
- `chessduo_history_{userId}` localStorage
- Replay page

**What it does NOT own**
- In-progress game state (M26 `games`)
- Accuracy computation (M13/M20) — stored comparison snapshots used

**Inputs**: `MatchSummaryData`, user ID
**Outputs**: `CompletedGame[]`, stats, replay

**Public API**
- `saveCompletedGame(data, userId?)`, `getMatchHistory(limit?, userId?)`, `getCompletedGame(gameId, userId?)`, `getPlayerStats(userId?)`

**Internal Components**: `matchHistory.ts`, `HistoryPanel.tsx`, `history/page.tsx`, `replay/[gameId]/page.tsx`, `ReplayView`

**Database Tables**: `completed_games` (own), `games` (replay reads)

**Realtime Channels**: none

**Cloudflare Endpoints**: none

**Dependencies**: M27, M13

**Consumers**: M17 (game-over save), history page, profile page (stats), replay page

**Published Events**: none

**Subscribed Events**: none

**Allowed Dependencies**: M27, M13
**Forbidden Dependencies**: game engines

**Extension Points**: cloud history sync, ELO tracking

**Known Risks**
- localStorage primary + DB backup → no reconciliation; cross-device history missing
- Replay requires `games` rows (typed gap) or localStorage history; DB-backed replay only for online games
- `move_comparisons` JSONB can bloat

**Current Violations**
- Dual-writer/no-reconciliation between localStorage and `completed_games`
- Replay reads `games` (untyped)

**Architecture Notes**: Decide a single source of truth for history (DB) in Phase 3+.

---

## 4. STATE OWNERSHIP MAP

> Single Source of Truth (SSOT) = the one authoritative owner. **Problems** column lists current deviations.

### 4.1 Identity & Account State

| State | Owner | Readers | Writers | Persistence | Realtime Source | SSOT | Current Problems |
|-------|-------|---------|---------|-------------|-----------------|------|------------------|
| Auth session | M01 | all modules | M01 (Supabase) | Supabase Auth (cookie/Bearer) | auth events | ✅ | 3-way Google path |
| Access token (push) | M01 | M32 | M01 | in-memory cache | TOKEN_REFRESHED | ✅ | cache vs cookie duplication |
| Profile row | M02 | M02, M17, M18, M33 | M02 (identity) + M30 (subscription) | `profiles` | none | ⚠ split writer | two writers on one row |
| Username/avatar | M02 | all | M02 | `profiles` | none | ✅ | direct reads in components |
| Premium status | M30 | M02, M31, premium page | M30 | `profiles.is_premium` + cache | webhook/verify | ⚠ | M31 reads directly; 30s cache staleness |
| Settings | M03 | M17, M18, layout | M03 | localStorage | none | ✅ | no server sync (doc mismatch) |
| Push opt-out | M32 | M32, SettingsPanel | M32 | localStorage | none | ✅ | — |
| Insights quota | M31 | M31 | M31 | localStorage | none | ⚠ | `profiles.insights_reveals_used` unused |

### 4.2 Room & Game State

| State | Owner | Readers | Writers | Persistence | Realtime Source | SSOT | Current Problems |
|-------|-------|---------|---------|-------------|-----------------|------|------------------|
| Room row | M08 | M07, M09, M15, M16, lobby | M08 | `rooms` | presence (via M15) | ✅ | 3 creation paths; 2 expiry constants |
| Room players | M08 | M07, M09, M10, M15 | M08 | `room_players` | presence (via M15) | ✅ | Allow-all RLS |
| Lobby/seat state | M10 | M10 UI | M10 | `room_players` | presence | ✅ | handoff to M15 implicit |
| Game status | M14/M15 | M17 | M14/M15 | `games` (via M26) | broadcast | ⚠ | per-engine statuses diverge (GameStatus vs DuelGame status) |
| Current turn | M12 | M14, M15, M17 | M12 via engines | `games.current_turn` | `turn_resolved` | ✅ | sync on reconnect |
| Board position | M12 | M14, M15, M17, M19 | M12 via engines | `games.fen` | `turn_resolved` | ⚠ | UI aggregates `fen` separately; dual source |
| Submitted moves | M12 | M14, M15, M17 | M12 via engines | none (transient) | `player_move` | ✅ | — |
| Locked moves | M12 | M14, M15, M17 | M12 via engines | none | `player_locked` | ✅ | broadcast order risk |
| Resolved move | M20 | M17, M25, M31 | M20 | `games.move_history` | `turn_resolved` | ❌ no owner | 3 implementations |
| Move comparison | M20 | M17, M25, M31 | M20 | `completed_games.move_comparisons` | `turn_resolved` payload | ❌ no owner | built per-engine |
| Match timer | M22 | M17, BoardTopBar, MatchTimer | M15 (sync) / M17 (tick) | `games.match_*` (partial) | `timer_sync` | ❌ 4 owners | drift up to 15s |
| Team/color | M08 (room) / M12 (engine) | M17, BoardTopBar | M08, M14 | `rooms.host_team`, engine | presence | ✅ | — |
| Stats (sync rate, accuracy) | M14/M15 | M17, M31, M35 | M14/M15 | `completed_games` | none | ⚠ | per-engine stats objects differ |

### 4.3 Social & Delivery State

| State | Owner | Readers | Writers | Persistence | Realtime Source | SSOT | Current Problems |
|-------|-------|---------|---------|-------------|-----------------|------|------------------|
| Friendships | M33 | M33, M34 | M33 | `friendships` | badge Realtime | ✅ | badge table-name mismatch |
| Messages | M34 | M34, M33 | M34 | `messages` | `messages:{userId}` | ✅ | untyped `message_type` |
| Unread counts | M34/M33 | M34, M33 badge | M34/M33 | none (derived) | Realtime | ⚠ | two hooks/readers |
| Push tokens | M32 | M32 | M32 | `push_tokens` | none | ✅ | registry growth |
| Match history | M35 | M35, M02 stats | M35 | localStorage + `completed_games` | none | ⚠ dual storage | no reconciliation |
| Challenge links | M07 | M07, M15/M16 | M07 | `challenge_links` | none | ✅ | — |
| Game persistence | M26 | M15, M35 | M26 | `games` | none | ✅ | Allow-all RLS, untyped |

---

## 5. MODULE COMMUNICATION

### 5.1 Communication Mechanisms in use

| Mechanism | Producer(s) | Consumer(s) | Direction | Coupling | Risk |
|-----------|-------------|-------------|-----------|----------|------|
| React props | M17/M18 → children (BoardTopBar, ChessBoard, modals) | UI children | down | tight (component contract) | medium |
| `useState`/`useRef` | M17/M18 internal | M17/M18 | internal | high (44 vars) | high |
| Callback (`setOnStateChange`) | M14/M15/M16 → M17/M18 | M17/M18 | up (engine→UI) | medium | order/staleness |
| `GameInterface` method calls | M17 → M14/M15 | engines | down | interface-bound | low (by design) |
| Supabase Broadcast | M15/M16/M34 → peers | peers | peer (P2P via channel) | low | **ordering not guaranteed** |
| Supabase Presence | M15/M16 → all | all | peer | low | join/leave races |
| `postgres_changes` Realtime | DB → M33 badge | M33 | external→client | medium | table-name mismatch |
| Auth event stream | M01 → M30, M32, M02 | all | down | medium | timing (init on SIGNED_IN) |
| localStorage | M03/M31/M32/M35 → self | same module (and useSettings consumers) | shared | low | multi-key, no schema |
| Direct DB calls | components (M17/M18), M31 | Supabase | down (UI→DB) | **violation** | RLS-dependent |
| HTTP API | M17/M32/M30 → /api/* | Cloudflare routes | client→edge | medium | base-URL bugs (Bug 36) |
| Webhook | Creem → /api/creem/webhook | M30 | external→edge | low | metadata gaps (Bug 40) |
| Service worker | sw.js ↔ M32 | M32, browser | bidirectional | medium | SW registration timing |

### 5.2 Highest-Risk Communication Paths

| Path | Producer | Consumer | Risk | Notes |
|------|----------|----------|------|-------|
| Broadcast `turn_resolved` | M15 coordinator | M17 (all clients) | **HIGH** | ordering vs `player_locked`; dropped if status guard (Bug 2026-08-03) |
| Engine → UI callback | M14/M15/M16 | M17/M18 | **HIGH** | stale closure risk; refs needed |
| UI → DB (`profiles`) | M17/M18 | Supabase | **HIGH** | bypasses service layer; layering violation |
| Timer sync | M15 | M17/BoardTopBar | **MEDIUM** | 15s sync vs 1s tick drift |
| `waitForTeammateLock` promise | M15 | M17 | **MEDIUM** | hang risk if broadcast lost; 30s recovery in M17 |
| Creem webhook → profiles | Creem | M30 | **MEDIUM** | empty-metadata fallback chain (Bug 40) |
| Badge Realtime | DB | M33 | **LOW** | `friend_requests` table-name mismatch |

---

## 6. MODULE BOUNDARIES

### 6.1 Canonical Boundary Rule Set

#### Move Resolution (M20 — target)
May
- ✔ receive submitted moves (from M14/M15)
- ✔ call Stockfish (M23)
- ✔ publish a resolved move + comparison

Must NOT
- ✘ update Premium (M30)
- ✘ navigate screens (M04/M05)
- ✘ update Friends (M33)
- ✘ modify Profile (M02)

#### Game Shell (M17/M18)
May
- ✔ instantiate engines
- ✔ render board/nav/modals
- ✔ call `GameInterface` methods
- ✔ save completed game (via M35)
- ✔ trigger sounds/toasts

Must NOT
- ✘ evaluate moves directly (M23 owns)
- ✘ write `profiles` directly (use M02/M30)
- ✘ create channels (M15/M28 own)
- ✘ decide bot moves (M24 owns)

#### Game Engines (M14/M15/M16)
May
- ✔ manage turn lifecycle + resolution
- ✔ own the Realtime channel
- ✔ persist game state (via M26)

Must NOT
- ✘ render anything
- ✘ read/write `profiles`
- ✘ call billing (M30)
- ✘ import React

#### Billing (M30)
May
- ✔ own `profiles` subscription columns
- ✔ create checkouts, handle webhooks

Must NOT
- ✘ touch game state
- ✘ read `games`/`rooms` state
- ✘ decide game outcomes

#### Premium Gate (M31)
May
- ✔ read premium via M30 only
- ✔ track reveal quota

Must NOT
- ✘ write `profiles`
- ✘ call Creem directly

#### Realtime (M28)
May
- ✔ own channel factory + lifecycle registry

Must NOT
- ✘ contain business event handlers (M15/M16/M34 own those)

### 6.2 Boundary Violations Currently Present

| Boundary | Violation |
|----------|-----------|
| UI → DB | M17/M18 fetch `profiles` directly |
| Data layer → engine | M16 engine lives in `lib/` |
| Realtime factory | M16/M34 create channels directly, bypassing M28 |
| M31 → M30 | InsightsGate/premium reads bypass `SubscriptionService` in `insights.ts` |
| M13 constants | `ROOM_EXPIRY_MS` redefined in `matchmaking.ts` |
| M08 single-path | 3 room-creation implementations |
| Engine/UI bot split | M17 owns bot turn continuation; M24 owns selection |

---

## 7. DEPENDENCY ANALYSIS

### 7.1 Duplicate Responsibilities

| Responsibility | Duplicated In | Severity |
|----------------|---------------|----------|
| Move resolution | M14, M15, M17 (3 impls) | HIGH |
| Timer tick/sync | M12, M15, M17, M22 | HIGH |
| Turn advancement | M15, M17 | HIGH |
| Board/move validation | M19 (chess.js for dots), M12 (engine) | MEDIUM |
| Game-shell orchestration | M17, M18 | HIGH |
| Room creation | `createOnlineRoom`, `createQuickMatchRoom`, `createFourPlayerRoom` | MEDIUM |
| Profiling reads | M02, M17, M18, M33 | MEDIUM |
| Bot orchestration | M24 (selection) + M17 (turn continuation) | MEDIUM |
| Sound detection | M17, M18 | MEDIUM |
| Accuracy/comparison building | M14, M15 | HIGH |

### 7.2 Multiple Owners (state)

- Match timer: M12 + M15 + M17 + M22
- Board position aggregation: M12 + M17
- Game status: M14/M15 (per-engine) + M16 (different enum)
- Stats object: M14 (`GameStats`), M15 (`stats` shape differs)
- Room expiry: M08 (24h constant) vs M09 (60s constant)
- Premium read: M30 (service) vs M31/M17 (direct)

### 7.3 Hidden Dependencies

- `providers.tsx` pre-warms evaluator (M23) — game pages depend on it implicitly
- M15 coordinator election relies on **alphabetical player-ID order** — implicit contract
- M07 challenge pre-created rooms depend on M08 `host_team` + `get_room_join_state` RPC (RLS contract)
- M32 deep-link routing depends on `public/.well-known/` files being deployed in sync
- M17 game-over save depends on M35 localStorage being present; DB save best-effort silent
- `useBadgeCount` (M33) depends on specific Realtime table names matching schema

### 7.4 Circular Dependencies

**None detected at the import graph level.** The layering (`features → lib → hooks → components → app`) is acyclic.

**Logical (non-import) cycles exist:**
- M15 (OnlineGame) ↔ M17 (Game.tsx): engine broadcasts → UI reacts → UI calls engine. A control-flow cycle managed via callbacks.
- M30 ↔ M02: SubscriptionService writes `profiles`; ProfilePanel reads it. Two modules, one row.
- M33 ↔ M34: FriendsPanel opens ChatPanel; messages broadcast drives badges in FriendsPanel.

### 7.5 God Objects / Over-responsible Modules

| Module | Size / Complexity | Concern |
|--------|-------------------|---------|
| **M17 Game.tsx** | 2478 lines, 28 useState + 16 useRef + 14 useEffect | Orchestration god-object; #1 refactor target |
| **M15 OnlineGame** | 1679 lines, 60+ methods/properties | Networking + resolution + timer + reconnect all-in-one |
| **M01 Auth.tsx** | UI + session state machine | Mixes presentation and logic |
| **home page.tsx** | marketing + session + room auto-join + matchmaking triggers | Multi-concern page |
| **FriendsPanel** | list + requests + search + chat overlay | Multi-concern component |

### 7.6 Modules That Should Eventually Be Split

| Module | Suggested Split (NOT performed) |
|--------|----------------------------------|
| M17 Game.tsx | `useGameEngine`, `useBotOrchestrator`, `useMatchTimer`, `useSoundEffects`, `useGameOverPersistence`, `GameShell` |
| M15 OnlineGame | `ChannelManager`, `PresenceManager`, `CoordinatorResolution`, `TimerSync`, `ReconnectPolicy` |
| M01 Auth.tsx | `useAuth` hook + `AuthForm` + `SocialLoginButton` |
| M08 roomActions | `RoomCreator` (online), `MatchmakingRooms`, `FourPlayerRooms` |
| M16 duelGame.ts | move to `features/duel/`; split engine vs sync |
| M28 subscriptionManager | `ChannelFactory` + `ChannelRegistry` |

---

## 8. ASSESSMENT & CONCLUSION

### 8.1 Architecture Maturity Score: **52 / 100**

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Layer separation | 60 | features/ framework-free ✅; lib/ mixes engines + data + utils |
| Interface contracts | 75 | GameInterface strong ✅; M16 (Duel) has no shared contract ❌ |
| Single ownership | 35 | Timer, resolution, board, status all split (see §4) |
| Dependency direction | 65 | Generally acyclic; UI→DB violations exist |
| Testability | 40 | Co-located tests ✅; Game.tsx (god object) untested, engines tested |
| Event-driven design | 55 | Coordinator pattern good; broadcast-order assumption fragile |
| Error handling | 50 | Toast + documented catch blocks ✅; no structured logging |
| Configuration management | 70 | Env vars defined; settings localStorage-only (doc mismatch) |
| Documentation | 65 | 30 CONTEXT.md ✅; several stale vs code (proxy.ts, settings sync, table names) |
| Modularity | 40 | God objects (M17/M15); duplicate resolution/timer; M16 island |

### 8.2 Top 10 Architectural Risks

1. **`Game.tsx` god object** (M17) — 2478 lines, 44 state vars; every change risks regressions; untested.
2. **Split state ownership — timer/resolution/status** (M22/M20/M12) — same logical state mutated in 2–4 places; guaranteed drift.
3. **Broadcast ordering assumption** (M15) — `turn_resolved` vs `player_locked` ordering not guaranteed by Supabase; caused recent bug.
4. **DuelGame architecture island** (M16/M18) — divergent engine, realtime model, and component pattern from the 2v2 path.
5. **UI → DB direct access** (M17/M18/M31) — bypasses service layer; RLS-dependent correctness.
6. **"Allow all" RLS** on `room_players` + `games` — world-readable/writable game data.
7. **Dual storage w/o reconciliation** (M35 localStorage + DB; M31 quota) — cross-device loss.
8. **Missing DB types** (`games`, `duel_games`, `message_type`) — silent runtime errors.
9. **Duplicate constants** (`ROOM_EXPIRY_MS` 24h vs 60s) — behavioral ambiguity in room lifecycle.
10. **Orphaned Stockfish server** (Render) — deployed but unused; ops cost + confusion.

### 8.3 Highest-Priority Modules for Future Refactoring

1. **M17 — 2v2 Game Shell** (God object; highest ROI) — decompose into hooks + presentational shell.
2. **M15 — OnlineGame** (complexity + broadcast fragility) — extract ChannelManager, TimerSync, CoordinatorResolution.
3. **M20 — Move Resolution** — extract single `ResolutionService` shared by M14/M15; delete duplicates.
4. **M16/M18 — Duel path** — unify engine family (move out of `lib/`) + shared GameShell with M17.
5. **M22 — Timer** — single authoritative TimerService with tick events.
6. **M08/M09 — Room/Matchmaking** — consolidate room-creation paths + expiry constants.
7. **M31 → M30 — Insights read path** — route all premium reads through SubscriptionService.
8. **M27 — Supabase types** — regenerate full schema types; fix RLS on `games`/`room_players`.

---

### Phase 2 Complete

This document is **documentation only**. No implementation was modified.

**Every future bug fix, feature, and refactoring should map to a module above** (M01–M35). When a bug is reported: locate the module, read its Known Risks / Current Violations / Boundaries, and act within its ownership.

**Waiting for Phase 3.**
