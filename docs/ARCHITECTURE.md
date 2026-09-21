# ChessDuo Architecture & Conventions Guide

> **The Bible** — every commit must follow these patterns. Break nothing listed here without updating this doc.

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (server component)
│   ├── providers.tsx             # Client-side providers (Toast, Network, Suspense)
│   ├── page.tsx                  # Home page
│   ├── loading.tsx               # Global loading fallback
│   ├── game/page.tsx             # /game → dynamic(lazy) Game component
│   ├── duel/page.tsx             # /duel → dynamic(lazy) DuelGame component
│   ├── replay/[gameId]/page.tsx  # /replay → dynamic(lazy) ReplayView component
│   ├── (main)/                   # Route group for non-game pages
│   │   ├── layout.tsx            # Shared layout (DesktopSidebar + HomeBottomNav)
│   │   ├── history/page.tsx      # Match history
│   │   ├── profile/page.tsx      # User profile
│   │   ├── friends/page.tsx      # Friends list + chat
│   │   ├── settings/page.tsx     # App settings
│   │   ├── premium/page.tsx      # Premium upsell
│   │   ├── privacy/page.tsx      # Privacy policy
│   │   ├── delete-account/page.tsx # Account deletion flow
│   │   └── four-player/page.tsx  # 4-player lobby
│   ├── invite/[userId]/page.tsx  # Friend invite landing
│   └── challenge/[code]/page.tsx # Challenge link landing
│
├── components/                   # React components (co-located by feature)
│   ├── Game.tsx                  # Main 2v2 game (online + offline) — board-page revamp v2
│   ├── DuelGame.tsx              # 1v1 duel mode — board-page revamp v2
│   ├── ChessBoard.tsx            # Chess board + annotations
│   ├── MobileChessBoard.tsx      # Touch-optimized board for Capacitor
│   ├── GameOverModal.tsx         # End-game result modal
│   ├── GameLobby.tsx             # Matchmaking lobby
│   ├── GameLoading.tsx           # Pre-game waiting state
│   ├── GameMenu.tsx              # In-game menu (resign, settings)
│   ├── MovePlayback.tsx          # Timeline scrubber
│   ├── MoveComparison.tsx        # Side-by-side move comparison
│   ├── TeamTimer.tsx             # Team-level countdown timer
│   ├── MatchTimer.tsx            # Match-level countdown timer (circular SVG)
│   ├── SettingsPanel.tsx         # Settings slide-over
│   ├── ResignConfirmModal.tsx    # Resign confirmation
│   ├── LeaveConfirmModal.tsx     # Leave game confirmation
│   ├── MatchmakingQueue.tsx      # Queueing UI
│   ├── AnalyzingIndicator.tsx    # Stockfish thinking spinner
│   ├── EvaluatingLoader.tsx      # Full-screen evaluation loader
│   ├── SlideOver.tsx             # Generic slide-over container
│   ├── Auth.tsx                  # Auth form (login/signup)
│   ├── ChooseUsername.tsx        # Username selection post-signup
│   ├── WelcomeDisclaimer.tsx     # First-time welcome modal
│   ├── GameTour.tsx              # Onboarding tutorial
│   ├── ChallengePicker.tsx       # Challenge mode/time picker
│   ├── InsightsGate.tsx          # Premium insight gate — uses `SubscriptionService.isPremium()`
│   ├── TeamIndicator.tsx         # Team crown/bot icons — legacy, replaced by `BoardTopBar`
│   ├── TurnStatusArea.tsx        # Turn phase indicator
│   ├── CapturedPieces.tsx        # Captured pieces display
│   ├── NetworkOverlay.tsx        # Offline connection banner
│   ├── ErrorBoundary.tsx         # React error boundary
│   ├── Toast.tsx                 # Toast notification system
│   ├── PromotionModal.tsx        # Pawn promotion selector
│   ├── InitialsAvatar.tsx        # Shared initials avatar (sm/md/lg, online indicator, premium variant)
│   ├── ColorPicker.tsx           # 3-card White/Black/Random selector with Lucide icons
│   ├── DesktopSidebar.tsx        # Left vertical nav for browser (Home/History/Friends/Profile, 220-240px)
│   ├── SidebarNav.tsx            # Legacy narrow sidebar (80-88px) — kept for reference
│   ├── BottomNav.tsx             # Mobile bottom navigation (used by DuelGame/ReplayView)
│   ├── MobileStatusBar.tsx       # Mobile safe-area wrapper
│   ├── ProfilePanel.tsx          # Profile + stats view — dark theme redesign (in-game slide-over; shares RateChessDuoRow with /profile)
│   ├── RateChessDuoRow.tsx       # Shared Rate ChessDuo row — Play Store rating entry (ProfilePanel + /profile)
│   ├── HistoryPanel.tsx          # Match history list — dark theme redesign
│   ├── FriendsPanel.tsx          # Friends list + requests + chat — dark theme redesign
│   ├── ChatPanel.tsx             # In-app messenger
│   ├── BoardTopBar.tsx           # Board-page revamp — team avatars row + center timer card + turn pill + in-flow thinking hint (isThinking, never over board)
│   ├── GameSections.tsx          # Memoized GameTopBarSection (isThinking passthrough) + GameBoardSection (board only, no overlay)
│   ├── TeamHexagon.tsx           # Board-page revamp — decorative team-position hexagon
│   ├── PendingMovesRow.tsx       # Board-page revamp — Your Move / Teammate status cards
│   ├── ConfirmMoveButton.tsx     # Board-page revamp — gated by `useSettings().confirmMove`
│   ├── MoveResolvedCard.tsx      # Board-page revamp — 3-column resolution modal
│   ├── RoundHistorySidebar.tsx   # Board-page revamp — right-side panel of past rounds
│   ├── BoardBottomNav.tsx        # Board-page revamp — 5-tab in-game nav (Moves/Game/Surrender/Insights/Chat)
│   └── __tests__/                # Component tests (co-located)
│
├── features/                     # Domain logic (framework-free)
│   ├── shared/                   # Shared across game modes
│   │   ├── GameInterface.ts      # ✨ Shared interface for LocalGame + OnlineGame
│   │   ├── gameConstants.ts      # Magic numbers (CHECKMATE_SCORE, timer defaults)
│   │   └── accuracy.ts           # Accuracy calculation (lichess formula)
│   ├── game-engine/              # Core chess engine
│   │   └── gameState.ts          # Board state, pending moves, timers
│   ├── offline/game/             # Local 2v2 game
│   │   └── localGame.ts          # LocalGame class
│   ├── online/game/              # Real-time multiplayer game
│   │   └── onlineGame.ts         # OnlineGame class
│   ├── bots/                     # Bot players
│   │   ├── chessBot.ts           # Bot move generation
│   │   ├── botConfig.ts          # ELO-based difficulty config
│   │   ├── difficulty.ts         # Difficulty presets
│   │   └── openings.ts           # Opening book
│   ├── mobile-engine/            # Stockfish evaluator factory
│   │   ├── BrowserMoveEvaluator.ts  # Local WASM Stockfish wrapper
│   │   └── evaluatorFactory.ts      # Picks evaluator per platform
│   ├── push-notifications/       # Push notification module
│   │   ├── types.ts              # NotificationType, PushPayload types
│   │   ├── PushNotificationService.ts  # FCM token registration + sending
│   │   ├── NotificationHandler.tsx      # Deep-link on notification tap
│   │   ├── index.ts              # Public API (initPushNotifications, notify*)
│   │   └── CONTEXT.md            # Module documentation
│   ├── billing/                  # Subscription billing (provider-agnostic)
│       ├── types.ts              # BillingProvider interface, SubscriptionPlan, PurchaseResult
│       ├── SubscriptionService.ts # High-level API: purchase/restore/isPremium/getPlans
│       ├── SubscriptionStateMachine.ts # Pure lifecycle transitions
│       ├── GooglePlayBillingProvider.ts  # Google Play Billing integration (Android)
│       ├── index.ts              # Public API re-exports
│       ├── CONTEXT.md            # Module documentation
│   └── app-update/               # App version check + Play In-App Update (framework-free)
│       ├── appVersion.ts         # decideUpdate (versionCode-first, semver fallback; never blocks in v1)
│       ├── versionManifest.ts    # fail-silent manifest fetch (no-store, bounded timeout; fallback only)
│       ├── index.ts              # Public API re-exports
│       └── CONTEXT.md            # Module documentation
│
├── hooks/                        # React hooks
│   ├── useIsMobile.ts            # Viewport breakpoint hook
│   ├── useNavigationGuard.ts     # Prevent accidental navigation
│   └── useNetworkStatus.ts       # Online/offline detection
│
├── lib/                          # Utilities & services
│   ├── supabase.ts               # Supabase client
│   ├── nativeAd.ts               # Web-safe bridge for bounded Android Native Advanced ads
│   ├── gamePersistence.ts        # Room state persistence
│   ├── matchHistory.ts           # Completed game storage
│   ├── messages.ts               # Chat message CRUD
│   ├── roomActions.ts            # Room management
│   ├── settings.ts               # User settings (theme, sound)
│   ├── sounds.ts                 # Sound effect engine
│   ├── chessUtils.ts             # move parsing, UCI/SAN conversion
│   ├── subscriptionManager.ts    # Supabase channel lifecycle
│   └── __tests__/                # lib tests (co-located)
│
└── app/globals.css               # Global Tailwind styles
```

---

## Architecture Patterns

### 1. Shared Game Interface (`src/features/shared/GameInterface.ts`)

**RULE**: Both `OnlineGame` and `LocalGame` MUST implement the shared `GameInterface`. Game.tsx types all game references against this interface — never use `as any` to access game methods.

```typescript
// ✅ CORRECT — type against the shared interface
const g = isOnline ? onlineGameRef.current : gameRef.current
const moves = (g as GameInterface).getAllPendingMoves()

// ❌ WRONG — never use `as any` to hack around missing methods
const moves = (g as any).getAllPendingMoves()
```

**When adding a new game method**:
1. Add it to `GameInterface` first
2. Implement it in BOTH `OnlineGame` and `LocalGame`
3. Use it in `Game.tsx` via the interface (with `as GameInterface` cast if needed)

**Methods that are NOT on the interface** (class-specific):
- `OnlineGame`: `joinRoom()`, `broadcastMove()`, `broadcastLocked()`, `getCoordinatorId()`, `setTurnState()`, `waitForTeammateLock()`, `isCoordinator()`
- `LocalGame`: `addPlayer()`, `selectMove()`, `lockMove()`, `resolveLegacy()`

> **Note**: `lastMoveComparison` and `lastHumanResolution` ARE on the interface
> (see ADR-005). Do not duplicate them as class-specific getters — use the
> interface types (`(g as GameInterface).lastHumanResolution`).

### 2. Page-Level Code Splitting

**RULE**: All large game components MUST be lazy-loaded with `next/dynamic`. Pages are client components using `useSearchParams()`, wrapped in `<Suspense>`.

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const GameComponent = dynamic(() => import('@/components/Game').then(mod => ({ default: mod.Game })), {
  loading: () => <Spinner />,
  ssr: false,
})

function GameContent() {
  const searchParams = useSearchParams()
  const level = searchParams.get('level')

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <GameComponent level={level} ... />
    </ErrorBoundary>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GameContent />
    </Suspense>
  )
}
```

**Critical**: `ssr: false` requires a `'use client'` component. `useSearchParams()` requires `<Suspense>` boundary. Both are mandatory for game page routes.

### 3. Toast Notification System

**RULE**: Every component that handles game events MUST use `useGameToast()`. The toast system is centrally wired in `providers.tsx`.

```typescript
const toast = useGameToast()

// Game events:
toast.moveLocked()           // Player locks their move
toast.resolutionComplete(w)  // Winner announced
toast.gameOver(result)       // Game ends
toast.connectionLost()       // Network drops
toast.warning('msg')         // Non-critical warning
```

**Do NOT** use `alert()`, `console.error()` for user-facing messages, or inline `<div>` for notifications.

### 4. Navigation Guard

**RULE**: Any page with an active game MUST use `useNavigationGuard()` to prevent accidental back-button/tab-close.

```typescript
const { confirmLeave } = useNavigationGuard({
  enabled: gameState.status === GameStatus.PLAYING,
  onAttemptLeave: () => toast.warning('You are leaving an active game!'),
})
```

**Back-navigation rules (2026-09-17 audit):**
- Prefer the app router (`router.back()` / `router.replace()`). Never blind
  `window.history.back()` or `window.location = "/home"`.
- `router.back()` only via `canGoBackSafely()` (`src/lib/navigation.ts`: `history.length > 2`
  plus same-origin `document.referrer` check) so Back never lands on Google OAuth
  consent, auth callbacks, or external pages. Fall back to an in-app route (usually `/`).
- Every full-screen route must have a hardware-back handler or inherit
  `(main)/layout` — an empty `useCapacitorBackButton` stack calls `App.exitApp()`.
- Upgrade / Back-to-Home / auth-follow use `router.replace` (no history pollution,
  so `Upgrade → Back → Home`). Game entry from lobby/challenge uses `replace`;
  `History → Replay` uses `push` so Back returns to History.
- Active-match Back/Leave + resignation converge on the terminal game-over
  lifecycle (§9) before navigation; lobby leave may navigate immediately.
- In-game overlays (Moves/Insights/Chat/Settings/Resign) close first on Back —
  web via `useNavigationGuard(hasOpenOverlay + onOverlayBack)`, Android via
  `useCapacitorBackButton` — without touching board/engine state.

### 5. Network Detection

**RULE**: The `NetworkOverlay` component is rendered globally in `providers.tsx`. No page needs to add its own offline banner.

### 6. Constants & Magic Numbers

**RULE**: All magic numbers used in 3+ places MUST live in `src/features/shared/gameConstants.ts`.

| Constant | Value | Usage |
|----------|-------|-------|
| `CHECKMATE_SCORE` | 10000 | Checkmate evaluation sentinel |
| `DEFAULT_TEAM_TIMER_SECONDS` | 600 | Default match timer |
| `DEFAULT_MOVE_TIMER_SECONDS` | 10 | Team turn timer |
| `ROOM_EXPIRY_MS` | 86400000 | Room auto-cleanup (24h) |
| `DEFAULT_POLLING_INTERVAL_MS` | 2000 | Matchmaking poll |

**Do NOT** hardcode `600`, `10000`, or `2000` in game logic. Import the constant.

### 7. Billing Provider Abstraction

**RULE**: UI and `SubscriptionService` MUST NOT depend on the payment processor directly. All payment logic goes through the `BillingProvider` interface (`src/features/billing/types.ts`). Currently backed by Google Play Billing for Android. Web users are directed to download the Android app for premium features.

```
UI (React Components)
  │  talks ONLY to SubscriptionService
  ▼
SubscriptionService
  ├─► BillingProvider (interface)
  │     └─► GooglePlayBillingProvider   ← Android (native Google Play dialog)
  └─► /api/subscription/status  (reads from Supabase)
```

- Purchase is **native**: `purchase()` → Google Play Billing dialog via `@capgo/native-purchases` Capacitor plugin → Google Play processes payment → result returned to the app.
- Subscription status is read from Supabase `profiles` table (set by webhooks or native purchase callbacks).
- Web users see a "Download on Google Play" CTA instead of purchase buttons — `GooglePlayBillingProvider.isAvailable()` returns `false` on web.
- Pricing comes from Google Play product definitions; plans are `premium_monthly` / `premium_yearly`.

### 8. Room Join Model (RLS-safe)

**RULE**: A player joining a room must NEVER read `room_players` before they are a member — the RLS policies allow room members only, so a joiner gets an empty result set and the wrong team (this was Bug 39: `/?code=` invite links always placed the joiner on the host's team).

**Why it works**:
- The host's team is stored on the `rooms` row as `host_team` (`WHITE`/`BLACK`) at creation time (see `createOnlineRoom`, matchmaking queue, challenge pre-created rooms). The joiner derives their team as the **opposite** of `host_team` — no pre-join DB read required.
- Team/fullness decisions (`white_count`/`black_count`, "room is full") come from the public SECURITY DEFINER RPC `get_room_join_state(p_room_id)` in `supabase/tables.sql`, not from a `room_players` select.
- Join inserts use `room_players.upsert(..., { onConflict: 'room_id,player_id' })` — safe for rejoin and idempotent.
- Challenge links: duel challenges pre-create a room + `duel_games` row and store `room_id` on the challenge; the acceptor joins THAT room (creator WHITE, acceptor BLACK) so both players meet in the same match. A `generateRoomCode()` fallback creates a fresh room if the pre-created one is gone.

### 8.1 Canonical Supabase Read Path (RLS + RPC)

**RULE**: All membership-gated reads go through the canonical helpers — never hand-roll per-row auth checks. `is_room_member`, `can_join_room`, `get_room_join_state` are `SECURITY DEFINER ... SET search_path TO 'public'` and marked `STABLE` (pure reads, safe to inline); `join_room_by_code` / `get_room_players` stay `VOLATILE` (writes / ordered side effects — never mark STABLE). RLS predicates use the init-once form `(select auth.uid())` / `(select auth.role())` — same logic as bare `auth.uid()`, evaluated once per statement instead of once per row. RLS stays enabled everywhere; nothing is widened (only the duplicate `completed_games` authenticated-SELECT was dropped in favor of the public `true` policy). Migrations live in `supabase/migrations/` and are applied manually in the Supabase dashboard (never auto-applied by the app).

### 9. Native AdMob Integration

**RULE**: Game-over ads use an Android Native Advanced ad, never a full-screen interstitial.

- `src/lib/nativeAd.ts` is the web-safe Capacitor bridge. Web builds and missing IDs are no-ops.
- `NativeAdSlot` is rendered inside the existing `GameOverModal` (Quick/Duo), inside the Coach Mode inline game-over modal (Coach has its own modal and never uses `GameOverModal`), and on the non-premium Premium upgrade screen. Each visible surface owns one slot; native preload is globally single-flight and may reuse an unconsumed ad, so the upgrade screen does not require a new network request when one is already loaded. Never render duplicate slots in the same surface or create a second ad unit, bridge, or interstitial. It waits for a successful preload and hides on no-fill, SDK failure, offline state, or premium entitlement.
- Active-match Back/Leave and resignation must converge on the existing terminal game-over lifecycle before navigation. Quick/Duo/Duel use `GameOverModal`; Coach uses its inline terminal overlay. Lobby leave may navigate immediately because no match result exists.
- Native-ad preload is single-flight: concurrent callers share one request, and a loaded ad is consumed only after a successful native render. Diagnostics use `[ADS][GAMEOVER]` for terminal surfaces and `[ADS][UPGRADE]` for the Premium upgrade surface.
- Android is generated during builds. `scripts/install-native-ad.sh` copies `android-patches/NativeAdPlugin.java`, adds the Google Mobile Ads SDK, and injects `NEXT_PUBLIC_ADMOB_APP_ID` into the manifest.
- `NEXT_PUBLIC_ADMOB_NATIVE_ID` must be a Native Advanced ad unit. `NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID` is not used for bounded popup placement.
- Native ad loading and teardown are best effort and never gate game-over state, navigation, or popup controls.
- Ad content rating is capped at Teen, enforced in code: `NativeAdPlugin.initializeSdk()` applies `RequestConfiguration.setMaxAdContentRating(MAX_AD_CONTENT_RATING_T)` (centralized `MAX_AD_CONTENT_RATING` constant in `android-patches/NativeAdPlugin.java` — the single policy point) before `MobileAds.initialize()`. Defense-in-depth with the AdMob Console setting (also T); the SDK request-level filter overrides the console value. G/PG/T allowed, MA excluded. T is a maximum filter, not a per-ad appropriateness guarantee. Verify via Ad Inspector that requests carry the rating.

### 9.1 Web AdSense Game-Over Parity

**RULE**: Web game-over ads mirror the Android native system exactly, with the platform gate inverted — one manual responsive display unit, never Auto ads, never an interstitial or vignette.

- `src/lib/webAds.ts` mirrors `nativeAd.ts`: env-gated IDs, `canUseWebAds()` true only on web (`!Capacitor.isNativePlatform()`), best-effort `pushWebAd()` that never throws (ad blockers included). Missing IDs are no-ops.
- `AdSenseLoader` (mounted in `layout.tsx <head>`) loads `adsbygoogle.js` once, gated by `usePremium()` + web platform + client ID — premium and native users download no ad script.
- `AdSenseSlot` is rendered beside `NativeAdSlot` in `GameOverModal`, the Coach inline modal, and the non-premium Premium upgrade screen, with the same suppression semantics and an explicit surface label. The upgrade screen is a separate visible surface and makes at most one `push({})` request per open cycle; never render duplicate slots in the same surface. Auto ads remain off.
- The `<ins>` uses Tailwind `block w-full` instead of Google's `style="display:block"` (identical rendering, satisfies the no-`style={{}}` rule); all other `data-*` attributes match the approved unit verbatim.
- `public/ads.txt` carries the AdSense line; `app-ads.txt` stays AdMob-only. `_headers` CSP allowlists `pagead2.googlesyndication.com` + `googleads.g.doubleclick.net`.
- Secrets `NEXT_PUBLIC_ADSENSE_CLIENT_ID` / `NEXT_PUBLIC_ADSENSE_SLOT_ID` are wired in `deploy-cf-pages.yml` only (web build); `build-release.yml` stays AdMob-only. Diagnostics use `[ADS][GAMEOVER]` for terminal surfaces and `[ADS][UPGRADE]` for the Premium upgrade surface, with `source: 'adsense'` on web.

### 10. App Version Check + Play In-App Update (flexible)

**RULE**: The Android app bundles `out/` at build time, so Cloudflare web deploys never reach installed apps without a Play Store update. Update detection is **native-first**: Google Play In-App Updates (`AppUpdateManager`, FLEXIBLE) is the authoritative per-account source of truth — never a hand-synced manifest (a stale manifest silently suppresses every prompt, and a fabricated one can never be rollout-aware). Native update flow is downloading-across-PiP-safe and never a runtime JS replacement (no OTA).

- **Native primary** — `android-patches/AppUpdatePlugin.java` (`@CapacitorPlugin(name="AppUpdate")`, installed by `scripts/install-app-update.sh`, registered in `scripts/patch-main-activity.sh`, dependency `com.google.android.play:app-update`):
  - `check()` → `AppUpdateManagerFactory.create(...).getAppUpdateInfo()` → reports `UPDATE_AVAILABLE` + `FLEXIBLE` allowed per this **device/account rollout**. Fail-silent: Play unavailable, sideload, or plugin-missing resolves to indeterminate (`updateAvailability UNKNOWN`), never a crash.
  - `startFlexibleUpdate()` → Google's official FLEXIBLE download flow (`startUpdateFlowForResult`); install-state events stream to the web layer via `stateChanged`.
  - `completeUpdate()` → finalizes a `DOWNLOADED` update (restart-to-install). Cancellation (`RESULT_CANCELED`) is a normal user choice — the app stays fully usable.
  - v1 policy is OPTIONAL-only (FLEXIBLE, never IMMEDIATE), mirroring `decideUpdate`.
- **`src/lib/nativeAppUpdate.ts`** mirrors `pip.ts`/`nativeAd.ts`: native-only, best-effort, never throws. `useAppUpdate` (`src/hooks/useAppUpdate.ts`) checks Play first; only when the native check is *indeterminate* (older APK without the plugin, web, degraded Play) does it fall back to the remote manifest `decideUpdate` path (`src/features/app-update/`). A definitive Play answer (available or not) is never second-guessed by the manifest.
- The manifest fallback remains fail-silent by contract: offline, timeout, HTTP error, or malformed payload resolves to `null`. Fetches use `cache: 'no-store'` with a bounded timeout. `public/version.json` is regenerated from `android-version.properties` at deploy time by `deploy-cf-pages.yml` so even the fallback is never stale.
- `UpdatePrompt.tsx` shows "Update" → starts the Play download; on `DOWNLOADED` it becomes "Restart to install" → `completeUpdate()`. "Later" and Play cancellation keep the app usable.
- The check runs async (never delays first paint), is throttled (no nagging every screen), and never fires during active games, auth/PKCE callbacks, or deep-link landings. Web always reports `current`.
- `openPlayListing()` (`src/lib/rateApp.ts`) remains the final fallback action (Play listing via `@capacitor/browser`, HTTPS): used when no native flow is startable. Do NOT use `window.open(url, '_system')` — the Capacitor WebView has no popup/new-window handler, so `market://` silently never fires. Never download APKs from an external server; never use Play Billing APIs for update detection (billing and updates are separate concerns).

### 11. Live-Game Picture-in-Picture (Android)

**RULE**: PiP is a presentation layer over the existing game — never a second game implementation.

- `android/` is generated; native PiP lives in the patch chain: `android-patches/PipPlugin.java` (`@CapacitorPlugin(name="Pip")`), installed by `scripts/install-pip.sh`, registered + forwarded in `scripts/patch-main-activity.sh`, manifest flags (`supportsPictureInPicture`, widened `configChanges`) in setup/build scripts. Never edit `android/` directly. The flag insertion targets the `<activity` **opening tag** (sed `0,/^[[:space:]]*<activity/…`) because the Capacitor template emits the manifest multi-line — a sed anchored on the `.MainActivity` name line is a silent no-op (PiP appeared broken-from-inception for exactly this reason).
- The plugin owns no chess state, no timers, no game logic. It tracks eligibility (set by web), enters PiP via framework APIs (auto-enter Android 12+), and emits `pipModeChanged` so React swaps the full shell for `PipOverlay`. Every method is fail-silent — PiP can never block moves, clocks, game-over, or navigation.
- Web bridge `src/lib/pip.ts` mirrors `nativeAd.ts`: native-only, best-effort, never throws, change-suppressed traffic. `shouldEnablePip()` is the pure eligibility rule (only `PLAYING`/`playing` + no blocking modal); `src/hooks/usePip.ts` publishes it and tracks mode. `PipOverlay` renders the live FEN (parsed defensively), a mapped turn label, and the existing `IsolatedMatchTimer` (move-count footer for untimed Coach).
- Eligibility call sites (`Game.tsx`, `DuelGame.tsx`, `CoachGame.tsx`) derive from existing status + existing overlay state only. `GAME_OVER` (any terminal) always revokes eligibility. No destructive PiP actions — tap returns to the existing game screen.
- Like all UI: `dark:` variants, `text-xs` minimum, co-located `__tests__/`. New game methods still go through `GameInterface` (PiP adds none).

### 12. Data-Fetch & Round-Trip Rules (Supabase perf)

**RULE**: Round trips dominate latency (tables are tiny — 1–54 rows each), so every screen shares one bundle per mount and selects narrow columns. Never `select('*')` on a list or poll path.

- History: `getHistoryPageWithStats()` — ONE `room_players` SELECT + ONE narrow-column `completed_games` SELECT (no `move_comparisons` JSONB) serves both the recent-games list and viewer-relative stats. Never `Promise.all([getMatchHistory(), getPlayerStats()])` (was 4 sequential hops with JSONB twice). Replay detail (`getCompletedGame`) keeps `select('*')` — it needs the comparisons.
- Friends: `getFriendsBundle()` — ONE `friendships` SELECT (explicit columns) + ONE `profiles.in(union)` split in memory into accepted/incoming/outgoing/blocked. Never 3× (friendships→profiles.in). Guard empty `.in()` lists (PostgREST rejects them) and cap per-status rows.
- Badge: capped `messages` sender fetch (`limit 200`, totals via `count-head`) shared across hook instances (module-level 5s share); realtime stays debounced. Never an unbounded full-table fetch just to count.
- Matchmaking: `findAvailableRoom` fetches `get_room_join_state` for candidates via `Promise.all` (order-preserving first-fit), never sequential await-in-loop.
- Game/live: roster/poll selects use explicit columns (`player_id` / `move_san` / narrow duel cols); duel 2s poll stays bounded.
- Profile: all single-user reads go through cached `fetchProfile()` (60s TTL, invalidated on upsert/update) — never a raw uncached `profiles SELECT` per mount (`page.tsx`, `FriendsPanel`, `Game`, `DuelGame` all share it).

### 13. Caching & Single-Flight Rules

**RULE**: Hot auth/premium state resolves once and is shared — TTLs skip redundant polling, realtime invalidation keeps correctness.

- Session: `AuthService.getSession()` is single-flight with a 5s shared cache; `onAuthStateChange` events clear it (sign-in/out/refresh observed immediately). No layer calls `supabase.auth.getSession()` directly (enforced by `architecture.test.ts`).
- Premium: `SubscriptionService` is single-flight with a 5-min TTL; `invalidate()` on `profiles UPDATE` realtime flip, purchase/restore/verify. Premium never blocks render (fail-closed `isPremium:false`, consumers null-out while loading).
- History stats: 60s `statsCache`, invalidated on save; `getHistoryPageWithStats` reuses the cached value when warm.
- Realtime: subscription effects use `[]` deps with ref-compare (never re-subscribe on value flips); `RealtimeService.cleanupChannel` does `unsubscribe + removeChannel + manager.remove`; no per-send channel creation (detach after `messages` broadcast).

---

## Styling Conventions

### 1. Dark Mode is REQUIRED

**RULE**: Every component MUST support both light and dark themes. Use Tailwind's `dark:` prefix.

```html
<!-- ✅ CORRECT -->
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">

<!-- ❌ WRONG — dark-only, breaks in light mode -->
<div className="bg-gray-900 text-white">
```

### 2. Touch Targets ≥ 44px

**RULE**: All interactive elements (buttons, inputs, toggles) must have minimum 44×44px touch area.

```html
<!-- ✅ CORRECT -->
<button className="min-h-[44px] min-w-[44px]">

<!-- ❌ WRONG — below WCAG minimum -->
<button className="w-7 h-7">
```

### 3. Font Sizes ≥ 11px

**RULE**: No text smaller than `text-[11px]` (or `text-xs` / 12px for body). Tiny decorative labels are the only exception, and even those should be ≥ 11px.

```html
<!-- ✅ CORRECT -->
<span className="text-xs">Label</span>

<!-- ❌ WRONG — too small -->
<span className="text-[9px]">Label</span>
```

### 4. No Inline Styles (Prefer Tailwind)

**RULE**: Use Tailwind classes. Inline `style={{}}` is only acceptable for dynamic values (e.g., `style={{ left: computedPosition }}`).

### 5. No Hardcoded Hex Colors

**RULE**: Colors in JSX must use Tailwind classes. If you need a dynamic color, use CSS variables or the `style` prop with a clear comment explaining why it's dynamic.

```html
<!-- ✅ CORRECT -->
<span className="text-yellow-400 dark:text-yellow-300">

<!-- ❌ WRONG — bypasses theme -->
<span style={{ color: '#ffc107' }}>
```

### 6. No `z-index` > 50 Without Documentation

**RULE**: z-index values above 50 (z-50) must have a comment explaining WHY. Network overlay uses z-[100] — the only component that should be above modals.

---

## Code Conventions

### 1. ES Modules Only

**RULE**: NEVER use `require()`. All imports use ES module syntax.

```typescript
// ✅ CORRECT
import { Chess } from 'chess.js'

// ❌ WRONG  
const { Chess } = require('chess.js')
```

### 2. No Console.log in Production Paths

**RULE**: `console.log` statements are acceptable for debugging but should be minimized. Use `toast` for user-facing messages, `console.error` for actual errors, and `console.warn` for recoverable issues.

### 3. Empty Catch Blocks Must Log

**RULE**: Every `catch {}` block must either have a `console.warn/error` or a comment explaining why silence is acceptable.

```typescript
// ✅ CORRECT
try { parseMove() } catch { /* invalid move format — silently skip */ }

// ❌ WRONG — swallows errors silently  
try { parseMove() } catch {}
```

### 4. Supabase Channel Lifecycle

**RULE**: All Supabase real-time channels must be unsubscribed in cleanup (return value of useEffect). Use `subscriptionManager.register(channel)` to track for centralized diagnostics.

### 5. Test Co-location

**RULE**: Tests live in `__tests__/` directories next to the code they test. No `tests/` at the project root.

---

## Error Handling

### 1. Error Boundaries

**RULE**: Every page route SHOULD be wrapped in `ErrorBoundary`. At minimum, the game page (`/game`) requires it.

### 2. Loading States

**RULE**: Every page that fetches data MUST handle three states: loading, error, empty.

```typescript
if (loading) return <Spinner />
if (error) return <ErrorDisplay />
if (!data.length) return <EmptyState />
```

### 3. Home Page Session Check

**RULE**: The home page MUST NOT return `null` during session check. Always show a loading UI.

---

## Architecture Decisions (ADR)

### ADR-001: Shared GameInterface over Duplicate Code

**Decision**: Extract a shared `GameInterface` that both `OnlineGame` and `LocalGame` implement, rather than duplicating the game component logic (had 32 `as any` casts).

**Status**: IMPLEMENTED (2026-06-04)

### ADR-002: dynamic() over Static Imports for Game Components

**Decision**: Use `next/dynamic` with `ssr: false` for all game components. The chess engine and board libraries are browser-only.

**Status**: IMPLEMENTED (2026-06-04)

### ADR-003: Centralized Providers over Ad-hoc Wrappers

**Decision**: `src/app/providers.tsx` is the single source of truth for client-side context (Toast, Network, Suspense). No other layout wrappers.

**Status**: IMPLEMENTED (2026-06-04)

### ADR-004: Co-located Tests

**Decision**: Tests live in `__tests__/` alongside source, not in a separate top-level directory.

**Status**: Established (pre-existing)

### ADR-005: Resolution Ownership Model (Move Resolved panel)

**Decision**: Split engine resolution state into two interface members on `GameInterface`:
`lastMoveComparison` (board — latest resolution, any team) and `lastHumanResolution`
(panel — latest **human-team-owned** `MoveComparison`). Ownership is derived from the
existing team identity (`prevTurn === myTeam` live in `Game.tsx:817` and
`currentTeam === getTeam()/this._team` for persistence) and perspective via
`comparison.player1Id` vs `currentUserId` in `MoveResolvedInline:buildResolutionData`.
`Game.tsx` gates `setAccuracyComparison` on `myTeam === WHITE/BLACK` only
(no `!isFourPlayer || …`) so opponent/bot resolutions advance the board but never
overwrite the panel; the panel replaces only on the next own-team resolution and
is rehydrated from `games.last_human_resolution` JSONB on refresh/reconnect
(`gamePersistence.ts`, `onlineGame.ts:_finishResolution` + `handleTurnResolved` +
`syncGameState`, `Game.tsx` rehydration).

**Status**: IMPLEMENTED (2026-08-23)

### ADR-006: Idempotent Resolution & Divergence Policy

**Decision**: Client-local chess positions are *provisional* — they may lag the
authoritative game after a missed realtime event or an unreadable games row
(schema drift). Therefore:

1. **Legality gate before resolution** (`resolvePendingMoves`): every pending
   submission is probed against the turn-start FEN (`isMoveLegalAt`,
   `chessUtils.ts`) BEFORE evaluation. Any illegal move ⇒ `STATE_DIVERGENCE`:
   discard the turn (`startPendingTurn`), re-sync from the authoritative DB row,
   reopen submissions, throw a typed error for Game.tsx's uniform recovery.
   Never apply unvalidated data; never swallow-and-continue.
2. **Single-writer resolution**: `resolvePendingMoves` throws
   `RESOLVE_IN_PROGRESS` when re-entered while resolving. Duplicate triggers
   (executeMove / bot handlers / initial-bot effect) must no-op.
3. **Exactly-once application**: `_lastAppliedResolution {turnSequence,
   winningMove}` marks what was applied; equal-seq duplicates of the same move
   are no-ops in `handleTurnResolved`. The blind `board.move()` fallback was
   removed — direct application requires a legality probe first; illegal moves
   trigger authoritative re-sync instead.
4. **Clocks never mutate boards**: `handleTimerSync` advances time only — turn
   numbers advance exclusively via `handleTurnResolved`/`syncGameState`.
5. **Stale-authority guard**: `syncGameState` rolls the board back to the DB FEN
   only when the DB knows more chess (move_history ≥ local). A frozen/stale row
   can never drag a mid-game client backward.
6. **Schema-drift resilience**: `gamePersistence.ts` retries reads/writes once
   without optional columns on PGRST204 so board-critical state (fen,
   turn_number, coordinator_id) persists and loads even pre-migration.

**Status**: IMPLEMENTED (2026-08-23)

### ADR-007: Round-Trips over Indexes (Supabase perf audit)

**Decision**: Optimize Supabase latency by collapsing DB round trips and narrowing payloads first; add indexes only on `EXPLAIN ANALYZE` evidence. The 2026-09-19 audit proved tables tiny (1–54 rows) with good MVP index coverage — perceived slowness came from 18–24 hops per cold startup (5–8× `getSession`, ≤3× `GET /status`, history 4 hops with `limit 1000 + move_comparisons` JSONB, friends 7–8 hops, unbounded badge fetch), not execution time.

**Rules locked**: §8.1 canonical RPC/RLS path, §12 single-bundle + narrow-column lists, §13 single-flight session/premium/profile caches with realtime invalidation. RLS stays enabled; `(select auth.uid())` init-once form only. Duplicate-index drops ride in `supabase/migrations/2026-09-19_perf_rls_indexes.sql` (manual apply).

**Status**: IMPLEMENTED (2026-09-19)

---

## Pre-commit Checklist

Before pushing, verify:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — no NEW failures introduced
- [ ] All interactive elements have `min-h-[44px] min-w-[44px]`
- [ ] All components have `dark:` variants for background, text, and border colors
- [ ] No `require()` statements in source
- [ ] No `text-[9px]` or `text-[10px]` classes
- [ ] Game components imported via `dynamic()` in page files
- [ ] New game methods added to `GameInterface` and implemented in BOTH `OnlineGame` + `LocalGame`
- [ ] Magic numbers moved to `gameConstants.ts`
- [ ] No `as any` cast on game references (use `as GameInterface` instead)
- [ ] No `select('*')` on new list/poll queries (explicit columns; JSONB detail-only)
- [ ] New RPCs are `SECURITY DEFINER ... SET search_path TO 'public'` (`STABLE` only if pure read) with a `CONTEXT.md` entry
- [ ] New screens share one bundle per mount (§12) and reuse cached session/premium/profile (§13)

---

*Last Updated: 2026-09-21 — BOARD FIRST mobile gameplay layout (`GameBoardSection` responsive `boardMaxClassName` + `--game-chrome/--coach-chrome`; compact full-width Coach; Back/Fwd kept in `BoardBottomNav` — an intermediate `BoardMoveNav` relocation was reverted after it blocked the move-review exit and locked the board; desktop caps preserved) + docs/mobile-game-layout-audit.md; §10 update rewritten as native Google Play In-App Update (flexible): `AppUpdatePlugin.java` (AppUpdateManager per-account truth, `stateChanged`/`completeUpdate`, cancellation is a normal choice) + `src/lib/nativeAppUpdate.ts`, `useAppUpdate` native-primary with manifest only as an indeterminate-check fallback, `UpdatePrompt` Update→download→Restart; `openPlayListing` via `@capacitor/browser` (`_system` popup is a WebView no-op); §11 PiP manifest flag sed targets the `<activity` opening tag + post-write verification (PiP broken-from-inception) + docs/android-pip-rca.md + docs/android-update-rca.md; 2026-09-20 — PERF-01→06 DB/network perf (narrow selects/limits, game-critical poll narrowing with ADR-006 trace, parallel independent reads, overlap-skip + hidden-tab pause pre-game, dead-import hygiene; STOPs documented) + ADS-01→04 AdMob reliability (error plumbing + bridge lifecycle, MAX_AD_CONTENT_RATING_T centralized, bounded retry + refill + Java 1h expiry, consume→refill + discard + premium clear, terminal coverage verified); 2026-09-19 — ADR-007 Round-Trips over Indexes + §8.1 canonical RPC/RLS path + §12 data-fetch/round-trip rules + §13 caching/single-flight (history single-bundle, friends bundle, premium 5-min single-flight, session 5s cache, badge cap/share, matchmaking parallel, realtime cleanup); migration `supabase/migrations/2026-09-19_perf_rls_indexes.sql` (manual apply); 2026-09-18 — §10 App Version Check + Play Store prompt (`src/features/app-update/`: framework-free `decideUpdate` + fail-silent manifest fetch, v1 never blocks, no OTA); 2026-09-15 — Coach resignation now uses the shared confirmation flow; NativeAdSlot/AdSenseSlot also render on the non-premium Premium upgrade screen with a fresh request per surface; 2026-09-12 — §9 NativeAdSlot reuse in Coach inline game-over modal (daily-trial funnel) + `COACH_TRIAL_WINDOW_MS` shared constant; 2026-08-23 — ADR-006 Idempotent Resolution & Divergence Policy (legality gate, single-writer resolve, exactly-once application, stale-authority guard, schema-drift resilience); ADR-005 Resolution Ownership: lastMoveComparison (board) vs lastHumanResolution (panel), human-team gating + DB persistence (games.last_human_resolution)*
