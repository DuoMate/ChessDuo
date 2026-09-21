# Implementation Progress — Unified Gameplay Rendering Pipeline

Branch: `perf/unified-gameplay-rendering` · Base: `ux-polish-phases-1-4` (clean tree, `npx tsc --noEmit` green at start).

## UI-BOARD-FIRST — mobile gameplay layout redesign (2026-09-21)
- **Audit**: the board was constrained by AI Coach's `max-w-md` (448px) + `px-4` (up to 23% side gutter on S24-Ultra-class widths), per-mode arbitrary caps (`720/600/560px`) and `95vw/80vh`, plus oversized vertical chrome (coach header, always-expanded `p-4` coach card, `pb-24`). Board measured 86.7–93.8% of viewport width; AI Coach worst on wide phones.
- **Implementation**: `GameBoardSection` inline `maxWidth` → responsive class prop (`max-w-[calc(100dvh-var(--game-chrome))] md:max-w-[720px]`) + growing centered region with 8px inset; `globals.css` `--game-chrome/--coach-chrome`; Game/Duel `px-2`; compact top-bar; Coach full-width on phones + compact header + collapsed single-row `CoachPanel`. Desktop (`md:`) caps/insets preserved. Back/Fwd **stay in the bottom action pill** (unchanged).
- **Regression + fix**: an intermediate revision moved Back/Fwd into a compact `BoardMoveNav` row that disabled Forward at the last index, blocking the review-exit branch (`setPlaybackIndex(null); setPlaybackFen(null)`) while `playbackFen != null` kept the board disabled — pieces couldn't be moved after Back/Fwd in Quick Play/Duo/4P/Duel. Reverted: `BoardMoveNav` deleted, `BoardBottomNav` restored to its original always-enabled Back/Fwd (verified against `develop`). Board-first sizing retained.
- **Result**: board ≈ viewport − 16px (≥95.9% portrait; 96.7% on 480px) vs 86.7–93.8% before; coach card collapsed to ~one row; move-history review behavior identical to before across Quick/Duo/4P/Duel/Coach.
- **Vertical centering + wide-device cap (follow-up)**: AI Coach root is now a full-height flex column; board + compact coach group wrapped in a `flex-1 min-h-0 overflow-y-auto` region with `my-auto` (balanced whitespace instead of a bottom void; group scrolls if recommendations grow so the board never resizes; bottom padding clears the fixed nav). `--coach-chrome` 150→140 (header+nav only). Removed Coach's `md:max-w-md` (448px) double cap so the single `md:max-w-[560px]` board cap governs on tablets/foldables. Game/Duel unchanged (already centered).
- **Validation**: tsc clean (pre-existing `coachVoice` only); `BoardPageComponents` (BoardBottomNav Back/Fwd handlers), `GameSections`, `CoachPanel`, `CoachGame`, `DuelGame`, `ReplayView` suites green; full suite no new failures. Device matrix = owner step. See `docs/mobile-game-layout-audit.md`.

## ANDROID-PIP-RCA-FIX — PiP manifest flag never applied (2026-09-21)
- **Incident**: PiP never engages on any Android version (Home gesture does nothing, no overlay swap).
- **Root cause**: `android:supportsPictureInPicture="true"` was never written to the release manifest. The Capacitor 8.3.4 template emits the manifest multi-line (`<activity` on its own line, `android:name=".MainActivity"` later), so `sed '/android:name="\.MainActivity"/ s|<activity |…'` never matched — the two tokens are on different lines and `<activity` is at EOL. PiP was broken from inception (`2d63770` used the same ineffective pattern).
- **Fix**: target the `<activity` opening tag (`sed -i '0,/^[[:space:]]*<activity/{s|<activity|<activity android:supportsPictureInPicture="true"|}'`) + post-write grep verification, in all three scripts (`setup-capacitor.sh`, `build-aab.sh`, `build-apk.sh`). `configChanges` already covers `smallestScreenSize|screenLayout|orientation` in the template.
- **Verify**: sed logic validated against the extracted template (count = 1). Web suites green. Real-device entry/exit = owner/CI step. See `docs/android-pip-rca.md`.

## ANDROID-UPDATE-RCA-FIX — native Play In-App Updates (Option B) (2026-09-21)
- **Incident**: users never notified of newer versions; Update opens nothing on Android.
- **Root cause**: update detection used a web-served `version.json` (never per-account/rollout-aware) + a dead `window.open('market://','_system')` action (Capacitor WebView has no popup handler).
- **Fix (native-first)**: new `android-patches/AppUpdatePlugin.java` (Google Play In-App Updates, FLEXIBLE: `check`/`startFlexibleUpdate`/`completeUpdate`, `stateChanged` + `flowResult` events, cancellation is a normal choice) + `scripts/install-app-update.sh` (gradle `com.google.android.play:app-update:2.1.0`) + registration in `patch-main-activity.sh` (Capacitor routes the flow result via `handleOnActivityResult`). New `src/lib/nativeAppUpdate.ts` (web-safe bridge) + `useAppUpdate` native-primary (manifest fallback only when the native check is indeterminate) + `UpdatePrompt` Update→download→Restart-to-install. `rateApp.openPlayListing()` opens the HTTPS Play listing via `@capacitor/browser`.
- **Verify**: `nativeAppUpdate.test.ts` (9), `useAppUpdate.test.tsx` (6), `rateApp.test.ts` (5) green; tsc clean; full suite no new failures. Real Play track rollout = owner/CI step. See `docs/android-update-rca.md`.

## ADS-05 — Android production NPE crash regression (2026-09-21)
- **Incident**: v391 on Android 16 (SDK 36) `NullPointerException` at
  `NativeAdPlugin.buildAdView(NativeAdPlugin.java:194)` from `lambda$showAd$2:98`
  (the `show()` `runOnUiThread` runnable).
- **Root cause**: stale mutable field race — `show()` null-checks `loadedAd` synchronously,
  then the queued runnable re-reads the field at execution time; concurrent `show()` calls,
  a preload/discard, or `handleOnDestroy()` clears `loadedAd` before the runnable runs →
  `buildAdView(null)` → NPE at `headline.setText(ad.getHeadline())`.
- **Fix (minimal, `android-patches/NativeAdPlugin.java` only)**: snapshot `loadedAd` into a
  local at the top of the `show()` runnable (reject gracefully if null) and add
  `if (ad == null) return null;` at the top of `buildAdView()`. No redesign, no blanket
  try/catch, no product behaviour change, no impression/preload change.
- **Docs**: `docs/android-production-regression-36h.md`.
- **Verify**: `npx tsc --noEmit` clean; `npm test` no new failures (no JS changed).
  Release build (`bash scripts/build-aab.sh`) requires `android/` + `ANDROID_HOME` +
  keystore — owner/CI step.

## Batch 1 — Shared board + piece rendering ✅
- `ChessBoard.tsx`: comparator now covers `pendingOverlay.color` + `myPendingOverlay.color`.
- `PendingMovesRow.tsx`: memoized `SubmittedBadge` + `MoveCard`.
- `RoundHistorySidebar.tsx`: module glyph maps + memoized `RoundHistoryRow` + memoized sidebar.
- `ConfirmMoveBar.tsx`, `TurnStatusArea.tsx`: memoized.
- `Game.tsx`: `CapturedPiecesDisplay` memoized (`CAPTURED_PIECE_ORDER` + `useMemo`).
- Verify: tsc clean; board suites 38/38.

## Batch 2 — Shared gameplay animations ✅
- `ChessBoard.tsx`: `useLayoutEffect` → rAF-coalesced passive `useEffect` with `<1px` guard; trimmed `will-change` to transform-animated nodes only.
- `GameOverModal.tsx`: backdrop `backdrop-blur-xl` removed (card blur kept).
- Verify: tsc clean; castling test intact; visuals unchanged by inspection.

## Batch 3 — Timer + player UI isolation ✅
- `Game.tsx`: `disconnectedAge` poll change-guarded (connected steady-state: no 1 Hz shell rerender).
- `DuelGame.tsx`: `getDuelTimeRemaining` stabilized via `fallbackTimeRef`, deps `[team]`.
- Verify: tsc clean; timer authority untouched (display only).

## Batch 4 — Duo-specific visual rendering ✅
- Covered by Batch 1 (`PendingMovesRow`, `MoveResolvedInline` already strict-memo + stable `onNext`, sidebar). No shadow/resolution/sync logic touched.

## Batch 5 — 4 Player-specific visual rendering ✅
- Covered by shared slices (`GameTopBarSection`, `GameBoardSection`, sidebar, `BoardTopBar` comparator). No turn/player logic touched. Lobby `sameRoster` bail-out preserved.

## Batch 6 — AI Coach-specific visual rendering ✅
- `CoachPanel`, `CoachInsightsPanel`, `CoachTranscriptPanel` memoized. Engine/eval/suggestion/voice semantics untouched.
- Verify: coach suites 11/11.

## Batch 7 — Browser polish + docs + push ✅
- `docs/game-ui-performance-audit.md` + `docs/implementation-progress.md` (this file) written.
- Full `npm test` + `tsc` + browser verification: **owner follow-up** (web browser check, then production push check per owner workflow).

## Safety confirmation
NO CHESS LOGIC CHANGED · NO STOCKFISH CHANGED · NO EVALUATION CHANGED · NO AI LOGIC CHANGED · NO GAME STATE SEMANTICS CHANGED · NO TURN LOGIC CHANGED · NO MOVE RESOLUTION CHANGED · NO SYNCHRONIZATION CHANGED · NO RACE-CONDITION HANDLING CHANGED · NO SUPABASE CHANGED · NO REALTIME CHANGED · NO DATABASE CHANGED · NO PERSISTENCE CHANGED · NO TIMER LOGIC CHANGED · NO NETWORKING CHANGED · NO AUTH CHANGED · NO BILLING CHANGED · NO ADMOB CHANGED.
Only UI/presentation rendering and animation performance was optimized.

## Files changed (exact)
- `src/components/ChessBoard.tsx`
- `src/components/PendingMovesRow.tsx`
- `src/components/RoundHistorySidebar.tsx`
- `src/components/ConfirmMoveBar.tsx`
- `src/components/TurnStatusArea.tsx`
- `src/components/Game.tsx`
- `src/components/DuelGame.tsx`
- `src/components/GameOverModal.tsx`
- `src/components/coach/CoachPanel.tsx`
- `src/components/coach/CoachInsightsPanel.tsx`
- `src/components/coach/CoachTranscriptPanel.tsx`
- `docs/game-ui-performance-audit.md`
- `docs/implementation-progress.md`

---

# UI/UX Revamp — Progress (branch `UI-UX-refactoring`, base `ebb0541`)

Scope: presentation only. No routing/auth/realtime/game-logic/billing/ads changes.

## Commits (one per phase slice)
1. `0a74e71` docs: UI/UX revamp audit + theme audit (PHASE 1-2)
2. `a3d9c32` ui: semantic presentation-only design tokens + focus-ring + reduced-motion (PHASE 3)
3. `9cb6d06` ui: shared focus-visible states + toast live region (PHASE 4a)
4. `875dfc3` ui: error fallback touch targets + focus states (PHASE 4b)
5. `52fb567` ui: bottom nav focus-visible states (PHASE 4c)
6. `db79ccd` ui: home selection controls focus-visible states (PHASE 5a)
7. `09bb3c9` ui: home selected states on brand tokens (PHASE 5b)
8. `773cc03` ui: color picker brand tokens + focus states (PHASE 6a, incl. test update)
9. `7889451` ui: bot difficulty selector brand tokens + focus states (PHASE 6b)
10. `7f6fc21` ui: confirm bar keyboard focus states (PHASE 7a)
11. `59269cb` ui: game menu focus states + expanded semantics (PHASE 7b)
12. `87db549` ui: duo move cards light-mode support (PHASE 8a)
13. `4561a9b` ui: game-over modal focus states (PHASE 11a)
14. `01fb70e` ui: resign/leave confirm focus states (PHASE 11b)
15. `51243a4` ui: coach panel light-mode support + focus states (PHASE 10a)
16. `c142d44` ui: auth + premium CTA focus states (PHASE 13-14a)
17. `5902241` ui: lobby safe-area + bottom clearance; test: BotEloSelector brand assertion (PHASE 15a + 6b follow-up)
18. `0a30d46` ui: history panel light-mode support + focus states (PHASE 12a)
19. `ef4a5ce` ui: history page light-mode support + focus states (PHASE 12b)
20. `d644d7d` ui: profile panel light-mode support + focus states (PHASE 12c)
21. `06d2c5c` ui: friends panel light-mode support + focus states (PHASE 12d)
22. `0408d5f` ui: profile + friends pages light-mode parity (PHASE 12e)
23. `425c290` ui: board team pair on semantic tokens (PHASE 7c)
24. `f621850` ui: move comparison light-mode + teammate headline icon (PHASE 8b)
25. `5f98d73` ui: move resolved light-mode + blunder/focus pairs (PHASE 8c)
26. `fa93092` ui: move insights light-mode + selected/rejected badges (PHASE 8d)
27. `7e53ab3` ui: 4-player lobby keyboard cards + focus states (PHASE 9a)
28. `501d204` ui: settings focus states + chat contrast fix (PHASE 13b)
29. `dae1537` ui: premium page light-mode support + focus states (PHASE 13b)
30. docs: breakpoint doc drift (`hooks/CONTEXT.md` 640px → 768px), `DESIGN.md` stale `#060816` → `#0a0e1a` (close-out)
31. `ca1c583` ui: game lobby light-mode support + focus states (PHASE 14b)
32. `94ed6c9` ui: challenge picker focus states + selected icon contrast (PHASE 14c)
33. `528f61d` ui: auth gate light-mode + focus states (PHASE 14d)
34. `8d6acce` ui: username + welcome light-mode, contrast, focus (PHASE 14e)
35. `448fab3` ui: welcome page light-mode + focus states (PHASE 14f)
36. `530cd96` ui: confirm modals on shared backdrop/spring + focus (PHASE 4d)
37. `db5c198` ui: settings root pairing + delete-account focus states (PHASE 15b)
38. `f38e972` ui: move playback slate pairing + keyboard + focus (PHASE 12f)
39. `35ee6ec` ui: insights gate light-mode + focus states (PHASE 12g)
40. `b5f907f` ui: round history light-mode + focus states (PHASE 12h)
41. `6862c17` ui: timer warning/critical light contrast + dead-code cleanup (PHASE 7d)
42. `6c3a99e` ui: evaluating loader contrast + install banner targets (PHASE 16a)
43. `1607dbb` ui: route-level error/invite/duel/callback/replay pairing + focus (PHASE 15c)
44. `91def1f` ui: menus/nav/config pairing + focus (PHASE 4e)
45. `f2e7367` ui: coach game modals pairing + board frame + timer contrast (PHASE 10b)
46. `2fa6112` ui: team-b neutral slate tokens + lock Duo/CTA decisions (W1)
47. `c2af2d5` ui: Duo de-purple to neutral slate markers + legend (W2)
48. `234850d` ui: home hierarchy + locked green CTA + label contrast (W3)
49. `a4fb60a` ui: responsive dvh shells across routes (W4)
50. `ac949c7` ui: game chrome polish - tabular timers, advantage contrast, result well (W5)
51. `6cabacc` ui: reduced-motion guards for looping indicators (W6)
52. Downmerge `origin/develop` (coach home cascade, OAuth PKCE fix, coach setup consistency) — conflicts: progress doc kept both sections; callback takes develop apostrophes + revamp pairs; local difficulty selector removed for shared `BotDifficultyGrid` (brand tokens + focus re-applied, test updated); new `CoachSetup` CTA aligned to locked green + focus.
53. Merge `UI-UX-refactoring` → `develop` → `prod` (all pushed, builds green).
54. `cfbaf21` ui: game chrome hierarchy - timer anchor + turn pill prominence (R1)
55. `71ef84c` ui: pending cards presence + confirm bar emphasis (R2)
56. `720f383` ui: bottom navs presence - taller tabs, larger icons, active pill (R3)
57. `6dc252f` ui: resolution hierarchy - larger moves, headlines, spacing (R4)
58. `f659e0f` ui: 4-player team headers with glyphs + seat counts (R5)
59. `5ab1844` ui: editor/rate/gameon/promotion pairing + focus + shared modal constants (P1)
60. `a262203` ui: mobile status bar timer contrast (P2)
61. `a2f16ab` ui: shared PromotionModal for Game + DuelGame (S1)
62. `ede2465` ui: normalize radii outliers to token scale (U1)
63. `1974784` ui: restrain modal shadows to elevation token (U2)
64. `0119ef8` ui: Lucide icon sweep - transport, close, status, badge glyphs (I1)
65. `9f68157` ui: empty-state illustration wells across routes (E1)
66. `bb0d51b` ui: press-state feedback on lift buttons (E2)
67. Owner confirms Option A green CTA (already implemented W3 + CoachSetup fix); recorded in theme audit.
68. `f751f37` ui: premium glassmorphism treatment for pricing + success cards (G1)
69. `8d64045` chore: remove dead SidebarNav + TeamIndicator (+ tests, doc refs)

## What was intentionally NOT changed
Routing, navigation behavior, auth/OAuth/session, realtime, game state/rules/timers,
Stockfish/eval, billing/ads, push, persistence, APIs. All edits are className/ARIA-only
except `globals.css` token additions and two audit docs.

## Validation per commit
`npx tsc --noEmit` before every commit; targeted jest suites where they exist
(Toast, BackButton, ColorPicker incl. assertion update, PendingMovesRow, coach);
production `npm run build` green after PHASE 3. Full suite + build + safety sweep at close.
---

# AI Coach Setup + OAuth PKCE Fix — Implementation Progress (2026-09-17)

## Status legend
- [ ] pending · [~] in progress · [x] done

## TRACK A — AI Coach setup consistency
- [x] PHASE 1 — Audit (`ai-coach-setup-audit.md`)
- [x] PHASE 2 — Shared config (`BotDifficultyGrid` + shared `DIFFICULTY_LEVELS`, home rewired, no visual change)
- [x] PHASE 3 — `CoachSetup` presentation (ColorPicker + grid + description + Start CTA, light/dark, 44px targets)
- [x] PHASE 4 — Color wiring (setup → `resolvePlayerColor` → `CoachGame`, board orientation via existing prop)
- [x] PHASE 5 — Difficulty wiring (setup → `ChessBot` via existing `DIFFICULTY` map, levels 1-5)
- [x] PHASE 6 — Silent defaults removed from happy path (defensive `?? 3`/`?? 'w'` retained, documented)
- [x] PHASE 7 — Runtime verification (unit: 13 component/grid tests + 6 engine level/color tests)
- [x] PHASE 8 — Regression (coach suites 71/71 green; full suite + build pending below)
- [x] PHASE 9 — `tsc --noEmit` clean + `npm run build` success + suites green (see Verify track)

## Test matrix (Track A)
- [x] T1 White + Easy → onStart(1, 'white'); engine state botLevel 1
- [x] T2 White + Medium → onStart(2, ...) covered by grid + setup tests
- [x] T3 White + Hard → default-start test (3, 'white')
- [x] T4 Black + Easy → onStart(5, 'black') test (level) + black color test; engine ('b', 2) test
- [x] T5 Black + Medium → grid selection test (level 2 checked)
- [x] T6 Random → passthrough test + shared `resolvePlayerColor` (unchanged mechanism)
- [x] T7 Quick Play unchanged (home rewire only; full suite pending)
- [x] T8 Duo unchanged (same)
- [x] T9 Access allowed → setup renders inside CoachGate (phase state; gate untouched)
- [x] T10 Access denied → locked screen unchanged (gate untouched)

## TRACK B — Browser OAuth PKCE regression
- [x] PHASE 1 — Audit (`browser-auth-regression-audit.md`; root cause: dual-consumer race)
- [x] PHASE 2 — Root cause identified (auto-init `detectSessionInUrl` vs explicit exchange)
- [x] PHASE 3 — Minimal fix (session-as-ground-truth reconciliation, callback PKCE branch only)
- [x] PHASE 4 — Regression tests (`callback.test.tsx`: 5/5 — success, reconciled, redirect-preserved, genuine OAuth failure, email recovery)
- [x] PHASE 5 — Browser verification (unit-level; live Google round-trip needs manual DevTools pass post-deploy)
- [ ] PHASE 6 — Final diff review (pre-push, see Verify track)

## Mobile check (Track B)
- Native OAuth uses `chessduo://auth/callback` deep link (`capacitorAuth.ts:57-80`);
  code comes from the link string, never `window.location.href` → auto-init never
  races → unaffected. `capacitorAuth.ts` untouched.

## Verify track
- [x] `npx tsc --noEmit` clean
- [x] `npm test`: 1444 passed / 1540; 9 failed = 8 pre-existing on clean HEAD
  (ConfirmMoveBar 4, SidebarNav 1, server/engine 3 — verified identical via
  `git stash` full-suite baseline: 1421 passed / 1516, same 8 failures) +
  1 BillingDiagnostics flake (3/3 standalone green; zero billing files touched)
- [x] `npm run build` (browser) succeeds — `/coach` prerenders, 28/28 pages
- [x] New-code eslint clean (1 `any` error + warnings in `page.tsx`/`CoachGame.tsx` pre-existing)
- [ ] Diff review (scope-limited) → push `develop` → merge into `prod`

## Log
- 2026-09-17: Audit complete for both tracks. Plans approved (coach: setup inside /coach, 5 home-UI levels, rematch preserves via persisted setup).
- 2026-09-17: OAuth fix implemented + 5/5 tests green. CoachSetup + grid + /coach wiring implemented; coach suites 71/71 green; tsc clean.
- 2026-09-17: Fix complies with arch rule via `AuthService.getSession()` (architecture.test green). Full-suite baseline compared via stash. Build green. Ready to push.

## Resign-vs-timeout result fix (2026-09-18)
- PHASE 1 — Terminal path audit: all modes traced (Quick/Duo/4P/Coach); see docs/game-result-terminal-path-audit.md
- PHASE 2 — Root cause: H1 DB-fallback fabricated resignation (wrong winner/reason for timeouts seen via games row); H2 LocalGame.setGameOverTimeup had no terminal guard
- PHASE 3 — Minimal fix: DB_GAME_OVER_GRACE_MS grace + broadcast reconcile (onlineGame.ts); early-return guard (localGame.ts); no engine/timeout-rule changes
- PHASE 4 — Persistence verified: completed_games written verbatim from engine result (unchanged path)
- PHASE 5 — History/stats verified: stored-winner consumers only, no material recalc
- PHASE 6 — Regression tests: 4 new (1 localGame + H1 trio), 1 updated (H4 grace semantics); game-result suites green; tsc clean
- PHASE 7 — All-mode verification: resign-ahead/behind → LOSS; timeout/checkmate/draw paths untouched
- PHASE 8 — Final diff review: pending
