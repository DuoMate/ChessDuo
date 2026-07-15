describe('push notification registration', () => {
  const localStorageMock = (() => {
    const store = new Map<string, string>()
    return {
      getItem: jest.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: jest.fn((key: string) => {
        store.delete(key)
      }),
      clear: jest.fn(() => {
        store.clear()
      }),
    }
  })()

  beforeEach(() => {
    jest.resetModules()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    })
    jest.clearAllMocks()
  })

  it('cleans up the in-progress flag when permission request fails', async () => {
    jest.doMock('@capacitor/core', () => ({
      Capacitor: {
        isNativePlatform: () => true,
      },
    }))

    jest.doMock('@capacitor/push-notifications', () => ({
      PushNotifications: {
        requestPermissions: jest.fn().mockRejectedValue(new Error('permission denied')),
      },
    }), { virtual: true })

    const { registerDeviceToken } = await import('../PushNotificationService')

    await expect(registerDeviceToken()).resolves.toBeUndefined()
    expect(localStorageMock.getItem('chessduo_push_in_progress')).toBeNull()
  })
})
