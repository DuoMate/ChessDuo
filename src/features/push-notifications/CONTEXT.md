# Module: Push Notifications

## Purpose
Isolated push notification module for the ChessDuo Capacitor app. Handles FCM token registration, sending push notifications via a Next.js API route, and deep-link navigation on notification tap.

## Files
| File | Purpose |
|------|---------|
| `types.ts` | Shared types (`NotificationType`, `NotificationPayload`, `PushTokenRow`) |
| `PushNotificationService.ts` | Core service: `registerDeviceToken()` using `@capacitor/push-notifications`, `sendPushNotification()` to call `/api/push/send` |
| `NotificationHandler.tsx` | React component: listens for `pushNotificationActionPerformed` and deep-links to the correct page |
| `index.ts` | Public API: `initPushNotifications()`, `notifyFriendRequest()`, `notifyChatMessage()`, `notifyGameInvite()`, `notifyInviteAccepted()` |

## Flow
1. `initPushNotifications()` called from `providers.tsx` after auth
2. Requests permission → registers FCM token → sends to `/api/push/register`
3. Existing code calls `notifyFriendRequest()` / `notifyChatMessage()` etc.
4. These call `sendPushNotification()` which POSTs to `/api/push/send`
5. API route looks up recipient's `push_tokens` in Supabase → sends via FCM HTTP v1
6. Device receives push → user taps → `NotificationHandler` navigates to relevant screen

## Dependencies
- `@capacitor/push-notifications` (native plugin)
- `jose` (server-side JWT signing in the API route)
- `src/app/api/push/register/route.ts`
- `src/app/api/push/send/route.ts`

## Integration Points
- `src/app/providers.tsx` — `initPushNotifications()` after auth
- `src/components/FriendsPanel.tsx` — `notifyFriendRequest()` after `sendFriendRequest()`
- `src/components/ChatPanel.tsx` — `notifyChatMessage()` after `sendMessage()`
- `src/components/SettingsPanel.tsx` — Push notification opt-out toggle (sets `chessduo_push_disabled` in localStorage)

## Opt-Out Mechanism
- User toggles "Push Notifications" off in SettingsPanel → `localStorage.setItem('chessduo_push_disabled', 'true')`
- `registerDeviceToken()` checks this flag before FCM registration; if disabled, returns immediately
- `delete_my_account()` RPC cleans up `push_tokens` rows on account deletion

## Recent Changes
- **2026-07-15**: Added opt-out toggle in SettingsPanel → `registerDeviceToken()` skips FCM registration when disabled. `delete_my_account()` now cleans push_tokens.
