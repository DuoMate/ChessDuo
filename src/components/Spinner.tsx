'use client'

import type { ReactNode } from 'react'

type SpinnerSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
}

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
  label?: ReactNode
}

export function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label="Loading">
      <span
        className={`animate-spin rounded-full border-slate-400 border-t-transparent dark:border-slate-300 dark:border-t-transparent ${sizeMap[size]} ${className}`}
      />
      {label && <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>}
    </span>
  )
}
