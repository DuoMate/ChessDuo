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
| `subscription/status/route.ts` | Get subscription status from Supabase |

## Logic & Decisions
- Delete account is idempotent — safe to retry.
- Health check returns 200 with timestamp for monitoring (Cloudflare Workers).
- Push routes use `createServerClient` from `@supabase/ssr` for auth (same pattern as delete-account).
- `/api/push/send` uses FCM HTTP v1 API with JWT assertion via `jose` library (no Firebase Admin SDK needed).
- Subscription lifecycle: Google Play Billing manages subscriptions natively on Android and reports status to the app.

## Dependencies
- Supabase SSR client, `jose` (JWT signing for FCM + Google Play OAuth2), `web-push` (push notifications for browser/web platform)
- `@supabase/supabase-js` (service-role admin client in webhook)

## Recent Changes
- **2026-08-11**: **Creem removal** — removed all `/api/creem/*` routes (checkout, return, products, subscriptions, verify-checkout, webhook). Reverted to Google Play Billing for subscription management. `subscription/status` reads Supabase only.
- **2026-07-17**: Fixed RLS bypass in Bearer token auth path — all API routes now pass the user's JWT to `createClient` via `global.headers.Authorization`, ensuring `auth.uid()` works correctly in RLS policies. Affected routes: `push/register`, `push/send`, `subscription/status`, `subscription/verify`, `delete-account`.
- **2026-07-17**: `/api/push/register` now accepts `platform: 'web'` in addition to `android`/`ios`. `/api/push/send` splits tokens by platform: native tokens use FCM HTTP v1, web tokens use `web-push` with VAPID keys. FCM config is only required when native tokens exist (web-only users work without FCM).
- **2026-07-15**: Replaced Razorpay API routes with Google Play Billing subscription endpoints (`verify`, `status`, `rtdn`). Same jose JWT OAuth2 pattern as push notifications. Removed `razorpay/` directory entirely.
