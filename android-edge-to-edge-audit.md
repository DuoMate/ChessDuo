# Android 15 Edge-to-Edge / Safe-Area Audit — ChessDuo

> Date: 2026-09-18 · Branch: `develop` · Scope: UI/safe-area fix ONLY (no routes, auth, game, billing, ads, or backend changes).
> Aligned to `docs/ARCHITECTURE.md` (Tailwind-first, `dark:` variants, ≥44px targets, no hardcoded hex, no `as any`).

## 1. Root cause

Edge-to-edge is **correctly enabled and enforced** — the web layer was **incompletely inset-aware**.

- Effective `targetSdkVersion = 36` / `compileSdk = 36` (Capacitor 8.3.4 template `variables.gradle`, AGP 8.13.0). Target 36 > 35, so Android 15+ enforces edge-to-edge (`decorFitsSystemWindows=false`, transparent status/nav bars). No opt-out exists in the manifest, theme, or Gradle config.
- `MainActivity` (generated, overwritten by `scripts/patch-main-activity.sh`) calls `EdgeToEdge.enable(this)` — explicit but correct under target 36.
- Capacitor 8.3.4 `SystemBars` plugin already forwards `systemBars | displayCutout (+ime)` insets to Chromium when `viewport-fit=cover` is set (WebView ≥140) and injects `--safe-area-inset-*` CSS vars.
- `src/app/layout.tsx` already exports `viewportFit: 'cover'`, so `env(safe-area-inset-*)` resolves in the WebView.
- **Gap:** `env(safe-area-inset-*)` covered bottom navs, toasts, slide-overs, chat, and the `(main)/` layout top wrapper — but **no top inset existed on any non-`(main)` header**: Home `HeaderBar` (`sticky top-0`, `py-3`), `Game`/`DuelGame`/`ReplayView` board shells, `CoachGame` header (`pt-4`), `RoundHistorySidebar` header (`p-4`), `InstallBanner` (`sticky top-0`), and the `Auth`/`AuthGate` overlay had no scroll guard or insets.

Result: on Android 15 edge-to-edge, the status bar overlays the top ChessDuo/header content, and short-height screens risk bottom clipping behind the gesture/nav bar.

No arbitrary padding was added. Every change reuses the existing `env(safe-area-inset-*)` pattern with `max()` floors already established in the codebase.

## 2. Affected screens

| Screen | Risk before fix | Fix |
|---|---|---|
| Home (`/`) `HeaderBar` + desktop config sticky header + legal footer | Top MEDIUM (no `env(top)`); footer behind pill on short screens | `pt-[max(0.75rem,env(top))]` on `HeaderBar`; `pt-[max(1rem,env(top))]` on config header; footer `pb-[max(0.5rem,env(bottom))]` |
| Quick Play / Duo (`Game.tsx` shell) | Top HIGH | Inner container `pt-[env(top,0px)]` |
| Duel (`DuelGame.tsx` shell + waiting room) | Top HIGH | Same `pt-[env(top)]` on both containers |
| Replay (`ReplayView.tsx`) | Top HIGH / Bottom MEDIUM (missing `pb-24`) | `pt-[env(top)]` + `pb-24` parity with Game/Duel |
| AI Coach (`CoachGame.tsx` header) | Top HIGH | `pt-[max(1rem,env(top))]` |
| Moves (`RoundHistorySidebar`) | Top HIGH / Bottom MEDIUM | Header `pt-[max(1rem,env(top))]`; panel + footer bottom inset (mirrors `SlideOver` mobile pattern) |
| Install banner (`InstallBanner`, mobile web) | Top MEDIUM | `pt-[max(0.625rem,env(top))]` |
| Sign In (`Auth` + `AuthGate` overlay/page) | MEDIUM (no scroll guard on small heights) | Cards `max-h-[90svh] overflow-y-auto` (matches `GameOverModal`); overlay `pt/pb max(1rem,env)` + `overflow-y-auto`; page back-row `pt-[max(1rem,env(top))]` |
| Duel/Replay bottom nav (`BottomNav`) | LOW (tight `0px` floor vs `12px` elsewhere) | `pb-[max(12px,env(bottom,12px))]` via Tailwind (also drops the inline `style`, per F2 precedent) |
| Global loading (`loading.tsx`) | LOW (legacy `min-h-screen w-screen`) | `min-h-dvh w-full` |
| History / Friends / Profile / Settings / Premium / Terms / Privacy / 4-Player | LOW already (`(main)/layout` top inset + `pb-20` + `HomeBottomNav` safe-area) | Untouched |
| Game-over modals, Chat, Insights/`SlideOver`, toasts | LOW already (explicit insets + `svh` caps) | Untouched |

## 3. Android configuration findings

- `android/` is **generated, not committed** (`.gitignore`); native state is defined by the pinned `@capacitor/android@8.3.4` template plus committed patch/build scripts (`patch-main-activity.sh`, `build-aab.sh`, `build-apk.sh`, `setup-capacitor.sh`, `install-native-ad.sh`, `add-deep-link.sh`).
- `AndroidManifest.xml` (template): no `fitsSystemWindows`, translucent flags, bar colors, or `optOutEdgeToEdgeEnforcement`.
- `styles.xml` (template + Capacitor core + splash lib): no status/nav color overrides; only legacy `windowTranslucentNavigation` in the splash `immersive` style selected via `splashFullScreen/splashImmersive: true`.
- `MainActivity`: default `BridgeActivity` subclass, overwritten per build to add Google-auth intent routing, `NativeAdPlugin` registration, and `EdgeToEdge.enable(this)`. No `WindowInsetsListener`/`fitsSystemWindows`/bar-color code in app code — none needed; inset handling is delegated to the Capacitor `SystemBars` plugin + web CSS.
- `variables.gradle`: `minSdk 24`, `compileSdk/targetSdk 36`, `androidx.activity 1.11.0` (provides `EdgeToEdge`), AGP 8.13.0. Setup/CI scripts still provision `android-34` platform/build-tools; AGP auto-provisions 36 at build time.
- `androidbrowserhelper` (deprecated `setStatusBarColor` caller flagged by Play) is already demoted to `compileOnly` in `build-aab.sh`/`build-apk.sh` with an explanatory comment.

## 4. WebView findings

- `capacitor.config.ts`: `androidScheme https`, `android.backgroundColor '#0f1119'` (paints the native window behind the WebView; no white flash-through under transparent bars). No `StatusBar`/`SystemBars` plugin config needed.
- `src/app/layout.tsx` viewport export: `width device-width, initialScale 1, maximumScale 3, userScalable true, viewportFit 'cover'` — the precondition for Chromium `env(safe-area-inset-*)` and Capacitor's inset passthrough. Kept as-is.
- Root: `<html class="h-full">`, `<body class="min-h-full flex flex-col bg-transparent">`; `globals.css` has no `height:100%` / `100vh` / body `env()` guard — none required since insets are applied at header/footer/panel level.
- Native ad overlay (`NativeAdPlugin.java`) positions via raw `x/y*density` with no inset offset — callers must pass inset-aware coordinates. Out of scope for this CSS fix; noted, plugin untouched.

## 5. CSS findings

- 15 existing `env(safe-area-inset-*)` call sites (bottom navs, toasts, slide-overs, chat, banners, `(main)/layout` top). Bottom coverage was good; **top coverage existed only inside `(main)/layout`**.
- No raw `100vh` in screens (`min-h-dvh` migration already done); `svh` caps on modals (`90svh`); legacy `vh` remains only in desktop-only caps (`ChallengePicker 90vh`, `GameMenu 70vh`, `ChatPanel 60vh` desktop, board `min(95vw,80vh)`) — intentionally untouched (desktop, not edge-to-edge).
- `loading.tsx` was the one `min-h-screen w-screen` outlier → `min-h-dvh w-full`.
- `theme-color` is a single `#0f1119` with no light/dark media variant — cosmetic only, untouched.

## 6. Safe-area strategy (single, codebase-consistent)

1. Keep `EdgeToEdge.enable()` + `viewportFit:'cover'` + `backgroundColor '#0f1119'`.
2. Apply insets **only** to sticky/fixed top bars, fixed bottom navs/action bars, and fullscreen `fixed inset-0` mobile panels — never to in-flow desktop rails.
3. Use the existing tokens: top `env(safe-area-inset-top,0px)` (with `max()` floors preserving the current visual padding: `0.75rem` header, `1rem` page headers, `0.625rem` banner); bottom `max(12px,env(bottom,12px))` for fixed pills, `max(0.5–1rem,…)` for footers/panels.
4. Tailwind arbitrary values (`pt-[max(...)]`) per ARCHITECTURE.md §4 + F2 precedent; no new inline `style={{}}`, no hardcoded pixels beyond the existing visual padding values, no color/typography/layout changes.
5. Desktop/browser rendering is pixel-identical: `env(...,0px)` falls back to `0` outside the WebView.

## 7. Files changed (11, Tailwind classes only)

- `src/app/page.tsx` — `HeaderBar`, desktop config sticky header, legal footer
- `src/components/Game.tsx` — inner shell top inset
- `src/components/DuelGame.tsx` — main shell + waiting-room top inset
- `src/components/ReplayView.tsx` — top inset + `pb-24` parity
- `src/components/coach/CoachGame.tsx` — header top inset
- `src/components/RoundHistorySidebar.tsx` — header/panel/footer insets
- `src/components/InstallBanner.tsx` — banner top inset
- `src/components/Auth.tsx` — outer top/bottom inset, cards `max-h-[90svh] overflow-y-auto`
- `src/components/AuthGate.tsx` — overlay insets + scroll, page back-row top inset
- `src/components/BottomNav.tsx` — `12px` bottom floor via Tailwind (inline style removed)
- `src/app/loading.tsx` — `min-h-dvh w-full`

## 8. Files intentionally untouched

- Routes/navigation/auth: `middleware`/`proxy`, `(main)/layout.tsx`, `navigation.ts`, `authService`, `supabase.ts`, `/auth/callback`
- Game logic: `GameInterface.ts`, `localGame.ts`, `onlineGame.ts`, `GameSections.tsx`, `BoardTopBar.tsx`, `ChessBoard.tsx`, Stockfish/evaluators, timers, persistence, Realtime
- Billing/Article 9: `features/billing/*`, `GooglePlayBillingProvider`, `/premium` purchase flow, AdMob/`nativeAd.ts`/`NativeAdSlot`, `install-native-ad.sh`, `patch-main-activity.sh`, `capacitor.config.ts`, manifest/styles/gradle
- Notifications, deep links, `challenge/[code]`, `invite/[userId]`, push, `SlideOver.tsx`, `ChatPanel.tsx`, `GameOverModal.tsx`, `Toast.tsx`, `globals.css`, `layout.tsx` viewport export
- Desktop-only legacy `vh` caps (not edge-to-edge surfaces)

## 9. Device testing results

- `npx tsc --noEmit`: clean.
- `npm test`: 1470 passed; 3 failing suites investigated — `server/engine` (LRUCache constructor) and `ConfirmMoveBar` (stale expectations vs the 2026-07-19 two-button redesign) fail identically on the clean baseline (verified via `git stash`); `BillingDiagnostics` passes in isolation with these changes (full-run parallel flake, also noted in the prior F4 sweep). **No new failures introduced.**
- Touched-file scope: `git diff --stat` shows only the 11 UI files above (19 insertions, 19 deletions, all className changes).
- Real-device matrix (Android 15+ gesture / 3-button, portrait, small + large screens, scroll + game + modal screens; before/after screenshot comparison) and the production Android build remain for a signed-device run — same standing as prior mobile changes in this repo.

## 10. Play Console warning status

- Cause: `targetSdk 36` (≥35) puts the app under Android 15 mandatory edge-to-edge; any content laid out at y=0 / bottom=0 without inset handling renders under transparent system bars — which is exactly what the missing top insets did.
- Change: UI now works *with* edge-to-edge (insets at every system-bar boundary); edge-to-edge was NOT disabled and no opt-out was added, so the enforcement requirement stays satisfied.
- The deprecated `setStatusBarColor` caller (`androidbrowserhelper`) was already excluded from the DEX via `compileOnly`.
- Expected: warning clears on the next release build; confirm in Play Console after upload. Safe because the fix is additive CSS (`env()` → `0` where unsupported) with desktop pixel-parity.
