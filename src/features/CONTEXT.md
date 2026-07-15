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
| `billing/` | `src/features/billing/CONTEXT.md` — BillingProvider abstraction, Google Play Billing, SubscriptionService |

## Logic & Decisions
- `GameInterface.ts` in `shared/` is the contract — both `OnlineGame` and `LocalGame` implement it.
- Adding a new game method: add to `GameInterface` → implement in BOTH classes → use in `Game.tsx`.
- Domain logic stays framework-agnostic for testability and portability.
- `billing/` uses a `BillingProvider` interface abstraction — UI depends on `SubscriptionService`, never on Google Play directly. Architecture is ready for Apple In-App Purchases and web payments.

## Dependencies
- `chess.js` for board state, Stockfish (remote or local WASM) for evaluation
