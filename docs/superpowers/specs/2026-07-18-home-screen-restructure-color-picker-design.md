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

### 5.3 `ColorPicker` (new, `src/components/ColorPicker.tsx`)

- 3 cards: White pawn icon + "White" / Black pawn icon + "Black" / Dice icon + "Random".
- Selected card has the same blue-glow treatment as the inspiration image (`border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-[var(--shadow-glow-blue-strong)]`).
- 44×44px touch targets, 11px+ font size, dark variants for every color.
- Persists choice to `localStorage` under `chessduo_selected_color` (one of `white` | `black` | `random`).
- Default: `white`.
- Used in two places:
  - Browser: inside `ConfigurationPanel`.
  - Mobile: standalone section in the home page (after Bot Difficulty, before Join by Code).

### 5.4 `BotDifficultySelector` (refactor of existing)

- The current home-page version uses a prev/next + dot-indicator design. Replace the *visual* on the home page with the 5-card row from the inspiration image (Easy / Medium / Hard / Expert / Master — each shows a chess piece glyph and label).
- Selected card gets the same blue glow as `ColorPicker`.
- No change to the *logic*: still writes `chessduo_selected_level` to localStorage, still defaults to `3` (Medium).
- Only rendered on mobile (browser hardcodes `level=3`).
- If the design from the image is too tall for the mobile viewport, the current prev/next selector remains a fallback (we'll pick whichever fits — see § 7.5).

---

## 6. Data Flow

### 6.1 Color selection

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

### 6.2 Starting a game

`GameInterface` gets two new optional parameters on `startMatch` / `startQuickPlay` / `startDuel`:

```ts
startMatch({ level, timeSeconds, playerColor: PlayerColor })
```

- `LocalGame` resolves `'random'` to `'white'` or `'black'` via `Math.random() < 0.5`, then:
  - Sets the initial side to move to the chosen color (White moves first by chess rules).
  - Sets the board orientation via `cm-chessboard` `orientation` option.
  - Threads the color through to `BoardTopBar` and the existing team-derivation logic so the human player is always on the selected color.
- `OnlineGame` (Duo): host's selection is sent as a room parameter; the joiner auto-receives the opposite color. For 1v1 Duel the host's color choice is sent via the challenge message payload (`src/lib/challenges.ts` `createChallenge`).

### 6.3 Pending game (offline bug)

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

### 6.4 Game page (`/game`) reads the color

- `useSearchParams` in `src/app/game/page.tsx` reads `color` and forwards to `localGame.startMatch`.
- `MobileChessBoard` and `ChessBoard` already accept an `orientation` prop; we set it from the resolved color.
- The board's "Your Move" / "Teammate Move" labels are recomputed so the human is always on the chosen color (existing `BoardTopBar` derivation already does this for Quick Play; we just need to make sure the team assignment respects the color).

---

## 7. Detailed Behavior

### 7.1 Browser home page

1. User sees sidebar (left) + main content (Logo, Time Control, 3 Game Mode cards, Join by Code, Play button).
2. User taps **Quick Play** or **Duo**:
   - Game mode is highlighted (blue border).
   - A small "Configure" hint appears near the Play button OR the Play button is replaced with an "Open Configuration" button.
   - Tapping Play or "Open Configuration" opens `ConfigurationPanel` as a modal sheet.
3. `ConfigurationPanel` shows the selected mode (read-only) + Choose Your Color + Start Game.
4. Start Game navigates to `/game?level=3&time=…&color=…` (browser always uses Medium).

### 7.2 Mobile home page

1. User sees Logo, Time Control, 3 Game Mode cards, Bot Difficulty (5-card row), Choose Your Color, Join by Code, Play button.
2. Default values: Medium, White, last-used time control.
3. Tapping Play starts the game (or shows the welcome disclaimer if not yet dismissed).
4. No `ConfigurationPanel` — the home page is already the configuration.

### 7.3 4-Player mode (both browser & mobile)

- 4-Player card has no CONFIGURATION panel and no color picker.
- Tap → existing 4-player flow (create or join by code).

### 7.4 Welcome disclaimer bug

- `welcome/page.tsx` already does `router.push('/game?level=…&time=…')`. With the home-page auto-start effect split into A and B (above), the redirect is now reliable:
  - If the user comes from welcome, they navigate to `/game?…` directly, so the home page never gets to mount its effect B.
  - If the user lands on home with a leftover pending game (e.g., they hit back from `/game` and then refresh), effect A picks it up.

### 7.5 Truncation safety (mobile)

- The current home page is `h-screen overflow-hidden` (line 800) and uses compact spacing. Adding two new sections (Bot Difficulty cards + Color picker) risks overflow.
- **Mitigation:**
  - If viewport height < 700px, fall back to the existing prev/next dot-indicators for Bot Difficulty (this matches the original compact design and is what the current code does on the home page today).
  - 3-card color picker is always ~64px tall, so it's safe.
  - Add a `pb-24` to the scroll container (currently `pb-20`) to clear the Play button + bottom nav.
  - Manual test on iPhone SE (667×375 viewport) and iPhone 12 Pro (844×390) before merging.

### 7.6 Storage keys

| Key                              | Type   | Default | Read by                       | Written by                                          |
|----------------------------------|--------|---------|-------------------------------|-----------------------------------------------------|
| `chessduo_selected_color`        | string | `white` | home, ConfigurationPanel      | ColorPicker on change                               |
| `chessduo_pending_offline_game`  | JSON   | —       | home effect A, welcome        | `handleStartOffline` (now also includes `color`)    |
| `chessduo_pending_online_game`   | JSON   | —       | home effect B                  | `handleTwoPlayerClick`                              |
| `chessduo_selected_level`        | string | `3`     | home, BotDifficultySelector   | BotDifficultySelector on change                      |
| `chessduo_selected_time`         | string | `600`   | home                          | home `useEffect` on `selectedTime` change            |

---

## 8. Error Handling

- **Invalid color in URL** (`?color=foo`): game page falls back to `'white'`. No user-facing error.
- **localStorage unavailable** (private mode): all reads/writes are wrapped in `try/catch` and fall back to defaults — same pattern as the existing `getInitialTime` / `getInitialLevel`.
- **Welcome page navigation fails** (e.g., middleware redirect): the home page's effect A still picks up the pending game, so the user gets one extra navigation but ends up in the right place.
- **No `selectedColor` when Start Game is tapped** (browser, ConfigurationPanel): button stays disabled, no error toast needed.
- **Color not in pending JSON** (legacy localStorage): parsed value is `undefined`; `?? 'white'` fallback applies.

---

## 9. Testing

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
- [ ] Existing game flow regressions: 1v1 Duel, Replay, Friends panel.

---

## 10. Rollout

- One PR, behind a feature flag `chessduo_color_picker_enabled` (default `true`).
- Manual verification on Capacitor Android build + Chrome browser (desktop viewport + tablet viewport).
- After verification, set flag to `true` for all users and remove after one release.

---

## 11. Open Questions

None — all clarifications have been resolved via the brainstorming session.

---

## 12. References

- Inspiration image: `docs/HomeScreenrestructure.png`
- Existing home page: `src/app/page.tsx`
- Welcome page: `src/app/welcome/page.tsx`
- Existing bottom nav: `src/components/HomeBottomNav.tsx`
- Game interface: `src/features/shared/GameInterface.ts`
- Bot config: `src/features/bots/botConfig.ts`
- Game constants: `src/features/shared/gameConstants.ts`
- Recent context: `src/app/CONTEXT.md` (board page revamp, configuration panel precedent)
