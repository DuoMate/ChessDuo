# ChessDuo Theme Audit — Light / Dark / Duo Design System

Branch: `UI-UX-refactoring` · Date: 2026-09-17 · Companion: `docs/ui-revamp-audit.md`.

Goal: ONE PRODUCT · ONE DESIGN LANGUAGE · TWO THEMES. Preserve blue + white identity
and the existing `.dark`-class theme mechanism; refine into a professional semantic system.
Do not invert light mode to make dark mode — each theme individually balanced.

## 1. Existing light theme (`:root`, `globals.css:5-25`)

| Token | Value | Notes |
|---|---|---|
| `page-bg` | `#f4f6fb` | App background |
| `page-fg` | `#111827` | Primary text |
| `surface` | `rgba(255,255,255,0.82)` | Glass card |
| `surface-strong` | `#ffffff` | Solid card |
| `surface-hover` | `#eef2ff` | Hover wash |
| `border` | `rgba(148,163,184,0.28)` | Default border |
| `muted` | `#64748b` | Secondary text |
| `muted-bg` | `rgba(248,250,252,0.95)` | Alt surface |
| `input-bg` | `rgba(255,255,255,0.86)` | Inputs |
| `primary` | `#f59e0b` amber | Brand accent (NOT blue today) |
| `primary-strong` | `#d97706` | Active/hover |
| `secondary` | `#6366f1` indigo | Secondary brand |
| `success` | `#10b981` | Success |
| `danger` | `#ef4444` | Error |
| `page-bg-alt` / `surface-alt` | `#eef2ff` / `#f4f6fb` | Alt backgrounds |
| `shadow` | `rgba(15,23,42,0.12)` | Elevation color |

Body: dual radial amber/indigo washes over `page-bg`; `::selection` amber 28%.
Reads clean but CTAs/cards diverge per screen (see §5).

## 2. Existing dark theme (`.dark`, `globals.css:27-47`)

| Token | Value | Notes |
|---|---|---|
| `page-bg` | `#0a0e1a` | Deep navy (NOT pure black — good) |
| `page-fg` | `#f8fafc` | Primary text |
| `surface` | `rgba(15,23,42,0.8)` | Glass card |
| `surface-strong` | `#0f172a` | Solid card |
| `surface-hover` | `#1e293b` | Hover |
| `border` | `rgba(255,255,255,0.06)` | Subtle border (borders > shadows in dark) |
| `muted` | `#94a3b8` | Secondary text |
| `muted-bg` | `rgba(15,23,42,0.9)` | Alt surface |
| `input-bg` | `rgba(15,23,42,0.85)` | Inputs |
| `primary` | `#fbbf24` | Amber, lightened for dark |
| `primary-strong` | `#f59e0b` | |
| `secondary` | `#3b82f6` blue | (light was indigo — intentional shift) |
| `success` | `#22c55e` | |
| `danger` | `#fb7185` | Rose, softened for dark |
| `danger-hover` | `#f43f5e` | |
| `page-bg-alt` / `surface-alt` | `#0f1119` / `#0f1525` | |
| `shadow` | `rgba(2,6,23,0.45)` | |

Dedicated dark (not inverted): correct approach. Board (`#ecdab9/#c5a076`) stays dominant.
Risk: many panels are dark-only (no `dark:` = base dark classes), so they break in light mode.

## 3. Existing Duo colors

| Context | Team A | Team B | Source |
|---|---|---|---|
| Game (canonical) | BLUE `#3b82f6→#2563eb`, ring `blue-500/70` | PURPLE `#a855f7→#7c3aed`, ring `purple-500/70` | `BoardTopBar:60-68`, `TeamHexagon:13-14` |
| Turn pill | `blue-400/10, blue-600/300` ♔ | `purple-400/10, purple-600/300` ♚ | `BoardTopBar:265-270` |
| Onboarding | GREEN `green-500/90` (You) | VIOLET `violet-500/90` (partner) | `WelcomeDisclaimer:164-186` |
| Board markers (onboarding) | GREEN frame `#22c55e` (Your Move) | VIOLET `#8b5cf6` fill+frame (Teammate) | `globals.css:111-125` |
| Team timers | YELLOW/amber | ROSE/red | `TeamTimer:16-19` |
| Winner/loser (AI-selected vs rejected) | EMERALD `emerald-500` | ROSE `rose-500` | `MoveComparison`, `AccuracyBottomSheet`, `MoveResolvedInline` |

**Recommendation (per owner: recommend in audit):** codify live BLUE vs PURPLE as canonical
Duo pair (it's the real game path); migrate onboarding/markers/timers to the same pair in the
revamp. Blue + white brand remains the product identity; Duo pair is a game-semantic layer
inside it, always paired with icon + label + position (never color alone).

## 4. Existing shared colors

Only consistent family: `Toast.tsx:99-102` — info sky / success emerald / warning amber /
error rose, each with light + dark variants. This is the reference pattern for all status color.

## 5. Existing inconsistent colors

* CTAs: amber→orange gradient vs blue→cyan gradient vs solid blue vs emerald — same rank,
  different color per screen.
* Premium: amber/gold vs emerald vs blue across `premium/page`, `InsightsGate`, `GameOverModal`,
  `InitialsAvatar`, `ProfilePanel`.
* Chat own-message yellow vs insights emerald/blue/rose — yellow also means warning elsewhere.
* Move-list yellow vs eval-bar greens/yellows/reds — same hue, different meaning.
* `TeamHexagon` hex constants, `AccuracyBottomSheet` gradients, `ChessBoard` `#ff4444/#cc0000`
  bypass the token system.
* Check/checkmate have NO square color (sound only) — needs a distinguishable, board-legible
  treatment in both themes.

## 6. Existing component inconsistencies

See `ui-revamp-audit.md` §5 + evidence (radius/buttons/cards/modals/badges/tabs/timers/type/
shadows/borders/hex/`style` statics). Headline: no radius scale, no single primary button,
dark-only panels, 4 timers, 4 navs, missing `focus-visible:`.

## 7. Proposed semantic color roles (names; values set at token checkpoint)

* BRAND: `brand` (ChessDuo blue), `brand-hover`, `brand-active`, `brand-soft`, `brand-subtle`.
  (Resolves today's amber-primary vs blue-CTA split — decision at prototype review.)
* SURFACES: `app-bg`, `surface-elevated`, `surface-card`, `surface-game`, `surface-overlay`, `surface-modal`.
* TEXT: `text-primary`, `text-secondary`, `text-muted`, `text-disabled`, `text-inverse`.
* BORDERS: `border-default`, `border-strong`, `border-focus`, `border-divider`.
* GAME STATES: `team-a`, `team-b`, `turn-active`, `selected`, `valid-move`, `best-move`,
  `success`, `warning`, `error`, `check`, `checkmate`, `draw`, `resigned`, `abandoned`,
  `waiting`, `connecting`.
* PREMIUM: `premium-accent`, `premium-bg`, `premium-border`, `premium-cta` (subtle, not all-gold).
* AI COACH: `coach-accent`, `coach-recommendation`, `coach-best`, `coach-insight`, `coach-voice`.

Rules: components use roles, never raw hex; one meaning per color everywhere (§8).

## 8. Proposed light theme direction

Not "white + blue buttons everywhere": white / off-white / very-light-blue surfaces,
deep readable text (`#111827` family), subtle slate borders, restrained shadows (L0-L3),
controlled blue accents. Clean, premium, comfortable for long sessions; cards separated by
border + tonal shift, not floating boxes.

## 9. Proposed dark theme direction

Deep navy `#0a0e1a` family (never pure black), lighter tonal surfaces, controlled blue,
high-contrast text, subtle borders over shadows, restrained glow on small accents only.
Immersive/competitive/focused; board dominant; comfortable for long play.

## 10. Game-state color mapping (single meaning everywhere)

| Meaning | Color family | Used for |
|---|---|---|
| SUCCESS | emerald/green | completed, synced, won, connected |
| WARNING | amber/yellow | attention, low time, waiting, blunder-risk |
| ERROR | rose/red | failure, lost, disconnected, mistake |
| ACTIVE | blue | current turn, selected nav, primary CTA |
| INFO | sky/indigo | informational, thinking, hints |
| PREMIUM | amber/gold (subtle) | premium features only |
| AI | blue/violet accent | AI-generated info (inside global theme) |
| TEAM | blue vs purple | teammate/team info (with icon+label) |

Chess-specific: selected (blue ring), legal move (dot), last move (dot/frame), check/checkmate
(new: board-legible treatment TBD), promotion (existing modal shells unified), shadow move
(teammate, violet family), AI-selected (emerald), rejected (rose), best (emerald/blue),
inaccurate (yellow/amber), player vs opponent turn (team pair + pill).

## 11. Duo/team color mapping

YOUR TEAM = Team A blue · OPPOSING TEAM = Team B purple. YOUR MOVE vs TEAMMATE MOVE vs
OPPONENT MOVE vs AI-SELECTED vs REJECTED distinguished by color + icon + label + border +
position. No color-only signaling.

## 12. AI Coach color mapping

ChessDuo + intelligent coaching (not a separate app): coach accent (blue family), recommendation
cards, best move (emerald), explanations/insights (neutral surfaces + coach accent), voice state.
`CoachPanel VERDICT_STYLES` (best/great emerald, good sky, inaccuracy amber, mistake orange,
blunder rose) already close — unify with global families.

## 13. Premium color mapping

Subtle elevation inside the product: accent (restrained gold), tinted bg, refined border, clear
CTA. Never overpower brand; never "everything gold". Current emerald price + blue footer can
stay if mapped to roles (`premium-cta` vs `brand`).

## 14. Accessibility considerations

* Icon + label + border + position with every color signal.
* Contrast: body ≥4.5:1, secondary ≥3:1; verify small text, badges, timers, overlays,
  board annotations in BOTH themes.
* Touch ≥44px; text ≥11px; shared `focus-visible:` ring; `<main>` + list semantics;
  toast/timer live regions (thresholds, not per-second); `motion-reduce` guards.

## 15. Components affected

All in `ui-revamp-audit.md` §6: tokens, Button/Card Input Modal/SlideOver Badge Avatar Timer
PlayerCard GameModeCard Tabs BottomSheet Header, board surround, Duo/4P/Coach/GameOver/
History/Replay/Premium/Auth skins, responsive shells, focus states.

## 16. Components that must remain unchanged (behavior)

All in `ui-revamp-audit.md` §7: routing, auth/session, realtime, engines/eval, billing/ads,
push, persistence/services, timer logic, nav-guard behavior, settings-storage mechanism,
vendored board CSS, brand SVG. Skins may change around them; contracts frozen.

## Validation (audit phase)

Read-only sweep of `globals.css`, board CSS, Duo/AI/premium/status colors, component/typography/
spacing/shape/elevation audits. No functionality changed (docs only).
