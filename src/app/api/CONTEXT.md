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

## Logic & Decisions
- Razorpay webhook updates subscription status on `profiles` table.
- Delete account is idempotent — safe to retry.
- Health check returns 200 with timestamp for monitoring (Cloudflare Workers).

## Dependencies
- Supabase Admin client, Razorpay SDK
