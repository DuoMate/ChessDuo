# AI Coach Daily Trial — Plan

## 1. Discovered architecture
- AI Coach is isolated: `coachGame.ts` (chess.js + ChessBot + CoachEngine) + `CoachGame.tsx` + `CoachPanel` + `CoachGate` (binary premium, fail-closed) + `coach_games` table. Does NOT use `GameInterface`/`OnlineGame`/`LocalGame`/`Game.tsx`/`GameOverModal`.
- Premium truth: Supabase `profiles` via `GET /api/subscription/status` (expiry-checked) + `POST /api/subscription/verify` (Google androidpublisher, server acknowledge + `profiles` upsert). IDs `premium_monthly`/`premium_yearly`. Web = Download CTA only.
- Ads (`ARCHITECTURE.md` §9): `nativeAd.ts` bridge (single-flight, consume-on-render, web/no-ID no-op) + `NativeAdSlot` (only inside `GameOverModal`) + `NativeAdPlugin.java`. Coach modal has NO ad call (category A: code-does-not-request).
- Real Coach terminals only: checkmate, stalemate, threefold, insufficient, draw, resignation, bot-error abort. No clocks/timeout, bot never resigns, no Realtime, persistence is fire-and-forget `coach_games` insert.

## 2. Decisions (user-locked)
- Cadence: 1 free game per rolling 24h window (not lifetime).
- Persistence: Supabase `profiles.coach_last_free_game_at TIMESTAMPTZ NULL` (server timestamp, survives reinstall) + localStorage mirror fallback. Migration file created, must be applied in Supabase dashboard — NOT auto-applied here.
- Block: hard block second game inside window → upsell with `Next free in Xh Ym` + existing `/premium` CTA.
- Ad: reuse existing `NativeAdSlot` inside Coach Game Over only.
- Benefits copy: verified-only (Unlimited AI Coach, voice coaching, best-move guidance, ad-free).

## 3. Claim semantics
- Consumed at `CoachGame.start()` (`idle→playing`) exactly once per mount session (ref guard + in-memory session set + storage check).
- Open/screen/back-out/auth-overlay never claim. Abandon (Back/nav-guard/Leave) stays non-terminal, no ad/offer.
- All real terminals converge on existing inline Game Over → NativeAdSlot → premium offer (non-premium trial game only). Premium: no offer, ad auto-suppressed.

## 4. Files to change
1. `supabase/migrations/2026-09-12_coach_daily_trial.sql` (NEW, needs manual apply)
2. `src/features/shared/gameConstants.ts` (+ `COACH_TRIAL_WINDOW_MS`)
3. `src/features/billing/types.ts` (+ optional trial fields)
4. `src/lib/supabase.ts` (+ column types)
5. `src/app/api/subscription/status/route.ts` (tolerant select + eligibility)
6. `src/features/coach/coachTrial.ts` (NEW isolated module)
7. `src/features/coach/index.ts` (re-export)
8. `src/components/coach/CoachGate.tsx` (daily gate)
9. `src/components/coach/CoachGame.tsx` (claim + ad + offer)
10. `src/app/coach/page.tsx` (pass-through, unchanged logic)
11. `src/app/page.tsx` (subtitle copy only, 2 spots)
12. `src/features/coach/__tests__/coachTrial.test.ts` (NEW tests)

## 5. Protected (untouched)
`GameInterface.ts`, `onlineGame.ts`, `localGame.ts`, `Game.tsx`, `DuelGame.tsx`, `duelGame.ts`, `gameState.ts`, chess engine, timers, Realtime, `roomActions`/`fourPlayerActions`/`gamePersistence`/`matchHistory`, `GooglePlayBillingProvider`, `verify` logic, `nativeAd.ts`, `NativeAdPlugin.java`, `GameOverModal.tsx`, browser premium CTA, auth, Quick/Duo/4P.

## 6. Test plan
- `npx tsc --noEmit`, `npm test` (no new failures).
- New: eligibility boundaries (null/23h59/24h01), next-eligible countdown, double-claim idempotency, open-without-start, resign/checkmate/draw all reach same Game Over pipeline, ad-fail intact, premium bypass, browser no-billing.

## 7. Risks
- Migration not yet applied → code runs in local-mirror mode until applied (documented in-app? no — documented here + progress file).
- Device-clock skew for window math (server timestamp mitigates; full server-authoritative check on next gate load).
- Offline claim → optimistic local + best-effort server sync, `persisted:false` surfaced, retry on game over.

## 8. Rollback
Revert gate/modal/trial module; Coach returns to binary premium gate. Shared systems untouched so nothing else to unwind.
