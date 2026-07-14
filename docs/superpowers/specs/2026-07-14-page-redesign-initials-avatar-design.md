# Page Redesign: Initials Avatar + Dark Theme

**Date:** 2026-07-14
**Status:** Approved
**Scope:** Friends Panel, Premium Page, Profile Page, BoardTopBar

## Context

The current ChessDuo UI uses emoji placeholders (`👤`) for friend avatars, gray theme for profile/premium pages, and image-based avatars in the game top bar. The redesign aligns all pages to a cohesive dark navy theme with initials-based avatars, matching reference mockups provided by the user.

**Key decisions:**
- Initials avatars replace image avatars everywhere **except** the home page (which keeps its existing avatars)
- Bot avatars remain as images (bot.webp)
- Both light and dark themes are supported — light mode CSS variables remain unchanged; new components use Tailwind `dark:` variants for the navy palette
- BoardTopBar uses initials for humans, keeps images for bots

## Design Tokens

### Color Palette (Dark Mode)

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#0a0e1a` | Main page background |
| Surface | `rgba(15, 23, 42, 0.8)` | Cards, panels |
| Surface strong | `#0f172a` | Elevated cards |
| Border | `rgba(255, 255, 255, 0.06)` | Subtle outlines |
| Primary (amber) | `#fbbf24` | Premium, titles, badges |
| Secondary (blue) | `#3b82f6` | Selected states, monthly plan |
| Success (green) | `#22c55e` | Online status, annual plan |
| Muted text | `#94a3b8` | Secondary text |
| Primary text | `#f8fafc` | Headings, primary text |

### Initials Avatar Sizes

| Size | Dimensions | Usage |
|------|-----------|-------|
| `sm` | 32×32px | Compact lists |
| `md` | 40×40px | Friend cards, BoardTopBar |
| `lg` | 64×64px | Profile page hero |

## Components

### 1. InitialsAvatar (new: `src/components/InitialsAvatar.tsx`)

**Props:**
```tsx
interface InitialsAvatarProps {
  username: string
  size?: 'sm' | 'md' | 'lg'
  online?: boolean
  premium?: boolean
  ringClass?: string  // for team-colored rings in BoardTopBar
}
```

**Behavior:**
- Extracts first 2 characters from `username`, converts to uppercase
- Default background: gradient circle (`bg-gradient-to-br from-blue-500 to-purple-600`)
- Premium background: `bg-gradient-to-br from-amber-400 to-amber-600`
- Online indicator: green dot at bottom-right (when `online=true`)
- Ring: optional `ringClass` prop for team-colored rings

**Size variants:**
- `sm`: `w-8 h-8 text-xs rounded-full`
- `md`: `w-10 h-10 text-sm rounded-full`
- `lg`: `w-16 h-16 text-xl rounded-full`

### 2. Friends Panel (`src/components/FriendsPanel.tsx`)

**Layout:**
```
┌─────────────────────────────────┐
│ 👥 Friends              ✕       │
│ Connect, play & grow together   │
├─────────────────────────────────┤
│ 🔍 Search by name or username.. │
├─────────────────────────────────┤
│ 🔗 Copy invite link             │
│ Invite your friends to ChessDuo │
├─────────────────────────────────┤
│ Friends (2) │ Requests │ Blocked│
├─────────────────────────────────┤
│ YOUR FRIENDS                    │
│ ┌─────────────────────────────┐ │
│ │ [FF] FakeFabio    💬 ⋮     │ │
│ │       Online                │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [N2] navron27 ①   💬 ⋮     │ │
│ │       Online                │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 👑 More friends, more fun!  │ │
│ │ Challenge your friends...   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Styling:**
- Header: `text-white` title, `text-slate-400` subtitle
- Search input: `bg-slate-800/50 border border-white/5 rounded-xl text-white`
- Invite link card: `border border-amber-500/20 bg-amber-500/5`
- Active tab: `border-b-2 border-blue-500 text-blue-400`
- Inactive tab: `text-slate-400`
- Friend card: `bg-slate-800/50 border border-white/5 rounded-2xl`
- Online badge: `text-emerald-400 text-xs`
- Unread badge: `bg-amber-500 text-white text-xs rounded-full`
- "More friends" card: `border border-purple-500/20 bg-purple-500/5` with crown icon (lucide `Crown`) + chess knight image at low opacity

**Requests tab:**
- Outgoing: InitialsAvatar + "Request sent" + "Pending" badge (amber)
- Empty state: paper plane icon + "Your friend request is on its way!"

**Blocked tab:**
- InitialsAvatar + username + "Unblock" button

### 3. Premium Page (`src/app/(main)/premium/page.tsx`)

**Layout:**
```
┌─────────────────────────────────┐
│ ← ChessDuo           [crown]    │
│    Premium                       │
│ Unlock the best tools.           │
│ Play smarter. Win more.          │
├─────────────────────────────────┤
│ 📅 Monthly                      │
│ Flexible & cancel anytime        │
│ ₹99 per month                   │
│ [ Subscribe Monthly → ]          │
├─────────────────────────────────┤
│      ★ Best Value                │
│ ⭐ Annual                        │
│ Most popular choice              │
│ ₹999 per year                    │
│ ₹83.25/mo (save 16%)            │
│ [ Subscribe Annual → ]           │
├─────────────────────────────────┤
│ ✦ Premium Benefits ✦            │
│ 📊 Unlimited Move Analysis  →   │
│ ⚡ Advanced Insights        →   │
│ ⭐ Game Review              →   │
│ 🚫 Ad-Free Experience       →   │
├─────────────────────────────────┤
│ 🔒 Secure payments. Cancel anytime. │
└─────────────────────────────────┘
```

**Styling:**
- Page background: dark navy with radial gradient accents
- Decorative elements: gold crown image (top-right of header), chess knight/pawn images on cards (CSS background or `<img>` with `opacity-20`)
- Monthly button: `bg-blue-600 hover:bg-blue-500 text-white`
- Annual button: `bg-emerald-600 hover:bg-emerald-500 text-white`
- Best Value badge: `bg-emerald-600 text-white text-xs rounded-full`
- Monthly card: `border border-slate-700/70 bg-slate-800/50`
- Annual card: `border border-emerald-500/30 bg-slate-800/50`
- Benefit items: `border border-slate-700/50 bg-slate-800/30` with icon + text + chevron
- Chess piece decorations: Use existing `/avatars/bot.webp` or new chess piece SVGs at low opacity as background elements on cards

### 4. Profile Page

**Files:** `src/app/(main)/profile/page.tsx` + `src/components/ProfilePanel.tsx`

**Layout:**
```
┌─────────────────────────────────┐
│ 👤 Profile              ✕       │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │      [C2]                   │ │
│ │   Username                  │ │
│ │  chessdoubles27     ✏️      │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 🔗 Share Profile           →   │
│ Share your profile with friends │
├─────────────────────────────────┤
│ 👑 Upgrade to Premium       →   │
│ Unlock powerful features        │
├─────────────────────────────────┤
│ 🕐 View All Match History   →   │
│ Check your past games           │
├─────────────────────────────────┤
│ 🛡️ Manage Account           →   │
│ Security, privacy & preferences │
├─────────────────────────────────┤
│ 🚪 Sign Out                →   │
│ Log out from your account       │
└─────────────────────────────────┘
```

**Styling:**
- Avatar section: `bg-slate-800/50 border border-white/5 rounded-2xl`
- Large InitialsAvatar (lg=64px) centered
- Username: `text-white text-xl font-bold`
- Share Profile: `border border-amber-500/20 bg-amber-500/10`
- Upgrade to Premium: `border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-indigo-500/10`
- View History: `border border-blue-500/20 bg-blue-500/5`
- Manage Account: `border border-blue-500/20 bg-blue-500/5`
- Sign Out: `border border-rose-500/20 bg-rose-500/10 text-rose-400`
- Each menu item: icon (left) + title + description + chevron (right)

### 5. BoardTopBar (`src/components/BoardTopBar.tsx`)

**Change:** Replace `AvatarTile` image rendering with `InitialsAvatar` for human players.

```tsx
// Before (humans):
<img src={avatarUrl} alt={player.label} className="object-cover" />

// After (humans):
<InitialsAvatar
  username={player.label}
  size="md"
  online={player.online}
  ringClass={isWhite ? 'ring-blue-500/70' : 'ring-purple-500/70'}
/>

// Bots: keep existing <img> with bot.webp (unchanged)
```

### 6. CSS Variables (`src/app/globals.css`)

Update dark mode variables (light mode variables remain unchanged — new components use `dark:` Tailwind variants):

```css
.dark {
  --color-page-bg: #0a0e1a;
  --color-page-fg: #f8fafc;
  --color-surface: rgba(15, 23, 42, 0.8);
  --color-surface-strong: #0f172a;
  --color-surface-hover: #1e293b;
  --color-border: rgba(255, 255, 255, 0.06);
  --color-muted: #94a3b8;
  --color-muted-bg: rgba(15, 23, 42, 0.9);
  --color-primary: #fbbf24;
  --color-primary-strong: #f59e0b;
  --color-secondary: #3b82f6;
  --color-success: #22c55e;
  --color-danger: #fb7185;
  --color-input-bg: rgba(15, 23, 42, 0.85);
  --color-shadow: rgba(2, 6, 23, 0.45);
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/InitialsAvatar.tsx` | **NEW** — shared initials avatar component |
| `src/components/FriendsPanel.tsx` | Full redesign — initials, dark theme, new layout |
| `src/components/ProfilePanel.tsx` | Redesign — large initials avatar, menu items |
| `src/app/(main)/profile/page.tsx` | Update page wrapper styles |
| `src/app/(main)/premium/page.tsx` | Full redesign — new layout with chess decorations |
| `src/components/BoardTopBar.tsx` | Replace `AvatarTile` with `InitialsAvatar` for humans |
| `src/app/globals.css` | Update dark mode CSS variables |

## Files NOT Modified

- `src/app/page.tsx` (home page) — keeps existing avatars per user request
- `src/components/HomeBottomNav.tsx` — no changes needed
- `src/features/shared/avatars.ts` — retained for bot avatars and home page

## Testing

1. **Visual verification:** All pages render correctly in both light and dark mode
2. **Initials extraction:** Names like "FakeFabio" → "FA", "navron27" → "N2", "chessdoubles27" → "CH"
3. **Online status:** Green dot appears/disappears based on presence
4. **BoardTopBar:** Humans show initials, bots show bot.webp image
5. **Responsive:** Works on mobile (320px+) and desktop
6. **Accessibility:** All text meets WCAG AA contrast ratios on dark backgrounds
7. **TypeScript:** `npx tsc --noEmit` passes
8. **Tests:** `npm test` passes with no new failures

## Out of Scope

- Home page redesign (retains current avatars)
- Game room changes beyond BoardTopBar
- New navigation structure
- Changes to game logic or data flow
