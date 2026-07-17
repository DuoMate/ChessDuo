# Module: Push Notifications

## Purpose
Push notification module for ChessDuo. Supports both browser web push (service worker + VAPID) and Capacitor native (FCM via `@capacitor/push-notifications`). Handles token registration, sending, and deep-link navigation on notification tap.

## Files
| File | Purpose |
|------|---------|
| `types.ts` | Shared types (`NotificationType`, `NotificationPayload`, `PushTokenRow`) |
| `PushNotificationService.ts` | Core service: `registerDeviceToken()` (browser push + Capacitor FCM), `sendPushNotification()` to call `/api/push/send` |
| `index.ts` | Public API: `initPushNotifications()`, `notifyFriendRequest()`, `notifyChatMessage()`, `notifyGameInvite()`, `notifyInviteAccepted()` |

## Flow
1. Service worker (`/sw.js`) registered in `providers.tsx` on mount
2. `initPushNotifications()` called from `providers.tsx` after auth
3. `registerDeviceToken()` checks disabled flag, then crash guard (30s timeout)
4. **Capacitor path** (native): requests FCM permission → registers token → POST to `/api/push/register` with `platform: 'android'`
5. **Browser path** (web): checks `PushManager` + VAPID key → requests `Notification.permission` → `pushManager.subscribe()` → POST to `/api/push/register` with `platform: 'web'`
6. All Capacitor push listeners are set up inside `registerDeviceToken()` AFTER `register()` to prevent native bridge races
7. Notification tap handler inlines navigation via `window.location.href` (deep-links to relevant screen)

## Dependencies
- `@capacitor/push-notifications` (native plugin, Android only)
- `web-push` (server-side VAPID signing in `/api/push/send`)
- `jose` (server-side JWT signing for FCM OAuth2)
- `src/app/api/push/register/route.ts`
- `src/app/api/push/send/route.ts`
- `public/sw.js` (service worker for browser push events)

## Integration Points
- `src/app/providers.tsx` — registers service worker + calls `initPushNotifications()` after auth
- `src/components/FriendsPanel.tsx` — `notifyFriendRequest()` after `sendFriendRequest()`
- `src/components/ChatPanel.tsx` — `notifyChatMessage()` after `sendMessage()`
- `src/components/SettingsPanel.tsx` — Push notification opt-out toggle (sets `chessduo_push_disabled` in localStorage)

## Opt-Out Mechanism
- User toggles "Push Notifications" off in SettingsPanel → `localStorage.setItem('chessduo_push_disabled', 'true')`
- `registerDeviceToken()` checks this flag before registration; if disabled, returns immediately
- `delete_my_account()` RPC cleans up `push_tokens` rows on account deletion

## Recent Changes
- **2026-07-17**: Added browser web push support. New `registerBrowserPush()` path: checks `PushManager` API, uses VAPID keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), creates `PushSubscription`, saves to `/api/push/register` with `platform: 'web'`. Created `public/sw.js` service worker for `push` and `notificationclick` events. Updated `/api/push/send` to use `web-push` library for web platform tokens alongside existing FCM for native tokens. `platform` type extended to `'android' | 'ios' | 'web'`. Crash guard now uses 30s timeout instead of permanent disable. Service worker registered in `providers.tsx` before push init.
- **2026-07-15**: CRASH FIX — `NotificationHandler.tsx` deleted. Its `pushNotificationActionPerformed` listener was registering BEFORE `PushNotifications.register()` completed, causing a Capacitor native bridge race condition that crashed the app on the permission "Allow" tap. All listeners now live inside `registerDeviceToken()`, chained AFTER `register()` to guarantee correct initialization order. Navigation uses `window.location.href` (no React dependency). Crash loop eliminated.
- **2026-07-15**: Added opt-out toggle in SettingsPanel → `registerDeviceToken()` skips FCM registration when disabled. `delete_my_account()` now cleans push_tokens.
