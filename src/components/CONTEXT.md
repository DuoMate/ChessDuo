# Module: React Components

## Purpose
All React components — co-located by feature, not by type. Components handle rendering, user interaction, and bridge between pages and domain logic in `features/`.

## Key Files
| File | Purpose |
|------|---------|
| `Game.tsx` | Main 2v2 game shell (online + offline) — board-page revamp v2 |
| `DuelGame.tsx` | 1v1 duel mode — board-page revamp v2 |
| `ChessBoard.tsx` | Chess board with annotation arrows |
| `MobileChessBoard.tsx` | Touch-optimized board for Capacitor |
| `GameOverModal.tsx` | End-game result modal |
| `GameLobby.tsx` | Matchmaking lobby |
| `GameLoading.tsx` | Pre-game waiting state |
| `GameMenu.tsx` | In-game menu (resign, settings) |
| `MovePlayback.tsx` | Turn timeline scrubber |
| `MoveComparison.tsx` | Side-by-side accuracy comparison |
| `TeamTimer.tsx` | Team-level countdown timer |
| `MatchTimer.tsx` | Match-level countdown timer (circular SVG) |
| `TeamIndicator.tsx` | Team crown/bot icons — legacy, replaced by `BoardTopBar` |
| `TurnStatusArea.tsx` | Turn phase indicator |
| `CapturedPieces.tsx` | Captured pieces display |
| `PromotionModal.tsx` | Pawn promotion selector |
| `Auth.tsx` | Login/signup form |
| `ChooseUsername.tsx` | Username selection post-signup |
| `WelcomeDisclaimer.tsx` | First-time welcome modal |
| `GameTour.tsx` | Onboarding tutorial |
| `ChallengePicker.tsx` | Challenge mode/time picker |
| `InsightsGate.tsx` | Premium insight gate |
| `SettingsPanel.tsx` | Settings slide-over |
| `ProfilePanel.tsx` | Profile + stats view |
| `HistoryPanel.tsx` | Match history list |
| `FriendsPanel.tsx` | Friends list + requests + chat |
| `ChatPanel.tsx` | In-app messenger |
| `BottomNav.tsx` | Mobile bottom navigation (used by DuelGame/ReplayView) |
| `MobileStatusBar.tsx` | Mobile safe-area wrapper |
| `NetworkOverlay.tsx` | Offline connection banner |
| `ErrorBoundary.tsx` | React error boundary |
| `Toast.tsx` | Toast notification system |
| `SlideOver.tsx` | Generic slide-over container |
| `ResignConfirmModal.tsx` | Resign confirmation |
| `LeaveConfirmModal.tsx` | Leave game confirmation |
| `MatchmakingQueue.tsx` | Queueing UI |
| `AnalyzingIndicator.tsx` | Stockfish thinking spinner |
| `EvaluatingLoader.tsx` | Full-screen evaluation loader |
| `BoardTopBar.tsx` | **Board-page revamp** — team avatars row + center timer card |
| `TeamHexagon.tsx` | **Board-page revamp** — decorative team-position hexagon |
| `PendingMovesRow.tsx` | **Board-page revamp** — Your Move / Teammate status cards |
| `ConfirmMoveButton.tsx` | **Board-page revamp** — gated by `useSettings().confirmMove` |
| `MoveResolvedCard.tsx` | **Board-page revamp** — 3-column resolution modal |
| `RoundHistorySidebar.tsx` | **Board-page revamp** — right-side panel of past rounds |
| `BoardBottomNav.tsx` | **Board-page revamp** — 5-tab in-game nav (Moves / Game / Surrender / Insights / Chat) |

## Logic & Decisions
- Components access game logic through `GameInterface` — never use `as any`.
- All game events displayed via `useGameToast()` — no `alert()` or `console.log` for user messages.
- Every component has `dark:` variants for background, text, and borders.
- Interactive elements: `min-h-[44px] min-w-[44px]`.
- No hardcoded hex colors — Tailwind classes only.
- Co-located `__tests__/` directory for component tests.

## Board Page Revamp (2026-07-12)
- Dark glassmorphism theme (`#0a0e1a` background + slate-900/70 cards + backdrop-blur).
- Chess board sized to ~80% of viewport (`maxWidth: min(95vw, 80vh, 720px)`).
- New layout shell: `BoardTopBar` (compact team avatars + center timer) → turn pill → board → `PendingMovesRow` → `ConfirmMoveButton` → `BoardBottomNav`.
- New `confirmMove` setting (off by default) gates `handleMove` so the move is held until the user taps Confirm.
- `MoveResolvedInline` (was `MoveResolvedCard`) renders below the `PendingMovesRow` when `accuracyComparison` is available, with insights-style phrasing (move impact, sync/winner line, blunder warning, quality verdict).
- `RoundHistorySidebar` is a right-side slide-over opened by the Moves tab.
- `BoardBottomNav` replaces the old `BottomNav` in `Game.tsx`. 5 tabs: Moves / Game / Surrender (center) / Insights / Chat. DuelGame and ReplayView use a simplified variant.
- `AccuracyBottomSheet` removed from the board page (logic moved into `MoveResolvedInline`). `TeamIndicator` retained for backward compat but no longer rendered in `Game.tsx`.

### Quick Play team composition (visible layout)
- White side: user (You) + 1 bot tile labelled "WhiteBot".
- Black side: 1 bot tile labelled "BlackBot".
- Even though the `LocalGame` engine still spawns 4 placeholders (`player1`-`player4`) for compatibility with `startMatch()`'s "2 players per team" invariant, the `BoardTopBar` derivation collapses the visual to a single bot per side. The two black bots would have played identical moves anyway, so the second one is hidden.

### Online / Duo / 4-player modes
- Duo / Four-Player: real online teammates or online opponent — labels are pulled from `teamLabels` parser (e.g. "Alice" / "Bob"). Multiple human tiles are kept.
- DuelGame (1v1): the BoardTopBar shows You vs Opponent with their Google profile images (when signed in).

## Recent Changes
- **2026-07-13**: Fixed RoundHistorySidebar close button to 44×44px touch target. Replaced hardcoded rgba shadows in `ConfirmMoveButton` and `MoveResolvedInline` with CSS variable references (`--shadow-glow-emerald`, `--shadow-glow-emerald-strong`).

## Dependencies
- `features/` for game logic, `hooks/` for React hooks, `lib/` for utilities
- `cm-chessboard` for board rendering, `chess.js` for move validation
