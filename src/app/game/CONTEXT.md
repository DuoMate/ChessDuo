# Module: 2v2 Game Page

## Purpose
The main 2v2 team chess game. Supports both online (multiplayer via Supabase) and offline (local + bots) modes.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — dynamic import of Game component with Suspense |

## Logic & Decisions
- Lazy-loaded via `next/dynamic` with `ssr: false` — chess.js needs browser APIs.
- Wraps Game component in `ErrorBoundary` and `Suspense`.
- Passes `mode` and `level` from search params.
- Uses `useNavigationGuard()` to prevent accidental navigation during active game.
- Online mode: `OnlineGame` communicates via Supabase Broadcast/Presence channels.
- Offline mode: `LocalGame` runs entirely client-side with optional Stockfish bot evaluation.

## Dependencies
- `@/components/Game` — the main Game component
- `useNavigationGuard` — prevents back-navigation during play

## Recent Changes
- **2026-07-12**: Board page revamp — `Game.tsx` now uses the dark glassmorphism theme and the new `BoardTopBar` + `BoardBottomNav` shell. Chess board is sized to ~80% of the viewport. The new `confirmMove` setting (off by default) gates `handleMove` so the move is held until the user taps Confirm.
