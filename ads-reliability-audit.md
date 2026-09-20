# Ads Reliability Audit — AdMob Native Game-Over Ad (ADS-01)

> Branch: `perf/db-network-optimization` (ADS-0X stack). Scope: diagnostics + lifecycle reliability.
> Non-goals (locked): no popup redesign, no new formats/placements/IDs, no interstitial/banner/rewarded,
> no fake impressions, premium stays fully ad-free, no game/auth/billing/routing changes.

## 1. Current architecture (verified read-only)

```
Game/Duel/CoachGame (status PLAYING)
  │  useGameOverAdPreload(active) ──► preloadNativeAd()   [warmup during play]
  ▼
GameOverModal / Coach inline terminal / premium upgrade screen
  │  <NativeAdSlot open ready-gated>
  │    on open ──► preloadNativeAd()                      [slot-level fill]
  │    on ready ──► showNativeAd(bounds) (rAF + retries)  [position + render]
  │    on close ──► hideNativeAd()
  ▼
nativeAd.ts bridge (single-flight, 1h TTL, consume-on-show, never throws)
  ▼
NativeAdPlugin.java (MobileAds init-once, AdLoader, same-ID reuse, destroy on hide/replace)
```

- SDK: `play-services-ads:24.5.0` (`scripts/install-native-ad.sh:26`).
- IDs: `NEXT_PUBLIC_ADMOB_NATIVE_ID` (native), `NEXT_PUBLIC_ADMOB_APP_ID` (manifest). Interstitial ID unused by design.
- Premium gating: slot + warmup hook + AdSense loader (all via `usePremium()`); upgrade screen adds `!isPremium` to `open`.
- Diagnostics today: `[ADS][GAMEOVER|UPGRADE]` (?debug=1-gated) + logcat `[ADS][GAMEOVER]` with error codes.

## 2. Lifecycle map (with request IDs from ADS-01)

```
AD_REQUEST_STARTED (id) → AD_LOAD_SUCCESS → AD_READY → AD_ATTACHED → AD_VISIBLE
  → AD_IMPRESSION → AD_CONSUMED → NEXT_AD_PRELOAD_STARTED → NEXT_AD_READY
AD_REQUEST_STARTED (id) → AD_LOAD_FAILED (code/domain/message) → bounded backoff
```

## 3. Failure points (ranked hypotheses — prove with device runs, do not assume)

| # | Failure point | Evidence location | Status |
|---|---|---|---|
| F1 | Show-failure consumes cache, `ready` stays true → blank placeholder, retries re-show empty | `nativeAd.ts:74-77`, `NativeAdSlot.tsx:65-126` | FIX ADS-02: re-preload on show failure |
| F2 | Single attempt per game-start + per slot-open; transient fail = blank game-over | `useGameOverAdPreload.ts:31`, `NativeAdSlot.tsx:41` | FIX ADS-02: bounded retry/backoff (never loop from `onAdFailedToLoad`) |
| F3 | JS loses error detail (`errorCode: null` always) — bug vs no-fill indistinguishable | `NativeAdSlot.tsx:35,89` | FIX ADS-01: plumb `{code,message}` to logs |
| F4 | Java same-ID reuse ignores 1h TTL — stale-serve risk past JS expiry | `NativeAdPlugin.java:49-53` vs `nativeAd.ts:26` | FIX ADS-02: Java-side expiry |
| F5 | Upgrade surface cold start (no warmup hook; slot-open load only) | `premium/page.tsx:405` | ACCEPTED (same-screen decision): shared fixes only, no new warmup placement |
| F6 | No premium check inside bridge (caller-gated only) | `nativeAd.ts:32-34` | ACCEPTED: all callers gated; harden only if a new caller appears |
| F7 | Abandoned preload never explicitly destroyed (lobby leave w/o game-over) | Java holds until overwrite/destroy | FIX ADS-03: destroy-on-abandon + consume→preload-next |

## 4. Suspected causes of "empty ad area, repeatedly"

- If per-game preload fails (no-fill/transient) AND slot-open retry fails → blank, every game. Root cause is F1+F2 combined with genuine load failures (F3 hides which).
- If show fails once (zero bounds mid-animation) → cache consumed, stuck blank (F1) even with a good fill.
- Genuine AdMob no-fill/inventory remains possible per user/device — must be recorded accurately (F3), not treated as bug.

## 5. Proposed fix (ADS-02/03 + ADS-02a content rating)

ADS-02a (implemented): max ad content rating T enforced in code —
`NativeAdPlugin.MAX_AD_CONTENT_RATING` (`MAX_AD_CONTENT_RATING_T`) applied via
`MobileAds.setRequestConfiguration()` in `initializeSdk()` before init + before any
request. Console setting (also T) retained as defense-in-depth. No unit/format/ID/
premium/preload behavior change. Device verification: Ad Inspector must show max
rating T on requests; ads serve normally otherwise.
1. Structured errors through the bridge (`getLastAdError()` + request IDs, ADS-01).
2. Bounded retry/backoff + show-failure re-preload (ADS-02).
3. Java 1h expiry + destroy-on-abandon (ADS-02/03).
4. Consume → immediate next-preload; MAX_READY=1; premium-upgrade clears cache (ADS-03).
5. Coverage audit of all terminals × modes (ADS-04).

## 6. Metrics (device runs)

Funnel per eligible game-over: REQUEST → LOAD (ok/fail+code) → READY → ATTACHED → VISIBLE → IMPRESSION → CONSUMED → NEXT_READY. Target: raise eligible→impression rate via availability, never via refresh/click tricks.
