# Module: Premium Pricing Page

## Purpose
Marketing page for ChessDuo premium subscription. Uses Google Play Billing via the provider-agnostic `SubscriptionService`.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders pricing UI with dynamic prices from Google Play |

## Logic & Decisions
- Freemium model: 3 free insights (`INSIGHTS_FREE_LIMIT = 3`), unlimited with subscription.
- Prices fetched dynamically from Google Play via `SubscriptionService.getPlans()` — never hardcoded.
- Skeleton loading state while prices load.
- Purchase flow: `SubscriptionService.purchaseMonthly()` / `purchaseYearly()` → native Google Play dialog.
- "Restore Purchases" button for users switching devices.
- "Managed by Google Play" badge for trust.
- All premium checks delegated to `SubscriptionService.isPremium()`.

## Dependencies
- `@/features/billing` — `SubscriptionService`, subscription types
- `@/components/ErrorBoundary`, `@/components/ErrorDetailModal`, `@/components/BackButton`
