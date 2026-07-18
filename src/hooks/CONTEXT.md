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

## Recent Changes
- **2026-07-18**: Added `useBadgeCount` hook — centralized unread message + pending friend request counting with Supabase Realtime on both `messages` and `friend_requests` tables. No polling. Fixed race condition with unique channel names per instance. Replaces the 30s polling and dual-state pattern that caused badge staleness.
- **2026-07-15**: `useScrollLock` refactored with module-level lock counter to prevent nested lock interference.
