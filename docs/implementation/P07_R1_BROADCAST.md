# IMPLEMENTATION REPORT — M15 R1 Broadcast Ordering Fix (Position 7)

> **Date:** 2026-08-03
> **Position:** 7 (68.0 priority score)
> **Module:** M15 OnlineGame
> **Commit:** `bee09e2`

## Summary

Added `_turnSequence` counter to reject stale `turn_resolved` broadcasts that arrive out of order. Supabase Broadcast doesn't guarantee message ordering — a `turn_resolved` from a previous turn could arrive after a new turn has started, corrupting game state.

## Files Changed

| # | File | Lines |
|---|------|-------|
| 1 | `src/features/online/game/onlineGame.ts` | +9, −1 |
| 2 | `src/lib/__tests__/onlineGame.test.ts` | +69 |
| 3 | `src/features/online/game/CONTEXT.md` | +1 |

## How It Works

1. `_finishResolution` increments `_turnSequence` before broadcasting
2. `turnSequence` attached to `turn_resolved` payload
3. `handleTurnResolved` rejects payloads where `turnSequence < _turnSequence`

## Bug Reduction

| Bug | Before | After |
|-----|--------|-------|
| R1 — stale broadcast ordering | ❌ Active HIGH bug | ✅ Fixed |

## Validation Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ Zero errors |
| `npm test -- onlineGame` | ✅ 89/89 passed (+3) |
| `npm test` (full) | ✅ 1041/1136 passed (8 pre-existing) |

## Rollback

```bash
git revert bee09e2
```
