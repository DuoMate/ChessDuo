# Android Production Crash Regression — NativeAdPlugin.buildAdView NPE

**Status**: FIXED · **Fix branch**: `develop` (ADS-05 crash hotfix) · **Date**: 2026-09-21

## Incident

- **Version**: 1.0.391 (versionCode 391)
- **Device**: Samsung Galaxy S24 Ultra
- **OS**: Android 16 / SDK 36
- **Exception**: `java.lang.NullPointerException`

```
java.lang.NullPointerException:
    at com.navron.chessduo.NativeAdPlugin.buildAdView(NativeAdPlugin.java:194)
    at com.navron.chessduo.NativeAdPlugin.lambda$showAd$2(NativeAdPlugin.java:98)
    at android.os.Handler.handleCallback(...)
```

## ROOT CAUSE

**Null object**: the `NativeAd` passed into `buildAdView(NativeAd ad)` (the `loadedAd` field).

**Line 194 expression** (the released v391 build layout, `4ee6b93`/`424e7e2`, 225-line file held on `prod` at
sha `d862fd…`):

```java
headline.setText(ad.getHeadline());   // line 194 — ad (NativeAd) is null
```

**Line 98 expression** (the `lambda$showAd$2` frame = `show()`'s `runOnUiThread` runnable):

```java
NativeAdView adView = buildAdView(loadedAd);   // line 98 — reads mutable field at runnable execution time
```

## WHY IT HAPPENED

`show()` performs a **synchronous** null check on `loadedAd` at method entry, then posts a
`getActivity().runOnUiThread(...)` runnable that **re-reads the mutable field** `loadedAd` at
execution time. Between the check and the runnable running, `loadedAd` can be cleared:

1. **Overlapping `show()` calls** (primary): `NativeAdSlot` fires `showNativeAd()` without awaiting
   from several sources — `frame` + `retryFrame` requestAnimationFrames, and the
   resize/scroll `schedule` handler. Two native `show()` calls can both pass the entry check
   (field still set), queue runnables R1 and R2; R1 renders and sets `loadedAd = null`; R2 reads the
   now-null field → `buildAdView(null)` → NPE at line 194.
2. **Concurrent `preload()` / `discardLoadedAd()`**: a fresh load destroys the cached ad while the
   queued show runnable is still pending.
3. **`handleOnDestroy()`**: Activity/WebView teardown between scheduling and execution clears
   `loadedAd` before the delayed Handler callback fires.

This is a classic stale-field race, not a per-Galaxy or per-Android-16 defect.

## WHY VERSION 391

The released v391 binary (`auto-bump` commit `424e7e2`) carried the `4ee6b93`-era
`NativeAdPlugin.java`, which is byte-identical to the file on `prod` HEAD. The multi-firing JS
enabler shipped in the same era: `4ee6b93` "AdMob changes" (2026-09-11) introduced the
multi-render `NativeAdSlot` (`frame` + `retryFrame` + scroll/resize re-shows), expanded by
`387cbca` / `d1a5346`. The race is timing-dependent and merely surfaced on this device/OS.

**Android 16 is incidental, not causal** — no API-specific behaviour is involved. The fix is
correct for all supported Android versions.

## FIX (ADS-05 crash hotfix)

`android-patches/NativeAdPlugin.java` only — no product behaviour change:

1. **`show()` runnable**: snapshot `loadedAd` into a local `NativeAd ad` at the top of the
   runnable and abort gracefully (`call.reject("Native AdMob ad is not ready")`) if it is null.
   The JS layer already handles reject → refill/retry, and the Game Over popup stays usable.
2. **`buildAdView(NativeAd ad)`**: `if (ad == null) return null;` at the top — a direct guard at
   the proven NPE site; the caller rejects the render attempt when it returns null.

No blanket try/catch. No redesign of the ad system. No impression/preload optimization.

## TEST

Reproduction matrix (manual, per the incident):
- Start game → Game Over → NativeAdSlot shows ad.
- Immediately navigate/back, background/foreground, repeat Game Over.
- Rapidly open/close Game Over.
- Destroy/recreate Activity; toggle ad load delay/no-fill; cached ad destroyed before display.
- Modes: Quick Play, Duo, 4 Player, AI Coach, 1v1, resign, timeout, checkmate.
- Regression: startup, login, Home, game, Game Over, native ad, Premium, Upgrade, billing,
  navigation, background/foreground.

Automated: `npx tsc --noEmit` clean; `npm test` no new failures (no JS changed).

## RELEASE BUILD

Run `bash scripts/build-aab.sh` (R8 minification enabled; play-services rules keep
`SourceFile,LineNumberTable` so the release mapping is verifiable). Note: release build requires
`android/` (via `scripts/setup-capacitor.sh`), `ANDROID_HOME`, and `chessduo.keystore` — not
available in this dev container; execute in the release/CI environment.

## Files changed

- `android-patches/NativeAdPlugin.java`
- `docs/android-production-regression-36h.md` (this file)
- `docs/implementation-progress.md`
- `src/lib/CONTEXT.md`

*Last Updated: 2026-09-21 — ADS-05 Android production crash regression (NativeAdPlugin.buildAdView NPE, Android 16 / v391).*