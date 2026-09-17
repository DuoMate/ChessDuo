# Module: User Profile Page

## Purpose
Profile editor and stats display. Users can change username, avatar, view their game statistics.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — own duplicated `ProfileContent` (does NOT render `ProfilePanel`; keep in sync via shared rows) |

## Logic & Decisions
- Handles loading, error, and empty profile states.
- Profile data from Supabase `profiles` table.
- Stats computed from match history.
- Menu rows shared with `ProfilePanel` via `@/components/RateChessDuoRow` — never duplicate Rate/Share JSX.

## Dependencies
- `@/components/RateChessDuoRow` — shared Rate ChessDuo row (also used by `ProfilePanel`)
- `@/lib/supabase` — data access

## Recent Changes
- **2026-09-17**: Added shared `RateChessDuoRow` after Share Profile — fixes `/profile` missing the Rate row in production (row previously only in `ProfilePanel` slide-over). Corrected stale "renders ProfilePanel" doc.
- **2026-08-01**: Legal card added to the menu — routes to `/privacy` (Privacy Policy & Terms of Service).
- **2026-08-01**: "Premium Active" card is now a clickable button that routes to `/premium` (view premium features) — it was a plain `div` with a lock badge. Lock badge removed; plan + renewal date kept in the subtitle.
- **2026-07-31**: Premium status card added — when the user is premium, the profile page now shows a "Premium Active" card (plan + renewal date) instead of rendering nothing. Previously the section was blank for premium users because it only implemented the upgrade upsell state.
- **2026-07-31**: Share button copy updated to "ChessDuo Invite" / "Play ChessDuo with me!" and shares `getProfileLink()` — which now points at `/invite/[userId]` (the friend-request flow). The public `/profile/[userId]` route does not exist, so the old profile share produced a dead link.
