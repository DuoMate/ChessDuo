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
| `useEscapeKey.ts` | Keyboard Escape key handler for modals/panels |
| `useScrollLock.ts` | Prevent background scrolling when overlays are open |

## Logic & Decisions
- `useNavigationGuard` uses `beforeunload` event + Next.js router events.
- `useIsMobile` returns boolean — drives responsive layout switches.
- `useNetworkStatus` triggers `NetworkOverlay` globally (not per-page).
- `useCapacitorBackButton` only active in Capacitor builds (not web).
- `useEscapeKey` uses `addEventListener` on document keydown; accepts `enabled` flag.
- `useScrollLock` uses module-level ref counter to handle nested/overlapping overlay lock cycles.
- Co-located `__tests__/` for hook tests.

## Recent Changes
- **2026-07-15**: `useScrollLock` refactored with module-level lock counter to prevent nested lock interference (e.g., two modals open, first unmounts — body stays locked for second).

## Dependencies
- React 19, Next.js router
- Capacitor (for `useCapacitorBackButton`)
