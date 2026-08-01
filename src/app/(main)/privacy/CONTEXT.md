# Module: Privacy Policy Page

## Purpose
Static privacy policy page — displays ChessDuo's data handling practices and user rights.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders privacy policy content |

## Logic & Decisions
- Static content — no data fetching.
- Covers: data collected, cookie policy, third-party sharing (Supabase, Cloudflare, Render, Creem), user rights, contact info.
- Contact email in policy.
- Cross-links to Terms of Service (`/terms`). Added as a Creem requirement (Merchant must provide valid Privacy Policy and Terms of Service URLs).
- **2026-08-01**: Added Creem (payment processor) to Third-Party Services; corrected hosting descriptions (Cloudflare edge + Render Stockfish backend); added Terms cross-link.

## Dependencies
- None — pure static page
