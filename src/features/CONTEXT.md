# Module: Domain Logic

## Purpose
Framework-free domain logic — zero React/Next.js imports. Organized by bounded context (game modes, engine, bots). This is the core of the application.

## Files at This Level
| File | Purpose |
|------|---------|
| — | No files at root; everything is in sub-modules |

## Sub-modules
| Module | Context |
|--------|---------|
| `shared/` | `src/features/shared/CONTEXT.md` — GameInterface, constants, accuracy |
| `game-engine/` | `src/features/game-engine/CONTEXT.md` — GameState, board, timers |
| `offline/game/` | `src/features/offline/game/CONTEXT.md` — LocalGame class |
| `online/game/` | `src/features/online/game/CONTEXT.md` — OnlineGame class |
| `bots/` | `src/features/bots/CONTEXT.md` — Bot AI, difficulty, openings |
| `mobile-engine/` | `src/features/mobile-engine/CONTEXT.md` — Browser/capacitor evaluator factory |
| `push-notifications/` | `src/features/push-notifications/CONTEXT.md` — FCM token registration, push sending, deep-link handler |
| `billing/` | `src/features/billing/CONTEXT.md` — BillingProvider abstraction, Creem subscriptions, SubscriptionService |

## Logic & Decisions
- `GameInterface.ts` in `shared/` is the contract — both `OnlineGame` and `LocalGame` implement it.
- Adding a new game method: add to `GameInterface` → implement in BOTH classes → use in `Game.tsx`.
- Domain logic stays framework-agnostic for testability and portability.
- `billing/` uses a `BillingProvider` interface abstraction — UI depends on `SubscriptionService`, never on the payment processor directly. Currently backed by Creem (Merchant of Record) for both web and Android. Architecture is ready for Apple In-App Purchases and other providers.

## Dependencies
- `chess.js` for board state, Stockfish (remote or local WASM) for evaluation

## Recent Changes
- **2026-07-30**: Billing provider swapped from Google Play to Creem (MoR) — new `CreemBillingProvider`, redirect-based checkout, webhook-driven lifecycle. UI only talks to `SubscriptionService`, so no game components changed.
- **2026-08-03**: Deleted `features/auth/` — `AuthGate` moved to `components/`, `useAuthSession` moved to `hooks/` (BV1/BV2 fix: framework-free invariant restored).
