'use client'

import { useState, useCallback } from 'react'

const SETTINGS_KEY = 'chessduo_settings'

interface Settings {
  autoQueen: boolean
  lowTimeWarning: boolean
}

const DEFAULTS: Settings = {
  autoQueen: false,
  lowTimeWarning: true,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        autoQueen: parsed.autoQueen ?? DEFAULTS.autoQueen,
        lowTimeWarning: parsed.lowTimeWarning ?? DEFAULTS.lowTimeWarning,
      }
    }
  } catch {}
  return { ...DEFAULTS }
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {}
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return loadSettings()[key]
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const settings = loadSettings()
  settings[key] = value
  saveSettings(settings)
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

  return {
    autoQueen: settings.autoQueen,
    lowTimeWarning: settings.lowTimeWarning,
    setAutoQueen,
    setLowTimeWarning,
  }
}
