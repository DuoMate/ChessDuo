import { Capacitor } from '@capacitor/core'
import { isNativePlatform } from './share'

export const PLAY_APP_ID = 'com.navron.chessduo'

export const PLAY_LISTING_URL = `https://play.google.com/store/apps/details?id=${PLAY_APP_ID}`

export const PLAY_MARKET_URI = `market://details?id=${PLAY_APP_ID}`

export type OpenListingResult = 'opened' | 'unavailable'

/**
 * Opens the ChessDuo Google Play listing so the user can update or rate.
 * Best effort — never throws, never affects app flow.
 *
 * Native: HTTPS Play listing via the Capacitor Browser plugin (Custom Tabs),
 * which reliably lands on the Play Store page where the user is signed in.
 * `window.open(url, '_system')` is intentionally NOT used on native: the
 * Capacitor WebView has no popup/new-window handler (no onCreateWindow
 * override), so the market:// deep link silently never fires and — because
 * it returns instead of throwing — the old Browser fallback never ran. The
 * HTTPS URL is guaranteed-openable on every device. Web: plain new tab.
 */
export async function openPlayListing(): Promise<OpenListingResult> {
  if (typeof window === 'undefined') return 'unavailable'
  if (isNativePlatform() && Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: PLAY_LISTING_URL })
      return 'opened'
    } catch {
      // Browser plugin unavailable — fall through to window.open below
    }
  }
  try {
    window.open(PLAY_LISTING_URL, '_blank', 'noopener')
    return 'opened'
  } catch {
    // popup blocked or no browser context — nothing else to do
    return 'unavailable'
  }
}
