# IMPLEMENTATION REPORT — M15 R3 Lock Timeout Fix (Position 3)

> **Date:** 2026-08-03
> **Position:** 3 (72.3 priority score)
> **Module:** M15 OnlineGame
> **Branch:** `test/onlinegame-broadcast-reconnect-lock`
> **Commit:** `7ca7cd2`

## Summary

Added a 15-second engine-level timeout to `waitForTeammateLock()`. Previously, the Promise hung forever if the `player_locked` broadcast was lost — only M17's UI-level 30s React guard compensated. The engine now resolves automatically after 15s via `setTimeout` fallback.

## Files Changed

| # | File | Lines |
|---|------|-------|
| 1 | `src/features/online/game/onlineGame.ts` | +38, −2 |
| 2 | `src/lib/__tests__/onlineGame.test.ts` | +18 |
| 3 | `src/features/online/game/CONTEXT.md` | +1 |

## Architecture Rules Applied

| Rule | Description |
|------|-------------|
| R3 fix | `waitForTeammateLock` no longer hangs indefinitely — engine-level bounded wait |
| Layer separation | Timeout stays in engine (M15), not UI (M17) — correct separation |
| Test-first | Timeout test added using jest.useFakeTimers for deterministic assertion |

## Bug Reduction

| Bug | Before | After |
|-----|--------|-------|
| R3 — players stuck 30s on lost broadcast | ❌ Hang forever | ✅ Auto-resolves after 15s |

## Validation Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ Zero errors |
| `npm test -- onlineGame` | ✅ 86/86 passed |
| `npm test` (full) | ✅ 997/1122 passed (8 pre-existing) |

## Rollback

```bash
git revert 7ca7cd2
```

## Lessons Learned

1. **Don't make the Promise return type change.** Keeping `Promise<void>` avoided cascading API changes in M17 and callers.
2. **Clean timeout in both normal and race paths.** `handleTeammateLocked` clears on normal lock; `handleTurnResolved` clears when turn resolves before teammate locks (R1 crossover).
3. **`jest.useFakeTimers` + `advanceTimersByTime`** gives deterministic timeout tests without real 15s waits.
