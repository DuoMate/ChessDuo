# Implementation Progress — Play Console R8 + Edge-to-Edge

## Status: implemented (build/device verification deferred to CI)

## Audit
- [x] Confirmed `build-aab.sh` R8 injection is skipped (Capacitor always ships `buildTypes`).
- [x] Confirmed `build-apk.sh` has no minify step.
- [x] Confirmed deprecated APIs come from `androidbrowserhelper:2.5.0` via
      `@capgo/capacitor-social-login` (unused `TwaLauncher` import in disabled AppleProvider).
- [x] Confirmed `@capgo/capacitor-social-login@8.5.5` (latest) still pins `androidbrowserhelper:2.5.0`
      → plugin upgrade is not a fix.
- [x] Confirmed Capacitor 8.3.4 does not auto-enable edge-to-edge; `androidx.activity:1.11.0`
      (provides `EdgeToEdge.enable`) is available.

## Implementation
- [x] `scripts/build-aab.sh` — enable R8 (`minifyEnabled true`, `shrinkResources true`,
      `proguard-android-optimize.txt`) idempotently.
- [x] `scripts/build-apk.sh` — same R8 enable.
- [x] `scripts/build-aab.sh` — demote `androidbrowserhelper` to `compileOnly`.
- [x] `scripts/build-apk.sh` — demote `androidbrowserhelper` to `compileOnly`.
- [x] `scripts/patch-main-activity.sh` — add `EdgeToEdge.enable(this)` in `onCreate`;
      idempotency guard updated to the new `EdgeToEdge.enable` marker.
- [x] `bash -n` syntax check passed on all three scripts.
- [x] Sed patterns verified against sample Capacitor `build.gradle` and the real plugin
      `build.gradle` (idempotent, only the `implementation` line changed).

## Build & verification
- [ ] Typecheck (`npx tsc --noEmit`) — bash-only change; expected no impact.
- [ ] Lint — bash-only change; expected no impact.
- [ ] Tests (`npm test`) — bash-only change; expected no impact.
- [ ] Release APK build.
- [ ] Release AAB build.
- [ ] R8 executed (check `mapping.txt`).
- [ ] Install + launch + plugin init + auth + social login + UI regression.
- [ ] Android 15 edge-to-edge visual verification.

Note: this environment has no Android SDK or `chessduo.keystore` (CI secret), so the
signed release artifact build and device verification are deferred to CI
(`build-release.yml` on push to `prod`).
