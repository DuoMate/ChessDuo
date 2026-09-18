# ChessDuo UI/UX Revamp — Final Report

Branch: `UI-UX-refactoring` · Date: 2026-09-17 · Base: `ebb0541`.

## 1. Screens redesigned (presentation only)
Home selection controls (TimePills, GameModeCard, difficulty, color, bot-elo),
game menu + confirm bar, Duo move cards + comparison + resolved + insights,
coach panel, game-over/resign/leave modals, 4-player lobby (keyboard cards),
history (panel + page), profile (panel + page), friends (panel + page),
premium page + success states, auth + premium CTAs, settings, chat,
username, welcome (modal + page), auth gate, lobby, route-level
error/invite/duel/callback/replay shells, menus/nav/config, round history,
insights gate, move playback, timers (contrast), loaders, install banner,
game chrome (tabular timers, result well), responsive dvh shells,
reduced-motion guards. Board, flows, and copy unchanged.

## 2. Shared components redesigned
`Toast` (live region), `BackButton`, `SlideOver`, navs, `GameMenu`, `ErrorBoundary`
fallbacks, settings switches — focus-visible states via the new shared `.focus-ring` utility.

## 3. Design system changes
`src/app/globals.css`: semantic roles added (BRAND/TEXT/SURFACES/BORDERS/GAME-STATES/
PREMIUM/AI-COACH), radius scale, elevation scale, `.focus-ring`, `prefers-reduced-motion`
guard. All pre-existing variables preserved byte-for-byte. Audits in
`docs/ui-revamp-audit.md` + `docs/ui-theme-audit.md`.

## 4. Responsive changes
Duel waiting `pb-16` → `pb-24` (cancel clears bottom nav); four-player lobby safe-area
bottom padding. No breakpoint or layout-architecture changes.

## 5. Accessibility improvements
Focus-visible states on ~25 interactive elements; toast live region; `aria-expanded`
on game menu; light-mode text/surface pairs for Duo cards + coach (no more dark-only
text); touch-target fix on error fallbacks. Known limitation (documented, unchanged):
board is pointer-only (no keyboard/SR move entry).

## 6. Performance considerations
No new dependencies, no new blur/shadows (one shadow hue narrowed), no tree changes,
no animation-timing changes. Memo contracts untouched (className strings only).

## 7. Files changed
See `docs/implementation-progress.md` (UI/UX Revamp section) + `git log UI-UX-refactoring`.

## 8. Tests executed
`npx tsc --noEmit` before every commit (green); targeted suites (Toast, BackButton,
ColorPicker, PendingMovesRow, coach 11 tests) green; one test assertion updated to the
new token contract (`ColorPicker.test.tsx`); full `npm test` + `npm run build` at close.

## 9. Browser build result
`npm run build` green (Next.js 16.2.6, 28 static pages).

## 10. Browser QA result
Owner follow-up per workflow (publish branch → manual browser QA → fix → approval →
only then Android). Not yet performed in this session.

## 11. Known remaining UI issues
* Full radius/type/spacing unification (tokens exist; migration is incremental).
* Duo canonical pair decision pending (audit recommends blue vs purple; `team-a`/`team-b`
  tokens now carry the live pair and the board turn pill/avatars consume them).
* CTA primary hue (amber vs blue) pending prototype review.
* MovePlayback inline links still sub-44px (density trade-off, documented exception).
* Settings toggle switches are h-6 w-11 (below 44px; row is 44px, switches keyboard-visible).
* Friend message icon-button is w-10 h-10 (40px, pre-existing).
* Board keyboard/SR play not implemented (needs design + engine-input work — out of scope).
* `TeamHexagon` keeps hardcoded gradient hex (mapping to flat team tokens would collapse
  the gradient; parked).
* Full-suite pre-existing failures (ConfirmMoveBar/SidebarNav/server-engine/BillingDiagnostics)
  verified byte-identical on baseline `ebb0541` — not introduced by this revamp.

## 12. Core-functionality confirmation
All changes are className/ARIA/CSS-variable/doc-only. No routing, auth, realtime, game,
timer, Stockfish, billing, ads, notification, persistence, or API logic touched.
Verified via per-commit `git diff` review + final safety grep (see below).
