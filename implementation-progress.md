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
