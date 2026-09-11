# Plan — Play Console R8 + Edge-to-Edge Production Fix

## Premium Production Enablement Audit — 2026-09-11

### Existing architecture

- `PremiumPage` calls `SubscriptionService`; browser users use the existing download-on-Google-Play CTA.
- Android uses `GooglePlayBillingProvider` and `@capgo/native-purchases` for `premium_monthly` and `premium_yearly` subscriptions.
- `/api/subscription/verify` verifies the token with Google Play, acknowledges active purchases, and writes the authenticated user's `profiles` row.
- `/api/subscription/status` is the authoritative client read; expiry is checked server-side before `isPremium` is returned.

### Audit findings and fixes

- Fixed the hardcoded Coming Soon branch that made Android purchase controls unreachable.
- Fixed the purchase flow so a native result is sent to `/api/subscription/verify` and is rejected unless verification succeeds.
- Fixed restore handling to return and verify native transactions from the plugin instead of always returning an empty list.
- Added the Android subscription `planIdentifier` required by the native plugin.
- Added server-side product allowlisting for the two configured product IDs.
- Added the missing `@capgo/native-purchases` production dependency.
- Corrected the browser Play Store URL to package `com.navron.chessduo`.

### Validation and blockers

- Focused billing/Premium tests pass: 59 tests.
- Typecheck is blocked by the pre-existing missing `@capacitor-community/text-to-speech` module in `src/features/coach/coachVoice.ts`.
- No generated Android project or signed APK/AAB is present in this workspace, so Google Play purchase, restore, AdMob suppression, and device lifecycle testing were not performed.
- Play Console product/base-plan/pricing state and production service-account configuration cannot be verified from the repository.
- Purchase tokens are verified by Google but the current schema/API has no server-side Google-account-to-ChessDuo-account binding or token ownership constraint. This remains a production security blocker; no migration was applied.

### Decision

Premium source flow is repaired, but production release enablement is **NOT READY** until the account-linking design is established, Play Console configuration is confirmed, and a signed Android build passes the end-to-end test matrix.

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

## AI Coach UI/UX Redesign

### Current architecture and UI boundary
`src/app/coach/page.tsx` routes through `CoachGate` into the dynamically loaded
`CoachGame` presentation shell. `CoachGame` subscribes to the existing
`CoachGameState`, renders the shared `ChessBoard`, and passes suggestion/feedback
data to `CoachPanel`. Evaluator logic remains isolated in `src/features/coach`.

### Frozen boundaries
The Coach evaluator, Stockfish worker, engine settings, analysis types, voice
service, persistence, API/database paths, and game state remain unchanged. UI
changes may only map existing state into presentation props and local visibility
state.

### Data contract used by the UI
- Current best move: `suggestion.topMoves[0].uci`
- Current recommendation list: `suggestion.topMoves`
- Coach message and classification: `feedback.explanation` and `feedback.verdict`
- Voice content/state: existing `coachVoice` service and `feedback.explanation`
- Live board position: existing `state.fen`, `state.lastMove`, and shared `ChessBoard`

### Task breakdown
1. Audit components, routes, board annotations, evaluator boundary, and premium gate.
2. Freeze and document the presentation data mapping.
3. Build the primary Coach message hierarchy.
4. Add UI-only best-move visibility using the existing green board highlight.
5. Collapse recommendations, integrate voice, and polish responsive layout.
6. Verify representative Coach states, mobile/desktop layouts, build, and scope.

### Isolated best-move behavior
The action is shown only when the current player-turn suggestion has a first move.
`showBestMove` defaults to false, never changes FEN or game state, and resets when
the live FEN changes. The board receives the existing `highlightSquares` prop only
while visible; stale feedback alone cannot render a highlight.
