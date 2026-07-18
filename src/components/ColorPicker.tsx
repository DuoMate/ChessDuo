'use client'

import { ChessPawn, Dices } from 'lucide-react'
import { PlayerColor } from '@/features/shared/gameConstants'

interface ColorPickerProps {
  value: PlayerColor
  onChange: (color: PlayerColor) => void
}

interface ColorOption {
  id: PlayerColor
  label: string
  Icon: typeof ChessPawn
  iconClass: string
  ariaSuffix: string
}

const COLOR_OPTIONS: ColorOption[] = [
  {
    id: 'white',
    label: 'White',
    Icon: ChessPawn,
    iconClass: 'text-slate-100 fill-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.5)]',
    ariaSuffix: 'white pieces',
  },
  {
    id: 'black',
    label: 'Black',
    Icon: ChessPawn,
    iconClass: 'text-slate-900 fill-slate-900 dark:fill-slate-100 dark:text-slate-100',
    ariaSuffix: 'black pieces',
  },
  {
    id: 'random',
    label: 'Random',
    Icon: Dices,
    iconClass: 'text-blue-500 dark:text-blue-300',
    ariaSuffix: 'random color',
  },
]

/**
 * 3-card color picker for choosing White / Black / Random pieces.
 * Used both standalone on the mobile home screen and inside the
 * `ConfigurationPanel` modal on browser. See
 * `docs/superpowers/specs/2026-07-18-home-screen-restructure-color-picker-design.md` § 5.3.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Choose your color">
      {COLOR_OPTIONS.map(({ id, label, Icon, iconClass, ariaSuffix }) => {
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Play as ${ariaSuffix}`}
            onClick={() => onChange(id)}
            className={[
              'min-h-[64px] min-w-[44px] flex flex-col items-center justify-center gap-1.5',
              'rounded-xl border-2 px-2 py-2.5 transition-all duration-200',
              selected
                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10 shadow-[var(--shadow-glow-blue-strong)]'
                : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60',
            ].join(' ')}
          >
            <Icon
              size={22}
              strokeWidth={1.8}
              className={iconClass}
              aria-hidden="true"
            />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
