# Module: Online Game (Multiplayer)

## Purpose
Real-time multiplayer 2v2 game implementation using Supabase Broadcast + Presence for communication.

## Key Files
| File | Purpose |
|------|---------|
| `onlineGame.ts` | OnlineGame class — implements GameInterface, manages Supabase channels, turn coordination |

## Logic & Decisions
- Implements `GameInterface` — same contract as LocalGame.
- Uses Supabase `RealtimeChannel` for move/lock/resolution payloads.
- Coordinator pattern: one player per turn resolves moves (not a central server).
- Channel lifecycle managed via `subscriptionManager`.
- Move flow: select → `broadcastMove()` → `broadcastLocked()` → coordinator resolves → `broadcastResolution()`.
- Handles reconnection: syncs state from DB on reconnect.
- OnlineGame-specific methods (not on GameInterface): `joinRoom()`, `broadcastMove()`, `broadcastLocked()`, `isCoordinator()`, `waitForTeammateLock()`.

## Dependencies
- `GameState` from `game-engine/`, `GameInterface` from `shared/`
- `@supabase/supabase-js` for real-time channels
- `lib/gamePersistence` for save/load, `lib/subscriptionManager` for channel tracking
