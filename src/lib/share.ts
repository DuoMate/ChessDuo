import { Share } from '@capacitor/share'
import { Capacitor } from '@capacitor/core'
import { getAppBaseUrl } from './appUrl'

export interface ShareLinkOptions {
  title: string
  text: string
  url: string
  dialogTitle?: string
}

export function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && !!Capacitor.isNativePlatform()
}

export function getRoomInviteLink(roomCode: string): string {
  return `${getAppBaseUrl()}/?code=${roomCode}`
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard unavailable — nothing else to do
  }
}

export type ShareResult = 'shared' | 'copied' | 'cancelled'

export async function shareLink(opts: ShareLinkOptions): Promise<ShareResult> {
  const hasWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  if (isNativePlatform()) {
    try {
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        dialogTitle: opts.dialogTitle,
      })
      return 'shared'
    } catch {
      // native sheet unavailable — fall through to Web Share API, then clipboard
    }
  }

  if (hasWebShare) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }

  await copyToClipboard(opts.url)
  return 'copied'
}
