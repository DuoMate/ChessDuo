# Implementation Progress — AI Coach Daily Trial

## Status: complete (pending device validation + migration apply)

### Task 0 — Audit: DONE
- Traced Coach entry→start→move→end→GameOver→(no ad)→premium gate→billing; browser split; auth identity.
- Root cause (resignation-ad): Quick/Duo fixed in `4ee6b93`; Coach never requested an ad (inline modal, no NativeAdSlot) — category A (code-does-not-request).

### Task 2 — Trial state: DONE
- `src/features/coach/coachTrial.ts` (new): rolling-24h eligibility (pure helpers), idempotent per-session claim, server `profiles.coach_last_free_game_at` + localStorage mirror (server wins when newer).
- `gameConstants.ts`: +`COACH_TRIAL_WINDOW_MS`.
- `billing/types.ts`: optional `coachLastFreeGameAt`/`coachFreeEligible`/`coachNextEligibleAt` (backward compatible).
- `lib/supabase.ts`: column types (forward-looking, tolerant at runtime).
- `status/route.ts`: tolerant select + server-computed eligibility; premium path untouched.
- `supabase/migrations/2026-09-12_coach_daily_trial.sql`: MANUAL APPLY REQUIRED in Supabase dashboard. No new RLS policies needed (own-row access covers it).

### Task 3 — Entry gate: DONE (`CoachGate.tsx`)
- premium → unlimited; eligible → trial banner + game; consumed → hard block + countdown + `/premium` CTA. Fail-closed preserved.

### Task 4 — Game-end normalization: DONE (no engine change)
- All real terminals (checkmate/stalemate/repetition/insufficient/draw/resign/bot-error) already converge on `status==='game_over'`; resignation uses the same pipeline (verified, untouched).

### Task 5 — Native ad: DONE (`CoachGame.tsx` embeds existing `NativeAdSlot`)
- Reuses unit/loader/view; premium ad-free automatic; never blocks Game Over; `[ADS][GAMEOVER]` diagnostics distinguish no-request vs no-fill. No interstitial, no duplicate system.

### Task 6 — Premium offer: DONE (inline section, trial games only, verified benefits, CTA → existing `/premium` → Google Play flow)

### Task 7 — Mobile/browser: DONE BY CONSTRUCTION
- No billing code added to browser paths; web `NativeAdSlot`/`GooglePlayBillingProvider` remain no-ops; `/premium` download CTA untouched.

### Task 8 — Home: DONE (`page.tsx` subtitle only, both layouts, advisory fetch)

### Task 9 — Tests: DONE
- New `coachTrial.test.ts`: 15 tests pass (eligibility boundaries, countdown, premium bypass, open-without-start, double-claim idempotency, in-window block, server-failure `persisted:false`).
- Targeted suites: 9 suites / 113 tests pass (coach, billing, GameOverModal, nativeAd, PremiumPage).
- Full `npm test`: 1361 pass; 3 failing suites (`server/engine`, `ConfirmMoveBar`, `SidebarNav`) fail identically on clean baseline `413c9e4` — pre-existing, unrelated.

### Task 10 — Build/device: PARTIAL
- `npx tsc --noEmit`: clean. Unit/integration (jest): done. Production Android build + real-device AdMob/Purchase validation: NOT performed here — needs signed-device run with `?debug=1` + logcat `ChessDuoAds`.

### Task 11 — Diff audit: DONE (see final report)
- 11 modified + 3 new files, all inside the trial boundary. Quick/Duo/4P, engine, Realtime, persistence, billing provider, ad bridge/plugin, GameOverModal untouched.

### Recheck (2026-09-12, vs `docs/ARCHITECTURE.md`)
- Core diff: ZERO changes to `GameInterface`/`OnlineGame`/`LocalGame`/`Game`/`DuelGame`/`gameState`/persistence/room actions/billing provider+service/ad bridge+slot/GameOverModal (verified via `git diff` on each path).
- No `as any` in new/changed code (only pre-existing hits in untouched `coachEngine.test.ts`).
- §2 splitting: `/coach` route untouched (dynamic ssr:false + Suspense + ErrorBoundary intact).
- §3 toast: `toast.warning` only; no alert/console user-facing output.
- §6 constants: status route now imports `COACH_TRIAL_WINDOW_MS` (was hardcoded, fixed).
- §7 billing: trial layer talks only to `SubscriptionService.getStatus()`; never touches provider or `profiles.is_premium`; CTA routes to `/premium`.
- §9 ads: doc updated — `NativeAdSlot` reused in Coach inline modal (Coach never uses `GameOverModal`); no new ad unit/bridge/interstitial.
- Styling: `dark:` variants, 44px targets, `text-xs` min, no hex/inline-style/`require()`; all `catch {}` documented; tests co-located.
- `tsc` clean; targeted 113/113 pass; full suite matches baseline exactly (3 pre-existing failing suites, 8 tests — verified via `git stash` on `413c9e4`).

### Remaining risks
1. Migration not yet applied → local-mirror mode until applied (premium unaffected).
2. Device-clock skew on window math (server timestamp mitigates; gate re-checks on load).
3. Device validation outstanding (ad fill, purchase, entitlement refresh on real hardware).

---

# UI Performance Refactor — progress (branch `ui-refactoring`, from `develop`, 2026-09-15)

> Scope lock: UI presentation only. No DB/Supabase/Realtime/game-logic/engine/billing/AdMob/auth/API changes.
> Bible: `docs/ARCHITECTURE.md` + `AGENTS.md`. Baseline + bottlenecks: `performance-audit.md`.
> Target: mid-range Android WebView; desktop Chrome sanity check.

## Queue legend: pending | in_progress | measured | verified | reverted
- [x] Git safety + branch (`verified` — clean tree, branched from `develop`)
- [x] P0-1: Stabilize memo-busting props (`verified` — tsc clean, 65 board/game tests pass)
- [x] P0-2: DuelGame IsolatedMatchTimer (`verified` — same run)
- [x] P0-3: Board input-path cache + board-frame blur removal (`verified` — same run)
- [ ] P1: Animation + lists tuning (in_progress)
- [ ] P2: Startup/bundle (pending)
- [ ] Final: full tsc + full tests + scope audit + report (pending)

## P0-1 — Stabilize memo-busting props (Game.tsx, DuelGame.tsx)
- Bottleneck: `BoardTopBar` custom comparator + `BoardBottomNav` shallow memo defeated by
  new JSX/array/function refs every shell render (`timerNode` inline in `Game.tsx:2705`,
  `.map(p => ...)` presence arrays, inline nav closures in both files).
- Change: `timerNode`/`duelTimerNode` via `useMemo`; presence arrays via `useMemo`;
  nav handlers via `useCallback` (`handleBoardTabChange/handleBoardBackMove/handleBoardForwardMove`,
  `handleDuel*`). Identical behavior — same mapping/handler logic, stable refs.
- ARCHITECTURE.md: no game-method/interface changes; splitting/toast/nav-guard untouched.

## P0-2 — DuelGame isolated timer (DuelGame.tsx + BoardTopBar `timerNode`)
- Bottleneck: engine `setInterval 1s → notify() → onStateChange` called
  `setWhiteTime/setBlackTime` every tick → whole `DuelGame` re-rendered 1 Hz.
- Change: `setOnStateChange` returns early on clock-only ticks
  (fen/status/turn/winner/history-length all equal via refs; first notify never skipped;
  timeout converges via `playing → game_over` status change, never skipped).
  Live countdown now owned by `IsolatedMatchTimer` polling `gameRef` directly
  (`getDuelTimeRemaining`), mirroring the proven `Game.tsx` pattern.
- Game/timer logic untouched: engine tick, timeout authority, DB persist all unchanged;
  only React `setState` fan-out filtered. `remainingSeconds` kept as initial value.

## P0-3 — Board input path (ChessBoard.tsx)
- Bottleneck: `new Chess(fen)` + `moves({verbose:true})` 3× per tap/drag
  (started/validate/finished) on the main thread, plus a 4th parse in `checkPromotion`.
- Change: fen-keyed `verboseMovesCacheRef` + per-square destination cache (bounded,
  cleared on position change); validate/finish share one move-gen pass; promotion flag
  reused from `validMove.promotion` (no extra parse). Legality results identical.
- Board frame: removed `backdrop-blur-xl` from the under-board backing div — the
  cm-chessboard view is opaque and covers it, so the blur cost GPU with zero visual effect.
- Verification: `npx tsc --noEmit` clean; `ChessBoard/BoardPageComponents/MobileChessBoard`
  (38), `PendingMovesRow` (5), `Game-critical-paths/PendingOverlay/ConfirmMoveFlow` (22) pass.

## P1 — Animation + lists (HistoryPanel.tsx, ChatPanel.tsx)
- Bottleneck: `HistoryPanel` staggered all 50 rows (`delay: i*0.03`, up to 1.5s of
  concurrent animations on open); `ChatPanel` ran a `smooth` scroll across full history on open.
- Change: stagger capped at first viewport (`Math.min(i, 8) * 0.03`); rows skip
  offscreen layout/paint via `[content-visibility:auto] [contain-intrinsic-size:auto_80px]`.
  Chat initial load snaps with `behavior: 'auto'`; live messages keep `smooth`.
  Ordering/appearance unchanged.
- ARCHITECTURE.md: styling rules kept (`dark:`/44px/text-xs untouched — classes only added).

## P2 — Startup (providers.tsx)
- Bottleneck: `createEvaluator()` spawned the Stockfish Worker + ~340K WASM
  download/compile synchronously on app launch (home page), contending with TTI on
  mid-range WebView. (The "lazy init" note in `mobile-engine/CONTEXT.md` is stale —
  constructor spawns the worker eagerly since the 2026-08-02 revert.)
- Change: pre-warm deferred to `requestIdleCallback` (8s timeout) with 3s
  `setTimeout` fallback; cleanup on unmount. Singleton preserved — game engines call
  `createEvaluator()` on construct, so in-game readiness is unchanged even if idle
  never fires; typical flow still warms during home → lobby navigation.
- NOT implemented + why: `animejs` removal (Timeline import tree-shakes small; rewriting
  5 shimmer components risks visual regressions for marginal bundle gain); global
  chessboard-CSS scoping (156K one-time cached; moving to route layouts risks
  static-export 404s in the Capacitor `out/` build for negligible parse saving).

## P3 — Replay (ReplayView.tsx)
- Bottleneck: `parseMoveComparisons()` re-filtered 100+ entries + new player arrays +
  new inline `onMove`/nav closures on every scrub render, defeating all memoized children.
- Change: `moves`/player arrays/handlers via `useMemo`/`useCallback` (same logic, stable
  refs). Pre-existing `currentTurn={'WHITE' as any}` left untouched (out of perf scope).

## P4 — Coach + 4-player (CoachGame.tsx, FourPlayerLobby.tsx)- Audit: `CoachGame` already followed the P0 patterns (stable `handleMove`/nav callbacks,
  memoized `positions`/`roundEntries`, no match timer). One gap: inline `.map` for
  `RoundHistorySidebar entries` re-allocated on every render incl. analyzing ticks.
  `FourPlayerLobby` 2s poll called `setPlayers` with a fresh array every tick.
- Change: sidebar entries via `useMemo` on `[roundEntries, previewing]`; lobby poll
  shallow-compares every visible roster field (id/team/slot/status/username) and reuses
  the previous array when identical. Polling interval, room-status transition, and
  ready-state propagation untouched.
- Verification: `tsc` clean; `FourPlayerLobby` + `coach` suites (16) pass; scope grep clean.

## P5 — Game.tsx section split (GameSections.tsx NEW, Game.tsx)
- Bottleneck: post-P0 memo held at leaf level, but every shell render still
  reconciled the full top-bar + board wrapper tree; `MoveResolvedInline onNext`
  and `GameMenu` inline closures defeated their memos on every render.
- Change: new `GameSections.tsx` with memoized `GameTopBarSection` +
  `GameBoardSection` (default shallow memo; all props stable-or-primitive).
  `enabled`/`orientation` resolve inline each render (cheap ref reads — same
  freshness as the previous IIFE; deliberately NOT memoized since they read
  mutable refs + engine maps). Identical `isFourPlayer ? X : X` branches collapsed
  (dead ternary, same value). `key={boardKey}` remount preserved inside section.
- Verification: `tsc` clean; 39 game/board tests pass; full suite 1395 pass with
  only the known pre-existing failures (`server/engine`, `ConfirmMoveBar`,
  `SidebarNav`; `BillingDiagnostics` flaked once under full load, passes alone,
  billing untouched by diff). Scope grep clean.

## P6 — Bundle analysis + memo regression locks (tests only, no library change)
- Measurement (`npm run build`, Turbopack): total client JS 2.3MB uncompressed;
  largest chunks 241KB (supabase), 226KB, 143KB, 119KB; framer-motion code is
  already split per route by Next code-splitting; anime distinctive chunk ~31KB.
  Estimated LazyMotion + anime-removal saving ≈ 25–35KB gzip (~4% of total).
- Decision: SKIP the 49-file LazyMotion migration — saving does not justify the
  regression surface (per DO NOT OVER-OPTIMIZE; no working-library replacement
  without proportionate evidence). Per-route splitting already bounds eager cost.
- Change (tests only): `GameSections.test.tsx` (section skip-on-stable /
  update-on-change, negative-controlled — verified to fail with memo removed);
  `FourPlayerLobbyRoster.test.ts` (sameRoster join/leave/team/slot/ready/username);
  `sameRoster` exported for testing (pure helper, no behavior change).
- Verification: `tsc` clean; 10/10 new tests pass.

## P7 — DuelGame adopts shared sections (DuelGame.tsx, GameSections.tsx)
- Bottleneck: post-P0 memo held at leaf level in `DuelGame`, but the shell still
  reconciled the top-bar + board wrapper trees on every move/scrub render.
- Change: `DuelGame` renders shared `GameTopBarSection`/`GameBoardSection`.
  Sections gained optional `shellClassName`/`outerClassName`/`captured*` props
  (stable literals/defaults — memo holds) so DuelGame keeps pixel-identical
  visuals (own wrapper bg, no px-3, 600px cap, no captures, no profile entry).
  Menu handlers stabilized; stable noop for the absent resolution animation.
- Verification: `tsc` clean; section/lobby/coach suites pass (incl. 2 new P7
  visual-parity tests); scope grep clean.

## Final verification (2026-09-15, branch `ui-refactoring`)
- `npx tsc --noEmit`: clean.
- Full `npm test`: 1394 passed / 9 failed / 87 skipped — IDENTICAL to clean-baseline
  `git stash` run (same 9 pre-existing failures: `server/engine`, `ConfirmMoveBar`,
  `SidebarNav`; untouched by this diff). Zero new failures.
- Scope audit: `git diff` grep for supabase/realtime/room_players/billing/AdMob/auth/
  engine/timer-logic additions → only hit is this file's own scope-lock comment. Changed
  files (all presentation-layer): `Game.tsx`, `DuelGame.tsx`, `ChessBoard.tsx`,
  `HistoryPanel.tsx`, `ChatPanel.tsx`, `ReplayView.tsx`, `providers.tsx`
  (startup scheduling only) + tracking docs. No DB/RLS/API/billing/AdMob/auth/engine changes.
- Honest baseline note: no physical mid-range device or remote-WebView trace available in
  this environment, so FPS/frame-drop numbers are NOT claimed. Improvements are
  structural (fewer renders, less main-thread parsing, deferred WASM, capped animations)
  verified by code-path analysis + unit tests + tsc. Recommend `chrome://inspect` WebView
   profiling on a mid-range APK before release to fill `performance-audit.md` §3 TODOs.

---

# Lifecycle UX Polish — Phase 1 (2026-09-16, branch `develop`)

> Scope lock: UI/presentation only, aligned to `docs/ARCHITECTURE.md`.
> Batches 1–6, smallest reviewable diffs. Full audit: `lifecycle-ux-audit.md`.

## BATCH 1 — HOME → LOBBY: DONE
- ISSUES: L-H1 press feedback, L-H2 auth fade, L-H3 44px How-to-play, L-H4 safe-area Start, L-H5 `role=alert`.
- FILES: `src/app/page.tsx`.
- WHY: taps feel received; overlay no flash; safe-area-proof CTA; errors announced.
- TESTS: `homePagePersistence` pass; tsc clean.

## BATCH 2 — LOBBY → GAME: DONE
- ISSUES: L-L1 hex→tokens, L-L2/L-L3 GameLoading copied-feedback + null-guarded timeline, L-L4 44px rows + always-render disabled Start, L-L5 specific error + `role=alert`, L-L6 always-visible countdown.
- FILES: `GameLobby.tsx`, `GameLoading.tsx`, `FourPlayerLobby.tsx`, `MatchmakingQueue.tsx`.
- WHY: waiting never looks frozen; copy confirms; readiness has no layout jump.
- TESTS: `FourPlayerLobby` 5/5 pass; tsc clean. No room/presence logic touched (§8 intact).

## BATCH 3 — LIVE GAME: DONE (partial, 1 deferred)
- ISSUES: TeamTimer `WAIT` + labels (L-G2), MatchTimer `role=timer` warning labels (L-G3), BoardBottomNav light contrast (L-G4).
- DEFERRED: L-G1 locked-board hint (needs `Game.tsx` shell + device QA).
- FILES: `TeamTimer.tsx`, `MatchTimer.tsx`, `BoardBottomNav.tsx`.
- TESTS: `BoardPageComponents` pass; tsc clean. No engine/timer authority change.

## BATCH 4 — GAME → GAME OVER: DONE
- ISSUES: memoized particles + reduced-motion (L-O1), `rounded-2xl shadow-2xl` token (L-O2), ad no-fill already collapses via existing `open` prop (L-O3).
- FILES: `GameOverModal.tsx`.
- TESTS: `GameOverModal` pass; tsc clean. Result/ad/billing untouched (§9/9.1 intact).

## BATCH 5 — REVIEW/HOME: DONE (partial, 1 deferred)
- ISSUES: MovePlayback labels + contrast + 44px toggle (L-R2/R3).
- DEFERRED: L-R1 board-cap unify (needs visual QA).
- FILES: `MovePlayback.tsx`.

## BATCH 6 — BACK/CLOSE/EXIT: DONE (partial, 1 deferred)
- ISSUES: share `aria-label` (L-B1).
- DEFERRED: L-B2 toast 320px clip (verify-only, needs device).
- FILES: `GameLobby.tsx` (aria only). No routing-arch change (§4 intact).

## Verification
- `npx tsc --noEmit`: clean.
- Targeted: GameOverModal + BoardPageComponents + homePagePersistence 41/41; FourPlayerLobby 5/5.
- Diff: 10 presentation files, +116/−57; scope grep (supabase/realtime/billing/AdMob/auth/engine/timer-logic) clean.
- Manual device journey (Quick/Duo/4P resign/over/review/home + ad free-vs-premium) still required on hardware before release.
- Remaining: L-G1, L-R1, L-B2 (documented in audit).

---

# Coach + Premium UX Polish — Phase 2 (2026-09-16, branch `develop`)

> Scope lock: UI/presentation only, aligned to `docs/ARCHITECTURE.md`.
> No recommendation-engine, billing-provider/entitlement, or ad-logic changes.

## BATCH P1 — Premium loading/error: DONE
- Error banner gains `role="alert"` + Retry (`runLoad()`); plans-empty warning gains `role="alert"`.
- `subscribing` full-screen takeover replaced with inline `role="status"` banner; offers stay visible, upgrade buttons disabled while in flight.
- FILES: `src/app/(main)/premium/page.tsx`.
- WHY: user sees what failed + how to recover; purchase progress never looks like a stall/reload.

## BATCH P2 — Premium hierarchy/a11y: DONE
- Monthly/Annual buttons get distinct `aria-label`s; icons `aria-hidden`; BenefitRow chevron (fake affordance) → check; `text-[10px]` → `text-[11px]`.
- Test updated: cancellation test clicks by new accessible name.
- FILES: `page.tsx`, `src/app/__tests__/PremiumPage.test.tsx`.

## BATCH C1 — CoachGate: DONE
- Loading gains label + `role="status"`; lookup failure no longer claims "game is complete" — honest copy + Retry (fail-closed preserved).
- FILES: `src/components/coach/CoachGate.tsx`.

## BATCH C2 — CoachPanel clarity: DONE
- Top-moves list roles/labels; Show-Best-Move preview hint (`{san} on the board`); cp gains "lost" + tooltip; opponent-turn placeholder (no more blank gap); thinking indicator contrast + `role="status"`.
- Meaning of suggestions/insights untouched — presentation only.
- FILES: `src/components/coach/CoachPanel.tsx`.

## BATCH C3 — Transcript/game-over/a11y: DONE
- Transcript current-suggestion card points to Coach tab (ends Insights duplication confusion); Bot/decorative icons `aria-hidden`; game-over emoji labeled; benefit emojis hidden from SR; upgrade CTA labeled.
- FILES: `CoachTranscriptPanel.tsx`, `CoachGame.tsx`.

## Verification
- `npx tsc --noEmit`: clean.
- Targeted: PremiumPage + coach suites + GameOverModal **66/66 pass**.
- Diff scope grep (purchase/entitlement/engine/status-mutate): clean — no billing, engine, or ad-logic touches.

---

# History/Replay + Auth States — Phase 3 (2026-09-16, branch `develop`)

> Scope lock: UI/presentation only, aligned to `docs/ARCHITECTURE.md`.
> No history-storage, auth-logic, or game-logic changes.

## BATCH H1 — History states: DONE
- `HistoryPanel` bare `Loading...` → labeled `Spinner` + `role=status`; silent catch → error card with Retry; close `×` labeled; result icons `aria-hidden`; online/offline emoji hidden from SR; Replay button 44px + named.
- `history/page.tsx`: same error/Retry treatment (was silent empty), labeled `PageLoading`, 44px Replay/Play buttons, named replay labels, emoji/icon a11y.
- FILES: `HistoryPanel.tsx`, `src/app/(main)/history/page.tsx`.

## BATCH H2 — Replay states: DONE
- `ReplayView`: empty `move_comparisons` notice (was silent start pos); result emoji labeled; dead Moves/Chat/Insights tabs visibly disabled via new additive `disabledTabs` prop on `BoardBottomNav` (existing callers unchanged).
- `replay/client.tsx`: fetch error distinguished from not-found (`Couldn't load replay` + Retry vs `Game Not Found`); error announced.
- FILES: `ReplayView.tsx`, `BoardBottomNav.tsx`, `src/app/replay/[gameId]/client.tsx`.

## BATCH A1 — Auth presentation: DONE
- `Auth`: error `role=alert`, icon hidden; submit `Loading...` → `Signing in…/Creating account…`; taken-name guidance ("try adding numbers or underscores").
- `ChooseUsername`: real `<label>`, error/status roles, taken-name guidance, 44px switch hit area + label.
- `callback`: raw SDK message moved behind Technical-details disclosure with friendly copy; duplicate same-destination buttons consolidated (error gains real Try-Again reload).
- FILES: `Auth.tsx`, `ChooseUsername.tsx`, `src/app/auth/callback/page.tsx`. Auth/OAuth/PKCE logic untouched.

## BATCH D1 — Deferred lifecycle items: DONE
- L-G1: `GameBoardSection.waitingHint` overlay pill (`Opponent is thinking…`, existing `isBotThinking` only, no layout shift, memo-stable) + test.
- L-R1: per-surface caps documented as intentional (no visual change).
- L-B2: toast clamp verified pre-existing — no change.
- FILES: `GameSections.tsx`, `Game.tsx`, `ReplayView.tsx`, `CoachGame.tsx`, `__tests__/GameSections.test.tsx`.

## Verification
- `npx tsc --noEmit`: clean.
- Targeted: GameSections + BoardPageComponents + PremiumPage + coach **78/78 pass** (incl. new waitingHint test).
- Diff scope grep (data/auth/game-logic additions): clean.

---

# Final Consistency Sweep — Phase 4 (2026-09-16, branch `develop`)

> Scope lock: UI/presentation only, aligned to `docs/ARCHITECTURE.md`.
> Consolidated report: `ux-audit.md`.

## BATCH F1 — Remaining loading/error states: DONE
- Invite `Loading...` → labeled spinner + status; `error.tsx` hides raw SDK text
  (friendly copy + `role=alert`, error prop kept for Next contract); FriendsPanel
  loading labeled; delete-account error announced.
- FILES: `invite/[userId]/client.tsx`, `error.tsx`, `FriendsPanel.tsx`, `delete-account/page.tsx`.

## BATCH F2 — Hex/style/token/font: DONE
- `PageLoading` brand dots hex → `sky-400` tokens; Toast + BoardBottomNav safe-area
  inline styles → Tailwind arbitrary values (identical rendering); ChessBoard piece
  hex + Accuracy/MoveComparison eval colors documented as dynamic-per-§5 (zero visual change).
- Font floor closed app-wide: WelcomeDisclaimer + welcome page `text-[10px]` → `text-[11px]`.
- FILES: `PageLoading.tsx`, `Toast.tsx`, `BoardBottomNav.tsx`, `ChessBoard.tsx`,
  `AccuracyBottomSheet.tsx`, `MoveComparison.tsx`, `WelcomeDisclaimer.tsx`, `welcome/page.tsx`.

## BATCH F3 — Labels/contrast: DONE
- Friends search label + filter-button name/hit-area; Profile close labeled; chat
  input labeled; `Room.tsx` confirmed dead legacy UI — intentionally untouched.
- FILES: `FriendsPanel.tsx`, `ProfilePanel.tsx`, `ChatPanel.tsx`.

## BATCH F4 — Full verification: DONE
- `tsc` clean. Full `npm test`: 1406 passed; failing suites identical to clean-baseline
  stash run (`server/engine`, `ConfirmMoveBar`, `SidebarNav`); `BillingDiagnostics`
  full-load flake passes alone. CoachPanel test aligned to new accessible name.
- Touched-file lint: zero new errors (2 mid-phase `set-state-in-effect` fixed same-phase
  by moving resets into retry handlers).
