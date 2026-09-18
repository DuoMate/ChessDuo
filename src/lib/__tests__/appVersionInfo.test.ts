import { getBundledVersion, formatVersionLabel } from '../appVersionInfo'

describe('appVersionInfo', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('reads the build-time stamp from env', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.386'
    process.env.NEXT_PUBLIC_VERSION_CODE = '386'
    expect(getBundledVersion()).toEqual({
      version: '1.0.386',
      versionCode: 386,
    })
  })

  it('returns empty version and null code when unstamped', () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION
    delete process.env.NEXT_PUBLIC_VERSION_CODE
    expect(getBundledVersion()).toEqual({ version: '', versionCode: null })
  })

  it('ignores a non-numeric version code', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.386'
    process.env.NEXT_PUBLIC_VERSION_CODE = 'not-a-number'
    expect(getBundledVersion().versionCode).toBeNull()
  })

  it('formats the settings label', () => {
    expect(formatVersionLabel('1.0.386')).toBe('Version 1.0.386')
    expect(formatVersionLabel('')).toBe('')
  })
})
