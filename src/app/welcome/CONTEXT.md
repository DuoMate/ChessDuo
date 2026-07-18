# Module: Welcome Page

## Purpose
Onboarding instruction screen — shows how ChessDuo works with a chess board demo and 3-step explanation.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders WelcomeDisclaimer as a full page with mode support |

## Logic & Decisions
- Full-page route (was a modal overlay). Back button labeled "Skip" goes home.
- Accepts `?mode=online` (Teammate) or `?mode=offline` (Botmate) query parameter.
- On "Got it!" → sets `chessduo_welcome_dismissed` localStorage → redirects to `/`.
- Uses `useCapacitorBackButton` for hardware back.
- Loading state on "Got it!" button prevents double-clicks.
- Triggered on first visit when `showOnlineDisclaimer` or `!hasSeenOfflineDisclaimer` is true.

## Dependencies
- `@/components/ChessBoard` — demo board with highlight squares
- `@/components/BackButton` — "Skip" navigation
- `@/hooks/useCapacitorBackButton` — Android back

## Recent Changes
- **2026-07-18**: Created as full page route (was modal overlay). Supports `?mode=online` and `?mode=offline`. Added loading state on button. Removed WelcomeDisclaimer modal usage from page.tsx.
