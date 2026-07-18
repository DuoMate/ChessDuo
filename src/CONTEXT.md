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

## Recent Changes
- **2026-07-18**: Major session — converted panels to pages (/friends, /settings, /welcome), fixed badge (useBadgeCount hook), fixed Google avatars, fixed sounds, fixed favicon, fixed auth timing, UI/UX bug hunt (34 fixes), notification deep-link routing. All changes merged to prod.
- **2026-07-12**: Board page UI revamp — dark glassmorphism theme, chess board sized to ~80% of viewport, new `BoardTopBar` / `BoardBottomNav` / `PendingMovesRow` / `ConfirmMoveButton` / `MoveResolvedInline` / `RoundHistorySidebar` components. New `confirmMove` setting (off by default). Applied to `Game.tsx`, `DuelGame.tsx`, and `ReplayView.tsx`.
- **2026-07-12**: Added `confirmMove: boolean` to `useSettings()` (default false).
- **2026-07-12**: Avatar styling unified on home page — `TeamIcon` type reverted, all icons `w-10 h-10 rounded-full` with `object-contain`, icon column fixed to `w-[200px]` for uniform text alignment. `bot.webp` regenerated as a clean square (160x168).
- **2026-07-12**: Quick Play team composition simplified to `You + WhiteBot vs BlackBot` (one bot per side). The `LocalGame` engine still spawns 4 placeholders for compatibility with `startMatch()`'s 2-per-team invariant, but the `BoardTopBar` derivation collapses the visual to a single bot per side. Online / Duo / Four-Player modes keep all human tiles.
- **2026-07-12**: Pending moves row shows `Your Move · <name>` and `Teammate · <name>` in Quick Play so the player can see whose move is whose at a glance.
- **2026-07-13**: Added shadow CSS variables (`--shadow-glow-blue-*`, `--shadow-glow-green`, `--shadow-glow-emerald-*`, `--drop-shadow-glow-blue`) to `globals.css`. Replaced all hardcoded `rgba` shadows in `page.tsx`, `ConfirmMoveButton`, and `MoveResolvedInline` with variable references. Converted all `style={{}}` for static minHeight values to Tailwind classes. Fixed RoundHistorySidebar close button to 44×44px. Normalized avatar img download attrs to 40×40px (matching display size). Moved `SplashHandler` inside `Providers`. Added `/history` route to middleware auth guard.
