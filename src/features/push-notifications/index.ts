export { NotificationHandler } from './NotificationHandler'
export { registerDeviceToken, sendPushNotification } from './PushNotificationService'
export type { NotificationPayload, NotificationType, PushTokenRow } from './types'

export async function initPushNotifications(): Promise<void> {
  const { registerDeviceToken } = await import('./PushNotificationService')
  await registerDeviceToken()
}

export async function notifyFriendRequest(senderId: string, receiverId: string, senderName: string): Promise<void> {
  const { sendPushNotification } = await import('./PushNotificationService')
  await sendPushNotification(receiverId, 'friend_request', { senderId, senderName })
}

export async function notifyInviteAccepted(acceptorId: string, requesterId: string, acceptorName: string): Promise<void> {
  const { sendPushNotification } = await import('./PushNotificationService')
  await sendPushNotification(requesterId, 'invite_accepted', { senderId: acceptorId, senderName: acceptorName })
}

export async function notifyChatMessage(
  receiverId: string,
  senderId: string,
  senderName: string,
  snippet: string,
): Promise<void> {
  const { sendPushNotification } = await import('./PushNotificationService')
  await sendPushNotification(receiverId, 'chat_message', { senderId, senderName, snippet })
}

export async function notifyGameInvite(
  receiverId: string,
  senderId: string,
  senderName: string,
  roomId: string,
): Promise<void> {
  const { sendPushNotification } = await import('./PushNotificationService')
  await sendPushNotification(receiverId, 'game_invite', { senderId, senderName, roomId })
}
