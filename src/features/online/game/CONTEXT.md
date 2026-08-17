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
- **2026-08-17**: **`joinRoom()` uses the atomic join RPC.** Replaced the direct `room_players` upsert (and removed the raw-fetch diagnostic fallback) with `joinRoomByCode(room.code)`. The RPC returns the authoritative team; `this._team` adopts it (with a presence re-track if it differs) and presence `track()` now uses `this._team`. Registration failure is non-fatal (membership is established upstream via the RPC; presence carries the team). See `src/lib/CONTEXT.md` and `supabase/migrations/join_room_by_code.sql`.
- **2026-08-17**: **P0 fix — Duo lobby timeout on entry.** `startGameWhenReady()` only counted humans from the `room_players` SELECT, so when the joiner (2nd account, opened the invite link) was already present in the realtime channel but their upserted row wasn't committed/visible yet, the human-count guard deferred and never recovered: fast-retries (12×250ms) + the 15s fallback-poll budget expired while the 60s lobby timed out. Now the human count is **presence-authoritative**: the roster merges channel presence (player_id + team, with `room.host_team` fallback for a metadata-less joiner) with `room_players`, presence is the minimum-humans gate, and unknown-team humans are backfilled from presence/host_team. The coordinator also re-broadcasts `game_started` on every presence sync/join once PLAYING (lost-early-broadcast self-heal), and the fallback poll budget was extended 15s→55s to cover the full lobby window.
- **2026-08-17**: **P0 fix — black-side bot freeze in Duo mode.** `resolvePendingMoves()` hardcoded WHITE = human team / BLACK = bot team: the WHITE branch only picked `move1` when `player === this._playerId` (the coordinator's own UUID), so when the Duo host picks BLACK (humans on BLACK, bots on WHITE via `bot_teammate_*`), the White bot's first turn threw `'Both pending moves must be set'` and the initial-bot trigger caught it without retry → game froze. Made move-pair selection color-agnostic: coordinator's own move is `move1` when present, otherwise any two submitted moves are used. Same architecture for both colors; no new bot path.
- **2026-08-12**: **P0 fix — Duo turn-resolution failure.** `syncGameState()` did not call `gameState.startMatch()` when `needsReplay` was false (normal first-join path), leaving `GameState._phase` at `WAITING`. All `setPendingMove` calls were silently dropped by the phase guard (`gameState.ts:140`), preventing shadow-move display, resolution, turn advancement, and forward/backward navigation. Fix: added `if (phase === WAITING) startMatch()` after the `needsReplay` else-branch, before `startPendingTurn()`.
- **2026-07-30**: Resolution refactored — passes only 2 player moves to `evaluateMoves()` (was up to 6 with supplemental). `SERVER_URL` env var removed (evaluator always local WASM).
- **2026-07-18**: Added `getPlayerColor()` (returns based on `team` prop), `getHumanSlot()` and `getTeammateSlot()` (return `''` for online — teammates have UUIDs, not slot strings). `createOnlineRoom` in `roomActions.ts` accepts `hostColor` and assigns the host to the matching team; the joiner auto-receives the opposite team.
- **2026-07-14**: Timer sync interval reduced 5s→15s to cut Realtime messages by 66%. Added local countdown on all clients (`startMatchTimer()` now runs on all players, timeout detection remains coordinator-only). Timer_sync interval also restored on game reconnect.
- **2026-08-03**: Fixed critical bug where `handleTurnResolved` silently dropped `turn_resolved` broadcasts when `_status !== PLAYING` (guard added in prior commit created race condition with `syncGameState`). Removed the guard — only `GAME_OVER` check remains. Fixed missing `return` in `handleTeammateLocked` team filter (empty `if` block caused all `player_locked` broadcasts to be processed regardless of team).
- **2026-08-03**: **R1 fix** — Added `_turnSequence` counter to reject stale `turn_resolved` broadcasts that arrive out of order (Supabase Broadcast doesn't guarantee ordering). `_finishResolution` increments and attaches `turnSequence` to the payload. `handleTurnResolved` rejects payloads with sequence lower than the current `_turnSequence`.
