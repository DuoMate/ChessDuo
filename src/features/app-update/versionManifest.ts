/**
 * Remote version-manifest fetch (framework-free).
 *
 * Fail-silent by contract: any network, timeout, HTTP, or shape problem
 * resolves to `null` so startup is never blocked by the version check.
 */
import type { VersionManifest } from './appVersion'

export type FetchLike = (
  input: string,
  init?: Record<string, unknown>,
) => Promise<{
  ok: boolean
  json: () => Promise<unknown>
}>

interface FetchManifestOptions {
  baseUrl: string
  fetchFn?: FetchLike
  timeoutMs?: number
}

export function isValidManifest(payload: unknown): payload is VersionManifest {
  if (!payload || typeof payload !== 'object') return false
  const m = payload as Record<string, unknown>
  return (
    typeof m.latestVersion === 'string' &&
    m.latestVersion.length > 0 &&
    typeof m.latestVersionCode === 'number' &&
    Number.isFinite(m.latestVersionCode) &&
    typeof m.playUrl === 'string' &&
    m.playUrl.length > 0
  )
}

export function resolveManifestUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/version.json`
}

/**
 * Pure base-URL resolver (framework-free: no process.env / window access).
 *
 * The caller (hook/lib layer) supplies the deployed site URL and the current
 * origin — e.g. `resolveManifestBaseUrl(process.env.NEXT_PUBLIC_SITE_URL,
 * window.location.origin)`. Empty string means "no safe base, skip the check".
 */
export function resolveManifestBaseUrl(siteUrl?: string, origin?: string): string {
  const env = (siteUrl || '').trim().replace(/\/$/, '')
  if (env) return env
  const fallback = (origin || '').trim().replace(/\/$/, '')
  return fallback
}

export async function fetchVersionManifest(
  options: FetchManifestOptions,
): Promise<VersionManifest | null> {
  const { baseUrl, timeoutMs = 6000 } = options
  if (!baseUrl) return null
  const fetchFn: FetchLike =
    options.fetchFn ??
    ((globalThis.fetch as unknown as FetchLike) || (() => Promise.reject(new Error('no fetch'))))

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer: ReturnType<typeof setTimeout> | null =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null

  try {
    const response = await fetchFn(resolveManifestUrl(baseUrl), {
      cache: 'no-store',
      signal: controller?.signal,
    })
    if (!response || !response.ok) return null
    const payload = await response.json()
    return isValidManifest(payload) ? payload : null
  } catch {
    // Offline, slow, aborted, or malformed — fail silently.
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}
