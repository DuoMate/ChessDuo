# Module: Utilities & Services

## Purpose
All utility modules, service integrations, and data access layers. Includes Supabase client, auth, payments, sounds, chess utilities, and more.

## Key Files
| File | Purpose |
|------|---------|
| `supabase.ts` | Supabase client singleton |
| `supabaseAuthUtils.ts` | Auth helper utilities |
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
- `settingsStorage.ts` persists to localStorage with Supabase sync when authenticated.
- `sounds.ts` uses Web Audio API with preloaded buffers.
- `chessUtils.ts` handles SAN-to-UCI conversion for Stockfish compatibility.
- `friends.ts` now includes `friend_avatar_url` in `FriendWithProfile` — sourced from `profiles.avatar_url`.
- `supabaseAuthUtils.ts` captures Google `avatar_url` from `user_metadata` after OAuth sign-in.
- Co-located `__tests__/` and `__mocks__/` directories.

## Dependencies
- `@supabase/supabase-js`, `chess.js`, `@capacitor/*` (optional)

## Recent Changes
- **2026-08-03**: **D7/V8 fix** — Deduplicated `generateCode()` (matchmaking.ts now imports `generateRoomCode` from roomActions.ts). Unified `ROOM_EXPIRY_MS` constants: `roomActions.ts` and `fourPlayerActions.ts` now import from `gameConstants.ts`. Added `QUICK_MATCH_ROOM_EXPIRY_MS` (60s) for Quick Play matchmaking rooms.
- **2026-07-31**: **Bug 37** fix — `share.ts` no longer shares/copies `chessduo://` custom-scheme links (non-clickable in WhatsApp/Telegram). `shareLink()` now always shares the clickable HTTPS App Link (`opts.url`): Capacitor Share sheet on native → Web Share API → clipboard fallback. Removed `nativeUrl` from `ShareLinkOptions` and deleted the unused `toNativeLink()`. `getRoomInviteLink()` always returns the HTTPS URL. **Bug 38** fix — `capacitorAuth.ts` deep-link handler now explicitly routes `chessduo://premium` (the checkout return bridge) to `/premium`.
- **2026-07-31**: Mobile fixes — (1) **Bug 36**: all client API calls now resolve against `getAppBaseUrl()` (inlined `NEXT_PUBLIC_SITE_URL`) instead of `window.location.origin`, fixing the `Unexpected token '<'` JSON error in the Capacitor app where relative `/api/*` fetches hit the local static server. (2) **Bug 35**: new `share.ts` helper uses `@capacitor/share` native sheet on Android (with `chessduo://` custom-scheme links) and Web Share API on browsers, clipboard as last resort.
- **2026-07-31**: Sound engine louder + routed through master gain → DynamicsCompressor chain — all synthesized sounds now play at noticeably higher volume (move/capture/lock/check/checkmate/resolution). Added `sounds.test.ts` verifying routing and gain levels.
- **2026-07-18**: `createOnlineRoom` in `roomActions.ts` now accepts `hostColor: PlayerColor` and assigns the host to the matching team (WHITE or BLACK). The joiner auto-receives the opposite team. `supabaseAuthUtils.ts` now captures Google profile `avatar_url` and `display_name` from `user.user_metadata`. `friends.ts` queries and returns `avatar_url` in `FriendWithProfile` for all friend list queries. `searchUsers` also returns `display_name`. `sounds.ts` — chess.com-style synthesized sounds (wooden click, double-tap capture, two-tone check, ascending chord checkmate). `play()` always triggers immediately without blocking on `ctx.resume()`.
- **2026-07-17**: Fixed `webPush.ts` HKDF key type bug — ECDH shared secret was imported as `{ name: 'HKDF' }` but `hkdf()` uses it for HMAC sign operations. Changed to import as `{ name: 'HMAC', hash: 'SHA-256' }` with `['sign']` usages. Added regression test (`webPush.test.ts`).
- **2026-07-14**: `saveCompletedGame()` now also inserts into Supabase `completed_games` table for online games. `rateLimit.ts` added push route limits.
