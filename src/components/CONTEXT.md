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
| `TeamIndicator.tsx` | REMOVED (2026-09-18 revamp) — legacy team icons, unreferenced; `BoardTopBar` is canonical |
| `TurnStatusArea.tsx` | Turn phase indicator |
| `CapturedPieces.tsx` | Captured pieces display |
| `PromotionModal.tsx` | Pawn promotion selector |
| `Auth.tsx` | Login/signup form |
| `AuthGate.tsx` | Auth gate component (page + overlay variants) with session/username handling |
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
| `ChessDuoLogo.tsx` | In-app logo — renders image mark from `/logo.png` + "ChessDuo" text |
| `InitialsAvatar.tsx` | **NEW** — Shared initials avatar component (sm/md/lg sizes, online indicator, premium variant) |
| `ColorPicker.tsx` | **NEW** — 3-card White/Black/Random selector with Lucide icons. Used inline on the home screen configuration panel. |
| `BotDifficultyGrid.tsx` | Shared 5-card Easy/Medium/Hard/Expert/Master grid (extracted from home; consumed by home + AI Coach setup). |
| `difficultyLevels.ts` | Shared `DIFFICULTY_LEVELS` (single source of truth) + `SELECTED_LEVEL_KEY` (shared with home). |
| `DesktopSidebar.tsx` | **NEW** — Left vertical navigation for browser viewports (Home/History/Friends/Profile, 220-240px wide, fixed). Replaces `SidebarNav` on `md:`+ breakpoints across all `(main)/` pages. |
| `SidebarNav.tsx` | REMOVED (2026-09-18 revamp) — legacy 80-88px nav, unreferenced; `DesktopSidebar` is canonical |
| `BottomNav.tsx` | Mobile bottom navigation (used by DuelGame/ReplayView) |
| `MobileStatusBar.tsx` | Mobile safe-area wrapper |
| `NetworkOverlay.tsx` | Offline connection banner |
| `ErrorBoundary.tsx` | React error boundary |
| `Toast.tsx` | Toast notification system |
| `SlideOver.tsx` | Generic slide-over container |
| `ResignConfirmModal.tsx` | Resign confirmation |
| `LeaveConfirmModal.tsx` | Leave game confirmation |
| `MatchmakingQueue.tsx` | Queueing UI |
| `PageLoading.tsx` | **UNIVERSAL** — Single centralized loading component for the entire app. Renders a knight-jumping animation on a 3×3 node grid (clockwise perimeter). Auto-detects `pb-20` via `usePathname()`. All page-level loading MUST use this — never inline `<Spinner>`. |
| `EvaluatingLoader.tsx` | Full-screen evaluation loader |
| `BoardTopBar.tsx` | **Board-page revamp** — team avatars row + center timer card (uses InitialsAvatar for humans, images for bots) |
| `TeamHexagon.tsx` | **Board-page revamp** — decorative team-position hexagon |
| `PendingMovesRow.tsx` | **Board-page revamp** — Your Move / Teammate status cards |
| `ConfirmMoveBar.tsx` | **Board-page revamp** — floating 50/50 confirmation bar, replaces `ConfirmMoveButton.tsx` |
| `MoveResolvedCard.tsx` | **Board-page revamp** — 3-column resolution modal |
| `RoundHistorySidebar.tsx` | **Board-page revamp** — right-side panel of past rounds |
| `BoardBottomNav.tsx` | **Board-page revamp** — 5-tab in-game nav (Moves / Game / Surrender / Insights / Chat) |
| `NativeAdSlot.tsx` | Optional Android Native Advanced AdMob slot inside `GameOverModal` |
| `AdSenseSlot.tsx` | Optional web responsive AdSense display slot beside `NativeAdSlot` (game-over modals only) |
| `AdSenseLoader.tsx` | Web-only AdSense base-script loader (non-premium, client ID required) |
| `PipOverlay.tsx` | Live-game Android PiP compact view — FEN mini-board + turn label + clock/footer, `visible` only inside the PiP window |
| `UpdatePrompt.tsx` | Optional native-update dialog — Update/Later, ChessDuo modal styling, driven by `useAppUpdate` |
| `AppVersionLabel.tsx` | Small "ChessDuo · Version x" footer for Profile surfaces (build stamp, native `App.getInfo()` upgrade) |

## Logic & Decisions
- Components access game logic through `GameInterface` — never use `as any`.
- All game events displayed via `useGameToast()` — no `alert()` or `console.log` for user messages.
- Premium checks delegated to `SubscriptionService.isPremium()` — never query `profiles.is_premium` directly.
- Every component has `dark:` variants for background, text, and borders.
- Interactive elements: `min-h-[44px] min-w-[44px]`.
- No hardcoded hex colors — Tailwind classes only.
- Co-located `__tests__/` directory for component tests.
- **All page-level loading must use `PageLoading`** — never inline `<Spinner>` wrapped in a full-viewport div. The centralized component ensures consistent styling, dark mode, and auto-detected `pb-20` padding. See `PageLoading.test.tsx` and `PageLoadingArchitecture.test.tsx` for enforcement.

## Board Page Revamp (2026-07-12)
- Dark glassmorphism theme (`#0a0e1a` background + slate-900/70 cards + backdrop-blur).
- Chess board sized to ~80% of viewport (`maxWidth: min(95vw, 80vh, 720px)`).
- New layout shell: `BoardTopBar` (compact team avatars + center timer) → turn pill → board → `PendingMovesRow` → `ConfirmMoveBar` (floating overlay) → `BoardBottomNav`.
- New `confirmMove` setting (off by default) gates `handleMove` so the move is held until the user taps Confirm.
- `MoveResolvedInline` (was `MoveResolvedCard`) renders below the `PendingMovesRow` when `accuracyComparison` is available, with insights-style phrasing (move impact, sync/winner line, blunder warning, quality verdict).
- `RoundHistorySidebar` is a right-side slide-over opened by the Moves tab.
- `BoardBottomNav` replaces the old `BottomNav` in `Game.tsx`. 5 tabs: Moves / Game / Surrender (center) / Insights / Chat. DuelGame and ReplayView use a simplified variant.
- `AccuracyBottomSheet` removed from the board page (logic moved into `MoveResolvedInline`). `TeamIndicator` deleted (was retained for backward compat but never rendered).

### Quick Play team composition (visible layout)
- White side: user (You) + 1 bot tile labelled "WhiteBot".
- Black side: 1 bot tile labelled "BlackBot".
- Even though the `LocalGame` engine still spawns 4 placeholders (`player1`-`player4`) for compatibility with `startMatch()`'s "2 players per team" invariant, the `BoardTopBar` derivation collapses the visual to a single bot per side. The two black bots would have played identical moves anyway, so the second one is hidden.

### Online / Duo / 4-player modes
- Duo / Four-Player: real online teammates or online opponent — labels are pulled from `teamLabels` parser (e.g. "Alice" / "Bob"). Multiple human tiles are kept.
- DuelGame (1v1): the BoardTopBar shows You vs Opponent with their Google profile images (when signed in).

## Recent Changes
- **2026-09-18**: Coach confirm-move — `CoachGame` stages drops in `heldMove` when the `confirmMove` setting is on (previously ignored: instant submit, no bar). Shared `ConfirmMoveBar` + board remount on cancel (DuelGame semantics); held move cancels first on Back. Default stays OFF. Tests: `CoachGameConfirm.test.tsx`.
- **2026-09-15**: AI Coach resignation now opens the shared `ResignConfirmModal` before calling `CoachGame.resign()`. The existing terminal game-over state and ad/upgrade surface remain unchanged.
- **2026-09-13**: Web AdSense parity (`AdSenseSlot` + `AdSenseLoader`). Single manual responsive display unit beside `NativeAdSlot` in `GameOverModal`, the Coach inline modal, and the Premium upgrade screen; premium/native/missing-ID suppression mirrors native inversely; Auto ads stay off. Diagnostics distinguish game-over and upgrade surfaces. See `docs/ARCHITECTURE.md §9.1`.
- **2026-09-11**: Active-match Back/Leave now converges on the existing `GameOverModal`, matching resignation and natural game over so the shared NativeAdSlot can render before the user chooses Home. Lobby leave still navigates immediately. Native-ad diagnostics report terminal reason, load state, and render state.
- **2026-09-11**: Game-over AdMob visibility now follows `GameOverModal.open` for every terminal result. Resignation no longer navigates away before the shared result screen can display the existing ad; the ad slot cleans up when the modal closes.
- **2026-09-04**: Added an optional Android Native Advanced AdMob slot inside the existing `GameOverModal`. It is hidden on web, for premium users, and when native preload fails; existing popup controls and animations are unchanged.
- **2026-08-26**: **Castling animation fix** — castling never animated the rook/king swap because `ChessBoard.tsx` called `setPosition(fen, false)` (snapshot, `animated=false`) and the manual `movePiece(rookFrom, rookTo, true)` fallback ran *after* — the rook was already placed, so `Position.movePiece` no-op'd ("no piece on h1", swallowed). Now the `[fen]` effect animates castles via `setPosition(fen, isCastleMove(lastMove))` (cm-chessboard's position-diff slides the king + rook, 300ms default) and the dead manual effect was removed. Non-castle moves remain `animated=false` (unchanged). Shared component → Game, DuelGame, mobile, Replay all benefit. Tests: `ChessBoard.test.tsx` (animate / black queenside / `e2-e4` not-animated / no-lastMove) + `__mocks__/cm-chessboard.ts` (`mockMovePiece`).
- **2026-08-19**: **P1 — move-resolved display collapsed both submissions.** `MoveResolvedInline`'s `MoveResolutionData` was built in `Game.tsx` by blindly mapping `player1Move→yourMove` / `player2Move→teammateMove`, ignoring that `player1` is the *coordinator* (not necessarily the viewer) in online mode. Extracted a pure, exported `buildResolutionData(comparison, isPlayer1, teamColor)` in `MoveResolvedInline.tsx` that flips only the column mapping (not which move is shown) and maps `result`/accuracy/matched flags through `isPlayer1` (mirroring `AccuracyBottomSheet`). `Game.tsx` computes `isPlayer1 = !isOnline || playerId === onlineGameRef.current?.player1Id`. The independent-submission collapse itself was fixed in `onlineGame.ts` `resolvePendingMoves()` (see `features/online/game/CONTEXT.md`). Tests: `BoardPageComponents.test.tsx`.
- **2026-08-19**: **Auth — "Email not confirmed" fix.** `Auth.tsx` `signUp()` now passes `emailRedirectTo` (`/auth/callback`) so the confirmation link finalizes in Supabase; signup no longer misclassifies the confirmation-required response as "already registered" (it now checks `data.session` instead of `identities.length === 0`). Login errors are classified via `classifyAuthError` (only `email_not_confirmed` → "Email not confirmed") and `signInWithPassword`/`signUp` emit safe `[AUTH_DEBUG]` logs (hashed user id, project ref; no secrets). See `src/lib/CONTEXT.md`.
- **2026-08-19**: **Resigner now persists history before navigating away.** `Game.tsx` passes `roomId` into `saveCompletedGame` for online games and `handleResign` waits (bounded 2s) for the game-over save effect (`gameSavedRef`) before `router.replace('/')`, instead of a blind 200ms — so the resigning Duo player's match record is written instead of lost to an immediate unmount. Offline resign keeps the 200ms delay.
- **2026-08-19**: **Repo-wide responsive/CSS hardening.** Fixed the `[avatar][flexible text][action buttons]` truncation class of bug across FriendsPanel (requests/blocked/friend rows), ChatPanel header, HistoryPanel/history page result rows, ProfilePanel/profile page menu rows, FourPlayerLobby chips, GameLobby status/room-code rows, ChallengePicker header, SettingsPanel/ConfigurationPanel toggle rows, MoveInsights, MoveComparison, MoveResolvedInline. Standardized on `min-w-0` + `truncate` (+ `title`) for text and `shrink-0`/`whitespace-nowrap` for action buttons. Added bottom padding (`pb-24`) under the fixed `BoardBottomNav` in Game/DuelGame (matching ReplayView), made promotion modals wrap on ≤320px, hardened BoardTopBar (avatar wrap, captured-pieces overflow, smaller timer min-width). Fixed centering+`overflow-y-auto` clip in SettingsPanel/GameOverModal/ErrorDetailModal/LeaveConfirmModal/ResignConfirmModal/FourPlayerLobby, replaced `min-h-[600px]` with `min-h-[min(600px,85vh)]` in GameLoading, added 44px touch targets (MatchmakingQueue/Room/WelcomeDisclaimer close/Toast dismiss), and clamped Toast width. Added `max-h`+`overflow-y-auto` to GameMenu/FriendActionsMenu dropdowns.
- **2026-08-18**: **P0 — board-freeze + move-card layout fixes (Duo).** `Game.tsx` `executeMove` now awaits `submitMoveToDB` and aborts with input unlocked when persistence fails; the "turn already resolved" early-return is now deterministic (`turnState==='selecting'` **and** no pending move for me — a failed submission can no longer masquerade as a resolution); the coordinator's `resolvePendingMoves()` and the non-coordinator's `waitForTurnChange()` are wrapped so any failure resets `inputLockedRef`/`submissionTurnRef`, clears the stale pending move, sets `turnState='selecting'` and re-syncs — the board can never be permanently disabled (same invariant as the offline bot paths). Added an input-lock watchdog that clears a lock held >45s while the engine is idle-ready. `PendingMovesRow` rebuilt as a robust responsive layout: `[icon] [min-w-0 column: label · name/truncate, move/truncate] [Submitted badge shrink-0]`, cards stretch equally at 320–412px and desktop; long usernames truncate with ellipsis and can never collide with the badge; the badge is a single compact flex item. `teammateMoveForRow` now shows SAN (`e4`) instead of concatenated squares (`e2e4`). `BoardTopBar` `submitted` derives from the engine pending-moves map (locked moves included), so the top-bar green state matches the cards on both browser and mobile. Tests: `PendingMovesRow.test.tsx`.
- **2026-08-17**: **Entry-fix hardening.** `Game.tsx` initial-bot turn (online, human on Black → White bots move first) is now a retryable function instead of a one-shot IIFE: on a transient first-turn resolve failure it reschedules up to 5×1s (bounded, cleaned up on unmount) instead of leaving the board frozen, with an in-progress guard to prevent double-fires. `ChessBoard.tsx` patches cm-chessboard's internal resize handlers so a resize/orientation event landing after the board view is torn down no-ops instead of throwing `Cannot read properties of undefined (reading 'invokeExtensionPoints')` (`redrawBoard` on a destroyed context); the resize observer is also explicitly disconnected + nulled before `destroy()`.
- **2026-08-17**: **P0 fix — black-side bot freeze in Duo mode.** Root cause was in `OnlineGame.resolvePendingMoves()` (hardcoded WHITE=human / BLACK=bot assumption), not `Game.tsx`. Added temporary `[CHESSDUO-BOT-TRACE]` diagnostic logs to the online bot pipeline (initial-bot trigger in `onStateChange` + coordinator bot handler in `executeMove`) to log `BOT_TURN_CHECK`/`BOT_TURN_SKIPPED` (exact reason), `BOT_MOVE_TRIGGERED`, `STOCKFISH_START`/`RESULT`, `BOT_MOVE_SUBMIT`, `TURN_RESOLVED`. These are dev-gated (`DEBUG &&`) and will be removed after validation.
- **2026-08-17**: **FriendsPanel refetch on resume/deep-link** — added `visibilitychange`/`pageshow` (bfcache) listeners that call `loadData()` when the app returns to the foreground, plus a `chessduo:refresh-friends` listener for friend-notification deep-links. Fixes stale friends/pending-requests after resume-from-background or tapping a friend-request notification while already on `/friends`.
- **2026-08-16**: **Black-human bot freeze fix** — `Game.tsx` `executeBotMove()` now wraps the opponent turn in `try/finally`, always resets `opponentInProgressRef`, refreshes UI state, and shows a non-blocking toast if the bot turn fails. Prevents the stuck "White to move" state when the first bot resolution throws before Stockfish is ready.
- **2026-08-13**: **Realtime remount crash fix (FriendsPanel)** — `friendship-changes` channel now uses a unique per-mount name (`friendship-changes-${++counter}`) to avoid the Supabase "cannot add postgres_changes callbacks ... after subscribe()" throw on fast /friends remounts. `global-presence` keeps its shared topic (presence aggregates across clients) but is now a module-level ref-counted singleton: first subscriber creates+subscribes, last unmount tears it down; the sync callback notifies all live instances via a setter set.
- **2026-08-05**: **Friends search UI redesign** — `FriendsPanel` search results dropdown redesigned to match the friend row card pattern. Replaced plain text "+ Invite" with a styled emerald "Invite" button using the same pattern as the Accept friend request button. Added `InitialsAvatar` to each result, per-result inviting state (spinner + disabled button), `useToast` success/error feedback, and a spinner next to the searching text.
- **2026-08-02**: **PageLoading unification** — Merged `ChessLoader` knight animation into `PageLoading` as the sole rendering. One component, one loading icon everywhere. Deleted standalone `ChessLoader.tsx`. All page-loading, session checks, route-level `loading.tsx`, and in-app processing states now render the same knight animation. Added light mode node variants (`bg-slate-300 dark:bg-white/20`). `label` prop shows static text; omit for animated dots. Architecture test enforces: no `ChessLoader` file exists, no imports from `ChessLoader`, all pages import `PageLoading`. See `PageLoadingArchitecture.test.tsx`.
- **2026-08-01**: `ProfilePanel` "Premium Active" card is now a clickable button that routes to `/premium` (view premium features) — it was a plain `div` with a lock badge. Lock badge removed; plan name kept in the subtitle.
- **2026-07-31**: `ProfilePanel` now shows a "Premium Active" card when the user is premium (plan name) instead of rendering nothing.
- **2026-07-31**: **Game-invite push deep link fix** — `ChallengePicker` now passes the RECEIVER's identity (`friendId`) and `'BLACK'` to `notifyGameInvite(...)`. It previously passed the challenger's own id + `'WHITE'`, so the friend's `/duel` page session check (`session.user.id === playerId`) failed with "Session Expired". Share copy in `ProfilePanel`/`FriendsPanel`/`profile/page.tsx` updated to "ChessDuo Invite" / "Play ChessDuo with me!" (points at `/invite/[userId]`, not the dead `/profile/[userId]`).
- **2026-07-31**: **Bug 37** fix — all share buttons (`GameLobby`, `GameLoading`, `FourPlayerLobby`, `ProfilePanel`, `FriendsPanel`, `profile/page.tsx`) now share the clickable HTTPS App Link only — `nativeUrl`/`chessduo://` removed from every `shareLink()` call. Native sheet via `@capacitor/share` → Web Share API → clipboard (copies the HTTPS link).
- **2026-07-31**: Bug 35 fix — Share buttons now open the native Android share sheet via `@capacitor/share` (`src/lib/share.ts` helper). Wired into `GameLobby`, `GameLoading`, `FourPlayerLobby` (game invites, native `chessduo://` links), plus `profile/page.tsx`, `ProfilePanel`, and `FriendsPanel` (profile/invite links). Web falls back to `navigator.share`, then clipboard copy.
- **2026-07-31**: Game timers now use `font-game` (Chakra Petch) per design system — `MatchTimer`, `BoardTopBar` center timer, and `TurnStatusArea` `TimerDisplay` switched from `font-mono` to `font-game`.
- **2026-07-19**: ConfirmMoveBar redesigned — restored two-button Cancel/Confirm layout with play-button green gradient texture, positioned above BoardBottomNav. Board resets to original position on cancel via `boardKey` remount.
- **2026-07-20**: Premium insights gate redesign — `InsightsGate.tsx` exhausted state updated to match dark premium UI (lock icon, "UNLOCK PREMIUM INSIGHTS" banner, "UPGRADE NOW" button with crown, bottom "VIEW PLANS" teaser). Added `onStateChange` callback for parent lock-state awareness. `BoardBottomNav` gains `insightsLocked` prop with lock badge on Insights tab. `Game.tsx` Insights `SlideOver` now wraps `MoveInsights` with `InsightsGate` so the 3-free-reveal limit is enforced in-game. Guests tracked via `'guest'` fallback ID.
- **2026-07-19**: Logo replacement — `ChessDuoLogo` now renders image mark from `/logo.png` instead of Lucide `Crown` icon. Added to key files table.
- **2026-07-19**: Phase 9 Confirm Moves — new `ConfirmMoveBar` floating 50/50 split bar with glassmorphism styling replaces inline `ConfirmMoveButton`. Integrated in `Game.tsx`, `DuelGame.tsx`, and 4-player mode (via Game.tsx). Toggle added to `GameMenu` hamburger dropdown. 23 new tests covering all scenarios. Deleted legacy `ConfirmMoveButton.tsx`.
- **2026-07-19**: Browser UI unification — migrated History, Friends, Profile pages from `SidebarNav` (narrow 80px icons-only) to `DesktopSidebar` (wide 220px/240px with labels). Updated `src/app/(main)/layout.tsx` to use `DesktopSidebar` for all non-game pages on desktop. Mobile unchanged (HomeBottomNav floating pill).
- **2026-07-18**: Home screen restructure — added `ColorPicker` (3-card White/Black/Random with Lucide icons), `SidebarNav` (left vertical nav for browser), inline configuration panel (Quick/Duo). Mobile `BotDifficultySelector` replaced with 5-card grid using Lucide chess-piece icons. `LocalGame` accepts `playerColor` param; bots swap teams when human picks Black. `GameInterface` gets `getPlayerColor`/`getHumanSlot`/`getTeammateSlot`. Welcome page redirect now passes color; offline auto-start effect split (runs on mount, no longer requires `playerId`) — fixes Quick Play → Got it → home bug for guest users.
- **2026-07-18**: Modal exit animations fixed — GameOverModal, ResignConfirmModal, SettingsPanel now use `open` prop pattern with AnimatePresence for proper exit animations. Game.tsx/DuelGame.tsx always render modals with `open` prop. UI/UX bug hunt: z-index standardization, text overflow fixes, emoji → Lucide icons, loading states. HomeBottomNav: spinner on navigating button, loading progress bar, pathname-based active detection. BackButton: `alwaysFallback` prop for nav pages.
- **2026-07-15**: Google Play Billing integration — `InsightsGate` and `ProfilePanel` now use `SubscriptionService.isPremium()` instead of direct `profiles.is_premium` queries. Premium checks are delegated to the provider-agnostic billing module which uses Google Play Billing on Android.
- **2026-07-15**: Animation fixes — `useScrollLock` uses ref-counted lock to prevent nested overlay conflicts. `BoardTopBar` turn indicator wrapped in `AnimatePresence` so exit animation plays on turn change. `ChallengePicker` backdrop gets `motion.div` exit animation. `FriendsPanel` chat overlay gets `AnimatePresence` fade transition. `ResignConfirmModal` imports shared `MODAL_BACKDROP` constant. `GameOverModal` removes unused `isOnline`/`roomId` props.
- **2026-07-14**: Page redesign — dark navy theme (`#0a0e1a`) applied to FriendsPanel, ProfilePanel, HistoryPanel, and Premium page. New `InitialsAvatar` component for user initials (replaces emoji placeholders and image avatars in non-home contexts). BoardTopBar now uses `InitialsAvatar` for human players, retains bot images. All panels use consistent dark slate backgrounds, white/5 borders, and gradient accents.
- **2026-07-14**: `HomeBottomNav` redesigned as floating pill (rounded-2xl, centered w-[90%] max-w-xs, 12px bottom spacing, glassmorphism shadow). Samsung UI style.
- **2026-07-14**: `WelcomeDisclaimer` — added "Your Move" (green dot) + "Teammate"/"Bot" (blue dot) legend below the chess board in the instruction screen. `useCapacitorBackButton` not needed here (handled at page level).
- **2026-07-14**: `FourPlayerLobby` — added `useCapacitorBackButton` to leave room and navigate home on hardware back press.
- **2026-07-14**: `GameMenu` now accepts optional `soundEnabled`/`onToggleSound`/`onOpenProfile` props. Sound toggle and Profile buttons moved into the hamburger dropdown. Standalone sound/profile buttons removed from `Game.tsx` and `DuelGame.tsx`.
- **2026-07-13**: Fixed RoundHistorySidebar close button to 44×44px touch target. Replaced hardcoded rgba shadows in `ConfirmMoveButton` and `MoveResolvedInline` with CSS variable references (`--shadow-glow-emerald`, `--shadow-glow-emerald-strong`).
- **2026-08-03**: **M01 Auth BV1 fix** — `AuthGate` moved from `features/auth/` to `components/` (was a thin re-export wrapper; now contains the full component). Internal hook import changed to `@/hooks/useAuthSession`. `useAuthSession` moved to `hooks/`. `features/auth/` directory deleted.
- **2026-08-23**: **ADR-005 Resolution Ownership** — `Game.tsx` now gates `MoveResolvedInline` on `myTeam === WHITE/BLACK` only (removed stale `!isFourPlayer ||` that always passed in Duo). Board consumes `lastMoveComparison` (any team), panel consumes human-owned `lastHumanResolution` via `(g as GameInterface).lastHumanResolution` with `last_human_resolution` JSONB persistence; seeded after refresh/reconnect (`prev ?? hr`).

## Dependencies
- `features/` for game logic, `hooks/` for React hooks, `lib/` for utilities
- `cm-chessboard` for board rendering, `chess.js` for move validation

## Recent Changes
- **2026-09-18**: AI Coach destination-only numbering — origin frames keep their dashed rank-color outline/glow but no longer render a rank badge; numbers ①②③ appear only on destinations. Tests: `ChessBoardCoach.test.tsx` (one badge per rank, origins unbadged). No engine/backend/DB/route/billing/game changes.
- **2026-09-18**: AI Coach origin/destination pairing — `ChessBoard` coach overlay now renders paired origin (dashed) + destination (solid) frames sharing the same rank color (`--color-coach-best`/`-insight`/`-alt` light/dark pairs) with numbered badges at both ends (origin top-left, destination top-right). Removed cm-chessboard default markers for coach moves (black corner-bracket shutter, pure-blue/purple mismatch, faint-circle invisible origin). Presentation-only, `pointer-events-none`, hidden with the toggle; `toCoachHighlights` data path unchanged. Tests: `ChessBoardCoach.test.tsx` (paired colors, no markers). No engine/backend/DB/route/billing/game changes.
- **2026-09-18**: AI Coach Top-3 reveal — `Show 3 Best Moves / Hide 3 Best Moves` toggle gates BOTH cards and board markers (nothing visualized by default). New `coach/coachMoveRanks.ts` (rank map + `toCoachHighlights`), `CoachMoveRankBadge.tsx`, `CoachMoveLegend.tsx` (compact, unmounts on hide). `ChessBoard.highlightSquares.coachMoves` renders ① green / ② blue / ③ amber frames + numbered badges (distinct marker types, same-square stacking, memoized). `CoachGame` derives highlights via `toCoachHighlights` (player-turn + FEN-reset stale guard, `useMemo`). New `--color-coach-alt` alias (amber light/dark). No engine/backend/DB/route/billing/game changes.
- **2026-09-17**: AI Coach setup consistency — new `BotDifficultyGrid.tsx` (extracted verbatim from the home selector, visuals unchanged) + `difficultyLevels.ts` (`DIFFICULTY_LEVELS` single source of truth, `SELECTED_LEVEL_KEY` shared with home). Home `page.tsx` consumes both (local `DIFFICULTY_LEVELS`/`BotDifficultySelector` deleted; `ConfigurationPanel` takes the shared type). New `components/coach/CoachSetup.tsx` (ColorPicker + grid + description + "Start AI Coach" CTA, light/dark, 44px targets). No game/backend/billing/ad/auth changes.
- **2026-09-17**: Board thinking hint moved below turn pill — removed the absolute
	`GameBoardSection.waitingHint` overlay pill (covered rank 1/8 squares) and added
	`BoardTopBar.isThinking` in-flow hint (`role=status`, reserved `min-h-[28px]`,
	`text-xs`, `truncate max-w-[min(90vw,480px)]`, `bg-[var(--color-surface)]`
	`dark:bg-[var(--color-muted-bg)]`). `Game.tsx` passes boolean `isThinking`;
	`DuelGame` unchanged. No game/backend/billing/ad/auth changes.
- **2026-09-17**: Shared `RateChessDuoRow` — single source of truth for the Profile
	"Rate ChessDuo" row, consumed by both `ProfilePanel` (in-game slide-over) and
	`/profile` full page (fixes prod missing row from duplicated surfaces).
	Opens `market://` listing on native with HTTPS fallback via `lib/rateApp.ts`.
	No game/backend/billing/ad/auth changes.
- **2026-09-16**: Profile "Rate ChessDuo" row — user-initiated Play Store rating entry
	point (amber navigational row after Share Profile, `Star` icon, transient
	"Opening Play Store…" feedback). Opens `market://` listing on native with
	HTTPS fallback via `lib/rateApp.ts`. No game/backend/billing/ad/auth changes.
- **2026-09-15**: UI perf P5 — new `GameSections.tsx` (`GameTopBarSection` +
	`GameBoardSection`, shallow memo) consumed by `Game.tsx`; `MoveResolvedInline`
	`onNext` + `GameMenu` handlers stabilized. No game/backend/billing/ad/auth changes.
- **2026-09-15**: UI performance refactor (branch `ui-refactoring`, presentation-only).
	Game/DuelGame/ReplayView stabilize memo-busting props (`timerNode`, presence arrays,
	nav handlers via `useMemo`/`useCallback`) so existing `BoardTopBar`/`BoardBottomNav`/
	`ChessBoard` memos hold. `DuelGame` adopts the `IsolatedMatchTimer` pattern (clock-only
	engine ticks filtered; disconnect-age still propagates for the forfeit countdown).
	`ChessBoard` caches `chess.js` move-gen per position (3 parses → 1 per gesture;
	promotion flag reused) and drops the invisible `backdrop-blur-xl` under the opaque
	board. `HistoryPanel` caps row stagger + `content-visibility`; `ChatPanel` initial
	scroll snaps (`auto`, live messages stay `smooth`). No game/backend/billing/ad/auth changes.
- **2026-09-06**: Coach Mode best-move presentation uses local `showBestMove` state
	and the existing `ChessBoard.highlightSquares` overlay. It reads only the current
	`suggestion.topMoves[0].uci`; stale feedback cannot render a board highlight, and
	the live FEN/game state remains unchanged.
- **2026-09-18**: Terminal/ad unification — `CoachGame` active-game Leave converges on the existing inline game-over modal via `CoachGame.abandon()` (Match abandoned + ad + Back to Home); resign confirm toasts instead of silently no-op'ing on a null engine ref. `NativeAdSlot` no longer tears down on `gameOverReason` changes (ref-tracked for logging), throttles scroll/resize re-shows to one per frame with retry frames for the modal spring animation, and guards SSR. Boot-time `preloadNativeAd()` removed from `providers.tsx` (premium-ungated + stale across games) in favor of per-game `useGameOverAdPreload`. No game-over text/layout/navigation-semantics changes. Tests: `CoachGame.test.tsx` (Leave → abandoned terminal + ads).
- **2026-09-18**: Android 15 edge-to-edge safe-area fix (UI-only, no logic changes). Top `env(safe-area-inset-top)` added to `DuelGame` shell + waiting room, `coach/CoachGame` header, `RoundHistorySidebar` header/panel/footer (mirrors `SlideOver` mobile pattern), `InstallBanner`, `Auth` outer + `AuthGate` overlay/page; `Auth` cards gain `max-h-[90svh] overflow-y-auto` (matches `GameOverModal`); `BottomNav` floor `0px` → `max(12px,env(bottom,12px))` via Tailwind (inline `style` removed, per F2 precedent). `Game.tsx` shell + `ReplayView` (+ `pb-24` parity) and home `HeaderBar` covered in `src/app`. Desktop pixel-identical (`env` → `0` fallback). See `android-edge-to-edge-audit.md`.
- **2026-09-18**: Added `PipOverlay.tsx` — live-game Android PiP compact view (defensive FEN mini-board with viewer orientation + last-move highlight, mapped turn label, reused `IsolatedMatchTimer` clock, move-count footer for untimed Coach). Rendered only inside the PiP window (`visible`), hides all menus/chat/insights/nav. Presentation-only; engines untouched. Tests: `PipOverlay.test.tsx`.
- **2026-09-19**: **Supabase perf (ADR-007)** — `HistoryPanel` + `history/page`: single-bundle `getHistoryPageWithStats(50)` (was 4-hop double-load); `FriendsPanel.loadData`: `getFriendsBundle()` (was 6-hop triple-list) + `fetchProfile`-cached username; `Game`/`DuelGame`: profile effects via cached `fetchProfile()`; `Auth`: dropped duplicate post-sign-in `getUser()` verify; `InsightsGate`: single `getUserInsightsState()` (was double `isPremium()`).
- **2026-09-19**: **AI Coach review-banner layout shift fix** — `CoachGame` board-cap message ("Reviewing history — board input paused") moved into an always-mounted reserved wrapper (`mb-1 flex min-h-[20px] items-center justify-center`, `aria-live=polite`) mirroring the `BoardTopBar` thinking-hint pattern; conditional text inside. Board top position stable across Back/Fwd/Moves/Insights. Copy/size/aspect-ratio unchanged; no engine/game/billing changes.
- **2026-09-19**: **PiP manual entry fallback.** `GameMenu` gains optional `onEnterPip` ("Enter PiP" row, `PictureInPicture2` icon, native-gated so web never shows it), threaded through `GameSections.GameTopBarSection` into `Game.tsx` (Quick/Duo/4P) and `DuelGame.tsx` (stable refs preserve section memo); `CoachGame` header gains a native-only PiP button. Presentation-only; engines untouched. Tests: `GameMenu.test.tsx` (show/call/hide).
- **2026-09-20**: **DB perf Phase 2 (PERF-04, parallel independent reads).** `FriendsPanel.loadData`: bundle + `loadChallenges()` launched together (bundle still gates `setLoading` — timing unchanged); `Game.tsx` team labels: white + black username fetches via `Promise.all`. STOPs: `handleAcceptChallenge` writes stay sequential (partial-failure semantics); ProfilePanel effects already concurrent. Test: concurrency assertion in `FriendsPanel.test.tsx` (TDD red→green).
- **2026-09-20**: **DB perf Phase 3 (PERF-05).** `MatchmakingQueue` 3s tick + `FourPlayerLobby` 2s tick: overlap skip + hidden-tab pause (pre-game only). No nav/UX change.
- **2026-09-20**: **Ads reliability ADS-02/04.** `NativeAdSlot`: single delayed re-show per effect lifetime after failed shows (strictly once, cleaned up). ADS-04 coverage audit: all terminals (Game/Duel/Coach/upgrade) already converge on slotted surfaces — no code changes.
- **2026-09-21**: **BOARD FIRST — mobile gameplay layout redesign.** `GameSections.GameBoardSection` dropped the inline `maxWidth` for a responsive `boardMaxClassName` (`max-w-[calc(100dvh-var(--game-chrome,0px))] md:max-w-[720px]`) inside a growing centered 8px-inset region; `CoachGame` full-width on phones + compact header + **board and compact coach group vertically centered** in a full-height flex column (`flex-1 min-h-0 overflow-y-auto` + `my-auto`, nav clearance) with the `md:max-w-md` double cap removed; `CoachPanel` "Coach recommends" collapses to a single row by default. Back/Fwd **remain in `BoardBottomNav`** (an intermediate `BoardMoveNav` relocation that disabled Forward at the last index and blocked review-exit was reverted). Desktop (`md:`) caps/insets preserved. See `docs/mobile-game-layout-audit.md`.
- **2026-09-21**: **Quick Play "Play My Move" toggle.** `ConfigurationPanel` gains an additive optional `showPlayMyMove` prop and a "Play My Move" switch ("Your move is always played. The bot shows its best move as a hint."); `page.tsx` renders it only for Quick Play. Duo/Coach see zero change. See ARCHITECTURE §14.
