import { Capacitor } from '@capacitor/core'
import { isNativePlatform } from './share'

export const PLAY_APP_ID = 'com.navron.chessduo'

export const PLAY_LISTING_URL = `https://play.google.com/store/apps/details?id=${PLAY_APP_ID}`

export const PLAY_MARKET_URI = `market://details?id=${PLAY_APP_ID}`

export type OpenListingResult = 'opened' | 'unavailable'

/**
 * Opens the ChessDuo Google Play listing so the user can rate & review.
 * Best effort — never throws, never affects app flow.
 *
 * Native: `market://` deep link (lands in the Play Store app, where the
 * user is already signed in). Web / Play-app-missing: HTTPS listing URL
 * via the Capacitor Browser plugin (Custom Tabs) or a plain new tab.
 */
export async function openPlayListing(): Promise<OpenListingResult> {
  if (typeof window === 'undefined') return 'unavailable'
  if (isNativePlatform() && Capacitor.isNativePlatform()) {
    try {
      // Fires the Play Store intent on GMS devices. window.open never
      // navigates the current WebView away, so an unhandled scheme fails
      // silently here and the HTTPS fallback below still applies on throw.
      window.open(PLAY_MARKET_URI, '_system')
      return 'opened'
    } catch {
      // Play Store app missing or scheme unhandled — fall through to HTTPS
    }
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
