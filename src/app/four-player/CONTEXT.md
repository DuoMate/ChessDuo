# Module: 4-Player Lobby Page

## Purpose
Lobby and matchmaking for 4-player (all-human, no bots) team chess mode.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — 4-player lobby UI |

## Logic & Decisions
- Uses `four-player` room mode in Supabase.
- Each team gets 2 human players — no bot slots.
- Lobby handles player join/leave and ready states.
- Room code sharing for friend invites.

## Dependencies
- `@/lib/fourPlayerActions` — 4-player lobby operations
- `@/components/GameLobby` — shared lobby component
