# Module: Bot AI

## Purpose
Chess bot player system — move generation, difficulty tiers, opening book, and Stockfish evaluation integration.

## Files at This Level
| File | Purpose |
|------|---------|
| `chessBot.ts` | Bot move generation — selects moves based on difficulty |
| `botConfig.ts` | Skill level config (1-6), ELO mapping, env-var overrides |
| `difficulty.ts` | Per-level params: depth, topMoves, noise, weights, blunder/weird chance |
| `openings.ts` | Opening book for early-game variety |

## Sub-modules
| Module | Context |
|--------|---------|
| `__tests__/` | Bot unit tests |

## Logic & Decisions
- 6 difficulty tiers from Beginner (~1000 ELO) to Master (~2600 ELO).
- Bot skill controlled by: engine depth, top-move selection, noise injection, blunder probability.
- `difficulty.ts` uses weighted random selection from top N engine moves.
- Opening book provides varied early-game play across 5+ common openings.
- **Evaluator**: All moves evaluated locally via `BrowserMoveEvaluator` (Stockfish WASM, MultiPV=2). Moves not caught by engine PV lines fall back to `fallbackEvaluate()` — material-count heuristic.
- Two separate skill levels configurable: opponent bot and teammate bot.

## Dependencies
- `BrowserMoveEvaluator` (mobile-engine), `shared/gameConstants.ts`

## Recent Changes
- **2026-07-30**: Removed `SERVER_URL` env var dependency. Evaluator always uses browser WASM (no remote server). `isUsingStockfish()` check removed from constructor — always true. Evaluator reuses shared instance from `evaluatorFactory`.
