# Module: App Router Pages

## Purpose
Next.js App Router routes, root layout, global providers, CSS, and API endpoints. Each route directory is a standalone page module.

## Files at This Level
| File | Purpose |
|------|---------|
| `layout.tsx` | Root server layout — wraps all pages |
| `providers.tsx` | Client providers (Toast, Network, Suspense) |
| `globals.css` | Tailwind v4 CSS with custom theme variables |
| `page.tsx` | Home page (marketing + session check) |
| `loading.tsx` | Global loading fallback |
| — | Proxy/middleware at `src/proxy.ts` |

## Sub-modules
| Module | Context |
|--------|---------|
| `(main)/` | `src/app/(main)/CONTEXT.md` — Shared layout (HomeBottomNav + SlideOvers) for non-game pages |
| `game/` | `src/app/game/CONTEXT.md` — Main 2v2 game page (no bottom nav) |
| `duel/` | `src/app/duel/CONTEXT.md` — 1v1 duel page (no bottom nav) |
| `api/` | `src/app/api/CONTEXT.md` — API routes |

## Logic & Decisions
- Game pages use `next/dynamic` with `ssr: false` — chess libraries are browser-only.
- `providers.tsx` is the single source of truth for client context. No other layout wrappers.
- `middleware.ts` redirects unauthenticated users away from `/game`.
- Home page MUST NOT return `null` during session check — always show loading UI.
- Home page (`page.tsx`) uses a mockup-based dark layout with: HeaderBar (logo centered, image mark), TimePills (time selector), GameModeCard (Quick Play/Duo/Four Players — single click selects, double-click starts), PlayButton (green gradient, enabled when mode selected), BotDifficultySelector (5-card grid with Lucide chess-piece icons, visible for Quick Play and Duo only), ColorPicker (3-card White/Black/Random selector with Lucide icons, visible for Quick Play and Duo only), and HomeBottomNav (floating pill style).
- Non-game-room pages (history, profile, premium, privacy, terms, delete-account, four-player) are in the `(main)/` route group and share a layout with HomeBottomNav + SlideOver panels for Profile, Friends, and History.
- Dynamic routes `challenge/[code]`, `invite/[userId]`, `replay/[gameId]` are at root level (not in `(main)/`) because they need server component `page.tsx` with `generateStaticParams()` for static export.
- Pages in `(main)/` use `BackButton` instead of `HomeButton` for smart back navigation (`router.back()` with fallback to home).
- All pages in `(main)/` have `pb-20` spacing to prevent overlap with the fixed-position HomeBottomNav.
- Game rooms (`/game`, `/duel`) do NOT show HomeBottomNav — they have their own `BoardBottomNav`.

## Recent Changes
- **2026-08-01**: Legal pages — added `/terms` (Terms of Service) page and updated `/privacy` (added Creem payment processor, corrected Cloudflare/Render hosting, Terms cross-link). Legal links added to Profile page and a home-page footer. Meets Creem's requirement for valid Privacy Policy + Terms of Service URLs.
- **2026-07-31**: **Bug 39 + deep-link fixes**. Home page (`page.tsx`) auto-join (`/?code=` param) and both join paths no longer read the RLS-locked `room_players` table before joining — the joiner's team is derived from the room's new `host_team` column (opposite) and team/fullness comes from the public `get_room_join_state` RPC (`white_count`/`black_count`). Room lookups also filter on `expires_at`. The `?code=` param is stripped from the URL only after a successful `router.push`. `challenge/[code]` join now uses the pre-created `room_id` from the challenge row (creator WHITE + acceptor BLACK), falls back to `generateRoomCode()` if it's gone, and routes by `challenge.game_mode` (`/duel` for pre-created rooms, else `/game`). `invite/[userId]` now requires an explicit "Send Friend Request" confirmation instead of auto-sending on page load. `replay/[gameId]` shows a sign-in prompt (via `Auth`) for logged-out users instead of "Game Not Found".
- **2026-07-31**: **Bug 37/38** fixes — share links are now always clickable HTTPS App Links (never the `chessduo://` custom scheme, which is non-clickable in chat apps); native premium checkout returns to the app via the new `/api/creem/return` redirect bridge → `chessduo://premium?session_id=…` → `/premium` verifies the session and shows the premium state.
- **2026-07-31**: Bug 34 fix — `public/.well-known/assetlinks.json` now lists the **Play App Signing** key SHA-256 fingerprint (from Play Console) instead of the upload keystore fingerprint, so Android App Links verification succeeds and invite links open the app instead of the browser. CI (`build-release.yml`) now **validates** the committed fingerprint against the `ASSETLINKS_SHA256` secret instead of regenerating it from the upload keystore. Native share links use the `chessduo://` custom scheme as a zero-verification fallback.
- **2026-07-30**: Creem billing migration — replaced Google Play Billing with Creem (Merchant of Record) for web + Android. `providers.tsx` now sets `CreemBillingProvider`; premium purchases redirect to Creem-hosted checkout. New API routes `/api/creem/checkout`, `/api/creem/products`, `/api/creem/subscriptions`, `/api/creem/webhook`. Removed `subscription/verify` and `subscription/rtdn`; `subscription/status` reads Supabase only.
- **2026-07-19**: Logo replacement — HeaderBar description updated to note image mark instead of Crown icon.
- **2026-07-14**: Dark mode CSS variables updated in `globals.css` — page background changed from `#060816` to `#0a0e1a`, surface from `rgba(18,23,42,0.9)` to `rgba(15,23,42,0.8)`, border from `rgba(148,163,184,0.22)` to `rgba(255,255,255,0.06)`, secondary from `#818cf8` to `#3b82f6`, success from `#34d399` to `#22c55e`. All redesigned pages (Friends, Profile, Premium, History) use the new palette.
- **2026-07-14**: Restored PlayButton above BotDifficulty — single click selects a mode (blue highlight), double-click or Play starts the game. No-scroll layout (`h-screen overflow-hidden`, compact spacing). PlayButton + BotDifficulty visible for Quick Play/Duo; 4 Player shows PlayButton only. BotDifficulty hidden for 4 Player.
- **2026-07-14**: HomeBottomNav changed to floating pill style (rounded-2xl, centered, 12px from bottom, glassmorphism shadow).
- **2026-07-14**: WelcomeDisclaimer instruction screen now shows "Your Move" (green) + "Teammate"/"Bot" (blue) legend below the chess board.
- **2026-07-14**: WelcomeDisclaimer back button fixed — hardware back dismisses modal instead of exiting app. Same fix applied to FourPlayerLobby.
- **2026-07-14**: Unread message polling reduced from 10s to 30s (`page.tsx`). Saves 66% idle DB queries per user.
- **2026-07-15**: Pre-launch security hardening — Razorpay client-side trust gap fixed (DB writes removed from checkout handler). Security headers added to `_headers`. PWA manifest + favicon + Open Graph metadata added. Crash endpoint wired in SplashHandler. Push notification opt-out toggle in SettingsPanel. RLS "Allow all" gap documented.
- **2026-07-15**: Fixed push notification startup crash — added `.catch()` to `registerCapacitorAuthListener()`, deferred `PushNotifications.requestPermissions()` by 500ms to avoid race with `SplashScreen.hide()`. Added `POST_NOTIFICATIONS` permission to AndroidManifest.xml. Ran `npx cap sync android` to include `@capacitor/push-notifications` and `@capacitor/browser` native plugins.
- **2026-07-14**: Added push notification module — `NotificationHandler` and `initPushNotifications()` wired into `providers.tsx`. New API routes at `/api/push/register` and `/api/push/send`.
- **2026-07-13**: Moved `challenge/[code]`, `invite/[userId]`, `replay/[gameId]` OUT of `(main)/` route group to root level. Reason: `(main)/layout.tsx` is `'use client'` which prevents `generateStaticParams()`. Fixed static export build by using placeholder params `[{param: 'placeholder'}]` instead of `[]` (Next.js 16 Turbopack does not properly detect empty `generateStaticParams()`). Renamed `middleware.ts` to `proxy.ts` (Next.js 16 deprecation).
- **2026-07-13**: Created `(main)/` route group for non-game-room pages. Pages moved: history, profile, premium, privacy, delete-account, four-player. Shared layout provides HomeBottomNav + SlideOvers (Profile/Friends/History). `BackButton` replaces `HomeButton` for smart back. History tab opens SlideOver. Taglines fixed: Duo → "You + Friend vs Bots", Four Players → "Friends Battle".
- **2026-07-12**: Board page revamp — dark glassmorphism theme, 80% board, new `BoardTopBar` + bottom nav + pending moves row + confirm move button + inline `MoveResolvedInline` + round history sidebar. New `confirmMove` setting (off by default). All three game pages (Game.tsx, DuelGame.tsx, ReplayView.tsx) share the new shell. Quick Play is rendered as `You + WhiteBot vs BlackBot` (one bot per side) — see `src/components/CONTEXT.md` for the visual collapse.
- **2026-07-11**: Complete home page UI revamp — new mockup-based layout with HeaderBar, TimePills, GameModeCard, BotDifficultySelector, PlayButton, and HomeBottomNav components. Dark theme (#0a0e1a background), blue accent for selected states, green gradient Play button. Added 3-minute time option. Bot difficulty now global on home page. Bottom nav on home page only.
- **2026-07-13**: Added shadow CSS variables to `globals.css` (`--shadow-glow-blue-strong`, `--shadow-glow-blue-light`, `--shadow-glow-blue-dot`, `--shadow-glow-green`, `--shadow-glow-green-strong`, `--shadow-glow-emerald`, `--shadow-glow-emerald-strong`, `--drop-shadow-glow-blue`). Replaced hardcoded rgba shadows in page.tsx. Converted all static inline `style={{}}` for minHeights to Tailwind classes. Normalized avatar `width`/`height` attributes to 40px. Moved `SplashHandler` into `providers.tsx`. Added `/history` to middleware auth matcher.
- **2026-07-17**: Fixed push notifications and subscription auth timing — `initPushNotifications` and `SubscriptionService.initialize()` now only run after `onAuthStateChange` confirms a valid session token. Prevents empty-token calls from blocking future registration attempts.
- **2026-07-17**: Fixed RLS bypass in all API routes — Bearer token auth path now passes user's JWT to `createClient` via `global.headers.Authorization`, ensuring `auth.uid()` works correctly in RLS policies for DB operations.

## Dependencies
- Next.js 16 App Router, Supabase Auth, Creem (billing)
