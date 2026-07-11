# Module: React Hooks

## Purpose
Custom React hooks for viewport detection, navigation guards, network status, and Capacitor back-button handling.

## Key Files
| File | Purpose |
|------|---------|
| `useIsMobile.ts` | Viewport breakpoint detection (640px) |
| `useNavigationGuard.ts` | Prevent accidental navigation during active game |
| `useNetworkStatus.ts` | Online/offline connectivity detection |
| `useCapacitorBackButton.ts` | Android hardware back-button handler |

## Logic & Decisions
- `useNavigationGuard` uses `beforeunload` event + Next.js router events.
- `useIsMobile` returns boolean — drives responsive layout switches.
- `useNetworkStatus` triggers `NetworkOverlay` globally (not per-page).
- `useCapacitorBackButton` only active in Capacitor builds (not web).
- Co-located `__tests__/` for hook tests.

## Dependencies
- React 19, Next.js router
- Capacitor (for `useCapacitorBackButton`)
