'use client'

import { Crown } from 'lucide-react'

interface ChessDuoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  animate?: boolean
  className?: string
}

const sizeConfig = {
  sm: {
    crown: 20,
    text: 'text-lg',
  },
  md: {
    crown: 28,
    text: 'text-2xl',
  },
  lg: {
    crown: 36,
    text: 'text-3xl',
  },
  xl: {
    crown: 48,
    text: 'text-4xl',
  },
}

export default function ChessDuoLogo({
  size = 'md',
  showText = true,
  animate = false,
  className = '',
}: ChessDuoLogoProps) {
  const config = sizeConfig[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Crown
        size={config.crown}
        strokeWidth={1.5}
        className={`text-blue-500 dark:text-blue-400 drop-shadow-[var(--drop-shadow-glow-blue)] ${animate ? 'animate-pulse' : ''}`}
      />
      {showText && (
        <h1 className={`${config.text} font-black tracking-tight`}>
          <span className="text-slate-900 dark:text-white">Chess</span>
          <span className="text-blue-600 dark:text-blue-500">Duo</span>
        </h1>
      )}
    </div>
  )
}
