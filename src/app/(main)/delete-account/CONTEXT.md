# Module: Delete Account Page

## Purpose
Account deletion page — allows users to permanently delete their account and associated data.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — deletion confirmation UI |

## Logic & Decisions
- Idempotent deletion RPC — safe to retry on failure.
- Calls POST `/api/delete-account` endpoint.
- Requires re-authentication confirmation.
- Removes Supabase auth user, profiles row, room associations.
- Shows loading, error, and success states.

## Dependencies
- `@/app/api/delete-account/` — server-side deletion handler
