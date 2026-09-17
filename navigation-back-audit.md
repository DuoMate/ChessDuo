# Navigation / Back-Button Audit — ChessDuo

> Generated: 2026-09-17 (Phase 1 audit, updated during Phase 2 fix-all)
> Scope: Home → AI Coach → Match/Upgrade → Back + full-app sweep (23 flows).
> Router: Next.js App Router (`router.push` = new entry, `router.replace` = replace entry,
> `router.back()` = browser back). Android HW back: `useCapacitorBackButton` stack in
> `src/hooks/useCapacitorBackButton.ts`; empty stack → `App.exitApp()`.
> Web guard sentinel: `useNavigationGuard.ts` pushes tagged `pushState({__chessduoNavGuard:true})`.

## Conventions (per `docs/ARCHITECTURE.md` §4 + §9)

* Active game MUST use `useNavigationGuard` (sentinel + Leave modal, no direct nav).
* Active-match Back/Leave + resignation MUST converge on the terminal game-over
  lifecycle (`GameOverModal` / Coach inline modal, with `NativeAdSlot`+`AdSenseSlot`)
  before navigation. Lobby leave may navigate immediately.
* Upgrade/Back-to-Home/auth-follow use `router.replace` (no history pollution).
  Game entry from lobby/challenge uses `router.replace`. `History → Replay` uses `push`.
* Every full-screen route must have a HW-back handler or inherit `(main)/layout`.
  Never `window.location = "/home"` / blind `history.back()` (see `navigation.ts`).

---

## NB-001 — AI Coach locked screen HW Back exits app
* Location: `src/app/coach/page.tsx` (no handler) + `src/components/coach/CoachGate.tsx:82-131`
* Flow: Home → AI Coach → Locked (trial consumed, non-premium) → HW Back
* Current: `handlerStack` empty (`CoachGame` never mounted) → `App.exitApp()`
* Expected: Home
* Why suspicious: only game route with content but no `useCapacitorBackButton`/`useNavigationGuard` in one state
* Severity: Critical | Status: CONFIRMED → FIXED (HW handler + `replace`)
* Fix: `CoachGate` registers `useCapacitorBackButton(replace('/'), locked-only)`; Upgrade + Back-to-Home use `replace`
* Regression risk: Low (locked screen only; gate logic untouched)
* Affects: Android (exit), Web (loop/wrong landing)

## NB-002 — Coach → Premium pushed, Back lands on locked coach not Home
* Location: `CoachGate.tsx:114`, `CoachGame.tsx:404` (`router.push('/premium')`)
* Flow: Home → Coach → Upgrade CTA → Premium → Back
* Current: `Home → /coach → /premium`; `BackButton`/`(main)/layout` do `router.back()` → locked `/coach`
* Expected: Home (REQ-A)
* Severity: High | Status: CONFIRMED → FIXED (`replace('/premium')`)
* Regression: Low (premium screen unchanged; only entry semantics)
* Affects: Web + Android

## NB-003 — Coach "Back to Home" pushes duplicate Home
* Location: `CoachGate.tsx:123` (`router.push('/')`)
* Current: `Home → /coach → /`; Back re-opens `/coach` (loop)
* Expected: Home with no return to `/coach`
* Severity: High | Status: CONFIRMED → FIXED (`replace('/')`)
* Affects: Web + Android

## NB-004 — Web Google OAuth parks external history; Back can hit Google/callback
* Location: `src/lib/supabaseAuthUtils.ts:177-226` (standard SDK redirect) + `src/app/auth/callback/page.tsx:101,116,131` (only self `replace`)
* Flow: Sign-in → Google → callback → Home → Coach → Premium → Back
* Current: `accounts.google.com` entries stay before callback; unsafe `back()` walks into them
* Expected: Back never exposes OAuth/consent/callback
* Severity: High | Status: REVIEW REQUIRED → MITIGATED (`canGoBackSafely` same-origin check; no auth-behavior change)
* Regression: Low | Affects: Web

## NB-005 — `BackButton` unsafe `history.length > 2` heuristic
* Location: `src/components/BackButton.tsx:24`
* Flow: cold deep-link (`/invite`, `/challenge`, `/replay`, `/premium`) → Back
* Current: `back()` into external referrer or app-exit
* Expected: same-origin back else fallback
* Severity: Medium | Status: CONFIRMED → FIXED (new `src/lib/navigation.ts: canGoBackSafely()`)
* Regression: Low | Affects: Web + Android (webview)

## NB-006 — `(main)/layout` HW handler same heuristic
* Location: `src/app/(main)/layout.tsx:30-34`
* Current: `history.length>2 ? back() : push('/')`
* Expected: safe-back else Home
* Severity: Medium | Status: CONFIRMED → FIXED (uses `canGoBackSafely`)
* Affects: Android (all `(main)` pages: premium/history/profile/friends/settings/four-player)

## NB-007 — Home overlay `pushState` same-URL entries
* Location: `src/app/page.tsx:311`
* Flow: Home overlay (auth/gameMode) → Back
* Current: pushes duplicate-URL entries; popstate closes overlay (intended) but pollutes stack
* Expected: close overlay, stay Home — keep as-is, documented intentional
* Severity: Low | Status: INTENTIONAL (no change)

## NB-008 — `Game` GAME_OVER HW handler inactive → exit risk
* Location: `src/components/Game.tsx:416-432` (active only PLAYING/READY/WAITING)
* Flow: Game Over → HW Back
* Current: handler inactive + `handleHardwareBack` returns false → `exitApp()`
* Expected: Home (REQ-D), after `GameOverModal` lifecycle per §9
* Severity: Medium | Status: CONFIRMED → FIXED (terminal-state handler → `replace('/')`)
* Regression: Low | Affects: Android. Web covered by guard-sentinel consumption.

## NB-009 — `AuthGate` overlay `pushState` asymmetry
* Location: `src/components/AuthGate.tsx:90-100`
* Status: INTENTIONAL (overlay close on popstate; no re-push needed — overlay unmounts). No change.

## NB-010 — Replay/History/Welcome push vs replace
* Location: `replay/[gameId]/client.tsx:31 push('/history')`; `welcome/page.tsx:77,122 replace('/')`
* Status: INTENTIONAL (History→Replay→Back→History needs push; Welcome uses replace — correct reference pattern). No change.

## NB-011 — `FourPlayerLobby` HW back calls `handleLeave` unconditionally
* Location: `src/components/FourPlayerLobby.tsx:70-76`
* Flow: Lobby → Back
* Current: leaves room + layout handler also fires (stack order: lobby handler top, runs first, returns true so layout skipped — safe)
* Expected: leave lobby, go Home, no resign (no match yet → immediate nav per §9)
* Status: INTENTIONAL (verified stack LIFO; no change)

## NB-012 — Coach web Back with Insights/Chat/Moves open hit Leave modal
* Location: `CoachGame.tsx:235-244` (`hasOpenOverlay` only `showResignConfirm`)
* vs `Game.tsx:362-368` (all overlays included)
* Current: web Back with Coach panel open → Leave modal instead of close
* Expected: close overlay, remain in game, no history nav (REQ-E)
* Severity: Medium | Status: CONFIRMED → FIXED (`hasOpenOverlay` includes `activePanel`; `onOverlayBack` closes resign-confirm first, then active panel)
* Regression: Low | Affects: Web (+ HW already closed via capacitor handler path)

## NB-013 — Invite/Challenge/Callback screens lack HW handlers
* Location: `invite/[userId]/client.tsx`, `challenge/[code]/client.tsx` (no import), `auth/callback/page.tsx` (no import)
* Current: HW Back during loading/error → `exitApp()`
* Expected: Home (or no-op mid-join); never exit mid-challenge-join
* Severity: Medium | Status: CONFIRMED → FIXED (static-state-only handlers → `replace('/')`; join in-flight untouched)
* Affects: Android

---

## Verification matrix (Phase 3)

* TEST-01 Home→Coach→Upgrade→Back → Home (web + HW)
* TEST-02 Home→Coach→Match→Back → Leave modal / Home per state
* TEST-03 Quick Play→Game→Back → unchanged (guard + Leave modal)
* TEST-04 Duo→Lobby→Back → unchanged
* TEST-05 Game→Insights→Back → close overlay, remain in game
* TEST-06 Game Over→Back → Home (no OAuth exposure)
* TEST-07 Google sign-in→Back → no callback/consent screen
* TEST-08 HW Back per flow → same as in-app Back
* TEST-09 Deep-link→auth→destination → destination preserved, Back hides callback

## Unchanged (explicit)

AI/Stockfish (`coachEngine`, `coachAnalysis`, `ChessBot`), game state/timers/realtime/Supabase/auth behavior/billing (`SubscriptionService`, providers)/AdMob+AdSense/Premium entitlement/UI copy/game rules/router architecture. Only navigation/history/handler wiring + docs.
