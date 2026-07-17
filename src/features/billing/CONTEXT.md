# Module: Billing (Google Play Subscriptions)

## Purpose
Provider-agnostic billing module for ChessDuo premium subscriptions. Currently implements Google Play Billing on Android via Capacitor. Architecture designed for future Apple In-App Purchases and web payments without changing business logic.

## Files
| File | Purpose |
|------|---------|
| `types.ts` | Shared types: `BillingProvider` interface, `SubscriptionState`, `SubscriptionEvent`, `SubscriptionPlan`, `PurchaseResult`, `SubscriptionInfo` |
| `SubscriptionStateMachine.ts` | Pure function `transition(current, event) → nextState` for subscription lifecycle |
| `GooglePlayBillingProvider.ts` | Capacitor wrapper for `@capacitor-community/google-play-billing` |
| `SubscriptionService.ts` | High-level API: `initialize()`, `purchaseMonthly()`, `purchaseYearly()`, `restore()`, `isPremium()`, `getPlans()`, `getStatus()`. UI talks only to this — never knows about Google Play. |
| `index.ts` | Public API re-exports |

## Architecture

```
UI (React Components)
  │  talks ONLY to SubscriptionService
  ▼
SubscriptionService
  │  purchaseMonthly()  purchaseYearly()  restore()  isPremium()  getPlans()
  │
  ├─► BillingProvider (interface)
  │     └─► GooglePlayBillingProvider     ← Android (now)
  │         AppleBillingProvider           ← iOS (future)
  │         WebBillingProvider             ← web (future)
  │
  └─► /api/subscription/* (Cloudflare Worker endpoints)
        ├─► Google Play Developer API (REST + jose JWT)
        └─► Supabase (source of truth)
```

## Verification Flow
1. Client calls `BillingProvider.purchase()` → Google Play native dialog
2. On success, client sends `{ purchaseToken, productId, orderId }` to `/api/subscription/verify`
3. Server gets OAuth2 token via jose JWT → calls Google Play Android Publisher API
4. Validates `purchaseState === PURCHASED`, `expiryTime > now`
5. Acknowledges purchase to Google Play
6. Updates Supabase: `is_premium=true`, `subscription_provider='GOOGLE_PLAY'`, etc.
7. Returns `{ success: true }`

## Startup Flow
1. `SubscriptionService.initialize()` → check server `/api/subscription/status`
2. Server checks Supabase (cached state from DB)
3. Re-verifies with Google Play only when: expiry < 3 days, last_verified > 24h, purchase pending, or restore requested
4. If NOT premium → auto-restore from Google Play purchase history

## Subscription State Machine
```
CHECK → ACTIVE | EXPIRED | PENDING
ACTIVE → GRACE_PERIOD | ON_HOLD | EXPIRED | CANCELLED
GRACE_PERIOD → ACTIVE | EXPIRED
ON_HOLD → ACTIVE | EXPIRED
PENDING → ACTIVE | EXPIRED
EXPIRED → ACTIVE (via purchase/restore)
CANCELLED → ACTIVE (via purchase/restore)
```

## Integration Points
- `src/app/providers.tsx` — `SubscriptionService.initialize()` triggered on `onAuthStateChange` after session confirmed
- `src/app/(main)/premium/page.tsx` — `getPlans()`, `purchaseMonthly()`, `purchaseYearly()`
- `src/components/InsightsGate.tsx` — `isPremium()`
- `src/components/ProfilePanel.tsx` — `isPremium()`

## Dependencies
- `@capacitor-community/google-play-billing` (Android native plugin)
- `jose` (server-side JWT signing for Google Play OAuth2)
- `@supabase/ssr` (server-side auth)

## Recent Changes
- **2026-07-17**: Fixed subscription 401 on startup — `initialize()` now runs inside `onAuthStateChange` after session is confirmed. `fetchServerStatus()` retries once on 401 to handle transient auth gaps.
- **2026-07-15**: Initial implementation — migrated from Razorpay to Google Play Billing. Complete removal of Razorpay SDK, API routes, and DB columns. Added `BillingProvider` abstraction, `SubscriptionStateMachine`, `GooglePlayBillingProvider`, and `SubscriptionService`.
