# Module: Premium Pricing Page

## Purpose
Marketing page for ChessDuo premium subscription. Uses Google Play Billing (Android only) via the provider-agnostic `SubscriptionService`. Web users see a "Download on Google Play" CTA since in-app purchases only work on the native Android app.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders pricing UI with dynamic prices from Google Play |

## Logic & Decisions
- Freemium model: 3 free insights (`INSIGHTS_FREE_LIMIT = 3`), unlimited with subscription.
- Prices fetched dynamically from Google Play via `SubscriptionService.getPlans()` — never hardcoded (fallback $1.99/$14.99 only if the API is unreachable).
- Skeleton loading state while prices load.
- **Web**: Shows "Download on Google Play" CTA with app store badge — redirects users to the Play Store since in-app purchases only work in the native Android app.
- **Native (Android)**: Shows Google Play pricing cards with `purchaseMonthly()` / `purchaseYearly()` → opens native Google Play Billing dialog.
- "Restore Purchases" button for users switching devices (uses Google Play's `queryPurchases`).
- All premium checks delegated to `SubscriptionService.isPremium()`.
- **Premium success redesign**: after a successful subscription the page now shows a full success layout ("Welcome to Premium!", checkmark, plan pill, 4 feature icons, and a "Go to Dashboard" CTA bar) styled in the dark theme.

## Dependencies
- `@/features/billing` — `SubscriptionService`, subscription types
- `@/components/ErrorBoundary`, `@/components/ErrorDetailModal`, `@/components/BackButton`

## Recent Changes
- **2026-08-11**: **Creem removal** — reverted to Google Play Billing (Android only). Web page now shows "Download on Google Play" CTA for non-Android visitors. Removed Creem checkout redirect flow, verify-on-return polling, and `creem/return` bridge.
- **2026-08-01**: **Bug 41** fix — the page now re-runs `runLoad()` (status check) when the Capacitor app returns to the foreground after a purchase was initiated (`appStateChange` resume, gated by a `checkoutPendingRef` set in `handleSubscribe`). On mobile the purchase opens the Google Play dialog which may not trigger a direct return to the success state, so re-checking on resume ensures the user sees "You're Premium!".
- **2026-07-31**: Premium success redesign — active state now displays a full success screen with "Welcome to Premium!", plan pill, feature icons, and a "Go to Dashboard" CTA bar that routes to `/profile`. Kept the existing dark theme instead of the light screenshot reference.
- **2026-07-31**: **Bug 40** fix — after checkout verification, the page now calls `SubscriptionService.invalidate()` and polls `getStatus()` up to 5× (1.5s apart) so a just-delivered subscription grant is picked up without a manual reload.
- **2026-07-31**: **Bug 38** fix — after a successful checkout verification or purchase, the page now calls `SubscriptionService.invalidate()` so the cached status can't serve stale `isPremium: false`.
- **2026-07-30**: Google Play Billing migration — replaced Creem MoR with native Google Play Billing for Android. Dynamic pricing now comes from Google Play products ($1.99/mo, $14.99/yr). Purchase flow uses the native Google Play Billing dialog instead of hosted checkout.
