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

## Recent Changes
- **2026-07-30**: Resolution refactored — passes only 2 player moves to `evaluateMoves()` (was up to 6 with supplemental). `SERVER_URL` env var removed (evaluator always local WASM).
- **2026-07-18**: Added `getPlayerColor()` (returns based on `team` prop), `getHumanSlot()` and `getTeammateSlot()` (return `''` for online — teammates have UUIDs, not slot strings). `createOnlineRoom` in `roomActions.ts` accepts `hostColor` and assigns the host to the matching team; the joiner auto-receives the opposite team.
- **2026-07-14**: Timer sync interval reduced 5s→15s to cut Realtime messages by 66%. Added local countdown on all clients (`startMatchTimer()` now runs on all players, timeout detection remains coordinator-only). Timer_sync interval also restored on game reconnect.
- **2026-08-03**: Fixed critical bug where `handleTurnResolved` silently dropped `turn_resolved` broadcasts when `_status !== PLAYING` (guard added in prior commit created race condition with `syncGameState`). Removed the guard — only `GAME_OVER` check remains. Fixed missing `return` in `handleTeammateLocked` team filter (empty `if` block caused all `player_locked` broadcasts to be processed regardless of team).
- **2026-08-03**: **R1 fix** — Added `_turnSequence` counter to reject stale `turn_resolved` broadcasts that arrive out of order (Supabase Broadcast doesn't guarantee ordering). `_finishResolution` increments and attaches `turnSequence` to the payload. `handleTurnResolved` rejects payloads with sequence lower than the current `_turnSequence`.
