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
| `__tests__/` | Unit tests for `SubscriptionService` (restore, purchase, status) and `CreemBillingProvider` |

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
        ├─► /checkout          — creates Creem checkout session
        ├─► /products          — fetches product details from Creem
        ├─► /subscriptions     — lists active subscriptions (restore)
        ├─► /verify-checkout   — verifies a completed checkout after redirect (grants premium immediately)
        └─► /webhook           — handles Creem webhook events (@creem_io/nextjs)
```

## Purchase Flow (Redirect-based)
1. User taps Subscribe → `CreemBillingProvider.purchase()`
2. Client calls `POST /api/creem/checkout` → Creem API creates checkout session
3. Client redirects to Creem-hosted checkout:
   - Web: `window.location.href`
   - Android: `Browser.open()` via Capacitor Browser plugin
4. User completes payment on Creem's hosted page
5. Creem redirects back to `success_url` (`/premium?session_id={CHECKOUT_SESSION_ID}`)
6. Premium page calls `GET /api/creem/verify-checkout?session_id=…` — server-side `checkouts.retrieve()` confirms `status === 'completed'`, verifies the checkout's `referenceId`/`userId` match the authenticated user (403 on mismatch), and upserts `profiles` via service-role key → premium is granted **immediately** (no waiting for the async webhook).
7. Creem webhook (`/api/creem/webhook`) also updates Supabase as a durable backup and to set `subscription_expiry_date` (`current_period_end_date`) and `purchase_token`.
8. UI refreshes status → shows premium state

## Restore Flow
- `restore()` calls `CreemBillingProvider.restorePurchases()` (re-fetches `/api/creem/subscriptions` from Supabase). If any restored purchase is found it invalidates the cached status and re-reads server status. There is **no** client-side purchase-token verification — Supabase (via webhook/verify-checkout) is the source of truth.

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
- **2026-07-31**: **Bug 38** fix — native purchases now return to the app: `CreemBillingProvider.purchase()` sends `isNative` in the checkout body; `POST /api/creem/checkout` builds a platform-aware `successUrl` — native goes through the new `/api/creem/return` redirect-bridge page (Creem rejects custom-scheme URLs) which bounces to `chessduo://premium?session_id=…`; web keeps `/premium?session_id=…`. Added `SubscriptionService.invalidate()` to clear the 30s status cache — called after checkout verification and after a successful purchase so premium state is reflected immediately. `restore()` already invalidated.
- **2026-07-31**: Bug 36 fix — `SubscriptionService.getApiBase()` and `CreemBillingProvider.API_BASE` now use `getAppBaseUrl()` (inlined `NEXT_PUBLIC_SITE_URL`) instead of `window.location.origin`. In the Capacitor app the origin is the local static server (`https://localhost`), so relative API fetches returned HTML and `res.json()` threw `Unexpected token '<'`. Browser + APK builds now always target the deployed site.
- **2026-07-30**: Verify-on-return flow — new `/api/creem/verify-checkout` endpoint grants premium immediately after checkout redirect (server-side `checkouts.retrieve()` + ownership check + service-role upsert). Premium page reads `session_id` from URL and verifies. Removed dead `verifyPurchase()` from `SubscriptionService` (it POSTed to the deleted `/api/subscription/verify`). `restore()` and `initialize()` now re-read server status instead of verifying tokens client-side. Webhook now sets `subscription_expiry_date` and `current_period_end_date`.
- **2026-07-30**: Migration from Google Play Billing to Creem (MoR). Replaced `GooglePlayBillingProvider` with `CreemBillingProvider`. New API routes: `/api/creem/checkout`, `/api/creem/products`, `/api/creem/subscriptions`, `/api/creem/webhook`. Removed `subscription/verify` and `subscription/rtdn` routes. Simplified `subscription/status` to read from Supabase only. Webhook-driven subscription lifecycle replaces Google Play token verification.
- **2026-07-17**: Fixed subscription 401 on startup — `initialize()` now runs inside `onAuthStateChange` after session is confirmed. `fetchServerStatus()` retries once on 401 to handle transient auth gaps.
