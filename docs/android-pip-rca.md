# Android Picture-in-Picture — RCA + Fix

**Status**: FIXED · **Branch**: `develop` · **Date**: 2026-09-21

## 1. Current implementation

Presentation-only bridge; game state stays in React/engines.

- `android-patches/PipPlugin.java` — Capacitor bridge (`setEligible`, `enter`, auto-enter via `setAutoEnterEnabled` API 31+, `isInPip`, `onPipModeChanged`, `handleOnResume` re-assert, cleanup on destroy).
- `scripts/install-pip.sh` — copies the plugin into the generated `android/` project.
- `scripts/patch-main-activity.sh` — registers `PipPlugin`, forwards `onPictureInPictureModeChanged`, pre-Android-12 `onUserLeaveHint` manual enter.
- Manifest flags injected during setup/build:
  - `scripts/setup-capacitor.sh:181`
  - `scripts/build-aab.sh:193`
  - `scripts/build-apk.sh:194`
- Web: `src/lib/pip.ts` (best-effort, change-suppressed), `src/hooks/usePip.ts`, `src/components/PipOverlay.tsx`; wired in `Game.tsx`, `DuelGame.tsx`, `CoachGame.tsx`.

## 2. Failure observed

PiP never engages across all Android versions — Home gesture does nothing, no `pipModeChanged`, no overlay swap. No crash (fail-silent by design hides it).

## 3. Root cause

`android:supportsPictureInPicture="true"` was **never written to the release manifest**.

The Capacitor 8.3.4 template (`node_modules/@capacitor/cli/assets/android-template.tar.gz`) emits the manifest **multi-line**:

```xml
<activity
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
    android:name=".MainActivity"
```

Every setup/build script ran:

```bash
sed -i '/android:name="\.MainActivity"/ s|<activity |<activity android:supportsPictureInPicture="true" |' "$MANIFEST"
```

This sed only edits the line **matching** `.MainActivity` and looks for `"<activity "` **on that same line**. The two tokens live on different lines, and `<activity` is at end-of-line (`<activity$` — no trailing space), so the substitution pattern never matches. Verified empirically against the real template: **grep count = 0** after either the current or the original (`2d63770`) sed. **PiP was broken from inception**; without the manifest flag `enterPictureInPictureMode()` refuses entry and auto-enter never triggers.

## 4. Exact code path

- `PipPlugin.setEligible/enter` → framework `setPictureInPictureParams` / `enterPictureInPictureMode` → silently ineffective because the Activity has no `supportsPictureInPicture` declaration.
- Build chain: `npx cap add android` (template) → `setup-capacitor.sh`/`build-*.sh` sed → **flag never applied**.

## 5. Fix

Replace the no-op sed in all three scripts with an insertion directly after the `<activity` opening tag, then **verify it landed**:

```bash
sed -i '0,/^[[:space:]]*<activity/{s|<activity|<activity android:supportsPictureInPicture="true"|}' "$MANIFEST"
grep -q 'android:supportsPictureInPicture="true"' ... || warn/err "PiP flag NOT applied"
```

- The generated manifest has exactly **one** `<activity` (MainActivity), so the first-match target is safe.
- `configChanges` already includes `smallestScreenSize|screenLayout|orientation` in the template → no Activity recreation on PiP transitions; the widening sed is now a no-op (kept for safety on older templates).
- `resizeableActivity` not set → defaults enabled → PiP allowed.
- No Android-16-specific workaround needed/added (failures were version-independent).

## 6. Test results

- Sed logic verified against the extracted Capacitor 8.3.4 template: attribute lands on the `<activity` line of MainActivity (grep count = 1).
- Web suites (`pip.test.ts`, `usePip`, `GameMenu`, PipOverlay callers) unchanged and green; full `npm test` no new failures.
- Real-device entry/exit (Android 12+ home-gesture auto-enter, pre-12 `onUserLeaveHint`, manual button, background/rotate) requires a device or emulator with the patched build — not available in this container.

## 7. Remaining limitations

- Manifest built via `bash scripts/build-aab.sh` (R8 + `-keepattributes SourceFile,LineNumberTable`) must be confirmed once via `dumpsys` / manifest decoder on a real device — owner/CI step (requires `android/`, `ANDROID_HOME`, keystore).
- Android 16 verified only by inspection (no API-specific behaviour involved; the flag was the sole blocker).

*Last Updated: 2026-09-21 — PiP RCA + fix (supportsPictureInPicture never written to manifest; sed no-op on multi-line template).*