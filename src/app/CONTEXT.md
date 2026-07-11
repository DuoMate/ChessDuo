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

## Dependencies
- Next.js 16 App Router, Supabase Auth, Razorpay SDK
