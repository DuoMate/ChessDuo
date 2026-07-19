'use client'

import { useState, useCallback } from 'react'

const SETTINGS_KEY = 'chessduo_settings'

export type Theme = 'dark' | 'light'

interface Settings {
  autoQueen: boolean
  lowTimeWarning: boolean
  confirmMove: boolean
  soundEnabled: boolean
  theme: Theme
}

const DEFAULTS: Settings = {
  autoQueen: false,
  lowTimeWarning: true,
  confirmMove: false,
  soundEnabled: true,
  theme: 'dark',
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        autoQueen: parsed.autoQueen ?? DEFAULTS.autoQueen,
        lowTimeWarning: parsed.lowTimeWarning ?? DEFAULTS.lowTimeWarning,
        confirmMove: parsed.confirmMove ?? DEFAULTS.confirmMove,
        soundEnabled: parsed.soundEnabled ?? DEFAULTS.soundEnabled,
        theme: parsed.theme === 'light' ? 'light' : (parsed.theme === 'dark' ? 'dark' : DEFAULTS.theme),
      }
    }
  } catch (e) { console.error('[Settings] Failed to parse localStorage:', e) }
  return { ...DEFAULTS }
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) { console.error('[Settings] Failed to write to localStorage:', e) }
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return loadSettings()[key]
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const settings = loadSettings()
  settings[key] = value
  saveSettings(settings)
}

export function getTheme(): Theme {
  return loadSettings().theme
}

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
