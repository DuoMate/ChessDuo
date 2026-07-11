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
| `razorpay.ts` | Razorpay payment client |
| `rateLimit.ts` | API rate limiting |
| `debug.ts` | Debug utilities (conditional logging) |
| `appUrl.ts` | App URL helpers (deep links) |
| `capacitorAuth.ts` | Capacitor-specific auth bridge |
| `capgo-stub.ts` | Capgo social login stub |

## Logic & Decisions
- All Supabase channels registered via `subscriptionManager` for centralized cleanup.
- `settings.ts` persists to localStorage with Supabase sync when authenticated.
- `sounds.ts` uses Web Audio API with preloaded buffers.
- `chessUtils.ts` handles SAN-to-UCI conversion for Stockfish compatibility.
- Co-located `__tests__/` and `__mocks__/` directories.

## Dependencies
- `@supabase/supabase-js`, `chess.js`, `@capacitor/*` (optional)
- Razorpay SDK, Stockfish WASM
