# Design: Panels as Pages, Badge Fix, Avatar Fix

**Date**: 2026-07-18
**Status**: Approved
**Scope**: 5 bugs/enhancements resolved via 3 architectural changes

---

## 1. Enhancement 5: Convert Modal Panels to Full Pages

### Motivation

Currently Friends, Profile, History, and Settings open as `<SlideOver>` overlays — pure React state toggles. They create zero browser history entries. Combined with `useNavigationGuard`/home-page `pushState` tricks, the history stack becomes polluted with duplicate entries, causing:

- **Bug 2**: Browser Back navigates to wrong screens (stale duplicate entries get popped first, revealing unexpected pages underneath)
- **Bug 3**: Back exits the app from Friends (no history entry for the slide-over → Back goes to previous site)

### Architecture

Every major panel becomes a dedicated Next.js App Router page. The `(main)/` route group already provides `HomeBottomNav` + proper layout. New routes:

| Page | Route | Source |
|------|-------|--------|
| Friends | `/friends` | `src/app/(main)/friends/page.tsx` (new) |
| Profile | `/profile` | Already exists, remove slide-over fallback |
| History | `/history` | Already exists, remove slide-over fallback |
| Settings | `/settings` | `src/app/(main)/settings/page.tsx` (new) |

Each page follows the mandatory pattern from AGENTS.md:
```tsx
'use client'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

function PageContent() { ... }
export default function Page() {
  return <Suspense fallback={<Loading />}><PageContent /></Suspense>
}
```

### HomeBottomNav Changes

Current behavior: tabs set `useState` booleans to open slide-overs. New behavior: tabs navigate to routes:

```tsx
// Before
<NavButton onClick={() => setFriendsOpen(true)} />
// After
<NavButton onClick={() => router.push('/friends')} />
```

Active state detection: `usePathname()` from `next/navigation` — highlights the tab matching the current route.

### Background Overlay on Home

When a `(main)` page is active, the home page (`/`) is not rendered. So the "play" UI with mode selection and timer pills is not visible. No action needed — this is a feature, not a bug. The home page exists only at `/`.

### Capacitor Hardware Back

Each new page gets `useCapacitorBackButton(() => { router.push('/'); return true }, true)` — standard mobile back navigates to home. The `useCapacitorBackButton` stack-based handler in `providers.tsx` already supports this.

### Route Guards

- **/friends**: No game guard needed (standard page)
- **/profile**: No game guard needed
- **/history**: No game guard needed
- **/settings**: In-game: use `useNavigationGuard` if game is active (prevents changing settings during play). Out-of-game: unrestricted.

### Data Flow

Each page is self-contained — it fetches its own data on mount. No context/props passed from the home page. This eliminates the dual-state problem (page.tsx copy vs layout.tsx copy of `unreadMessages`).

### Files Changed

| File | Change |
|------|--------|
| `src/app/(main)/friends/page.tsx` | NEW — full-page Friends with loading/error/empty states |
| `src/app/(main)/settings/page.tsx` | NEW — full-page Settings |
| `src/components/HomeBottomNav.tsx` | Links become `router.push()` calls with `usePathname()` active detection |
| `src/app/page.tsx` | Remove FriendsPanel/ProfilePanel/HistoryPanel slide-overs and their state |
| `src/app/(main)/layout.tsx` | Remove duplicative slide-over state + badge state; simplify to pure layout shell |
| `src/components/FriendsPanel.tsx` | No changes (already a standalone component, just mounted differently) |
| `src/components/ProfilePanel.tsx` | No changes (same) |
| `src/components/SettingsPanel.tsx` | No changes (same) |
| `src/app/(main)/history/page.tsx` | Remove slide-over fallback; only full-page mode |
| `src/app/(main)/profile/page.tsx` | Remove slide-over fallback; only full-page mode |

### Bug Resolution

Bugs 2 and 3 are resolved by this change entirely — every screen has a real browser history entry created by `router.push()`. No duplicate entries. No polluting `pushState` tricks. Back button always goes to the previous real page.

---

## 2. Bug 1: Friends Notification Badge Fix

### Root Cause

The badge counts only unread `messages` rows (`read = false`). It is computed independently in two places:

1. `src/app/page.tsx` — uses 30s polling + Supabase broadcast
2. `src/app/(main)/layout.tsx` — uses `postgres_changes` realtime

When messages are deleted from DB (not just marked read), the badge sometimes persists because:
- The polling window (30s) hasn't elapsed yet
- The realtime subscription fires but the state update callbacks aren't called if the component's lifecycle didn't trigger a re-render
- Friend requests (`friend_requests` with `status = 'pending'`) are never counted in the badge at all — this was never implemented

### Fix: Centralized `useBadgeCount` Hook

Create `src/hooks/useBadgeCount.ts`:

```ts
export function useBadgeCount(playerId: string | null): {
  unreadMessages: number
  pendingRequests: number
  total: number
  unreadBySender: Record<string, number>
}
```

**Data sources**:
1. `messages` table: `SELECT sender_id FROM messages WHERE receiver_id = $1 AND read = false`
2. `friend_requests` table: `SELECT COUNT(*) FROM friend_requests WHERE receiver_id = $1 AND status = 'pending'`

**Realtime**: Subscribe to `postgres_changes` on both `messages` and `friend_requests` tables filtered by the current user's ID. On any INSERT/UPDATE/DELETE, re-fetch counts immediately — no polling.

**Refresh on visibility change**: `document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh() })` — catches changes made in other tabs.

**Replacement**: Import `useBadgeCount` into BOTH `page.tsx` and `(main)/layout.tsx` using the same hook, same realtime channels. No separate polling. No dual state.

### Edge Cases Covered

| Case | Handling |
|------|----------|
| Message deleted from DB | Realtime DELETE trigger → re-fetch → badge resets immediately |
| Message marked read elsewhere | Realtime UPDATE trigger → re-fetch |
| Friend request accepted | Realtime UPDATE on status → re-fetch |
| User signed out | `playerId` null → hook returns zeros, listeners cleaned up |
| Tab hidden during changes | `visibilitychange` re-fetches on return |
| Rate limit | Supabase Realtime has built-in rate limiting; no additional needed |
| Messages from deleted users | Filter by `sender_id IN (SELECT friend_id FROM friends WHERE user_id = $1)` in query |

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useBadgeCount.ts` | NEW — centralized hook |
| `src/lib/messages.ts` | Add `getUnreadFriendRequestCount()` function |
| `src/app/page.tsx` | Replace local state + polling with `useBadgeCount` |
| `src/app/(main)/layout.tsx` | Replace local state with `useBadgeCount` |

---

## 3. Bug 4: Google Profile Images

### Root Cause

Four-layer pipeline, entirely broken:

1. **Auth capture**: `supabaseAuthUtils.ts` never reads `session.user.user_metadata.avatar_url` (where Supabase stores Google's `picture` claim)
2. **DB storage**: No code ever writes to `profiles.avatar_url`
3. **Component**: `InitialsAvatar` has no image support — it only renders text initials
4. **Wiring**: `BoardTopBar.AvatarTile` ignores `profileImageUrl`; `ProfilePanel` doesn't select `avatar_url`

### Fix: End-to-End Image Pipeline

**Step 1 — Auth Capture** (`src/lib/supabaseAuthUtils.ts`):

After Google sign-in completes and user profile is confirmed, read `session.user.user_metadata.avatar_url` and upsert into profiles:

```ts
const avatarUrl = session.user.user_metadata?.avatar_url || null
if (avatarUrl) {
  await supabase.from('profiles').upsert(
    { id: userId, avatar_url: avatarUrl },
    { onConflict: 'id' }
  )
}
```

Note: `avatar_url` is a TEXT column in profiles. Only the URL string from Google's CDN is stored. No binary upload.

**Step 2 — InitialsAvatar Upgrade** (`src/components/InitialsAvatar.tsx`):

Add `src?: string | null` prop. Render logic:

```tsx
const [imgError, setImgError] = useState(false)

if (src && !imgError) {
  return (
    <img
      src={src}
      alt={username}
      className="rounded-full object-cover w-full h-full"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
    />
  )
}
// Fallback to initials
```

New props interface:
```ts
interface Props {
  username: string
  size?: 'sm' | 'md' | 'lg'
  src?: string | null       // Google profile image URL
  online?: boolean
  premium?: boolean
  ringClass?: string
}
```

**Step 3 — Wire Through Components**:

| Component | What changes |
|-----------|-------------|
| `BoardTopBar.tsx` | `AvatarTile` passes `src={player.profileImageUrl}` to `InitialsAvatar` |
| `FriendsPanel.tsx` | Fetch `avatar_url` in friend list query; pass to `InitialsAvatar` |
| `ProfilePanel.tsx` | Add `avatar_url` to profiles select; pass to `InitialsAvatar` |
| Home page duel list | Replace manual character circles with `InitialsAvatar` + Google image |
| `Game.tsx` | Already fetches `avatar_url` as `profileImageUrl` — just pass through now |
| `DuelGame.tsx` | Same — already fetches, just pass through |

### Edge Cases

| Case | Handling |
|------|----------|
| Google account has no picture | `avatar_url` = null → `InitialsAvatar` falls back to initials |
| Image URL is invalid/expired | `onError` → set `imgError` → falls back to initials |
| CORS from Google CDN | `referrerPolicy="no-referrer"` handles Google's referrer-based blocking |
| Image loads slowly | Native `<img>` browser loading; no spinner needed (small avatars) |
| User changes Google picture | Re-authenticate triggers `TOKEN_REFRESHED` → re-fetch metadata → update DB |
| Non-Google sign-in (email) | `avatar_url` is null → always shows initials. Correct behavior. |

### Files Changed

| File | Change |
|------|--------|
| `src/components/InitialsAvatar.tsx` | Add `src` prop + image rendering + onError fallback |
| `src/lib/supabaseAuthUtils.ts` | Capture `avatar_url` from user metadata after Google sign-in |
| `src/components/BoardTopBar.tsx` | Pass `profileImageUrl` → `InitialsAvatar.src` |
| `src/components/FriendsPanel.tsx` | Select `avatar_url`, pass to `InitialsAvatar` |
| `src/components/ProfilePanel.tsx` | Select `avatar_url`, pass to `InitialsAvatar` |
| `src/app/page.tsx` | Use `InitialsAvatar` in duel friend list instead of manual circles |
| `src/components/Game.tsx` | Already fetches — wire `profileImageUrl` through |
| `src/components/DuelGame.tsx` | Same |

---

## 4. Production-Grade Considerations

### Testing
- Unit tests for `useBadgeCount` (mocked Supabase channels)
- Unit tests for `InitialsAvatar` (image load, error fallback, all sizes)
- E2E: open /friends → Back → verify home page loads
- E2E: badge count updates on new message, clears on read

### Rollout Strategy
1. Ship Enhancement 5 (pages) first — it's the largest change but backward-compatible (old slide-over code stays until next deploy removes it)
2. Ship Badge fix next — depends on pages being live (different import paths)
3. Ship Avatar fix last — purely additive, no dependency on other changes

### Rollback Plan
Each section is independently revertible. Pages can fall back to slide-overs by reverting the HomeBottomNav links. Badge hook can be replaced by old polling. Avatar is additive and won't break existing fallback behavior.

### Performance
- `useBadgeCount` uses Supabase Realtime (WebSocket), no polling → net reduction in DB queries
- `InitialsAvatar` image load is a single GET from Google CDN, parallel with page load
- New pages use `next/dynamic` with `ssr: false` for heavy components (FriendsPanel, etc.)

---

## 5. Files Summary

| Type | Files Created | Files Modified | Files Deleted |
|------|:-----------:|:------------:|:-----------:|
| Enhancement 5 (Pages) | 3 | 4 | 0 |
| Bug 1 (Badge) | 1 | 3 | 0 |
| Bug 4 (Avatars) | 0 | 8 | 0 |
| **Total** | **4** | **15** | **0** |

---

*Design approved 2026-07-18. Proceed to implementation plan via writing-plans skill.*
