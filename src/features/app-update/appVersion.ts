/**
 * App-update version decision (framework-free).
 *
 * v1 policy: the app NEVER blocks. The manifest carries minimum-version
 * fields for future use, but `decideUpdate` only ever returns
 * `current | optional`.
 */

export interface InstalledVersion {
  version: string
  versionCode?: number
}

export interface VersionManifest {
  latestVersion: string
  latestVersionCode: number
  minimumVersion: string
  minimumVersionCode: number
  playUrl: string
  notes?: string
}

export type UpdateDecision = 'current' | 'optional'

function parseSegments(value: string): number[] {
  return value
    .split('.')
    .map((part) => {
      const n = parseInt(part.replace(/[^0-9].*$/, ''), 10)
      return Number.isNaN(n) ? 0 : n
    })
}

/** Numeric dot-separated compare: -1 | 0 | 1. */
export function compareVersionNames(a: string, b: string): number {
  const left = parseSegments(a)
  const right = parseSegments(b)
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i++) {
    const l = left[i] ?? 0
    const r = right[i] ?? 0
    if (l < r) return -1
    if (l > r) return 1
  }
  return 0
}

export function decideUpdate(
  installed: InstalledVersion,
  manifest: VersionManifest,
): UpdateDecision {
  const hasName = (installed.version || '').trim().length > 0
  const installedCode =
    typeof installed.versionCode === 'number' &&
    Number.isFinite(installed.versionCode)
      ? installed.versionCode
      : null

  // Unknown install — never nag, never block.
  if (!hasName && installedCode === null) return 'current'

  if (
    installedCode !== null &&
    typeof manifest.latestVersionCode === 'number' &&
    Number.isFinite(manifest.latestVersionCode)
  ) {
    return installedCode >= manifest.latestVersionCode ? 'current' : 'optional'
  }

  if (hasName && manifest.latestVersion) {
    return compareVersionNames(installed.version, manifest.latestVersion) >= 0
      ? 'current'
      : 'optional'
  }

  return 'current'
}
