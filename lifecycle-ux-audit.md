# Lifecycle UX Audit — HOME → LOBBY → GAME → GAME OVER → REVIEW/HOME

> Scope lock: UI/presentation only. Aligned to `docs/ARCHITECTURE.md`.
> No chess rules, engine, timers authority, sync, Supabase/Realtime/DB,
> auth/OAuth, room logic, API, billing/entitlement, AdMob SDK/units.

## Severity legend
- P0 — user doesn't know if action worked / confusing navigation / stale UI
- P1 — poor loading/empty/error feedback, unclear button state, inconsistent transition
- P2 — spacing/type/radius/hierarchy polish
- P3 — minor a11y/consistency

## Batch 1 — HOME → LOBBY (`src/app/page.tsx`)
| ID | Screen | Problem | Severity | UI-only fix | Status |
|----|--------|---------|----------|-------------|--------|
| L-H1 | Home mode cards | `GameModeCard`/`TimePills` had no press feedback (`active:scale`) while Start did | P1 | Add `active:scale-[0.98]` to cards + pills | DONE |
| L-H2 | Auth overlay | Mount/unmount with no fade — abrupt flash | P1 | `AnimatePresence` fade 150ms on overlay | DONE |
| L-H3 | How to play | `text-[11px]` link, no 44px target | P1 | `min-h-[44px] px-4 py-2 inline-flex items-center` | DONE |
| L-H4 | Start button | `style={{bottom:'84px'}}` static, ignores safe-area | P0 | Tailwind `bottom-[calc(84px+env(safe-area-inset-bottom,0px))]` | DONE |
| L-H5 | Join error | Plain text, no `role=alert` | P1 | Add `role="alert"` + retry hint preserved | DONE |

## Batch 2 — LOBBY → GAME (`GameLobby`, `GameLoading`, `FourPlayerLobby`, `MatchmakingQueue`)
| ID | Screen | Problem | Severity | UI-only fix | Status |
|----|--------|---------|----------|-------------|--------|
| L-L1 | GameLobby room code | `bg-[#151c2e]` hardcoded hex, dark-only surface | P1 | Tailwind `bg-slate-900/60 dark:bg-[#151c2e]`-free token pair (light + dark) | DONE |
| L-L2 | GameLoading copy | Copy buttons give no `Copied` feedback | P1 | `copied` state + `CheckCircle2 Copied` (same as GameLobby) | DONE |
| L-L3 | GameLoading timeline | `tl.add(ref.current!)` non-null crash risk | P1 | Null-guard refs before timeline add | DONE |
| L-L4 | FourPlayer rows | `py-2` rows <44px; Start conditionally renders (layout jump) | P0 | `min-h-[44px]` rows; always-render Start with `disabled` + reason | DONE |
| L-L5 | MatchmakingQueue | `Something went wrong` generic, no retry context; inconsistent spinner vs motion icons | P1 | Specific copy + `role=alert`; unify status spinner | DONE |
| L-L6 | Lobby countdown | Only shows <30s; user wonders if frozen | P1 | Always show `Waiting · auto-leaves in Xs` muted row | DONE |

## Batch 3 — LIVE GAME (`Game`, `DuelGame`, `ChessBoard`, `BoardTopBar`, `BoardBottomNav`, `TeamTimer`, `MatchTimer`)
| ID | Screen | Problem | Severity | UI-only fix | Status |
|----|--------|---------|----------|-------------|--------|
| L-G1 | Locked board | `enabled=false` silent — taps feel dead | P0 | Overlay status pill via new `waitingHint` prop (`Opponent is thinking…`, reads existing `isBotThinking` only) | DONE |
| L-G2 | TeamTimer inactive | `'--'` cryptic | P1 | Labeled `Waiting` (`text-[11px]`) — same size, no layout shift | DONE |
| L-G3 | MatchTimer warning | Color-only warning | P1 | Add `aria-label` + `title` with time-warning text; visual unchanged | DONE |
| L-G4 | BoardBottomNav inactive | `text-slate-400 hover:text-slate-300` low contrast on light | P3 | `text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300` | DONE |

## Batch 4 — GAME → GAME OVER (`GameOverModal`)
| ID | Screen | Problem | Severity | UI-only fix | Status |
|----|--------|---------|----------|-------------|--------|
| L-O1 | Particles | `Math.random()` per render, no reduced-motion | P1 | Memoized particles + `useReducedMotion` guard | DONE |
| L-O2 | Modal surface | `rounded-[30px]` + hardcoded rgba shadow vs `rounded-2xl shadow-2xl` confirms | P2 | `rounded-2xl shadow-2xl` token alignment | DONE |
| L-O3 | Ad gap | No-fill leaves empty gap, looks broken | P1 | Collapsible wrapper (slot already hides; ensure zero gap via existing `open` prop) | DONE |

## Batch 5 — GAME OVER → REVIEW/HOME (`ReplayView`, `MovePlayback`)
| ID | Screen | Problem | Severity | UI-only fix | Status |
|----|--------|---------|----------|-------------|--------|
| L-R1 | Board max-width | `Game 720px` vs `Replay 600px` — jump entering review | P1 | Intentional per-surface (720/600/560); documented with code comments, no visual change | DONE |
| L-R2 | MovePlayback controls | `←/●/→` text glyphs, no `aria-label` | P3 | `aria-label` Previous/Live/Next; keep glyphs (no icon swap to limit diff) | DONE |
| L-R3 | MovePlayback header | `text-gray-500` low contrast on light | P3 | `text-slate-500 dark:text-gray-400` | DONE |

## Batch 6 — BACK/CLOSE/EXIT
| ID | Screen | Problem | Severity | UI-only fix | Status |
|----|--------|---------|----------|-------------|--------|
| L-B1 | Lobby share copy | `title=` only, no `aria-label` | P3 | Add `aria-label` mirroring title state | DONE |
| L-B2 | Toast clip | `max-w-[min(24rem,...)] right-4` can clip 320px | P2 | Verified: container already clamps to `calc(100vw-2rem)` — no change needed | DONE |

## Explicit non-goals (deferred to later phases)
Premium, AI Coach engine/UI, Auth logic, History redesign — untouched unless blocking lifecycle.
