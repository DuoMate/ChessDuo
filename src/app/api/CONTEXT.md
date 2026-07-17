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
| `subscription/verify/route.ts` | Verify Google Play purchase token → update Supabase |
| `subscription/status/route.ts` | Get subscription status, re-verify with Google when needed |
| `subscription/rtdn/route.ts` | RTDN webhook placeholder (future push-based updates) |

## Logic & Decisions
- Delete account is idempotent — safe to retry.
- Health check returns 200 with timestamp for monitoring (Cloudflare Workers).
- Push routes use `createServerClient` from `@supabase/ssr` for auth (same pattern as delete-account).
- `/api/push/send` uses FCM HTTP v1 API with JWT assertion via `jose` library (no Firebase Admin SDK needed).
- Subscription routes use the same OAuth2 JWT pattern for Google Play Developer API.
- OAuth2 token is cached in memory to avoid repeated JWT exchanges per request.
- Subscription routes are rate-limited: verify 30/min, status 60/min (via `applyRateLimit()`).

## Dependencies
- Supabase SSR client, `jose` (JWT signing for FCM + Google Play OAuth2), `web-push` (push notifications for browser/web platform)

## Recent Changes
- **2026-07-17**: `/api/push/register` now accepts `platform: 'web'` in addition to `android`/`ios`. `/api/push/send` splits tokens by platform: native tokens use FCM HTTP v1, web tokens use `web-push` with VAPID keys. FCM config is only required when native tokens exist (web-only users work without FCM).
- **2026-07-15**: Replaced Razorpay API routes with Google Play Billing subscription endpoints (`verify`, `status`, `rtdn`). Same jose JWT OAuth2 pattern as push notifications. Removed `razorpay/` directory entirely.
