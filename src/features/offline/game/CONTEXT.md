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
- Bot evaluation via Stockfish (remote server or WASM).
- `GameStatus` enum: WAITING → READY → PLAYING → GAME_OVER.
- `MoveComparison` tracks both players' moves, accuracy, engine evaluation.
- Stats tracked: `movesPlayed`, `syncRate`, `conflicts`, `winningMoves`, per-player accuracy.
- Coordinator pattern: local player acts as coordinator (no network needed).

## Dependencies
- `GameState` from `game-engine/`, `GameInterface` from `shared/`
- Stockfish server (`NEXT_PUBLIC_STOCKFISH_SERVER_URL`) for evaluation
