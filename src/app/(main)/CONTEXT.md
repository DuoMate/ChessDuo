# Module: Main Route Group

## Purpose
Route group for non-game pages that share a common layout with `HomeBottomNav` (the task bar) and SlideOver panels for Profile, Friends, and Match History.

## Layout (`layout.tsx`)
- Client component that checks Supabase session for `playerId`
- Renders `HomeBottomNav` fixed at bottom with 4 tabs: Home, History, Friends, Profile
- History and Friends tabs open SlideOver panels (not page navigation)
- Profile tab opens ProfilePanel SlideOver with sign-out support
- Fetches unread message counts for Friends badge
- Wraps children in `ErrorBoundary` and adds `pb-20` spacing for the fixed bottom nav

## Routes in This Group
| Route | Page |
|-------|------|
| `/history` | Match history list with stats |
| `/profile` | Profile editor |
| `/premium` | Premium subscription pricing |
| `/privacy` | Privacy policy |
| `/delete-account` | Account deletion flow |
| `/invite/[userId]` | Friend invite landing |
| `/challenge/[code]` | Challenge link landing |
| `/replay/[gameId]` | Match replay viewer |
| `/four-player` | 4-player lobby |

## Pages NOT in This Group
| Route | Reason |
|-------|--------|
| `/` (home) | Has its own HomeBottomNav and sub-screen management |
| `/game` | Game room — no bottom nav |
| `/duel` | Duel room — no bottom nav |

## Logic & Decisions
- Smart back: all pages in this group use `BackButton` which calls `router.back()` (falls back to home or appropriate parent).
- All pages have `pb-20` on their main container to prevent overlap with the fixed bottom nav.
- `HistoryPanel` and `ProfilePanel` inside SlideOvers use the same components as standalone pages.
- Direct URL access to pages still works (e.g., `/history` from a bookmark).

## Dependencies
- `@/components/HomeBottomNav` — shared bottom navigation bar
- `@/components/BackButton` — smart back navigation button
- `@/components/SlideOver` — slide-over panel container
- `@/components/ProfilePanel`, `@/components/HistoryPanel`, `@/components/FriendsPanel` — slide-over content
- `@/lib/messages` — unread message counts

## Recent Changes
- **2026-07-13**: Created `(main)/` route group. Pages moved here: history, profile, premium, privacy, delete-account, invite, challenge, replay, four-player. Each page now uses `BackButton` instead of `HomeButton`. HomeBottomNav added to layout (visible on all non-game-room pages). History tab opens SlideOver instead of navigating to `/history`. Taglines fixed: Duo → "You + Friend vs Bots", Four Players → "Friends Battle".
