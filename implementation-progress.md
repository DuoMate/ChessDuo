# Implementation Progress — Play Console R8 + Edge-to-Edge

## Premium Production Enablement Audit — 2026-09-11

### Status: NOT READY — source flow repaired; release verification blocked

### Audit

- [x] Traced the UI -> provider -> verify route -> profile -> status flow.
- [x] Confirmed browser remains on the download-on-Google-Play path.
- [x] Confirmed native package ID is `com.navron.chessduo`.
- [x] Confirmed product IDs in code are `premium_monthly` and `premium_yearly`.
- [x] Confirmed status reads server-side profile state and checks expiry.
- [x] Confirmed no complete purchase token is logged by the changed code.
- [ ] Confirm exact Play Console product/base-plan/pricing configuration.
- [ ] Confirm service-account and production secret deployment.
- [ ] Establish Google Play account -> ChessDuo account binding and token ownership.

### Fixes

- [x] Removed the hardcoded native Coming Soon gate; retained the existing browser mobile-download UX.
- [x] Verify successful native purchases before returning success.
- [x] Verify restored native transactions before reporting restore success.
- [x] Use the native plugin's Android subscription `planIdentifier`.
- [x] Add `@capgo/native-purchases` to production dependencies.
- [x] Allowlist supported product IDs in the verification route.
- [x] Correct the browser Play Store URL package ID.
- [x] No database migration applied.

### Tests and release evidence

- [x] Focused billing and Premium tests: `59 passed`.
- [ ] Full Jest suite result recorded.
- [ ] Typecheck: blocked by pre-existing missing `@capacitor-community/text-to-speech` module.
- [ ] Lint of changed files using the repository ESLint 9 flat-config command.
- [ ] Signed APK/AAB build.
- [ ] Google Play purchase, cancellation, pending, verification failure, restore, restart, account switch, and AdMob suppression on a real Android device.

### Release decision

Premium was **not approved for production release**. The source purchase path is enabled for validation, but the artifact must remain unreleased until the listed security, Play Console, and device-test blockers are resolved.

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

## AI Coach UI/UX Redesign

### Task 0 — Audit
**Status:** complete
**Files inspected:** `src/app/coach/page.tsx`, `src/components/coach/CoachGame.tsx`,
`CoachPanel.tsx`, `CoachGate.tsx`, `src/components/ChessBoard.tsx`, Coach feature
types/analysis, route and component contexts.
**Findings:** Coach components are presentation and interaction wiring; evaluator,
Stockfish, voice, persistence, and game state are isolated under `src/features/coach`.
The shared board already accepts `highlightSquares` and renders the existing green
best-move-style overlay.
**Changes:** none to runtime during audit.
**Verification:** read-only audit completed; initial git status preserved.

### Task 1 — Data contract
**Status:** complete
**Files inspected:** `coachGame.ts`, `coachAnalysis.ts`, `CoachGame.tsx`, `CoachPanel.tsx`.
**Findings:** Current-position best move is `suggestion.topMoves[0].uci`; feedback
best move is SAN and may refer to a prior position, so it is not used for the live
board highlight.
**Changes:** documented the UI mapping in `plan.md`.
**Verification:** no evaluator or API contract changes.

### Task 4 — Show/Hide Best Move presentation
**Status:** complete
**Files changed:** `src/components/coach/CoachGame.tsx`,
`src/components/coach/CoachPanel.tsx`, and focused `CoachPanel.test.tsx`.
**Findings:** A local `showBestMove` flag is sufficient; no preview board or move
execution is needed.
**Changes:** added hidden-by-default Show/Hide action for the current suggestion,
mapped its UCI squares to the existing `ChessBoard.highlightSquares` prop, and reset
visibility whenever the live FEN changes.
**Verification:** focused Jest test passed (2 tests); type diagnostics and ESLint
passed for all changed Coach files; core/backend diff check was empty.

### Scope confirmation
Evaluator, Stockfish, engine configuration, backend, API, database, game state,
move history, and new evaluation calls were not changed.
