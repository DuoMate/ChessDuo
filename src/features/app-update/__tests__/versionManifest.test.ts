import { fetchVersionManifest, resolveManifestBaseUrl } from '../versionManifest'

const MANIFEST = {
  latestVersion: '1.0.387',
  latestVersionCode: 387,
  minimumVersion: '1.0.300',
  minimumVersionCode: 300,
  playUrl: 'https://play.google.com/store/apps/details?id=com.navron.chessduo',
}

describe('fetchVersionManifest (fail-silent, cache-safe)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the manifest on success with no-store semantics', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MANIFEST),
    })
    const result = await fetchVersionManifest({
      baseUrl: 'https://chessduo.navron.org',
      fetchFn,
      timeoutMs: 1000,
    })
    expect(result).toEqual(MANIFEST)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(String(url)).toContain('/version.json')
    expect(init.cache).toBe('no-store')
  })

  it('returns null when the endpoint is unavailable (never throws)', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('offline'))
    const result = await fetchVersionManifest({
      baseUrl: 'https://chessduo.navron.org',
      fetchFn,
      timeoutMs: 50,
    })
    expect(result).toBeNull()
  })

  it('returns null on non-ok responses', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404 })
    const result = await fetchVersionManifest({
      baseUrl: 'https://chessduo.navron.org',
      fetchFn,
      timeoutMs: 1000,
    })
    expect(result).toBeNull()
  })

  it('returns null on malformed payloads', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ nope: true }),
    })
    const result = await fetchVersionManifest({
      baseUrl: 'https://chessduo.navron.org',
      fetchFn,
      timeoutMs: 1000,
    })
    expect(result).toBeNull()
  })
})

describe('resolveManifestBaseUrl (pure, framework-free)', () => {
  it('prefers the deployed site URL and strips trailing slashes', () => {
    expect(
      resolveManifestBaseUrl('https://chessduo.navron.org/', 'https://other.dev'),
    ).toBe('https://chessduo.navron.org')
  })

  it('falls back to the current origin when no site URL is given', () => {
    expect(resolveManifestBaseUrl('', 'https://other.dev')).toBe('https://other.dev')
    expect(resolveManifestBaseUrl(undefined, 'https://other.dev')).toBe(
      'https://other.dev',
    )
  })

  it('returns empty string when neither is available (caller skips the check)', () => {
    expect(resolveManifestBaseUrl('', '')).toBe('')
    expect(resolveManifestBaseUrl()).toBe('')
  })
})
