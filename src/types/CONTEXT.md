# Module: TypeScript Declarations

## Purpose
TypeScript ambient declarations for external libraries that lack built-in types.

## Key Files
| File | Purpose |
|------|---------|
| `cm-chessboard.d.ts` | Type stubs for cm-chessboard library |
| `stockfish.d.ts` | Type stubs for Stockfish WASM |

## Logic & Decisions
- Minimal declarations — only expose the APIs actually used in the codebase.
- No third-party `@types/` packages needed for these libraries.
- Declarations kept in sync with library versions in `package.json`.

## Dependencies
- None — pure type declarations
