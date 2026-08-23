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
- **Evaluator**: All evaluation local via `BrowserMoveEvaluator` (Stockfish WASM, MultiPV=6).
- **Resolution**: `evaluateMoves([player1Uci, player2Uci], fen)` — compares only the 2 player moves (not all legal moves). Both receive real engine scores. `bestEngineMove` = higher-scored of the two.
- `GameStatus` enum: WAITING → READY → PLAYING → GAME_OVER.
- `MoveComparison` tracks both players' moves, accuracy, engine evaluation.
- Stats tracked: `movesPlayed`, `syncRate`, `conflicts`, `winningMoves`, per-player accuracy.
- Coordinator pattern: local player acts as coordinator (no network needed).

## Dependencies
- `GameState` from `game-engine/`, `GameInterface` from `shared/`, `BrowserMoveEvaluator` from `mobile-engine/`

## Recent Changes
- **2026-08-16**: **Black-human freeze fix** — `resolvePendingMoves()` now catches `BrowserMoveEvaluator` failures and falls back to neutral scores so the turn still resolves when Stockfish/WASM is not ready. Prevents the stuck "White to move" state on the first bot turn.
- **2026-07-30**: Resolution refactored — passes only 2 player moves to `evaluateMoves()` instead of all legal moves. `SERVER_URL` env var removed (evaluator always local WASM).
- **2026-08-03**: **D1 fix** — Deleted ~170-line duplicate `resolveLegacy` body. Replaced with thin adapter that converts legacy `selectMove`/`lockMove` API to `resolvePendingMoves`. Resolution logic now lives in exactly one place.
- **2026-08-23**: **ADR-005 Resolution Ownership** — Adds `lastHumanResolution` getter (implements `GameInterface`). Set only when `currentTeam===getTeam()` so opponent/bot resolutions keep the panel stable; board still uses `lastMoveComparison`.
