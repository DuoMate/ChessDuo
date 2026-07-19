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
| `InsightsGate.tsx` | Premium insight gate — uses `SubscriptionService.isPremium()` |
| `SettingsPanel.tsx` | Settings slide-over |
| `ProfilePanel.tsx` | Profile + stats view — uses `SubscriptionService.isPremium()` for premium status |
| `HistoryPanel.tsx` | Match history list — dark theme redesign |
| `FriendsPanel.tsx` | Friends list + requests + chat — dark theme redesign |
| `ChatPanel.tsx` | In-app messenger |
| `InitialsAvatar.tsx` | **NEW** — Shared initials avatar component (sm/md/lg sizes, online indicator, premium variant) |
| `ColorPicker.tsx` | **NEW** — 3-card White/Black/Random selector with Lucide icons. Used inline on the home screen configuration panel. |
| `DesktopSidebar.tsx` | **NEW** — Left vertical navigation for browser viewports (Home/History/Friends/Profile, 220-240px wide, fixed). Replaces `SidebarNav` on `md:`+ breakpoints across all `(main)/` pages. |
| `SidebarNav.tsx` | **LEGACY** — Narrow left vertical navigation (80-88px icons only). Kept for reference; replaced by `DesktopSidebar` on all `(main)/` pages. |
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
| `BoardTopBar.tsx` | **Board-page revamp** — team avatars row + center timer card (uses InitialsAvatar for humans, images for bots) |
| `TeamHexagon.tsx` | **Board-page revamp** — decorative team-position hexagon |
| `PendingMovesRow.tsx` | **Board-page revamp** — Your Move / Teammate status cards |
| `ConfirmMoveBar.tsx` | **Board-page revamp** — floating 50/50 confirmation bar, replaces `ConfirmMoveButton.tsx` |
| `MoveResolvedCard.tsx` | **Board-page revamp** — 3-column resolution modal |
| `RoundHistorySidebar.tsx` | **Board-page revamp** — right-side panel of past rounds |
| `BoardBottomNav.tsx` | **Board-page revamp** — 5-tab in-game nav (Moves / Game / Surrender / Insights / Chat) |

## Logic & Decisions
- Components access game logic through `GameInterface` — never use `as any`.
- All game events displayed via `useGameToast()` — no `alert()` or `console.log` for user messages.
- Premium checks delegated to `SubscriptionService.isPremium()` — never query `profiles.is_premium` directly.
- Every component has `dark:` variants for background, text, and borders.
- Interactive elements: `min-h-[44px] min-w-[44px]`.
- No hardcoded hex colors — Tailwind classes only.
- Co-located `__tests__/` directory for component tests.

## Board Page Revamp (2026-07-12)
- Dark glassmorphism theme (`#0a0e1a` background + slate-900/70 cards + backdrop-blur).
- Chess board sized to ~80% of viewport (`maxWidth: min(95vw, 80vh, 720px)`).
- New layout shell: `BoardTopBar` (compact team avatars + center timer) → turn pill → board → `PendingMovesRow` → `ConfirmMoveBar` (floating overlay) → `BoardBottomNav`.
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
- **2026-07-19**: Phase 9 Confirm Moves — new `ConfirmMoveBar` floating 50/50 split bar with glassmorphism styling replaces inline `ConfirmMoveButton`. Integrated in `Game.tsx`, `DuelGame.tsx`, and 4-player mode (via Game.tsx). Toggle added to `GameMenu` hamburger dropdown. 23 new tests covering all scenarios. Deleted legacy `ConfirmMoveButton.tsx`.
- **2026-07-19**: Browser UI unification — migrated History, Friends, Profile pages from `SidebarNav` (narrow 80px icons-only) to `DesktopSidebar` (wide 220px/240px with labels). Updated `src/app/(main)/layout.tsx` to use `DesktopSidebar` for all non-game pages on desktop. Mobile unchanged (HomeBottomNav floating pill).
- **2026-07-18**: Home screen restructure — added `ColorPicker` (3-card White/Black/Random with Lucide icons), `SidebarNav` (left vertical nav for browser), inline configuration panel (Quick/Duo). Mobile `BotDifficultySelector` replaced with 5-card grid using Lucide chess-piece icons. `LocalGame` accepts `playerColor` param; bots swap teams when human picks Black. `GameInterface` gets `getPlayerColor`/`getHumanSlot`/`getTeammateSlot`. Welcome page redirect now passes color; offline auto-start effect split (runs on mount, no longer requires `playerId`) — fixes Quick Play → Got it → home bug for guest users.
- **2026-07-18**: Modal exit animations fixed — GameOverModal, ResignConfirmModal, SettingsPanel now use `open` prop pattern with AnimatePresence for proper exit animations. Game.tsx/DuelGame.tsx always render modals with `open` prop. UI/UX bug hunt: z-index standardization, text overflow fixes, emoji → Lucide icons, loading states. HomeBottomNav: spinner on navigating button, loading progress bar, pathname-based active detection. BackButton: `alwaysFallback` prop for nav pages.
- **2026-07-15**: Google Play Billing migration — `InsightsGate` and `ProfilePanel` now use `SubscriptionService.isPremium()` instead of direct `profiles.is_premium` queries. Premium checks are delegated to the provider-agnostic billing module.
- **2026-07-15**: Animation fixes — `useScrollLock` uses ref-counted lock to prevent nested overlay conflicts. `BoardTopBar` turn indicator wrapped in `AnimatePresence` so exit animation plays on turn change. `ChallengePicker` backdrop gets `motion.div` exit animation. `FriendsPanel` chat overlay gets `AnimatePresence` fade transition. `ResignConfirmModal` imports shared `MODAL_BACKDROP` constant. `GameOverModal` removes unused `isOnline`/`roomId` props.
- **2026-07-14**: Page redesign — dark navy theme (`#0a0e1a`) applied to FriendsPanel, ProfilePanel, HistoryPanel, and Premium page. New `InitialsAvatar` component for user initials (replaces emoji placeholders and image avatars in non-home contexts). BoardTopBar now uses `InitialsAvatar` for human players, retains bot images. All panels use consistent dark slate backgrounds, white/5 borders, and gradient accents.
- **2026-07-14**: `HomeBottomNav` redesigned as floating pill (rounded-2xl, centered w-[90%] max-w-xs, 12px bottom spacing, glassmorphism shadow). Samsung UI style.
- **2026-07-14**: `WelcomeDisclaimer` — added "Your Move" (green dot) + "Teammate"/"Bot" (blue dot) legend below the chess board in the instruction screen. `useCapacitorBackButton` not needed here (handled at page level).
- **2026-07-14**: `FourPlayerLobby` — added `useCapacitorBackButton` to leave room and navigate home on hardware back press.
- **2026-07-14**: `GameMenu` now accepts optional `soundEnabled`/`onToggleSound`/`onOpenProfile` props. Sound toggle and Profile buttons moved into the hamburger dropdown. Standalone sound/profile buttons removed from `Game.tsx` and `DuelGame.tsx`.
- **2026-07-13**: Fixed RoundHistorySidebar close button to 44×44px touch target. Replaced hardcoded rgba shadows in `ConfirmMoveButton` and `MoveResolvedInline` with CSS variable references (`--shadow-glow-emerald`, `--shadow-glow-emerald-strong`).

## Dependencies
- `features/` for game logic, `hooks/` for React hooks, `lib/` for utilities
- `cm-chessboard` for board rendering, `chess.js` for move validation
