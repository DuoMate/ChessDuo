# Plan — Play Console R8 + Edge-to-Edge Production Fix

ChessDuo is live on Google Play (release 349 / 1.0.349). Play Console reports two
findings to address:

1. R8 / release obfuscation (2% — below the 25% threshold)
2. Android 15 edge-to-edge / deprecated system-bar APIs

Scope is strictly limited to these two findings. The memory/Stockfish finding is
intentionally out of scope.

## Finding 1 — R8 / Obfuscation

### Root cause
`scripts/build-aab.sh` injected `minifyEnabled true` only when `buildTypes` was
absent from `android/app/build.gradle`. Capacitor's generated project always ships
`buildTypes { release { minifyEnabled false ... } }`, so the injection was skipped
and R8 never ran. `scripts/build-apk.sh` had no minify step at all. Result: ~2%
obfuscation.

### Fix
Force R8 on idempotently against the existing `buildTypes` block in both build
scripts:
- `minifyEnabled false` → `minifyEnabled true`
- add `shrinkResources true`
- switch `proguard-android.txt` → `proguard-android-optimize.txt`

The existing `resources/proguard-rules.pro` (including `-keep class com.getcapacitor.**`)
is left unchanged. The keep rule is redundant with the social-login plugin's own
`consumer-proguard-rules.pro` but is harmless and safest to retain.

## Finding 2 — Android 15 Edge-to-Edge

Two sub-findings share a release.

### 2a. Deprecated APIs
`android.view.Window.setStatusBarColor` / `setNavigationBarColor` / `getStatusBarColor`
originate from `com.google.androidbrowserhelper:androidbrowserhelper:2.5.0`, pulled in
as an `implementation` dependency by `@capgo/capacitor-social-login`.

- The patched `GoogleProvider.java` (the actual Google sign-in path) does NOT use it.
- The only reference is an unused `TwaLauncher` import in the disabled `AppleProvider`.
- Upgrading the plugin does NOT help (latest `8.5.5` still pins `androidbrowserhelper:2.5.0`).

Fix: demote `androidbrowserhelper` to `compileOnly` in the plugin's `build.gradle`
(via both build scripts), keeping it off the release DEX/manifest.

### 2b. Edge-to-edge display
App targets SDK 35+ but `MainActivity` never enables edge-to-edge and Capacitor 8.3.4
does not auto-enable it. Fix: call `EdgeToEdge.enable(this)` in `MainActivity.onCreate`
via `scripts/patch-main-activity.sh`. The web layer already handles
`env(safe-area-inset-*)` via `viewportFit: cover`.

## Files changed
- `scripts/build-aab.sh` — R8 enable + browserhelper demotion
- `scripts/build-apk.sh` — R8 enable + browserhelper demotion
- `scripts/patch-main-activity.sh` — `EdgeToEdge.enable(this)`
- `plan.md`, `implementation-progress.md` — tracking

No `package.json` / dependency change is required.

## Verification
- Signed release AAB must be built and verified (R8 `mapping.txt`, install, launch,
  WebView, plugins, auth, social login, no startup crash, no UI regression).
- Android 15 edge-to-edge visual check (status/nav bars, bottom nav, board, dialogs,
  login screens) for hidden content, double/missing padding.
