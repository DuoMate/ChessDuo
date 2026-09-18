import { decideUpdate } from '../appVersion'

describe('decideUpdate (v1: never block)', () => {
  const manifest = {
    latestVersion: '1.0.387',
    latestVersionCode: 387,
    minimumVersion: '1.0.300',
    minimumVersionCode: 300,
    playUrl: 'https://play.google.com/store/apps/details?id=com.navron.chessduo',
  }

  it('returns current when installed code matches latest', () => {
    expect(
      decideUpdate({ version: '1.0.387', versionCode: 387 }, manifest),
    ).toBe('current')
  })

  it('returns current when installed code is newer than latest', () => {
    expect(
      decideUpdate({ version: '1.0.390', versionCode: 390 }, manifest),
    ).toBe('current')
  })

  it('returns optional when an update is available', () => {
    expect(
      decideUpdate({ version: '1.0.386', versionCode: 386 }, manifest),
    ).toBe('optional')
  })

  it('never blocks even below the minimum in v1 (optional, not required)', () => {
    expect(
      decideUpdate({ version: '1.0.100', versionCode: 100 }, manifest),
    ).toBe('optional')
  })

  it('falls back to version-name compare when codes are missing', () => {
    expect(decideUpdate({ version: '1.0.386' }, manifest)).toBe('optional')
    expect(decideUpdate({ version: '1.0.387' }, manifest)).toBe('current')
  })

  it('stays on current when installed version is unknown', () => {
    expect(decideUpdate({ version: '' }, manifest)).toBe('current')
  })
})
