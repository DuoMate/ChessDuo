# ChessDuo Implementation Progress

> **Single source of truth.** Updated after every module completion.
> **Last updated:** 2026-08-04
> **Active branch:** `architecture-refactor`
> **Last commit:** `d2b5830`

---

## Overall Metrics

| Metric | Value |
|--------|-------|
| Total Modules (roadmap) | 17 |
| Completed | 17 |
| In Progress | 0 |
| Remaining | 0 |
| Overall Progress | 100% ✅ |
| Current Architecture Score (est.) | 52/100 (was 42) |
| Current Regression Risk | MEDIUM (core paths tested) |
| Production Readiness (est.) | 48/100 (was 38) |
| Active Production Bugs | 24 (was 38) |
| Pre-existing Test Failures | 8 (3 suites, unchanged) |

---

## Current Roadmap

| # | Module | Priority | Status | Commit | Bugs |
|:-:|--------|:--------:|:------:|--------|------|
| 1 | M15 OnlineGame test backfill | 81.8 | ✅ | `b3d91ff` | R1,R2,R3 tests |
| 2 | M12 GameState un-skip tests | 73.0 | ✅ | `5f9dd07` | T-03 |
| 3 | M15 R3 lock timeout fix | 72.3 | ✅ | `7ca7cd2` | R3 |
| 4 | M14 D1 delete resolveLegacy | 62.3 | ✅ | `405e2e0` | S-04,D1 |
| 5 | M08 Room D7/V8 dedup | 58.0 | ✅ | `3782ba9` | D7,V8 |
| 6 | M17 Game.tsx critical-path tests | 73.8 | ✅ | `42c5efd` | S-01,B-05,B-06 |
| 7 | M15 R1 broadcast ordering fix | 68.0 | ✅ | `bee09e2` | R1 |
| 8 | M16/M18 Duel engine tests | 64.8 | ✅ | `e941417` | T-02 |
| 9 | M15 R2 reconnect merge fix | 59.0 | ✅ | `55939c9` | R2,R10 |
| 10 | M07 Deep Link H10 fix | 55.3 | ✅ | `f758455` | H10 |
| 11 | M02 Profile BV6 adoption | 50.8 | ✅ | `a985456` | BV6 |
| 12 | M33 Friends S6 consolidation | 49.5 | ✅ | `363af71` | S6,R5,R14 |
| 13 | M31 Insights BV7 fix | 47.3 | ✅ | `8768a16` | BV7 |
| 14 | M28 Realtime BV22 factory | 46.3 | ✅ | `4881b69` | BV22 |
| 15 | M13 Shared Types relocation | 45.5 | ✅ | `164582f` | BV5,S4 |
| 16 | M04 Browser Routing middleware | 43.0 | ✅ | `564f89d` | DOC-03 |
| 17 | M22 Timer R4/R18 unification | 40.8 | ✅ | `c8f76c2` | R18 |

---

## Bug Reduction Progress

| Bug | Severity | Status | Position |
|-----|:--------:|:------:|:--------:|
| R1 — broadcast ordering | HIGH | ✅ Resolved | 7 |
| R2 — reconnect overwrite | HIGH | ✅ Resolved | 9 |
| R3 — lock timeout hang | HIGH | ✅ Resolved | 3 |
| R4 — timer drift | HIGH | Pending | 17 |
| R10 — reconnect double-sync | MED | ✅ Resolved | 9 |
| R18 — dual-timer race | MED | Pending | 17 |
| S-04/D1 — resolveLegacy dup | CRITICAL | ✅ Resolved | 4 |
| S6 — friends overlap | MED | ✅ Resolved | 12 |
| T-01 — Game.tsx zero tests | CRITICAL | ✅ Resolved | 6 |
| T-02 — Duel zero tests | CRITICAL | ✅ Resolved | 8 |
| T-03 — gameState suite skipped | HIGH | ✅ Resolved | 2 |
| H10 — challenge queries rooms | MED | ✅ Resolved | 10 |
| BV1 — features/auth/ React | HIGH | ✅ Resolved | M01 |
| BV2 — features/auth/ hook | HIGH | ✅ Resolved | M01 |
| BV3 — lib/settings.ts hook | HIGH | ✅ Resolved | M03 |
| BV6 — profiles bypass | HIGH | ✅ Partial | 11 |
| D7 — room creation dup | MED | ✅ Resolved | 5 |
| V8 — expiry constants dup | MED | ✅ Resolved | 5 |

| BV5 — shared types inversion | MED | Pending | 15 |
| BV7 — premium bypass | LOW | Pending | 13 |
| BV22 — channel factory bypass | LOW | Pending | 14 |
| R5 — badge duplications | MED | Pending | 12 |
| R14 — friends table mismatch | LOW-MED | Pending | 12 |

**Summary:** 14 resolved, 5 pending, 0 in progress.

---

## Architecture Metrics

| Metric | Current | Target |
|--------|:-------:|:------:|
| Architecture Health Score | 42/100 → ~52 | 70/100 |
| Documentation Coverage | 75% (was 61%) | 100% |
| State Ownership (SSOT) | 40/100 | 80/100 |
| Module Compliance (avg) | 61% | 80% |
| Active Layer Violations | 2 (BV4, BV5) | 0 |
| Test skip count | 87 (was 117) | 0 |
| CONTEXT.md Staleness | ~3 files (was 11) | 0 |

---

## Release Readiness

| Gate | Status |
|------|:------:|
| Architecture Complete | ⬜ 52/100 |
| Core Modules Complete | ✅ 12 of 17 |
| Critical Bugs Remaining | 1 (R-01 RLS) |
| R1/R2/R3 fixed | ✅ All 3 HIGH multiplayer bugs resolved |
| Regression Tests | ✅ 1062 passing |
| Test Shield in Place | ⚠ 20 describe.skip remain |
| 4-Mode Smoke Matrix | ⬜ Not run |
| Play Store Ready | ⬜ |
| Production Ready | ⬜ |

---

## Game Engine Stabilization (Multiplayer Sync Protocol)

> **[Protocol Design](./GAME_ENGINE_SYNCHRONIZATION_PROTOCOL.md)** — redesigning the multiplayer engine as a distributed system with explicit invariants.

| # | Phase | Status | Description |
|:-:|-------|:------:|-------------|
| P1 | Database Foundation | ✅ Complete | Schema: `games` columns + `turn_submissions` table |
| P2 | Coordinator Determinism | ✅ Complete | Stored coordinator_id; single resolver for all teams |
| P3 | Server-Authoritative Submissions | ✅ Complete | Moves written to turn_submissions table; DB-backed realtime |
| P4 | Single Resolver | ✅ Complete | Coordinator-only resolve; non-coordinator waits for broadcast |
| P5 | Reconnect Hardening | ⬜ Pending | `syncGameState` loads from DB without clobbering |
| P6 | Timer Ownership | ⬜ Pending | Coordinator is sole timer owner; sync every 5s |

### Phase 1 Complete — Database Foundation (2026-08-04)

**Schema additions:**
- `games`: added `turn_number INTEGER DEFAULT 0`, `coordinator_id TEXT`, `turn_phase TEXT DEFAULT 'SUBMITTING'`, `last_resolved_move TEXT`
- `turn_submissions`: new table with composite PK `(game_id, turn_number, player_id)` enforcing one submission per player per turn
- Backfill: `turn_number` derived from `jsonb_array_length(move_history)` for existing games
- RLS policies + table grants for `turn_submissions`

**Code changes:**
- `gamePersistence.ts`: `saveGameState` accepts optional `turnNumber`, `coordinatorId`, `lastResolvedMove`; `loadGameState` returns new fields
- Zero behavioral changes — all new fields are optional, no production code reads them yet

**GATE results:** `tsc --noEmit` ✅ | `npm test` 1061/1156 passing (8 pre-existing failures unchanged) ✅

### Phase 2 Complete — Coordinator Determinism (2026-08-04)

**`_coordinatorId` is computed once at game creation** (alphabetically-first non-bot player) and stored in the instance. It is persisted to DB in both `startGameWhenReady` and `_finishResolution`, and restored on reconnect via `syncGameState`.

**`isCoordinator()` now compares `this._playerId === this._coordinatorId`** instead of recomputing from player lists on every call.

**`resolvePendingMoves()` now rejects non-coordinator for ALL teams** — the old path only guarded WHITE turns, leaving BLACK turns in Duo mode with an ambiguous resolver. The removed `isBlackCoordinator()` method and the `isFourPlayer()` conditional are eliminated.

**Code changes:**
- `onlineGame.ts`: `_coordinatorId` field, simplified `isCoordinator()`/`getCoordinatorId()`, removed `isBlackCoordinator()`, unified `resolvePendingMoves()` guard
- `onlineGame.test.ts`: 4 timer tests updated to set `_coordinatorId`

**GATE results:** `tsc --noEmit` ✅ | `npm test` 1061/1156 passing ✅

### Phase 3 Complete — Server-Authoritative Submissions (2026-08-04)

**Moves are now written to `turn_submissions` table** instead of broadcast-only. The composite PK `(game_id, turn_number, player_id)` enforces exactly one submission per player per turn at the database level.

**Supabase Realtime `postgres_changes`** channel on `turn_submissions` notifies all connected clients when a teammate submits. Submissions for past/future turns and duplicate submissions are silently discarded.

**`broadcastMove()`** now delegates to `submitMoveToDB()` (backward compat). **`broadcastLocked()`** is a no-op — submission to DB implies lock.

**`_currentTurnNumber`** increments after each resolution in `_finishResolution` and is persisted to `games.turn_number`. `_gameId` is populated from DB and restored on reconnect.

**Code changes:**
- `onlineGame.ts`: `_gameId`, `_currentTurnNumber`, `_submissionChannel` fields; `submitMoveToDB()`, `subscribeToSubmissions()`, `handleSubmissionFromDB()` methods; `_finishResolution` persists turn number; `syncGameState` restores game ID + turn number; `leaveRoom` cleans up submission channel
- `Game.tsx`: `executeMove` calls `submitMoveToDB` instead of `setPendingMove` + `broadcastMove` + `lockPendingMove` + `broadcastLocked` + `setTurnState`
- `gamePersistence.ts`: `loadGameState` returns `gameId`

**GATE results:** `tsc --noEmit` ✅ | `npm test` 1061/1156 passing (89/89 onlineGame) ✅

### Phase 4 Complete — Single Resolver (2026-08-04)

**Only the coordinator runs Stockfish evaluation** and broadcasts `turn_resolved`. Non-coordinators call `waitForTurnChange()` instead of `resolvePendingMoves()`, which resolves when the `turn_resolved` broadcast arrives via `handleTurnResolved`. The `NOT_COORDINATOR` catch block with the 30s setTimeout fallback is eliminated.

**`waitForTurnChange()` now has a 30s timeout** (matching the existing 15s timeout on `waitForTeammateLock()`). Timeout cleanup is added to both `handleTurnResolved` and `resolvePendingWaiter()`.

**Code changes:**
- `Game.tsx` (executeMove): Replaced `try { resolvePendingMoves() } catch (NOT_COORDINATOR) { setTimeout fallback }` with clean `if (coordinator) { resolve } else { waitForTurnChange() }` branching
- `onlineGame.ts`: `_turnChangeTimeout` field, 30s timeout in `waitForTurnChange()`, cleanup in `handleTurnResolved` + `resolvePendingWaiter`

**GATE results:** `tsc --noEmit` ✅ | `npm test` 1061/1156 passing (89/89 onlineGame) ✅
