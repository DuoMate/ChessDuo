# Module: Source Root

## Purpose
All application source code for the Next.js frontend. Organized by App Router pages, React components, framework-free domain logic, hooks, and utilities.

## Files at This Level
| File | Purpose |
|------|---------|
| — | No source files at root; everything is in subdirectories |

## Sub-modules
| Module | Context |
|--------|---------|
| `app/` | `src/app/CONTEXT.md` — App Router pages, layout, providers, API routes |
| `components/` | `src/components/CONTEXT.md` — 50+ React components |
| `features/` | `src/features/CONTEXT.md` — Domain logic (game engine, bots, online/offline) |
| `hooks/` | `src/hooks/CONTEXT.md` — React hooks (viewport, guard, network) |
| `lib/` | `src/lib/CONTEXT.md` — Utilities & services (Supabase, auth, payments, sounds) |
| `types/` | `src/types/CONTEXT.md` — TypeScript declarations (cm-chessboard, Stockfish) |

## Logic & Decisions
- All game logic lives in `features/` — zero framework dependency. React only touches `components/` and `hooks/`.
- `GameInterface.ts` contract enforced between `features/online/game/` and `features/offline/game/`.
- Co-located `__tests__/` directories next to source, never a global `tests/` folder.

## Dependencies
- Next.js 16, React 19, Tailwind CSS v4, Supabase JS SDK
