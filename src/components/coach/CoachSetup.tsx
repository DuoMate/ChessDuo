'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import type { PlayerColor } from '@/features/shared/gameConstants'
import { ColorPicker } from '@/components/ColorPicker'
import { BotDifficultyGrid } from '@/components/BotDifficultyGrid'
import { DIFFICULTY_LEVELS } from '@/components/difficultyLevels'

interface CoachSetupProps {
  initialLevel: number
  initialColor: PlayerColor
  onStart: (level: number, color: PlayerColor) => void
  onBack: () => void
}

/**
 * AI Coach setup — choose side (White/Black/Random) + opponent strength
 * (same 5 BotDifficulty levels as Quick Play / Duo), then start.
 * Rendered inside /coach after CoachGate passes; Start hands the explicit
 * selection to the game (game resolves `random` via resolvePlayerColor).
 */
export function CoachSetup({ initialLevel, initialColor, onStart, onBack }: CoachSetupProps) {
  const [level, setLevel] = useState(initialLevel)
  const [color, setColor] = useState<PlayerColor>(initialColor)
  const selected = DIFFICULTY_LEVELS.find((d) => d.level === level)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-24 pt-6">
      <div className="text-center">
        <h1 className="text-xl font-black uppercase tracking-wide text-slate-900 dark:text-white">
          AI Coach
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Choose your side and the strength of your opponent.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700/50 dark:bg-slate-900/70">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Bot Difficulty
        </p>
        <BotDifficultyGrid selectedLevel={level} onSelect={setLevel} />
        {selected && (
          <p className="mt-2 rounded-2xl border border-slate-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/30 dark:text-slate-300">
            {selected.description}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700/50 dark:bg-slate-900/70">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Choose Your <span className="text-blue-500 dark:text-blue-400">Color</span>
        </p>
        <ColorPicker value={color} onChange={setColor} />
      </section>

      <button
        type="button"
        onClick={() => onStart(level, color)}
        aria-label="Start AI Coach"
        className="focus-ring flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-sm font-bold text-white shadow-[0_4px_24px_rgba(16,185,129,0.35)] transition-all duration-200 hover:from-emerald-400 hover:to-green-500 active:scale-[0.97]"
      >
        <Play size={20} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
        Start AI Coach
      </button>
      <button
        type="button"
        onClick={onBack}
        className="focus-ring min-h-[44px] w-full rounded-xl text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        Back
      </button>
    </div>
  )
}
