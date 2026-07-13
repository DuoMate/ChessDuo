# Module: Friend Invite Landing Page

## Purpose
Landing page for friend invite links (`/invite/[userId]`). Shows inviter info and join CTA.

## Key Files
| File | Purpose |
|------|---------|
| `[userId]/page.tsx` | Route entry — invite landing UI |

## Logic & Decisions
- Dynamic route parameter is the inviter's user ID.
- Displays inviter's profile (username, avatar).
- CTA prompts visitor to sign up or join the app.

## Dependencies
- `@/lib/friends` — friends data access
- `@/lib/supabase` — profile lookup
