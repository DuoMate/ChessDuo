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
- **Verify-on-return**: Creem redirects to `/premium?session_id={CHECKOUT_SESSION_ID}`. The page reads `session_id` from the URL and, if not already premium, calls `verifyCheckoutSession()` → `GET /api/creem/verify-checkout` with a Bearer token. This grants premium immediately after payment without waiting for the async webhook. Falls back to `SubscriptionService.getStatus()` if verification is unavailable.
- "Restore Purchases" button for users switching devices.
- "Secured by Creem" badge for trust.
- All premium checks delegated to `SubscriptionService.isPremium()`.
- **Premium success redesign**: after a successful subscription the page now shows a full success layout ("Welcome to Premium!", checkmark, plan pill, 4 feature icons, "Secured by Creem", and a "Go to Dashboard" CTA bar) styled in the dark theme.

## Dependencies
- `@/features/billing` — `SubscriptionService`, subscription types
- `@/components/ErrorBoundary`, `@/components/ErrorDetailModal`, `@/components/BackButton`

## Recent Changes
- **2026-07-31**: Premium success redesign — active state now displays a full success screen with "Welcome to Premium!", plan pill, feature icons, "Secured by Creem", and a "Go to Dashboard" CTA bar that routes to `/profile`. Kept the existing dark theme instead of the light screenshot reference.
- **2026-07-31**: **Bug 40** fix — after `verifyCheckoutSession()` returns unverified, the page now calls `SubscriptionService.invalidate()` and polls `getStatus()` up to 5× (1.5s apart) so a just-delivered webhook grant (whose event metadata was empty and now resolved via `checkouts.retrieve`) is picked up without a manual reload.
- **2026-07-31**: **Bug 38** fix — after a successful checkout verification (`verifyCheckoutSession`) or a successful purchase (`handleSubscribe`), the page now calls `SubscriptionService.invalidate()` so the 30s cached status can't serve stale `isPremium: false`. On native, checkout returns through the `/api/creem/return` bridge → `chessduo://premium?session_id=…` → this page verifies and shows "You're Premium!".
- **2026-07-30**: Verify-on-return — page now reads `session_id` from the URL after checkout redirect and calls `/api/creem/verify-checkout` to grant premium immediately (no more waiting for the async webhook).
- **2026-07-30**: Migration from Google Play Billing to Creem (MoR). Dynamic pricing now comes from Creem products ($1.99/mo, $14.99/yr). Purchase flow redirects to Creem-hosted checkout instead of the native Google Play dialog. "Managed by Google Play" badge replaced with "Secured by Creem".
