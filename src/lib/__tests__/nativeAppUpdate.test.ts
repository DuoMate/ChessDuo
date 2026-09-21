import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  checkNativeUpdate,
  cleanupNativeUpdate,
  completeNativeUpdate,
  isNativeAppUpdateSupported,
  startNativeFlexibleUpdate,
  subscribeNativeUpdateState,
} from '../nativeAppUpdate'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn() },
  registerPlugin: jest.fn(() => ({
    check: jest.fn(),
    startFlexibleUpdate: jest.fn(),
    completeUpdate: jest.fn(),
    cleanup: jest.fn(),
    addListener: jest.fn().mockResolvedValue({ remove: jest.fn().mockResolvedValue(undefined) }),
  })),
}))

jest.mock('../debug', () => ({ DEBUG: false }))

const { Capacitor: MockCapacitor } = jest.requireMock('@capacitor/core') as {
  Capacitor: { isNativePlatform: jest.Mock }
}

const mockPlugin = (jest.requireMock('@capacitor/core') as { registerPlugin: jest.Mock }).registerPlugin
  .mock.results[0].value as {
  check: jest.Mock
  startFlexibleUpdate: jest.Mock
  completeUpdate: jest.Mock
  cleanup: jest.Mock
  addListener: jest.Mock
}

describe('nativeAppUpdate bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    MockCapacitor.isNativePlatform.mockReturnValue(true)
  })

  it('is native-only', () => {
    MockCapacitor.isNativePlatform.mockReturnValue(false)
    expect(isNativeAppUpdateSupported()).toBe(false)
  })

  it('returns available status from a native check', async () => {
    mockPlugin.check.mockResolvedValue({
      available: true,
      availableVersionCode: 393,
      stalenessDays: 1,
      flexibleAllowed: true,
      immediateAllowed: true,
      updateAvailability: 2,
    })
    const status = await checkNativeUpdate()
    expect(status.available).toBe(true)
    expect(status.availableVersionCode).toBe(393)
    expect(status.flexibleAllowed).toBe(true)
    expect(MockCapacitor.isNativePlatform).toHaveBeenCalled()
  })

  it('returns not-available without throwing when Play check fails', async () => {
    mockPlugin.check.mockRejectedValue(new Error('Play unavailable'))
    await expect(checkNativeUpdate()).resolves.toMatchObject({ available: false })
  })

  it('never touches the plugin on web', async () => {
    MockCapacitor.isNativePlatform.mockReturnValue(false)
    await expect(checkNativeUpdate()).resolves.toMatchObject({ available: false })
    await expect(startNativeFlexibleUpdate()).resolves.toBe(false)
    await expect(completeNativeUpdate()).resolves.toBe(false)
    expect(mockPlugin.check).not.toHaveBeenCalled()
  })

  it('starts the flexible flow and reports started', async () => {
    mockPlugin.startFlexibleUpdate.mockResolvedValue({ started: true })
    await expect(startNativeFlexibleUpdate()).resolves.toBe(true)
  })

  it('falls back gracefully when the flexible flow cannot start', async () => {
    mockPlugin.startFlexibleUpdate.mockResolvedValue({ started: false, reason: 'update_not_available' })
    await expect(startNativeFlexibleUpdate()).resolves.toBe(false)
    mockPlugin.startFlexibleUpdate.mockRejectedValue(new Error('nope'))
    await expect(startNativeFlexibleUpdate()).resolves.toBe(false)
  })

  it('completes a downloaded update and never throws otherwise', async () => {
    mockPlugin.completeUpdate.mockResolvedValue(undefined)
    await expect(completeNativeUpdate()).resolves.toBe(true)
    mockPlugin.completeUpdate.mockRejectedValue(new Error('not downloaded'))
    await expect(completeNativeUpdate()).resolves.toBe(false)
  })

  it('subscribes to state changes and unsubscribes', async () => {
    const handle = { remove: jest.fn().mockResolvedValue(undefined) }
    mockPlugin.addListener.mockResolvedValue(handle)
    const listener = jest.fn()
    const unsubscribe = subscribeNativeUpdateState(listener)
    expect(mockPlugin.addListener).toHaveBeenCalledWith('stateChanged', expect.any(Function))
    unsubscribe()
    // After unsubscribe the late-resolved handle is removed.
    await Promise.resolve()
    expect(handle.remove).toHaveBeenCalled()
  })

  it('cleanup is best-effort', async () => {
    mockPlugin.cleanup.mockRejectedValue(new Error('gone'))
    await expect(cleanupNativeUpdate()).resolves.toBeUndefined()
  })
})