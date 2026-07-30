# Module: Local Game (Offline)

## Purpose
Fully client-side 2v2 game implementation. No network dependency — supports local play, bot opponents, and hot-seat mode.

## Key Files
| File | Purpose |
|------|---------|
| `localGame.ts` | LocalGame class — implements GameInterface, manages game lifecycle |

## Logic & Decisions
- Implements `GameInterface` — same contract as OnlineGame.
- Move selection → lock → resolution cycle resolved entirely client-side.
- **Evaluator**: All evaluation local via `BrowserMoveEvaluator` (Stockfish WASM, MultiPV=2).
- **Resolution**: `evaluateMoves([player1Uci, player2Uci], fen)` — compares only the 2 player moves (not all legal moves). Both receive real engine scores. `bestEngineMove` = higher-scored of the two.
- `GameStatus` enum: WAITING → READY → PLAYING → GAME_OVER.
- `MoveComparison` tracks both players' moves, accuracy, engine evaluation.
- Stats tracked: `movesPlayed`, `syncRate`, `conflicts`, `winningMoves`, per-player accuracy.
- Coordinator pattern: local player acts as coordinator (no network needed).

## Dependencies
- `GameState` from `game-engine/`, `GameInterface` from `shared/`, `BrowserMoveEvaluator` from `mobile-engine/`

## Recent Changes
- **2026-07-30**: Resolution refactored — passes only 2 player moves to `evaluateMoves()` instead of all legal moves. Works with MultiPV=2 evaluator. `SERVER_URL` env var removed (evaluator always local WASM).
- **2026-07-18**: `LocalGame` constructor accepts `playerColor: PlayerColor` (default `'white'`). `'random'` is resolved once at construction. `getPlayerColor()`, `getHumanSlot()`, `getTeammateSlot()` added. `getTeam()` now returns the resolved color. `player1Id` returns the human's slot ID (so `MoveComparison` consumer "isPlayer1" logic is correct after color swap).
