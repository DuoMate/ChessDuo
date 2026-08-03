'use client'

import { useState, useCallback } from 'react'
import { loadSettings, saveSettings, type Settings, type Theme } from '@/lib/settingsStorage'

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings)

  const setAutoQueen = useCallback((value: boolean) => {
    setSettingsState(prev => {
      const updated = { ...prev, autoQueen: value }
      saveSettings(updated)
      return updated
    })
  }, [])

  const setLowTimeWarning = useCallback((value: boolean) => {
    setSettingsState(prev => {
      const updated = { ...prev, lowTimeWarning: value }
      saveSettings(updated)
      return updated
    })
  }, [])

  const setTheme = useCallback((value: Theme) => {
    setSettingsState(prev => {
      const updated = { ...prev, theme: value }
      saveSettings(updated)
      document.documentElement.classList.toggle('dark', value === 'dark')
      return updated
    })
  }, [])

  const setConfirmMove = useCallback((value: boolean) => {
    setSettingsState(prev => {
      const updated = { ...prev, confirmMove: value }
      saveSettings(updated)
      return updated
    })
  }, [])

  const setSoundEnabled = useCallback((value: boolean) => {
    setSettingsState(prev => {
      const updated = { ...prev, soundEnabled: value }
      saveSettings(updated)
      return updated
    })
  }, [])

  return {
    autoQueen: settings.autoQueen,
    lowTimeWarning: settings.lowTimeWarning,
    confirmMove: settings.confirmMove,
    soundEnabled: settings.soundEnabled,
    theme: settings.theme,
    setAutoQueen,
    setLowTimeWarning,
    setTheme,
    setConfirmMove,
    setSoundEnabled,
  }
}
