# Home Screen Restructure & Color Selection — Design

**Date:** 2026-07-18
**Status:** Proposed
**Scope:** Home page (browser + mobile), welcome page bug fix, new color-picker feature

---

## 1. Background & Motivation

Three related items are bundled here because they all touch the home screen:

1. **Bug (mobile, offline):** After tapping **Quick Play** → **Got it!** on the welcome disclaimer, the user lands on `/` instead of `/game?level=X&time=Y`. The welcome page already calls `router.push('/game?level=…&time=…')`, but the home page's auto-start effect intercepts the navigation and short-circuits for guest users (`playerId === null`).

2. **Browser layout shift:** On wider viewports the floating bottom nav wastes space and the existing `Bot Difficulty` card row doesn't fit the design we want for desktop. We move the navigation to a left **sidebar** and remove the bot-difficulty UI from the browser view.

3. **New feature — Choose your color:** Today the user always plays White. The design has to let the user (and the host in Duo) pick White / Black / Random for both Quick Play and Duo.

The design is guided by `docs/HomeScreenrestructure.png`, which shows a full-width **CONFIGURATION** panel with three sections (Game Mode, Bot Difficulty, Choose Your Color) and a **Start Game** button. That panel is the inspiration for the browser experience; the mobile home screen keeps the existing stacked-cards layout with the new color picker added in.

---

## 2. Goals

- Fix the mobile "Got it → home" bug deterministically.
- Add a left **SidebarNav** for browser viewports, keep **HomeBottomNav** on mobile.
- Hide the bot-difficulty UI on browser (level hardcoded to **Medium = 3**); keep an improved bot-difficulty selector on mobile.
- Add a **Choose Your Color** picker (White / Black / Random) to both browser and mobile, defaulting to **White**.
- Wire the selected color through `GameInterface.start*` so the board orientation and first-move parity are correct.
- Don't truncate any existing content on the mobile home (join-by-code must stay above the Play button).

## 3. Non-Goals

- No new game modes.
- No change to 4-Player flow (it doesn't show a CONFIGURATION panel and doesn't need a color picker — host is implicitly White).
- No change to game engine internals beyond accepting a color parameter.
- No migration of existing localStorage `chessduo_pending_*` keys.

---

## 4. Architecture Overview

```
                  ┌─────────────────────────── Browser (≥ md) ───────────────────────────┐
                  │ SidebarNav  │  Home page                                            │
                  │ (fixed,     │  ├─ Logo header                                       │
                  │  left)      │  ├─ Time control                                      │
                  │             │  ├─ Game mode cards (Quick / Duo / 4 Player)         │
                  │             │  ├─ Join by code                                      │
                  │             │  └─ Play button (green gradient)                     │
                  │             │                                                       │
                  │             │  When user clicks Quick/Duo:                         │
                  │             │  └─ ConfigurationPanel overlay/sheet                  │
                  │             │     ├─ Game mode (read-only)                          │
                  │             │     ├─ Choose your color                              │
                  │             │     └─ Start Game button                              │
                  └─────────────┴───────────────────────────────────────────────────────┘

                  ┌─────────────────────────── Mobile (< md) ────────────────────────────┐
                  │ HomeBottomNav (floating pill, fixed bottom)                          │
                  │                                                                         │
                  │ Home page                                                               │
                  │ ├─ Logo header                                                         │
                  │ ├─ Time control                                                        │
                  │ ├─ Game mode cards                                                     │
                  │ ├─ Bot difficulty cards (new design — 5-card row)                     │
                  │ ├─ Choose your color (3-card row)                                     │
                  │ ├─ Join by code                                                        │
                  │ └─ Play button (green gradient)                                       │
                  └─────────────────────────────────────────────────────────────────────────┘
```

The **ConfigurationPanel** is the same React tree used in both surfaces — on browser it's a modal sheet that appears when a Quick/Duo mode is selected, on mobile it doesn't exist (the home page itself already shows all the relevant options).

---

## 5. Components

### 5.1 `SidebarNav` (new, `src/components/SidebarNav.tsx`)

- Fixed left sidebar, full height, 80px wide on `md`, 72px on `lg`.
- Same 4 tabs as `HomeBottomNav` (Home / History / Friends / Profile), vertical layout.
- Same unread-messages badge for the Friends icon.
- Active detection via `usePathname()`.
- Each tab: icon (22px) + 11px label, 44×44px touch target, dark glassmorphism background matching `HomeBottomNav` style.
- Hidden on viewports `< md` (`hidden md:flex`).
- The `(main)/layout.tsx` will render `SidebarNav` for browser and continue rendering `HomeBottomNav` for mobile (so sub-pages like `/history`, `/profile`, `/friends` also get the sidebar on browser).

### 5.2 `ConfigurationPanel` (new, `src/components/ConfigurationPanel.tsx`)

- Modal sheet (centered on `sm`, bottom sheet on `xs` — but we only render this on `≥ md`).
- Props: `mode: 'quick' | 'duo'`, `onClose: () => void`, `onStart: (color: 'white' | 'black' | 'random') => void`, `selectedColor`.
- Sections:
  1. **CONFIGURATION** header (blue accent).
  2. **GAME MODE** section — single non-interactive card showing the chosen mode with avatars and subtitle (matches the image).
  3. **CHOOSE YOUR COLOR** — 3 side-by-side cards (see `ColorPicker`).
  4. **Start Game** button (blue gradient, full width) — disabled until `selectedColor` is set; calls `onStart`.

### 5.2.1 Taglines per game mode & color

The `GameModeCard` subtitle on the home screen is the short tagline shown next to the avatars. With color choice, the tagline needs to handle the dynamic case without becoming confusing. The proposed copy uses a generic phrasing that doesn't name specific bot colors (since those are determined after the user picks a color).

| Mode      | Subtitle                                | Notes                                              |
|-----------|-----------------------------------------|----------------------------------------------------|
| Quick Play | **You + Bot vs Bots**                  | Generic — works for any color (white/black/random) |
| Duo        | **You + Friend vs Bots**                | Unchanged — friend's color depends on the room     |
| 4 Player   | **Friends Battle**                      | Unchanged — no color picker                        |

**Quick Play tagline rationale:** The user picks a color *after* the Quick Play card is shown. The tagline on the card itself can only be generic; once they enter the configuration (browser) or scroll to the color picker (mobile), the actual color is visible. The full breakdown is shown in the `BoardTopBar` at game start (e.g., "You + BlackBot vs WhiteBots" when the user is on White, swapping to "You + WhiteBot vs BlackBots" when the user is on Black).

**Replaced taglines:**
- Old: "You + WhiteBot vs BlackBots" → New: "You + Bot vs Bots"
- Old: "You + Friend vs Bots" → unchanged

The bot *names* inside the game (visible in `BoardTopBar` and `PendingMovesRow`) are still derived from the team the bot occupies: a bot on Team.WHITE is labelled `WhiteBot`, a bot on Team.BLACK is labelled `BlackBot`. This logic in `Game.tsx` (lines 1720, 1756) already exists and stays the same — only the home-screen *teaser* tagline changes.

### 5.3 `ColorPicker` (new, `src/components/ColorPicker.tsx`)

- 3 cards side-by-side: White pawn icon + "White" / Black pawn icon + "Black" / Dice icon + "Random".
- **Icon set (Lucide):** `ChessPawn` for White, `ChessPawn` (with `dark:` color override) for Black, `Dices` for Random. All `size={20}` (or `h-5 w-5`), `strokeWidth={1.8}` for consistent weight with the existing chess-piece icons. Same import path as the rest of the codebase (`import { ChessPawn, Dices } from 'lucide-react'`).
- **Color treatment for the "Black" card icon:** the standard `ChessPawn` icon is a stroked outline; in dark mode it should appear in `text-slate-100`, in light mode `text-slate-800` (default). We don't need a separate "filled black pawn" icon — the surrounding card label "Black" + the dark slate color carries the meaning. (If a user explicitly requests a filled silhouette, we can swap to a custom SVG, but that's a future iteration.)
- **Selected state:** `border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-[var(--shadow-glow-blue-strong)]` — matches the inspiration image and existing `GameModeCard` selected treatment.
- **Unselected state:** `border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60` — same as `GameModeCard`.
- **Layout per card:**
  ```
  ┌────────────┐
  │  [icon]    │  <- ChessPawn / Dices
  │  White     │  <- 12px font, font-semibold
  └────────────┘
  ```
  - min-h-[56px] min-w-[56px] (44×44 + breathing room)
  - Centered icon + label, vertical layout
  - `text-[11px]` for label (matches `GameModeCard` subtitle size)
- **Persistence:** writes to `localStorage['chessduo_selected_color']` on every change.
- **Default:** `white`.
- **Used in two places:**
  - Browser: inside `ConfigurationPanel`.
  - Mobile: standalone section in the home page (after Bot Difficulty, before Join by Code).

### 5.4 `BotDifficultySelector` (refactor of existing)

- The current home-page version uses a prev/next + dot-indicator design with **unicode chess piece glyphs** (♟♞♝♜♛♚). Replace the *visual* on the home page with the 5-card row from the inspiration image.
- **Icon set (Lucide):** each level gets a chess piece icon (not the unicode glyphs we use today). Mapping:
  | Level | Label        | Icon            | Icon size |
  |-------|--------------|-----------------|-----------|
  | 1     | Easy         | `ChessPawn`     | `h-6 w-6` |
  | 2     | Medium       | `ChessKnight`   | `h-6 w-6` |
  | 3     | Hard         | `ChessBishop`   | `h-6 w-6` |
  | 4     | Expert       | `ChessRook`     | `h-6 w-6` |
  | 5     | Master       | `ChessQueen`    | `h-6 w-6` |
  | 6     | Grandmaster  | `ChessKing`     | `h-6 w-6` |

  Note: the inspiration image shows 5 cards (Easy/Medium/Hard/Expert/Master) but the codebase has 6 levels in `DIFFICULTY_LEVELS`. **Decision:** keep 5 cards to match the image, dropping "Grandmaster" (level 6) from the home screen. The `level=6` value still works internally for power users via direct URL parameters, but the UI never offers it. (The existing `getAvailableSkillLevels()` helper in `src/features/bots/botConfig.ts` can be updated to return only 5 levels when called from the home screen, or we just hardcode the 5-level array in the new component.)

- **Selected state:** same as `ColorPicker` — `border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-[var(--shadow-glow-blue-strong)]`. The icon color shifts to `text-blue-600 dark:text-blue-300` when selected.
- **Unselected state:** same as `ColorPicker` (slate border + hover).
- **Card layout (vertical):**
  ```
  ┌──────────┐
  │  [icon]  │  <- 24px chess piece
  │  Easy    │  <- 11px label
  └──────────┘
  ```
  - min-h-[64px] min-w-[44px] — slightly taller than `ColorPicker` cards to fit the 24px icon
  - The `Bot Difficulty` heading sits above the row, same uppercase tracking as `Game Mode` and `Choose Your Color` sections
- **Logic unchanged:** still writes `chessduo_selected_level` to localStorage, still defaults to `3` (Medium).
- **Only rendered on mobile** (browser hardcodes `level=3`).
- **Compact fallback:** if viewport height < 700px, fall back to the existing prev/next dot-indicator (we keep it for the compact case to avoid truncation — see § 9.6).

---

## 6. Theme & Icon System

This section documents the visual conventions all new components must follow to stay consistent with the rest of the app.

### 6.1 Theme tokens (Tailwind v4 + CSS variables)

| Token                  | Light          | Dark           | Usage                                 |
|------------------------|----------------|----------------|---------------------------------------|
| Page background        | `#f4f6fb` (`bg-slate-50` family) | `#0a0e1a` (`bg-[#0a0e1a]`) | Home / ConfigurationPanel            |
| Surface (card)         | `bg-white` / `border-slate-200` | `bg-slate-900/40` / `border-slate-800` | ColorPicker / BotDifficultySelector cards |
| Selected surface       | `bg-blue-50` / `border-blue-500` | `bg-blue-500/10` / `border-blue-400` | Selected state of all new cards       |
| Selected glow          | `shadow-[var(--shadow-glow-blue-strong)]` | same | Blue ring around selected card       |
| Text primary           | `text-slate-900` | `text-white` | Card labels                           |
| Text muted             | `text-slate-500` | `text-slate-400` | Card subtitles, helper text          |
| Play / Start button    | `bg-gradient-to-r from-emerald-500 to-green-500` (mobile) | `from-blue-500 to-blue-400` (browser) | Play/Start Game CTA         |

**Every new card has both light and dark variants.** A "dark-only" component is not allowed by `CONTEXT-SYSTEM.md` rule "no dark-only components."

### 6.2 Icon system

All icons in the new components come from **lucide-react** (matching the existing codebase — see imports in `Game.tsx`, `WelcomeDisclaimer.tsx`, `home/page.tsx`). No emoji, no custom SVGs, no unicode glyphs.

**Icons used in this spec:**

| Component              | Icon         | lucide-react export       | Size               | Notes |
|------------------------|--------------|---------------------------|--------------------|-------|
| `ColorPicker` White    | Pawn         | `ChessPawn`               | `h-5 w-5`          | Default `text-slate-700 dark:text-slate-200` |
| `ColorPicker` Black    | Pawn (inverted) | `ChessPawn`            | `h-5 w-5`          | Same icon; dark slate conveys "black" |
| `ColorPicker` Random   | Dice         | `Dices`                   | `h-5 w-5`          | `text-blue-500` when selected |
| `BotDifficultySelector` Easy    | Pawn     | `ChessPawn`               | `h-6 w-6`          | Same as ColorPicker White      |
| `BotDifficultySelector` Medium  | Knight   | `ChessKnight`             | `h-6 w-6`          |                                    |
| `BotDifficultySelector` Hard    | Bishop   | `ChessBishop`             | `h-6 w-6`          |                                    |
| `BotDifficultySelector` Expert  | Rook     | `ChessRook`               | `h-6 w-6`          |                                    |
| `BotDifficultySelector` Master  | Queen    | `ChessQueen`              | `h-6 w-6`          |                                    |
| `SidebarNav`           | Per-tab      | `Home`, `History`, `Users`, `User` | `h-5 w-5` (icon) + `text-[11px]` (label) | Same as `HomeBottomNav`           |
| `ConfigurationPanel`   | Star (highlighted mode) | `Star`          | `text-amber-500 text-xs` | Matches current home page `showStar` |

**Stroke width:** `1.8` for all chess piece icons (matches `WelcomeDisclaimer` `PawnIcon` `strokeWidth={1.8}`). `2` for navigation icons (matches `HomeBottomNav` `strokeWidth={2}`). `2.5` when active (matches `HomeBottomNav` `strokeWidth={active(path) ? 2.5 : 2}`).

**Sizing convention:**
- Inside 64-72px cards: `h-6 w-6` (24×24) for difficulty, `h-5 w-5` (20×20) for color
- Inside 32-40px button/avatar slots: `h-4 w-4` (16×16)
- Sidebar nav: `h-5 w-5` (20×20) — same as bottom nav

### 6.3 Selected-state pattern (canonical)

Used uniformly by `GameModeCard`, `BotDifficultySelector`, `ColorPicker`, and `TimePills`:

```tsx
className={`
  min-h-[44px] min-w-[44px]  // touch target
  flex flex-col items-center justify-center gap-1
  rounded-xl border-2 transition-all duration-200
  ${selected
    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10 shadow-[var(--shadow-glow-blue-strong)]'
    : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60'
  }
`}
```

The `:hover` styles in unselected state match the existing `GameModeCard` (lines 972–977 of `page.tsx`). No new shade introduced.

### 6.4 Layout rules (mobile)

- Touch target: `min-h-[44px] min-w-[44px]` (WCAG).
- Body text: `text-xs` minimum, `text-[11px]` acceptable for labels.
- Cards in a 3-column row: `gap-2` between cards, `gap-1` inside cards.
- The 5-card difficulty row uses `grid-cols-5` on `sm:`, falls back to horizontal scroll on `xs:` (or wraps to 2 rows if `xs:` width is too narrow — we test on iPhone SE).
- The 3-card color row uses `grid-cols-3`.
- Safe-area padding: the home page already has `pb-20` (Play button clearance). After adding two new sections, increase to `pb-24` and ensure no content scrolls under the floating bottom nav.

### 6.5 Layout rules (browser)

- `ConfigurationPanel` is centered modal sheet, max-width 480px.
- `SidebarNav` width: 80px on `md:`, 88px on `lg:`. Full height, fixed left.
- Main content area: `ml-[80px] lg:ml-[88px]` to clear the sidebar.
- Existing `(main)/layout.tsx` adjustments: same `ml-[80px]` offset for sub-pages.

### 6.6 What this spec does NOT change

- Font family: stays `font-game` (Chakra Petch) for headings, `font-sans` (Geist) for body.
- Body gradient: stays amber + indigo radial gradient. (Home page overrides to solid `#0a0e1a` — also unchanged.)
- Existing components: `HomeBottomNav`, `BoardTopBar`, `GameOverModal`, `MoveComparison` — all keep their current styling. Only the new components adopt the canonical selected-state pattern in § 6.3.
- The existing prev/next `BotDifficultySelector` (line 1032 of `page.tsx`) gets replaced; the dot indicator at the bottom is removed. (We retain the prev/next only as a viewport-fallback when the 5-card row doesn't fit.)

---

## 7. Storage & Constants

This section lists the new constants and localStorage keys added by this spec (also summarized in § 9.7). They're listed here in one place so the implementation plan can reference them directly.

### 7.1 New constants (`src/features/shared/gameConstants.ts`)

```ts
export type PlayerColor = 'white' | 'black' | 'random'
export const DEFAULT_PLAYER_COLOR: PlayerColor = 'white'

export const BROWSER_BOT_LEVEL = 3  // hardcoded for browser
export const MOBILE_DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { level: 1, label: 'Easy',   icon: 'pawn'   },
  { level: 2, label: 'Medium', icon: 'knight' },
  { level: 3, label: 'Hard',   icon: 'bishop' },
  { level: 4, label: 'Expert', icon: 'rook'   },
  { level: 5, label: 'Master', icon: 'queen'  },
] as const
```

### 7.2 New localStorage keys

| Key                              | Type   | Default | Read by                  | Written by                                       |
|----------------------------------|--------|---------|--------------------------|--------------------------------------------------|
| `chessduo_selected_color`        | string | `white` | home, ConfigurationPanel | ColorPicker on change                            |

(Other keys already exist — see § 9.7 for the full table.)

---

## 8. Data Flow

### 8.1 Color selection

```
ColorPicker (select) ──► localStorage['chessduo_selected_color'] = 'white'|'black'|'random'
                       └► setState(color) for the parent (ConfigurationPanel or home page)
```

- On home-page mount, `getInitialColor()` reads `chessduo_selected_color` (default `'white'`).
- A new constant lives in `src/features/shared/gameConstants.ts`:
  ```ts
  export type PlayerColor = 'white' | 'black' | 'random'
  export const DEFAULT_PLAYER_COLOR: PlayerColor = 'white'
  ```

### 8.2 Starting a game

`GameInterface` gets one new optional parameter on `startMatch` / `startQuickPlay` / `startDuel`:

```ts
startMatch({ level, timeSeconds, playerColor: PlayerColor })
```

`PlayerColor` is `'white' | 'black' | 'random'`. Default = `'white'` (current behavior, backwards compatible).

#### 6.2.1 Offline (LocalGame) — player & bot assignment

`LocalGame` resolves `'random'` to `'white'` or `'black'` via `Math.random() < 0.5` at construction time, then assigns the 4 player slots to teams based on the resolved color:

| `playerColor` | `player1` (Human) | `player2` (Teammate Bot) | `player3` (Opponent Bot) | `player4` (Opponent Bot) |
|---|---|---|---|---|
| `'white'` (default) | `Team.WHITE` | `Team.WHITE` | `Team.BLACK` | `Team.BLACK` |
| `'black'`           | `Team.BLACK` | `Team.BLACK` | `Team.WHITE` | `Team.WHITE` |

**Implementation:** Replace the hardcoded `addPlayer` calls in `src/components/Game.tsx` (lines 1541–1544) with a color-aware helper. The new `LocalGame` constructor takes `playerColor` and stores the resolved color. The `addPlayer` calls are already inside Game.tsx's `useEffect`, so they can read `game` and use the color.

**Bot naming** (for the `BoardTopBar` and `PendingMovesRow`):
- A bot on `Team.WHITE` is labelled `WhiteBot` (regardless of which team the human is on).
- A bot on `Team.BLACK` is labelled `BlackBot` (regardless of which team the human is on).
- The team the bot occupies depends on the human's color choice — the human's "teammate" is always on the same color as the human, the "opponent" is always on the opposite color. So the teammate's name changes when the human switches color (e.g., when human is White, teammate is the WhiteBot; when human is Black, teammate is the BlackBot).

**Board orientation:**
- White player → `ChessBoard` `orientation="white"` (current default).
- Black player → `ChessBoard` `orientation="black"` (board flipped, rank 8 at bottom).

The existing `myTeamRef` + `boardOrientation` derivation in `Game.tsx` (line 1968) already supports this pattern — it just needs `myTeam` to be set correctly for offline mode. Today, `LocalGame.getTeam()` always returns `'WHITE'`, so we need to update `LocalGame` to return the human's resolved color:

```ts
// localGame.ts
private _playerColor: 'white' | 'black'
constructor(timeLimitSeconds = 600, playerColor: PlayerColor = 'white') {
  // ...
  this._playerColor = playerColor === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : playerColor
  // ...
}
getTeam(): 'WHITE' | 'BLACK' {
  return this._playerColor === 'white' ? 'WHITE' : 'BLACK'
}
```

`setCurrentTeam` is **not** touched — the chess engine still alternates WHITE→BLACK→WHITE by chess rules regardless of which team the human is on. The "color" of the team stays the same; only which team the human *occupies* changes.

#### 6.2.2 Online (OnlineGame) — Duo mode

`OnlineGame` already accepts a `team` prop on `joinRoom` (see `src/features/online/game/onlineGame.ts` and `src/app/page.tsx`'s `handleRoomJoined`). The host's color choice needs to be sent through the Supabase room payload and the joiner auto-receives the opposite color.

**Flow:**
1. Host picks a color on the configuration panel (browser) or home screen (mobile).
2. `handleStartOnline` / `handleTwoPlayerClick` sets `?team=${color === 'white' ? 'WHITE' : 'BLACK'}` in the route and stores the host's color in the room row (`rooms.host_color`).
3. `createOnlineRoom` and `createChallenge` accept a new `hostColor` argument and write it to the room.
4. When the joiner enters the room, the existing slot-assignment logic in `src/app/page.tsx` (lines 465–477) already puts them on the opposite team if their color matches. We extend that logic so if the joiner has no explicit color, they take the opposite of the host's `host_color`.
5. The `team` query param flows through to `Game.tsx` as today, then to `OnlineGame.joinRoom`.

**Duel (1v1) mode:** The challenge payload (`src/lib/challenges.ts → createChallenge`) is extended with `hostColor: 'white' | 'black' | 'random'`. When the joiner accepts, they auto-receive the opposite color. For `'random'`, the host's color is determined at challenge creation time and frozen.

**4-Player mode:** Excluded — the host is implicitly White, no color picker is shown for 4 Player.

#### 6.2.3 Bot skill levels when color is swapped

Both bots in Quick Play are already configured via `createBotConfig(level, level)` in `Game.tsx` (line 190). The configuration doesn't depend on team — only which team the bot occupies does. No changes needed to `createBotConfig` itself.

For Duo mode (online), the lobby already lets the host pick the bot skill level before creating the room. The same level applies to both bots regardless of which team they end up on.

### 8.3 Pending game (offline bug)

- `handleStartOffline` already stores `chessduo_pending_offline_game = { level, time, color }` in localStorage before navigating to `/welcome?mode=offline`.
- `welcome/page.tsx` reads it, removes it, and pushes `/game?level=…&time=…&color=…`.
- `home/page.tsx` auto-start effect becomes two effects:

  ```ts
  // Effect A: offline pending game — runs as soon as we land on /, even for guests
  useEffect(() => {
    const pending = localStorage.getItem('chessduo_pending_offline_game')
    if (!pending) return
    localStorage.removeItem('chessduo_pending_offline_game')
    const { level, time, color } = JSON.parse(pending)
    router.replace(`/game?level=${level ?? 3}&time=${time ?? DEFAULT_TEAM_TIMER_SECONDS}&color=${color ?? 'white'}`)
  }, [])

  // Effect B: online pending game — needs playerId
  useEffect(() => {
    if (!sessionChecked || !playerId) return
    const pending = localStorage.getItem('chessduo_pending_online_game')
    if (!pending) return
    localStorage.removeItem('chessduo_pending_online_game')
    handleStartOnline(selectedTime)
  }, [sessionChecked, playerId, selectedTime])
  ```

  - `router.replace` instead of `router.push` so the back button doesn't take the user back to the home page after the game starts.
  - Effect A uses `replace` because if the navigation succeeds the home page never actually renders the result of `router.replace` — by the time the effect runs we're already there, but it short-circuits any in-flight state.

### 8.4 Game page (`/game`) reads the color

- `useSearchParams` in `src/app/game/page.tsx` reads `color` and forwards to `localGame.startMatch`.
- `MobileChessBoard` and `ChessBoard` already accept an `orientation` prop; we set it from the resolved color.
- The board's "Your Move" / "Teammate Move" labels are recomputed so the human is always on the chosen color (existing `BoardTopBar` derivation already does this for Quick Play; we just need to make sure the team assignment respects the color).

---

## 9. Detailed Behavior

### 9.1 Browser home page

1. User sees sidebar (left) + main content (Logo, Time Control, 3 Game Mode cards, Join by Code, Play button).
2. User taps **Quick Play** or **Duo**:
   - Game mode is highlighted (blue border).
   - A small "Configure" hint appears near the Play button OR the Play button is replaced with an "Open Configuration" button.
   - Tapping Play or "Open Configuration" opens `ConfigurationPanel` as a modal sheet.
3. `ConfigurationPanel` shows the selected mode (read-only) + Choose Your Color + Start Game.
4. Start Game navigates to `/game?level=3&time=…&color=…` (browser always uses Medium).

### 9.2 Mobile home page

1. User sees Logo, Time Control, 3 Game Mode cards, Bot Difficulty (5-card row), Choose Your Color, Join by Code, Play button.
2. Default values: Medium, White, last-used time control.
3. Tapping Play starts the game (or shows the welcome disclaimer if not yet dismissed).
4. No `ConfigurationPanel` — the home page is already the configuration.

### 9.3 4-Player mode (both browser & mobile)

- 4-Player card has no CONFIGURATION panel and no color picker.
- Tap → existing 4-player flow (create or join by code).

### 9.4 Welcome disclaimer bug

- `welcome/page.tsx` already does `router.push('/game?level=…&time=…')`. With the home-page auto-start effect split into A and B (above), the redirect is now reliable:
  - If the user comes from welcome, they navigate to `/game?…` directly, so the home page never gets to mount its effect B.
  - If the user lands on home with a leftover pending game (e.g., they hit back from `/game` and then refresh), effect A picks it up.

### 9.5 Color swap details

When the human picks Black, the following must change in the running game:

| Element | White player (default) | Black player |
|---|---|---|
| Human team | WHITE | BLACK |
| Teammate bot team | WHITE | BLACK (re-labelled "BlackBot") |
| Opponent bot team | BLACK | WHITE (re-labelled "WhiteBot") |
| First-move side | WHITE (chess rule) | WHITE (chess rule — bots move first) |
| Board orientation | white (rank 1 bottom) | black (rank 8 bottom) |
| "Your Move" indicator | green | green (unchanged) |
| "Teammate Move" indicator | blue/violet | blue/violet (unchanged) |
| PendingMovesRow | `Your Move · WhiteBot` | `Your Move · BlackBot` |
| `myTeamRef` value | `'WHITE'` | `'BLACK'` |
| `boardOrientation` value | `'white'` | `'black'` |
| GameOverModal "X to move" text | unchanged | unchanged |

The "first-move side" stays WHITE in both cases because chess rules are invariant. The user on Black just sees the bots open.

The pending overlay's "Your Move / Teammate" labels in `Game.tsx` are derived from `myTeam` and `g.currentTurn` (lines 605–607) — they already adapt to whichever team the human is on. The "You matched engine" / "teammate matched" labels in `MoveComparison` (line 416–417) reference `player1` vs `player2` slot IDs, which now need to be remapped based on the human's color:

```ts
// in LocalGame.resolvePendingMoves
const humanSlot = this._playerColor === 'white' ? 'player1' : 'player3'  // first slot of the human's team
const teammateSlot = this._playerColor === 'white' ? 'player2' : 'player4'
// then use these to build MoveComparison so the UI correctly says "You" vs "Teammate"
```

`MoveComparison.winnerId` and `loserId` are `'player1' | 'player2'` only — they refer to *which slot on the current team won*, not which is the human. The `MoveComparison` consumer (`MoveInsights`, `AccuracyBottomSheet`) already does the slot→human mapping via the `isPlayer1` check (line 53 of `AccuracyBottomSheet.tsx`). We need to thread the human's slot through that mapping so it knows whether `player1` is the human or the teammate.

### 9.6 Truncation safety (mobile)

- The current home page is `h-screen overflow-hidden` (line 800) and uses compact spacing. Adding two new sections (Bot Difficulty cards + Color picker) risks overflow.
- **Mitigation:**
  - If viewport height < 700px, fall back to the existing prev/next dot-indicators for Bot Difficulty (this matches the original compact design and is what the current code does on the home page today).
  - 3-card color picker is always ~64px tall, so it's safe.
  - Add a `pb-24` to the scroll container (currently `pb-20`) to clear the Play button + bottom nav.
  - Manual test on iPhone SE (667×375 viewport) and iPhone 12 Pro (844×390) before merging.

### 9.7 Storage keys

| Key                              | Type   | Default | Read by                       | Written by                                          |
|----------------------------------|--------|---------|-------------------------------|-----------------------------------------------------|
| `chessduo_selected_color`        | string | `white` | home, ConfigurationPanel      | ColorPicker on change                               |
| `chessduo_pending_offline_game`  | JSON   | —       | home effect A, welcome        | `handleStartOffline` (now also includes `color`)    |
| `chessduo_pending_online_game`   | JSON   | —       | home effect B                  | `handleTwoPlayerClick`                              |
| `chessduo_selected_level`        | string | `3`     | home, BotDifficultySelector   | BotDifficultySelector on change                      |
| `chessduo_selected_time`         | string | `600`   | home                          | home `useEffect` on `selectedTime` change            |

---

## 10. Error Handling

- **Invalid color in URL** (`?color=foo`): game page falls back to `'white'`. No user-facing error.
- **localStorage unavailable** (private mode): all reads/writes are wrapped in `try/catch` and fall back to defaults — same pattern as the existing `getInitialTime` / `getInitialLevel`.
- **Welcome page navigation fails** (e.g., middleware redirect): the home page's effect A still picks up the pending game, so the user gets one extra navigation but ends up in the right place.
- **No `selectedColor` when Start Game is tapped** (browser, ConfigurationPanel): button stays disabled, no error toast needed.
- **Color not in pending JSON** (legacy localStorage): parsed value is `undefined`; `?? 'white'` fallback applies.

---

## 11. Testing

Unit tests to add (`src/components/__tests__/`):

- `ColorPicker.test.tsx` — toggles selected card, writes to localStorage, fires `onChange`.
- `SidebarNav.test.tsx` — renders tabs, marks active tab by pathname, hides below `md`.
- `ConfigurationPanel.test.tsx` — opens/closes, Start Game disabled until color selected, calls `onStart` with chosen color.
- `welcome/page.test.tsx` (new) — clicking "Got it!" with offline pending navigates to `/game?level=…&time=…&color=…` and removes the pending key.

Existing tests to update:

- `HomeBottomNav.test.tsx` — no change.
- `BotDifficultySelector.test.tsx` (if exists) — keep coverage for prev/next fallback.
- `page.tsx` auto-start behavior — add a test that verifies pending offline game is picked up even with `playerId === null`.

Manual test plan:

- [ ] Mobile (Capacitor): Quick Play → Got it → game starts, not home.
- [ ] Mobile (Capacitor): Duo → Got it → online room creation, not home.
- [ ] Browser: Quick Play → ConfigurationPanel → pick Black → Start Game → game starts with board flipped.
- [ ] Browser: Duo → ConfigurationPanel → pick Random → Start Game → game starts on random color.
- [ ] Browser: 4 Player → no ConfigurationPanel, no color picker.
- [ ] Mobile: 4 Player card → existing 4-player flow, no color picker.
- [ ] Mobile: truncation check on iPhone SE viewport.
- [ ] Browser: refresh on `/game?color=black` after going back → game still starts with Black.
- [ ] **Color swap (Quick Play, mobile):** Pick Black → BoardTopBar shows "You" on Black side, "BlackBot" as teammate, "WhiteBots" as opponents. Board flipped. First move is from the bot side.
- [ ] **Color swap (Quick Play, mobile):** Pick White → same as today, no behavioral change.
- [ ] **Color swap (Quick Play, browser):** Pick Random → resolves to one of the two, board starts with bots moving.
- [ ] **Color swap (Duo, mobile & browser):** Host picks Black → joiner is auto-assigned White. Joiner sees themselves on White side. Host sees themselves on Black side.
- [ ] **Color swap (4 Player):** No color picker visible, no swap applied. Existing flow unchanged.
- [ ] **Tagline (home):** Quick Play card shows "You + Bot vs Bots". No specific bot color names.
- [ ] **PendingMovesRow labels:** After swap, the row says "Your Move · BlackBot" when human is Black, "Your Move · WhiteBot" when human is White. Existing "Teammate" labels remain consistent.
- [ ] **MoveInsights "You matched engine":** Correctly identifies the human's move even after color swap.
- [ ] **GameOverModal:** Winner label (White/Black) reflects the chess winner, not the human's chosen color.
- [ ] Existing game flow regressions: 1v1 Duel, Replay, Friends panel.

---

## 12. Rollout

- One PR, behind a feature flag `chessduo_color_picker_enabled` (default `true`).
- Manual verification on Capacitor Android build + Chrome browser (desktop viewport + tablet viewport).
- After verification, set flag to `true` for all users and remove after one release.

---

## 13. Open Questions

None — all clarifications have been resolved via the brainstorming session.

### Resolved during brainstorming

| Question                                                                 | Decision                                                                                       |
|--------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Browser vs mobile layout                                                 | Same home, different nav (sidebar vs bottom). Browser uses `ConfigurationPanel` for Quick/Duo. |
| Bot difficulty on mobile                                                 | Visible (5-card row, new design).                                                             |
| Bot difficulty on browser                                                | Hidden, hardcoded to Medium.                                                                  |
| Color picker design                                                      | 3 side-by-side cards (White / Black / Random).                                                |
| Welcome bug fix approach                                                 | Welcome page already navigates to `/game?…`; fix the home page's auto-start effect.           |
| Color assignment for Quick Play & Duo                                    | Bots swap teams so the human's teammate is always on the chosen color.                        |
| Tagline on home screen                                                   | Generic "You + Bot vs Bots" for Quick Play (no specific bot color names in the teaser).       |

---

## 14. References

- Inspiration image: `docs/HomeScreenrestructure.png`
- Existing home page: `src/app/page.tsx`
- Welcome page: `src/app/welcome/page.tsx`
- Existing bottom nav: `src/components/HomeBottomNav.tsx`
- Game interface: `src/features/shared/GameInterface.ts`
- Bot config: `src/features/bots/botConfig.ts`
- Game constants: `src/features/shared/gameConstants.ts`
- Recent context: `src/app/CONTEXT.md` (board page revamp, configuration panel precedent)
