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
| `avatars.ts` | `HUMAN_AVATARS` map (7 humans), `BOT_AVATAR` constant, `getAvatarUrl(type, avatar?)` helper |

## Logic & Decisions
- `GameInterface` is the single source of truth — never use `as any` on game references.
- Magic numbers used 3+ times go in `gameConstants.ts` — never hardcoded.
- Accuracy formula: 100% (≤10cp loss) to 0% (≥300cp loss), linear interpolation in between.
- Categories: Perfect, Great, Good, Inaccuracy, Mistake — each with emoji + color.
- Avatars: `getAvatarUrl(type, avatar?)` returns a path under `/avatars/`. Humans use named WebPs (`human-ace.webp` etc.); bots use the single `bot.webp`. The webps are near-square so they composite cleanly inside circular `rounded-full` containers.

## Recent Changes
- **2026-07-12**: Added `avatars.ts` shared module — extracted from the duplicated constants in `src/app/page.tsx` and used by the new `BoardTopBar` component.

## Dependencies
- `chess.js` types, `game-engine/` types for Player/Team/PendingMoveInfo
