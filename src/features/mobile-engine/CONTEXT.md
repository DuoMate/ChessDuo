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
- **2026-08-02**: **Reverted** Phase 6.4 engine changes — MultiPV restored from 2 back to 6, worker init restored to eager (constructor), `uciEvaluate` restored to return ALL moves with 0-padding for unscored ones, `getBestScore()` restored to use MultiPV-driven `uciEvaluate` (not standalone bestmove parser). Root cause: MultiPV=2 only returned 2 PV lines but Master level bot needs `topMoves: 6`, forcing fallback to crude material-count heuristic for 4 moves. This caused the black bot at Grandmaster level to play blunders.
