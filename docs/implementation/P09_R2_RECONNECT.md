# IMPLEMENTATION REPORT — M15 R2 Reconnect Merge Fix (Position 9)

> **Date:** 2026-08-03
> **Position:** 9 (59.0 priority score)
> **Module:** M15 OnlineGame
> **Commit:** `55939c9`

## Summary

`syncGameState` was blindly overwriting `_status` and `currentTurn` from DB saved state on reconnect, even when the current engine had progressed further. Added move-count comparison to determine which state is fresher.

## Files Changed

| # | File | Lines |
|---|------|-------|
| 1 | `src/features/online/game/onlineGame.ts` | +7, −2 |

## How It Works

```
savedMoves = saved.moveHistory.length
currentMoves = this._savedMoveHistory.length

If savedMoves >= currentMoves  → restore from saved (DB is fresher)
If current is WAITING           → restore from saved (just joining)
Otherwise                       → keep current state (engine is fresher)
```

## Bug Reduction

| Bug | Before | After |
|-----|--------|-------|
| R2 — reconnect overwrites state | ❌ Active HIGH bug | ✅ Fixed |

## Validation Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ Zero errors |
| `npm test -- onlineGame` | ✅ 89/89 passed |
| `npm test` (full) | ✅ 1062/1157 passed (8 pre-existing) |

## Rollback

```bash
git revert 55939c9
```
