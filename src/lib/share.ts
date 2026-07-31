import { Share } from '@capacitor/share'
import { Capacitor } from '@capacitor/core'
import { getAppBaseUrl } from './appUrl'

export interface ShareLinkOptions {
  title: string
  text: string
  url: string
  nativeUrl?: string
  dialogTitle?: string
}

export function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && !!Capacitor.isNativePlatform()
}

export function toNativeLink(httpsPath: string): string {
  return `chessduo://${httpsPath.replace(/^\//, '')}`
}

export function getRoomInviteLink(roomCode: string): string {
  return isNativePlatform()
    ? `chessduo://?code=${roomCode}`
    : `${getAppBaseUrl()}/?code=${roomCode}`
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
  if (isNativePlatform()) {
    const shareUrl = opts.nativeUrl || opts.url
    try {
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: shareUrl,
        dialogTitle: opts.dialogTitle,
      })
      return 'shared'
    } catch {
      await copyToClipboard(shareUrl)
      return 'copied'
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
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
