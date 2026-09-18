/**
 * Bundled app version (build-time stamp).
 *
 * Single source of truth for "what release is installed":
 * - Android bundle: stamped by build-aab.sh / build-apk.sh from
 *   android-version.properties into NEXT_PUBLIC_APP_VERSION/CODE.
 * - Web: stamped by the Cloudflare deploy workflow the same way.
 * - Dev fallback: package.json version is NOT read at runtime; the
 *   native App.getInfo() fallback lives in the useAppUpdate hook.
 */

export interface BundledVersion {
  version: string
  versionCode: number | null
}

function parseVersionCode(raw: string | undefined): number | null {
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export function getBundledVersion(): BundledVersion {
  const version =
    (typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_APP_VERSION) ||
    ''
  const versionCode = parseVersionCode(
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_VERSION_CODE
      : undefined,
  )
  return { version: version.trim(), versionCode }
}

/** Small "Version 1.x.x" label for Settings/About surfaces. */
export function formatVersionLabel(version: string): string {
  const v = (version || '').trim()
  return v ? `Version ${v}` : ''
}
