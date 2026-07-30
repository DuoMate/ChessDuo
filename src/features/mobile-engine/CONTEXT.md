# Module: Mobile Engine / Evaluator Factory

## Purpose
Abstraction layer for chess move evaluation — provides a unified interface for browser-based Stockfish WASM evaluation.

## Key Files
| File | Purpose |
|------|---------|
| `evaluatorFactory.ts` | Factory singleton — creates shared BrowserMoveEvaluator instance |
| `BrowserMoveEvaluator.ts` | Stockfish WASM integration via Web Worker (UCI protocol) |

## Logic & Decisions
- **Lazy init**: Worker is NOT created in constructor. Created on first `evaluateMoves()` / `getBestScore()` / `playMove()` call. Saves memory when game hasn't started. `terminate()` kills worker for Capacitor lifecycle management.
- **MultiPV=2**: Engine uses 2 principal variations (was 6). Each scored move comes from a real PV line — no score=0 padding for unscored moves. ChessBot's `evaluateMovesWithFallback()` handles non-scored moves via material-count heuristic (`fallbackEvaluate()`).
- **getBestScore()**: Uses single `bestmove` line from engine (not MultiPV-dependent). Single engine call, deepest search for one best move.
- **Resolution**: Both `localGame` and `onlineGame` now pass only the 2 player moves to `evaluateMoves()` (not all legal moves). Both get real scores with MultiPV=2.
- No remote server dependency — all evaluation runs locally in the browser/Capacitor WebView via Stockfish WASM.
- Tests in co-located `__tests__/` directory, including `benchmark.test.ts` for correctness validation.

## Dependencies
- Stockfish WASM (in `public/stockfish/stockfish.js`), `evaluationCache` from shared

## Recent Changes
- **2026-07-30**: MultiPV reduced from 6 to 2. Lazy worker init — worker not created until first evaluation call. Added `terminate()` for Capacitor app lifecycle. `getBestScore()` rewritten to use `bestmove` line directly (single-PV, deeper search). `uciEvaluate()` only returns moves with real PV scores (no score=0 padding). `evaluatorFactory` no longer accepts `_serverUrl` parameter — all evaluation is local WASM. SERVER_URL env var removed from all game files. Resolution flow simplified to 2-move comparison.
