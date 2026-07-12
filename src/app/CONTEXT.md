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
| `middleware.ts` | Auth guard — protects /game route |

## Sub-modules
| Module | Context |
|--------|---------|
| `game/` | `src/app/game/CONTEXT.md` — Main 2v2 game page |
| `duel/` | `src/app/duel/CONTEXT.md` — 1v1 duel page |
| `replay/[gameId]/` | `src/app/replay/CONTEXT.md` — Match replay page |
| `history/` | `src/app/history/CONTEXT.md` — Match history page |
| `profile/` | `src/app/profile/CONTEXT.md` — User profile page |
| `premium/` | `src/app/premium/CONTEXT.md` — Premium pricing page |
| `privacy/` | `src/app/privacy/CONTEXT.md` — Privacy policy page |
| `invite/[userId]/` | `src/app/invite/CONTEXT.md` — Friend invite landing |
| `challenge/[code]/` | `src/app/challenge/CONTEXT.md` — Challenge link landing |
| `four-player/` | `src/app/four-player/CONTEXT.md` — 4-player lobby |
| `delete-account/` | `src/app/delete-account/CONTEXT.md` — Account deletion |
| `api/` | `src/app/api/CONTEXT.md` — API routes |

## Logic & Decisions
- Game pages use `next/dynamic` with `ssr: false` — chess libraries are browser-only.
- `providers.tsx` is the single source of truth for client context. No other layout wrappers.
- `middleware.ts` redirects unauthenticated users away from `/game`.
- Home page MUST NOT return `null` during session check — always show loading UI.
- Home page (`page.tsx`) uses a mockup-based dark layout with: HeaderBar (logo centered, profile/messages icons), TimePills (horizontal time selector), GameModeCard (Quick Play/Duo/Four Players), BotDifficultySelector (global bot difficulty), PlayButton (green gradient CTA), and HomeBottomNav (Home/History/Friends/Profile tabs).

## Recent Changes
- **2026-07-12**: Board page revamp — dark glassmorphism theme, 80% board, new `BoardTopBar` + bottom nav + pending moves row + confirm move button + move resolved modal + round history sidebar. New `confirmMove` setting (off by default). All three game pages (Game.tsx, DuelGame.tsx, ReplayView.tsx) share the new shell.
- **2026-07-11**: Complete home page UI revamp — new mockup-based layout with HeaderBar, TimePills, GameModeCard, BotDifficultySelector, PlayButton, and HomeBottomNav components. Dark theme (#0a0e1a background), blue accent for selected states, green gradient Play button. Added 3-minute time option. Bot difficulty now global on home page. Bottom nav on home page only.

## Dependencies
- Next.js 16 App Router, Supabase Auth, Razorpay SDK
