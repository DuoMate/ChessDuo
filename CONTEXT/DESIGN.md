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
- Home page: max-w-lg centered container, fixed bottom nav with safe-area padding

## Component Styling Conventions
- All interactive elements: `min-h-[44px] min-w-[44px]` (WCAG touch target)
- No text below `text-[11px]` (use `text-xs` for body minimum)
- No hardcoded hex colors — use Tailwind classes
- No inline `style={{}}` for static values
- No `z-index` > 50 without comment explaining why
- Board uses `cm-chessboard` with piece CSS (sprite-based 2D pieces)

## Mobile-First
- Bottom navigation bar (4 tabs: Home, History, Friends, Profile) on home page
- Slide-over panels for sub-views (friends, settings, profile)
- Full-screen bottom sheets for modals on mobile
- Board adapts to available width with `max-h` constraint
- `useIsMobile()` hook (breakpoint: 640px)

## Home Page Design (Revamped)
- Background: `#0a0e1a` (deep navy dark)
- HeaderBar: centered ChessDuo logo (Crown + "Chess" white / "Duo" blue-500), profile icon left, messages icon right with badge
- TimePills: horizontal row of 5 pills (3, 5, 10, 15, 30 min), selected = blue-600 with glow shadow
- GameModeCard: 3 cards (Quick Play, Duo★, Four Players), selected = blue-500/60 border with blue glow
- BotDifficultySelector: knight icon + difficulty name + 6-dot indicator (Easy→Hard) + dropdown
- PlayButton: full-width green gradient (emerald-500→green-500) with glow shadow
- BottomNav: Home/History/Friends/Profile tabs, active = blue-400

## Gradient Backgrounds
- Body: `radial-gradient` amber top-left + indigo bottom-right
- Accent backgrounds: `linear-gradient(135deg, amber, indigo)` at low opacity
- Home page: solid `#0a0e1a` (no gradient)

## Typography
- Game status/timer: Chakra Petch (mono-styled for numbers)
- Body text: Geist Sans (via Next.js font)
- All text ≥ 11px minimum

## Accessibility
- Dark mode support on EVERY component (background, text, borders)
- Touch targets ≥ 44×44px
- Color contrast via CSS variables (light/dark pairs)
- Focus rings on interactive elements

## Recent Changes
- **2026-07-11**: Home page UI revamp — new dark theme (#0a0e1a), blue accent for selected states, green gradient Play button, horizontal time pills, game mode cards with team icons, bot difficulty selector with dot indicators, bottom navigation bar (Home/History/Friends/Profile).
