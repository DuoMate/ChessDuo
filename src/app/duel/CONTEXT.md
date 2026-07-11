# Module: 1v1 Duel Page

## Purpose
Standard 1v1 chess duel mode — solo decision-making with a single opponent.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — dynamic import of DuelGame component with Suspense |

## Logic & Decisions
- Lazy-loaded via `next/dynamic` with `ssr: false`.
- Wraps DuelGame in `ErrorBoundary` and `Suspense`.
- Uses `useNavigationGuard()` during active duel.
- Supports bot opponent and human opponent modes.

## Dependencies
- `@/components/DuelGame` — the duel game component
- `useNavigationGuard` — prevents back-navigation
