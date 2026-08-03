# CHESSDUO — PHASE 1: REPOSITORY ARCHITECTURE REPORT

---

## 1. REPOSITORY OVERVIEW

**ChessDuo** is a real-time 2v2 team chess application with a Next.js 16 frontend deployed to Cloudflare Workers, a Stockfish evaluation server on Render, a Supabase backend (PostgreSQL + Auth + Realtime), and an Android Capacitor app. The project has been under active AI-assisted development for approximately six months (version 1.0.149) with roughly 240+ bug fixes and feature iterations.

**Repository size**: ~60+ source files, 30+ CONTEXT.md documentation files, 20+ components, 25+ lib services, 10 database tables.

**Live URL**: `https://chessduo.chessdoubles27.workers.dev/`

---

## 2. TECHNOLOGY STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend Framework** | Next.js (App Router) | 16.2.6 |
| **UI Library** | React | 19.2.4 |
| **Styling** | Tailwind CSS | v4 |
| **Animation** | Framer Motion | 12.38.0 |
| **Animation** | anime.js | 4.4.1 |
| **Icons** | Lucide React | 1.17.0 |
| **Chess Board** | cm-chessboard | 8.11.5 |
| **Chess Logic** | chess.js | 1.4.0 |
| **Engine (WASM)** | Stockfish (browser) | 18.0.5 / wasm 0.10.0 |
| **Engine (Server)** | Stockfish (native binary) | via apt on Render |
| **Backend-as-Service** | Supabase (Auth, DB, Realtime) | JS SDK 2.103.3 |
| **Billing (MoR)** | Creem | SDK 1.6.0 + @creem_io/nextjs 0.5.2 |
| **Push (Browser)** | Web Push API + VAPID | web-push 3.6.7 |
| **Push (Native)** | FCM HTTP v1 + JWT (jose) | jose 6.0.10 |
| **Native Container** | Capacitor | 8.3.4 (Android) |
| **Hosting (FE)** | Cloudflare Workers | wrangler 4.99.0 |
| **Adapter** | OpenNext Cloudflare | 1.19.11 |
| **Hosting (Engine)** | Render (Docker) | ubuntu:22.04 |
| **Language** | TypeScript | ~5.x |
| **Testing** | Jest | 30.3.0 + ts-jest |
| **Linting** | ESLint | 9.x |

---

## 3. FOLDER STRUCTURE

```
ChessDuo/
├── CONTEXT/                     # Global business rules + design system
│   ├── RULES.md                 # Game rules, rooms, timers, premium, entities
│   └── DESIGN.md                # Theme, CSS vars, layout, typography, constraints
├── docs/
│   └── ARCHITECTURE.md          # Architecture bible (ADR, conventions, patterns)
├── public/                      # Static assets
│   ├── stockfish/stockfish.js   # Stockfish WASM binary
│   ├── cm-chessboard/           # Chessboard CSS assets
│   ├── avatars/                 # 8 WebP avatars (7 human + 1 bot)
│   ├── sw.js                    # Service worker for web push
│   ├── manifest.json            # PWA manifest
│   ├── theme-init.js            # Dark-mode flash prevention
│   ├── _headers                 # Cloudflare security/caching headers
│   ├── .well-known/             # assetlinks.json + apple-app-site-association (deep links)
│   └── *.svg, *.ico, *.png      # Icons, logo, favicons
├── server/                      # Stockfish evaluation server (separate deploy)
│   ├── src/index.ts             # Express server on :3001
│   ├── src/engine.ts            # Stockfish UCI wrapper + Polyglot
│   ├── src/polyglot.ts          # Opening book reader
│   ├── Dockerfile               # Multi-stage Ubuntu + Stockfish
│   ├── docker-compose.yml       # Local Docker dev
│   └── render.yaml              # Render deployment config
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root server layout
│   │   ├── providers.tsx        # Client providers (Toast, billing, push init)
│   │   ├── page.tsx             # Home page (mockup-based dark layout)
│   │   ├── globals.css          # Tailwind v4 + CSS variables
│   │   ├── loading.tsx          # Global PageLoading
│   │   ├── api/                 # 12 API route handlers
│   │   ├── game/page.tsx        # 2v2 game route
│   │   ├── duel/page.tsx        # 1v1 duel route
│   │   ├── welcome/page.tsx     # Onboarding
│   │   ├── invite/[userId]/     # Friend invite landing
│   │   ├── challenge/[code]/    # Challenge link landing
│   │   ├── replay/[gameId]/     # Replay viewer
│   │   └── (main)/              # Route group (9 pages)
│   │       ├── layout.tsx        # HomeBottomNav + DesktopSidebar
│   │       ├── history/          # Match history
│   │       ├── profile/          # Profile editor
│   │       ├── friends/          # Friends + chat
│   │       ├── settings/         # Settings toggles
│   │       ├── premium/          # Premium pricing
│   │       ├── privacy/          # Privacy policy
│   │       ├── terms/            # Terms of service
│   │       ├── delete-account/   # Account deletion
│   │       └── four-player/      # 4-player lobby
│   ├── components/              # 50+ React components
│   │   ├── Game.tsx             # Main 2v2 game (2478 lines)
│   │   ├── DuelGame.tsx         # 1v1 duel (634 lines)
│   │   ├── ChessBoard.tsx       # cm-chessboard wrapper
│   │   ├── BoardTopBar.tsx      # Team display + timer
│   │   ├── BoardBottomNav.tsx   # In-game 5-tab nav
│   │   ├── MoveComparison.tsx   # Accuracy display
│   │   ├── InsightsGate.tsx     # Premium insights gate
│   │   ├── GameLobby.tsx        # Matchmaking lobby
│   │   ├── SettingsPanel.tsx    # Settings
│   │   ├── ProfilePanel.tsx     # Profile display
│   │   ├── FriendsPanel.tsx     # Friends + chat
│   │   ├── ChatPanel.tsx        # In-app messenger
│   │   ├── Auth.tsx             # Login/signup
│   │   ├── DesktopSidebar.tsx   # Browser nav
│   │   ├── HomeBottomNav.tsx    # Mobile nav (also used as BottomNav)
│   │   ├── Toast.tsx            # Toast notification system
│   │   ├── ErrorBoundary.tsx    # React error boundary
│   │   ├── PageLoading.tsx      # Universal loading component
│   │   ├── ConfirmMoveBar.tsx   # Move confirmation
│   │   ├── RoundHistorySidebar.tsx # Round history
│   │   ├── MoveResolvedCard.tsx # Resolution modal
│   │   ├── PendingMovesRow.tsx  # Move status cards
│   │   ├── ColorPicker.tsx      # White/Black/Random picker
│   │   ├── InitialsAvatar.tsx   # Shared avatar component
│   │   ├── GameOverModal.tsx    # End-game result
│   │   ├── ResignConfirmModal.tsx
│   │   ├── LeaveConfirmModal.tsx
│   │   ├── MatchTimer.tsx       # Circular SVG timer
│   │   ├── TeamTimer.tsx        # Team countdown
│   │   ├── MovePlayback.tsx     # Timeline scrubber
│   │   ├── GameMenu.tsx         # In-game menu
│   │   ├── ChallengePicker.tsx  # Challenge creator
│   │   ├── SlideOver.tsx        # Generic slide-over
│   │   ├── NetworkOverlay.tsx   # Offline banner
│   │   ├── MobileStatusBar.tsx  # Safe-area wrapper
│   │   ├── SplashHandler.tsx    # Capacitor splash
│   │   ├── WelcomeDisclaimer.tsx # First-time modal
│   │   ├── GameTour.tsx         # Onboarding tutorial
│   │   ├── ChessDuoLogo.tsx     # Logo component
│   │   ├── TeamHexagon.tsx      # Decorative hexagon
│   │   ├── MatchmakingQueue.tsx # Queue UI
│   │   ├── EvaluatingLoader.tsx # Stockfish spinner
│   │   └── GameLoading.tsx      # Pre-game waiting
│   ├── features/                # Framework-free domain logic
│   │   ├── shared/              # GameInterface, constants, accuracy, avatars
│   │   ├── game-engine/         # GameState (board, phases, timers)
│   │   ├── offline/game/        # LocalGame class
│   │   ├── online/game/         # OnlineGame class (1679 lines)
│   │   ├── bots/                # Bot AI, difficulty, openings
│   │   ├── mobile-engine/       # Stockfish WASM evaluator
│   │   ├── push-notifications/  # FCM + web push module
│   │   └── billing/             # Creem subscriptions
│   ├── hooks/                   # 10 custom React hooks
│   ├── lib/                     # 25+ utility modules
│   └── types/                   # TypeScript ambient declarations
├── supabase/
│   └── tables.sql              # 10 tables + 5 functions + trigger + RLS
├── scripts/                     # 9 build/deploy scripts
├── store/                       # Play Store metadata
├── .github/workflows/           # 2 CI/CD workflows
├── middleware.ts                # Auth guard (/game, /duel, /history)
├── capacitor.config.ts          # Capacitor native config
├── wrangler.jsonc               # Cloudflare Workers config
├── next.config.ts               # Next.js config (+ OpenNext dev init)
├── open-next.config.ts          # OpenNext Cloudflare adapter
└── package.json                 # v1.0.149, 32 dependencies
```

---

## 4. MAJOR FEATURE MODULES

| Module | Location | Description |
|--------|----------|-------------|
| **2v2 Team Chess** | `src/features/offline/game/`, `src/features/online/game/`, `src/components/Game.tsx` | Core 2v2 gameplay: simultaneous team move selection, both moves hidden until both locked, resolution by Stockfish comparison |
| **1v1 Duel** | `src/lib/duelGame.ts`, `src/components/DuelGame.tsx` | Standard 1v1 chess mode with timer, human vs human via Supabase Realtime |
| **Bot AI** | `src/features/bots/` | 6-tier difficulty system (1000-2600 ELO), opening book, humanization pipeline, Stockfish WASM evaluation |
| **4-Player Lobby** | `src/lib/fourPlayerActions.ts`, `src/app/(main)/four-player/` | All-human 4-player mode with lobby seat assignment |
| **Matchmaking** | `src/lib/matchmaking.ts` | Queue-based room find/create with 60s expiry |
| **Premium Billing** | `src/features/billing/`, `src/app/api/creem/` | Creem merchant-of-record subscriptions ($1.99/mo, $14.99/yr), webhook-driven lifecycle, verify-on-return |
| **Insights** | `src/lib/insights.ts`, `src/components/InsightsGate.tsx`, `src/components/MoveComparison.tsx` | 3 free insights, premium-unlimited, move accuracy analysis |
| **Push Notifications** | `src/features/push-notifications/`, `src/app/api/push/`, `public/sw.js` | Dual transport: FCM (native) + Web Push VAPID (browser). Friend requests, chat, game invites |
| **Friends & Chat** | `src/lib/friends.ts`, `src/lib/messages.ts`, `src/components/FriendsPanel.tsx`, `src/components/ChatPanel.tsx` | Social graph, real-time messaging, challenge invites |
| **Match History** | `src/lib/matchHistory.ts`, `src/app/(main)/history/` | Completed game storage (localStorage + Supabase), replay viewer |
| **Deep Links** | `src/lib/appUrl.ts`, `src/lib/challenges.ts`, `public/.well-known/` | Android App Links + iOS Universal Links for invites/challenges |
| **Auth** | `src/lib/authService.ts`, `src/lib/supabaseAuthUtils.ts`, `src/components/Auth.tsx` | Email/password + Google OAuth (web + Capacitor) |
| **Replay** | `src/app/replay/[gameId]/` | FEN + move history reconstruction from saved games |
| **Settings** | `src/lib/settings.ts`, `src/components/SettingsPanel.tsx` | Theme, sound, auto-queen, confirm-move, push toggle |
| **Welcome/Onboarding** | `src/app/welcome/`, `src/components/WelcomeDisclaimer.tsx`, `src/components/GameTour.tsx` | First-time tutorial, mode explanation |

---

## 5. SHARED MODULES

| Module | Files | Purpose |
|--------|-------|---------|
| **GameInterface** | `src/features/shared/GameInterface.ts` | 32-method interface contract for LocalGame + OnlineGame |
| **GameState** | `src/features/game-engine/gameState.ts` | Board state, phase tracking, pending moves, timers |
| **GameConstants** | `src/features/shared/gameConstants.ts` | 9 exported constants (CHECKMATE_SCORE, timers, etc.) |
| **Accuracy** | `src/features/shared/accuracy.ts` | Lichess hyperbolic model, 5 accuracy categories |
| **Avatars** | `src/features/shared/avatars.ts` | 7 human + 1 bot avatar URL map |
| **BrowserMoveEvaluator** | `src/features/mobile-engine/BrowserMoveEvaluator.ts` | Stockfish WASM (MultiPV=6, eager init) - singleton via evaluatorFactory |
| **SubscriptionService** | `src/features/billing/SubscriptionService.ts` | Provider-agnostic premium API |
| **SupabaseClient** | `src/lib/supabase.ts` | Typed Supabase client + Database interface |
| **Settings** | `src/lib/settings.ts` | localStorage-backed user settings + React hook |
| **Sounds** | `src/lib/sounds.ts` | Web Audio API synthesized chess sounds |
| **SubscriptionManager** | `src/lib/subscriptionManager.ts` | Centralized Supabase channel lifecycle tracking |
| **Share** | `src/lib/share.ts` | Cross-platform share helper (Capacitor → Web Share API → clipboard) |
| **RateLimit** | `src/lib/rateLimit.ts` | In-memory per-endpoint rate limiting |

---

## 6. CURRENT ARCHITECTURE

### Layered Architecture

```
┌─────────────────────────────────────────────┐
│  Pages (src/app/)                            │
│  Next.js App Router — routing, SSR boundary  │
├─────────────────────────────────────────────┤
│  Components (src/components/)                │
│  React — UI rendering, user interaction      │
├─────────────────────────────────────────────┤
│  Hooks (src/hooks/)                          │
│  Cross-cutting concerns (viewport, guard)    │
├─────────────────────────────────────────────┤
│  Lib (src/lib/)                              │
│  Data access, services, utilities            │
├─────────────────────────────────────────────┤
│  Features (src/features/)                    │
│  Framework-free domain logic                 │
│    ├── shared/   (interface contract)         │
│    ├── game-engine/ (core state)              │
│    ├── online/   (multiplayer)               │
│    ├── offline/  (local/bot)                  │
│    ├── bots/     (AI)                        │
│    ├── mobile-engine/ (Stockfish WASM)        │
│    ├── billing/  (subscriptions)              │
│    └── push-notifications/                   │
└─────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **ADL-001: Shared GameInterface** — Both `LocalGame` and `OnlineGame` implement the same 32-method interface. UI types against `GameInterface` — never `as any`.

2. **ADL-002: `next/dynamic` with `ssr: false`** — All game components lazy-loaded client-side because chess libraries require browser APIs.

3. **ADL-003: Centralized Providers** — `providers.tsx` is the single source of truth for all client-side context (Toast, billing, push init, WASM pre-warming).

4. **ADL-004: Co-located Tests** — Tests in `__tests__/` next to source, not in a global `tests/` folder.

5. **Coordinator Pattern (distributed)** — In online mode, one client per turn acts as coordinator (alphabetically first non-bot), resolving moves locally via WASM, then broadcasting `turn_resolved` to all peers. No central server for game logic.

6. **RLS-Safe Room Join** — Joiners derive team from `rooms.host_team` (opposite of host) + team counts from `get_room_join_state` RPC — never read `room_players` before joining (RLS blocks non-members).

7. **Billing Provider Abstraction** — UI talks to `SubscriptionService` (interface: `BillingProvider`), currently backed by Creem (MoR). Architecture supports future Apple IAP / Google Play additions.

8. **Evaluation is always local** — All move evaluation (online, offline, bots) uses client-side Stockfish WASM (MultiPV=6, eager init). The Render server is a legacy/alternative path, not currently used by the frontend.

---

## 7. HIGH-LEVEL COMPONENT DIAGRAM

```
                    ┌─────────────────────────┐
                    │     Cloudflare Worker    │
                    │  (chessduo.workers.dev)  │
                    └───────────┬─────────────┘
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                 ▼
    ┌─────────────────┐  ┌───────────┐  ┌─────────────────┐
    │  Next.js SSR/SSG│  │API Routes │  │  Static Assets   │
    │  (App Router)   │  │ (12 routes)│  │ (sw.js, wasm, ) │
    └────────┬────────┘  └─────┬─────┘  └─────────────────┘
             │                 │
             ▼                 ▼
    ┌─────────────────────────────────────┐
    │         Supabase (Backend)           │
    │  ┌────────┐  ┌────────┐  ┌───────┐  │
    │  │  Auth  │  │   DB   │  │Realtime│  │
    │  │(email, │  │(10 tbl)│  │(broad- │  │
    │  │ google)│  │  RLS   │  │cast,   │  │
    │  └────────┘  └────────┘  │presence│  │
    │                          └───────┘  │
    └─────────────────────────────────────┘
             │                 │
             ▼                 ▼
    ┌─────────────────┐  ┌───────────────┐
    │  Render (Docker) │  │  Creem (MoR)  │
    │  Stockfish v16   │  │  Subscriptions│
    │  Express :3001   │  │  Webhooks     │
    └─────────────────┘  └───────────────┘
                                 │
                                 ▼
                        ┌───────────────┐
                        │  FCM / WebPush│
                        │  (Push Notif) │
                        └───────────────┘
```

---

## 8. MODULE DEPENDENCY OVERVIEW

### Feature Module Dependencies

```
Game.tsx / DuelGame.tsx
  ├── OnlineGame ──────────────── GameState ── chess.js
  │    ├── supabase (RealtimeChannel)
  │    ├── gamePersistence (save/load)
  │    ├── subscriptionManager (channel tracking)
  │    └── BrowserMoveEvaluator (Stockfish WASM)
  │
  ├── LocalGame ───────────────── GameState ── chess.js
  │    ├── BrowserMoveEvaluator (Stockfish WASM)
  │    └── ChessBot (AI opponent/teammate)
  │         └── BrowserMoveEvaluator (Stockfish WASM)
  │
  └── DuelGame (standalone) ──── chess.js
       ├── supabase (RealtimeChannel)
       └── BrowserMoveEvaluator (per-move accuracy)
```

### Key Dependency Observations

| Dependency | Consumer | Provider |
|-----------|----------|----------|
| `GameInterface` | `Game.tsx` (via `as GameInterface`) | `shared/GameInterface.ts` |
| `BrowserMoveEvaluator` singleton | `OnlineGame`, `LocalGame`, `ChessBot` | `evaluatorFactory.ts` |
| `SubscriptionService` | `InsightsGate`, `ProfilePanel`, `premium/page.tsx` | `features/billing/` |
| `supabase` client | Every lib module, Game.tsx, DuelGame.tsx | `lib/supabase.ts` |
| `subscriptionManager` | `OnlineGame`, providers | `lib/subscriptionManager.ts` |
| `AuthService` | `providers.tsx` | `lib/authService.ts` |
| `sounds` engine | `Game.tsx`, `DuelGame.tsx` | `lib/sounds.ts` |

### Circular Dependency Check
No circular dependencies detected. The architecture follows a strict layering: `features/` → `lib/` → `hooks/` → `components/` → `app/`. Features are framework-free (no React imports). Components access features via `GameInterface`.

---

## 9. CURRENT EVENT FLOW OVERVIEW

### Online 2v2 Game Flow

```
PHASE 0: ROOM CREATION
  Host creates room → roomAction.createOnlineRoom()
    → INSERT rooms (code, host_team, status='waiting')
    → INSERT room_players (host on host_team, slot 0)

PHASE 1: JOIN + CONNECT
  Joiner → joinRoom() via channels
    → Reads rooms.host_team → derives opposite team
    → Calls get_room_join_state() RPC for counts
    → INSERT room_players (opposite team, slot 0)
  OnlineGame.joinRoom()
    → Creates Supabase RealtimeChannel('room:{roomId}')
    → Registers presence (key=playerId)
    → Registers broadcast listeners (player_move, player_locked, turn_resolved, timer_sync, etc.)
    → Starts fallback polling (exponential backoff 500ms→8s)

PHASE 2: START
  presence sync → >= 2 players → alphabetically-first triggers startGameWhenReady()
    → UPSERT game state (FEN, status='PLAYING')
    → Broadcast game_started

PHASE 3: TURN STATE MACHINE
  SELECTING ──► LOCKED ──► RESOLVED ──► (next turn)
  ┌─────────┐   ┌──────┐   ┌─────────┐
  │ Both     │   │ Both  │   │Coordinator│
  │ players  │   │ locked│   │ resolves  │
  │ select   │   │        │   │ via WASM  │
  │ moves    │   │        │   └─────┬─────┘
  └────┬─────┘   └───┬────┘         │
       │ player_move  │ player_locked│ turn_resolved
       │ broadcast    │ broadcast    │ broadcast
       ▼              ▼              ▼

PHASE 4: MOVE SELECTION (per player)
  1. User picks move on board → Game.tsx handleMove → executeMove
  2. g.startPendingTurn() → g.setPendingMove(player, uci)
  3. g.lockPendingMove(player)
  4. broadcastMove(uci) → channel.send({ type:'broadcast', event:'player_move' })
  5. broadcastLocked() → channel.send({ type:'broadcast', event:'player_locked' })
  6. Turn state → 'waiting_for_teammate'
  7. await g.waitForTeammateLock() (event-based Promise)

PHASE 5: RESOLUTION
  1. Both locked → g.resolvePendingMoves()
  2. Coordinator:
     a. evaluator.evaluateMoves([player1Uci, player2Uci], fen)
     b. Compare scores → determine winning move
     c. Apply winning move to board
     d. Broadcast: channel.send({ event:'turn_resolved', payload: {winningTeam, winningMove, comparison} })
  3. Non-coordinator: Awaits turn_resolved broadcast
  4. All clients update board, accuracy comparison, highlights

PHASE 6: GAME OVER
  Checkmate/Draw/Timeout/Resignation
    → gamePersistence.saveGameState(status='GAME_OVER')
    → matchHistory.saveCompletedGame()
    → Show GameOverModal
```

### Offline 2v2 Game Flow

```
1. LocalGame created with timeLimit + playerColor
2. 4 placeholder players added (WHITE: player1+player2, BLACK: player3+player4)
   But visually: You + WhiteBot vs BlackBot (second bot hidden in BoardTopBar)
3. start() → GameStatus.PLAYING
4. Human selects move → ChessBot.selectBestMove(fen) for teammate bot
5. Both moves locked → 800ms pause → checkAndResolve()
6. evaluateMoves([humanUci, teammateUci], fen) → MoveComparison
7. Apply winner's move, update board, show accuracy
8. If new turn is opponent: run opponent bot move asynchronously
   → bot.selectMoveAsync(fen) → set both opponent slots → resolveLegacy
```

### Duel Game Flow

```
1. DuelGameEngine created with roomId + playerId + team + timeLimit
2. join() → channel('room:{roomId}') → presence tracking
3. Polling starts (2s on duel_games table)
4. Two players present → startGame() → status='playing'
5. Each turn: makeMove(uci) → chess.js validate → broadcast duel_move
6. Timer runs locally, synced via presence/disconnect detection
7. Game over: broadcast duel_game_over
```

---

## 10. STATE MANAGEMENT OVERVIEW

### State Management Strategy

ChessDuo does **NOT** use a centralized state management library (no Redux, Zustand, Jotai). State is distributed:

| Scope | Mechanism | Examples |
|-------|-----------|----------|
| **Game Engine State** | Class instances | `OnlineGame`, `LocalGame`, `DuelGameEngine`, `GameState`, `ChessBot` |
| **Component State** | `useState` + `useRef` | 28 useState + 16 useRef in Game.tsx; 20 useState + 6 useRef in DuelGame.tsx |
| **Callback Pattern** | `setOnStateChange(cb)` | Game.tsx registers callback on OnlineGame to trigger re-render |
| **User Settings** | `localStorage` + `useSettings()` hook | Theme, sound, auto-queen, confirm-move |
| **Auth Session** | Supabase Auth + cached token | `authService.ts` wraps `supabase.auth.onAuthStateChange` |
| **Premium Status** | `SubscriptionService` (30s cache) | Provider-agnostic, reads from Supabase `profiles` |
| **Push Token** | Cached access token | `setCachedAccessToken()` / `getCachedAccessToken()` |
| **Insights** | `localStorage` per user | `chessduo_insights_{userId}` counter |
| **Match History** | `localStorage` + Supabase backup | `chessduo_history_{userId}` (50 entries) |
| **Game Persistence** | Supabase `games` table | `gamePersistence.saveGameState()` / `loadGameState()` |

### State Flow in Turn Lifecycle

```
Game.tsx
  ┌─ state: gameState (object aggregating 21 fields)
  │    ├── fen, currentTurn, status, phase
  │    ├── matchTimeRemaining, pendingOverlay, myPendingOverlay
  │    ├── highlightSquares, lastMove, botThinking, showGameOn
  │    └── showResolution, moveAccuracy, initialBotTurn
  │
  ├─ Derivation: calls g.getPendingMoves(), g.getTurnState(), etc.
  │
  ├─ Callbacks: g.setOnStateChange(updateState) → triggers setGameState()
  │
  └─ Refs: gameRef, onlineGameRef (synced via useEffect to avoid stale closures)
```

### Sources of Truth (Potential Conflicts)

| Data | Source 1 | Source 2 | Risk |
|------|----------|----------|------|
| Game FEN | `OnlineGame.board.fen()` | `gamePersistence.loadGameState()` | Reconnect sync may overwrite |
| Timer | `gameState.matchTimeRemaining` | `handleTimerSync()` broadcast | Broadcast may be stale |
| Premium | `SubscriptionService.isPremium()` | `profiles.is_premium` | Two read paths (mitigated by centralized service) |
| Match History | `localStorage` | Supabase `completed_games` | localStorage is primary; Supabase is best-effort backup |
| Settings | `localStorage` | No Supabase sync currently | Single source (CONTEXT/CONTEXT.md says sync exists but implementation does not) |

---

## 11. EXTERNAL SERVICE OVERVIEW

| Service | Purpose | Integration Points | Auth Method |
|---------|---------|-------------------|-------------|
| **Supabase Auth** | User authentication | `providers.tsx` (onAuthStateChange), middleware.ts, `lib/supabaseAuthUtils.ts`, `lib/capacitorAuth.ts` | JWT (Bearer token) + cookies |
| **Supabase Database** | 10 tables (PostgreSQL) | Every lib module, OnlineGame, Game.tsx | RLS policies via `auth.uid()` |
| **Supabase Realtime** | Broadcast + Presence channels | `OnlineGame.joinRoom()`, `DuelGameEngine.join()`, `messages.ts`, `useBadgeCount.ts` | Channel subscription (DB auth inherits) |
| **Creem (MoR)** | Subscription billing | `CreemBillingProvider`, 6 API routes, webhook | API key + webhook secret |
| **Cloudflare Workers** | Next.js hosting | `wrangler.jsonc`, `@opennextjs/cloudflare` | Cloudflare token |
| **Render** | Stockfish server hosting | `Dockerfile`, `render.yaml` | None (internal) |
| **FCM** | Native push notifications | `/api/push/send` (JWT OAuth2 via jose) | Service account JSON |
| **Web Push (VAPID)** | Browser push notifications | `/api/push/send` (web-push library), `public/sw.js` | VAPID key pair |
| **Google OAuth** | Social login (web + Capacitor) | `supabaseAuthUtils.ts`, `capacitorAuth.ts`, `@capgo/capacitor-social-login` | OAuth 2.0 |

---

## 12. DATABASE OVERVIEW

### Tables (10 total)

| Table | Primary Key | Key Columns | RLS |
|-------|-------------|-------------|-----|
| `profiles` | `id` (TEXT) | username, avatar_url, is_premium, subscription_* | Public select; self insert/update |
| `rooms` | `id` (UUID) | code (UNIQUE), status, mode, host_team, expires_at | Public select; auth insert; creator update |
| `room_players` | `(room_id, player_id)` | team, slot, status | **Allow all OR** + member-based policies |
| `games` | `id` (UUID) | room_id (UNIQUE), fen, current_turn, move_history (JSONB) | **Allow all OR** + member-based policies |
| `completed_games` | `id` (UUID) | winner, game_result, stats, move_comparisons (JSONB) | Auth select + insert |
| `friendships` | `(sender_id, receiver_id)` | status, created_at | Self-owned rows |
| `messages` | `id` (UUID) | sender_id, receiver_id, content, read, message_type | Self-owned rows |
| `challenge_links` | `id` (UUID) | code (UNIQUE), game_mode, room_id, is_active, expires_at | Public select; creator insert/update |
| `duel_games` | `id` (UUID) | room_id (UNIQUE), player_white, player_black, fen, timers | Participants only |
| `push_tokens` | `id` (UUID) | user_id, token (UNIQUE), platform | Self-owned only |

### Functions (5 total)

| Function | Type | Purpose |
|----------|------|---------|
| `is_room_member(room_id)` | SECURITY DEFINER | Check membership for RLS policies |
| `get_room_players(room_id)` | SECURITY DEFINER | Returns room members (gated by is_room_member) |
| `get_room_join_state(room_id)` | SECURITY DEFINER | Returns player counts per team (public, un-gated) |
| `handle_new_user()` | SECURITY DEFINER (trigger) | Auto-creates profile on auth.users insert |
| `delete_my_account()` | SECURITY DEFINER | Cascade-deletes all user data |

### Known Schema Issues

- **Two "Allow all" policies**: `room_players` and `games` have `USING (true) WITH CHECK (true)` policies — intentional for anonymous Quick Play mode. This means any authenticated or anonymous user can read/write any room or game.
- **`games` table not in Database type**: `gamePersistence.ts` uses a `games` table not represented in the TypeScript `Database` interface in `supabase.ts`. It's accessed via raw SQL/upsert.
- **`duel_games` table not in Database type**: `duelGame.ts` and `challenges.ts` reference this table but it's not typed in the `Database` interface.

---

## 13. CLOUDFLARE OVERVIEW

### Worker Configuration (`wrangler.jsonc`)
- **Name**: `chessduo`
- **Entrypoint**: `.open-next/worker.js` (generated by opennextjs-cloudflare build)
- **Compatibility**: `nodejs_compat`, `global_fetch_strictly_public`
- **Assets**: `.open-next/assets/` directory bound as `ASSETS`
- **Self-reference**: `WORKER_SELF_REFERENCE` for internal API calls
- **Images**: `IMAGES` binding for image optimization

### Deployment
- `npm run deploy` → `opennextjs-cloudflare build && opennextjs-cloudflare deploy`
- CI: `.github/workflows/deploy-cf-pages.yml` on push to `prod`
- Secrets injected via `cloudflare/wrangler-action@v3` (12+ secrets)

### Headers (`public/_headers`)
- Immutable cache: `_next/static/*`, `avatars/*`
- Security: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- Deep links: Correct Content-Type for `.well-known/assetlinks.json` (application/json) and `.apple-app-site-association`

---

## 14. REALTIME OVERVIEW

### Channel Architecture

```
OnlineGame (2v2)
  └── channel('room:{roomId}')
       ├── presence (key: playerId)
       │    ├── sync  → >=2 players → startGameWhenReady()
       │    ├── join  → same trigger
       │    └── leave → disconnect detection (35s forfeit)
       └── broadcasts
            ├── player_move      → handleTeammateMove()
            ├── player_locked    → handleTeammateLocked()
            ├── turn_resolved    → handleTurnResolved() (winningTeam, winningMove, comparison)
            ├── timer_sync       → handleTimerSync()
            ├── match_abandoned  → handleMatchAbandoned()
            ├── match_timeout    → handleMatchTimeoutBroadcast()
            └── game_started     → syncGameState()

DuelGameEngine (1v1)
  └── channel('room:{roomId}')
       ├── presence (key: playerId_WHITE|_BLACK)
       │    ├── sync  → startGame()
       │    ├── join  → set opponent connected
       │    └── leave → disconnect timer (35s forfeit)
       └── broadcasts
            ├── duel_move       → handleOpponentMove()
            └── duel_game_over  → handleGameOverBroadcast()

Messages (chat)
  └── channel('messages:{userId}')
       └── broadcast
            └── new_message → real-time delivery

Badge Count
  └── postgres_changes on messages + friend_requests
       └── Realtime subscription (no polling)
```

### Reconnection
- OnlineGame: `CHANNEL_ERROR` auto-reconnects with full listener re-setup. `syncGameState()` reloads state from `games` table.
- Fallback polling: 500ms → 1.8x exponential backoff (capped 8s, max 15s budget) as a backup for presence-based player detection.
- DuelGameEngine: `CHANNEL_ERROR` also auto-reconnects. 2s polling on `duel_games` table as backup.

### Channel Lifecycle
- All channels registered via `subscriptionManager.register(channel)`
- Cleanup on `leaveRoom()` → `subscriptionManager.remove(channel)` + `channel.unsubscribe()`
- No global cleanup mechanism for abrupt navigation (relying on `useEffect` cleanup)

### Known Realtime Issues
- **Bug 39 (Fixed)**: Joiner-derives-team race condition solved by `rooms.host_team` + `get_room_join_state` RPC.
- **Race condition**: `turn_resolved` broadcast could arrive before `player_locked` handler completes — the recent fix (2026-08-03) removed a guard that caused `turn_resolved` to be silently dropped when `_status !== PLAYING`.

---

## 15. KNOWN ARCHITECTURAL RISKS

| # | Risk | Severity | Evidence |
|---|------|----------|----------|
| 1 | **"Allow all" RLS on `room_players` and `games`** | HIGH | `room_players` and `games` tables have `USING (true) WITH CHECK (true)` policies — world-readable/writable. Intentional for anonymous Quick Play but exposes all active game data. |
| 2 | **`games` and `duel_games` tables missing from TypeScript `Database` type** | MEDIUM | The `supabase.ts` Database interface defines 8 tables but `gamePersistence.ts` and `duelGame.ts` access `games` and `duel_games` which are not typed. |
| 3 | **Dual `GameState` implementations** | MEDIUM | Both `OnlineGame` and `LocalGame` create their own `GameState` instance. Game.tsx aggregates state from the game object via polling — not truly reactive. State callbacks (`setOnStateChange`) are the synchronization mechanism but there's no guarantee of order. |
| 4 | **LocalStorage as primary match history** | MEDIUM | `matchHistory.ts` uses localStorage as primary (50 entries) with Supabase as best-effort backup. Cross-device history requires premium data export or server-side query. |
| 5 | **Race condition in turn resolution broadcast** | MEDIUM | Recent fix (2026-08-03) removed a status guard because it caused `turn_resolved` to be silently dropped when arriving during `syncGameState`. Architecture relies on broadcast ordering which Supabase does not guarantee. |
| 6 | **Settings not synced to Supabase** | LOW | `settings.ts` persists to localStorage only. CONTEXT says Supabase sync exists but the code does not implement it (`useSettings` is purely localStorage). |
| 7 | **No centralized error tracking** | LOW | Crash reports go to `/api/log-crash` (present but unverified for completeness). Errors in game logic surface as toasts but no structured logging exists. |
| 8 | **DuelGame.tsx is architectural island** | MEDIUM | `DuelGame.tsx` uses a standalone `DuelGameEngine` (from `lib/duelGame.ts`) with its own state management pattern (20 separate useState vs Game.tsx's single gameState object). Different component/engine architecture from Game.tsx — duplicates BoardTopBar, BoardBottomNav, move handling, sound detection, navigation guard. |
| 9 | **28 useState + 16 useRef in Game.tsx** | HIGH | The main Game component has extremely high state complexity. State is distributed across 44 reactive variables, making it difficult to reason about, test, and debug. No reducer pattern. |
| 10 | **Evaluation singleton lifecycle** | LOW | `BrowserMoveEvaluator` is a singleton created in `providers.tsx` at mount. It creates a Web Worker immediately. There's no teardown when navigating away from game pages. `terminate()` exists but is only called from Capacitor lifecycle hooks. |
| 11 | **Supabase Realtime config object inconsistency** | LOW | OnlineGame channel uses `{ config: { presence: { key: playerId } } }` but DuelGameEngine passes presence key differently (`playerId_WHITE` format). |
| 12 | **`store/` directory with no CONTEXT.md** | LOW | Contains Play Store metadata (icons, descriptions) but no documentation about the app store release process. |
| 13 | **Stockfish server may be unused** | MEDIUM | `server/` provides an Express-based Stockfish API on Render, but recent changes (2026-07-30) removed `SERVER_URL` from both `OnlineGame` and `LocalGame`. The frontend now always uses local WASM. The server may be an orphaned deployment. |
| 14 | **Matchmake polling is O(n)** | LOW | `matchmaking.ts` queries `rooms` and `room_players` to find available rooms with capacity — does not use an index or queue table. Active room count grows with concurrent users. |

---

## 16. AREAS REQUIRING FURTHER INVESTIGATION

1. **`Game.tsx` state architecture** — The 28 useState + 16 useRef pattern needs deep analysis. Determine which states are derived, which are redundant, and whether a reducer + context pattern would reduce complexity.

2. **DuelGame vs Game duplication** — Quantify exactly how much logic is duplicated between `Game.tsx` and `DuelGame.tsx` (sound detection, timer handling, BoardTopBar derivation, navigation guard, board key remount). Evaluate whether a shared game shell could host both game modes.

3. **"Allow all" RLS security impact** — Audit what data is exposed by the world-readable `room_players` and `games` tables. Determine if this is acceptable for anonymous Quick Play or if a more granular policy is needed.

4. **Stockfish server ROI** — Verify whether the Render-hosted Stockfish server receives any traffic. The `SERVER_URL` env var was removed and all evaluation is now local WASM. If the server is unused, decide whether to decomission or repurpose.

5. **State synchronization between clients** — The coordinator pattern relies on broadcast ordering. Test what happens when `turn_resolved` arrives before `player_locked` on a non-coordinator client (particularly after the 2026-08-03 fix).

6. **Supabase Database type completeness** — The TypeScript `Database` type in `supabase.ts` is missing `games` and `duel_games` tables. Determine if this is intentional (dynamic table) or an oversight.

7. **Client-side evaluation performance** — Stockfish WASM (MultiPV=6, depth up to 18) runs in the browser/Capacitor WebView. Profile memory usage, initialization time, and evaluation latency on mobile devices.

8. **Capacitor lifecycle management** — The app has `@capacitor/app`, `@capacitor/browser`, `@capacitor/push-notifications`, and `@capacitor/splash-screen` plugins. Verify that all lifecycle events (pause/resume/back) are correctly handled, particularly around the Stockfish WASM worker termination.

9. **Push notification edge cases** — The push notification system has evolved through multiple crash fixes. Verify that all edge cases are covered: token refresh races, service worker registration failures, FCM token invalidation, and background notification handling.

10. **Reconnect and state recovery** — `syncGameState()` reloads from the `games` table on reconnect. Verify that all state (especially pending moves and turn phase) is correctly recovered after a client disconnect.

---

## CONCLUSION: READINESS FOR PHASE 2

**I believe I understand the repository sufficiently to proceed to Phase 2 (Architecture Audit).**

All 30 CONTEXT.md files have been read. Every major feature module has been explored at the code level. The database schema, API routes, deployment pipeline, realtime architecture, and component hierarchy are fully documented.

**Key observations that will shape Phase 2:**
- The application has evolved through incremental fixes; architectural debt in state management (Game.tsx), module duplication (Game vs DuelGame), and RLS policy breadth will be the primary audit targets.
- The billing and push notification systems have robust, well-documented recovery paths from multiple edge cases — these are the most mature modules.
- The game engine's coordinator pattern is elegantly distributed but relies on broadcast ordering guarantees that Supabase does not provide.
- The setting sync gap (CONTEXT says Supabase sync exists, code shows only localStorage) is one of several documentation-implementation inconsistencies.
