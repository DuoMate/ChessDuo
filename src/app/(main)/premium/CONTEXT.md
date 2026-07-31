# Module: Premium Pricing Page

## Purpose
Marketing page for ChessDuo premium subscription. Uses Creem (Merchant of Record) via the provider-agnostic `SubscriptionService`.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders pricing UI with dynamic prices from Creem |

## Logic & Decisions
- Freemium model: 3 free insights (`INSIGHTS_FREE_LIMIT = 3`), unlimited with subscription.
- Prices fetched dynamically from Creem via `SubscriptionService.getPlans()` — never hardcoded (fallback $1.99/$14.99 only if the API is unreachable).
- Skeleton loading state while prices load.
- Purchase flow: `SubscriptionService.purchaseMonthly()` / `purchaseYearly()` → redirect to Creem-hosted checkout (in-app browser on Android, new tab on web).
- "Restore Purchases" button for users switching devices.
- "Secured by Creem" badge for trust.
- All premium checks delegated to `SubscriptionService.isPremium()`.

## Dependencies
- `@/features/billing` — `SubscriptionService`, subscription types
- `@/components/ErrorBoundary`, `@/components/ErrorDetailModal`, `@/components/BackButton`

## Recent Changes
- **2026-07-30**: Migration from Google Play Billing to Creem (MoR). Dynamic pricing now comes from Creem products ($1.99/mo, $14.99/yr). Purchase flow redirects to Creem-hosted checkout instead of the native Google Play dialog. "Managed by Google Play" badge replaced with "Secured by Creem".
