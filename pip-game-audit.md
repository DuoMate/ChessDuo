# PiP Game Audit — ChessDuo Live Game Picture-in-Picture

> Branch: `develop` (direct). Date: 2026-09-18. Scope: Android mobile only.

## 1. Current Android architecture

- `android/` is **generated, never checked in** (gitignored). Regenerated per
  release via `rm -rf android && npx cap add android`. All native integration
  therefore lives in `android-patches/` + `scripts/` (patch chain), not in
  `android/` directly.
- `MainActivity` source of truth: `scripts/patch-main-activity.sh`
  (`BridgeActivity` + `NativeAdPlugin` registration + `EdgeToEdge.enable` +
  SocialLogin `onActivityResult` forward). No `onPause`/`onResume` overrides —
  lifecycle inherited from Capacitor `BridgeActivity`.
- Manifest source of truth: generated manifest + mutations in
  `setup-capacitor.sh` (`AD_ID` kept, `POST_NOTIFICATIONS`), `install-native-ad.sh`
  (AdMob `APPLICATION_ID`), `add-deep-link.sh` (OAuth / App Link / `chessduo://`).
- `capacitor.config.ts`: `appId com.navron.chessduo`, `webDir 'out'`,
  static export. Capacitor 8.3.4. Effective SDKs: `compileSdk 36`,
  `targetSdk 36`, `minSdk 24`, Java 21, AndroidX (appcompat/activity/core/webkit).
- Bridge today: Capacitor plugins only (`App`, `Browser`, `Share`,
  `SplashScreen`, `NativeAd`, push/billing/TTS). No generic JS bridge.

## 2. Current game state source

- No store. Engine object (truth) + React mirror (view).
- `GameInterface` is the contract (`status`, `currentTurn`, `board: Chess`,
  `lastMove`, `getMatchTimeRemaining()`, `getTeam()/getPlayerColor()/…`).
- Engines: `OnlineGame` (Duo/4P, Realtime, coordinator model), `LocalGame`
  (Quick offline), `DuelGameEngine` (1v1 per-side clocks), `CoachGameEngine`
  (untimed). Shells: `Game.tsx`, `DuelGame.tsx`, `CoachGame.tsx`.

## 3. Current timer source

- All deadline-based (`Date.now()`); `setInterval(1000)` is display/refresh only.
- Online/Duo/4P: anchor `games.match_started_at` → `computeMatchRemaining()`
  (coordinator countdown + 5s `timer_sync`; peers never advance turns on sync).
- Duel: per-side clocks, opponent-of-expired-side declares timeout.
- Coach: untimed. Display: `IsolatedMatchTimer` polls engine via ref.

## 4. Current lifecycle handling

- Native: inherited `BridgeActivity` (`bridge.onPause/onResume/…`).
- Web: `useCapacitorBackButton` handler stack; `useNavigationGuard` tagged
  sentinel; `visibilitychange` only recomputes clocks (never abandons).
- Abandonment only via explicit resign/leave confirm or 35s disconnect watchdog.

## 5. Best PiP integration point

- Native: new `android-patches/PipPlugin.java` (`@CapacitorPlugin(name="Pip")`)
  + `scripts/install-pip.sh` (copy step, mirrors `install-native-ad.sh`) +
  `patch-main-activity.sh` (register + `onPictureInPictureModeChanged` forward +
  pre-12 `onUserLeaveHint` gate) + manifest (`supportsPictureInPicture`,
  `configChanges` widen) in setup/build scripts.
- Web: `src/lib/pip.ts` (best-effort bridge, change-suppressed) +
  `src/hooks/usePip.ts` (`usePipEligibility` / `usePipMode`) +
  `src/components/PipOverlay.tsx` (compact FEN board + turn + clock).
- Strategy: same-activity WebView PiP; React swaps full shell → compact
  overlay on native `pipModeChanged`. No second engine, no second timer,
  no native chess rendering, no `SYSTEM_ALERT_WINDOW`.

## 6. Files expected to change

`android-patches/PipPlugin.java` (new), `scripts/install-pip.sh` (new),
`scripts/patch-main-activity.sh`, `scripts/setup-capacitor.sh`,
`scripts/build-apk.sh`, `scripts/build-aab.sh`, `src/lib/pip.ts` (new),
`src/hooks/usePip.ts` (new), `src/components/PipOverlay.tsx` (new),
`src/features/shared/gameConstants.ts` (`PIP_ASPECT_*`), `Game.tsx`,
`DuelGame.tsx`, `CoachGame.tsx` (eligibility + overlay mount only),
co-located tests, `docs/ARCHITECTURE.md` (§11), `CONTEXT.md` entries,
`pip-game-audit.md`, `implementation-progress.md`.

## 7. Files intentionally protected

Chess rules/move-gen, Stockfish (`mobile-engine/`), AI Coach
engine/recommendations, sync (Realtime channels, `duelGame` DB), Supabase/
migrations/schema, persistence, timer authority, matchmaking, auth, deep
links, billing, AdMob (`NativeAdPlugin`, `nativeAd.ts`, slots), notifications,
result/resign/game-over logic, routing architecture, `GameInterface`
(read-only consume), browser behavior.
