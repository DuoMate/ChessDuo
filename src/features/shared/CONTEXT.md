# Module: Shared Game Utilities

## Purpose
Interfaces, constants, and utility functions shared across all game modes (online, offline, bots).

## Key Files
| File | Purpose |
|------|---------|
| `GameInterface.ts` | Shared interface contract for OnlineGame + LocalGame |
| `gameConstants.ts` | Magic numbers (CHECKMATE_SCORE, timer defaults, ROOM_EXPIRY_MS) |
| `accuracy.ts` | Lichess hyperbolic accuracy model + centipawn loss categories |
| `evaluationCache.ts` | Stockfish evaluation result cache |

## Logic & Decisions
- `GameInterface` is the single source of truth — never use `as any` on game references.
- Magic numbers used 3+ times go in `gameConstants.ts` — never hardcoded.
- Accuracy formula: 100% (≤10cp loss) to 0% (≥300cp loss), linear interpolation in between.
- Categories: Perfect, Great, Good, Inaccuracy, Mistake — each with emoji + color.

## Dependencies
- `chess.js` types, `game-engine/` types for Player/Team/PendingMoveInfo
