'use client'

import { DIFFICULTY_LEVELS } from './difficultyLevels'

interface BotDifficultyGridProps {
  selectedLevel: number
  onSelect: (level: number) => void
}

/**
 * Shared 5-card bot-difficulty grid (Easy/Medium/Hard/Expert/Master).
 * Extracted from the home screen selector so Quick Play / Duo / AI Coach
 * all render the identical control. Visuals unchanged from the original.
 */
export function BotDifficultyGrid({ selectedLevel, onSelect }: BotDifficultyGridProps) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Bot difficulty">
        {DIFFICULTY_LEVELS.map(({ level, label, Icon }) => {
          const selected = level === selectedLevel
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label} difficulty`}
              onClick={() => onSelect(level)}
              className={[
                'min-h-[64px] min-w-[44px] flex flex-col items-center justify-center gap-0.5',
                'rounded-xl border-2 px-1 py-2 transition-all duration-200',
                selected
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10 shadow-[var(--shadow-glow-blue-strong)]'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60',
              ].join(' ')}
            >
              <Icon
                size={18}
                strokeWidth={1.8}
                className={selected
                  ? 'text-blue-600 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300'}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
