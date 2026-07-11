# Module: Match History Page

## Purpose
Lists completed games for the authenticated user. Supports viewing past match results and entering replay.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders HistoryPanel with loading/empty/error states |

## Logic & Decisions
- Three states: loading (Spinner), empty (EmptyState), error (ErrorDisplay).
- Links to `/replay/[gameId]` for detailed playback.
- Co-located tests in `__tests__/`.

## Dependencies
- `@/components/HistoryPanel` — match history list UI
- `@/lib/matchHistory` — data access
