const SETTINGS_KEY = 'chessduo_settings'

export type Theme = 'dark' | 'light'

export interface Settings {
  autoQueen: boolean
  lowTimeWarning: boolean
  confirmMove: boolean
  soundEnabled: boolean
  theme: Theme
  /**
   * Quick Play "Play My Move" (opt-in): the player's legal move is always the
   * move that gets played; the bot still calculates its best move and shows it
   * as the existing shadow/hint only. Default OFF — existing behavior is
   * unchanged. Scoped to Quick Play (offline LocalGame).
   */
  playMyMove: boolean
}

const DEFAULTS: Settings = {
  autoQueen: false,
  lowTimeWarning: true,
  confirmMove: false,
  soundEnabled: true,
  theme: 'dark',
  playMyMove: false,
}

export function loadSettings(): Settings {
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
        playMyMove: parsed.playMyMove ?? DEFAULTS.playMyMove,
      }
    }
  } catch (e) { console.error('[Settings] Failed to parse localStorage:', e) }
  return { ...DEFAULTS }
}

export function saveSettings(settings: Settings): void {
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
