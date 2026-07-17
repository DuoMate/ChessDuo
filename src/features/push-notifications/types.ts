export type NotificationType = 'friend_request' | 'invite_accepted' | 'chat_message' | 'game_invite'

export interface NotificationPayload {
  type: NotificationType
  senderId: string
  senderName?: string
  roomId?: string
  snippet?: string
}

export interface PushTokenRow {
  id: string
  user_id: string
  token: string
  platform: 'android' | 'ios' | 'web'
  created_at: string
  updated_at: string
}
