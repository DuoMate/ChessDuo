import { Capacitor, registerPlugin } from '@capacitor/core'
import { GameStatus } from '@/features/shared/gameTypes'
import {
  enterPip,
  getPipModeActive,
  reaffirmPipEligible,
  resetPipEligibleCache,
  setPipEligible,
  shouldEnablePip,
  subscribePipModeChanged,
} from '../pip'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn() },
  registerPlugin: jest.fn(() => ({
    setEligible: jest.fn().mockResolvedValue(undefined),
    enter: jest.fn().mockResolvedValue(undefined),
    isInPip: jest.fn().mockResolvedValue({ inPip: false }),
    addListener: jest.fn().mockResolvedValue({ remove: jest.fn().mockResolvedValue(undefined) }),
  })),
}))

const pipPlugin = (registerPlugin as jest.Mock).mock.results[0].value as {
  setEligible: jest.Mock
  enter: jest.Mock
  addListener: jest.Mock
}

describe('pip eligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetPipEligibleCache()
  })

  it('enables PiP while a match is PLAYING with no blocking modal', () => {
    expect(shouldEnablePip(GameStatus.PLAYING, false)).toBe(true)
  })

  it('covers every game mode playing state (string + enum forms)', () => {
    // DuelGame / CoachGame use lowercase literals; Game.tsx uses the enum.
    expect(shouldEnablePip('playing', false)).toBe(true)
    expect(shouldEnablePip(GameStatus.PLAYING, false)).toBe(true)
  })

  it('disables PiP for every terminal / non-active state', () => {
    expect(shouldEnablePip(GameStatus.WAITING, false)).toBe(false)
    expect(shouldEnablePip(GameStatus.READY, false)).toBe(false)
    expect(shouldEnablePip(GameStatus.GAME_OVER, false)).toBe(false)
    expect(shouldEnablePip('waiting', false)).toBe(false)
    expect(shouldEnablePip('game_over', false)).toBe(false)
    expect(shouldEnablePip('idle', false)).toBe(false)
  })

  it('disables PiP when a decision modal is open, even mid-game', () => {
    expect(shouldEnablePip(GameStatus.PLAYING, true)).toBe(false)
    expect(shouldEnablePip('playing', true)).toBe(false)
  })
})

describe('pip bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetPipEligibleCache()
  })

  it('publishes eligibility changes to native exactly once per change', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)

    await setPipEligible(true)
    await setPipEligible(true)
    await setPipEligible(true)

    expect(pipPlugin.setEligible).toHaveBeenCalledTimes(1)
    expect(pipPlugin.setEligible).toHaveBeenCalledWith({ eligible: true })

    await setPipEligible(false)
    expect(pipPlugin.setEligible).toHaveBeenCalledTimes(2)
    expect(pipPlugin.setEligible).toHaveBeenCalledWith({ eligible: false })
  })

  it('retries publishing the same value after a native failure', async () => {
    // Regression: the first publish can race plugin attach (activity null)
    // and reject. The dedupe cache must not suppress the retry, otherwise
    // auto-enter params are never set and Home never enters PiP.
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    pipPlugin.setEligible.mockRejectedValueOnce(new Error('bridge not ready'))

    await setPipEligible(true)
    await setPipEligible(true)

    expect(pipPlugin.setEligible).toHaveBeenCalledTimes(2)
    expect(pipPlugin.setEligible).toHaveBeenLastCalledWith({ eligible: true })
  })

  it('reaffirms the last published value even without a change', async () => {
    // Used on app resume: re-assert auto-enter params idempotently.
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)

    await setPipEligible(true)
    await reaffirmPipEligible()

    expect(pipPlugin.setEligible).toHaveBeenCalledTimes(2)
    expect(pipPlugin.setEligible).toHaveBeenLastCalledWith({ eligible: true })
  })

  it('never throws and never touches native on web builds', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)

    await expect(setPipEligible(true)).resolves.toBeUndefined()
    await expect(enterPip()).resolves.toBe(false)
    expect(pipPlugin.setEligible).not.toHaveBeenCalled()
    expect(pipPlugin.enter).not.toHaveBeenCalled()
  })

  it('resolves false when native entry rejects (not eligible / old Android)', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    pipPlugin.enter.mockRejectedValueOnce(new Error('not eligible'))

    await expect(enterPip()).resolves.toBe(false)
  })

  it('stays out of PiP mode on web and unsubscribes cleanly', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)

    expect(getPipModeActive()).toBe(false)
    const listener = jest.fn()
    const unsubscribe = subscribePipModeChanged(listener)
    expect(() => unsubscribe()).not.toThrow()
    expect(listener).not.toHaveBeenCalled()
  })

  it('forwards native pipModeChanged events to subscribers', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    let captured: ((event: { inPip: boolean }) => void) | null = null
    pipPlugin.addListener.mockImplementationOnce(
      (_event: string, cb: (event: { inPip: boolean }) => void) => {
        captured = cb
        return Promise.resolve({ remove: jest.fn().mockResolvedValue(undefined) })
      },
    )

    const listener = jest.fn()
    const unsubscribe = subscribePipModeChanged(listener)
    await Promise.resolve()
    expect(captured).not.toBeNull()
    captured!({ inPip: true })

    expect(listener).toHaveBeenCalledWith(true)
    expect(getPipModeActive()).toBe(true)
    expect(() => unsubscribe()).not.toThrow()
  })
})
