# Module: API Routes

## Purpose
Next.js API route handlers for server-side operations (health checks, payments, account management).

## Files at This Level
| File | Purpose |
|------|---------|
| `healthz/route.ts` | Health check endpoint |
| `log-crash/route.ts` | Client-side crash report ingestion |
| `razorpay/route.ts` | Razorpay subscription creation + webhook |
| `delete-account/route.ts` | Account deletion RPC |
| `test-supabase/route.ts` | Supabase connectivity test |
| `push/register/route.ts` | Register FCM device token for push notifications |
| `push/send/route.ts` | Send push notification via FCM HTTP v1 API |

## Logic & Decisions
- Razorpay webhook updates subscription status on `profiles` table.
- Delete account is idempotent — safe to retry.
- Health check returns 200 with timestamp for monitoring (Cloudflare Workers).
- Push routes use `createServerClient` from `@supabase/ssr` for auth (same pattern as delete-account).
- `/api/push/send` uses FCM HTTP v1 API with JWT assertion via `jose` library (no Firebase Admin SDK needed).
- OAuth2 token is cached in memory to avoid repeated JWT exchanges per request.
- Push routes are rate-limited: register 30/min, send 60/min (via `applyRateLimit()`).

## Dependencies
- Supabase Admin client, Razorpay SDK, `jose` (JWT signing for FCM)

## Recent Changes
- **2026-07-14**: Added rate limiting to push routes (`/api/push/register` 30/min, `/api/push/send` 60/min).
