# Module: Game Engine

## Purpose
Core chess game state management — board position, phase tracking, timers, pending moves. The foundation that both LocalGame and OnlineGame build upon.

## Key Files
| File | Purpose |
|------|---------|
| `gameState.ts` | GameState class — board, phases (WAITING→SELECTING→LOCKED→RESOLVED→GAME_OVER), teams, timers, pending moves |

## Logic & Decisions
- `GameState` is decoupled from networking — used identically by LocalGame and OnlineGame.
- Phase enum: `WAITING` → `SELECTING` (choosing moves) → `LOCKED` (confirmed) → `RESOLVED` (engine evaluated) → repeat or `GAME_OVER`.
- Team enum: `WHITE` / `BLACK`, each team has 2 players.
- Timer: configurable match time limit (default 600s), starts when match begins.
- Pending moves tracked per-player with lock status.
- `clearPendingMove(player)` removes a single player's pending move + lock + selection (recovery primitive — lets a failed submission or missed teammate event be rolled back without clearing the whole turn, so the board can always be re-enabled).

## Dependencies
- `chess.js` for board state and move validation
- `gameConstants.ts` for DEFAULT_TEAM_TIMER_SECONDS
