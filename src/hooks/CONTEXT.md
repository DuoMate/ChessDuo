# Module: React Hooks

## Purpose
Custom React hooks for viewport detection, navigation guards, network status, Capacitor back-button handling, and badge counting.

## Key Files
| File | Purpose |
|------|---------|
| `useIsMobile.ts` | Viewport breakpoint detection (640px) |
| `useNavigationGuard.ts` | Prevent accidental navigation during active game |
| `useNetworkStatus.ts` | Online/offline connectivity detection |
| `useCapacitorBackButton.ts` | Android hardware back-button handler |
| `useEscapeKey.ts` | Keyboard Escape key handler for modals/panels |
| `useScrollLock.ts` | Prevent background scrolling when overlays are open |
| `useBadgeCount.ts` | Centralized badge count — unread messages + pending friend requests via Supabase Realtime |
| `useAuthSession.ts` | Auth session lifecycle — initial session fetch, auth state changes, username gate |
| `useSettings.ts` | User settings hook (autoQueen, lowTimeWarning, confirmMove, soundEnabled, theme) — localStorage-backed |

## Logic & Decisions
- `useNavigationGuard` uses `beforeunload` event + Next.js router events.
- `useIsMobile` returns boolean — drives responsive layout switches.
- `useNetworkStatus` triggers `NetworkOverlay` globally (not per-page).
- `useCapacitorBackButton` only active in Capacitor builds (not web).
- `useEscapeKey` uses `addEventListener` on document keydown; accepts `enabled` flag.
- `useScrollLock` uses module-level ref counter to handle nested/overlapping overlay lock cycles.
- `useBadgeCount` subscribes to `postgres_changes` on both `messages` and `friend_requests` tables, re-fetches on visibility change. No polling.
- Co-located `__tests__/` for hook tests.

## Dependencies
- React 19, Next.js router
- Capacitor (for `useCapacitorBackButton`)
- Supabase JS SDK (for `useBadgeCount`)
- `@/lib/settingsStorage` (for `useSettings`)

## Recent Changes
- **2026-08-23**: **P0 back-navigation fix — navigation-guard sentinel lifecycle.** `useNavigationGuard`'s blocker history entry is now **tagged** (`state.__chessduoNavGuard`) and **consumed** (`history.back()`) by a dedicated effect when the guard deactivates while the page stays mounted (i.e. GAME_OVER). Previously the sentinel was pushed on enable and never removed, so after a completed game the stack was `[…, HOME, /game, SENTINEL]`: Back #1 popped the sentinel onto the stale `/game` entry (fresh Game mount = "resurrected" game) and Back #2 walked into whatever preceded it — including leftover Google OAuth pages. The sentinel itself stays (the popstate re-push relies on it: at popstate time `window.location` must still equal the game URL); only its lifecycle was fixed. Consumption is guarded by `history.state` tag check, so normal exits (`confirmLeave` push, `router.replace('/')`, natural backs) never double-pop. Tests: sentinel tagging, consume-on-disable, no-consume-on-foreign-entry.
- **2026-08-17**: **Friend notification refresh** — `useNotificationRedirect` now dispatches the `chessduo:refresh-friends` window event when a `friend_request`/`invite_accepted` redirect is consumed (mount effect + service-worker `message` handler), so an already-mounted `FriendsPanel` refetches instead of showing stale pending requests.
- **2026-08-16**: **Profile upsert 400 fix** — `useAuthSession` no longer fires a username-less `upsertProfile({ id, avatar_url, display_name })` when the user has no `profiles` row. `profiles.username` is `NOT NULL`, so PostgREST returned 400 (`not_null_violation`) on the INSERT for orphaned auth users (17 found: anonymous + one email signup). The no-username branch now derives a format-valid username via `deriveUsername()` (email prefix → `player_<md5>` fallback) and includes it in the upsert. See `profileService.ts`.
- **2026-08-13**: **Realtime remount crash fix** — `useBadgeCount` now uses a unique channel name per subscription instance (`badge:${playerId}:${++counter}`). Supabase reuses a channel with the same topic while it is still registered (removeChannel is async), so the previous fixed `badge:${playerId}` name caused `.on('postgres_changes')` to throw ("cannot add postgres_changes callbacks ... after subscribe()") on fast home↔profile remounts. Added regression test.
- **2026-07-18**: Added `useBadgeCount` hook — centralized unread message + pending friend request counting with Supabase Realtime on both `messages` and `friend_requests` tables. No polling. Fixed race condition with unique channel names per instance. Replaces the 30s polling and dual-state pattern that caused badge staleness.
- **2026-07-15**: `useScrollLock` refactored with module-level lock counter to prevent nested lock interference.
- **2026-08-03**: Added `useSettings` — moved from `lib/settings.ts` to `hooks/useSettings.ts` (BV3 fix: React hook belongs in hooks/, not lib/). Pure localStorage utilities extracted to `lib/settingsStorage.ts`.
