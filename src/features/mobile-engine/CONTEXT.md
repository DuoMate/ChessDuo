# Module: Mobile Engine / Evaluator Factory

## Purpose
Abstraction layer for chess move evaluation — provides a unified interface for both browser-based and Capacitor-native Stockfish evaluation.

## Key Files
| File | Purpose |
|------|---------|
| `evaluatorFactory.ts` | Creates the appropriate evaluator (browser WASM or remote) |
| `BrowserMoveEvaluator.ts` | Browser-specific Stockfish WASM integration |

## Logic & Decisions
- Evaluator factory pattern: returns either browser WASM evaluator or remote HTTP evaluator depending on environment.
- `GameEvaluator` interface consumed by both LocalGame and OnlineGame.
- Tests in co-located `__tests__/` directory.

## Dependencies
- Stockfish WASM (in `public/`), optional remote Stockfish server
