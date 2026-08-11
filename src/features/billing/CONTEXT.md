# Module: Billing (Google Play)

## Purpose
Provider-agnostic billing module for ChessDuo premium subscriptions. Android uses Google Play Billing (via Capacitor plugin). Web prompts users to download the Android app. Architecture designed for future provider swaps without changing business logic.

## Files
| File | Purpose |
|------|---------|
| `types.ts` | Shared types: `BillingProvider` interface, `SubscriptionState`, `SubscriptionEvent`, `SubscriptionPlan`, `PurchaseResult`, `SubscriptionInfo` |
| `SubscriptionStateMachine.ts` | Pure function `transition(current, event) → nextState` for subscription lifecycle |
| `GooglePlayBillingProvider.ts` | Google Play Billing integration via `@capgo/native-purchases` Capacitor plugin |
| `SubscriptionService.ts` | High-level API: `initialize()`, `purchaseMonthly()`, `purchaseYearly()`, `restore()`, `isPremium()`, `getPlans()`, `getStatus()`. UI talks only to this — never knows about the provider. |
| `index.ts` | Public API re-exports |
| `__tests__/` | Unit tests for `SubscriptionService` and `GooglePlayBillingProvider` |

## Architecture

```
UI (React Components)
  │  talks ONLY to SubscriptionService
  ▼
SubscriptionService
  │  purchaseMonthly()  purchaseYearly()  restore()  isPremium()  getPlans()
  │
  ├─► BillingProvider (interface)
  │     ├─► GooglePlayBillingProvider  ← Android (now)
  │
  └─► /api/subscription/status (reads from Supabase)
```

## Purchase Flow (Native)
1. User taps Subscribe → `GooglePlayBillingProvider.purchase()`
2. Opens native Google Play Billing dialog via Capacitor plugin
3. User completes payment in Google Play
4. Plugin returns purchase token
5. UI refreshes status → shows premium state

## Web Behavior
- Web users see "Download on Google Play" CTA instead of purchase buttons
- `GooglePlayBillingProvider.isAvailable()` returns `false` on web
- Premium features show upsell/upgrade prompt

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
- `src/app/providers.tsx` — `SubscriptionService.setProvider(GooglePlayBillingProvider)` on mount; `initialize()` on auth sign-in
- `src/app/(main)/premium/page.tsx` — platform detection: native = pricing cards, web = download CTA
- `src/components/InsightsGate.tsx` — `isPremium()`
- `src/components/ProfilePanel.tsx` — `isPremium()`

## Dependencies
- `@capgo/native-purchases` (Android Capacitor plugin, runtime dynamic import)
- `@capacitor/core` (platform detection)
- `@supabase/ssr` (server-side auth)

## Recent Changes
- **2026-08-11**: Removed Creem billing. Restored Google Play Billing as the sole provider. Web users see "Download on Google Play" instead of purchase buttons. Removed all Creem API routes, dependencies (`@creem_io/nextjs`, `creem`), CI secrets, and docs references. GooglePlayBillingProvider types are now local (no `@capgo/native-purchases` build-time dependency).
