# Module: User Profile Page

## Purpose
Profile editor and stats display. Users can change username, avatar, view their game statistics.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders ProfilePanel |

## Logic & Decisions
- Handles loading, error, and empty profile states.
- Profile data from Supabase `profiles` table.
- Stats computed from match history.

## Dependencies
- `@/components/ProfilePanel` — profile + stats UI
- `@/lib/supabase` — data access

## Recent Changes
- **2026-07-31**: Share button copy updated to "ChessDuo Invite" / "Play ChessDuo with me!" and shares `getProfileLink()` — which now points at `/invite/[userId]` (the friend-request flow). The public `/profile/[userId]` route does not exist, so the old profile share produced a dead link.
