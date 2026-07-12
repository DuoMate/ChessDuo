export type HumanAvatar = 'ace' | 'nova' | 'rex' | 'zee' | 'blaze' | 'pixel' | 'kai'

export const HUMAN_AVATARS: Record<HumanAvatar, string> = {
  ace: '/avatars/human-ace.webp',
  nova: '/avatars/human-nova.webp',
  rex: '/avatars/human-rex.webp',
  zee: '/avatars/human-zee.webp',
  blaze: '/avatars/human-blaze.webp',
  pixel: '/avatars/human-pixel.webp',
  kai: '/avatars/human-kai.webp',
}

export const BOT_AVATAR = '/avatars/bot.webp'

export function getAvatarUrl(type: 'human' | 'bot', avatar?: HumanAvatar): string {
  return type === 'human' && avatar ? HUMAN_AVATARS[avatar] : BOT_AVATAR
}
