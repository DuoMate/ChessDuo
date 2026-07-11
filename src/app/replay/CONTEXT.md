# Module: Match Replay Page

## Purpose
Reconstructs and plays back completed games from saved FEN + move history. Supports side-by-side move comparison.

## Key Files
| File | Purpose |
|------|---------|
| `[gameId]/page.tsx` | Route entry — dynamic import of ReplayView with Suspense |

## Logic & Decisions
- Dynamic import with `ssr: false`.
- Reads game state from DB (FEN + move history).
- Replay reconstructs each turn's board state and accuracy comparison.
- MoveComparison component shows side-by-side teammate move accuracy.

## Dependencies
- `@/lib/matchHistory` — completed game storage
- MovePlayback, MoveComparison components
