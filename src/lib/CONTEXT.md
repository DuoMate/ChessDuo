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
| `settings.ts` | User settings (theme, sound) |
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
| `capacitorAuth.ts` | Capacitor-specific auth bridge |
| `capgo-stub.ts` | Capgo social login stub |
| `webPush.ts` | Web Push sender using native Web Crypto (Cloudflare Workers compatible) |

## Logic & Decisions
- All Supabase channels registered via `subscriptionManager` for centralized cleanup.
- `settings.ts` persists to localStorage with Supabase sync when authenticated.
- `sounds.ts` uses Web Audio API with preloaded buffers.
- `chessUtils.ts` handles SAN-to-UCI conversion for Stockfish compatibility.
- `friends.ts` now includes `friend_avatar_url` in `FriendWithProfile` — sourced from `profiles.avatar_url`.
- `supabaseAuthUtils.ts` captures Google `avatar_url` from `user_metadata` after OAuth sign-in.
- Co-located `__tests__/` and `__mocks__/` directories.

## Dependencies
- `@supabase/supabase-js`, `chess.js`, `@capacitor/*` (optional)

## Recent Changes
- **2026-07-31**: Sound engine louder + routed through master gain → DynamicsCompressor chain — all synthesized sounds now play at noticeably higher volume (move/capture/lock/check/checkmate/resolution). Added `sounds.test.ts` verifying routing and gain levels.
- **2026-07-18**: `createOnlineRoom` in `roomActions.ts` now accepts `hostColor: PlayerColor` and assigns the host to the matching team (WHITE or BLACK). The joiner auto-receives the opposite team. `supabaseAuthUtils.ts` now captures Google profile `avatar_url` and `display_name` from `user.user_metadata`. `friends.ts` queries and returns `avatar_url` in `FriendWithProfile` for all friend list queries. `searchUsers` also returns `display_name`. `sounds.ts` — chess.com-style synthesized sounds (wooden click, double-tap capture, two-tone check, ascending chord checkmate). `play()` always triggers immediately without blocking on `ctx.resume()`.
- **2026-07-17**: Fixed `webPush.ts` HKDF key type bug — ECDH shared secret was imported as `{ name: 'HKDF' }` but `hkdf()` uses it for HMAC sign operations. Changed to import as `{ name: 'HMAC', hash: 'SHA-256' }` with `['sign']` usages. Added regression test (`webPush.test.ts`).
- **2026-07-14**: `saveCompletedGame()` now also inserts into Supabase `completed_games` table for online games. `rateLimit.ts` added push route limits.
