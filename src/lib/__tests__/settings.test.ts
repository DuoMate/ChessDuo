import { getSetting, setSetting, useSettings } from '../../lib/settings'
import { renderHook, act } from '@testing-library/react'

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('getSetting returns defaults', () => {
    expect(getSetting('autoQueen')).toBe(false)
    expect(getSetting('lowTimeWarning')).toBe(true)
  })

  test('setSetting persists value', () => {
    setSetting('autoQueen', true)
    expect(getSetting('autoQueen')).toBe(true)
  })

  test('setSetting and getSetting in sequence', () => {
    setSetting('lowTimeWarning', false)
    setSetting('autoQueen', true)
    expect(getSetting('lowTimeWarning')).toBe(false)
    expect(getSetting('autoQueen')).toBe(true)
  })

  test('useSettings returns default values', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.autoQueen).toBe(false)
    expect(result.current.lowTimeWarning).toBe(true)
  })

  test('useSettings toggles autoQueen', () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current.setAutoQueen(true)
    })
    expect(result.current.autoQueen).toBe(true)
    expect(getSetting('autoQueen')).toBe(true)
  })

  test('useSettings toggles lowTimeWarning', () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current.setLowTimeWarning(false)
    })
    expect(result.current.lowTimeWarning).toBe(false)
    expect(getSetting('lowTimeWarning')).toBe(false)
  })
})
