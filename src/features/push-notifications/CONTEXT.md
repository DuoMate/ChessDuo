# Module: Push Notifications

## Purpose
Isolated push notification module for the ChessDuo Capacitor app. Handles FCM token registration, sending push notifications via a Next.js API route, and deep-link navigation on notification tap.

## Files
| File | Purpose |
|------|---------|
| `types.ts` | Shared types (`NotificationType`, `NotificationPayload`, `PushTokenRow`) |
| `PushNotificationService.ts` | Core service: `registerDeviceToken()` (permission, FCM registration, all listeners including `pushNotificationActionPerformed`), `sendPushNotification()` to call `/api/push/send` |
| `index.ts` | Public API: `initPushNotifications()`, `notifyFriendRequest()`, `notifyChatMessage()`, `notifyGameInvite()`, `notifyInviteAccepted()` |

## Flow
1. `initPushNotifications()` called from `providers.tsx` after auth
2. Requests permission → registers FCM token → sends to `/api/push/register`
3. All Capacitor push listeners are set up inside `registerDeviceToken()` AFTER `register()` to prevent native bridge races
4. Notification tap handler inlines navigation via `window.location.href` (deep-links to relevant screen)

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
- **2026-07-15**: CRASH FIX — `NotificationHandler.tsx` deleted. Its `pushNotificationActionPerformed` listener was registering BEFORE `PushNotifications.register()` completed, causing a Capacitor native bridge race condition that crashed the app on the permission "Allow" tap. All listeners now live inside `registerDeviceToken()`, chained AFTER `register()` to guarantee correct initialization order. Navigation uses `window.location.href` (no React dependency). Crash loop eliminated.
- **2026-07-15**: Added opt-out toggle in SettingsPanel → `registerDeviceToken()` skips FCM registration when disabled. `delete_my_account()` now cleans push_tokens.
