# Module: Billing (Creem Subscriptions)

## Purpose
Provider-agnostic billing module for ChessDuo premium subscriptions. Currently implements Creem (Merchant of Record) for both web and Android via Capacitor Browser. Architecture designed for future provider swaps without changing business logic.

## Files
| File | Purpose |
|------|---------|
| `types.ts` | Shared types: `BillingProvider` interface, `SubscriptionState`, `SubscriptionEvent`, `SubscriptionPlan`, `PurchaseResult`, `SubscriptionInfo` |
| `SubscriptionStateMachine.ts` | Pure function `transition(current, event) → nextState` for subscription lifecycle |
| `CreemBillingProvider.ts` | Creem checkout integration — creates checkout sessions, redirects users, restores subscriptions |
| `SubscriptionService.ts` | High-level API: `initialize()`, `purchaseMonthly()`, `purchaseYearly()`, `restore()`, `isPremium()`, `getPlans()`, `getStatus()`. UI talks only to this — never knows about Creem. |
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
  │     └─► CreemBillingProvider        ← web + Android (now)
  │
  └─► /api/creem/* (Next.js API routes)
        ├─► /checkout   — creates Creem checkout session
        ├─► /products   — fetches product details from Creem
        ├─► /subscriptions — lists active subscriptions (restore)
        └─► /webhook    — handles Creem webhook events (@creem_io/nextjs)
```

## Purchase Flow (Redirect-based)
1. User taps Subscribe → `CreemBillingProvider.purchase()`
2. Client calls `POST /api/creem/checkout` → Creem API creates checkout session
3. Client redirects to Creem-hosted checkout:
   - Web: `window.location.href`
   - Android: `Browser.open()` via Capacitor Browser plugin
4. User completes payment on Creem's hosted page
5. Creem redirects back to `success_url`
6. Creem sends webhook → server updates Supabase via webhook handler
7. UI refreshes status → shows premium state

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
- `@creem_io/nextjs` (webhook handler)
- `creem` (TypeScript SDK for server-side API calls)
- `@capacitor/browser` (Android checkout via in-app browser)
- `@supabase/ssr` (server-side auth)

## Environment Variables
- `CREEM_API_KEY` — Creem API key (server-side only, set as GitHub/Cloudflare secret)
- `CREEM_WEBHOOK_SECRET` — Creem webhook signing secret
- `CREEM_PRODUCT_ID_MONTHLY` — Creem product ID for monthly plan
- `CREEM_PRODUCT_ID_YEARLY` — Creem product ID for yearly plan

## Recent Changes
- **2026-07-30**: Migration from Google Play Billing to Creem (MoR). Replaced `GooglePlayBillingProvider` with `CreemBillingProvider`. New API routes: `/api/creem/checkout`, `/api/creem/products`, `/api/creem/subscriptions`, `/api/creem/webhook`. Removed `subscription/verify` and `subscription/rtdn` routes. Simplified `subscription/status` to read from Supabase only. Webhook-driven subscription lifecycle replaces Google Play token verification.
- **2026-07-17**: Fixed subscription 401 on startup — `initialize()` now runs inside `onAuthStateChange` after session is confirmed. `fetchServerStatus()` retries once on 401 to handle transient auth gaps.
