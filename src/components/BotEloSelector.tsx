'use client'

import { getAvailableSkillLevels, type SkillLevel } from '@/features/bots/botConfig'

interface BotEloSelectorProps {
  selectedLevel: number
  onSelect: (level: number) => void
}

export function BotEloSelector({ selectedLevel, onSelect }: BotEloSelectorProps) {
  const skillLevels = getAvailableSkillLevels()

  return (
    <div className="w-full max-w-sm mx-auto">
      <p className="text-center text-[11px] text-gray-500 dark:text-gray-500 tracking-[0.15em] uppercase mb-3 font-medium">
        Select opponent skill level
      </p>
      <div className="grid grid-cols-3 gap-2">
        {skillLevels.map((level: SkillLevel) => (
          <button
            key={level.level}
            onClick={() => onSelect(level.level)}
            className={`p-3 rounded-xl border-2 transition-all duration-200 text-center min-h-[44px] ${
              selectedLevel === level.level
                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                : 'border-gray-300 dark:border-white/8 bg-gray-50 dark:bg-white/[0.03] hover:border-gray-400 dark:hover:border-white/15 hover:bg-gray-100 dark:hover:bg-white/[0.05]'
            }`}
          >
            <div className="text-xs font-bold text-gray-900 dark:text-white">{level.label}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-500 font-medium">{level.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
