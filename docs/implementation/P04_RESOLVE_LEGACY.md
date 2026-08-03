# IMPLEMENTATION REPORT — M14 D1 Delete resolveLegacy (Position 4)

> **Date:** 2026-08-03
> **Position:** 4 (62.3 priority score)
> **Module:** M14 LocalGame
> **Commit:** `405e2e0`

## Summary

Deleted ~170-line duplicate `resolveLegacy` body in `localGame.ts`. Replaced with a 15-line adapter that converts legacy `selectMove`/`lockMove` API to the pending moves API and delegates to `resolvePendingMoves`. Resolution logic now lives in exactly one place.

## Files Changed

| # | File | Lines |
|---|------|-------|
| 1 | `src/features/offline/game/localGame.ts` | +9, −159 |
| 2 | `src/features/offline/game/CONTEXT.md` | +1 |

## Architecture Rules Applied

| Rule | Description |
|------|-------------|
| D1 CRITICAL | `resolveLegacy` fully duplicated `resolvePendingMoves` — deleted duplicate, routed through shared path |
| S-04 | Single resolution implementation for offline path |

## Bug Reduction

| Bug | Before | After |
|-----|--------|-------|
| D1 CRITICAL — 2 resolution paths | ❌ Duplicate | ✅ Single path |
| S-04 — resolveLegacy divergence | ❌ Risk of divergence | ✅ Unified |

## Validation Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ Zero errors |
| `npm test` (localGame paths) | ✅ 91/91 passed |
| `npm test` (full) | ✅ 997/1122 passed (8 pre-existing) |

## Key Design Decision

`startPendingTurn(this.gameState.fen)` is called BEFORE `setPendingMove` to record the turn start FEN. The `getSelectedMove()` calls happen before `startPendingTurn` (which clears selections), so the data is captured first.

## Rollback

```bash
git revert 405e2e0
```

## Lessons Learned

1. **`startPendingTurn` clears selections.** Read the data BEFORE calling it, then set up pending moves after.
2. **`getTurnStartFen` differs from `this.gameState.fen`.** The adapter preserves the behavior by using `gameState.fen` at the time the move was locked.
