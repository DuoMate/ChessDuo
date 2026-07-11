# Module: React Components

## Purpose
All React components — co-located by feature, not by type. Components handle rendering, user interaction, and bridge between pages and domain logic in `features/`.

## Key Files
| File | Purpose |
|------|---------|
| `Game.tsx` | Main 2v2 game shell (online + offline) |
| `DuelGame.tsx` | 1v1 duel mode |
| `ChessBoard.tsx` | Chess board with annotation arrows |
| `MobileChessBoard.tsx` | Touch-optimized board for Capacitor |
| `GameOverModal.tsx` | End-game result modal |
| `GameLobby.tsx` | Matchmaking lobby |
| `GameLoading.tsx` | Pre-game waiting state |
| `GameMenu.tsx` | In-game menu (resign, settings) |
| `MovePlayback.tsx` | Turn timeline scrubber |
| `MoveComparison.tsx` | Side-by-side accuracy comparison |
| `AccuracyBottomSheet.tsx` | Move accuracy breakdown (mobile) |
| `TeamTimer.tsx` | Team-level countdown timer |
| `MatchTimer.tsx` | Match-level countdown timer |
| `TeamIndicator.tsx` | Team crown/bot icons |
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
| `BottomNav.tsx` | Mobile bottom navigation |
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

## Logic & Decisions
- Components access game logic through `GameInterface` — never use `as any`.
- All game events displayed via `useGameToast()` — no `alert()` or `console.log` for user messages.
- Every component has `dark:` variants for background, text, and borders.
- Interactive elements: `min-h-[44px] min-w-[44px]`.
- No hardcoded hex colors — Tailwind classes only.
- Co-located `__tests__/` directory for component tests.

## Dependencies
- `features/` for game logic, `hooks/` for React hooks, `lib/` for utilities
- `cm-chessboard` for board rendering, `chess.js` for move validation
