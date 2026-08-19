# Module: Utilities & Services

## Purpose
All utility modules, service integrations, and data access layers. Includes Supabase client, auth, payments, sounds, chess utilities, and more.

## Key Files
| File | Purpose |
|------|---------|
| `supabase.ts` | Supabase client singleton |
| `supabaseAuthUtils.ts` | Auth helper utilities |
| `authError.ts` | Auth error classification, OTP type normalization, callback-URL builder |
| `authDebug.ts` | Safe `[AUTH_DEBUG]` structured logging (hashed user id, project ref — no secrets) |
| `chessUtils.ts` | Move parsing, UCI/SAN conversion |
| `gamePersistence.ts` | Room state save/load from DB |
| `matchHistory.ts` | Completed game storage |
| `roomActions.ts` | Room CRUD operations |
| `messages.ts` | Chat message CRUD |
| `subscriptionManager.ts` | Supabase channel lifecycle tracker |
| `settingsStorage.ts` | User settings persistence (pure localStorage utilities — no React) |
| `sounds.ts` | Sound effect engine |
| `friends.ts` | Friends/blocking system |
| `duelGame.ts` | Duel game logic |
| `matchmaking.ts` | Matchmaking queue management |
| `fourPlayerActions.ts` | 4-player lobby operations |
| `challenges.ts` | Challenge link generation/validation |
| `insights.ts` | Premium insights logic |
| `moveClassifier.ts` | Heuristic SAN-based move analysis |
| `rateLimit.ts` | API rate limiting |
| `debug.ts` | Debug utilities (conditional logging) |
| `appUrl.ts` | App URL helpers (deep links) |
| `share.ts` | Cross-platform share helper — native sheet via `@capacitor/share`, Web Share API, clipboard fallback |
| `capacitorAuth.ts` | Capacitor-specific auth bridge |
| `capgo-stub.ts` | Capgo social login stub |
| `webPush.ts` | Web Push sender using native Web Crypto (Cloudflare Workers compatible) |

## Logic & Decisions
- All Supabase channels registered via `subscriptionManager` for centralized cleanup.
- `settingsStorage.ts` persists to localStorage.
- `sounds.ts` uses Web Audio API with preloaded buffers.
- `chessUtils.ts` handles SAN-to-UCI conversion for Stockfish compatibility.
- `friends.ts` now includes `friend_avatar_url` in `FriendWithProfile` — sourced from `profiles.avatar_url`.
- `supabaseAuthUtils.ts` captures Google `avatar_url` from `user_metadata` after OAuth sign-in.
- Co-located `__tests__/` and `__mocks__/` directories.

## Dependencies
- `@supabase/supabase-js`, `chess.js`, `@capacitor/*` (optional)

## Recent Changes
- **2026-08-19**: **Auth — "Email not confirmed" on confirmed accounts (root cause + fix).** The string "Email not confirmed" did not exist in the codebase — it was Supabase's `email_not_confirmed` error surfaced verbatim from `signInWithPassword` (i.e. `auth.users.email_confirmed_at IS NULL`). Root cause: `signUp()` never set `emailRedirectTo`, and the app had no auth-callback route, so the email-confirmation redirect never finalized the session in Supabase (with `@supabase/ssr`'s PKCE client the confirmation never completes on a different browser/device). New `authError.ts` (`classifyAuthError`, `normalizeOtpType`, `buildAuthCallbackUrl`) and `authDebug.ts` (safe `[AUTH_DEBUG]` logging with hashed user id + project ref, no secrets). `Auth.tsx` now sets `emailRedirectTo`, classifies login/signup errors accurately (only `email_not_confirmed` → "Email not confirmed"), and logs `signInWithPassword`/`signUp` + post-sign-in `getUser`/`getSession`. New `/auth/callback` page handles `?code=` (PKCE) and `#access_token` (implicit) redirects. Tests: `authError.test.ts`, `authDebug.test.ts`.
- **2026-08-19**: **Resigner missing from Duo history — `room_id` persistence fix.** `saveCompletedGame`'s Supabase write had dropped `room_id` (regression from the `fcab5c9` localStorage-only refactor; re-added in `a09518c` without it), so `getMatchHistoryFromDB`'s `room_players → completed_games.room_id` join could never return any online game and every device silently fell back to device-local history — the resigning player (who navigates away immediately) ended up with no record while the opponent kept a local copy. Restored `room_id: data.roomId` and switched the insert to an idempotent `.upsert(..., { onConflict: 'room_id' })` backed by a new `UNIQUE(room_id)` constraint (see `supabase/supabase.sql`). Both participants now read the same room-scoped row regardless of which client wrote it.
- **2026-08-18**: **Duo P0 — persistence observability + structured game diagnostics.** `gamePersistence.ts` `saveGameState` no longer discards the `games` upsert error: it logs loudly, emits a `GAME_STATE_SAVE_FAILED` trace, and throws so callers can react (a silently-unpersisted games row strands `_gameId` → broken submissions + lobby timeout). New `duoGameTrace.ts` provides dev-gated `[DUO:ROOM]`/`[DUO:GAME]`/`[DUO:REALTIME]`/`[DUO:MOVE]`/`[DUO:CLOCK]` structured diagnostics (hashed user id, roomId, gameId, stage, prev/next state, error code/message; never tokens). Tests: `onlineGameLobbyRecovery.test.ts`, `onlineGameFreezeRecovery.test.ts`.
- **2026-08-18**: **Profile-upsert 400 observability.** The prod `profiles?on_conflict=id` 400 was invisible (bare network error, swallowed `success:false`). `upsertProfile`/`updateProfile` now log the full PostgREST error (`code`/`message`/`details`/`hint`) behind DEBUG, and a loud `console.warn` fires specifically when a `username`-less upsert hits the 23502 NOT NULL violation (`profiles.username IS NOT NULL`) so a single `?debug=1` run identifies the exact caller. Regression test added.
- **2026-08-17**: **Atomic Duo room-join (`join_room_by_code`).** Fixed the post-P0-1 join regression. `roomActions.ts` gains `joinRoomByCode(code)` (calls the SECURITY DEFINER `join_room_by_code` RPC; auth.uid() identity; server-decided team/slot), `messageForDuoJoinError` and the `DuoJoinError` type. New `duoJoinTrace.ts` provides gated `DUO_JOIN_*` structured tracing (hashed user/code, requestId, error code/message; no secrets). The old client-side `get_room_join_state`-based team/count + `room_players` upsert join is replaced by the atomic RPC in all Duo join paths (see `src/app/CONTEXT.md`).
- **2026-08-17**: **FOUR-PLAYER FOLLOW-UP (out of scope, not fixed).** `fourPlayerActions.ts` (`joinLobby`/`assignPlayer`/`unassignPlayer`/`joinFourPlayerRoom`) still uses the same client-side `room_players` upsert pattern and is likewise blocked by the hardened member-only SELECT policy for fresh joiners. Do NOT weaken RLS to fix it. The intended follow-up is a seat-based atomic RPC (e.g. `assign_four_player_seat(room_id, team, slot)` with room-row locking) mirroring `join_room_by_code`. The Duo RPC rejects four-player rooms with `P0005` so this is not a silent regression.
- **2026-08-17**: **Prod diagnostics + profile upsert guard.** `debug.ts` `DEBUG` is now also enabled in production when the page is loaded with `?debug=1` or `localStorage chessduo_debug=1` (read once at module load; reload required) so the same `[ONLINE]`/`[CHESSDUO-BOT-TRACE]`/`[TURN-RESOLVE]` traces can be captured on the live site. Regression test added asserting every insert-capable `upsertProfile` payload derives a format-valid `username` (prevents the PostgREST 400 on `profiles.username NOT NULL`).
- **2026-08-17**: **Friend deep-link fixes (invite 404 + notification refresh signal)** — `capacitorAuth.ts` now routes dynamic deep-links (`/invite/`, `/challenge/`, `/replay/`) via the client router (`opts.navigate`) instead of `window.location.replace`, because those routes have no pre-rendered HTML in the static-export APK and a full reload 404s on the local Capacitor server. `notificationRedirect.ts` exports `FRIENDS_REFRESH_EVENT` (`chessduo:refresh-friends`), dispatched when a friend-related notification redirect is consumed so an already-mounted `FriendsPanel` refetches instead of showing stale requests.
- **2026-08-16**: **Profile upsert 400 fix** — `profileService.ts` gains `deriveUsername()` (validates/sanitizes a candidate, falls back to `player_<md5-seed>`). Callers use it so an avatar/display upsert for a user without a `profiles` row always includes a valid `username` — `profiles.username` is `NOT NULL`, so a username-less INSERT returned 400 (`not_null_violation`). Regression tests added in `profileService.test.ts`.
- **2026-08-13**: **Realtime remount/reconnect hardening** — `RealtimeService.forceRemoveStaleChannels(topic)` added. It force-tears-down any still-registered channel whose topic matches (via `supabase.getChannels()` + `teardown()`), fixing the case where `removeChannel`'s async `unsubscribe()` times out on a dead socket and leaves a stale joined channel registered — re-creating the same topic would reuse it and make `.on(...)` throw. Used in `onlineGame.ts` and `duelGame.ts` reconnect paths.
- **2026-08-03**: **D7/V8 fix** — Deduplicated `generateCode()` (matchmaking.ts now imports `generateRoomCode` from roomActions.ts). Unified `ROOM_EXPIRY_MS` constants: `roomActions.ts` and `fourPlayerActions.ts` now import from `gameConstants.ts`. Added `QUICK_MATCH_ROOM_EXPIRY_MS` (60s) for Quick Play matchmaking rooms.
- **2026-07-31**: **Bug 37** fix — `share.ts` no longer shares/copies `chessduo://` custom-scheme links (non-clickable in WhatsApp/Telegram). `shareLink()` now always shares the clickable HTTPS App Link (`opts.url`): Capacitor Share sheet on native → Web Share API → clipboard fallback. Removed `nativeUrl` from `ShareLinkOptions` and deleted the unused `toNativeLink()`. `getRoomInviteLink()` always returns the HTTPS URL. **Bug 38** fix — `capacitorAuth.ts` deep-link handler now explicitly routes `chessduo://premium` (the checkout return bridge) to `/premium`.
- **2026-07-31**: Mobile fixes — (1) **Bug 36**: all client API calls now resolve against `getAppBaseUrl()` (inlined `NEXT_PUBLIC_SITE_URL`) instead of `window.location.origin`, fixing the `Unexpected token '<'` JSON error in the Capacitor app where relative `/api/*` fetches hit the local static server. (2) **Bug 35**: new `share.ts` helper uses `@capacitor/share` native sheet on Android (with `chessduo://` custom-scheme links) and Web Share API on browsers, clipboard as last resort.
- **2026-07-31**: Sound engine louder + routed through master gain → DynamicsCompressor chain — all synthesized sounds now play at noticeably higher volume (move/capture/lock/check/checkmate/resolution). Added `sounds.test.ts` verifying routing and gain levels.
- **2026-07-18**: `createOnlineRoom` in `roomActions.ts` now accepts `hostColor: PlayerColor` and assigns the host to the matching team (WHITE or BLACK). The joiner auto-receives the opposite team. `supabaseAuthUtils.ts` now captures Google profile `avatar_url` and `display_name` from `user.user_metadata`. `friends.ts` queries and returns `avatar_url` in `FriendWithProfile` for all friend list queries. `searchUsers` also returns `display_name`. `sounds.ts` — chess.com-style synthesized sounds (wooden click, double-tap capture, two-tone check, ascending chord checkmate). `play()` always triggers immediately without blocking on `ctx.resume()`.
- **2026-07-17**: Fixed `webPush.ts` HKDF key type bug — ECDH shared secret was imported as `{ name: 'HKDF' }` but `hkdf()` uses it for HMAC sign operations. Changed to import as `{ name: 'HMAC', hash: 'SHA-256' }` with `['sign']` usages. Added regression test (`webPush.test.ts`).
- **2026-07-14**: `saveCompletedGame()` now also inserts into Supabase `completed_games` table for online games. `rateLimit.ts` added push route limits.
