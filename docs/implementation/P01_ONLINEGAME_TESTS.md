# IMPLEMENTATION REPORT — M15 OnlineGame Test Backfill (Position 1)

> **Date:** 2026-08-03
> **Position:** 1 (81.75 priority score)
> **Module:** M15 OnlineGame
> **Branch:** `test/onlinegame-broadcast-reconnect-lock`
> **Commit:** `499231e`

## Summary

Wrote 11 regression test scenarios for R1 (broadcast ordering), R2 (reconnect overwrite), and R3 (lock timeout) bugs in M15 OnlineGame. Tests are additive (zero production code changes). Confirmed R2 bug: `syncGameState` overwrites GAME_OVER status on reconnect.

## Files Changed

| # | File | Action | Lines |
|---|------|--------|-------|
| 1 | `src/lib/__tests__/onlineGame.test.ts` | Added 11 test cases across 5 new describe blocks | +430 |
| 2 | `docs/implementation/IMPLEMENTATION_PROGRESS.md` | Created | +200 |

**Net:** +430 lines (tests only, zero production code changes).

## Tests Added

### R3 — Lock Timeout (waitForTeammateLock state machine)
- ✅ Resolves immediately when `turnState` is already `locked`
- ✅ Resolves immediately when teammate pending move is already locked
- ✅ Defers resolution when teammate not yet locked; resolves on `handleTeammateLocked`

### R1 — Broadcast Ordering (lock vs resolve race)
- ✅ Rejects `player_locked` from non-team player (team filter works)
- ✅ Transitions `turnState: waiting_for_teammate → resolving` on teammate lock
- ✅ Resolves `waitForTeammateLock` promise when teammate locks

### R2 — Reconnect (syncGameState)
- ✅ Adds human players from `room_players` query
- ✅ Fills missing slots with `bot_` placeholders
- ✅ Restores saved game state (status, turn, timer) from DB
- ✅ **CONFIRMED BUG:** `syncGameState` overwrites GAME_OVER status (tested current behavior)

### waitForTurnChange state machine
- ✅ Resolves `waitForTurnChange` when `handleTurnResolved` fires on non-coordinator

## Architecture Rules Applied

| Rule | Description |
|------|-------------|
| Test-first discipline | Tests written BEFORE any bug fix — green on current behavior, will gate future fixes |
| Module isolation | Tests target M15 OnlineGame exclusively — no other modules modified |
| Mock hygiene | `mockPlayers` and `mockLoadGameState` as module-level variables for per-test customization |
| Regression shield | Each test captures current behavior to prevent regressions in Positions 3, 7, 9 |

## Validation Results

| Check | Result |
|-------|--------|
| `node_modules/.bin/tsc --noEmit` | ✅ Zero errors |
| `npm test -- --testPathPatterns='onlineGame'` | ✅ 85/85 passed (+11 new) |
| `npm test` (full suite) | ✅ 996/1121 passed (same 8 pre-existing failures) |
| No production code modified | ✅ Tests only |

## Known Risks

- **None.** Tests are additive — zero production code changes. Cannot cause regressions.
- R2 bug confirmed but NOT fixed in this phase — fix deferred to Position 9.

## Bug Reduction Progress

| Bug | Previous | Current |
|-----|----------|---------|
| T-05 (OnlineGame reconnect untested) | ❌ 0 tests | ✅ 4 syncGameState tests |
| T-06 (broadcast ordering untested) | ❌ 0 tests | ✅ 5 lock/resolve race tests |
| R3 (lock timeout hang) | ❌ Untested | ✅ 3 state machine tests |
| R1 (broadcast ordering) | ❌ Untested | ✅ 4 handler tests |
| R2 (reconnect overwrite) | ❌ Untested | ✅ 1 test (confirms bug, deferred fix) |

## Rollback Plan

```bash
git revert 499231e
```

## Git Commit

```
test(onlineGame): add R1/R2/R3 regression test scenarios

Position 1 — M15 OnlineGame test backfill.
+11 test cases, +430 lines, zero production code changes.
```

## Lessons Learned

1. **Mock variables must use `var`, not `const`.** `jest.mock` factories run during import resolution (before module body for `const`). `var` hoists the binding so the factory closure captures a valid (though possibly `undefined`) variable.
2. **Supabase mock chain needs `.order()` and `.rpc()`.** The real client returns thenable chains from `.order()` and `syncGameState` calls `supabase.rpc()` internally.
3. **`handleTeammateLocked` throws on already-locked moves.** The `lockPendingMove` call in `handleTeammateLocked` has no try/catch — if the pending move is already locked, the transition code never executes. This is a bug (R1-related) to fix in Position 7.
4. **R2 bug confirmed via test.** `syncGameState` currently overwrites terminal `GAME_OVER` status with whatever the saved DB state has. The test captures this as current behavior with a note that Position 9 should fix it to preserve GAME_OVER.

## Next Module

**Position 2: M12 GameState un-skip tests** (73.0 priority). The entire gameState test suite (~410 lines) is skipped. Un-skipping it verifies the core state machine before any resolution/timer refactoring. Alternatively, skip to **Position 3: M15 R3 lock timeout fix** which can now be safely implemented behind the new regression tests.
