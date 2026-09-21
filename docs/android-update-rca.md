# Android In-App Update — RCA + Fix (Native Play In-App Updates, flexible)

**Status**: FIXED · **Branch**: `develop` · **Date**: 2026-09-21

## 1. Current implementation (after fix)

**Native-first — Google Play In-App Updates (FLEXIBLE)** is now the authoritative
"is an update available" source, per **device/account rollout** — a remote
manifest can never be rollout-aware.

- `android-patches/AppUpdatePlugin.java` — `@CapacitorPlugin(name="AppUpdate")`,
  installed by `scripts/install-app-update.sh` (adds `com.google.android.play:app-update:2.1.0`),
  registered in `scripts/patch-main-activity.sh`. Capacitor routes the update-flow
  `onActivityResult` via `handleOnActivityResult`, so no MainActivity.onActivityResult
  forwarding was required.
  - `check()` → `AppUpdateManagerFactory.create(...).getAppUpdateInfo()` → availability + flexible-allowed.
  - `startFlexibleUpdate()` → official FLEXIBLE flow; `stateChanged` events stream install states.
  - `completeUpdate()` → finalize a DOWNLOADED update.
  - Cancellation (`RESULT_CANCELED`) is a normal choice, forwarded as `flowResult` diagnostics.
- `src/lib/nativeAppUpdate.ts` — web-safe bridge (mirrors `pip.ts`): never throws.
- `src/hooks/useAppUpdate.ts` — native primary; falls back to the remote-manifest
  `decideUpdate` path only when the native check is **indeterminate** (`updateAvailability UNKNOWN`,
  i.e. older APK without the plugin, sideload, degraded Play).
- `src/components/UpdatePrompt.tsx` — "Update" → download → "Restart to install" (`completeUpdate()`).
- `src/app/providers.tsx` — wires the new hook/prompt contract.
- `src/lib/rateApp.ts` — `openPlayListing()` final fallback (Play listing via `@capacitor/browser`).

## 2. Failure observed (pre-fix)

- Users never notified of a newer version: live `version.json` (386) lagged the actual
  Play release (391 crash / 393 prod): every bump commit was `[skip ci]`, so the hosted
  manifest rarely redeployed → `decideUpdate(installed≥ latest)` → `current`.
- When the prompt did appear, "Update" opened nothing on Android:
  `openPlayListing()` used `window.open('market://...', '_system')`, a silent no-op in the
  Capacitor WebView (no `onCreateWindow`), so the catch-guarded `Browser.open` fallback never ran.

## 3. Root cause

- A web-served `version.json` is fundamentally **not per-account truthful**:
  it cannot know staged rollouts, so it lags or guesses. Update detection belongs to Play.
- `markets://` `_system` popups are unsupported by Capacitor's WebView.

## 4. Exact code path

- `useAppUpdate` → `fetchVersionManifest` → `decideUpdate` → `current` (stale manifest), plus dead
  `window.open(market, '_system')` on the Update action.
- After fix: `useAppUpdate` → `checkNativeUpdate()` (Play truth) → optional prompt only when
  `UPDATE_AVAILABLE && flexibleAllowed` → `startNativeFlexibleUpdate()` → `stateChanged`
  `DOWNLOADED` → prompt "Restart" → `completeNativeUpdate()`.

## 5. Fix

1. New native `AppUpdatePlugin` + install script + MainActivity registration + gradle dep.
2. New web-safe `nativeAppUpdate.ts` bridge + hook integration (native primary, manifest fallback
   only when indeterminate).
3. Prompt now drives the download → restart flow; cancellation/Later keep the app usable.
4. `openPlayListing()` native path uses `@capacitor/browser` (HTTPS listing) — no dead `_system` popup.

## 6. Test results

- `src/lib/__tests__/nativeAppUpdate.test.ts` (9) — availability mapping, never-throws, native gating, state subscription, cleanup.
- `src/hooks/__tests__/useAppUpdate.test.tsx` (6) — native-aware optional, authoritative-no (no manifest fetch), manifest fallback, game suppression, web no-op.
- `src/lib/__tests__/rateApp.test.ts` (5) — native opens HTTPS via Browser; `_system` never called.
- `npx tsc --noEmit` clean (only pre-existing `coachVoice` module error). Full `npm test`: no new failures.

## 7. Remaining limitations

- Real Play-distribution proof (accept/cancel/download/kill/resume/restart-to-install across a
  staged track) requires a device with a Play-track build older than the promoted version —
  owner/CI step (container lacks Android SDK/keystore).
- v1 remains OPTIONAL-only (FLEXIBLE, never IMMEDIATE). Immediate/blocking updates are a future policy.
- `handleOnResume` does not force-resume an interrupted flow (flex-only by policy); the plugin
  re-queries on next check.

*Last Updated: 2026-09-21 — Option B: native Google Play In-App Updates (flexible) as the per-account update truth; manifest demoted to an indeterminate-check fallback.*