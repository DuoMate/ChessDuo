# ChessDuo Architecture & Conventions Guide

> **The Bible** — every commit must follow these patterns. Break nothing listed here without updating this doc.

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (server component)
│   ├── providers.tsx             # Client-side providers (Toast, Network, Suspense)
│   ├── page.tsx                  # Home page
│   ├── loading.tsx               # Global loading fallback
│   ├── game/page.tsx             # /game → dynamic(lazy) Game component
│   ├── duel/page.tsx             # /duel → dynamic(lazy) DuelGame component
│   ├── replay/[gameId]/page.tsx  # /replay → dynamic(lazy) ReplayView component
│   ├── history/page.tsx          # Match history
│   ├── profile/page.tsx          # User profile
│   ├── premium/page.tsx          # Premium upsell
│   ├── privacy/page.tsx          # Privacy policy
│   ├── invite/[userId]/page.tsx  # Friend invite landing
│   └── challenge/[code]/page.tsx # Challenge link landing
│
├── components/                   # React components (co-located by feature)
│   ├── Game.tsx                  # Main 2v2 game (online + offline)
│   ├── DuelGame.tsx              # 1v1 duel mode
│   ├── ChessBoard.tsx            # Chess board + annotations
│   ├── MobileChessBoard.tsx      # Touch-optimized board
│   ├── AccuracyBottomSheet.tsx   # Move accuracy breakdown
│   ├── MoveComparison.tsx        # Side-by-side move comparison
│   ├── MovePlayback.tsx          # Timeline scrubber
│   ├── GameOverModal.tsx         # End-game result modal
│   ├── TeamTimer.tsx             # Team-level countdown
│   ├── MatchTimer.tsx            # Match-level countdown
│   ├── GameLoading.tsx           # Pre-game lobby/waiting
│   ├── GameLobby.tsx             # Matchmaking lobby
│   ├── GameMenu.tsx              # In-game menu (resign, settings)
│   ├── SettingsPanel.tsx         # Settings slide-over
│   ├── ResignConfirmModal.tsx    # Resign confirmation
│   ├── LeaveConfirmModal.tsx     # Leave game confirmation
│   ├── MatchmakingQueue.tsx      # Queueing UI
│   ├── AnalyzingIndicator.tsx    # Stockfish thinking spinner
│   ├── EvaluatingLoader.tsx      # Full-screen evaluation loader
│   ├── SlideOver.tsx             # Generic slide-over container
│   ├── ProfilePanel.tsx          # Profile + stats
│   ├── HistoryPanel.tsx          # Match history list
│   ├── FriendsPanel.tsx          # Friends + requests + chat
│   ├── ChatPanel.tsx             # In-app messenger
│   ├── BottomNav.tsx             # Mobile bottom navigation
│   ├── MobileStatusBar.tsx       # Mobile safe-area wrapper
│   ├── Auth.tsx                  # Auth form (login/signup)
│   ├── ChooseUsername.tsx        # Username selection post-signup
│   ├── WelcomeDisclaimer.tsx     # First-time welcome modal
│   ├── GameTour.tsx              # Onboarding tutorial
│   ├── ChallengePicker.tsx       # Challenge mode/time picker
│   ├── InsightsGate.tsx          # Premium insight gate
│   ├── TeamIndicator.tsx         # Team crown/bot icons
│   ├── TurnStatusArea.tsx        # Turn phase indicator
│   ├── CapturedPieces.tsx        # Captured pieces display
│   ├── NetworkOverlay.tsx        # Offline banner
│   ├── ErrorBoundary.tsx         # React error boundary
│   ├── Toast.tsx                 # Toast notification system
│   ├── PromotionModal.tsx        # Pawn promotion selector
│   └── __tests__/                # Component tests (co-located)
│
├── features/                     # Domain logic (framework-free)
│   ├── shared/                   # Shared across game modes
│   │   ├── GameInterface.ts      # ✨ Shared interface for LocalGame + OnlineGame
│   │   ├── gameConstants.ts      # Magic numbers (CHECKMATE_SCORE, timer defaults)
│   │   └── accuracy.ts           # Accuracy calculation (lichess formula)
│   ├── game-engine/              # Core chess engine
│   │   └── gameState.ts          # Board state, pending moves, timers
│   ├── offline/game/             # Local 2v2 game
│   │   └── localGame.ts          # LocalGame class
│   ├── online/game/              # Real-time multiplayer game
│   │   └── onlineGame.ts         # OnlineGame class
│   └── bots/                     # Bot players
│       ├── chessBot.ts           # Bot move generation
│       ├── botConfig.ts          # ELO-based difficulty config
│       └── serverMoveEvaluator.ts# Stockfish HTTP client
│
├── hooks/                        # React hooks
│   ├── useIsMobile.ts            # Viewport breakpoint hook
│   ├── useNavigationGuard.ts     # Prevent accidental navigation
│   └── useNetworkStatus.ts       # Online/offline detection
│
├── lib/                          # Utilities & services
│   ├── supabase.ts               # Supabase client
│   ├── gamePersistence.ts        # Room state persistence
│   ├── matchHistory.ts           # Completed game storage
│   ├── messages.ts               # Chat message CRUD
│   ├── roomActions.ts            # Room management
│   ├── settings.ts               # User settings (theme, sound)
│   ├── sounds.ts                 # Sound effect engine
│   ├── chessUtils.ts             # move parsing, UCI/SAN conversion
│   ├── subscriptionManager.ts    # Supabase channel lifecycle
│   └── __tests__/                # lib tests (co-located)
│
└── app/globals.css               # Global Tailwind styles
```

---

## Architecture Patterns

### 1. Shared Game Interface (`src/features/shared/GameInterface.ts`)

**RULE**: Both `OnlineGame` and `LocalGame` MUST implement the shared `GameInterface`. Game.tsx types all game references against this interface — never use `as any` to access game methods.

```typescript
// ✅ CORRECT — type against the shared interface
const g = isOnline ? onlineGameRef.current : gameRef.current
const moves = (g as GameInterface).getAllPendingMoves()

// ❌ WRONG — never use `as any` to hack around missing methods
const moves = (g as any).getAllPendingMoves()
```

**When adding a new game method**:
1. Add it to `GameInterface` first
2. Implement it in BOTH `OnlineGame` and `LocalGame`
3. Use it in `Game.tsx` via the interface (with `as GameInterface` cast if needed)

**Methods that are NOT on the interface** (class-specific):
- `OnlineGame`: `joinRoom()`, `broadcastMove()`, `broadcastLocked()`, `getCoordinatorId()`, `setTurnState()`, `waitForTeammateLock()`, `isCoordinator()`
- `LocalGame`: `addPlayer()`, `selectMove()`, `lockMove()`, `resolveLegacy()`

### 2. Page-Level Code Splitting

**RULE**: All large game components MUST be lazy-loaded with `next/dynamic`. Pages are client components using `useSearchParams()`, wrapped in `<Suspense>`.

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const GameComponent = dynamic(() => import('@/components/Game').then(mod => ({ default: mod.Game })), {
  loading: () => <Spinner />,
  ssr: false,
})

function GameContent() {
  const searchParams = useSearchParams()
  const level = searchParams.get('level')

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <GameComponent level={level} ... />
    </ErrorBoundary>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GameContent />
    </Suspense>
  )
}
```

**Critical**: `ssr: false` requires a `'use client'` component. `useSearchParams()` requires `<Suspense>` boundary. Both are mandatory for game page routes.

### 3. Toast Notification System

**RULE**: Every component that handles game events MUST use `useGameToast()`. The toast system is centrally wired in `providers.tsx`.

```typescript
const toast = useGameToast()

// Game events:
toast.moveLocked()           // Player locks their move
toast.resolutionComplete(w)  // Winner announced
toast.gameOver(result)       // Game ends
toast.connectionLost()       // Network drops
toast.warning('msg')         // Non-critical warning
```

**Do NOT** use `alert()`, `console.error()` for user-facing messages, or inline `<div>` for notifications.

### 4. Navigation Guard

**RULE**: Any page with an active game MUST use `useNavigationGuard()` to prevent accidental back-button/tab-close.

```typescript
const { confirmLeave } = useNavigationGuard({
  enabled: gameState.status === GameStatus.PLAYING,
  onAttemptLeave: () => toast.warning('You are leaving an active game!'),
})
```

### 5. Network Detection

**RULE**: The `NetworkOverlay` component is rendered globally in `providers.tsx`. No page needs to add its own offline banner.

### 6. Constants & Magic Numbers

**RULE**: All magic numbers used in 3+ places MUST live in `src/features/shared/gameConstants.ts`.

| Constant | Value | Usage |
|----------|-------|-------|
| `CHECKMATE_SCORE` | 10000 | Checkmate evaluation sentinel |
| `DEFAULT_TEAM_TIMER_SECONDS` | 600 | Default match timer |
| `DEFAULT_MOVE_TIMER_SECONDS` | 10 | Team turn timer |
| `ROOM_EXPIRY_MS` | 86400000 | Room auto-cleanup (24h) |
| `DEFAULT_POLLING_INTERVAL_MS` | 2000 | Matchmaking poll |

**Do NOT** hardcode `600`, `10000`, or `2000` in game logic. Import the constant.

---

## Styling Conventions

### 1. Dark Mode is REQUIRED

**RULE**: Every component MUST support both light and dark themes. Use Tailwind's `dark:` prefix.

```html
<!-- ✅ CORRECT -->
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">

<!-- ❌ WRONG — dark-only, breaks in light mode -->
<div className="bg-gray-900 text-white">
```

### 2. Touch Targets ≥ 44px

**RULE**: All interactive elements (buttons, inputs, toggles) must have minimum 44×44px touch area.

```html
<!-- ✅ CORRECT -->
<button className="min-h-[44px] min-w-[44px]">

<!-- ❌ WRONG — below WCAG minimum -->
<button className="w-7 h-7">
```

### 3. Font Sizes ≥ 11px

**RULE**: No text smaller than `text-[11px]` (or `text-xs` / 12px for body). Tiny decorative labels are the only exception, and even those should be ≥ 11px.

```html
<!-- ✅ CORRECT -->
<span className="text-xs">Label</span>

<!-- ❌ WRONG — too small -->
<span className="text-[9px]">Label</span>
```

### 4. No Inline Styles (Prefer Tailwind)

**RULE**: Use Tailwind classes. Inline `style={{}}` is only acceptable for dynamic values (e.g., `style={{ left: computedPosition }}`).

### 5. No Hardcoded Hex Colors

**RULE**: Colors in JSX must use Tailwind classes. If you need a dynamic color, use CSS variables or the `style` prop with a clear comment explaining why it's dynamic.

```html
<!-- ✅ CORRECT -->
<span className="text-yellow-400 dark:text-yellow-300">

<!-- ❌ WRONG — bypasses theme -->
<span style={{ color: '#ffc107' }}>
```

### 6. No `z-index` > 50 Without Documentation

**RULE**: z-index values above 50 (z-50) must have a comment explaining WHY. Network overlay uses z-[100] — the only component that should be above modals.

---

## Code Conventions

### 1. ES Modules Only

**RULE**: NEVER use `require()`. All imports use ES module syntax.

```typescript
// ✅ CORRECT
import { Chess } from 'chess.js'

// ❌ WRONG  
const { Chess } = require('chess.js')
```

### 2. No Console.log in Production Paths

**RULE**: `console.log` statements are acceptable for debugging but should be minimized. Use `toast` for user-facing messages, `console.error` for actual errors, and `console.warn` for recoverable issues.

### 3. Empty Catch Blocks Must Log

**RULE**: Every `catch {}` block must either have a `console.warn/error` or a comment explaining why silence is acceptable.

```typescript
// ✅ CORRECT
try { parseMove() } catch { /* invalid move format — silently skip */ }

// ❌ WRONG — swallows errors silently  
try { parseMove() } catch {}
```

### 4. Supabase Channel Lifecycle

**RULE**: All Supabase real-time channels must be unsubscribed in cleanup (return value of useEffect). Use `subscriptionManager.register(channel)` to track for centralized diagnostics.

### 5. Test Co-location

**RULE**: Tests live in `__tests__/` directories next to the code they test. No `tests/` at the project root.

---

## Error Handling

### 1. Error Boundaries

**RULE**: Every page route SHOULD be wrapped in `ErrorBoundary`. At minimum, the game page (`/game`) requires it.

### 2. Loading States

**RULE**: Every page that fetches data MUST handle three states: loading, error, empty.

```typescript
if (loading) return <Spinner />
if (error) return <ErrorDisplay />
if (!data.length) return <EmptyState />
```

### 3. Home Page Session Check

**RULE**: The home page MUST NOT return `null` during session check. Always show a loading UI.

---

## Architecture Decisions (ADR)

### ADR-001: Shared GameInterface over Duplicate Code

**Decision**: Extract a shared `GameInterface` that both `OnlineGame` and `LocalGame` implement, rather than duplicating the game component logic (had 32 `as any` casts).

**Status**: IMPLEMENTED (2026-06-04)

### ADR-002: dynamic() over Static Imports for Game Components

**Decision**: Use `next/dynamic` with `ssr: false` for all game components. The chess engine and board libraries are browser-only.

**Status**: IMPLEMENTED (2026-06-04)

### ADR-003: Centralized Providers over Ad-hoc Wrappers

**Decision**: `src/app/providers.tsx` is the single source of truth for client-side context (Toast, Network, Suspense). No other layout wrappers.

**Status**: IMPLEMENTED (2026-06-04)

### ADR-004: Co-located Tests

**Decision**: Tests live in `__tests__/` alongside source, not in a separate top-level directory.

**Status**: Established (pre-existing)

---

## Pre-commit Checklist

Before pushing, verify:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — no NEW failures introduced
- [ ] All interactive elements have `min-h-[44px] min-w-[44px]`
- [ ] All components have `dark:` variants for background, text, and border colors
- [ ] No `require()` statements in source
- [ ] No `text-[9px]` or `text-[10px]` classes
- [ ] Game components imported via `dynamic()` in page files
- [ ] New game methods added to `GameInterface` and implemented in BOTH `OnlineGame` + `LocalGame`
- [ ] Magic numbers moved to `gameConstants.ts`
- [ ] No `as any` cast on game references (use `as GameInterface` instead)

---

*Last Updated: 2026-06-04 — Architecture bible established after comprehensive code quality pass*
