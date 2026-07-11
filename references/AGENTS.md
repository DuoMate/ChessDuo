# AdFounder

## Context
Business rules live in `CONTEXT/RULES.md`. Design system lives in `CONTEXT/DESIGN.md`. Flow specs live in `docs/*.md`. Behavioral guidelines in `CLAUDE.md`.

## Stack
npm workspaces. SvelteKit v2 + Svelte 5 runes (`apps/web`), Hono v4 (`apps/api`), PostgreSQL 18 + Prisma v6, Firebase Auth (client SDK + Admin SDK). Vercel (web), Cloudflare Workers (api).

## Architecture

```
adfounder/
├── apps/
│   ├── api/         # Hono backend (src/index.ts — mounts /api/auth, /api/sites, /api/placements, /api/ads, /api/bookings, /api/campaigns)
│   ├── web/         # SvelteKit frontend (port 5173, proxies /api → localhost:3001)
│   │               # Nav: Dashboard | Host Ads | Campaigns | Market | Ad Formats. Sites = supporting (sidebar footer).
│   │               # Campaigns page: My Campaigns list + My Ads (create/manage ad creatives + start new campaigns)
│   │               # Market page: Available Inventory grid (all placements with scope=all) + Start Campaign CTAs
│   └── reference/   # Archived Next.js v1 CPM model — DO NOT MODIFY
├── CONTEXT/         # Business rules (RULES.md) + design system (DESIGN.md)
├── docs/            # Flow specs, product brief, revenue model, campaign system
└── packages/shared/ # PLATFORM_VERSION, AD_FORMATS, SITE_CATEGORIES, constants
```

## Data Model

Key entities:
- **User** — firebaseUid, email, credits, walletBalance, role (always BOTH)
- **Site** — publisher's domain, category, widgetActive status
- **Widget** — one per site, format hardcoded to `logo_name_subtitle_rail`
- **WidgetPlacement** (ad space) — one per page URL, has price, networkEnabled, category rules, competitor exclusions
- **AdCreative** — reusable ad creative (name, headline, url, imageUrl, ctaText); can point to any URL
- **Slot** — site-level monthly slot (10 per site, #10 reserved for platform)
- **Booking** — links AdCreative + Slot + User as advertiser
- **Favorite** — user's bookmarked placements and/or sites (optional `placementId`/`siteId`, unique constraints on both `[userId, placementId]` and `[userId, siteId]`)
- **Campaign** — one ad space + one creative (snapshotted) + totalBudget + dailyLimit + schedule. Types: DIRECT (paid, wallet) and NETWORK (credit-based, no placement). Status lifecycle: DRAFT → ACTIVE → PAUSED → COMPLETED/CANCELLED. NETWORK campaigns also store `allowedCats`/`excludedCats` for category targeting.
- **Impression** / **Click** — per-placement tracking
- **Transaction** — wallet/credit ledger (extended with `currency`, `externalId`, `providerFee`, `netAmount`, `metadata` for Airwallex)
- **Payout** — links User + amount + payoutAccountId, tracks status (PENDING/PROCESSING/COMPLETED/FAILED), idempotent via `@@unique([externalId])` + `idempotencyKey`
- **PublisherEarning** — per-campaign per-month earning record (HELD, 30-day hold from endDate, released to wallet)
- **Subscription** — Slot #10 buyback recurring billing (reserved for future use)

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | `concurrently` runs both API + web |
| `npm run dev:api` | `node --env-file=.env --import tsx/esm --watch src/index.ts` in `apps/api` (auto-restart) |
| `npm run dev:web` | `vite dev` in `apps/web` (port 5173) |
| `npm run build` | builds `packages/shared` → `apps/api` → `apps/web` |
| `npm run db:push` | `prisma db push` — apply schema (PostgreSQL must be running) |
| `npm run db:generate` | `prisma generate` after schema changes |

Init before first dev: `npm run db:generate` + `npx -w apps/web svelte-kit sync`.

## Coding Conventions

- **Svelte 5 files (`.svelte`)**: no TypeScript syntax at all — parser limitation. No `$state<string>("")`, no `fn(p: string)`, no return types. Use plain JS. Typed logic goes in `.svelte.ts` modules.
- **Icons**: `svelte-lucide` only — no inline SVGs. Pass `size` as string (`size="20"`), not number.
- **Styling**: plain CSS via `app.css` (dark-first, `#22c55e` green accent, Inter + JetBrains Mono). No Tailwind.
- **Mobile-first**: all dashboard pages must work on <640px before desktop.
- **Nav `ref` param**: when linking to `/dashboard/adspaces/[id]`, pass `?ref=campaigns` (from Campaigns/Market) or `?ref=host` (from Host Ads/Sites) so the sidebar highlights the correct tab.
- **Campaign creative snapshot**: `AdCreative` fields are copied into the campaign on creation. Editing the source `AdCreative` later does not affect existing campaigns — they store their own copy.

## Development

- **PostgreSQL**: runs as Windows service `postgresql-x64-18`. Must be started before `db:push` or `dev:api`.
- **Env files**: `.env*` is gitignored. Each app has `.env.example` as reference. API needs `DATABASE_URL` + Firebase Admin creds. Web needs `VITE_FIREBASE_*` vars.
- **No test framework** configured. No formatter config. Lint = `tsc --noEmit` only.
- **Vite proxy**: `/api` requests from web are forwarded to `localhost:3001`. No CORS issues in dev.
- **Prisma EPERM**: `prisma generate` may fail with EPERM on Windows (file lock on `query_engine-windows.dll.node`). Retry or kill node processes.
- **Campaign system details**: see `docs/campaign-system.md` for full spec on types, lifecycle, snapshot model, and data flow.

## Critical Context

- API dev command: `node --env-file=.env --import tsx/esm --watch src/index.ts` — `--env-file` required to load Firebase credentials before any code runs.
- Svelte 5 parser rejects TypeScript syntax in `.svelte` files — use plain JS, typed logic in `.svelte.ts` modules.
- When navigating to `/dashboard/adspaces/[id]`, always pass `?ref=campaigns` or `?ref=host` to highlight the correct sidebar tab.
- `svelte-lucide` v2 may not export all icons — check available exports before using. `BarChart3` is NOT exported; use `Gauge` or `TrendingUp`.
- **Airwallex sandbox auth**: Uses `x-api-key` + `x-client-id` headers (NOT Basic auth). TODO: update headers when switching to production.
- **Payout API**: Uses `POST /api/v1/transfers/create` with inline beneficiary details (NOT `/payouts/create` which is 404, NOT `/accounts/create` which needs full KYC). Amount in major units.
- **Payment Intents**: Amount in major units (dollars, not cents). Currency uppercase. `request_id` required in body.
- **Payout idempotency**: DB record created with `idempotencyKey` before Airwallex API call. Retry-safe.
- **Publisher earnings**: Created HELD on DIRECT activation, 30-day hold from endDate. Released via `POST /api/payouts/release-earnings`.
- **Simulate mode**: `simulate: "success"|"fail"` bypasses Airwallex for testing (no real Payment Intents needed).
- **Real Payment Intents blocked** in sandbox — Payments product not enabled on self-serve demo accounts.

## Context System

See `CONTEXT-SYSTEM.md` for full spec. In short:

- Module-level `CONTEXT.md` files live alongside business logic directories.
- Read `<dir>/CONTEXT.md` before reading or editing files in that directory.
- Walk the hierarchy: `CONTEXT/RULES.md` (global) → `apps/*/CONTEXT.md` (module) → deeper submodules.
- After making changes, update the relevant `CONTEXT.md` (at minimum: Recent Changes entry).

## Archived Reference
`apps/reference/` is the old Next.js CPM model. Do not modify. Its Prisma schema documents the v1 data model for reference only.
