# ChessDuo Business Rules

## Game Mode: 2v2 Team Chess
- Two teams (WHITE/BLACK), 2 players per team
- One shared board per match
- Each player independently selects a move (hidden from teammate)
- Moves are submitted simultaneously by both teammates
- System evaluates both moves via Stockfish and selects the best

## Game Mode: 1v1 Duel
- Standard 1v1 chess with timer
- No teammate coordination — solo decision-making

## Turn Mechanics
- **Phase flow**: SELECTING → LOCKED → RESOLVED → (next turn)
- Coordinator pattern: the "coordinator" player resolves moves locally rather than a central server
- Both teammates must lock their move before resolution
- If teammates disagree, the engine-picked move wins
- If teammates agree (sync), that move plays automatically

## Timer Rules
- Team timer: `DEFAULT_TEAM_TIMER_SECONDS = 600` (10 min per team)
- Move timer: `DEFAULT_MOVE_TIMER_SECONDS = 10` (10 sec per turn)
- Running out of team time = game over by timeout

## Scoring & Accuracy
- Lichess hyperbolic accuracy model: `calculateAccuracy(lossInCentipawns)`
- Categories: Perfect (≤10cp), Great (≤30cp), Good (≤70cp), Inaccuracy (≤150cp), Mistake (>150cp)
- Sync rate = percentage of turns where teammates pick the same move
- `CHECKMATE_SCORE = 10000` — sentinel value for checkmate evaluation

## Bot Difficulty (6 Tiers)
| Level | ELO | Depth | Blunder Chance |
|-------|-----|-------|---------------|
| 1 (Beginner) | ~1000 | 5 | 0.20 |
| 2 (Novice) | ~1500 | 7 | 0.12 |
| 3 (Intermediate) | ~1800 | 10 | 0.06 |
| 4 (Advanced) | ~2000 | 12 | 0.03 |
| 5 (Expert) | ~2200 | 15 | 0.01 |
| 6 (Master) | ~2600 | 18 | 0.00 |

## Matchmaking & Rooms
- Rooms have a unique `code`, status (`waiting`, `playing`, `finished`), mode (`online`, `fourplayer`)
- Room auto-cleanup after `ROOM_EXPIRY_MS = 86400000` (24h)
- Room players have a `team` (WHITE/BLACK), `slot` (0/1), and `status` (waiting/joined/ready/locked)
- The host's team is stored on the room row (`host_team`); a joiner derives their team as the opposite of `host_team` and checks fullness via the public `get_room_join_state` RPC — joiners must NEVER read `room_players` before joining (RLS blocks non-members; Bug 39)
- Matchmaking polling interval: `DEFAULT_POLLING_INTERVAL_MS = 2000`

## Real-time Infrastructure
- Supabase Broadcast for move/lock/resolution events
- Supabase Presence for online status
- `subscriptionManager.register(channel)` for centralized channel lifecycle tracking

## Premium (Freemium)
- 3 free insights (`INSIGHTS_FREE_LIMIT`)
- Creem (MoR) subscriptions for unlimited insights — redirect-based checkout + webhook lifecycle. Webhook events with empty metadata fall back to `creem.checkouts.retrieve(id)` to resolve the user; `verify-checkout` grants when the checkout OR its subscription is completed (Bug 40)
- Subscription status tracked on `profiles` table (`subscription_provider`, `subscription_plan`, `purchase_state`, `subscription_expiry_date`) via `SubscriptionService`

## Database Entities
- **profiles**: id, username, avatar_url, is_premium, insights count, subscription fields
- **rooms**: id, code, status, mode, created_by, host_team, created_at
- **room_players**: room_id, player_id, team, slot, status, joined_at
- **games**: id, room_id, fen, current_turn, move_history, status, timers

## Auth & Privacy
- Supabase Auth (email/password + anonymous)
- `middleware.ts` guards `/game` route (redirects unauthenticated to login)
- Privacy policy at `/privacy`
- Delete account at `/delete-account`
- Capacitor bridge for mobile social login (Google)

## Replay
- Game state persisted to DB on each move resolution
- Replay reconstructs game from saved FEN + move history
- Side-by-side move accuracy comparison available in replay
