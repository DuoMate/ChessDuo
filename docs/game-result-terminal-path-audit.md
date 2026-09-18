# Game Result Terminal-Path Audit — Resignation vs Timeout

Date: 2026-09-18. Scope: why resigning while ahead could be recorded/displayed as a WIN.
Rule: termination reason is authoritative; score/material must never override resignation.

## Result: no score-based override exists; two fabrication/overwrite vectors found and fixed

All resign handlers set the opponent as winner explicitly. Persistence
(`matchHistory.saveCompletedGame` → `completed_games.winner/game_result/game_over_reason`),
history, replay, and stats consume the stored values verbatim — no layer
recalculates a winner from material. The bug vectors were a fabricated
resignation result and a missing terminal guard (below), not a
`calculateWinnerFromScore()` — none exists in the codebase.

## Terminal paths by mode

| Mode | Resign path | Timeout path | Winner rule |
|---|---|---|---|
| Quick offline | `Game.tsx:2255` → `Resigned - <opposite> wins` / `'resignation'` | `Game.tsx:1153` → captured-pieces count | Resign: opponent wins. Timeout: existing material-proxy rule (preserved) |
| Duo/4P online | `onlineGame.abandonMatch:2659` → same string / `'resignation'` + `match_abandoned` broadcast | `onlineGame.startMatchTimer:1338` (coordinator) → captured-pieces count + `match_timeout` broadcast | Same as above; 4P shares Game.tsx/OnlineGame (`fourplayer=1`), no separate handlers |
| Duel | `duelGame.resign:773` → opponent wins / `'resignation'` | `duelGame.handleTimeout:537` → opposite of expired side | Preserved |
| Coach | `coachGame.resign:201` → `'Loss by resignation'` | None (no clock) | Preserved |

## Root causes fixed

1. **H1 — DB fallback fabricated resignation** (`onlineGame.handleGameStatusUpdate:2645`):
   any DB-observed `games.GAME_OVER` instantly became `Resigned - <own> wins` /
   `'abandoned'`. The row carries no reason, so timeouts/checkmates observed via
   the row were mislabeled with the wrong winner, then persisted to history/stats.
   Fix: bounded `DB_GAME_OVER_GRACE_MS` (4000, `gameConstants.ts`) awaiting the
   authoritative `match_timeout`/`match_abandoned` broadcast (sent BEFORE the row
   write); assume abandonment only on grace expiry (lost-broadcast peer-left case).
   Timer cleared on every authoritative terminal path + `leaveRoom`.
2. **H2 — missing terminal guard** (`localGame.setGameOverTimeup:198`): a late
   timeout call overwrote an explicit resignation. Fix: return early when
   `_gameOverResult/_gameOverReason` already set (mirrors `getResult` precedence;
   `_status`-based guard would not cover offline resign, which records result
   strings without flipping engine status).

## Adjacent issues flagged, NOT fixed (out of scope)

- `getFriendStats` (`friends.ts:282`) assumes the friend is WHITE (inverts BLACK games).
- HistoryPanel/history-page `player_labels.includes(playerId)` identity mismatch.
- Duel forfeit persists `reason='timeout'` while the string says "by forfeit".
- `Game.tsx` winner-by-substring-parse fragility.

## Git history consulted

`b29366d` production hardening (terminal states/authoritative clocks),
`000275d` resign flow, `5be3166` resigner history `room_id`, `cb69f2f` history
labels, `01fb70e` resign/leave focus states.

## Verification

- New: `localGame` resignation-survives-timeout; `onlineGameTerminal` H1 trio
  (no immediate fabrication / grace-expiry abandonment / broadcast wins).
- Updated: `onlineGameGroup2` H4 fallback test to grace semantics.
- `npx tsc --noEmit` clean; all game-result suites green; full-suite failures
  limited to the pre-existing baseline (ConfirmMoveBar/SidebarNav/server-engine).
