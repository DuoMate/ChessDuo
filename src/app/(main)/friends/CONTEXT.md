# Module: Friends Page

## Purpose
Full-page friends management — add friends, accept/reject requests, block users. Chat opens from friend rows.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders FriendsPanel with loading/error/empty states |
| `loading.tsx` | Skeleton loading state |

## Logic & Decisions
- Full-page route (was a slide-over panel). Back button always goes home via `BackButton alwaysFallback`.
- Uses `useBadgeCount` hook for unread message counts (passed to FriendsPanel).
- Uses `useCapacitorBackButton` for hardware back.
- Sign-in button shown when `playerId` is null.
- FriendsPanel renders friend list, pending requests, search, and chat overlay.

## Dependencies
- `@/components/FriendsPanel` — friends list + requests + chat
- `@/hooks/useBadgeCount` — unread counts
- `@/hooks/useCapacitorBackButton` — Android back

## Recent Changes
- **2026-08-05**: Search results dropdown redesigned with `InitialsAvatar` + styled emerald "Invite" button (matching Accept pattern). Added loading state (spinner + disabled button per result) and `useToast` success/error feedback after sending invites.
- **2026-07-18**: Created as full page route (was slide-over). Added loading skeleton. Sign-in button for unauthenticated state.
