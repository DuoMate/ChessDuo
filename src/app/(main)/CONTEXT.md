# Module: Main Route Group

## Purpose
Route group for non-game pages that share a common layout with `HomeBottomNav`. All panels (Friends, Profile, History, Settings) are now full pages with proper browser history entries instead of slide-overs.

## Layout (`layout.tsx`)
- Client component that checks Supabase session for `playerId`
- Renders `HomeBottomNav` fixed at bottom with 4 tabs: Home, History, Friends, Profile
- **Desktop**: Renders `DesktopSidebar` (wide 220px/240px with labels, ChessDuoLogo, tagline, loading progress bar) fixed left
- **Mobile**: Renders `HomeBottomNav` floating pill style
- History, Friends, and Profile tabs navigate to dedicated routes (`/history`, `/friends`, `/profile`)
- Uses central `useBadgeCount` hook for Friends badge with Supabase Realtime
- Wraps children in `ErrorBoundary` and adds `pb-20` spacing for the fixed bottom nav

## Routes in This Group
| Route | Page |
|-------|------|
| `/history` | Match history list with stats |
| `/profile` | Profile editor with Google avatar support |
| `/friends` | Friends list, requests, and chat |
| `/settings` | App settings panel |
| `/premium` | Premium subscription pricing |
| `/privacy` | Privacy policy |
| `/delete-account` | Account deletion flow |
| `/four-player` | 4-player lobby |

## Pages NOT in This Group
| Route | Reason |
|-------|--------|
| `/` (home) | Has its own HomeBottomNav and sub-screen management |
| `/game` | Game room — no bottom nav |
| `/duel` | Duel room — no bottom nav |
| `/challenge/[code]` | Challenge link landing (root level — needs server component for `generateStaticParams`) |
| `/invite/[userId]` | Friend invite landing (root level — needs server component for `generateStaticParams`) |
| `/replay/[gameId]` | Match replay viewer (root level — needs server component for `generateStaticParams`) |

## Logic & Decisions
- All panels converted from slide-overs to full pages — each creates a proper browser history entry. This fixes back-button inconsistencies (Bugs #2 and #3).
- `HomeBottomNav` uses `router.push()` + `usePathname()` for navigation and active state detection instead of callback props.
- `useBadgeCount` hook centralizes unread message + pending friend request counting with Supabase Realtime on both `messages` and `friend_requests` tables. No polling.
- Smart back: all pages use `BackButton` which calls `router.back()` (falls back to home or appropriate parent).
- All pages have `pb-20` on their main container to prevent overlap with the fixed bottom nav.

## Dependencies
- `@/components/HomeBottomNav` — shared bottom navigation bar
- `@/components/BackButton` — smart back navigation button
- `@/hooks/useBadgeCount` — centralized badge count hook
- `@/hooks/useCapacitorBackButton` — Android hardware back

## Recent Changes
- **2026-07-19**: Browser UI unification — migrated from `SidebarNav` (narrow 80px icons-only) to `DesktopSidebar` (wide 220px/240px with labels) for History, Friends, Profile pages. Updated layout.tsx to use `DesktopSidebar` on desktop. Mobile unchanged.
- **2026-07-18**: Major overhaul — converted all slide-over panels to full pages (`/friends`, `/settings` new). `HomeBottomNav` uses router navigation with pathname-based active detection. `useBadgeCount` hook centralizes badge counting. Profile page restored with all menu items (edit, share, premium, history, settings, manage account, sign out, theme toggle). BackButton uses `alwaysFallback` for nav pages. Added sign-in buttons to unauthenticated states. Loading skeletons for `/friends` and `/settings`.
- **2026-07-14**: Page redesign — dark navy theme (`#0a0e1a`) applied to Profile, Premium, and History pages. All panels now use `InitialsAvatar` component for user avatars.
- **2026-07-13**: Created `(main)/` route group. Pages moved here: history, profile, premium, privacy, delete-account, four-player.
