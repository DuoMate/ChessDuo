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
