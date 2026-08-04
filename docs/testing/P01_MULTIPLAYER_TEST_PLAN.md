# ChessDuo Multiplayer Test Plan — RC1

> **Release Candidate 1** — Game Engine Stabilization complete (Phases 1–6).
> **Role:** Senior QA Engineer / Multiplayer Test Architect.
> **Date:** 2026-08-04
> **DO NOT modify implementation unless a defect is discovered.**

---

## Executive Summary

The multiplayer engine has been redesigned as a distributed system with six explicit invariants:

1. **Exactly one authoritative board FEN** — `games.fen` in Supabase
2. **Exactly one authoritative coordinator** — `games.coordinator_id`, assigned at game creation
3. **At most one move per player per turn** — `UNIQUE(game_id, turn_number, player_id)` on `turn_submissions`
4. **Exactly one resolver** — only coordinator runs Stockfish, broadcasts `turn_resolved`
5. **Non-coordinators wait for broadcast** — never self-resolve; call `waitForTurnChange()`
6. **Reconnect preserves state** — no `startPendingTurn()` clobber; restores from DB

This test plan validates all six invariants across Quick Play, Duo, and Four Player modes on browser, Android APK (Capacitor), and cross-platform combinations.

---

## Architecture Risks (Pre-Test Assessment)

| Risk | Likelihood | Impact | Rationale |
|------|:----------:|:------:|-----------|
| `submitMoveToDB` async may not complete before `waitForTeammateLock` resolves | LOW | MEDIUM | `submitMoveToDB` is async but updates local state synchronously before the await. Teammate notification via `postgres_changes` is independent. |
| `postgres_changes` channel may not deliver in time | LOW | HIGH | Supabase Realtime can have latency (100ms–2s). `waitForTeammateLock` has a 15s timeout as fallback. |
| Two teammates both think they're coordinator | NONE | CRITICAL | `_coordinatorId` is deterministic (alphabetical sort) and persisted to DB. Both clients compute the same value. |
| `_currentTurnNumber` drift after reconnect | LOW | MEDIUM | `syncGameState` uses DB `turn_number` as authority. Local only overrides when ahead. |
| Bot moves on BLACK team still use `setPendingMove` directly | LOW | LOW | Bot turns bypass `turn_submissions` (Phases 3–4). The coordinator resolves bot moves locally. If coordinator crashes during bot turn, non-coordinator doesn't know to resolve. |
| `timer_sync` lost → non-coordinator timer freezes | MEDIUM | LOW | UI countdown (`tickMatchTimer`) continues locally; `handleTimerSync` corrects on next sync. Drift ≤ 5s. |
| Mobile background → channel disconnect → reconnect | MEDIUM | HIGH | `syncGameState` recovers fully with Phase 5. But if background lasts >35s, coordinator abandons match. |

---

## Complete Test Matrix

### Game Modes × Platforms

| Mode | Browser ↔ Browser | Browser ↔ Android | Android ↔ Android |
|------|:-----------------:|:-----------------:|:-----------------:|
| Quick Play (offline) | ✅ Required | ✅ Required | ✅ Required |
| Duo (2 humans + 2 bots) | ✅ Required | ✅ Required | ✅ Required |
| Duo (host BLACK, joiner WHITE) | ✅ Required | ⬜ Optional | ⬜ Optional |
| Four Player (4 humans) | ✅ Required | ✅ Required | ✅ Required |
| Mixed human/bot (Quick Play, BLACK bots) | ✅ Required | ✅ Required | ✅ Required |

### Test Categories × Priority

| Category | Test Count | Priority | Phase Dependency |
|----------|:----------:|:--------:|------------------|
| Room & Lobby | 8 | P0 | All phases |
| Move Submission & Locking | 15 | P0 | P2, P3, P4 |
| Move Resolution & Board Sync | 18 | P0 | P2, P3, P4 |
| Reconnect & Recovery | 14 | P0 | P5 |
| Timer | 8 | P1 | P6 |
| Game Completion | 10 | P1 | All phases |
| Edge Cases | 100+ | P1–P2 | All phases |
| Stress & Performance | 6 | P2 | P3 |
| Cross-Platform | 8 | P1 | All phases |

---

## Manual Test Cases — P0 (Must Pass)

### Room & Lobby

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| R01 | **Create Duo room** | Host creates room → receives 6-char code | Room created in DB; `host_team` recorded |
| R02 | **Join by room code** | Joiner enters code → auto-joins opposite team | Joiner assigned opposite of `host_team` |
| R03 | **Two players in lobby** | Both connected → game auto-starts | Both transition to board within 5s |
| R04 | **Lobby timeout (60s)** | Only 1 player connected for 60s | Lobby closes; player returned to home |
| R05 | **Full room blocks join** | 2 players on both teams → third tries join | Join rejected; "room full" message |
| R06 | **Host leaves in lobby** | Host navigates away during lobby | Room updated to `finished`; joiner returned to home |
| R07 | **Joiner leaves in lobby** | Joiner navigates away | Host continues in lobby; room re-openable |
| R08 | **Four Player: 4 humans required** | 3 players present → game does NOT start | Lobby waits for 4th player |

### Move Submission & Locking

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| M01 | **Single player submits move** | Duo: Player A selects piece → moves to square | Pending move shown for Player A; teammate row updates |
| M02 | **Teammate sees pending move** | Duo: Player A submits → Player B observes | Player B sees Player A's pending move overlay on board |
| M03 | **Both players submit (same team)** | Duo: Both WHITE players submit different moves | Both moves locked → resolution begins |
| M04 | **Both players submit (synchronized)** | Duo: Both WHITE players submit SAME move | Sync detected → single resolution |
| M05 | **Submit second move in same turn** | Player submits → tries to submit again | Second submission blocked (local guard: `allPendingMoves.has(playerId)`) |
| M06 | **Submit during opponent turn** | WHITE tries to move during BLACK turn | Move rejected; "not your turn" |
| M07 | **Submit during evaluation** | Player submits → resolution in progress → tries another move | Second move ignored; board locked |
| M08 | **Confirm move disabled** | Settings: confirmMove = off | Move applies immediately on square release |
| M09 | **Confirm move enabled** | Settings: confirmMove = on | Move held until Confirm button tapped |
| M10 | **Cancel held move** | Select piece → square → tap Cancel | Board resets to original selection; re-select allowed |
| M11 | **Promotion dialog** | Pawn reaches rank 8 → promotion picker appears | Queen/Rook/Bishop/Knight options shown |
| M12 | **Auto-queen promotion** | Settings: autoQueen = on; pawn reaches rank 8 | Auto-promotes to Queen; no picker |
| M13 | **Browser: drag-drop move** | Drag piece to valid square | Move registered |
| M14 | **Browser: click-click move** | Click piece → click destination | Move registered |
| M15 | **Mobile: tap-tap move** | Tap piece → tap destination | Move registered |

### Move Resolution & Board Sync

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| S01 | **WHITE turn resolves** | Both WHITE players submit → coordinator evaluates | Stockfish runs → `turn_resolved` broadcast → board updates on both clients |
| S02 | **Winning move applied on BOTH clients** | After resolution, compare FEN on both clients | `gameState.fen` identical on both clients |
| S03 | **Accuracy comparison shown** | After WHITE turn resolves → accuracy panel appears | Both clients see `MoveResolvedInline` with player1/player2 accuracy |
| S04 | **BLACK (bot) turn resolves** | WHITE turn done → BLACK bots make move → resolve | Board updates on both clients; bots played |
| S05 | **Turn transition WHITE→BLACK→WHITE** | Complete 2 full turns | Turn alternates correctly; `currentTurn` matches board |
| S06 | **Non-coordinator receives turn_resolved** | Coordinator resolves → non-coordinator observes | Non-coordinator's board updates within 2s |
| S07 | **Non-coordinator does NOT self-resolve** | Non-coordinator submits → waits → receives broadcast | `resolvePendingMoves()` never called on non-coordinator |
| S08 | **turn_submissions has exactly 2 rows per turn** | After both submit → query DB | 2 rows with same `turn_number` |
| S09 | **games.turn_number increments** | After first resolution → query DB | `turn_number` incremented by 1 |
| S10 | **games.fen is authoritative** | After resolution → query DB → compare with client | FENs match on all clients and DB |
| S11 | **Stockfish checkmate short-circuit** | Set up forced mate in 1 → submit → resolve | Mate detected without Stockfish; CHECKMATE_SCORE (10000) used |
| S12 | **Sync move (both choose same)** | Both submit `e4` | `isSync: true`; sync rate increments |
| S13 | **Conflict move (different moves)** | P1 submits `e4`, P2 submits `d4` | Higher accuracy move wins; loser shown as shadow |
| S14 | **`MoveResolvedCard` shows winner/loser** | After resolution → accuracy panel visible | Winner move green, loser move with red annotations |
| S15 | **Round history updates** | Open RoundHistorySidebar after several turns | All past turns listed with winner move |
| S16 | **Four Player: all 4 submit moves** | All 4 players submit for WHITE turn | Both WHITE players' moves evaluated together |
| S17 | **Four Player: coordinator resolves WHITE + BLACK** | Full 4-player game turn cycle | Same coordinator handles both team turns |
| S18 | **Four Player: non-coordinator on BLACK** | Player C (BLACK) is not coordinator → submits | Waits for `turn_resolved` from coordinator |

### Reconnect & Recovery

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| C01 | **Browser refresh (coordinator)** | Coordinator refreshes page during game | Reconnects → board restored from DB FEN → coordinator role restored |
| C02 | **Browser refresh (non-coordinator)** | Non-coordinator refreshes during selecting | Reconnects → board restored → pending moves from `turn_submissions` restored |
| C03 | **Browser refresh during evaluation** | Refresh while Stockfish is running on coordinator | Coordinator reconnects → `turn_phase` may show LOCKED → re-evaluates or replays |
| C04 | **Browser refresh → submit for current turn** | Refresh mid-turn → try to submit move | If submission already in DB, duplicate rejected; if not, submission accepted |
| C05 | **Reconnect does NOT clobber GAME_OVER** | Game ends (checkmate) → refresh page → reconnect | Status stays `GAME_OVER` (R2 bug fixed) |
| C06 | **Reconnect restores turn_number** | After 3 turns → refresh → check `_currentTurnNumber` | `_currentTurnNumber` = 4 (3 resolved + 1 current) |
| C07 | **Reconnect restores turn_submissions** | Teammate submitted → refresher joins → check pending moves | Teammate's submission visible on refresher's board |
| C08 | **Mobile background (< 35s)** | Switch to other app → return within 30s | Game continues; board synced |
| C09 | **Mobile background (> 35s)** | Switch to other app → return after 40s | Coordinator abandons match; other client sees "Match abandoned" |
| C10 | **Network interruption (10s)** | Turn off WiFi → wait 10s → turn on | Reconnects → `syncGameState` restores state |
| C11 | **Network interruption during submission** | Select move → turn off WiFi → submit → turn on WiFi | `submitMoveToDB` fails silently; player can re-submit (or turn resolves without them) |
| C12 | **Coordinator disconnect (35s+)** | Coordinator closes tab → wait 36s | Non-coordinator sees "Match abandoned" |
| C13 | **Non-coordinator disconnect** | Non-coordinator closes tab | Coordinator continues; match proceeds with single submission (after lock timeout) |
| C14 | **Both disconnect → both reconnect** | Both players refresh simultaneously | Both load from DB → both converge to same board |

### Timer

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| T01 | **Timer decrements on coordinator** | Start game → observe coordinator's timer | Countdown decreases by 1 each second |
| T02 | **Timer synced to non-coordinator** | Start game → observe non-coordinator's timer | Within 5s of coordinator's value |
| T03 | **Timer does not drift > 5s** | Play 10 turns → compare timer values | Coordinator and non-coordinator within 5s |
| T04 | **Timeout: coordinator detects** | Set 30s timer → let it expire on coordinator | `setGameOverTimeup` fires; `match_timeout` broadcast sent |
| T05 | **Timeout: non-coordinator receives** | Coordinator detects timeout → non-coordinator observes | `handleMatchTimeoutBroadcast` fires; game over modal shown |
| T06 | **Timer pauses for non-coordinator if sync lost** | Coordinator tab hidden → check non-coordinator | Non-coordinator continues local countdown; corrected on coordinator return |
| T07 | **Timer restored on reconnect** | After 3 turns → refresh → check timer | Timer restored from `matchStartedAt` + elapsed calculation |
| T08 | **Timer sync interval = 5s** | Observe coordinator console | `timer_sync` broadcast emitted every 5s |

### Game Completion

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| G01 | **Checkmate ends game** | Force scholar's mate → resolve | Both clients show `GAME_OVER`; `GameOverModal` appears |
| G02 | **Stalemate ends game** | Force stalemate position | Both show "Draw by stalemate" |
| G03 | **Resignation (coordinator)** | Coordinator resigns | `match_abandoned` broadcast sent; game ends |
| G04 | **Resignation (non-coordinator)** | Non-coordinator resigns | Only their client leaves; match becomes single-player |
| G05 | **Game saved to completed_games** | Game ends → check DB | Row in `completed_games` with stats, accuracy, move history |
| G06 | **Game saved to matchHistory (local)** | Game ends → check localStorage | `completedGames` array updated |
| G07 | **Replay page loads completed game** | Navigate to `/replay/[gameId]` | Board loads with all moves; playback controls work |
| G08 | **Match history shows completed game** | Navigate to History page | Game listed with date, result, moves, accuracy |
| G09 | **Insights show after game** | Premium user → check Insights tab | Move-by-move accuracy breakdown visible |
| G10 | **Round count correct in UI** | After 3 full turns → check "Round" label | Shows "Round 3" |

---

## Edge Cases — 100+

### Synchronization Invariants

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E01 | Both clients call `startGameWhenReady` simultaneously | First DB write wins; second detects existing game via `loadGameState`; both sync | CRITICAL |
| E02 | `_coordinatorId` computed differently on two clients | Impossible — alphabetical sort on same player list | NONE |
| E03 | `_coordinatorId` empty on game start | Game should fail to start; `isCoordinator()` returns false for all | HIGH |
| E04 | `saveGameState` fails (network error) | `_finishResolution` continues without DB write; broadcast still sent | MEDIUM |
| E05 | `turn_submissions` insert fails (network) | `submitMoveToDB` catches error; local state updated but teammate not notified → lock timeout resolves | MEDIUM |
| E06 | Two players submit to `turn_submissions` with same PK | `ON CONFLICT DO NOTHING` → second insert silently ignored | LOW |
| E07 | `postgres_changes` delivers duplicate INSERT | `handleSubmissionFromDB` checks `isPendingMoveLocked` → deduped | LOW |
| E08 | `postgres_changes` delivers old turn's submission | `handleSubmissionFromDB` checks `turn_number !== _currentTurnNumber` → ignored | LOW |
| E09 | `postgres_changes` never delivers | `waitForTeammateLock` 15s timeout → coordinator resolves with single move | MEDIUM |
| E10 | Coordinator resolves before non-coordinator submits | Non-coordinator's `submitMoveToDB` writes to DB for turn that's already resolved → `_currentTurnNumber` mismatch → ignored by other clients | MEDIUM |
| E11 | `turn_resolved` broadcast lost | Non-coordinator's `waitForTurnChange` 30s timeout → forces recovery | MEDIUM |
| E12 | `turn_resolved` broadcast arrives twice | `handleTurnResolved` rejects duplicate via `_turnSequence` comparison (or applies same move twice) | MEDIUM |
| E13 | `turn_resolved` arrives out of order (turn 3 before turn 2) | `_turnSequence` comparison rejects stale `turnSequence < _turnSequence` | LOW |
| E14 | `game_started` broadcast lost | Non-coordinator detects via polling fallback or presence sync → calls `syncGameState` | LOW |

### Move Ordering & Duplicates

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E15 | Player submits, reconnects, submits again | Reconnect: `restoreCurrentTurnSubmissions` repopulates pending → local guard blocks duplicate | MEDIUM |
| E16 | Player submits illegal move (chess.js validation fails) | `uciToSan` or `getMoveFromUci` returns null → move not submitted | LOW |
| E17 | Player submits promotion without selecting piece | Auto-queen or promotion picker shown | LOW |
| E18 | Player taps board during opponent turn | Move rejected by `executeMove` guard (`currentTurn !== myTeam`) | LOW |
| E19 | Player double-taps destination square | Second tap ignored (move already submitted) | LOW |
| E20 | Player submits, teammate never submits | Lock timeout (15s) fires → coordinator resolves with single submission | HIGH |
| E21 | Player submits, teammate submits 14s later | Both included before timeout | LOW |
| E22 | Bot move fails (Stockfish crash) | Fallback: random legal move | MEDIUM |
| E23 | Bot generates illegal move | Fallback: first legal move from `chess.moves()` | LOW |
| E24 | Both bot slots submit same move (duplicate SAN) | Both `setPendingMove` + `lockPendingMove` called with same move → sync detected | LOW |
| E25 | Four Player: player on wrong team submits | `getPlayerTeam` check in `handleSubmissionFromDB` filters → ignored | LOW |

### Coordinator & Turn Transitions

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E26 | Coordinator assigned to a bot | `_coordinatorId` find skips `bot_` prefixed → picks first human | MEDIUM |
| E27 | All players are bots (no humans) | `_coordinatorId` = '' → `isCoordinator()` always false → no one resolves → game hangs | HIGH |
| E28 | Coordinator changes after reconnect (different client) | Impossible — `_coordinatorId` loaded from DB, never recomputed | NONE |
| E29 | `_currentTurnNumber` increments to MAX_INT | Unlikely in practice; no overflow guard | LOW |
| E30 | Turn transition from WHITE to BLACK during bot phase | Coordinator resolves → `_finishResolution` → bot turn starts → `startPendingTurn` called | LOW |
| E31 | Four Player: coordinator is on WHITE, BLACK turn starts | Phase 2: same coordinator handles ALL turns. No separate black coordinator. | MEDIUM |
| E32 | `waitForTurnChange` timeout faster than `turn_resolved` (race) | Timeout fires → forces recovery → then `turn_resolved` arrives → processes correctly (sequence check) | MEDIUM |
| E33 | `handleTurnResolved` called while `Status !== PLAYING` | Guard: `GAME_OVER` check rejects (line 1020) | LOW |
| E34 | `_finishResolution` increments `_currentTurnNumber` before DB write | If DB write fails, turn number is permanently incremented → mismatch on reconnect | MEDIUM |

### DB Consistency

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E35 | `games` row deleted (TTL cleanup) mid-game | `loadGameState` returns null → `syncGameState` warns, keeps local state | HIGH |
| E36 | `turn_submissions` for old turn not cleaned up | Accumulation; TTL cleanup via CASCADE from `games`; no functional impact | LOW |
| E37 | `turn_submissions` PK collision on different game IDs | Not possible — PK includes `game_id` | NONE |
| E38 | `games.turn_number` backfill incorrect | `move_history.length` derived; idempotent UPDATE; no impact on new games | LOW |
| E39 | `games.fen` becomes stale (coordinator resolves but DB write fails) | Next `syncGameState` loads stale FEN → client falls back to move replay | MEDIUM |
| E40 | `completed_games` insert fails | Console warning; local `matchHistory` still saved (localStorage) | LOW |
| E41 | Multiple clients write to `completed_games` simultaneously | Both clients call `saveCompletedGame` → 2 rows in DB (no UNIQUE constraint) | LOW |
| E42 | `room_players` stale after reconnect | `syncGameState` re-queries `room_players` each time | LOW |
| E43 | RLS blocks `turn_submissions` insert for anonymous user | `Allow all` policy on `turn_submissions` mirrors `games` | LOW |

### Reconnect Edge Cases

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E44 | Reconnect during `_finishResolution` (after DB write, before broadcast) | Loads DB state with new FEN → misses broadcast → board is correct from DB | MEDIUM |
| E45 | Reconnect during `submitMoveToDB` (after local set, before DB insert) | Local state shows move; DB doesn't have it yet; teammate doesn't see it → lock timeout resolves | MEDIUM |
| E46 | Reconnect on turn where player already submitted | `restoreCurrentTurnSubmissions` loads existing submission → pending state correct | LOW |
| E47 | Reconnect on turn where teammate submitted but player hasn't | `restoreCurrentTurnSubmissions` loads teammate's submission → pending overlay shown | LOW |
| E48 | Reconnect with empty `move_history` (fresh game) | `needsReplay` true → `startMatch()` called → board at initial position | LOW |
| E49 | Reconnect → `syncGameState` → `restoreCurrentTurnSubmissions` → no submissions | Clean state; awaiting first submission | LOW |
| E50 | Reconnect → `syncGameState` throws | `catch (e)` logs error; state not updated; next presence event retries | MEDIUM |
| E51 | Reconnect → `_submissionChannel` already exists | `!this._submissionChannel` guard prevents duplicate | LOW |
| E52 | Reconnect → `_timerSyncInterval` already exists | `syncGameState` doesn't clear old interval → duplicate timers possible | MEDIUM |
| E53 | Reconnect → `_timerCountdownInterval` already running | `startMatchTimer` clears old interval before starting new one | LOW |
| E54 | Reconnect preserves `_whiteComparison` / `_blackComparison` | These are NOT restored from DB → empty on reconnect | LOW |

### Timer Edge Cases

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E55 | Timer reaches 0 during reconnect | Reconnect restores timer from elapsed calc → 0 → `startMatchTimer` fires timeout immediately | MEDIUM |
| E56 | Non-coordinator timer drifts > 5s between syncs | `handleTimerSync` corrects on next 5s interval | LOW |
| E57 | `timer_sync` broadcast lost for 30s | Non-coordinator's local countdown continues; next sync corrects | LOW |
| E58 | Coordinator's `_timerCountdownInterval` leaks | `stopMatchTimer` clears interval; `leaveRoom` calls `stopMatchTimer` | LOW |
| E59 | Timer restored on reconnect but `matchStartedAt` missing | `syncGameState` skips timer restoration | LOW |
| E60 | `broadcastTimerSync` sends stale value (interval not cleared) | Interval fires every 5s with current `getMatchTimeRemaining()` | LOW |

### Browser & Mobile

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E61 | Browser tab hidden → timer continues | Coordinator's setInterval continues in background tab (browser-dependent) | MEDIUM |
| E62 | Mobile Capacitor: app backgrounded → WebView suspended | Timer stops; on foreground, `syncGameState` restores | MEDIUM |
| E63 | Mobile: notification tap → opens game | Deep link handled; no impact on running game | LOW |
| E64 | Mobile: back button → leave confirm | `useCapacitorBackButton` intercepts; `LeaveConfirmModal` shown | LOW |
| E65 | Mobile: rotation during move | Board resizes; move state preserved | LOW |
| E66 | Mobile: low memory → WebView killed | On relaunch, fresh page load → `syncGameState` restores | HIGH |
| E67 | Mobile: slow network (< 100kbps) | `submitMoveToDB` may timeout; local state updated; lock timeout resolves | MEDIUM |
| E68 | Browser: multiple tabs open on same game | Two websocket connections → presence state shows 2 connections for same player → may cause issues | HIGH |
| E69 | Browser: localStorage full | `matchHistory` save fails; Supabase `completed_games` still works | LOW |
| E70 | Browser: incognito mode | `localStorage` works; `AuthService` may lack session → anonymous play | LOW |

### Cross-Platform

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E71 | Browser host → Android joiner (Duo) | Both connect via Supabase; WebSocket vs native fetch | MEDIUM |
| E72 | Android host → Browser joiner (Duo) | Same as above, reversed | MEDIUM |
| E73 | Different screen sizes → board rendering | Board scaled independently; FEN is authoritative | LOW |
| E74 | Browser uses wasm Stockfish, Android uses native | Evaluator factory returns same interface; results may differ slightly → different scores but same winner | MEDIUM |
| E75 | Capacitor `share` native sheet vs browser `navigator.share` | Invite link sharing works on both | LOW |
| E76 | Android notification tap → `/duel` deep link | Duel game starts correctly; no impact on Duo mode | LOW |
| E77 | Web push notification on browser | FCM token registration works; notification delivered | LOW |
| E78 | Capgo live update during game | App reloads JS bundle → game lost → reconnect from DB | MEDIUM |

### Stockfish & Evaluation

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E79 | Stockfish not loaded yet (WASM still initializing) | `evaluateMoves` blocks until ready | MEDIUM |
| E80 | Stockfish crashes during evaluation | `evaluateMoves` throws → `resolvePendingMoves` throws → catch block handles | HIGH |
| E81 | Stockfish returns zero-score for all moves | `evaluateMoves` returns all 0 → equal scores → first player's move wins | MEDIUM |
| E82 | Stockfish returns non-UCI format | `scoreMap.get(playerUci)` returns undefined → score = 0 | LOW |
| E83 | Stockfish evaluation takes > 10s | UI shows "Evaluating" loader; no timeout on evaluation itself | MEDIUM |
| E84 | Multiple MultiPV lines on mobile (engine depth) | Mobile may use lower depth → different scores vs browser | MEDIUM |

### Game Completion & Cleanup

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E85 | Game over → `_timerSyncInterval` not cleared | `_finishResolution` clears on GAME_OVER | LOW |
| E86 | Game over → `_disconnectCheckInterval` not cleared | `_finishResolution` clears on GAME_OVER | LOW |
| E87 | Game over → `_submissionChannel` not cleaned | `leaveRoom` cleans it; but leaveRoom may not be called immediately | LOW |
| E88 | Game over → player stays on board | `GameOverModal` shown; can dismiss and review board | LOW |
| E89 | Game over → Play Again pressed | Router navigates home; game state disposed | LOW |
| E90 | Resignation during resolution | `abandonMatch` broadcast sent; `_status = GAME_OVER` set on all clients | MEDIUM |
| E91 | Both players resign simultaneously | Both send `match_abandoned`; both process each other's broadcast → game over | LOW |

### Channel & Realtime Edge Cases

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E92 | Supabase channel status `CHANNEL_ERROR` | `joinRoom` removes channel → recreates → re-subscribes → tracks presence | MEDIUM |
| E93 | Supabase channel status `TIMED_OUT` | Channel reconnects; presence re-syncs; `syncGameState` called | MEDIUM |
| E94 | `postgres_changes` channel `CHANNEL_ERROR` | `subscribeToSubmissions` has no error handler → submissions silently lost | HIGH |
| E95 | Broadcast channel and submission channel both active | Two separate Supabase channels; independent lifecycle | LOW |
| E96 | Presence sync fires after game start | `syncGameState` guard checks status → no double-start | LOW |
| E97 | Presence `leave` event but player still connected | `_disconnectedSince` set → 35s timer starts → may incorrectly abandon | MEDIUM |
| E98 | Multiple presence `join` events for same player | `_disconnectedSince` reset to null → normal operation | LOW |
| E99 | Broadcast throttle drops message | `BROADCAST_MIN_INTERVAL_MS = 500` → second message within 500ms dropped | LOW |
| E100 | `_broadcastThrottle` never cleaned | Map grows unbounded; only 8 event types → max 8 entries | LOW |

### Quick Play Specific

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E101 | Quick Play: bot teammate move takes > 30s | `selectBestMove` may hang; no timeout guard | MEDIUM |
| E102 | Quick Play: human switches tab during bot turn | Bot calculation continues in Web Worker | LOW |
| E103 | Quick Play: color selection "random" | 50/50 white/black; `resolvePlayerColor` called once | LOW |
| E104 | Quick Play: level 1 bot vs level 6 bot | Different ELO configs; engine depth varies | LOW |

### Four Player Specific

| # | Edge Case | Expected Behavior | Severity |
|---|-----------|-------------------|:--------:|
| E105 | Four Player: 3 players submit, 4th doesn't | Coordinator's lock timeout fires after 15s for the partial submission | HIGH |
| E106 | Four Player: 2 on WHITE submit, 1 on BLACK submits | WHITE resolves first (coordinator is same for both teams) | MEDIUM |
| E107 | Four Player: player on wrong team submits | Filtered by `getPlayerTeam` in `handleSubmissionFromDB` | LOW |
| E108 | Four Player: 2 players disconnect | Remaining 2 continue; lock timeout handles missing submissions | MEDIUM |
| E109 | Four Player: coordinator is on WHITE team | WHITE turns: coordinator resolves both WHITE submissions; BLACK turns: same coordinator resolves both BLACK submissions | MEDIUM |
| E110 | Four Player: all 4 lose connection | Game state frozen; reconnect restores from DB | MEDIUM |

---

## Bug Hunt — Potential Hidden Defects

### BUG-01: `postgres_changes` channel has no error handler
- **Severity:** HIGH
- **Likelihood:** MEDIUM
- **How to reproduce:** Supabase Realtime `postgres_changes` channel enters `CHANNEL_ERROR` state → `subscribeToSubmissions` has no `.subscribe((status) => { if (status === 'CHANNEL_ERROR') ... })` handler
- **Expected:** Channel should auto-reconnect or fall back to polling
- **Actual:** Submissions silently stop arriving
- **Affected modules:** `onlineGame.ts:subscribeToSubmissions()`

### BUG-02: `_timerSyncInterval` may duplicate on reconnect
- **Severity:** MEDIUM
- **Likelihood:** MEDIUM
- **How to reproduce:** Reconnect → `syncGameState` → `startMatchTimer` + `broadcastTimerSync` interval set → but old interval from before disconnect may still be running
- **Expected:** Old interval cleared before new one created
- **Actual:** `syncGameState` does not clear `_timerSyncInterval` before setting new one
- **Affected modules:** `onlineGame.ts:syncGameState()`, line ~865

### BUG-03: `_currentTurnNumber` incremented before DB write success
- **Severity:** MEDIUM
- **Likelihood:** LOW
- **How to reproduce:** `_finishResolution` increments `_currentTurnNumber` at line ~1413, then calls `saveGameState` (line ~1418). If DB write fails, `_currentTurnNumber` is advanced but not persisted.
- **Expected:** Increment after DB write success
- **Actual:** Increment before DB write
- **Affected modules:** `onlineGame.ts:_finishResolution()`

### BUG-04: Non-coordinator timer countdown not started by `startMatchTimer`
- **Severity:** LOW
- **Likelihood:** HIGH
- **How to reproduce:** Non-coordinator joins game → `syncGameState` calls `startMatchTimer()` → Phase 6 gates interval behind `isCoordinator()` → no local countdown
- **Expected:** Timer updates via `timer_sync` + `tickMatchTimer` in Game.tsx
- **Actual:** `tickMatchTimer` decrements independently; corrected by `timer_sync` every 5s
- **Affected modules:** `onlineGame.ts:startMatchTimer()`, `Game.tsx:tickMatchTimer`

### BUG-05: `submitMoveToDB` for bot moves bypasses `turn_submissions`
- **Severity:** MEDIUM
- **Likelihood:** HIGH
- **How to reproduce:** Bot turn → coordinator calls `setPendingMove` + `lockPendingMove` directly → no DB write → if coordinator crashes, non-coordinator doesn't know bot submitted
- **Expected:** Bot moves should also write to `turn_submissions`
- **Actual:** Bypassed
- **Affected modules:** `Game.tsx:executeMove` (bot path), `onlineGame.ts:resolvePendingMoves`

### BUG-06: `waitForTurnChange` timeout may fire during normal operation
- **Severity:** LOW
- **Likelihood:** LOW
- **How to reproduce:** Slow Stockfish evaluation (>30s) → non-coordinator's `waitForTurnChange` timeout fires → forces recovery → then `turn_resolved` arrives → applies move twice (once from recovery, once from broadcast)
- **Expected:** Timeout should be longer than max expected evaluation time
- **Actual:** 30s timeout may be too short for deep evaluations
- **Affected modules:** `onlineGame.ts:waitForTurnChange()`

### BUG-07: `handleTurnResolved` fallback move application may corrupt board
- **Severity:** MEDIUM
- **Likelihood:** LOW
- **How to reproduce:** `turn_resolved` arrives → `gameState.resolve(winningMove)` returns null (phase != LOCKED) → fallback: `board.move(winningMove)` then FEN turn sync
- **Expected:** Fallback should only apply if move not already on board
- **Actual:** Could apply move that's already been applied (duplicate)
- **Affected modules:** `onlineGame.ts:handleTurnResolved()`, lines ~1079-1093

### BUG-08: Lock timeout resolves with partial moves
- **Severity:** MEDIUM
- **Likelihood:** MEDIUM
- **How to reproduce:** Player A submits, Player B's broadcast lost → 15s lock timeout fires → coordinator resolves with only Player A's move → Player B's move lost
- **Expected:** Should wait for DB submission, not broadcast
- **Actual:** `waitForTeammateLock` timeout resolves without checking DB for submission
- **Affected modules:** `onlineGame.ts:waitForTeammateLock()`

### BUG-09: Multiple browser tabs on same game
- **Severity:** HIGH
- **Likelihood:** LOW
- **How to reproduce:** Same player opens game in 2 browser tabs → both connect via Supabase channel → presence shows 2 connections → may cause duplicate submissions
- **Expected:** Second tab should be rejected or sync to read-only
- **Actual:** Both tabs can submit moves independently
- **Affected modules:** All multiplayer code

---

## Automated Test Recommendations

### Unit Tests (expand existing suites)

| Suite | Current | Recommended | Priority |
|-------|:-------:|:-----------:|:--------:|
| `onlineGame.test.ts` | 89 tests | Add `submitMoveToDB` unit tests, `restoreCurrentTurnSubmissions` tests, `postgres_changes` handler tests | P0 |
| `gameState.test.ts` | 87 skipped | Un-skip and add `startPendingTurn` state transition tests | P1 |
| `Game-critical-paths.test.ts` | 11 tests | Add coordinator/non-coordinator branching tests | P1 |

### Integration Tests (new)

| Test | Scope | Priority |
|------|-------|:--------:|
| Full Duo turn cycle (2 clients, simulated Supabase) | `onlineGame.ts` + `Game.tsx` | P0 |
| Reconnect restore from DB | `syncGameState` + `restoreCurrentTurnSubmissions` | P0 |
| Four Player coordinator assignment | `startGameWhenReady` + `isCoordinator` | P1 |
| Timer ownership assertion (non-coordinator doesn't decrement) | `startMatchTimer` | P1 |
| `turn_submissions` UNIQUE constraint enforcement | DB integration | P0 |

### E2E Tests (recommended tool: Playwright)

| Scenario | Priority |
|----------|:--------:|
| Two browsers: Duo game full cycle | P0 |
| Browser refresh mid-game → state restored | P0 |
| Cross-platform: Browser ↔ Android emulator | P1 |
| Network throttle: 3G → game still playable | P2 |

---

## Stress Tests

| # | Scenario | Duration | Observations |
|---|----------|:--------:|--------------|
| ST01 | 100 turn Duo game (50 full cycles) | ~10 min | Turn number increments correctly; DB `move_history` grows linearly; no memory leak |
| ST02 | Reconnect every 3 turns × 20 times | ~5 min | Board consistent after each reconnect; `_currentTurnNumber` accurate |
| ST03 | Rapid submissions (both players submit within 100ms) | 10 turns | No duplicate submissions; one resolution per turn |
| ST04 | 4-player game, 50 turns | ~15 min | All 4 clients converge each turn; coordinator handles both teams |
| ST05 | Concurrent games (3 Duo rooms simultaneously) | ~5 min | No cross-room data leakage; channels isolated by room ID |

---

## Performance Tests

| Metric | Threshold | Measurement |
|--------|:---------:|-------------|
| Move submission → teammate notification | < 2s | `submitMoveToDB` → `postgres_changes` → `handleSubmissionFromDB` |
| Move submission → resolution start | < 3s | Both submissions in DB → coordinator starts Stockfish |
| Stockfish evaluation (depth 10) | < 5s | Local WASM engine |
| Board FEN sync after reconnect | < 2s | `syncGameState` → `loadGameState` → board restore |
| `turn_resolved` broadcast latency | < 1s | Coordinator broadcast → non-coordinator handler |
| Timer sync interval | 5s ± 1s | `broadcastTimerSync` interval |
| DB upsert latency | < 500ms | `saveGameState` Supabase call |

---

## Release Checklist

### RC1 Go/No-Go

| Gate | Status | Notes |
|------|:------:|-------|
| All P0 manual tests pass (Browser ↔ Browser, Duo) | ⬜ | Execute first |
| All P0 manual tests pass (Browser ↔ Browser, Four Player) | ⬜ | |
| All P0 manual tests pass (Browser ↔ Android, Duo) | ⬜ | |
| Reconnect tests pass (C01–C14) | ⬜ | |
| No new test failures (`npm test` = 1061 passing) | ⬜ | |
| `tsc --noEmit` zero errors | ✅ | Verified after Phase 6 |
| DB `turn_submissions` populated correctly after move | ⬜ | Verify via Supabase dashboard |
| DB `games.turn_number` increments after each resolution | ⬜ | Verify via Supabase dashboard |
| No console errors in production build | ⬜ | Check browser console |
| Board FEN matches across 2+ clients after each turn | ⬜ | Compare via debug overlay or DB |

### Production Go/No-Go (after RC1)

| Gate | Status | Notes |
|------|:------:|-------|
| All P0 + P1 manual tests pass | ⬜ | |
| 100+ edge cases reviewed | ⬜ | |
| Stress tests pass | ⬜ | |
| Performance within thresholds | ⬜ | |
| Cross-platform smoke test passes | ⬜ | |
| No regression in Quick Play (offline) | ⬜ | Verify offline path unaffected |
| No regression in Duel (1v1) | ⬜ | Verify DuelGame unaffected |
| Play Store APK builds and installs | ⬜ | |
| Anonymous play works (no auth) | ⬜ | |
| Premium features unchanged | ⬜ | |
| Rollback plan documented | ⬜ | `git revert` each phase commit |

---

## Recommended Manual Test Execution Order

Execute in this exact order. Stop if any P0 test fails.

### Session 1: Quick Play (Baseline) — ~15 min
1. R01–R08 (room & lobby not applicable; verify offline game starts)
2. M01, M06, M08, M09, M10, M13, M14, M15 (offline move submission)
3. S11, S12, S13 (offline resolution)
4. G01–G10 (game completion)
5. Verify `npm test` still passes

### Session 2: Duo (Browser ↔ Browser) — ~30 min
1. R01–R08 (room creation + join)
2. M01–M05 (move submission, both players)
3. M06–M07, M11–M12 (edge submissions)
4. S01–S10 (resolution sync — CRITICAL)
5. S14–S15 (UI: resolution cards, history)
6. Verify FEN matches on both browsers after 3 turns (S02)
7. T01–T04 (timer basics)

### Session 3: Duo Reconnect — ~20 min
1. C01–C02 (coordinator and non-coordinator refresh)
2. C04 (submit after reconnect)
3. C05 (GAME_OVER preserved — R2 fix verification)
4. C06–C07 (turn number + submissions restored)
5. C10–C11 (network interruption)
6. T07 (timer after reconnect)

### Session 4: Duo Failure Scenarios — ~20 min
1. C08–C09 (mobile background)
2. C12–C14 (disconnect scenarios)
3. T05–T06 (timeout)
4. G03–G04 (resignation)
5. E20 (teammate never submits → lock timeout)

### Session 5: Four Player (Browser ↔ Browser) — ~30 min
1. R08 (4 humans required)
2. S16–S18 (Four Player resolution)
3. E105 (3 submit, 1 doesn't)
4. E106–E110 (Four Player edge cases)
5. Verify FEN matches on all 4 browsers after each turn

### Session 6: Cross-Platform — ~20 min
1. E71–E72 (Browser ↔ Android)
2. E74 (evaluator differences)
3. E67 (slow network simulation)
4. E66 (app killed → relaunch)
5. E68 (multiple tabs warning)

### Session 7: Edge Case Sweep — ~30 min
1. Execute E01–E14 (synchronization invariants)
2. Execute E15–E25 (move ordering)
3. Execute E26–E34 (coordinator)
4. Execute E35–E43 (DB consistency)
5. Execute E79–E84 (Stockfish)
6. Execute E92–E100 (channel/realtime)

### Session 8: Rapid Fire (Stress) — ~15 min
1. ST01 (100 turns)
2. ST02 (reconnect × 20)
3. ST03 (rapid submissions)
4. ST05 (concurrent rooms)

---

## Test Results Template

Copy this for each test session:

```
Session: _____
Date: _____
Tester: _____
Environment: _____

| Test ID | Pass/Fail | Notes |
|---------|-----------|-------|
| R01     |           |       |
| R02     |           |       |
| ...     |           |       |

Bugs Found:
| ID | Description | Repro Steps | Screenshot |
|----|-------------|-------------|------------|
|    |             |             |            |

Summary:
Passed: ___ / ___
Failed: ___
Blockers: ___
```
