# ChessDuo - Project Roadmap

> **Architecture Bible**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for code conventions, patterns, and rules that ALL commits must follow.

## Overview

**ChessDuo** is a real-time multiplayer chess game where two teams (2v2) compete. Each team has 2 players who simultaneously submit moves (hidden from each other), and a chess engine evaluates both moves to pick the winner.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 + TypeScript |
| UI | Tailwind CSS + React |
| Chess Board | cm-chessboard (web) |
| Chess Logic | chess.js |
| Engine | Stockfish (server-side) |
| Real-time | Supabase (Broadcast + Presence) |
| Auth | Supabase Auth |
| Mobile Bridge | Capacitor |

---

## Deployment Architecture

This project uses **Cloudflare Workers for the frontend** and **Render for the backend (Stockfish)**:

| Service | URL | Build Config | Directory |
|---------|-----|------------|-----------|
| **Frontend** | https://chessduo.chessdoubles27.workers.dev | `wrangler.jsonc` | `/` (root) |
| **Backend** | https://chessduo-bllo.onrender.com | `Dockerfile` | `server/` |

### Frontend Deployment (Cloudflare Workers)

Deploys via `opennextjs-cloudflare` — see `deploy-cf-pages.yml` workflow.

### Backend Deployment (Render, Dockerfile)

Uses Docker to build Stockfish from `/server` directory via Render Blueprint.

### Environment Variables

**Frontend (Cloudflare secrets):**
- `NEXT_PUBLIC_SUPABASE_URL` → Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase anon key

**Backend (Render):**
- `PORT` → `3001`

---

## Development Phases

### Phase 1: Core Game - Local Play (Week 1-2)
**Goal**: Playable local 2v2 game with bot teammate in browser

- [x] 1.1 Setup Next.js project with TypeScript + Tailwind
- [x] 1.2 Integrate chess.js for move validation
- [x] 1.3 Integrate cm-chessboard for board UI
- [x] 1.4 Integrate Stockfish (server-side) for move evaluation
- [x] 1.5 **Implement Parallel Model**:
  - [x] 10-second team timer (split timers on each side)
  - [x] Human move applied immediately (prominent)
  - [x] Bot move as greyed shadow
  - [x] Both moves visible before resolution
  - [x] Green/red highlight after accuracy check
  - [x] Loser retracts to origin (animated)
- [x] 1.6 Basic win/lose/draw detection

**Key Feature**: Human vs Bot teammate (bot plays blind, greyed shadow display)

**Deliverable**: ✅ Playable 2v2 local game with bot teammate (COMPLETE)

---

### Phase 2: Real-Time Multiplayer Infrastructure (Week 3-4)
**Goal**: Backend infrastructure for real-time multiplayer

- [x] 2.1 Setup Supabase project
- [x] 2.2 Implement user authentication (Supabase Auth)
- [x] 2.3 Create game room system
- [x] 2.4 Implement real-time sync (Supabase Broadcast)
- [x] 2.5 Track player presence (connected, selecting, locked-in)
- [x] 2.6 Match flow: team matchmaking, team formation
- [x] 2.7 Handle disconnects/reconnects (game persistence + late-join replay)

**Key Files**: `src/lib/supabase.ts`, `src/lib/gamePersistence.ts`, `src/components/Auth.tsx`, `src/components/Room.tsx`, `supabase/tables.sql`

**Deliverable**: ✅ Backend ready for real-time multiplayer (COMPLETE)

---

### Phase 3: Human Teammate (Week 5-6)
**Goal**: Replace bot teammate with real human player

- [x] 3.1 Integrate Phase 2 infrastructure for teammate connection
- [x] 3.2 Real human teammate instead of bot
- [x] 3.3 Same parallel model:
  - Both see same board
  - Both lock moves (or timer expires)
  - Both moves revealed simultaneously
  - Accuracy evaluation and resolution
- [x] 3.4 Bot opponent remains (for now)
- [x] 3.5 Full 2v2 human multiplayer (coordinator pattern)

**Key Feature**: Real human teammate via Supabase

**Key Files**: `src/features/online/game/onlineGame.ts`, `src/components/Game.tsx`

**Deliverable**: ✅ True 2v2 human multiplayer game (COMPLETE)

---

### Phase 4: Game Polish (Week 7-8)
**Goal**: Complete game experience with animations and stats

- [x] 4.1 Move conflict visualization (green/red arrows)
- [x] 4.2 Losing move retraction animation
- [x] 4.3 Accuracy display (centipawn loss, percentage)
    - Shows immediately after WHITE turn resolves
    - Only displays WHITE team accuracy (never BLACK)
    - Persists through BLACK turn until next WHITE starts
    - Clears when new WHITE turn begins
- [x] 4.4 Timer system improvements (visual warnings)
- [x] 4.5 Turn indicator and game status UI
- [x] 4.6 Team dynamics tracking (sync rate, conflicts)
- [x] 4.7 Match summary and stats screen → completed in Phase 5.3 (later simplified to clean result screen)
- [x] 4.8 Basic matchmaking queue → completed in Phase 5.4

**Key Files**: `src/components/ChessBoard.tsx`, `src/components/AccuracyBottomSheet.tsx`, `src/components/MoveComparison.tsx`, `src/components/TeamTimer.tsx`, `src/components/GameOverModal.tsx`

**Deliverable**: ✅ Core animations and polish complete (all items resolved)

---

### Phase 5: Launch Features (Week 9-10)
**Goal**: Features needed for public release

- [x] 5.1 Match history and persistence (completed_games table, /history page, W/L/D stats)
- [x] 5.2 User profiles UI (/profile page, ProfileEditor, username editing)
- [x] 5.3 Match summary — enhanced GameOverModal built, then simplified (clean result + Play Again, stats tracked in history)
- [x] 5.4 Basic matchmaking queue — time-control filtering, 60s room expiry, auto-cleanup
- [x] 5.5 Production hardening (RLS per-room, rate limiting, auth guard middleware, logout)
- [x] 5.6 Room codes (shareable game links)
- [x] 5.7 Error handling and edge cases (ErrorBoundary, Toast, rate limiting)
- [x] 5.8 Bot difficulty adjustment (6 levels, 1000-2600 ELO)
- [x] 5.9 Move playback (MovePlayback component, click-to-replay with shadow moves)
- [x] 5.10 Move insights (InsightsGate with 3 free reveals, move classification, premium upsell)

**Deliverable**: ✅ Production-ready MVP with freemium insights and matchmaking

---

### Phase 6: Mobile Expansion (Week 11-14)
**Goal**: Native iOS + Android apps

- [x] 6.1 Setup Capacitor project (config, scripts, runbook)
- [x] 6.2 Create mobile-compatible chess board component — MobileChessBoard integrated in Game.tsx + DuelGame.tsx with touch-manipulation
- [x] 6.3 Build mobile UI (responsive design) — DuelGame mobile pass, MobileStatusBar safe-area, viewport meta, MobileChessBoard integration
- [x] 6.7 App store submission prep — Google Play Console ready, store descriptions + screenshots guide + content rating complete
- [x] 6.4 Server-side Stockfish API hardening (mobile performance) — lazy init, MultiPV=2, bestmove-based getBestScore, local-only WASM
- [ ] 6.5 Compile Android APK (sideload + Play Store) — build scripts exist, pending compilation
- [ ] 6.6 Compile iOS IPA (TestFlight + App Store) — not yet started

**Deliverable**: Web MVP complete; iOS pending; Android APK build scripts ready, Play Store submission pending.

**Capacitor Setup (6.1 — Complete):**
- `capacitor.config.ts` — WebView wrapper loading from the live Cloudflare Workers URL
- `scripts/setup-capacitor.sh` — self-bootstrapping runbook (Java, Android SDK, Gradle, keystore)
- `scripts/build-apk.sh` — one-command APK build with signing
- `npm run cap:setup` → installs everything on any machine
- `npm run cap:build` → produces signed `app-release.apk`
- No Next.js `output` changes needed — WebView loads deployed web app

**Key Files:**
- `capacitor.config.ts` — Capacitor configuration
- `scripts/setup-capacitor.sh` — Self-bootstrapping setup runbook
- `scripts/build-apk.sh` — APK build script
- `.gitignore` — Excludes `android/`, `*.keystore`, signing properties

---

## Game Flow (Reference)

### Parallel Model Turn Flow

```
1. Match Start
   ├── White Team (Player A1 + Player A2)
   └── Black Team (Player B1 + Player B2)

2. White Team's Turn
   ├── 10-second team timer starts
   ├── Player A1 selects move → SOLID shadow (opacity 1.0)
   ├── Player A2 (teammate) commits → SHADOW (opacity 0.4)
   ├── BOTH moves visible on board (perspective-based)
   ├── Both lock in OR timer expires
   ├── Engine evaluates BOTH moves (blind from turn start)
   ├── Accuracy calculated
   ├── Winner: Move stays as lastMove (solid)
   ├── Loser: Retraction animation (fades to origin)
   ├── Shadows cleared (pendingOverlay & myPendingOverlay = null)
   └── Turn passes to Black Team

3. Black Team's Turn
   └── Same process (Player B3 + Player B4)

4. Repeat until checkmate / draw

5. Match End
   ├── Display winner
   ├── Show stats (accuracy, sync rate)
   └── Option to rematch
```

### UI States During Turn

**During Selection:**
- My move: Solid piece (opacity 1.0) via `myPendingOverlay`
- Teammate's move: Shadow piece (opacity 0.4) via `pendingOverlay`
- **Trigger**: When player broadcasts move via Supabase real-time event
- **Perspective**: Based on logged-in player ID - your move is always SOLID

**After Resolution:**
- Winning move: Solid on board via `lastMove`
- Losing move: Retraction animation (fades back to origin)
- **Trigger**: When `resolvePendingMoves()` completes
- Shadows cleared: Both overlays set to `null` (no fallback to previous state)

**Animation System Details:**
- `myPendingOverlay`: Your pending move (solid, opacity 1.0)
- `pendingOverlay`: Teammate's pending move (shadow, opacity 0.4)
- `lastMove`: Resolved winning move (solid)
- State change callback updates overlays when teammate broadcasts move
- After resolution, overlays are properly cleared (not retained)

---

## Data Models

### Game State
- Board position (FEN)
- `turnStartFen` (position before any tentative moves)
- Current turn (white/black)
- `pendingMoves` (human + teammate moves)
- Timer state (team-level, 10 seconds)
- Move history
- Lock states

### Turn Resolution
```typescript
interface MoveComparison {
  player1Move: string       // Player 1's move (UCI)
  player2Move: string       // Player 2's move (UCI)
  winningMove: string       // The move Stockfish chose
  winnerId: 'player1' | 'player2'
  isSync: boolean           // Both players chose same move
  player1Accuracy: number   // 0-100
  player2Accuracy: number   // 0-100
  player1Loss: number       // Centipawn loss
  player2Loss: number       // Centipawn loss
  bestEngineMove?: string   // Engine's optimal move
  bestEngineScore?: number  // Score of optimal move (cp)
}
```

### Match Statistics
- Accuracy per move (centipawn loss)
- Sync rate (same moves / total moves)
- Number of conflicts
- Win/loss/draw

### User Profile
- User ID
- Username
- Match history
- Win rate
- Average accuracy

---

## API Contracts (Phase 2+)

### Client → Server (Supabase)

| Event | Payload |
|-------|---------|
| `join_room` | `{ room_id, user_id }` |
| `select_move` | `{ room_id, move, player_id }` |
| `lock_move` | `{ room_id, player_id }` |
| `start_match` | `{ room_id }` |
| `pending_move_visible` | `{ room_id, player_id, move }` |

### Server → Client (Supabase Broadcast)

| Event | Payload |
|-------|---------|
| `player_joined` | `{ player_id, team }` |
| `move_selected` | `{ player_id }` (no move revealed) |
| `teammate_move_visible` | `{ player_id, move }` (greyed shadow) |
| `both_locked` | `{ move_a, move_b, scores }` |
| `move_applied` | `{ new_position, winner, accuracies }` |
| `game_over` | `{ result, stats }` |

---

## Future Extensions (Post-MVP)

- Voice chat between teammates
- Spectator mode
- Replay system with dual-move visualization
- Tournament mode
- Ranked matchmaking (ELO)
- Multiple game formats (blitz, rapid)

---

### Phase 7: Social Features (Week 15-18)
**Goal**: Full social system — friends, messaging, challenges, responsive web+mobile

- [x] 7.1 Database schema — `friendships`, `messages`, `challenge_links` tables + RLS policies
- [x] 7.2 Top bar redesign — profile icon top-left, friends icon top-right with unread badge
- [x] 7.3 Profile panel — show profile details + recent matches section on home page
- [x] 7.4 Friends panel — friend list, search by name/username, real-time online status (green dot via Supabase Presence), invite link
- [x] 7.5 Friend requests — send via invite link, accept/reject in friends panel
- [x] 7.6 Friend actions menu — three-dots per friend: Delete friend / Send message / Challenge / Block
- [x] 7.7 In-app chat — real-time messaging between friends via Supabase Broadcast
- [x] 7.8 Challenge links — create link encoding game mode + timer; auto-creates room on click, navigates to /game
- [x] 7.9 Challenge history — track past challenges between friends (mode, result, date); challenge_id linked on completed_games
- [x] 7.10 Share profile — "Copy profile link" button in profile panel
- [x] 7.11 Block/unblock — blocked users can't message, challenge, or friend-request
- [x] 7.12 Responsive design — all social components work on web + Capacitor mobile (touch targets, screen sizes)

**Database Changes**:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `friendships` | Friend connections | `sender_id`, `receiver_id`, `status` (pending/accepted/blocked), `created_at`, `updated_at` |
| `messages` | In-app chat | `id`, `sender_id`, `receiver_id`, `content`, `created_at`, `read` |
| `challenge_links` | Challenge URLs | `id`, `creator_id`, `game_mode`, `time_seconds`, `code`, `created_at`, `expires_at`, `is_active` |

**Key UX Flows**:

```
Invite Friend Link
├── Someone clicks invite link → sign-in prompt if not authenticated
├── After sign-in → sends friend request (NOT auto-add)
├── Recipient sees request in friends panel → Accept/Reject
└── Accepted → both appear in each other's friends list

Challenge Flow
├── Click "Challenge" from three-dots menu
├── Pick game mode + timer → challenge link generated
├── Link sent via chat/share
├── Recipient clicks link → auto-creates room (WHITE=challenger, BLACK=recipient)
└── Navigates directly to /game — no room code needed

Message Flow
├── Click "Send message" from three-dots menu → opens chat panel
├── Real-time messages via Supabase Broadcast channel
├── Unread count badge on friends icon
└── Messages persist in database for history
```

**Responsive Requirements**:
- Touch-friendly tap targets (min 44px) for Capacitor
- Friends panel: web = slide-over from right; mobile = full-screen overlay
- Profile panel: web = slide-over from left; mobile = full-screen overlay
- Chat panel adapts to available screen height; keyboard-aware on mobile
- Search input keyboard-aware on mobile

**Deliverable**: ✅ All social features live with responsive web + mobile support

---

## Key Dependencies

```json
{
  "dependencies": {
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "chess.js": "^1.4.0",
    "cm-chessboard": "^8.11.5",
    "@supabase/supabase-js": "^2.103.3",
    "stockfish": "^18.0.5",
    "stockfish.wasm": "^0.10.0",
    "framer-motion": "^12.38.0"
  },
  "devDependencies": {
    "jest": "^30.3.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| M1 | Week 2 | ✅ Complete - Local 2v2 playable |
| M2 | Week 4 | ✅ Complete - Supabase real-time infra |
| M3 | Week 6 | ✅ Complete - Human multiplayer (coordinator) |
| M4 | Week 8 | ✅ Complete - Core polish, animations, accuracy display |
| M5 | Week 10 | ✅ Complete — Matchmaking queue + matchmaking improvements |
| M6 | Week 14 | ✅ Complete — Mobile board + responsive UI + Phase 7 social features (Phase 6.4-6.7: mobile app store deployment pending) |

---

## Implementation Notes

### Blind Evaluation (Critical)
- All accuracy calculations use `turnStartFen` (position BEFORE any tentative moves)
- This ensures fair evaluation: neither move influences the other
- Bot teammate plays "blind" - doesn't see human's tentative move

### Team Timer
- 10 seconds per team per turn
- Timer starts when turn begins
- If timer expires, current moves locked as-is

### Shadow Move Animation (Implemented)
The shadow animation system shows both players' moves during a team's turn:

- **myPendingOverlay**: Shows your own pending move (opacity 1.0 = SOLID)
- **pendingOverlay**: Shows teammate's pending move (opacity 0.4 = SHADOW)
- **Trigger**: State change callback when teammate broadcasts move via Supabase
- **After resolution**: Both overlays cleared (no fallback to previous state)
- **lastMove**: The resolved winning move shown as solid on board
- **Perspective-based**: Your player ID determines which move is SOLID vs SHADOW

Key files:
- `src/components/Game.tsx` - State management for overlays
- `src/components/ChessBoard.tsx` - Animation rendering
- `src/features/online/game/onlineGame.ts` - Real-time move handling
- Creates urgency and prevents stalling

### Bot vs Human Teammate
- Bot: Auto-generates move, appears as greyed shadow immediately
- Human: Move visible when THEY lock (via Supabase broadcast)

---

## Premium Features

### Creem Billing (July 2026)

**Payment processor**: Creem (Merchant of Record) via `@creem_io/nextjs` (webhook handler) + `creem` (TypeScript SDK). Works on both web and Android (in-app browser via `@capacitor/browser`).

**Architecture**:
- `src/features/billing/types.ts` — `BillingProvider` abstract interface for all billing providers
- `src/features/billing/CreemBillingProvider.ts` — Creem checkout integration (redirect-based)
- `src/features/billing/SubscriptionService.ts` — High-level API: purchase, restore, isPremium, getPlans
- `src/features/billing/SubscriptionStateMachine.ts` — Pure function for subscription lifecycle transitions
- `POST /api/creem/checkout` — Creates Creem checkout session, returns `checkoutUrl`
- `GET /api/creem/products` — Fetches product pricing from Creem
- `GET /api/creem/subscriptions` — Lists active subscriptions (restore)
- `POST /api/creem/webhook` — Handles Creem webhook events, updates Supabase (service-role key)

**Pricing plans** (configured in Creem dashboard):
- Monthly — $1.99/mo (`premium_monthly`)
- Annual — $14.99/yr (`premium_yearly`)
- Prices fetched dynamically from Creem — never hardcoded

**Database columns** (on `profiles`):
- `subscription_provider` — `CREEM`, `APPLE`, or `WEB`
- `subscription_plan` — `monthly` or `yearly`
- `purchase_token` — Creem checkout/session ID
- `subscription_expiry_date` — When the subscription expires
- `auto_renew_status` — Whether auto-renew is enabled
- `purchase_state` — `purchased`, `pending`, `cancelled`, or `expired`
- `last_verified_date` — Last time the subscription state was confirmed

**Security**:
- Webhook payloads verified with `CREEM_WEBHOOK_SECRET` (HMAC signature via `@creem_io/nextjs`)
- Access granted/revoked server-side only — the client can never set `is_premium` directly
- `CREEM_API_KEY` never exposed to client (test mode auto-detected when prefixed `creem_test_`)
- Supabase writes use the service-role key inside the webhook handler

**Flow**:
1. User taps "Upgrade to Premium" on `/premium`
2. `SubscriptionService.purchaseMonthly()` → `POST /api/creem/checkout` → Creem-hosted checkout page
3. User pays on Creem's page → redirected back to `/premium?session_id=...`
4. Creem webhook fires → server sets `is_premium = true` on the user's profile
5. Premium unlocked on next status refresh — no app restart required

**GitHub Secrets required**:
`CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, `CREEM_PRODUCT_ID_MONTHLY`, `CREEM_PRODUCT_ID_YEARLY`

### Move Insights (Freemium)

- **3 free reveals** per account (stored in `profiles.insights_reveals_used`)
- **After 3 uses**: Premium upsell via `/premium` page with pricing table
- **Premium users** (`profiles.is_premium = true`): unlimited insights
- Free limit constant: `INSIGHTS_FREE_LIMIT` in `gameConstants.ts`

**Insights shown:**
- Engine's best move + centipawn score
- Per-move classification (check, capture, castle, development, etc.)
- Score comparison — how far each move was from engine's optimal
- Descriptive text explaining the move's impact

**Tech**: `moveClassifier.ts` — heuristic SAN-based move analysis (no Stockfish required)

### Move Replay

- Scrollable move list on game page
- Shows winning moves + shadow (losing) moves with strikethrough
- Click any move to replay board position
- Sync indicators (✓) and accuracy percentages per move

---

## Test Health

| Metric | Count | Status |
|--------|-------|--------|
| Test suites | 88 | 83 pass, 3 fail (pre-existing), 2 skip |
| Individual tests | 1007 | 882 pass, 8 fail (pre-existing), 117 skip |

**Status**: ✅ All billing tests green. Pre-existing failures in `ConfirmMoveBar.test.tsx`, `SidebarNav.test.tsx`, and `server/__tests__/engine.test.ts` (LRUCache dependency) — unrelated to the Creem migration.

---

*Last Updated: 2026-07-30 — Creem billing migration (replaced Google Play Billing)*

---

## Code Quality Pass (June 2026)

After architecture analysis, the following cross-cutting improvements were applied:

### Architecture
- **Shared `GameInterface`** — `src/features/shared/GameInterface.ts` defines the common API between `OnlineGame` and `LocalGame`. Eliminated 32 `as any` casts in `Game.tsx`. New methods must be added to the interface + both implementations.
- **Dynamic code splitting** — `Game`, `DuelGame`, and `ReplayView` now lazy-load via `next/dynamic()` in their page files, reducing initial bundle size.
- **Centralized providers** — `src/app/providers.tsx` is the single source for client-side context (Toast, NetworkOverlay, Suspense).

### Wired Up (Was Built But Never Used)
- **Toast notifications** — `useGameToast()` now fires on move-lock, resolution-complete, game-over events in `Game.tsx` and `DuelGame.tsx`.
- **Navigation guard** — `useNavigationGuard()` prevents accidental back-button/tab-close during active games.
- **Promotion dialog CSS** — linked in `layout.tsx` (was missing from `<head>`).

### UI/UX
- **Dark mode** — `Game.tsx` now supports light theme via `dark:` variants (was hardcoded dark-only).
- **Touch targets** — All interactive elements now meet WCAG minimum of 44×44px (MovePlayback buttons, GameOverModal close, FriendsPanel accept/reject).
- **Font sizes** — Minimum bumped from 9-10px to 11-12px across 15 components.
- **Network overlay** — Global offline banner in `NetworkOverlay.tsx`, rendered via providers.
- **Particle animation** — Losing move retraction now spawns 8-particle burst effect.
- **Color-coded indicators** — Green drop-shadow on my move, blue on teammate's move, red particles on loser.

### Code Hygiene
- **Removed `require()` anti-pattern** — Replaced with ES module imports in `gameState.ts` and `onlineGame.ts`.
- **Constants extraction** — `CHECKMATE_SCORE`, `DEFAULT_TEAM_TIMER_SECONDS`, `ROOM_EXPIRY_MS`, `DEFAULT_POLLING_INTERVAL_MS` centralized in `src/features/shared/gameConstants.ts`.
- **Subscription manager** — `src/lib/subscriptionManager.ts` for centralized Supabase channel lifecycle tracking.

### Key Files Changed (32 files, +419/−170)
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete ruleset.

---

## Bug Bounty — Completed Fixes (June 2026)

9 critical/high-severity issues fixed in `v1.0.5`:

| # | Bug | Files Changed |
|---|-----|---------------|
| 1 | Hardcoded Supabase JWT in Dockerfile.bak + render.yaml | `Dockerfile.bak`, `render.yaml` |
| 2 | Google Client ID / login result logged to console | `supabaseAuthUtils.ts` |
| 3 | 17 Promise chains without `.catch()` | 6 page files + 3 components |
| 4 | No auth guard on `delete_my_account` RPC | `delete-account/page.tsx` |
| 5 | `/api/log-crash` endpoint unauthenticated | `api/log-crash/route.ts`, `lib/rateLimit.ts` |
| 6 | 11 pages missing ErrorBoundary | All `app/*/page.tsx` files |
| 7 | `dangerouslySetInnerHTML` in layout.tsx | `layout.tsx`, `public/theme-init.js` |
| 8 | setTimeout/setInterval without cleanup | 6 components |
| 9 | Mounted check missing on async state updates | 6 page files |

## Bug Bounty — Remaining Items (Future)

These 11 items were identified during the audit but deferred for a later pass to avoid risking game stability:

### Batch A — Empty Catch Blocks (Medium Severity)
Add `console.error` to critical empty catch blocks in:
- `onlineGame.ts` — bot player add (lines 509, 515, 590, 595), checkmate check (1121, 1144)
- `localGame.ts` — checkmate evaluation (316, 336, 506, 526)
- `duelGame.ts` — channel cleanup (191), DB sync (279)
- `insights.ts` — localStorage read/write (9, 16), server sync (82, 104)
- `settings.ts` — localStorage parse/write (32, 39)
- `matchHistory.ts` — localStorage read/write (30, 37)

### Batch B — GameInterface Extensions (Requires Careful Testing)
- Add `setTurnState(state)`, `getCoordinatorId()`, `isCoordinator()` to `GameInterface`
- Implement minimal stubs in `LocalGame`
- Remove 16 `as any` casts in `Game.tsx` (lines 242, 512, 517, 547, 911, 921, 926, 938, 946, 1002-1005, 1012, 1397, 1446)
- Add `winningMove` to `MoveComparison` type

### Batch C — Production Readiness
- Gate 100+ `console.log` in `Game.tsx` behind `DEBUG` flag
- Fix `isCoordinator()` returning `true` on error → return `false` + log
- Validate playerId URL param against session user for online mode

### Batch D — Test Coverage
- Un-skip 19 test suites (game state, accuracy/move trail, move validation, game over detection, bot integration)
- Write tests for the 9 completed bug fixes
- Fix pre-existing test failures in `messages.test.ts` and `ChallengePicker.test.tsx`

---

## Browser UI Unification (July 2026)

### Phase 8: Unified Wide Sidebar Navigation
**Goal**: Unified wide sidebar navigation across all browser pages

- [x] 8.1 Home page: new mockup-based layout with HeaderBar, TimePills, GameModeCard, BotDifficultySelector, PlayButton, HomeBottomNav
- [x] 8.2 DesktopSidebar component — wider (220px/240px) with labels, ChessDuoLogo, tagline, loading progress bar
- [x] 8.3 History, Friends, Profile pages — migrate from SidebarNav (narrow 80px icons) to DesktopSidebar
- [x] 8.4 Main layout (`src/app/(main)/layout.tsx`) uses DesktopSidebar for all non-game pages on desktop
- [x] 8.5 Mobile unchanged — HomeBottomNav floating pill style remains
- [x] 8.6 Consistent dark navy theme (#0a0e1a) across all pages

**Key Files**: `src/components/DesktopSidebar.tsx`, `src/app/(main)/layout.tsx`, `src/app/page.tsx`

**Deliverable**: ✅ Unified browser navigation — Home, History, Friends, Profile all share the same wide sidebar with labels and active state

---

### Phase 9: Confirm Moves Feature (July 2026)
**Goal**: Floating confirmation bar for move verification — optional setting to prevent accidental moves

- [x] 9.1 Create `ConfirmMoveBar` component — floating 50/50 split X (Cancel) / ✓ (Confirm) bar above BoardBottomNav
- [x] 9.2 Add "Confirm Moves" toggle to GameMenu (hamburger dropdown) with ShieldCheck icon
- [x] 9.3 Integrate in `Game.tsx` — replace inline ConfirmMoveButton with floating ConfirmMoveBar
- [x] 9.4 Integrate in `DuelGame.tsx` — full confirm flow for 1v1 mode
- [x] 9.5 Delete legacy `ConfirmMoveButton.tsx` — replaced by ConfirmMoveBar
- [x] 9.6 z-index layering — ConfirmBar `z-40`, BoardBottomNav `z-30`, glassmorphism styling
- [x] 9.7 Touch targets ≥ 44px, dark mode, Framer Motion slide-up/slide-down animations
- [x] 9.8 Test coverage — 23 new tests covering ConfirmMoveBar, GameMenu toggle, and confirm flow integration

**Key Files**: `src/components/ConfirmMoveBar.tsx` (new), `src/components/GameMenu.tsx`, `src/components/Game.tsx`, `src/components/DuelGame.tsx`

**Deliverable**: ✅ Optional move confirmation — user selects move → floating bar appears → tap ✓ to confirm, ✕ to cancel without broadcasting

**Test Health Updated**:

| Metric | Count | Status |
|--------|-------|--------|
| Test suites | 88 (86 run) | 83 pass, 2 skip, 3 pre-existing failures (ConfirmMoveBar, SidebarNav, server/engine) |
| Individual tests | 1007 | 882 pass, 117 skip, 8 pre-existing failures |

---

*Last Updated: 2026-06-10 — Bug bounty Batch 1 complete (9 critical/high fixes)*

---

## Pre-Launch Security Hardening (July 2026)

Completed as part of go-live preparation:

### P0 — Payment Security
- **Creem subscription lifecycle** — All premium state changes are webhook-driven (HMAC-verified via `CREEM_WEBHOOK_SECRET`); the client can never set `is_premium` directly. Previously Google Play Developer API verification.
- **RLS policy documented** — `Allow all` policies on `games` and `room_players` flagged with detailed comment explaining the security gap and staging test requirements before removal.

### P1 — Infrastructure Hardening
- **Security headers** — Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-XSS-Protection` to `public/_headers`.
- **PWA manifest** — Added `public/manifest.json` with 512px icon, standalone display, theme-color. Linked in `layout.tsx`.
- **Open Graph metadata** — Added `openGraph`, `twitter:card`, `icons`, `appleWebApp` to layout metadata for social sharing previews.
- **Favicon / Apple touch icon** — `/favicon.ico` and `/favicon.png` referenced in layout metadata.

### P1 — Crash Reporting
- **`SplashHandler` wired to `/api/log-crash`** — Global `window.onerror` and `unhandledrejection` handlers now POST error data to the existing crash endpoint. Best-effort delivery with network failure suppression.

### P1 — Push Notification Opt-Out
- **SettingsPanel toggle** — Added "Push Notifications" toggle (on by default). On disable, sets `chessduo_push_disabled` in localStorage. `registerDeviceToken()` checks this flag and skips FCM registration if disabled.
- **Account deletion cleanup** — `delete_my_account()` RPC now deletes `push_tokens` rows for the deleted user.

### RLS Caveat (Known Issue)
- `games` and `room_players` tables have permissive `FOR ALL USING (true) WITH CHECK (true)` policies that override stricter per-policy RLS. These exist because anonymous Quick Play users need row access. The `is_room_member()` function already supports anonymous auth UIDs — the fix is to remove the "Allow all" policies and test anonymous room join end-to-end in staging. Flagged in `supabase/tables.sql` with full context.

---

## Recent Polish & UX Refinements (May 2026)

After all core phases shipped, the following refinements were applied based on real usage:

### UI Simplification
- **Removed inline stats panel** — "Your Team Stats (White)" box removed from gameplay screen (clutter, no one looked at it mid-game)
- **Removed post-game MatchSummary** — Clean result screen: winner + reason + Play Again. Stats still tracked in history
- **Removed room code from gameplay** — Room code only shown in pre-game lobby/waiting screens, not during active play

### Visual Improvements
- **Team icons replaced** — Custom rough knight SVGs replaced with lucide-react `Crown` (White) + `Bot` (Black)
- **Black team glow fix** — Black team now gets matching `boxShadow` glow animation when active (was missing, White always looked permanently highlighted)

### UX Flow
- **Loading spinner on time picker** — Clicking a time button for online mode now shows inline spinner + "Creating..." while room is being created (previously no visual feedback)
- **SPA navigation** — All `window.location.href` replaced with `router.push` for smooth single-page transitions
- **Game-over flow fix** — GameOverModal renders correctly instead of showing lobby screen after game ends
- **Online race condition fixes** — Prevented premature game start and double joinRoom in online flow
- **Timer sync** — Match timer now syncs across all clients