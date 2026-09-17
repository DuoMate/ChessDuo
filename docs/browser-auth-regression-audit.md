# Browser Google OAuth / PKCE Regression Audit

Date: 2026-09-17 | Branch: develop | Author: OpenCode

## 1. Last known working auth flow

Web Google sign-in (`supabaseAuthUtils.authenticateWithGoogleWeb`
[src/lib/supabaseAuthUtils.ts:177-226]):
`signInWithOAuth({ provider: 'google', options: { redirectTo:
<origin>/auth/callback?flow=oauth[&redirect=<dest>], queryParams: { access_type:
'offline', prompt: 'select_account' } } })` (standard SDK redirect, no
`skipBrowserRedirect` — fixed by `441f03f`). Supabase stores the one-time PKCE
verifier in a cookie (`sb-<ref>-auth-token-code-verifier`, via
`@supabase/ssr` `createBrowserClient`), redirects to Google, Google returns to
`/auth/callback?code=<uuid>&flow=oauth`, the callback exchanges the code
(`supabase.auth.exchangeCodeForSession(code)` [src/app/auth/callback/page.tsx:99])
and routes onward (`/` or `/?redirect=<dest>`).

## 2. Current auth flow

Same as above — **no auth-mechanism file changed since `441f03f`**.
Diff `441f03f..HEAD` for `authService.ts`, `supabase.ts` (client creation),
`pendingAction.ts`, `capacitorAuth.ts`, `useAuthSession`, middleware: only
`src/lib/supabase.ts` gained a type column (`coach_last_free_game_at`); the
callback page, `page.tsx`, and `Auth.tsx` changes are error-UI/a11y/label
cosmetics (verified hunk-by-hunk). Single browser client
(`createBrowserClient`, singleton) — no dual-client divergence. Middleware
matcher is `/history` only. No SSR/cookie-config change.

## 3. Recent commits touching auth/navigation (441f03f..HEAD)

- `ebb0541` — callback page: BackButton → always-on `useCapacitorBackButton`
  (web no-op, verified in hook source) + error-screen copy/`details` UI.
- `cd1467f` / `0a82c73` — home coach card, labels, `role=alert`/`role=status`.
- `src/lib/navigation.ts` (NEW) — pure `canGoBackSafely()` helper, no auth.
- `useNavigationGuard.ts` — game/overlay back interception, no auth/storage.
- `providers.tsx` — ad preload + deferred Stockfish pre-warm, no auth.

## 4. Exact point where the flows diverged

No code commit changed the OAuth mechanism. The divergence is a **latent
dual-consumer race** that recent timing/layout work made deterministic:

1. `@supabase/ssr` `createBrowserClient` forces `flowType: 'pkce'` +
   `detectSessionInUrl: true`. Installed `@supabase/auth-js` (2.107.0, pinned
   in `package-lock.json`) auto-runs `initialize()` in the constructor, which
   parses `window.location.href` and — if it still contains `?code=` —
   auto-exchanges it (`_getSessionFromURL` → `_exchangeCodeForSession`),
   consuming the one-time verifier and saving the session.
2. The callback page effect ALSO explicitly exchanges the same code
   (`exchangeCodeForSession` awaits `initializePromise` first, so the auto
   exchange always settles before it). If the auto path consumed the verifier,
   the explicit call throws exactly `PKCE code verifier not found in storage`
   — while the session was actually established. UI shows "Couldn't sign in"
   over a valid session.
3. The pre-exchange `history.replaceState` URL strip (added by `d6e2508` for
   refresh-replay safety) decides the winner: if the effect strips `?code`
   before auto-init parses the URL, the explicit exchange wins (success); if
   auto-init parses first, the explicit exchange loses (error screen). Recent
   work shifted this timing against the user.

## 5. Suspected cause

The race in §4: the same one-time PKCE code is consumable by two SDK paths
(auto-init URL detection + explicit page exchange), and the loser surfaces the
verifier-missing error. Evidence: constructor auto-init + forced
`detectSessionInUrl` (verified in installed `node_modules` sources);
`exchangeCodeForSession` awaiting `initializePromise` (verified); `_isPKCECallback`
requiring `params.code && storedVerifier` (verified); single shared client
(verified — hypotheses C/F/G eliminated); no storage-clearing code on the path
(hypotheses A/D/E eliminated); OAuth `?code=` never reaches the home
room-join handler (hypothesis I eliminated — AUTH-JOIN FIX intact).

## 6. Minimal fix

In the callback PKCE branch only: if the explicit exchange fails with the
verifier-missing class (`isPkceVerifierMissing`, existing classifier), check
`supabase.auth.getSession()` — the session is the ground truth. Session
present ⇒ auto path already completed sign-in ⇒ route onward exactly as on
success. Session absent ⇒ genuine failure ⇒ existing error/recovery paths
unchanged (OAuth → error screen, email → recovery screen). This reconciles
both race outcomes deterministically without touching client architecture,
detection flags (implicit `#access_token` fallback keeps working), routing,
or any other flow.

Considered and rejected: `detectSessionInUrl: false` (app-wide blast radius —
breaks implicit-link pickup and every `?code=` page; wider than the bug) and
relying solely on auto-detect (its errors are debug-only/silent — the page
would hang on genuine failures).

## 7. Mobile impact

None. Native OAuth returns via `chessduo://auth/callback?code=` deep link
handled in `capacitorAuth.ts:57-80` — the code comes from the link string, not
`window.location.href`, so auto-init never sees it and there is no race. The
fix touches only the web callback page error branch; `capacitorAuth.ts`
unchanged.

## 8. Files that need modification

1. `src/app/auth/callback/page.tsx` — PKCE-branch race reconciliation only.
2. `src/app/auth/callback/__tests__/callback.test.tsx` (NEW) — 5 scenarios
   (success, race-reconciled, genuine OAuth failure, email recovery,
   redirect preserved).

## 9. Files intentionally left untouched

`supabase.ts` (client), `supabaseAuthUtils.ts`, `authError.ts`, `AuthService`,
`capacitorAuth.ts`, `pendingAction.ts`, middleware, providers, `page.tsx`,
`Auth.tsx`, billing, ads, game logic, DB, API routes.
