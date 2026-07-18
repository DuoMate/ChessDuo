# Module: Settings Page

## Purpose
Full-page settings — theme, sound, auto-queen, low time warning, push notifications.

## Key Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry — renders SettingsPanel with loading/error/empty states |
| `loading.tsx` | Skeleton loading state |

## Logic & Decisions
- Full-page route (was a slide-over panel in Game.tsx). Back button always goes home via `BackButton alwaysFallback`.
- Uses `useCapacitorBackButton` for hardware back.
- Sign-in button shown when `playerId` is null.
- SettingsPanel renders toggle switches for theme, auto-queen, low time warning, and push notifications.

## Dependencies
- `@/components/SettingsPanel` — settings toggles
- `@/hooks/useCapacitorBackButton` — Android back

## Recent Changes
- **2026-07-18**: Created as full page route (was slide-over). Added loading skeleton. Sign-in button for unauthenticated state.
