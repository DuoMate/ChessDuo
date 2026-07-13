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
- Home page (`page.tsx`) uses a mockup-based dark layout with: HeaderBar (logo centered), TimePills (time selector), GameModeCard (Quick Play/Duo/Four Players), BotDifficultySelector, PlayButton (green gradient CTA), and HomeBottomNav.
- Non-game-room pages (history, profile, premium, privacy, delete-account, four-player) are in the `(main)/` route group and share a layout with HomeBottomNav + SlideOver panels for Profile, Friends, and History.
- Dynamic routes `challenge/[code]`, `invite/[userId]`, `replay/[gameId]` are at root level (not in `(main)/`) because they need server component `page.tsx` with `generateStaticParams()` for static export.
- Pages in `(main)/` use `BackButton` instead of `HomeButton` for smart back navigation (`router.back()` with fallback to home).
- All pages in `(main)/` have `pb-20` spacing to prevent overlap with the fixed-position HomeBottomNav.
- Game rooms (`/game`, `/duel`) do NOT show HomeBottomNav — they have their own `BoardBottomNav`.

## Recent Changes
- **2026-07-13**: Moved `challenge/[code]`, `invite/[userId]`, `replay/[gameId]` OUT of `(main)/` route group to root level. Reason: `(main)/layout.tsx` is `'use client'` which prevents `generateStaticParams()`. Fixed static export build by using placeholder params `[{param: 'placeholder'}]` instead of `[]` (Next.js 16 Turbopack does not properly detect empty `generateStaticParams()`). Renamed `middleware.ts` to `proxy.ts` (Next.js 16 deprecation).
- **2026-07-13**: Created `(main)/` route group for non-game-room pages. Pages moved: history, profile, premium, privacy, delete-account, four-player. Shared layout provides HomeBottomNav + SlideOvers (Profile/Friends/History). `BackButton` replaces `HomeButton` for smart back. History tab opens SlideOver. Taglines fixed: Duo → "You + Friend vs Bots", Four Players → "Friends Battle".
- **2026-07-12**: Board page revamp — dark glassmorphism theme, 80% board, new `BoardTopBar` + bottom nav + pending moves row + confirm move button + inline `MoveResolvedInline` + round history sidebar. New `confirmMove` setting (off by default). All three game pages (Game.tsx, DuelGame.tsx, ReplayView.tsx) share the new shell. Quick Play is rendered as `You + WhiteBot vs BlackBot` (one bot per side) — see `src/components/CONTEXT.md` for the visual collapse.
- **2026-07-11**: Complete home page UI revamp — new mockup-based layout with HeaderBar, TimePills, GameModeCard, BotDifficultySelector, PlayButton, and HomeBottomNav components. Dark theme (#0a0e1a background), blue accent for selected states, green gradient Play button. Added 3-minute time option. Bot difficulty now global on home page. Bottom nav on home page only.
- **2026-07-13**: Added shadow CSS variables to `globals.css` (`--shadow-glow-blue-strong`, `--shadow-glow-blue-light`, `--shadow-glow-blue-dot`, `--shadow-glow-green`, `--shadow-glow-green-strong`, `--shadow-glow-emerald`, `--shadow-glow-emerald-strong`, `--drop-shadow-glow-blue`). Replaced hardcoded rgba shadows in page.tsx. Converted all static inline `style={{}}` for minHeights to Tailwind classes. Normalized avatar `width`/`height` attributes to 40px. Moved `SplashHandler` into `providers.tsx`. Added `/history` to middleware auth matcher.

## Dependencies
- Next.js 16 App Router, Supabase Auth, Razorpay SDK
