# AI Coach Home Cascade Audit

## 1. Current AI Coach flow (before fix)

- Home (`src/app/page.tsx`) rendered AI Coach `GameModeCard` with `onClick={handleStartCoach}` — direct `router.push('/coach?level=&color=')`, no `selected` state.
- `/coach` (`src/app/coach/page.tsx`) always started in `phase='setup'`, rendering `CoachSetup` (ColorPicker + BotDifficultyGrid + Start AI Coach) inside `CoachGate`, then `CoachGame` on Start.
- Perceived UX: Home → (navigation) → AI Coach setup screen → game. No inline Home expansion.

## 2. Quick Play cascade implementation

- State: `selectedGameMode: 'quick'|'duo'|'four'|null` + `handleGameModeClick()` first-tap selects, `handlePlay()` dispatches to `handleStartOffline()`.
- Mobile: `AnimatePresence > motion.div {opacity,height} 0.3s easeInOut` below mode cards renders `BotDifficultyGrid` + description + `ColorPicker` in `rounded-[28px]` card; fixed bottom blue `Start Game` CTA.
- Desktop: same cards left; inline `Play` under cards + right side panel `AnimatePresence width 0→360` with `ConfigurationPanel` (same controls + Game Settings).
- Card: `GameModeCard` blue highlight when `selected`; `dark:` variants; `min-h-[44px+]` targets; `text-[11px]/text-xs`.

## 3. Duo cascade implementation

- Identical mechanism to Quick Play — only `selectedGameMode==='duo'`, different icons/subtitle, dispatch to `handleTwoPlayerClick()`. No separate component/animation/route. Selecting another mode replaces state; `AnimatePresence exit` collapses.

## 4. Recently introduced AI Coach setup implementation

- `src/components/difficultyLevels.ts` (`DIFFICULTY_LEVELS` + `SELECTED_LEVEL_KEY` shared with Home).
- `src/components/BotDifficultyGrid.tsx` extracted verbatim from Home selector.
- `src/components/coach/CoachSetup.tsx` (ColorPicker + grid + description + Start CTA, light/dark, 44px targets).
- `src/app/coach/page.tsx` `setup|playing` phase inside `CoachGate`; Start persists to shared localStorage keys, resolves `random` via `resolvePlayerColor`, mounts `CoachGame {playerColor, botLevel}`.
- Correct config, wrong presentation location (separate route phase instead of Home cascade).

## 5. Why it created an intermediate screen

- Home Coach card bypassed `selectedGameMode` entirely (`handleStartCoach` on click) so the existing `selectedGameMode && !=='four'` cascade never rendered for Coach.
- `/coach` defaulted `phase='setup'`, forcing a second setup screen even though Home already held `selectedLevel/selectedColor`.

## 6. Components responsible

- `src/app/page.tsx`: `selectedGameMode`, `handleGameModeClick`, `handlePlay`, `handleStartCoach`, `GameModeCard`, mobile cascade, desktop right panel, both CTAs, `useCapacitorBackButton`.
- `src/app/coach/page.tsx`: `validLevel/validColor`, `phase`, `handleStart`, auth `?redirect=` resume.
- `src/components/coach/CoachSetup.tsx`, `CoachGate.tsx`, `BotDifficultyGrid.tsx`, `ColorPicker.tsx`, `ConfigurationPanel.tsx`, `difficultyLevels.ts`, `gameConstants.ts` (`SELECTED_COLOR_KEY`, `resolvePlayerColor`).

## 7. Minimal presentation change required (done)

- `src/app/page.tsx` only:
  - `selectedGameMode` extended with `'coach'`; `handleGameModeClick('coach')` selects (second tap no-op like quick/duo).
  - Coach card now `onClick={() => handleGameModeClick('coach')} selected={...}` (keeps `premium`, `showStar`, trial subtitle).
  - Existing mobile/desktop cascade conditions (`!== 'four'`) auto-include coach — no new animation.
  - Both CTAs include `coach`; label `Start AI Coach`; `handlePlay` adds `case 'coach': handleStartCoach()`.
  - `handleStartCoach` builds same URL + `&from=home`; auth `navigate` pending action unchanged.
  - `useCapacitorBackButton` collapses `selectedGameMode` before returning false (prevents hardware-Back app exit while cascade expanded).
- `src/app/coach/page.tsx` (5-line guard):
  - `fromHome = searchParams.get('from')==='home'`; `phase` initialises to `'playing'` when true, `'setup'` otherwise (deep-links/bookmarks/auth-resume without flag keep setup fallback).
  - Auth redirect round-trips `&from=home`.
- No new route, no `window.location/history` changes, Home stays `/` during expansion.

## 8. Components reused

- `GameModeCard`, `BotDifficultyGrid`, `ColorPicker`, `DIFFICULTY_LEVELS`, `ConfigurationPanel`, `TimePills`, `HeaderBar`, `HomeBottomNav/DesktopSidebar`, framer-motion cascade, trial subtitle logic.

## 9. Components intentionally untouched

- `CoachGate` (premium/trial/locked + `/premium` CTA), `CoachGame/Engine/analysis/voice/persistence/trial`, `difficulty.ts` engine mapping, `ChessBot`/Stockfish, timers, Supabase/Realtime, billing/AdMob, auth service, middleware, invite/room-code/challenge flows, `CoachSetup` (kept as deep-link fallback).
- Game config semantics unchanged: White/Black/Random + levels 1-5, defaults (level 3, white), shared localStorage keys, `resolvePlayerColor(random)` once in `/coach`.

## Verification

- `npx tsc --noEmit`: pass.
- `npm test -- src/components/coach src/features/coach`: 9 suites / 66 tests pass.
- Full `npm test`: 137 pass; 4 failing suites (`ConfirmMoveBar`, `SidebarNav`, `server/engine` LRUCache, `BillingDiagnostics`) reproduce on clean tree — pre-existing, unrelated.
- Manual matrix to confirm on device: Quick unchanged; Duo unchanged; Coach expands inline (no URL change until Start); White/Black/Random + level reach bot via `/coach?level=&color=&from=home`; mode-switch collapses; locked user still hits Upgrade gate; light/dark + mobile/desktop; hardware Back collapses cascade (no app exit); browser Back/history/auth/invite unaffected.
