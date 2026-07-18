# Implementation Plan — Home Screen Restructure & Color Picker

**Spec:** `docs/superpowers/specs/2026-07-18-home-screen-restructure-color-picker-design.md`
**Branch strategy:** single feature branch off `develop`, one PR at the end.

---

## Phase 0 — Constants & Types (no UI)

**Goal:** Add the new `PlayerColor` type and storage key constants before any UI work.

### 0.1 Update `src/features/shared/gameConstants.ts`
- Add `PlayerColor` type alias: `'white' | 'black' | 'random'`
- Add `DEFAULT_PLAYER_COLOR: PlayerColor = 'white'`
- Add `BROWSER_BOT_LEVEL = 3`
- Add `SELECTED_COLOR_KEY = 'chessduo_selected_color'`
- Update `CONTEXT.md` (in `src/features/shared/`) with the new constants

### 0.2 Update `src/app/CONTEXT.md`
- Note the new color picker feature under "Recent Changes" once Phase 4 lands

**Files touched:** `src/features/shared/gameConstants.ts`, `src/features/shared/CONTEXT.md`
**Tests:** none (pure type/constant additions)
**Verify:** `npx tsc --noEmit` passes

---

## Phase 1 — Welcome Page Bug Fix

**Goal:** Make Quick Play → Got it reliably land on the game page (not home).

### 1.1 Split auto-start effect in `src/app/page.tsx`
- Remove the single auto-start `useEffect` (lines 196–217)
- Add **Effect A** (offline pending game): runs on mount, uses `router.replace`, doesn't depend on `playerId` or `sessionChecked`
- Add **Effect B** (online pending game): runs only when `sessionChecked && playerId`, calls `handleStartOnline`

### 1.2 Verify welcome page redirect
- `src/app/welcome/page.tsx` already calls `router.push('/game?level=…&time=…')` for offline mode (lines 82–93) — no change needed, but verify the navigation now succeeds because home page no longer intercepts

### 1.3 Update `welcome/page.tsx` to include color in URL
- Extend `chessduo_pending_offline_game` to include `color`
- Update `handleDismiss` to push `/game?level=…&time=…&color=…`

**Files touched:** `src/app/page.tsx`, `src/app/welcome/page.tsx`
**Tests:** add a unit test that mounts `page.tsx` with a pending offline game in localStorage and `playerId = null` — assert `router.replace` is called with the right URL
**Verify:** manual test on Capacitor Android: Quick Play → Got it → game starts, not home

---

## Phase 2 — Color Constants & LocalGame Player-Slot Mapping

**Goal:** Make `LocalGame` accept and respect `playerColor`.

### 2.1 Add color param to `LocalGame` constructor
- File: `src/features/offline/game/localGame.ts`
- Constructor signature: `constructor(timeLimitSeconds: number = 600, playerColor: PlayerColor = 'white')`
- Resolve `'random'` to `'white'` or `'black'` in constructor, store as `private _playerColor: 'white' | 'black'`
- Update `getTeam()` to return the resolved color
- Add `getPlayerColor()` getter returning the resolved `'white' | 'black'`

### 2.2 Update `GameInterface.ts`
- File: `src/features/shared/GameInterface.ts`
- Add `getPlayerColor(): 'white' | 'black'` to the interface

### 2.3 Update `OnlineGame`
- File: `src/features/online/game/onlineGame.ts`
- Add the same `getPlayerColor()` getter (initially returns based on `team` prop passed in)

### 2.4 Update `Game.tsx` `addPlayer` calls
- File: `src/components/Game.tsx` (lines 1541–1544)
- Replace hardcoded assignment with a color-aware helper:
  ```ts
  if (game.getPlayerColor() === 'white') {
    game.addPlayer('player1', Team.WHITE)  // human
    game.addPlayer('player2', Team.WHITE)  // teammate bot
    game.addPlayer('player3', Team.BLACK)  // opponent bot
    game.addPlayer('player4', Team.BLACK)  // opponent bot
  } else {
    game.addPlayer('player1', Team.BLACK)  // human
    game.addPlayer('player2', Team.BLACK)  // teammate bot
    game.addPlayer('player3', Team.WHITE)  // opponent bot
    game.addPlayer('player4', Team.WHITE)  // opponent bot
  }
  ```

### 2.5 Pass `playerColor` from home to game page
- File: `src/app/page.tsx` — `handleStartOffline` reads `localStorage['chessduo_selected_color']`, includes it in the pending JSON
- File: `src/app/game/page.tsx` — reads `color` from search params, passes to `Game` as a new prop
- File: `src/components/Game.tsx` — accepts `playerColor` prop, passes to `new LocalGame(timeLimitSeconds, playerColor)`

### 2.6 Update `MoveComparison` human-slot mapping
- File: `src/features/offline/game/localGame.ts` `resolvePendingMoves`
- Track the "human slot" (`player1` or `player3` depending on color) and the "teammate slot"
- Make sure `MoveComparison.winnerId` / `loserId` still refer to the team's slot, but the consumer logic in `AccuracyBottomSheet.tsx` and `MoveInsights.tsx` gets updated to use `getPlayerColor()` to decide whether `player1` is the human

**Files touched:** `src/features/offline/game/localGame.ts`, `src/features/shared/GameInterface.ts`, `src/features/online/game/onlineGame.ts`, `src/components/Game.tsx`, `src/app/page.tsx`, `src/app/game/page.tsx`, `src/components/AccuracyBottomSheet.tsx`, `src/components/MoveInsights.tsx`
**Tests:** unit test for `LocalGame` with `playerColor='black'` verifying the team assignments; manual test for full flow
**Verify:** `npx tsc --noEmit` and `npm test` pass

---

## Phase 3 — `ColorPicker` Component (mobile + browser shared)

**Goal:** Reusable 3-card color picker with theme + icon compliance.

### 3.1 Create `src/components/ColorPicker.tsx`
- Props: `value: PlayerColor`, `onChange: (color: PlayerColor) => void`
- Three side-by-side cards using the canonical selected-state pattern from spec § 6.3
- Icons: `ChessPawn` (White), `ChessPawn` with `text-slate-800 dark:text-slate-200` (Black), `Dices` (Random)
- Reads/writes `localStorage['chessduo_selected_color']` via the same `useEffect` pattern as existing `selectedTime`/`selectedLevel`
- 11px+ font, 44×44px+ touch targets, both light + dark variants

### 3.2 Create `src/components/__tests__/ColorPicker.test.tsx`
- Renders all 3 cards
- Toggling a card calls `onChange` and writes to localStorage
- Selected card has the blue glow class
- Default value is 'white' when localStorage is empty

**Files touched:** `src/components/ColorPicker.tsx`, `src/components/__tests__/ColorPicker.test.tsx`, `src/components/CONTEXT.md`
**Tests:** the new ColorPicker test
**Verify:** `npm test -- ColorPicker` passes

---

## Phase 4 — Mobile Home: Wire `ColorPicker` + New BotDifficultySelector

**Goal:** Add the new sections to the mobile home screen, replace the old dot-based BotDifficulty.

### 4.1 Refactor `BotDifficultySelector` in `src/app/page.tsx`
- Replace the prev/next + dots design (lines 1032–1098) with a 5-card row (Easy/Medium/Hard/Expert/Master)
- Use Lucide icons (`ChessPawn`, `ChessKnight`, `ChessBishop`, `ChessRook`, `ChessQueen`)
- Apply the canonical selected-state pattern
- Keep the prev/next fallback hidden behind a viewport-height check (use `useIsMobile` width or a height check via `useViewportSize`)

### 4.2 Add `ColorPicker` section to mobile home
- Insert between Bot Difficulty and Join by Code (in the home screen JSX around line 800–880)
- Label: "CHOOSE YOUR COLOR" (uppercase tracking, same as existing section labels)
- 3 cards using the `ColorPicker` component
- `selectedColor` state in `page.tsx`, persisted via the existing localStorage pattern

### 4.3 Truncation safety
- Bump home page `pb-20` to `pb-24` to clear the Play button
- Test on iPhone SE viewport (375×667): make sure content doesn't truncate. If it does, hide the description text on small viewports.
- Test on iPhone 12 Pro viewport (390×844): should fit comfortably

### 4.4 Update `GameModeCard` tagline for Quick Play
- File: `src/app/page.tsx` `GameModeCard` (lines 953–1027)
- Change Quick Play subtitle from "You + WhiteBot vs BlackBots" to "You + Bot vs Bots"
- Duo and 4 Player subtitles unchanged

**Files touched:** `src/app/page.tsx`, `src/app/CONTEXT.md` (Recent Changes)
**Tests:** visual regression on the home page (manual on mobile viewport)
**Verify:** `npx tsc --noEmit` passes; manual mobile test

---

## Phase 5 — Browser `SidebarNav` Component

**Goal:** Vertical sidebar for browser viewports.

### 5.1 Create `src/components/SidebarNav.tsx`
- Same 4 tabs as `HomeBottomNav` (Home/History/Friends/Profile)
- Vertical layout: icon + label stacked
- Fixed left, full height, 80px wide on `md:`, 88px on `lg:`
- Hidden on viewports < md (`hidden md:flex`)
- Glassmorphism background matching `HomeBottomNav` (same border/shadow)
- Same unread badge logic via `unreadMessages` prop
- Uses `usePathname()` for active detection (already used by `HomeBottomNav`)

### 5.2 Update `(main)/layout.tsx`
- Use `useIsMobile` to switch between `HomeBottomNav` (mobile) and `SidebarNav` (browser)
- Add `md:ml-20 lg:ml-22` padding to the children container to clear the sidebar

### 5.3 Update `src/app/page.tsx` (home page)
- The home page already renders `HomeBottomNav` directly. Wrap it in a `useIsMobile` check too:
  - Mobile: `HomeBottomNav`
  - Browser: nothing (the page IS the home, no need for a sidebar here unless we want it... let's leave it without sidebar for now, only sub-pages get the sidebar)
- Actually, based on spec § 6.5: "Main content area: `ml-[80px] lg:ml-[88px]` to clear the sidebar." → the home page also needs the sidebar. Update accordingly.

### 5.4 Create `src/components/__tests__/SidebarNav.test.tsx`
- Renders all 4 tabs
- Marks active tab by pathname
- Hidden below md (use `jest.mock` for `useIsMobile`)

**Files touched:** `src/components/SidebarNav.tsx`, `src/components/__tests__/SidebarNav.test.tsx`, `src/app/(main)/layout.tsx`, `src/app/page.tsx`, `src/components/CONTEXT.md`
**Tests:** the new SidebarNav test
**Verify:** `npm test -- SidebarNav` passes; manual browser test

---

## Phase 6 — Browser `ConfigurationPanel` Component

**Goal:** Modal sheet for browser Quick Play / Duo that shows game mode + color picker + start button.

### 6.1 Create `src/components/ConfigurationPanel.tsx`
- Modal sheet (centered on sm+, full-screen on xs but only used on md+)
- Props: `mode: 'quick' | 'duo'`, `onClose: () => void`, `onStart: (color: PlayerColor) => void`, `selectedColor: PlayerColor`, `onColorChange: (color: PlayerColor) => void`
- Sections (in order):
  1. "CONFIGURATION" header (uppercase, blue accent — matches inspiration image)
  2. "GAME MODE" label + non-interactive `GameModeCard`-like card showing the mode
  3. "CHOOSE YOUR COLOR" label + `ColorPicker`
  4. "Start Game" button (full-width, blue gradient, disabled until `selectedColor` is set)
- Escape key closes; backdrop click closes; `useScrollLock` while open
- Uses framer-motion `motion.div` for the entrance animation (consistent with `GameOverModal`)

### 6.2 Wire `ConfigurationPanel` into `src/app/page.tsx`
- New state: `showConfig: 'quick' | 'duo' | null`
- When user clicks Quick Play or Duo card on browser: open the panel
- When user clicks Play button on browser (if a mode is selected): also open the panel
- Start Game button → navigates to `/game?level=3&time=…&color=…` (browser always uses level 3)

### 6.3 Browser-specific rendering
- In `page.tsx`, use `useIsMobile` to decide which UI to show:
  - Mobile: full home with all sections (Time, Game Mode, Bot Difficulty, Color, Join by Code, Play button)
  - Browser: home shows Time, Game Mode cards, Join by Code, Play button. Bot Difficulty is hidden. Color picker is only inside the ConfigurationPanel.

### 6.4 Hide `BotDifficultySelector` on browser
- The existing `BotDifficultySelector` in `page.tsx` is rendered only when `selectedGameMode` is set. On browser, we want to keep this hidden, so the condition becomes: `selectedGameMode && useIsMobile() === true && selectedGameMode !== 'four'`

### 6.5 Create `src/components/__tests__/ConfigurationPanel.test.tsx`
- Renders the 3 sections
- Start Game disabled when no color selected
- Start Game calls `onStart` with the chosen color
- Backdrop click calls `onClose`

**Files touched:** `src/components/ConfigurationPanel.tsx`, `src/components/__tests__/ConfigurationPanel.test.tsx`, `src/app/page.tsx`, `src/components/CONTEXT.md`
**Tests:** the new ConfigurationPanel test
**Verify:** `npm test -- ConfigurationPanel` passes; manual browser test

---

## Phase 7 — Online (Duo) Color Support

**Goal:** Duo mode color picker for host, automatic opposite for joiner.

### 7.1 Update `rooms` table schema (Supabase migration)
- File: `supabase/migrations/<timestamp>_add_host_color_to_rooms.sql`
- Add column: `host_color TEXT NOT NULL DEFAULT 'WHITE' CHECK (host_color IN ('WHITE', 'BLACK'))`
- (No migration needed for the game — we hardcode 'WHITE' for legacy rooms)

### 7.2 Update `src/lib/roomActions.ts`
- `createOnlineRoom({ playerId, timeSeconds, hostColor })` writes `host_color` to the rooms table
- `createChallenge(...)` in `src/lib/challenges.ts` accepts `hostColor` and includes it in the challenge payload

### 7.3 Update `src/app/page.tsx` slot assignment
- When joiner enters a room: read `room.host_color` and assign joiner to the opposite team (currently the joiner gets WHITE if there's space, BLACK otherwise — needs to be reversed based on host's choice)

### 7.4 Update `handleRoomJoined` and `handleStartOnline`
- Read `selectedColor` from localStorage
- Pass to `createOnlineRoom` / `createChallenge` as `hostColor`
- Include in the room URL: `/game?…&team=${resolvedColor === 'white' ? 'WHITE' : 'BLACK'}`

**Files touched:** `supabase/migrations/`, `src/lib/roomActions.ts`, `src/lib/challenges.ts`, `src/app/page.tsx`
**Tests:** integration test for `createOnlineRoom` with hostColor
**Verify:** manual 2-session test: host picks Black, joiner gets White

---

## Phase 8 — Polish & Edge Cases

**Goal:** Handle viewport edge cases, error states, and final integration.

### 8.1 Mobile viewport < 700px height
- Use `useIsMobile` width check (Tailwind `md:` breakpoint) AND a height check via `useViewportSize` (if not present, create a simple hook)
- If too small: fall back to prev/next bot difficulty (the old design) AND collapse the color picker to a single dropdown (out of scope for v1 — just keep 3 cards; users on tiny viewports will scroll)

### 8.2 Update `WelcomeDisclaimer` component (if needed)
- The welcome page is used for both online and offline. The "Botmate" label is hardcoded for offline. The color picker isn't shown there — user picks color on the home screen before clicking Play. No changes needed to the welcome page UI.

### 8.3 Update `Game.tsx` `myTeamRef` and `boardOrientation`
- `myTeamRef` is already derived from `team` prop (line 179) and updated from `g.getTeam()` (line 1211). Now `g.getTeam()` returns the right color based on `LocalGame.getPlayerColor()`, so this is automatic.
- `boardOrientation` (line 1968) is `isFourPlayer && myTeamRef.current === 'BLACK' ? 'black' : 'white'`. For offline, the orientation should be `'black'` whenever the human picked Black, regardless of 4-player. Update the condition.

### 8.4 Update `BoardTopBar` derivation
- The current code labels bots by team color (WhiteBot/BlackBot) — this is already correct. The team assignment is what changes. No code changes needed, but verify with a manual test.

### 8.5 Update `PendingMovesRow` labels
- Already uses `myTeam` for label determination. No changes needed.

### 8.6 Update `GameOverModal`
- Shows winner (White/Black) based on chess rules — already correct.

### 8.7 Add a feature flag
- `chessduo_color_picker_enabled` (default `true` for v1 since this is a single PR)
- Wrap `ColorPicker` and the color-related UI in a check

**Files touched:** `src/components/Game.tsx`, `src/hooks/useViewportSize.ts` (new if missing), `src/lib/featureFlags.ts` (or wherever flags live)
**Tests:** visual check on small viewports
**Verify:** manual test on iPhone SE, iPhone 12 Pro, desktop Chrome, iPad

---

## Phase 9 — Documentation

**Goal:** Update CONTEXT files to reflect the new architecture.

### 9.1 Update `src/components/CONTEXT.md`
- Add `SidebarNav`, `ConfigurationPanel`, `ColorPicker` to the file table
- Add "Recent Changes" entry

### 9.2 Update `src/app/CONTEXT.md`
- Note the new color picker and home page changes

### 9.3 Update `src/features/shared/CONTEXT.md`
- Note the new `PlayerColor` type and constants

### 9.4 Update `src/app/(main)/CONTEXT.md`
- Note the new sidebar in the layout

**Files touched:** 4 CONTEXT.md files
**Verify:** visual diff

---

## Phase 10 — Pre-commit checks

**Goal:** Final validation before PR.

### 10.1 Type check
- `npx tsc --noEmit` — must pass

### 10.2 Lint
- `npm run lint` — must pass (or whatever the project's lint command is)

### 10.3 Tests
- `npm test` — all tests pass, no new failures

### 10.4 Manual test checklist
- [ ] Mobile (Capacitor): Quick Play → Got it → game starts, not home (bug fix)
- [ ] Mobile (Capacitor): Duo → Got it → online room creation
- [ ] Mobile: Quick Play, color = White → game starts with White pieces
- [ ] Mobile: Quick Play, color = Black → game starts with board flipped, human on Black
- [ ] Mobile: Quick Play, color = Random → game starts, color is one of the two
- [ ] Mobile: 4 Player card → existing 4-player flow, no color picker
- [ ] Mobile: iPhone SE viewport — no truncation
- [ ] Browser (Chrome desktop): Quick Play → ConfigurationPanel → pick color → Start Game
- [ ] Browser: 4 Player card → no ConfigurationPanel
- [ ] Browser: Duo → ConfigurationPanel → host picks Black, joiner gets White (two-browser test)
- [ ] Browser: Sidebar nav highlights active tab on /, /history, /friends, /profile
- [ ] Browser: No bottom nav on /game, /duel
- [ ] Replay: existing flow still works
- [ ] 1v1 Duel: existing flow still works
- [ ] Friends panel: no regression

---

## Estimated Effort

| Phase | Complexity | Notes |
|-------|------------|-------|
| 0     | Trivial    | Types only |
| 1     | Small      | Bug fix, isolated |
| 2     | Medium     | Touches game engine, Game.tsx, MoveInsights |
| 3     | Small      | Pure component |
| 4     | Small      | Wire to home page |
| 5     | Small      | New component + layout tweak |
| 6     | Medium     | New component + browser logic |
| 7     | Medium     | Database migration + online flow |
| 8     | Small      | Edge cases |
| 9     | Trivial    | Docs only |
| 10    | Trivial    | Verification |

**Total: ~3–4 days of focused work for one developer, including manual testing.**

---

## Risks

1. **MoveComparison slot mapping** — getting the "You matched engine" / "teammate matched" labels right after color swap is the trickiest part. Need careful manual testing of accuracy panels.
2. **Supabase migration** — adding a column to `rooms` requires a deployed migration. Need to coordinate with the database owner.
3. **Mobile truncation** — iPhone SE and similar small viewports may not have enough height for the new content. Have a fallback ready.
4. **4-player flow** — explicitly excluded from color swap, but we need to make sure the new color picker doesn't accidentally appear in that flow.
5. **Replay view** — replays are saved with team assignments from the original game. Loading an old replay should still work (no color migration needed since the team is encoded in the saved moves).
