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
| `push/register/route.ts` | Register FCM device token for push notifications |
| `push/send/route.ts` | Send push notification via FCM HTTP v1 API |
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
- Supabase SSR client, `jose` (JWT signing for FCM + Google Play OAuth2)

## Recent Changes
- **2026-07-15**: Replaced Razorpay API routes with Google Play Billing subscription endpoints (`verify`, `status`, `rtdn`). Same jose JWT OAuth2 pattern as push notifications. Removed `razorpay/` directory entirely.
