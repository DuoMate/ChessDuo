# Module: Terms of Service Page

## Purpose
Static terms of service page — displays ChessDuo's terms of use, premium subscription terms (Google Play Billing), and user obligations.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders terms of service content |

## Logic & Decisions
- Static content — no data fetching.
- Covers: acceptance, service description, accounts (13+), premium subscription (Google Play Billing, auto-renewal, cancellation), user conduct, intellectual property, disclaimers, liability limits, termination, changes, contact.
- Contact email matches privacy policy.
- Added as a Google Play requirement (Merchant must provide valid Privacy Policy and Terms of Service URLs).

## Dependencies
- None — pure static page
