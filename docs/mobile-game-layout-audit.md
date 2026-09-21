# Mobile Game Layout Audit — BOARD FIRST

> Branch: `ui/mobile-board-first` · Date: 2026-09-21 · Scope: mobile gameplay UI/layout only.
> No engine/Stockfish/timer/resign/ads/Supabase changes.

## 1. Root cause — why the board felt small

1. **AI Coach arbitrary width cap.** `CoachGame` wrapped the header and board in
   `max-w-md` (448px) with `px-4` insets. On denser/wider viewports (S24 Ultra
   class reports ~450–480 CSS px) that cap binds hard → up to **23% dead side
   gutter** — the reported "excessive margins".
2. **Arbitrary per-mode caps + `95vw`/`80vh`.** `min(95vw, 80vh, 720px)` (Game),
   `600px` (Duel), `560px` (Coach) constrained the board even when width was the
   limiting axis, and `80vh` made landscape boards tiny.
3. **Oversized/inconsistent horizontal insets** (`px-4` coach = 16px, `px-3`
   others = 12px) vs. an 8px target.
4. **Vertical chrome.** Coach header `pt-[max(1rem,…)]`, an always-expanded
   `p-4` "Coach recommends" card (~110–140px), and the `pb-24` nav clearance
   pushed the board down and made it feel secondary.

## 2. Constraints / invariants
Board stays square, centered, touch-friendly, pixel-sharp; cm-chessboard
interaction, coordinates, highlights, AI-coach overlays, drag/tap, animations
unchanged. Engine/timers/resign/game-over/ads/Supabase/Realtime untouched.

## 3. Before → after (portrait, board width vs viewport)

| Surface | Before (390px) | Before (480px) | After (390px) | After (480px) |
|---|---|---|---|---|
| Quick/Duo/4P | 366px (93.8%) | 456px (95%) | **374px (95.9%)** | **464px (96.7%)** |
| Duel | 366px (93.8%) | 456px (95%) | 374px (95.9%) | 464px (96.7%) |
| AI Coach | 358px (91.8%) | **416px (86.7%)** | 374px (95.9%) | **464px (96.7%)** |

Board width = `min(parent width, 100dvh − var(--*-chrome))`; portrait is
width-bound (only the 8px inset remains), landscape/short viewports are
height-bound so the board stays square and scroll-free.

## 4. Layout changes

- **`GameSections.GameBoardSection`**: inline `style={{ maxWidth }}` →
  responsive class prop `boardMaxClassName` (default
  `max-w-[calc(100dvh-var(--game-chrome,0px))] md:max-w-[720px]`); outer region
  default `flex flex-1 min-h-0 items-center justify-center px-2`.
- **`globals.css`**: added `--game-chrome: 200px` / `--coach-chrome: 150px`
  vertical-chrome reserves (single documented source).
- **`Game.tsx` / `DuelGame.tsx`**: inner shell `px-3`→`px-2`, `flex-1 min-h-0`;
  board passes through the shared responsive region; Duel keeps its desktop
  600px cap via `boardMaxClassName`. **Back/Fwd stay in the existing bottom
  action pill** (unchanged location/handlers) so move-history review behaves
  exactly as before across every mode.
- **`BoardBottomNav`**: unchanged contract (Moves / Chat / Insights / Back /
  Fwd). (An earlier revision of this branch moved Back/Fwd into a new compact
  `BoardMoveNav` row under the board; that control disabled Forward at the last
  index, which blocked the review-exit branch in `handleBoardForwardMove`
  (`setPlaybackIndex(null); setPlaybackFen(null)`) while `playbackFen != null`
  kept `isBoardEnabled=false` — i.e. pieces could not be moved after Back/Fwd.
  The relocation was reverted and Back/Fwd restored to the pill.)
- **`GameSections` top-bar shell**: `px-3 py-2` → `px-2 py-1.5`.
- **`CoachGame.tsx`**: container/header `max-w-md` on phones → full width,
  `px-4`→`px-2`, header `pt-[max(1rem,…)]`→`pt-[max(0.5rem,…)]`, board cap
  `min(95vw,80vh,560px)` → `calc(100dvh-var(--coach-chrome))` / `md:560px`.
  Desktop (`md:`) keeps the previous caps.
- **`CoachPanel.tsx`**: "Coach recommends" defaults to a **single compact row**
  (`✨ Coach recommends` + `Show 3 Best Moves`), expanding to the existing top-3
  cards + legend on tap; `p-4`→`p-3`. Top-3/UCI/eval/voice/highlights untouched.

## 5. Responsive behavior
- **Portrait phone**: board ≈ viewport − 16px, square, dominant.
- **Landscape**: board height-bound by `100dvh − chrome` (smaller, no scroll),
  controls remain accessible.
- **Tablet/desktop (`md:`)**: historical caps preserved (Game 720 / Duel 600 /
  Coach 560) and 12px+ insets — web layout unchanged.
- **Resign**: unchanged single top-right flag control → existing confirmation ≥
  game-over ≥ ads ≥ navigation.

## 6. Devices / checks
`npx tsc --noEmit` (only pre-existing `coachVoice` module error); `npm test`
(changed suites + full suite: no new failures); eslint 0 errors.
Device matrix (owner): small Android (~360), 6.1–6.5" (~390–412), S24 Ultra
(~411–480), gesture + 3-button, light/dark — verify board ≥ ~96% portrait
width, square, no h/v scroll, taps/drag/highlights/coach overlays, Moves/Chat/
Insights, Back/Fwd, Resign + confirm, Game Over + ads, PiP, Duo sync, and
web/desktop pixel parity.

## 7. Remaining limitations
- On very small (≲360×640) devices the transient in-flow "move resolved" card can
  push content past one screen; the shell uses `min-h-dvh` (scrolls only then)
  rather than clipping. Normal portrait gameplay does not scroll.
- Real-device screenshots/before-after capture is an owner/device step.
- Duel's board `enabled` does not gate on `playbackFen` (pre-existing, unchanged)
  — review-exit still works via the restored bottom-pill Forward button.

*Last Updated: 2026-09-21 — BOARD FIRST mobile layout redesign; Back/Fwd review-exit regression fixed by restoring the bottom-pill controls.*
