# Business Rules

## Platform Model

- **Fixed-slot exchange**: Each publisher gets 10 slots/month at their own rate.
- **9+1 split**: 9 slots sold to advertisers, 1 slot (#10) reserved for AdFounder self-promotion.
- **0% commission**: Platform earns nothing on transactions. Growth engine is the 1/10 reserved slot.
- **Every user is both publisher and advertiser** (role: `BOTH`). The network treats them as the same person.

## Signup & Onboarding

- New users receive **1,000 signup bonus credits**.
- Firebase Auth handles identity (email/password + Google OAuth).
- Every user gets an empty wallet on creation.

## Widget & Verification

- **Widget is dual-purpose**: ad delivery + traffic verification.
- **7-day verification cycle**: 1 week of real traffic data before a placement is listed publicly.
- During verification: network ads run, founder earns credits, but pricing/metrics are hidden from advertisers.
- After verification: placement is `verified`, metrics are published, slots become bookable.
- Widget installation is independent from verification — a site can have the widget active but placements still measuring.

## Inventory & Placements

- **Ad space = one specific page** (not a URL pattern). Each placement gets its own verification cycle.
- A site can have multiple placements across different pages.
- `Site.widgetActive` (widget heartbeat confirmed) is independent from `WidgetPlacement.verified` (traffic verified per page).

## Site & Ad Space Creation

- No crawler. Publisher manually enters each page URL.
- Widget is auto-generated when first ad space is created per site.
- One widget per site — all ad spaces on a site share the same widget.

## Ad Delivery & Rotation

- **Priority order**: Paid Ads > Platform Ad (Slot #10) > Network Ads.
- Paid ads use round-robin distribution for fairness.
- Network ads are selected from the pool of all active network campaigns.
- Exclusion rules are always respected — no ads on blocked pages.
- Ads must be served in <100ms to not degrade the host site.

## Credit Economy

- Credits have **no cash value** and are **non-transferable** between accounts.
- Credits expire after **90 days** of inactivity.
- **Credits-first spending**: credits consumed before wallet balance.
- UI always shows both balances: "Credits: 2,400 | Wallet: $120".
- Credit earning events: signup bonus, hosting network ads, referrals, onboarding milestones.
- Credit spending events: running network ads, boosting visibility.

## Revenue & Payouts

- Publishers receive **100% of their asking price** — platform takes no cut.
- Payouts require a minimum balance threshold.
- Revenue model phases:
  - **Phase 1**: Widget placement limits, slot packs, Slot #10 buyback
  - **Phase 2**: Premium verification, featured listings
  - **Phase 3**: Advertiser intelligence, Founders Club, sponsored categories

## Slot Buyback (#10)

- Publishers can reclaim Slot #10 for a monthly fee.
- Pricing tiers based on publisher earnings: Small ($9/mo), Growing ($29/mo), Large ($99/mo).
- Buyback is recurring monthly unless cancelled.
- When reclaimed, Slot #10 becomes a regular sellable slot.

## Ad Creatives

- Ad creatives (logo, name, headline, URL, CTA) are reusable across bookings.
- Creative changes apply at the booking level — existing bookings keep their creative snapshot.
- Each AdCreative is linked to a `siteId` (one site owns the creative). Category is derived from the owning site.
- At campaign creation, the ad URL's domain must match a registered site the user owns. `advertiserCategory` is derived from the matched site.

## Booking & Cancellation

- Slots are locked on booking — double-booking is prevented.
- Ad creative changes propagate immediately (cached with short TTL).

### DIRECT Campaigns (wallet, paid)
- **Wallet charged in full** on activation: full budget deducted from `walletBalance` and moved to `walletAllocated`.
- **No refund** for the current 30-day period on cancel.
- **Pro-rata refund** for future (unstarted) months on cancel — refund goes back to `walletBalance` minus `walletAllocated` decrement.
- **Pre-check at activation**: validates advertiser's `advertiserCategory` (from the advertiser's Site) against the publisher placement's `excludedCats` and `competitorSites`. Blocked if conflict.
- **Snapshot**: placement rules (`allowedCats`, `excludedCats`, `competitorSites`) are snapshotted onto the Campaign at activation. Publisher changing rules later does not affect existing bookings.
  - `monthsUsed = max(1, ceil(elapsedDays / 30))`
  - `refund = totalBudget - (monthlyPrice × monthsUsed)`
  - Example: 3-month campaign at $100/mo, cancelled day 45 → 2 months used, 1 month ($100) refunded.

### NETWORK Campaigns (credits)
- **Upfront credit allocation**: On activation, full budget deducted from `credits` and moved to `creditsAllocated`. Per-impression debits draw from `creditsAllocated`.
- **Per-impression pricing**: 0.01 credit debited from `creditsAllocated` per impression.
- **Publisher earns** 0.01 credit per impression in real-time (credited to `credits`).
- Transactions logged as `DEBIT` (advertiser) and `EARNINGS` (publisher).
- `totalSpend` increments by 0.01 per impression.

## Widget Delivery & Ad Serving

- **Public endpoints**: `/api/widget/*` requires no Firebase auth — called from publisher-hosted widget script on third-party sites.
- **Heartbeat**: `POST /api/widget/:id/heartbeat` sets `site.widgetActive = true` and `widgetActiveAt`. Called on every page load where widget is present.
- **Ad selection priority**: DIRECT (booked slot campaigns) > NETWORK (scored rotation).
- **Rotation scoring (NETWORK)**: `(1 - spend/budget) * 1/(impressions + 1)`. Favors campaigns with remaining budget that have been under-delivered. Campaigns matching placement's `allowedCats` (preferred) get 1.5× score boost.
- **Category matching rules**:
  - Placement `allowedCats` = preferred (green) — score boost, not hard filter.
  - Placement `excludedCats` = blocked (red) — hard filter, never show.
  - Campaign `allowedCats` = targeting — only show on placements whose site category is in this list.
  - Campaign `excludedCats` = avoidance — never show on placements whose site category is in this list.
  - `competitorSites` (blocked domains) on placement → never show campaigns whose `adUrl` domain matches any listed domain.
  - `networkEnabled` on placement must be `true` for NETWORK ads.
- **DIRECT activation pre-check**: At activation time, system validates campaign categories against placement's exclusion rules and blocked domains list. Blocks activation if conflict.
- **Impression tracking**: `POST /api/widget/:id/impression` records the event. For NETWORK: 0.01 credit debited from advertiser, 0.01 credited to publisher in real-time.
- **Click tracking**: `POST /api/widget/:id/click` records click against latest campaign impression. No redirect-through — widget handles navigation client-side.
- **Auto-pause**: Campaign status set to `COMPLETED` when `totalSpend >= totalBudget`.
- **Daily limit**: Campaigns with `dailyLimit > 0` skip serving once today's impressions reach the limit.
- **No rate limiting** currently implemented on widget endpoints.
- **Dispute flag**: Campaigns with `disputed = true` are excluded from ad selection entirely.
- **Blocked sites (competitor domains)**: Publishers list domains in `competitorSites` per placement. Ads whose `adUrl` domain matches any listed domain are excluded from that placement.

## Slots

- **10 slots per site per month**, slotNumber 1-10.
- Slot #10 (`isPlatformSlot: true`) reserved for AdFounder self-promotion.
- Slots auto-created on site creation with default rate of 50.
- Unique constraint: `@@unique([siteId, month, year, slotNumber])`.
- DIRECT campaigns book a slot — marks `isBooked = true` for that month.

## Protected Pages

- Ads never displayed on: checkout, billing, payment, upgrade, admin, account settings, login, privacy policy, terms of service.

## Credit Expiry
- Credits expire after 90 days of inactivity (tracked via `lastActivityAt` on User).
- `lastActivityAt` updated on: signup, credit spending (NETWORK activation, impression debit), credit earning (impression earnings, referral bonus).
- Expired credits are zeroed out with a `CREDIT_EXPIRY` Transaction record. Checked on every `/api/auth/me` call.
- Credits with no expiry check yet: manual deposit admin, signup bonus (covered by initial `lastActivityAt`).

## Payments (Airwallex)

### Deposits
- Deposits create an Airwallex Payment Intent (sandbox: `x-api-key` + `x-client-id` headers for auth, not Basic auth).
- Amount is in **major units** (dollars, not cents). Currency in **uppercase** (USD, not usd).
- `request_id` (UUID) is required in the body for idempotency.
- `simulate: "success"|"fail"` bypasses Airwallex for testing.
- On success, wallet is credited the full deposit amount. Airwallex fees (`providerFee`, `netAmount`) are recorded as info only via webhook.
- On dispute, wallet is debited (if sufficient), associated campaigns cancelled, publisher earnings CANCELLED.

### Payouts
- **Idempotent**: DB record created with `idempotencyKey` before Airwallex API call. Retries reuse same key.
- Publisher must connect a ledger account first (`POST /api/payouts/connect-account`).
- Minimum payout amount: `PAYOUT_MINIMUM_AMOUNT` env var (default $10).
- Wallet balance checked before payout. Deducted immediately on request.
- Payout status tracked via webhooks (`payout.completed`, `payout.failed`).

### Publisher Earnings
- Created on DIRECT campaign activation with status `HELD` and `holdUntil = endDate + 30 days`.
- Released via `POST /api/payouts/release-earnings` when `holdUntil` is past.
- On cancellation: full refund before start → earning `CANCELLED`. Pro-rata refund mid-month → earning amount reduced.
- All earnings are time-based (per month booked), not per-impression.

### Account Reconciliation
- `GET /api/transactions/:id/verify` checks transaction against Airwallex actual status.

## Referrals
- Each user gets a unique 6-char alphanumeric referral code on creation.
- Referral link format: `/login?ref=CODE` (direct share, **500 credits**) or embedded in Slot #10 "Advertise on Us" ad as `/login?af_ref=CODE` (**200 credits**).
- Auth store passes `?ref=` or `?af_ref=` to `/api/auth/me` on user creation. `af_ref` sets `referralSource = 'PLATFORM_AD'`.
- Self-referrals blocked: referrer email must differ from new user email.
- Referral bonus awarded to referrer only after referred user activates (first widget heartbeat). Bonus amount depends on `referralSource`: 500 for DIRECT, 200 for PLATFORM_AD.
- `referralActivatedAt` set on referred user when `widgetActive` transitions from false to true.
- Referral dashboard at `/dashboard/referrals` shows link, stats, referral list with source labels, and Slot #10 info section.
- Slot #10 ad is served when no DIRECT or NETWORK ads are available. Destination URL includes `?af_ref=PUBLISHER_CODE`.

## Recent Changes
- `2026-06-24`: Added Airwallex payment system rules — deposits (Payment Intents, major units, simulate mode), payouts (idempotent with DB-first record), publisher earnings (HELD, 30d hold, released after holdUntil), dispute recovery, account reconciliation.
- `2026-06-21`: Added privacy policy (`/privacy`) and terms & conditions (`/terms`) pages with footer links. Privacy email: team@sociallyx.com. Terms governed by Indian law, arbitration in Bangalore.
- `2026-06-21`: Added Widget Delivery & Ad Serving rules (public endpoints, heartbeat, ad selection priority, rotation scoring, impression/click tracking, exclusion rules).
- `2026-06-21`: Added Slot rules (10 per month, slotNumber 1-10, #10 = platform, auto-created on site setup).
- `2026-06-21`: Budget allocation model — walletAllocated/creditsAllocated on User. DIRECT/ NETWORK activation moves budget to allocated. Impressions debit from allocated. Cancellation refunds to main balance.
- `2026-06-21`: Added dispute flag. Disputed campaigns excluded from ad selection. Blocked sites via competitorSites on placement (domains are excluded from that placement).
- `2026-06-21`: AdCreative linked to siteId; destination URL domain validation at campaign creation; advertiserCategory derived from matched site.
- `2026-06-21`: Credit expiry (90-day inactivity check on `/me`). Referral system (codes, widget-activation bonus, dashboard). `lastActivityAt` tracking on credit events.
- `2026-06-21`: Slot #10 "Advertise on Us" ad serving with publisher referral code. Dual referral bonus tiers: 500 (DIRECT share) / 200 (PLATFORM_AD via Slot #10). `referralSource` field on User.
