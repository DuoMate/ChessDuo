# AI Coach Setup Audit — Game Setup Consistency + Bot Difficulty

Date: 2026-09-17 | Branch: develop | Author: OpenCode

## 1. Current AI Coach flow

```
Home (SetupPage, src/app/page.tsx)
 → handleStartCoach() [page.tsx:894-902] — direct navigate, NO setup UI
 → /coach?level=${selectedLevel}&color=${selectedColor}
 → src/app/coach/page.tsx:21-24 parses level (clamp 1..6, default 3) + color (default 'white', resolvePlayerColor once)
 → CoachGate [src/components/coach/CoachGate.tsx] — premium/trial gate (fail-closed)
 → CoachGame [src/components/coach/CoachGame.tsx:130] new CoachGameEngine({playerColor: 'b'|'w', botLevel})
 → CoachGame [src/features/coach/coachGame.ts:78-84] playerColor ?? 'w', botLevel ?? 3, new ChessBot({skillLevel: botLevel})
```

The `level`/`color` in the URL are invisible stale home state — the user never picks them for Coach explicitly.

## 2. Quick Play configuration flow (existing working implementation)

```
Home state: selectedLevel (default 3, key chessduo_selected_level), selectedColor (default 'white', key SELECTED_COLOR_KEY), selectedTime
 → UI: BotDifficultySelector (local fn page.tsx:1541-1586, 5-card Easy/Medium/Hard/Expert/Master 1-5)
 → UI: ColorPicker (src/components/ColorPicker.tsx, 3-card White/Black/Random)
 → URL: /game?level=&time=&color= [page.tsx:785]
 → src/app/game/page.tsx:19,28-31 → <Game level playerColor>
 → Game.tsx:196-207 createBotConfig(level,level) → 209-220 createBot({skillLevel})
 → ChessBot + src/features/bots/difficulty.ts (6 engine tiers, UI uses 1-5)
 → LocalGame(time, playerColor) resolves color once [localGame.ts:39-40], slots via getHumanSlot/getTeammateSlot
```

## 3. Duo configuration flow

Same home UI/selections as Quick Play. `handleStartOnline` passes `hostColor: selectedColor` to `createOnlineRoom` [page.tsx:768]; difficulty is NOT carried in the online URL — `Game.tsx` falls back to `botEloLevel` state (default 4) or env `getBotConfig()` (4/4). Online bots run coordinator-side only.

## 4. Shared difficulty mechanism (ONE SOURCE OF TRUTH)

- `src/features/bots/difficulty.ts:12-73` — `DIFFICULTY: Record<number, DifficultyConfig>` (elo/depth/topMoves/noise/weights/blunderChance/weirdChance/maxDrop), 6 tiers.
- `src/features/bots/difficulty.ts:75-82` — `DESCRIPTIONS` (Beginner ~1000 … Master ~2600).
- `src/features/bots/chessBot.ts` — `constructor({skillLevel = 3})`, `createBot({skillLevel ?? 3})`, consumes `DIFFICULTY[skill] || DIFFICULTY[4]`. Opening book only when `skillLevel <= 3`.
- `src/features/bots/botConfig.ts` — `BotSkillConfig/createBotConfig/getBotConfig` (env defaults 4/4), `getAvailableSkillLevels()` 6-tier (legacy UI only).
- `src/features/shared/gameConstants.ts:57-72` — `PlayerColor/ResolvedColor/DEFAULT_PLAYER_COLOR/SELECTED_COLOR_KEY/resolvePlayerColor()`. `BROWSER_BOT_LEVEL = 3` is dead (zero references).
- NOTE: `BrowserMoveEvaluator.evaluateMoves(moves, fen, depth, elo)` IGNORES depth/elo (fixed MultiPV=6, movetime 3000ms). Difficulty steers ChessBot humanization only. Do not "fix".

## 5. Current hard-coded AI Coach difficulty + color

| Location | Hard-code |
|---|---|
| `features/coach/coachGame.ts:80-81` | `playerColor ?? 'w'`, `botLevel ?? 3` |
| `features/coach/coachGame.ts:83` | `new ChessBot({skillLevel: this.botLevel})` (correct wiring, wrong source — silent default) |
| `components/coach/CoachGame.tsx:41` | `botLevel = 3` prop default |
| `app/coach/page.tsx:22-24` | `level … \|\| 3) : 3`, `colorParam ?? 'white'` |
| `app/page.tsx:115,125` | `getInitialLevel() → 3`, `getInitialColor() → DEFAULT_PLAYER_COLOR ('white')` |
| `features/bots/chessBot.ts:16,507` | `{skillLevel: 3}` / `?? 3` fallbacks; invalid → `DIFFICULTY[4]` |
| `features/coach/coachEngine.ts` | `DEFAULT_MOVETIME_MS=1500` advisory analysis — INTENTIONALLY FIXED (not opponent strength) |

## 6. Color assignment mechanism (existing, reused as-is)

`resolvePlayerColor(color)` [gameConstants.ts:67-72]: `'random' → Math.random()<0.5 ? 'white':'black'`, else passthrough. Coach page already calls it once at entry; the setup step re-uses it per game start (re-resolve when raw choice is `random`).

## 7. Reuse strategy (decisions: setup inside /coach; 5 home-UI levels; rematch preserves)

- NO new route. `src/app/coach/page.tsx` keeps URL parsing as deep-link/initial values; after `CoachGate` passes, new `phase: 'setup'|'playing'` state renders `CoachSetup` → `Start` mounts `CoachGame` with explicit `{playerColor: resolved, botLevel}`.
- Extract `BotDifficultyGrid` (from `page.tsx:1541-1586`) to `src/components/BotDifficultyGrid.tsx` + export `DIFFICULTY_LEVELS` from a shared module; home + CoachSetup consume the same component/levels (1-5 Easy…Master).
- Reuse `ColorPicker` unmodified; reuse `PlayerColor/ResolvedColor/resolvePlayerColor/DEFAULT_PLAYER_COLOR/SELECTED_COLOR_KEY` + home localStorage keys for setup defaults.
- `CoachGame`/`CoachGameEngine` keep defensive `?? 3`/`?? 'w'` fallbacks but production path always passes explicit values; rematch = new engine instance with same level + re-resolved color.
- Isolation preserved: Coach never implements `GameInterface`, never imports localGame/onlineGame/gameState. Only `ChessBot + difficulty.ts + gameConstants.ts` (read-only) cross the boundary.

## 8. Files that need modification

1. `src/components/BotDifficultyGrid.tsx` (NEW) + `src/components/difficultyLevels.ts` (NEW, shared `DIFFICULTY_LEVELS`)
2. `src/app/page.tsx` — consume shared grid/levels (no visual change)
3. `src/components/ConfigurationPanel.tsx` — consume shared `difficultyLevels` type (no visual change)
4. `src/components/coach/CoachSetup.tsx` (NEW) — setup screen
5. `src/app/coach/page.tsx` — `setup|playing` phase inside `CoachGate`
6. `src/components/coach/CoachGame.tsx` — explicit props (defensive defaults retained)
7. `src/features/coach/coachGame.ts` — document explicit-config contract (no algorithm change)
8. Tests: `BotDifficultyGrid.test.tsx`, `CoachSetup.test.tsx`, coach config tests
9. `src/components/CONTEXT.md`, `src/app/CONTEXT.md`, `src/features/coach/CONTEXT.md` — Recent Changes entries

## 9. Files intentionally left untouched

`difficulty.ts`, `botConfig.ts`, `chessBot.ts` (algorithm), `coachEngine.ts`, `coachAnalysis.ts`, `localGame.ts`, `onlineGame.ts`, `GameInterface.ts`, `gameConstants.ts`, `Game.tsx`, `DuelGame.tsx`, `CoachGate.tsx` (logic), billing/trial, Supabase/migrations, Stockfish workers, timers/sync, routes/middleware, auth/OAuth, ads.
