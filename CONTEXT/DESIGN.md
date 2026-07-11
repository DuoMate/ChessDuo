# ChessDuo Design System

## Theme Architecture
- Two themes: light (default) + dark (`.dark` class on `<html>`)
- Dark variant via Tailwind `dark:` prefix on every component
- Color scheme switches via `color-scheme: light` / `color-scheme: dark`
- Smooth transition: `transition: background-color 0.3s ease, color 0.3s ease`

## CSS Variables (Light)
| Variable | Value |
|---|---|
| `--color-page-bg` | `#f4f6fb` |
| `--color-page-fg` | `#111827` |
| `--color-surface` | `rgba(255, 255, 255, 0.82)` |
| `--color-primary` | `#f59e0b` (amber) |
| `--color-secondary` | `#6366f1` (indigo) |
| `--color-success` | `#10b981` (emerald) |
| `--color-danger` | `#ef4444` (red) |

Same variables in dark mode use darker values (e.g. `--color-page-bg: #060816`).

## Tailwind Theme Extensions (`@theme inline`)
- `--font-sans`: Geist Sans
- `--font-mono`: Geist Mono
- `--font-game`: Chakra Petch + Geist Sans
- Game-specific colors: `game-gold`, `game-winner`, `game-loser`, `game-bg`, `game-card`, `game-surface`

## Utility Classes
- `glass-panel`: border + white/80 bg + backdrop-blur-xl + shadow
- `soft-card`: rounded-[24px] + border + subtle background
- `surface-ring`: ring-[1px] around surface elements

## Layout Rules
- **980px max-width** container on desktop
- `h-dvh` for mobile viewport height (not 100vh)
- Safe areas via `MobileStatusBar` component (Capacitor)
- BottomNav at bottom on mobile (fixed, h-16)
- `min-h-dvh` wrapper in layout

## Component Styling Conventions
- All interactive elements: `min-h-[44px] min-w-[44px]` (WCAG touch target)
- No text below `text-[11px]` (use `text-xs` for body minimum)
- No hardcoded hex colors — use Tailwind classes
- No inline `style={{}}` for static values
- No `z-index` > 50 without comment explaining why
- Board uses `cm-chessboard` with piece CSS (sprite-based 2D pieces)

## Mobile-First
- Bottom navigation bar (4 tabs: Play, Friends, History, Profile)
- Slide-over panels for sub-views (friends, settings, profile)
- Full-screen bottom sheets for modals on mobile
- Board adapts to available width with `max-h` constraint
- `useIsMobile()` hook (breakpoint: 640px)

## Gradient Backgrounds
- Body: `radial-gradient` amber top-left + indigo bottom-right
- Accent backgrounds: `linear-gradient(135deg, amber, indigo)` at low opacity

## Typography
- Game status/timer: Chakra Petch (mono-styled for numbers)
- Body text: Geist Sans (via Next.js font)
- All text ≥ 11px minimum

## Accessibility
- Dark mode support on EVERY component (background, text, borders)
- Touch targets ≥ 44×44px
- Color contrast via CSS variables (light/dark pairs)
- Focus rings on interactive elements
