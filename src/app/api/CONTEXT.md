# Module: API Routes

## Purpose
Next.js API route handlers for server-side operations (health checks, billing, account management, push notifications).

## Files at This Level
| File | Purpose |
|------|---------|
| `healthz/route.ts` | Health check endpoint |
| `log-crash/route.ts` | Client-side crash report ingestion |
| `delete-account/route.ts` | Account deletion RPC |
| `test-supabase/route.ts` | Supabase connectivity test |
| `push/register/route.ts` | Register device token for push (accepts `android`, `ios`, `web` platforms) |
| `push/send/route.ts` | Send push notification — FCM for native, web-push for browser |
| `creem/checkout/route.ts` | Create Creem checkout session → returns `checkoutUrl` (native uses `/api/creem/return` success URL) |
| `creem/return/route.ts` | GET redirect-bridge for native checkout returns — bounces `session_id` to `chessduo://premium` |
| `creem/products/route.ts` | Fetch product details (pricing) from Creem |
| `creem/subscriptions/route.ts` | List active subscriptions from Supabase (restore) |
| `creem/verify-checkout/route.ts` | Verify completed checkout after redirect → grants premium via service-role upsert |
| `creem/webhook/route.ts` | Creem webhook handler (`@creem_io/nextjs` Webhook) → updates Supabase |
| `subscription/status/route.ts` | Get subscription status from Supabase |

## Logic & Decisions
- Delete account is idempotent — safe to retry.
- Health check returns 200 with timestamp for monitoring (Cloudflare Workers).
- Push routes use `createServerClient` from `@supabase/ssr` for auth (same pattern as delete-account).
- `/api/push/send` uses FCM HTTP v1 API with JWT assertion via `jose` library (no Firebase Admin SDK needed).
- Creem routes use the `creem` TypeScript SDK; test mode is auto-detected when `CREEM_API_KEY` starts with `creem_test_` (server `test` vs `prod`).
- Subscription lifecycle is **webhook-driven**: `creem/webhook` grants/revokes access and updates `profiles` via the Supabase service-role key. `subscription/status` reads Supabase only — no re-verification call.
- `creem/verify-checkout` provides **immediate grant** on checkout redirect: server-side `checkouts.retrieve()` confirms `status === 'completed'`, then the checkout `metadata.referenceId`/`userId` must equal the authenticated user's ID (else 403 — prevents one user's paid session from granting another). Grants premium via service-role upsert so the user doesn't wait for the async webhook.
- Checkout metadata carries `userId`, `referenceId`, and `plan` so webhooks can attribute events to a ChessDuo profile.
- Creem pricing is returned in cents; the client formats `$X.XX`.

## Dependencies
- Supabase SSR client, `jose` (JWT signing for FCM + Google Play OAuth2), `web-push` (push notifications for browser/web platform)
- `creem` (server SDK), `@creem_io/nextjs` (webhook verification handler)
- `@supabase/supabase-js` (service-role admin client in webhook)

## Recent Changes
- **2026-07-31**: **Bug 38** fix — `creem/checkout` now accepts `isNative` and sets the native success URL to `/api/creem/return` (a redirect-bridge that bounces to the `chessduo://` deep link, since Creem rejects custom-scheme success URLs). Added `creem/return` route (GET, public) — serves an HTML meta-refresh page redirecting `session_id` into the app.
- **2026-07-30**: Added `creem/verify-checkout` — verifies a completed Creem checkout on redirect and immediately grants premium (ownership check via `referenceId`/`userId`, service-role upsert). Webhook hardened: sets `subscription_expiry_date` from `current_period_end_date` and `purchase_token` from checkout `id`. Rate limits added for all `/api/creem/*` routes.
- **2026-07-30**: Creem billing migration — added `/api/creem/*` routes (checkout, products, subscriptions, webhook). Removed `subscription/verify` (Google Play token verification) and `subscription/rtdn` (RTDN placeholder). `subscription/status` simplified to read from Supabase only. Webhook-driven lifecycle replaces Google Play Developer API verification.
- **2026-07-17**: Fixed RLS bypass in Bearer token auth path — all API routes now pass the user's JWT to `createClient` via `global.headers.Authorization`, ensuring `auth.uid()` works correctly in RLS policies. Affected routes: `push/register`, `push/send`, `subscription/status`, `subscription/verify`, `delete-account`.
- **2026-07-17**: `/api/push/register` now accepts `platform: 'web'` in addition to `android`/`ios`. `/api/push/send` splits tokens by platform: native tokens use FCM HTTP v1, web tokens use `web-push` with VAPID keys. FCM config is only required when native tokens exist (web-only users work without FCM).
- **2026-07-15**: Replaced Razorpay API routes with Google Play Billing subscription endpoints (`verify`, `status`, `rtdn`). Same jose JWT OAuth2 pattern as push notifications. Removed `razorpay/` directory entirely.
