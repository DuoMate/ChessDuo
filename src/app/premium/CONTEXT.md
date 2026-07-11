# Module: Premium Pricing Page

## Purpose
Marketing page for ChessDuo premium subscription. Handles Razorpay checkout flow.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders InsightsGate and pricing UI |

## Logic & Decisions
- Freemium model: 3 free insights (`INSIGHTS_FREE_LIMIT = 3`), unlimited with subscription.
- Razorpay subscription creation via `/api/razorpay` endpoints.
- Subscription status tracked on `profiles` table.
- Webhook handler updates subscription status server-side.

## Dependencies
- `@/components/InsightsGate` — premium feature gate
- `@/lib/razorpay` — payment client
- `@/app/api/razorpay/` — subscription API
