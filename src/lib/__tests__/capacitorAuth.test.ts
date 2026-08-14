import { getPathFromUrl } from '../capacitorAuth'

jest.mock('@capacitor/app', () => ({
  App: {
    getLaunchUrl: jest.fn().mockResolvedValue({ url: null }),
    addListener: jest.fn(),
  },
}))

jest.mock('@capacitor/browser', () => ({
  Browser: { close: jest.fn() },
}))

describe('getPathFromUrl (deep-link parsing)', () => {
  it('parses chessduo://premium as /premium', () => {
    expect(getPathFromUrl('chessduo://premium?session_id=sess-1')).toBe('/premium?session_id=sess-1')
  })

  it('parses chessduo:///premium (triple slash) as /premium — Bug: protocol-relative //path', () => {
    expect(getPathFromUrl('chessduo:///premium?session_id=sess-2')).toBe('/premium?session_id=sess-2')
  })

  it('parses com.navron.chessduo:// with triple slash too', () => {
    expect(getPathFromUrl('com.navron.chessduo:///invite/user-123')).toBe('/invite/user-123')
  })

  it('parses https deep links via URL parsing', () => {
    expect(getPathFromUrl('https://chessduo.workers.dev/game?room=abc')).toBe('/game?room=abc')
  })

  it('strips leading slashes from scheme URLs (Bug 39: full-reload deep link race)', () => {
    expect(getPathFromUrl('chessduo://///duel?room=abc')).toBe('/duel?room=abc')
  })

  it('returns null for unknown schemes', () => {
    expect(getPathFromUrl('somescheme://nope')).toBeNull()
  })
})

describe('infinite-loop guard (currentPath === targetPath)', () => {
  // The guard in handleDeepLink compares:
  //   window.location.pathname + window.location.search  ===  targetPath
  // where targetPath = getPathFromUrl(deepLinkUrl)
  //
  // When they match, window.location.replace is skipped, preventing the
  // reload loop caused by getLaunchUrl() returning the URL on every call.

  it('https invite URL maps to same path as browser current URL', () => {
    const deepLinkUrl = 'https://chessduo.navron.org/?code=ABC123'
    const targetPath = getPathFromUrl(deepLinkUrl)
    const currentPath = '/?code=ABC123'
    expect(targetPath).toBe(currentPath)
    // Guard: currentPath === targetPath → skip replace → no reload loop
  })

  it('https challenge URL maps to same path as browser current URL', () => {
    const deepLinkUrl = 'https://chessduo.navron.org/challenge/XYZ'
    const targetPath = getPathFromUrl(deepLinkUrl)
    const currentPath = '/challenge/XYZ'
    expect(targetPath).toBe(currentPath)
  })

  it('different paths trigger navigation (cold start)', () => {
    const deepLinkUrl = 'https://chessduo.navron.org/?code=DEF456'
    const targetPath = getPathFromUrl(deepLinkUrl)
    const currentPath = '/'
    expect(targetPath).not.toBe(currentPath)
    // Guard does NOT match → replace IS called → normal cold-start navigation
  })
})
