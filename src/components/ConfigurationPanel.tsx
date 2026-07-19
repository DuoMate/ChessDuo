'use client'

import { Volume2, VolumeX, Shield, ShieldCheck } from 'lucide-react'
import { PlayerColor } from '@/features/shared/gameConstants'
import { useSettings } from '@/lib/settings'
import { ColorPicker } from './ColorPicker'

interface ConfigurationPanelProps {
  selectedLevel: number
  onSelectLevel: (level: number) => void
  selectedColor: PlayerColor
  onSelectColor: (color: PlayerColor) => void
  difficultyLevels: Array<{
    level: number
    label: string
    Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
    description: string
  }>
}

export function ConfigurationPanel({
  selectedLevel,
  onSelectLevel,
  selectedColor,
  onSelectColor,
  difficultyLevels,
}: ConfigurationPanelProps) {
  const { confirmMove, setConfirmMove, soundEnabled, setSoundEnabled } = useSettings()
  const selectedDifficulty = difficultyLevels.find(d => d.level === selectedLevel)

  return (
    <div className="flex flex-col gap-6 p-5">
      {/* Bot Difficulty */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400 mb-3">
          Bot Difficulty
        </h3>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Bot difficulty">
          {difficultyLevels.map(({ level, label, Icon }) => {
            const selected = level === selectedLevel
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${label} difficulty`}
                onClick={() => onSelectLevel(level)}
                className={[
                  'min-h-[64px] min-w-[44px] flex flex-col items-center justify-center gap-1',
                  'rounded-xl border-2 px-1 py-2 transition-all duration-200',
                  selected
                    ? 'border-purple-500 bg-purple-500/10 dark:border-purple-400 dark:bg-purple-500/15 shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-600',
                ].join(' ')}
              >
                <Icon
                  size={22}
                  strokeWidth={1.8}
                  className={selected
                    ? 'text-purple-600 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-300'}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
        {selectedDifficulty && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {selectedDifficulty.description}
          </p>
        )}
      </section>

      {/* Choose Your Color */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400 mb-3">
          Choose Your Color
        </h3>
        <ColorPicker value={selectedColor} onChange={onSelectColor} />
      </section>

      {/* Game Settings */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400 mb-3">
          Game Settings
        </h3>
        <div className="flex flex-col gap-3">
          {/* Confirm Moves */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              {confirmMove ? (
                <ShieldCheck size={20} className="text-purple-500 dark:text-purple-400" />
              ) : (
                <Shield size={20} className="text-slate-400 dark:text-slate-500" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Confirm Moves</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Add confirmation before final move</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={confirmMove}
              onClick={() => setConfirmMove(!confirmMove)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                confirmMove
                  ? 'bg-purple-500'
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  confirmMove ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sound Effects */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 size={20} className="text-purple-500 dark:text-purple-400" />
              ) : (
                <VolumeX size={20} className="text-slate-400 dark:text-slate-500" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Sound Effects</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Play sounds for moves</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                soundEnabled
                  ? 'bg-purple-500'
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
