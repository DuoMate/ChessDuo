# Quick Play — "Play My Move" Triage (opt-in gameplay variant)

> Branch: `feat/quick-play-play-my-move` · Date: 2026-09-21 · Scope: Quick Play only.
> Default OFF. Zero change to existing behavior when OFF. App is in prod.

## 1. Current Quick Play move lifecycle

Quick Play is the **offline `LocalGame`** 2v2: the human + a teammate bot vs two
opponent bots. `/game` with **no `mode`** → `mode=null` → `isOnline=false` →
`Game.tsx:144` `new LocalGame(timeLimitSeconds, playerColor)`. Duo/4-Player pass
`mode=online` (`OnlineGame`), Duel uses `DuelGameEngine`, Coach uses
`CoachGameEngine` — none instantiate `LocalGame`.

Human-team turn (`Game.tsx:1950‑2099`):
1. Human move validated (`uciToSan`/`getMoveFromUci`) → `g.startPendingTurn()` →
   `g.setPendingMove(humanSlot, san, …)`.
2. Teammate bot: `teammateBot.selectBestMove(fen)` → `g.setPendingMove(teammateSlot, …)`
   + `lockPendingMove`.
3. Human move locked → 800 ms → `checkAndResolve()` → `LocalGame.resolvePendingMoves()`.

Opponent-team turn: `executeBotMove()` (`Game.tsx:1457`) sets **both** opponent
slots to the same move → `isSync` path.

## 2. Exact bot-resolution point ("which move is played")

`src/features/offline/game/localGame.ts:234‑422`:
- `pendingMoves.human` / `.teammate` → `player1Move` / `player2Move`
  (`pendingMoves.human` is `currentPlayers[0]`, the human slot by construction —
  verified for both colors).
- Checkmate short-circuits: player1 (`:282‑299`) then **player2 (`:302‑319`)**.
- `evaluator.evaluateMoves([player1Uci, player2Uci], turnStartFen)` (Stockfish WASM).
- **Winner (`:361`)**: `player1Loss < player2Loss ? player1Move : (player2Loss < player1Loss ? player2Move : player1Move)` — the teammate bot's move can override the human's.
- Writes `_lastMoveComparison { winningMove, loserId, loserFrom/To, bestEngineMove, … }`
  then `gameState.resolve(winningMove)` (`gameState.ts:284`) applies the SAN.

## 3. Existing shadow mechanism (reuse — do NOT create another)

The rejected move is `_lastMoveComparison.loserFrom/loserTo`; `Game.tsx` derives
`MoveEntry.shadowMove` (`:1512/2074`), rendered by the `ChessBoard` retraction
animation and `MovePlayback` as a parenthetical hint. When the human move is
forced, the loser is player2 (the bot) → the bot's move becomes the shadow.

## 4. Settings architecture

`src/lib/settingsStorage.ts` (`Settings`, `DEFAULTS`, key `chessduo_settings`) →
`src/hooks/useSettings.ts` → UI. `ConfigurationPanel.tsx` (Home) is the Quick
Play configuration surface (bot difficulty / color / confirm / sound) and is the
chosen location (Quick-Play-only). Analytics: none exists in the repo → skipped.

## 5. Session snapshot / new-game boundary

`Game.tsx:144` creates the game **before** `useSettings()` (line 234), so the
snapshot reads `getSetting('playMyMove')` directly at construction. The flag is
immutable per `LocalGame`, so changing the setting affects only the next game.

## 6. Persistence / replay

`MoveEntry.winningMove` + `fenAfter` drive `ReplayView`; `shadowMove` is stored
separately and never applied. Forcing the human move keeps replay/history to the
actual played move. No schema change.

## 7. Timer / game-over

Timers live in `Game.tsx` (untouched). Game-over is derived from
`board.isGameOver()` after `gameState.resolve(winningMove)` (untouched).

## 8. Strict-scoping proof

- New behavior is enclosed in `LocalGame.resolvePendingMoves()` behind
  `this._playMyMove` (set only for Quick Play) **and** `currentTeam === humanTeam`.
- Only `LocalGame` is affected; all other modes use different engines.
- Default `false` → the branch is unreachable for existing installs.

## 9. Proposed minimal implementation

- `settingsStorage`: `playMyMove` default `false`; `useSettings` exposes it.
- `ConfigurationPanel`: optional `showPlayMyMove` + a switch (Quick Play only).
- `localGame`: `_playMyMove` constructor param; `forcePlayerMove` guard; skip the
  player2 checkmate short-circuit when forced; force `winningMove`/`winnerId`/
  `loserId`/`loserFrom`/`loserTo` to the human/player2 pairing. Everything else
  (comparison, `gameState.resolve`, stats, game-over) unchanged.
- `Game.tsx`: `new LocalGame(time, color, !isOnline && !fourplayer && getSetting('playMyMove'))`.

## 10. Rollback

Flip the default to `false` (or revert the branch). No DB/env/CI changes.

## 11. Implementation result

Shipped (branch `feat/quick-play-play-my-move`):

- **Setting** — `Settings.playMyMove` (default `false`) in `settingsStorage.ts`;
  `useSettings` exposes `playMyMove`/`setPlayMyMove`; Home `ConfigurationPanel`
  gained an optional `showPlayMyMove` prop and the **PLAY MY MOVE** switch
  ("Your move is always played. The bot shows its best move as a hint."),
  rendered only for Quick Play (`page.tsx` passes
  `showPlayMyMove={selectedGameMode === 'quick'}`). Not added to `SettingsPanel`.
- **Snapshot** — `Game.tsx` constructs
  `new LocalGame(timeLimitSeconds, playerColor, !fourplayer && getSetting('playMyMove'))`;
  held immutably in `LocalGame._playMyMove`.
- **Resolution** — `LocalGame.resolvePendingMoves()`:
  `forcePlayerMove = _playMyMove && currentTeam === humanTeam`; when true
  `winningMove`/`winnerId`/`loserId`/`loserFrom`/`loserTo` are forced to the
  human/player2 pairing and the teammate checkmate short-circuit is skipped.
  `gameState.resolve(winningMove)`, `_lastMoveComparison`, stats, game-over,
  timers, persistence unchanged.
- **Shadow** — the existing `loserFrom/To` → `ChessBoard` retraction +
  `MovePlayback` hint; no new mechanism.
- **Analytics** — skipped (no analytics SDK in the repo).

## 12. Test results

- `src/lib/__tests__/localGame.test.ts` — new `Play My Move` block: default ctor
  OFF; OFF lets the bot override; ON forces the human move (winnerId player1,
  loserId player2, board reflects the player move, `bestEngineMove` populated);
  opponent turns unaffected.
- `src/lib/__tests__/settings.test.ts` — `playMyMove` defaults false and
  persists via `useSettings`.
- `src/components/__tests__/ConfigurationPanel.test.tsx` — the switch renders
  only for Quick Play and toggles.
- `npx tsc --noEmit` clean (pre-existing `coachVoice` only); full `npm test` no
  new failures.

## 13. Cross-mode regression

Duo / 4-Player / 1v1 / AI Coach use `OnlineGame` / `DuelGameEngine` /
`CoachGameEngine` and never construct `LocalGame`, so they are unreachable by
the new branch. Default OFF keeps existing Quick Play identical.

## 14. Remaining validation (owner/device)

Real-device pass: Quick Play OFF (identical) and ON (player move applied, bot
shadow hint) + one regression pass each through Duo / 4 Player / AI Coach.
